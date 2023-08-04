+++
title = "The Making of Claveilleur"
date = "2023-08-03"
description = "The extremely simple macOS input source switching daemon behind the scenes."

[taxonomies]
tags = ["macOS", "Swift", "keyboard"]
+++

> Now playing: Bad Apple!!

## The Problem

Being a polyglot can be painful sometimes.

Particularly, it is extremely common for me to have multiple windows open at the same time, each using a different language:
at this very moment, I have my messenger on where I participate conversations in Chinese,
and I am writing this post in English at the same time in my VSCode window.

As a result, with OS defaults, I have to switch between input sources (a.k.a. input methods) so often that I have even grown the bad habit of continuously pressing the `fn` key for... nothing at all.
Assuredly, `fn` is more convenient than Windows PCs' `win + space`, but wouldn't it be much better if I don't have to press any key?

You might ask: doesn't `System Settings` have that feature built right in?
Well, kind of.
The problem here is that this feature of automatically switching input source is based on the current **document**, and thus macOS can get it wrong quite frequently.

Wouldn't it be much better if macOS could switch input sources on a **per-app** basis, just like Windows does [^1] ?

In fact, there are already many non-free solutions out there that prove this point, like [`Input Source Pro`](https://inputsource.pro) and [`KeyboardHolder`](https://keyboardholder.leavesc.com/zh-cn), and since it is theoretically possible, it looks like I can make my own "lite version" just for fun!

## The Workflow

TODO...

## The Solution

TODO...

[^1]: However, turning on this feature on Windows will lead to another issue where the task bar is also considered as an app. My friend [`Icecovery`](https://github.com/Icecovery)'s [`IMEIndicator`](https://github.com/Icecovery/IMEIndicator) provides more details on it and a (hacky) workaround.
