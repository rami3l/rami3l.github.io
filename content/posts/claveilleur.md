+++
title = "The Making of Claveilleur"
date = "2023-08-03"
description = "The extremely simple macOS input source switching daemon behind the scenes."

[taxonomies]
tags = ["macOS", "Swift", "keyboard"]
+++

> Now playing: [Bad Apple!!](https://www.youtube.com/watch?v=FtutLA63Cp8)

## The Problem

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

## The Workflow

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

## The Solution

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

```objective-c
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

```swift
let currentInputSourceObserver = DistributedNotificationCenter
  .default
  .publisher(for: kTISNotifySelectedKeyboardInputSourceChanged as Notification.Name)
  .map { _ in getInputSource() }
  .removeDuplicates()
  .sink { inputSource in
    guard let currentApp = getCurrentAppBundleID() else {
      log.warning("currentInputSourceObserver: failed to get current app bundle ID for notification")
      return
    }
    log.debug(
      "currentInputSourceObserver: updating input source for `\(currentApp)` to: \(inputSource)"
    )
    saveInputSource(inputSource, forApp: currentApp)
  }
```

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

How should I implement `getCurrentAppBundleID` then?

### Detecting Current App Changes

`NSWorkspace.shared` has a `frontmostApplication` field, the changes of which are even observable.
Thus, it is very tempting to get the app bundle ID directly from there:

```swift
func getFrontmostAppBundleID() -> String? {
  let runningApp = NSWorkspace.shared.frontmostApplication
  return runningApp?.bundleIdentifier
}
```

... except it doesn't work all the time.

The corner case is encountered when, for example, the user activates Spotlight with `cmd + space`:
the `frontmostApplication` simply doesn't change at all!

According to [this StackOverflow question](https://stackoverflow.com/q/36264038),
this is because floating windows (such as those of Spotlight and Alfred) are somewhat special:

> [They] aren't really active because they use the `NSNonactivatingPanelMask` style mask,
> but they still can be focused.

... but there has to be another way, right?

TODO: Introduce the Accessibility dance

### Registering a `launchd` Daemon

### Getting Accessibility Privileges

### Distribution via GoReleaser

### Code Signing & Making a Single-Binary Bundle

[^1]: However, turning on this feature on Windows will lead to another issue
where the task bar is also considered as an app.
My friend [`Icecovery`](https://github.com/Icecovery)'s
[`IMEIndicator`](https://github.com/Icecovery/IMEIndicator)
provides more details on it and a (hacky) workaround.

[^2]: ... but I still have to download Xcode from the Mac App Store to get the full macOS SDK :(
