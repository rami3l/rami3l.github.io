+++
title = "Proving Termination in Lean 4"
date = "2023-09-30"
description = "Convince the prover that your function will terminate."
draft = true

tags = ["Lean", "prover"]
+++

<!-- markdownlint-configure-file { "MD046": { "style": "fenced" } } -->
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

## Example: The Factorial

Let's start with your old friend, the factorial function:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=1 to=1 >}}
{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=5 to=7 >}}

This definition should be quite self-explanatory even for those who are not so familiar with Lean.

We can add some "unit tests" to ensure that this is indeed the `fact` that we all know and love:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=9 to=9 >}}

If the `<$>` infix operator here looks strange to you, don't worry!
It is just another fancy way of writing your familiar
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
function.

## Proof by Structural Recursion

In trivial cases (like this one),
it's quite possible that the termination proof is already done for you.

An intuitive way of seeing how this proof is possible might be the following:

1. `fact` has only one argument (let's call it `n : ℕ`),
   so in order to prove that `fact` terminates,
   we need to prove that `n` decreases.

2. We search the function body for all call sites of `fact`,
   and it turns out there's only one `fact n` which is required by `fact (n + 1)`.

3. `∀ n : ℕ`, `n` is smaller than `n + 1`, so `n` is indeed decreasing.

... wait a minute.
Did I say _decreasing_?
What is actually decreasing here?

According to the [docs](https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#structural-recursion-and-induction),
we are using a _structural recursion_ here,
and thus it's `n`'s _structure_ that is decreasing.
After all, `ℕ` is inductively defined:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/Prelude.lean#L1038-L1044" >}}

So you can see the decrease in `n`'s structure as a decrease in
the number of constructors (`.zero`/`.succ`) required to construct `n`.

## Proof by WF Recursion and `termination_by`

What if the structural recursion doesn't work,
and we have to use a [well-founded (WF) recursion] [^wf-rec] instead?

[well-founded (WF) recursion]: https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#well-founded-recursion-and-induction

[^wf-rec]:
    The notion of WF recursion won't be explained in detail here.
    The key intuition in this notion, however,
    is that for a function `f (v : α) : β` to be total, it suffices that
    every `v` should be mapped to a body in `β` that...

    <!-- markdownlint-disable-line -->

    - Either has nothing to do with `f` (the base case);
    - Or depends on some `f w` where `w : α`,
      and there exists a
      [WF relation](https://en.wikipedia.org/wiki/Well-founded_relation)
      `≺` ("smaller") that ensures `w ≺ v`,
      so that the body can be written in such a way that depends exclusively
      on some base cases.
      This prevents infinite recursions from ever happening.

Again, looking at the [docs](https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#well-founded-recursion-and-induction),
it seems that this is as easy as adding a `termination_by` clause:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=11 to=14 >}}

By explicitly pointing out the parameter `n`,
we are actually doing the step `2.` above manually:
you can see this as a way of informing the compiler that
we need to prove that `n` decreases in some sense later on.

The compiler will then try to perform step `3.` automatically,
by searching for an implicit instance `wf : WellFounded ℕ`,
and trying to conclude that `n` is decreasing in terms of `wf.rel`.

Let's say it has found `Nat.lt_wfRel : WellFounded ℕ`,
which stands for the well-foundedness of `Nat.lt` (i.e. the `<` operator on `ℕ`):

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WF.lean#L151-L153" >}}

Since `n < n + 1` trivially holds, the termination proof is again completed.

In fact, it is according not to us, but to the compiler that `n < n + 1` "trivially holds".
When a `termination_by` clause is not followed by a `decreasing_by` clause,
a default one will be generated right beside it:

```lean
decreasing_by decreasing_tactic
```

`decreasing_tactic`, as the name suggests, is a _tactic_.
This means that `decreasing_by` activates the [_tactic mode_](https://lean-lang.org/theorem_proving_in_lean4/tactics.html#entering-tactic-mode),
just like the usual `by` keyword does.

This tactic is defined as follows:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WFTactics.lean#L52-L53" >}}

... and the triviality of `n < n + 1` (and many other similar arithmetic statements)
is already included in `decreasing_trivial`:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WFTactics.lean#L22-L28" >}}

## Proof by WF Recursion and `decreasing_by`

What if we want to write a `decreasing_by` clause by ourselves?

In practice, you should try to benefit from the existing infrastructure by _extending_
the `decreasing_trivial` macro with an extra `macro_rules` declaration,
as stated in the comments below:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WFTactics.lean#L17-L20" >}}

For the sake of the demo, let's write a similar proof by hand,
but this time with another instance, `instWellFoundedRelation : WellFounded ℕ`:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WF.lean#L193-L194" >}}

> {{< details "More details on this definition" >}}

... where `sizeOfWFRel` is defined as follows:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WF.lean#L190-L191" >}}
{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WF.lean#L187-L188" >}}

... and `invImage` as follows:

{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WF.lean#L127-L129" >}}
{{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/Core.lean#L938-L939" >}}

All those definitions above give:

```lean
  instWellFoundedRelation
= sizeOfWFRel
= measure sizeOf
= invImage sizeOf Nat.lt_wfRel
= let f := InvImage WellFoundedRelation.rel sizeOf;
  { rel := f, wf := (_ : WellFounded f) }
= let f a b := sizeOf a < sizeOf b;
  { rel := f, wf := (_ : WellFounded f) }
```

{{< /details >}}

TODO introduce `sizeOf`, sized types, `SizeOf`

In short, `instWellFoundedRelation` ensures that every sized type `α`
(hence the implicit instance parameter `[SizeOf α]`)
satisfies `WellFoundedRelation α`,
in the sense that `Nat.lt` _over its size_ is well-founded:

```lean
  instWellFoundedRelation.rel
= (let f a b := sizeOf a < sizeOf b; { rel := f, wf := (_ : WellFounded f) }).rel
= let f a b := sizeOf a < sizeOf b; f
= (sizeOf · < sizeOf ·)
```

Now we are ready to write our `decreasing_by` clause by hand
(just to prove it is possible, please don't try this at home).

As usual, let's first copy the function declaration and the `termination_by` clause over:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=18 to=22 >}}

A tiny syntax sugar here: in the `termination_by` clause,
you can write `_` instead of the name of the function `factₛ`.

... and here it is, the `decreasing_by` clause:

{{< include file="code/posts/lean-termination/LeanTermination/Basic.lean" language="lean" from=23 to=29 >}}

TODO show tactic

<!-- {{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WFTactics.lean#L33-L44" >}} -->
<!-- {{< emgithub owner=leanprover repo=lean4 branch="a62d2fd" file="src/Init/WFTactics.lean#L12-L13" >}} -->
