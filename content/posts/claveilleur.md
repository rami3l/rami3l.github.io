+++
title = "The Making of Claveilleur"
date = "2023-08-03"
description = "The extremely simple macOS input source switching daemon behind the scenes."

[taxonomies]
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

### Detecting Current App Changes

The previous snippet assumes that `getCurrentAppBundleID` is correctly implemented,
but how on earth should we get the current app and detect its change?

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

```swift
class WindowChangeObserver: NSObject {
  var currentAppPID: pid_t
  var element: AXUIElement
  var rawObserver: AXObserver?

  let notifNames =
    [
      kAXFocusedWindowChangedNotification:
        Claveilleur.focusedWindowChangedNotification,
      kAXApplicationHiddenNotification:
        Claveilleur.appHiddenNotification,
    ] as [CFString: Notification.Name]

  ...
}
```

The `notifNames` mapping here not only gives the two types of messages that we care about,
but also helps convert `kAX*` messages to regular `Notification.Name`,
so that we can send them to a `NotificationCenter` and handle them in the "old" way.

Next, we declare the callback for the observer:

```swift
class WindowChangeObserver: NSObject {
  ...

  let observerCallbackWithInfo: AXObserverCallbackWithInfo = {
    (observer, element, notif, userInfo, refcon) in
    guard let refcon = refcon else {
      return
    }
    let slf = Unmanaged<WindowChangeObserver>.fromOpaque(refcon).takeUnretainedValue()
    log.debug("WindowChangeObserver: received \(notif) from \(slf.currentAppPID)")

    guard let notifName = slf.notifNames[notif] else {
      log.warning("\(#function): unknown notification `\(notif)` detected")
      return
    }
    localNotificationCenter.post(
      name: notifName,
      object: slf.currentAppPID
    )
  }

  ...
}
```

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

```swift
class WindowChangeObserver: NSObject {
  ...

  init(pid: pid_t) throws {
    currentAppPID = pid
    element = AXUIElementCreateApplication(currentAppPID)
    super.init()

    try AXObserverCreateWithInfoCallback(
      currentAppPID,
      observerCallbackWithInfo,
      &rawObserver
    )
    .unwrap()

    let selfPtr = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
    try notifNames.keys.forEach {
      try AXObserverAddNotification(rawObserver!, element, $0, selfPtr).unwrap()
    }
    CFRunLoopAddSource(
      CFRunLoopGetCurrent(),
      AXObserverGetRunLoopSource(rawObserver!),
      CFRunLoopMode.defaultMode
    )
  }

  deinit {
    CFRunLoopRemoveSource(
      CFRunLoopGetCurrent(),
      AXObserverGetRunLoopSource(rawObserver!),
      CFRunLoopMode.defaultMode
    )
    notifNames.keys.forEach {
      do {
        try AXObserverRemoveNotification(rawObserver!, element, $0).unwrap()
      } catch {}
    }
  }
}
```

... where `.unwrap()` is just a convenience method to convert `AXError`s to exceptions
and throw them.

```swift
extension AXError {
  /// Throws a conventional runtime error if this `AXError` is not `.success`.
  func unwrap() throws {
    guard case .success = self else {
      throw AXUIError.axError("AXUI function failed with `\(self)`")
    }
  }
}
```

#### Tracking the Interesting PIDs

This time, let's maintain a collection of `WindowChangeObserver`s for each useful PID
in the `RunningAppsObserver` class.

As usual, `RunningAppsObserver` should be declared as a subclass of `NSObject`:

```swift
class RunningAppsObserver: NSObject {
  @objc var currentWorkSpace: NSWorkspace
  var rawObserver: NSKeyValueObservation?

  var windowChangeObservers = [pid_t: WindowChangeObserver?]()

  convenience override init() {
    self.init(workspace: NSWorkspace.shared)
  }

  ...
}
```

Here, `rawObserver` will be initialized to an Objective-C key-value observation
of `currentWorkSpace.runningApplications`,
which is responsible for maintaining the `windowChangeObservers` collection
by repeatedly calculating the latest changes in the observed collection of running apps:

```swift
class RunningAppsObserver: NSObject {
  ...

  init(workspace: NSWorkspace) {
    currentWorkSpace = workspace
    windowChangeObservers =
      Dictionary(
        uniqueKeysWithValues:
          Self.getWindowChangePIDs(for: currentWorkSpace)
          .map { ($0, try? WindowChangeObserver(pid: $0)) }
      )
    super.init()

    rawObserver = currentWorkSpace.observe(\.runningApplications) {
      workspace,
      _ in
      let oldKeys = Set(self.windowChangeObservers.keys)
      let newKeys = Self.getWindowChangePIDs(for: workspace)

      let toRemove = oldKeys.subtracting(newKeys)
      if !toRemove.isEmpty {
        log.debug("RunningAppsObserver: removing from windowChangeObservers: \(toRemove)")
      }
      toRemove.forEach {
        self.windowChangeObservers.removeValue(forKey: $0)
      }

      let toAdd = newKeys.subtracting(oldKeys)
      if !toAdd.isEmpty {
        log.debug("RunningAppsObserver: adding to windowChangeObservers: \(toAdd)")
      }
      toAdd.forEach {
        self.windowChangeObservers[$0] = try? WindowChangeObserver(pid: $0)
      }
    }
  }

  ...
}
```

