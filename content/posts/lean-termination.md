+++
title = "Proving Termination in Lean 4"
date = "2023-09-30"
description = "Convince the prover that your function will terminate."
draft = true

tags = ["Lean", "prover"]
+++

<!-- markdownlint-configure-file { "MD049": { "style": "underscore" } } -->

> You are filled with de*termination*...

[Doing proofs](https://github.com/rami3l/plfl) from
the book [_Programming Language Foundations in Agda_](https://plfa.github.io)
in the Lean 4 prover has really been a refreshing experience for me.
However, things did get annoying sometimes for me,
especially when I just couldn't get pass the termination check.

Although I haven't seen every piece of the puzzle yet,
I do hope that by sharing what I have seen so far,
this blog post could save you some time from bashing "lean termination" into your search box,
which could potentially lead you to some random web pages about
[Lean Manufacturing](https://en.wikipedia.org/wiki/Lean_manufacturing) 😅

## Full-Auto Proofs

Let's start with an old classic, the factorial function:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=1 to=1 >}}
{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=5 to=7 >}}

We can add some "unit tests" to ensure that this is indeed the `fact` that we all know and love:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=9 to=9 >}}

In trivial cases (like this one),
it's quite possible that the termination proof is already done for you.

The following might be an intuitive way of seeing how this proof is possible:

- `fact` has only one argument (let's call it `n : ℕ`),
  so in order to prove that `fact` terminates,
  we need to prove that `n` decreases.

- We then search the function body for all call sites of `fact`,
  and it turns out that the value of `fact (n + 1)` calls `fact n`.

- `n < n + 1`, so `n` is indeed decreasing.
