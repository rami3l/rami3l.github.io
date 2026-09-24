+++
title = "Rust Maintainer Monthly Report: September 2026"
pubDate = "2026-09-24"
description = "My experience working on rustup full-time for the 2nd month."

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

For a quick glance at this month in particular, I would like to point out that:

The general health of the project continues to see tremendous improvements, with
my GitHub contributions to rustup again reaching twice the 26H1 average.

The main focus of my time has been shifted from the paperwork and regular
maintenance to my project goal [_Process-Safe Rustup_], on which I have been
able to make quite some progress thanks to the fact that the backlog rustup had
accumulated over the past few months has been mostly cleaned up by now.

[_Process-Safe Rustup_]: #process-safe-rustup

## Maintenance

The headline of this month is of course that the rustup v1.29.1
[stable release](https://blog.rust-lang.org/2026/09/01/Rustup-1.29.1) happened
earlier this month, marking in a sense the maturation of our
[new release process](https://github.com/rust-lang/rustup/issues/4738). The user
complaints regarding this new release seem to be quite limited, and I have
personally been super happy about both the process and the resulting
artifact[^ack] :)

[^ack]:
    Many thanks to [@Mark-Simulacrum](https://github.com/Mark-Simulacrum) for
    his help in debugging the release pipeline and making sure that the release
    went smoothly!

On the issues' side, I would like to point out one very representative example:
[rustup#5085](https://github.com/rust-lang/rustup/issues/5085). The problem
reported there was pretty straightforward: the user was not getting enough
guidance when a host tuple has been demoted. Judging from the first few rounds
of the discussion, it seemed that as with many other issues before this, we
would only need to slightly improve the error message to make it more clear and
helpful. However, after some more digging, we have realized that the issue is
actually much more valuable than it first seemed:

- On the one hand, the newly introduced notion of "tier 1 targets without host
  tools" has broken the display logic of `rustup-components-history`.

- On the other hand, this has also exposed a bug in rustup itself where demoted
  host tuples were unexpectedly not covered by the nightly backtracking logic,
  whereas rustup should normally be able to backtrack to a previous nightly
  version that still meets all component requirements as specified by the user.

[`@Kobzol`] and I provided fixes for the two problems above respectively, and
both of them have been relatively simple and quick to implement.

In my opinion, this valuable experience has demonstrated that:

- Firstly, in this case, the host tuple demotion came from the main Rust repo,
  the display and nightly backtracking logic in rustup, and the component
  history deployed from a separate `rustup-components-history` repo. A perfect
  Rust user experience thus requires close collaboration among multiple repos
  and teams, and we should definitely be paying more attention to such
  interactions in the future. In fact, as an outcome of this issue, `t-rustup`
  has been granted the permission to edit the `rustup-components-history` repo,
  which will allow us to correct or update the relevant information in a more
  timely manner if needed.

- Secondly, none of the above analyses and fixes would have been possible
  without the resources to go further and investigate the issue in depth. I
  think this level of insight is exactly what the project would greatly benefit
  from in the long run, and I can imagine that even more issues could be
  prevented from happening with thorough inspection efforts like this.

[`@Kobzol`]: https://github.com/Kobzol

Regarding the triaging and resolution of issues in general, I have been able to
keep up with the pace of incoming issues while closing the previous ones,
leading to about 25 issues being closed. Tiny improvements, refactoring, and
bugfixes are being made in short cycles, giving a total of about 40 PRs merged.

## Project Goals

### [Process-Safe Rustup](https://rust-lang.github.io/goals/2026/process-safe-rustup.html)

With the dedicated hours I have been able to spend on this project goal, I have
been moving pretty quickly on the design and implementation of the new
transaction semantics. In particular:

- The gradual rollout plan using [A/B partitioning scheme] for the transitional
  period has been modeled with TLA+ and no counterexamples have been found so
  far.

- The [v2] of my proposal has been released and has received some important
  constructive feedback from [`@cachebag`]. The wording inconsistencies have
  been fixed and the missing details clarified.

- Based on my previous [PoC], I have started implementing the new transaction
  semantics in my own rustup fork using the [A/B
  partitioning][A/B partitioning scheme] design. It began with an ugly
  `447 passed; 72 failed` earlier this month, but after several weeks of
  continuous iteration, my fork has been passing the full rustup test suite on
  Linux and macOS modulo some deliberate snapshot mismatches since a few days
  ago 🎉

I have to be clear here that there is still a lot of work to be done before I
can even start upstreaming my changes. The remaining work includes but is not
limited to:

- GC of in-flight objects and references
- Windows support
- Optimization of full-toolchain upgrades: so far all components are removed and
  reinstalled, which is a clear waste under the new scheme
- Proper regression tests, with a focus on concurrent execution and crash
  recovery
- Migration plan between different toolchain layouts

However, I have already have noticed some clear improvements to be made to the
existing codebase during this process, so I have also worked on a few
refactoring PRs to make the fork easier to maintain and to make the eventual
upstreaming process smoother.

With everything looking promising so far, I am looking forward to be able to
address these items one by one in the next few months and eventually polish and
upstream my work :)

[PoC]: https://github.com/rami3l/rynzland
[v2]: https://github.com/rami3l/rynzland/blob/main/DESIGN.md
[A/B partitioning scheme]: https://source.android.com/docs/core/ota/ab
[`@cachebag`]: https://github.com/cachebag

## Community Building

Similarly to what I had done the previous month, I have also been reviewing PRs
from different external contributors during the month of September. [`@djc`] has
been kindly providing feedback on my reviews and sharing his experience
regarding general interaction with the community with the hope that the external
contributions we receive can better meet rustup's high standards, and I have
learnt quite a lot from this especially regarding improving the wording of
review comments.

Notably, with [`@Cloud0310`]'s [platform directories support] GSoC project
getting even closer to the finish line, I am glad to see that the final PR is
slowly taking shape. Looking back, I feel really happy that I was able to guide
him to a better grasp of our codebase and that his contributions have been much
more organized than when he first started, which is a clear sign of his growth
as a contributor and a developer in general.

Moreover, through our collaboration in the past few months, we have both
rediscovered the importance of valuing the progress over the outcome in software
maintenance. As a result, for both his GSoC project and my project goal, we have
been noticing clear problems in many legacy parts of the existing codebase, and
we have been working on addressing them in a more systematic way on our
respective fronts. As I see it, this understanding is becoming increasingly
important in the age of LLMs and agents, where seemingly only the final result
matters, and the agent can stand just patching the surface without ever cleaning
up the underlying technical debt.

I think the valuable experience I have gained will be a very interesting
reference in the continuous improvement of my mentoring and community building
approach.

Finally, I would like to announce that I have been granted a session during
RustChinaConf 2026 to talk specifically about rustup! Looking forward to meeting
some of you offline in Shenzhen next month :)

[platform directories support]: https://github.com/rust-lang/rustup/issues/247
[`@djc`]: https://github.com/djc
[`@Cloud0310`]: https://github.com/Cloud0310

## Conclusion

I would like to express my gratitude to the Rust Foundation, [`t-funding`], and
[`t-rustup`] for their continued support and trust, as well as everyone else
contributing their verse to rustup and Rust in general, without your efforts
this wouldn't have been possible!

Many thanks for reading this post, and I'll see you in the next one!

[`t-funding`]: https://rust-lang.org/governance/teams/#team-funding
[`t-rustup`]: https://rust-lang.org/governance/teams/#team-rustup
