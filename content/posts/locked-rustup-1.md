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

## Making It a Read-Write Lock?

It should be relatively easy to turn the mutex into a read-write lock to prevent
the aforementioned read-when-write scenario. For example, we could learn from
`cargo` and use a named file (the so-called "lock dummy") designated by rustup
to impose file-system locks and make use of the operating system's unlock
notification mechanisms. Let's say we impose a write lock on "modifying"
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
   exclusive, and thus two concurrent operations can effectively cancel each
   other out. Our downstream [elan#121] seems to have taken the simplest
   approach to this issue, abandoning all the "resuming from interruption" logic
   and just caring about the final state. This solution is pragmatic, but it is
   probably not the most appropriate one for rustup, as our Rust distributions
   are way more complex than their Lean 4 ones, with many more optional
   components to choose from as well.

2. Rustup calls can be arbitrarily nested, and the toolchain operations can
   happen in any layer. This prevents us from doing the classical "lock dummy"
   file trick that is used by many similar applications such as `cargo`.

In the past few months, I have experimented with various ideas trying to address
this infamous issue; I even have considered mechanisms to implement lock
inheritance of a `rustup` subprocess to overcome the issues related to recursive
invocations.

So far, however, every solution that I have come up with either fails with
certain (mostly recursive) `rustup` usage patterns or is making strange
assumptions about how one is using rustup. Notably, a `fcntl()`-based solution
implements lock inheritance by `execvp()`, which has no Windows equivalent; the
most promising solution so far that ensures platform compatibility seems to be a
"lock server daemon" which is a bit like the Gradle Daemon. However, it might
look overly complicated for a tool like `rustup` and is definitely hard to get
right.

I have come to realize recently that the right design decision here is all about
choosing a certain level of correctness to enforce. For example, my team leader
@rbtcollins "can see the argument for read locking" here, but added the comment
that "it's not essential" to this issue.

What aspects of correctness do you expect a "locked rustup" to ensure, my fellow
Rustaceans?

[rustup#988]: https://github.com/rust-lang/rustup/issues/988
[elan#121]: https://github.com/leanprover/elan/pull/121
[@matklad]: https://matklad.github.io
[`NamedLock`]: https://docs.rs/named-lock/0.4.1/named_lock/struct.NamedLock.html
