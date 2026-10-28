+++
title = "Rust Maintainer Monthly Report: October 2026"
pubDate = "2026-10-29"
description = "Another month as a MiR: eMudhra, RustChinaConf, and more."

tags = ["Rust", "rustup"]
+++

> This post belongs to a series of monthly reports about my daily work on Rust
> as a full-time [MiR][Maintainer in Residence] with a focus on [rustup]. Please
> feel free to check out my previous posts on [`#rustup`] as well if you are
> curious about the background :)

[rustup]: https://github.com/rust-lang/rustup
[`#rustup`]: /tags/rustup
[Maintainer in Residence]:
  https://rust-lang.github.io/rfcs/3931-rfmf-rust-foundation-maintainer-fund.html#expectations-placed-on-maintainers-in-residence

## Overview

In my 3rd month as a MiR, I continued with my goals of improving the health of
the rustup codebase and trying to build a long-lasting community around it.

Firstly, I am glad to report that rustup continues to see quite a few quality
improvements during this month. I have been working not only on my long-term
goal, but also many small but important patches that improves rustup (and
bootstrap/rustfmt in addition) and the user experience of our users.

Secondly, a bit differently from the previous months, I have also spent quite
some time this month on something that I think I didn't do enough before:
advertisement. I have participated in RustChinaConf 2026 where I talked to
community members and highlighted the ongoing work on rustup.

## Maintenance