Finally, thanks to the directions of [this Python snippet](https://gist.github.com/ljos/3040846),
we can use [Quartz Window Services](https://developer.apple.com/documentation/coregraphics/quartz_window_services) [^3]
to obtain the collection of "interesting" PIDs ("interesting" as in "having a GUI"):

```swift
class RunningAppsObserver: NSObject {
  ...

  static func getWindowChangePIDs(
    for workspace: NSWorkspace
  ) -> Set<pid_t> {
    let includingWindowAppPIDs =
      (CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID)!
      as Array)
      .compactMap { $0.object(forKey: kCGWindowOwnerPID) as? pid_t }

    return Set(
      workspace.runningApplications.lazy
        .map { $0.processIdentifier }
        .filter { includingWindowAppPIDs.contains($0) }
    )
  }
}
```

To this point, we have finally obtained an observer that can detect current window changes
from an automatically-adjusted range of PIDs and send
`Claveilleur.focusedWindowChangedNotification` or `Claveilleur.appHiddenNotification`
messages to `localNotificationCenter` accordingly:

```swift
let runningAppsObserver = RunningAppsObserver()
```

#### Consuming the Messages

After all the above efforts, we can finally return to the familiar FRP-style APIs.

First, we have a bunch of different bundle ID-generating publishers,
all likely to indicate a new current app:

```swift
let focusedWindowChangedPublisher =
  localNotificationCenter
  .publisher(for: Claveilleur.focusedWindowChangedNotification)
  .compactMap { getAppBundleID(forPID: $0.object as! pid_t) }

let didActivateAppPublisher = NSWorkspace
  .shared
  .notificationCenter
  .publisher(for: NSWorkspace.didActivateApplicationNotification)
  .compactMap(getAppBundleID(forNotification:))

let appHiddenPublisher =
  localNotificationCenter
  .publisher(for: Claveilleur.appHiddenNotification)
  .compactMap { _ in getCurrentAppBundleID() }
```

Then, all we need to do is to declare another observer that consumes all those publishers,
and saves or loads input sources according to the current app:

```swift
let appActivatedObserver =
  focusedWindowChangedPublisher
  .merge(with: didActivateAppPublisher, appHiddenPublisher)
  .removeDuplicates()
  .sink { currentApp in
    log.debug("appActivatedObserver: detected activation of app: \(currentApp)")

    guard
      let oldInputSource = loadInputSource(forApp: currentApp),
      setInputSource(to: oldInputSource)
    else {
      let newInputSource = getInputSource()
      log.info(
        "appActivatedObserver: registering input source for `\(currentApp)` as: \(newInputSource)"
      )
      saveInputSource(newInputSource, forApp: currentApp)
      return
    }
  }
```

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

```swift
/// Returns if the right privileges have been granted to use the Accessibility APIs.
func hasAXPrivilege() -> Bool {
  let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): kCFBooleanTrue] as CFDictionary
  return AXIsProcessTrustedWithOptions(options)
}
```

As it turns out, this has something to do with
the code signing rules that macOS is enforcing.
It just so happens that when the app is not a macOS bundle,
[it could be very hard get it signed correctly](https://www.smileykeith.com/2021/10/05/codesign-m1).

I solved this problem by first creating
a minimal bundle manifest under `Supporting/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>CFBundleIdentifier</key>
        <string>io.github.rami3l.Claveilleur</string>
        <key>CFBundleShortVersionString</key>
        <string>0.1.0</string>
        <key>CFBundlePackageType</key>
        <string>BNDL</string>
        <key>NSHumanReadableCopyright</key>
        <string>Copyright © 2023 rami3l. All rights reserved.</string>
    </dict>
</plist>
```

... then embedding the manifest into the executable [^5] like so:

```swift
// Package.swift
let package = Package(
  ...
  targets: [
    .executableTarget(
      name: "Claveilleur",
      ...
      // https://forums.swift.org/t/swift-package-manager-use-of-info-plist-use-for-apps/6532/13
      linkerSettings: [
        .unsafeFlags([
          "-Xlinker", "-sectcreate",
          "-Xlinker", "__TEXT",
          "-Xlinker", "__info_plist",
          "-Xlinker", "Supporting/Info.plist",
        ])
      ]
    )
  ]
)
```

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

[^1]: However, turning on this feature on Windows will lead to another issue
where the task bar is also considered as an app.
My friend [`Icecovery`](https://github.com/Icecovery)'s
[`IMEIndicator`](https://github.com/Icecovery/IMEIndicator)
provides more details on it and a (hacky) workaround.

[^2]: I still had to download Xcode from the Mac App Store to get the full macOS SDK :(

[^3]: Quartz is the name of the macOS window server.

[^4]: Apart from the part of getting and setting the current input source
(which fits nicely into [~30 lines of Objective-C](https://github.com/daipeihust/im-select/blob/9cd5278b185a9d6daa12ba35471ec2cc1a2e3012/macOS/im-select/im-select/main.m)),
that is.

[^5]: If you are using Rust for macOS desktop development,
the [`embed_plist`](https://crates.io/crates/embed_plist)
crate might do the work for you.
