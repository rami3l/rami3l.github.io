+++
title = "The Making of Claveilleur"
date = "2023-08-03"
description = "The extremely simple macOS input source switching daemon behind the scenes."

tags = ["macOS", "Swift", "keyboard"]
+++

> Now playing: [Bad Apple!!](https://www.youtube.com/watch?v=FtutLA63Cp8)

## Problem

Being a polyglot can be painful sometimes.

Particularly, it is extremely common for me to have multiple windows open at the same time,
each using a different language:
at this very moment, I have my messenger on where I participate conversations in Chinese,
and I am writing this post in English at the same time in my VSCode window.

As a result, with OS defaults, I have to switch between input sources (a.k.a. input methods)
so often that I have even grown the bad habit of continuously pressing the `fn` key for...
nothing at all.
Assuredly, `fn` is more convenient than Windows PCs' `win + space`,
but wouldn't it be much better if I don't have to press any key?

You might ask: doesn't `System Settings` have that feature built right in?
Well, kind of.
The problem here is that this feature of automatically switching input source
is based on the current **document**,
and thus macOS can get it wrong quite frequently.

Wouldn't it be much better if macOS could switch input sources on a **per-app** basis,
just like Windows does? [^1]
In fact, there are already many non-free solutions out there that prove this point,
like [`Input Source Pro`](https://inputsource.pro)
and [`KeyboardHolder`](https://keyboardholder.leavesc.com/zh-cn).

Now that it is theoretically possible,
why not make my own "lite version" just for fun?

Whence comes [`Claveilleur`](https://github.com/rami3l/Claveilleur),
my own open-source macOS input source switching daemon,
whose name comes from the French words for keyboard (clavier) and watchman (veilleur).

## Workflow

Just one caveat before we actually begin: I'm not your regular Apple developer.

On the one hand,
I do appreciate the speed of ARM-based Macs and the abundance of well-made GUI apps on macOS,
but as a random dev mostly doing cross-platform app development,
I haven't used Xcode that much,
and I'm just a bit reluctant to leave my polyglot-friendly VSCode...

On the other hand, the lure of Swift does seem irresistible this time
(despite the fact that I'm still new to Swift and more at ease with Rust):
it has nearly seamless Objective-C interoperability support
and I have heard of it even having some exclusive high-level macOS API bindings.

Fortunately, Apple also provides [`SourceKit-LSP`](https://github.com/apple/sourcekit-lsp)
that allows me to code in Swift using any LSP-compatible editor.
Combined with the [`SwiftPM`](https://www.swift.org/package-manager) CLI
to build the project in the terminal,
this does seem to provide the level of VSCode support that
I would expect from a popular programming language.
Thus, `Claveilleur` was made entirely without launching Xcode. [^2]

## Solution

I want `Claveilleur` to be a CLI app in the style of
[`skhd`](https://github.com/koekeishiya/skhd)
and [`yabai`](https://github.com/koekeishiya/yabai).
All you need to do as a regular user is to download the all-in-one binary,
use its CLI to tell `launchd` that you have a new daemon, and then you're good to go!

### Detecting Input Source Changes

It should be clear by now that the core of `Claveilleur` relies on
observing certain macOS desktop events such as the change of the current input source
and of the frontmost app.

Let's first try to detect current input source change.
The problem is, what APIs should I use to achieve that?

It did take me quite some time to find the right search engine keywords,
navigate to this very [`StackOverflow answer`](https://stackoverflow.com/a/26697027),
and have some slightest clue about what this Objective-C snippet is doing:

```objc
[[NSDistributedNotificationCenter defaultCenter]
           addObserver:self
              selector:@selector(myMethod:)
                  name:(__bridge NSString*)
                           kTISNotifySelectedKeyboardInputSourceChanged
                object:nil
    suspensionBehavior:NSNotificationSuspensionBehaviorDeliverImmediately];
```

I haven't written a single line of Objective-C, but it does look like C extended with
[Smalltalk-style messaging](https://en.wikipedia.org/wiki/Smalltalk#Messages)...

Aha! So here we are calling the `addObserver` method of
the default `NSDistributedNotificationCenter` with `myMethod` as the callback function.

Let's see how this might translate to Swift (\*typing in VSCode\*)...

```swift
DistributedNotificationCenter.default.
```

Wait. This looks interesting...

```swift
func publisher(
  for name: Notification.Name,
  object: AnyObject? = nil
) -> NotificationCenter.Publisher
```

It turns out that
[`Publisher`](https://developer.apple.com/documentation/foundation/notificationcenter/publisher)
allows the use of FRP (Functional Reactive Programming) on
[`NotificationCenter`](https://developer.apple.com/documentation/foundation/notificationcenter)s!

From here, things should become much easier...

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/Observers.swift#L9-L25" >}}

The code is as readable as it gets if you are familiar with FRP:

- `.publisher()`: We are processing the stream of input source change events.
  Whenever this happens, a `kTISNotifySelectedKeyboardInputSourceChanged` message will be
  posted in `DistributedNotificationCenter.default`.
- `.map()`: Whenever a message arrives, we immediately get the current (new) input method.
- `.removeDuplicates()`: We also need to ensure that the user is indeed switching to a different input method.
- `.sink()`: We get the current (frontmost) app, and associate it with the current input method.
  Later, when the current app changes, we can then use this information to restore the input method
  to that associated value.

Yes, it's just **that** simple... Or is it?

### Detecting Current App Changes

The previous snippet assumes that `getCurrentAppBundleID` is correctly implemented,
but how on earth should we get the current app and detect its change?

`NSWorkspace.shared` has a `frontmostApplication` field, the changes of which are even observable.
Thus, it is very tempting to get the app bundle ID directly from there:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/AppUtils.swift#L35-L38" >}}

... except it doesn't work all the time.

The corner case is encountered when, for example, the user activates Spotlight with `cmd + space`:
the `frontmostApplication` simply doesn't change at all!

According to [this StackOverflow question](https://stackoverflow.com/q/36264038),
this is because floating windows (such as those of Spotlight and Alfred) are somewhat special:

> [They] aren't really active because they use the `NSNonactivatingPanelMask` style mask,
> but they still can be focused.

... but there has to be another way, right?

Yes! Right in that question thread,
[Ryan H](https://stackoverflow.com/users/2246381/ryan-h) has proposed
what could very likely be the way forward:

> [...] get pids for all the apps you want,
> and use `AXObserver` and `AXObserverAddNotification` to get notifications on them.

The `AX` prefix here seems to stand for
[Carbon Accessibility](https://developer.apple.com/documentation/applicationservices/carbon_accessibility).
This makes perfect sense, since the aforementioned proprietary apps also need
accessibility privileges to run in the first place!

At this point, the plan for the next step is quite clear:
I need to detect every single `kAXFocusedWindowChangedNotification` or
`kAXApplicationHiddenNotification` message in order to correctly find out the current app!
Sounds tedious, isn't it?

To make things worse, using `AXObserver*` APIs for this purpose has some main difficulties:

- Those APIs are old C-style ones, which require another kind of dance to call,
  completely different from what we have seen previously.
- Those APIs are called on a per-PID basis, but I am not sure what PIDs will be useful to me.
- The business logic of getting the current app is since disconnected from
  the way of detecting current app changes.

#### Receiving `kAX*` Messages for a Single PID

Now, let's implement the detection and handling of `kAX*` messages
in the `WindowChangeObserver` class.

Sadly, we can not write this part of the code directly in the FRP style:
the [Carbon Accessibility](https://developer.apple.com/documentation/applicationservices/carbon_accessibility) APIs,
which belong to Apple's C-based Carbon framework,
seem to date from as early as Mac OS X v10.2,
but most Carbon APIs have already been deprecated since v10.8,
so Apple obviously didn't take the time to provide high-level abstractions for them.

However, I did find just the right amount of info
in [this Chinese blog post](https://juejin.cn/post/6919716600543182855)
to make my `WindowChangeObserver` work.
As it turns out, the way of calling `AXObserver*` APIs looks quite like the Objective-C snippet
in the [Detecting Input Source Changes](#detecting-input-source-changes) section,
but this time, I'm writing all of this in Swift rather than in C.

The first thing to do is to declare `WindowChangeObserver` as a subclass of `NSObject`:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/WindowChangeObserver.swift#L4-L15" >}}

The `notifNames` mapping here not only gives the two types of messages that we care about,
but also helps convert `kAX*` messages to regular `Notification.Name`,
so that we can send them to a `NotificationCenter` and handle them in the "old" way.

Next, we declare the callback for the observer:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/WindowChangeObserver.swift#L17-L33" >}}

We need to remember that Carbon is a C-based framework,
so naturally we are declaring a C-compatible callback above.
That is to say, despite being written as a Swift closure,
we are not allowed to capture any variable from the environment in the callback,
and the `self` reference is hidden in the `refcon` parameter.

However, apart from this restriction, what the callback does is still quite clear:
it simply sends the converted `Notification.Name` to `localNotificationCenter`.

The implementation of `init` and `deinit` methods is quite boring,
since they do almost nothing other than initializing
and deinitializing `rawObserver` respectively:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/WindowChangeObserver.swift#L35-L69" >}}

... where `.unwrap()` is just a convenience method to convert `AXError`s to exceptions
and throw them.

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/AXError%2BExtensions.swift#L3-L13" >}}

#### Tracking the Interesting PIDs

This time, let's maintain a collection of `WindowChangeObserver`s for each useful PID
in the `RunningAppsObserver` class.

As usual, `RunningAppsObserver` should be declared as a subclass of `NSObject`:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/RunningAppsObserver.swift#L3-L11" >}}

Here, `rawObserver` will be initialized to an Objective-C key-value observation
of `currentWorkSpace.runningApplications`,
which is responsible for maintaining the `windowChangeObservers` collection
by repeatedly calculating the latest changes in the observed collection of running apps:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/RunningAppsObserver.swift#L13-L45" >}}

Finally, thanks to the directions of [this Python snippet](https://gist.github.com/ljos/3040846),
we can use [Quartz Window Services](https://developer.apple.com/documentation/coregraphics/quartz_window_services) [^3]
to obtain the collection of "interesting" PIDs ("interesting" as in "having a GUI"):

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/RunningAppsObserver.swift#L47-L63" >}}

To this point, we have finally obtained an observer that can detect current window changes
from an automatically-adjusted range of PIDs and send
`Claveilleur.focusedWindowChangedNotification` or `Claveilleur.appHiddenNotification`
messages to `localNotificationCenter` accordingly:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/Observers.swift#L63" >}}

#### Consuming the Messages

After all the above efforts, we can finally return to the familiar FRP-style APIs.

First, we have a bunch of different bundle ID-generating publishers,
all likely to indicate a new current app:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/Observers.swift#L27-L41" >}}

Then, all we need to do is to declare another observer that consumes all those publishers,
and saves or loads input sources according to the current app:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/Observers.swift#L43-L61" >}}

#### Getting the Current App

Now, the core functionality of `Claveilleur` is complete.
With so much time being spent detecting current app **changes**,
the only missing piece in the puzzle [^4] seems to be
the way of actually getting the current app.

Long story short: I haven't completely figured that part out.
I have found different ways of doing this,
but it seems to me that every single one of them might fail
in one way or another under certain circumstances.

At the time of writing, this is achieved by
[combining `AXUIElementGetPid` results and `NSWorkspace` ones](https://github.com/rami3l/Claveilleur/blob/fb591deca97463a4f20e60d6cface75881c82c35/Sources/AppUtils.swift),
which seems to yield the correct result for over 90% of the time.

### Correctly Getting Accessibility Privileges

When configuring the CI builds for `Claveilleur`,
a natural idea is to build a Universal 2 (a.k.a. "fat") binary that supports both
x64 and ARM64 architectures:

```sh
swift build -c release --arch arm64 --arch x86_64
```

However, when running this build on ARM-based Macs,
it seemed that the Accessibility Privileges can never be granted
([Claveilleur/#2](https://github.com/rami3l/Claveilleur/issues/2)).

That is, the following function always returns `false`:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Sources/Privilege.swift#L5-L8" >}}

As it turns out, this has something to do with
the code signing rules that macOS is enforcing.
It just so happens that when the app is not a macOS bundle,
[it could be very hard get it signed correctly](https://www.smileykeith.com/2021/10/05/codesign-m1).

I solved this problem by first creating
a minimal bundle manifest under `Supporting/Info.plist`:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Supporting/Info.plist" >}}

... then embedding the manifest into the executable [^5] by adding `linkerSettings` to the `.executableTarget()` section in `Package.swift` like so:

{{< emgithub owner=rami3l repo=Claveilleur branch="0a5e8d2" file="Package.swift#L40-L46" >}}

... and just to be sure, signing the CI build again before publishing:

```bash
codesign -dvvv --force --sign - \
  "$(swift build --show-bin-path -c release --arch arm64 --arch x86_64)/claveilleur"
```

## Conclusion

This is in fact only my second time doing Swift
(after [`Ouverture`](https://github.com/rami3l/Ouverture)),
and my feelings towards this overall experience are
still quite complicated at this moment.

On the one hand, Swift does seem like a beautifully-designed programming language
to me, which, just like Rust,
cares a lot about bringing modern features and patterns
into a traditional procedural/object-oriented context.

On the other hand, it seems to me that even as a somewhat experienced developer,
having to use quite a bunch of under-documented and
under-maintained APIs is still a major issue
while getting my hands on macOS desktop development.

I wish Apple could realize this issue and...
change things for the better in the future, maybe?

[^1]:
    However, turning on this feature on Windows will lead to another issue
    where the task bar is also considered as an app.
    My friend [`Icecovery`](https://github.com/Icecovery)'s
    [`IMEIndicator`](https://github.com/Icecovery/IMEIndicator)
    provides more details on it and a (hacky) workaround.

[^2]: I still had to download Xcode from the Mac App Store to get the full macOS SDK :(
[^3]: Quartz is the name of the macOS window server.
[^4]:
    Apart from the part of getting and setting the current input source
    (which fits nicely into [~30 lines of Objective-C](https://github.com/daipeihust/im-select/blob/9cd5278b185a9d6daa12ba35471ec2cc1a2e3012/macOS/im-select/im-select/main.m)),
    that is.

[^5]:
    If you are using Rust for macOS desktop development,
    the [`embed_plist`](https://crates.io/crates/embed_plist)
    crate might do the work for you.