The headline of this month is that the rustup v1.29.2
[stable release](https://blog.rust-lang.org/2026/10/20/Rustup-1.29.2) happened a
few days ago[^ack] in response to the infamous
[eMudhra intermediate certs issue](https://emudhra.we-have-a-problem.com).

Rustup was actually not heavily influenced by the issue since it only uses a few
hardcoded anchors (that we believe weren't affected) in addition to the
[platform's verifier](https://github.com/rustls/rustls-platform-verifier), so as
long as the user's OS is aware, rustup should be fine. However, we still wanted
to be extra careful and explicitly ban the problematic certs, so when the issue
was first reported, [`@djc`] and I immediately started working on an emergency
dot release, which eventually came out in less than 48 hours.

[^ack]:
    Many thanks to [@Mark-Simulacrum](https://github.com/Mark-Simulacrum) for
    his help in making the emergency release possible!

[`@djc`]: https://github.com/djc

The fact that all that went smoothly even when both of us had limited
availability is a testament to the maturity of our team and the release process.

> Aside: Given that this October is said by many to be one of the worst months
> in cybersecurity in the past few years, I do have the feeling that `t-release`
> would need more material support to face more challenging situations in the
> future, and that the manual release process has become such a bottleneck in
> the case of emergencies like this that maybe a more fundamental change is
> required, although I am not entirely sure what that would look like yet.

On the issues' side, I started working on the preexisting confusions around
rustup's
[toolchain type hierarchy](https://github.com/rust-lang/rustup/issues/5092), and
my first patch regarding nomenclature improvements have been merged. Next up, I
wish to be able to further clean up the types (maybe by inlining or abstracting
away a few of them) and make it more intuitive for future maintainers.

It should also be mentioned that my contributions have also diversified a bit
more this month, reaching beyond rustup itself to include some work on bootstrap
and rustfmt:

- For bootstrap, I have [fixed](https://github.com/rust-lang/rust/pull/163954)
  the issue regarding the rpath for distributed LLD on macOS. It started as a
  simple [regression report](https://github.com/rust-lang/rust/issues/163947)
  that happened to hit rustup's issue tracker due to a mistake in triaging, but
  since it's release-related, I decided to take a look anyway and eventually
  found the root cause and got my patch in
  [v1.99.1](https://blog.rust-lang.org/2026/10/15/Rust-1.99.1). It happened to
  be my first `P-critical` in `rust-lang/rust` and no easy regression testing
  facilities were available so it did get me a bit worried, but fortunately the
  fix was straightforward. I'm quite happy that I could help here :)

- For rustfmt, I have addressed a long-standing
  [feature request](https://github.com/rust-lang/rustfmt/issues/4660) regarding
  the proper interaction between the `--config-path` argument and the recursive
  directory search for rustfmt config files. This need naturally arose from my
  work on rustup after we decided on a custom rustfmt style, so I figured it
  would be nice to help everyone in the community by implementing this feature.
  The patch has been merged and should be a part of the v1.101.0 release. Next
  up, I'll add the relevant integration logic in rust-analyzer to make the user
  story complete.

The above contributions are truly precious experiences to me, and are among my
first steps of actively building connections outside of rustup within the Rust
project. I have learnt a lot from the discussions and reviews, and I hope to be
able to continue that trend further down the road.

## Project Goals

### [Process-Safe Rustup](https://rust-lang.github.io/goals/2026/process-safe-rustup.html)

The project goal is still being pushed forward in a rather steady pace this
month.

On the one hand, getting all the Windows CI tests to pass was quite an effort,
because I had to make sure that the same business logic around the toolchain
references worked both in symlink mode (which was already implemented along with
Unix support) and, most importantly, in the fallback mode backed by NTFS
junctions, and there are many subtle places that require special care. I am glad
to report that the full test suite is now passing in both modes locally and on
CI[^win-caveat]!

[^win-caveat]:
    The symlink mode was supported given the existing Windows CI setup for
    rustup. It doesn't seem to be practical to run the full test suite for both
    modes all the time due to the resource consumption that will cause, so the
    fallback mode was only tested with a manual hack so far unless we can find a
    smarter way to do it.

On the other hand, I happen to have addressed a deficiency in the current
transactional semantics when working on this new design: currently, you may
quite frequently see log lines saying `removing previous version` when running
`rustup update`:

```console
> rustup update nightly
info: syncing channel updates for nightly-aarch64-apple-darwin
info: latest update on 2026-10-02 for version 1.101.0-nightly (c36f14571 2026-10-01)
info: removing previous version of component miri
info: removing previous version of component rust-src
[..]
info: removing previous version of component rustc
info: removing previous version of component rustfmt
info: downloading 10 components
[..]
```

When [`@djc`] filed
[rustup#5122](https://github.com/rust-lang/rustup/issues/5122) claiming that
this might be an opportunity for UX improvement, I realized that there really is
something deeper this time.

For this particular case, desipte the fact that rustup has always been trying to
make its logs as human-friendly as possible, sometimes a dumber design can
prevent covering up the underlying complexity:

The root cause here is actually that in today's rustup, even a full upgrade of
an existing toolchain will need to uninstall all its components first, and thus
these verbose log lines helped reveal exactly where the deficiency may be.

As it turned out, the original idea of the design is that with this seemingly
extra step, if something bad happens during the upgrade and the transaction
failed for any reason, rustup will at least have something to recover from.

Fortunately, with the new design, all this ceremony is simply unnecessary. As I
implemented the corresponding optimization, all the noisy log lines disappeared
and the upgrade process is now much more streamlined.

## Community Building

Of course, my big event for this month is RustChinaConf 2026, which was held in
Shenzhen, China.

After leaving my previous job in this very city, I never thought about the
possibility of visiting it again one day. However, RustChinaConf 2026 was a
delightful surprise to me, and it was a great pleasure for me to be there as a
MiR and to meet some friends from the Rust community there, including notably
Rebecca Rumbul and Jack Huey from the Foundation, as well as some of my old
acquaintances from both China and France.

I was fortunate to be given a presentation session–the first ever in my
professional career during a big tech conference–dedicated to rustup and my work
on it. I am super glad that it was well received and I had some interesting
discussions with the audience afterwards, which I wish can lead to more
attention to the maintenance of rustup and the Rust tool suite in general.

Hopefully I will have more opportunities like this in the future, and I am
looking forward to meeting more of you offline!

## Conclusion

I would like to express my gratitude to the Rust Foundation, [`t-funding`], and
[`t-rustup`] for their continued support and trust, as well as everyone else
contributing their verse to rustup and Rust in general, without your efforts
this wouldn't have been possible!

Many thanks for reading this post, and I'll see you in the next one!

[`t-funding`]: https://rust-lang.org/governance/teams/#team-funding
[`t-rustup`]: https://rust-lang.org/governance/teams/#team-rustup
