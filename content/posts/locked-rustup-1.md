+++
title = "Locked Rustup: Issue Statement"
date = "2025-01-20"
description = "Trying to add a proper lock to your favorite toolchain manager."

tags = ["Rust", "Rustup", "Toolchain", "Concurrency", "Lock"]
+++

> [...] alas! either the locks were too large, or the key was too small, but at
> any rate it would not open any of them.
>
> -- Lewis Carroll, _Alice's Adventures in Wonderland_

## The Long-Standing Issue

[rustup#988] is probably one of the oldest open issues in the whole history of
the rustup project, filed by no other than [@matklad] when he was working on
Intellij Rust.

As it turned out, rustup the toolchain manager did not have a proper locking
mechanism to prevent concurrent invocation of its commands. The original issue
explicitly mentioned that two concurrent `rustup component add` invocations
(i.e. writing modifications) would cancel each other out with an error.

In fact, this issue is also why we have this tiny detail in rustup's release
notes when mentioning the update process:

> If you have a previous version of rustup installed, getting rustup 1.XX.Y is
> as easy as **stopping any programs which may be using rustup (e.g. closing
> your IDE)** and running:
>
> ```console
> $ rustup self update
> ```

... otherwise, if anything goes wrong, the only way out seems to be a complete
uninstallation and reinstallation of one or more toolchains.

Rustup's modifications to toolchains under its control are transactional. In
other words, it will try to remember the individual steps it does to a toolchain
and revert them in the case of transaction failures, such as errors when
creating an existing file. However, as of v1.27.1, this "transaction" only
happens on a per-instance level, which means that if you have two concurrent
`rustup` invocations going on, they can still interfere with each other.

## Adding a Mutex?

Given this issue, introducing a mutex might sound like the most straightforward
solution. It should be a global one (e.g. [`NamedLock`]), so that it will be
visible to all the `rustup` instances on this machine. Let's say we acquire the
mutex on `rustup` launch and release it on exit, and there should no longer be
any concurrent invocations. Sounds easy, right?

Not exactly. The problem is that `rustup` is not only a toolchain manager; it is
a multiplexer at the same time. It might be obvious that rustup is in charge
when you run `rustup`, but when you run `rustc` or `cargo`, it is there as well,
playing as a "proxy" or "shim" that forwards the call to the active toolchain.
This gives rise to another issue: what if a proxy (especially a long-running one
such as `rust-analyzer`) wants to read a toolchain's certain files while we are
making modifications to it? Wouldn't it cause incoherent reads?

## Making It a Reader-Writer Lock?

It should be relatively easy to turn the mutex into a reader-writer lock to
prevent the aforementioned read-during-write scenario. For example, we could
learn from `cargo` and use a named file (the so-called "lock dummy") designated
by rustup to impose file-system locks and make use of the operating system's
unlock notification mechanisms. Let's say we impose a write lock on "modifying"
commands such as `rustup component add`, and a read lock otherwise, and the
problem should be addressed?

However, `cargo` essentially gives us the possibility to run arbitrary commands
via `cargo run`, so a rustup-proxied `cargo run` can acquire a read lock and
then run `rustup component add` as a subprocess. If the latter attempts to
acquire the write lock, it will overlap with the read lock of the former --
deadlock!

## What is Happening?

I think there are several things happening at the same time with this issue that
are preventing us from implementing the most obvious solutions above:

1. Rustup's operations on its toolchains are transactional but not mutual
   exclusive, and thus two concurrent operations can cause all sorts of errors,
   and quite often inessential ones. Our downstream [elan#121] seems to have
   taken the simplest approach to this issue, abandoning all the "resuming from
   interruption" logic and just caring about the final state. This solution is
   pragmatic, but it is probably not the most appropriate one for rustup, as our
   Rust distributions are way more complex than their Lean 4 ones, with many
   more optional components to choose from as well.

2. Rustup calls can be arbitrarily nested, and the toolchain operations can
   happen in any layer. This prevents us from doing the classical "lock dummy"
   file trick that is used by many similar applications such as `cargo`.

In the past few months, I have experimented with various ideas trying to address
this infamous issue; I even have considered mechanisms to implement lock
inheritance of a `rustup` subprocess to overcome the issues related to recursive
invocations.

So far, however, every solution that I have come up with either fails with
certain (mostly recursive) usage patterns or is making strange assumptions about
how one is using rustup. Notably, a `fcntl()`-based solution implements lock
inheritance via `execvp()`, which unfortunately has no Windows equivalent. The
most promising solution so far that ensures platform compatibility seems to be a
"lock server daemon" which is a bit like the Gradle Daemon. However, it might
look overly complicated for a tool like rustup and is definitely hard to get
right.

I have come to realize recently that the right design decision here is all about
choosing a certain level of correctness to enforce. For example, my team leader
@rbtcollins "can see the argument for read locking" here, but added the comment
that "it's not essential" to addressing this issue.

What aspects of correctness do you expect a "locked rustup" to ensure, my fellow
Rustacean? Would you like an easy write-locking-only policy, or do you think we
should go further than that? Is a complicated solution such as a lock server
really worth it? Do you happen to have relevant experiences and/or suggestions
to share? I would love to hear your thoughts on this issue.

Please feel free to reach out to me via [Zulip], from the `wg-rustup` channel of
Rust's [Discord server], or via any of the social media links on my [GitHub
profile].

[rustup#988]: https://github.com/rust-lang/rustup/issues/988
[elan#121]: https://github.com/leanprover/elan/pull/121
[@matklad]: https://matklad.github.io
[`NamedLock`]: https://docs.rs/named-lock/0.4.1/named_lock/struct.NamedLock.html
[Zulip]: https://rust-lang.zulipchat.com/#user/616990
[Discord server]: https://discord.com/invite/rust-lang
[GitHub profile]: https://github.com/rami3l
