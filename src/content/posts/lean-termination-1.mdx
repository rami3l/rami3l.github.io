+++
title = "Proving Termination in Lean 4, pt. 1"
pubDate = "2023-09-30"
description = "Convince the prover that your function will terminate."

tags = ["Lean", "prover"]
+++

> You are filled with de*termination*...

[Doing proofs](https://github.com/rami3l/plfl) from the book
[_Programming Language Foundations in Agda_](https://plfa.github.io) in the Lean
4 prover has really been a refreshing experience for me. However, things did get
annoying sometimes for me, especially when I just couldn't get pass the
termination check.

Although I haven't seen every piece of the puzzle yet, I do hope that by sharing
what I have seen so far, this blog post could save you some time from bashing
"lean termination" into your search box ~~, which could potentially lead you to
some random web pages about [Lean Manufacturing]~~.

[Lean Manufacturing]: https://en.wikipedia.org/wiki/Lean_manufacturing

## Example: The Factorial

Let's start with our old friend, the factorial function:

```lean
import Mathlib.Tactic
```

```lean
def fact : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * fact n
```

This definition should be quite self-explanatory even for those who are not so
familiar with Lean.

We can add some "unit tests" to ensure that this is indeed the `fact` that we
all know and love:

```lean
example : fact <$> [1, 2, 3, 4, 5, 6] = [1, 2, 6, 24, 120, 720] := rfl
```

If the `<$>` infix operator here looks strange to you, don't worry! It is just
another fancy way of writing your familiar
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
function.

## Proof by Structural Recursion

In trivial cases (like this one), it's quite possible that the termination proof
is already done for you.

An intuitive way of seeing how this proof is possible might be the following:

1. `fact` has only one argument (let's call it `n : ℕ`), so in order to prove
   that `fact` terminates, we need to prove that `n` decreases.

2. We search the function body for all call sites of `fact`, and it turns out
   there's only one `fact n` which is required by `fact (n + 1)`.

3. `∀ n : ℕ`, `n` is smaller than `n + 1`, so `n` is indeed decreasing.

... wait a minute. Did I say _decreasing_? What is actually decreasing here?

According to the
[docs](https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#structural-recursion-and-induction),
we are using a _structural recursion_ here, and thus it's `n`'s _structure_ that
is decreasing. After all, `ℕ` is
[inductively defined](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/Prelude.lean#L1038-L1044):

```lean
inductive Nat where
  /-- `Nat.zero`, normally written `0 : Nat`, is the smallest natural number.
  This is one of the two constructors of `Nat`. -/
  | zero : Nat
  /-- The successor function on natural numbers, `succ n = n + 1`.
  This is one of the two constructors of `Nat`. -/
  | succ (n : Nat) : Nat
```

So you can see the decrease in `n`'s structure as a decrease in the number of
constructors (`.zero`/`.succ`) required to construct `n`.

## Proof by WF Recursion and `termination_by`

What if the structural recursion doesn't work, and we have to use a
[well-founded (WF) recursion] [^wf-rec] instead?

[well-founded (WF) recursion]:
  https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#well-founded-recursion-and-induction

[^wf-rec]:
    The notion of WF recursion won't be explained in detail here. The key
    intuition in this notion, however, is that for a function `f (v : α) : β` to
    be total, it suffices that every `v` should be mapped to a body in `β`
    that...

    - Either has nothing to do with `f` (the base case);
    - Or depends on some `f w` where `w : α`, and there exists a
      [WF relation](https://en.wikipedia.org/wiki/Well-founded_relation) `≺`
      ("smaller") that ensures `w ≺ v`, so that the body can be written in such
      a way that depends exclusively on some base cases. This prevents infinite
      recursions from ever happening.

Again, looking at the
[docs](https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#well-founded-recursion-and-induction),
it seems that this is as easy as adding a `termination_by` clause:

```lean
def factₜ : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * factₜ n
termination_by factₜ n => n
```

By explicitly pointing out the parameter `n`, we are actually doing the step
`2.` above manually: you can see this as a way of informing the compiler that we
need to prove that `n` decreases in some sense later on.

The compiler will then try to perform step `3.` automatically, by searching for
an implicit instance `wf : WellFounded ℕ`, and trying to conclude that `n` is
decreasing in terms of `wf.rel`.

Let's say it has found
[`Nat.lt_wfRel : WellFounded ℕ`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WF.lean#L151-L153),
which stands for the well-foundedness of `Nat.lt` (i.e. the `<` operator on
`ℕ`):

```lean
def lt_wfRel : WellFoundedRelation Nat where
  rel := Nat.lt
  wf  := by
```

Since `n < n + 1` trivially holds, the termination proof is again completed.

In fact, it is according not to us, but to the compiler that `n < n + 1`
"trivially holds". When a `termination_by` clause is not followed by a
`decreasing_by` clause, a default one will be generated right beside it:

```lean
decreasing_by decreasing_tactic
```

`decreasing_tactic`, as the name suggests, is a _tactic_. This means that
`decreasing_by` activates the
[_tactic mode_](https://lean-lang.org/theorem_proving_in_lean4/tactics.html#entering-tactic-mode),
just like the usual `by` keyword does.

This
[tactic](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WFTactics.lean#L52-L53)
is defined as follows:

```lean
macro "decreasing_tactic" : tactic =>
  `(tactic| decreasing_with first | decreasing_trivial | subst_vars; decreasing_trivial)
```

... and the triviality of `n < n + 1` (and many other similar arithmetic
statements) is already included in
[`decreasing_trivial`](https://github.com/leanprover/lean4/blob/a62d2fd4979671b76b8ab13ccbe4fdf410ec0d9d/src/Init/WFTactics.lean#L22-L28):

```lean
syntax "decreasing_trivial" : tactic

macro_rules | `(tactic| decreasing_trivial) => `(tactic| (simp (config := { arith := true, failIfUnchanged := false })); done)
macro_rules | `(tactic| decreasing_trivial) => `(tactic| assumption)
macro_rules | `(tactic| decreasing_trivial) => `(tactic| apply Nat.sub_succ_lt_self; assumption) -- a - (i+1) < a - i if i < a
macro_rules | `(tactic| decreasing_trivial) => `(tactic| apply Nat.pred_lt'; assumption) -- i-1 < i if j < i
macro_rules | `(tactic| decreasing_trivial) => `(tactic| apply Nat.pred_lt; assumption)  -- i-1 < i if i ≠ 0
```

## Proof by WF Recursion and `decreasing_by`

What if we want to write a `decreasing_by` clause by ourselves?

In practice, you should try to benefit from the existing infrastructure by
_extending_ the `decreasing_trivial` macro with an extra `macro_rules`
declaration, as stated in the
[doc comments](https://github.com/leanprover/lean4/blob/a62d2fd4979671b76b8ab13ccbe4fdf410ec0d9d/src/Init/WFTactics.lean#L17-L20)
below:

````markdown
It can be extended by adding more macro definitions, e.g.

```lean
macro_rules | `(tactic| decreasing_trivial) => `(tactic| linarith)

```
````

For the sake of the demo, let's write a similar proof by hand, but this time
with another instance,
[`instWellFoundedRelation : WellFounded ℕ`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WF.lean#L193-L194):

```lean
instance (priority := low) [SizeOf α] : WellFoundedRelation α :=
  sizeOfWFRel
```

<details>
<summary>More details on this definition</summary>

[`sizeOfWFRel`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WF.lean#L190-L191)
is defined as follows:

```lean
abbrev sizeOfWFRel {α : Sort u} [SizeOf α] : WellFoundedRelation α :=
  measure sizeOf
```

... with the relevant definitions of
[`measure`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WF.lean#L187-L188),
[`invImage`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WF.lean#L127-L129)
and
[`InvImage`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/Core.lean#L938-L939)
as follows:

```lean
abbrev measure {α : Sort u} (f : α → Nat) : WellFoundedRelation α :=
  invImage f Nat.lt_wfRel
```

```lean
@[reducible] def invImage (f : α → β) (h : WellFoundedRelation β) : WellFoundedRelation α where
  rel := InvImage h.rel f
  wf  := InvImage.wf f h.wf
```

```lean
def InvImage {α : Sort u} {β : Sort v} (r : β → β → Prop) (f : α → β) : α → α → Prop :=
  fun a₁ a₂ => r (f a₁) (f a₂)
```

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

</details>

We say a type `α` is _sized_ if there is an instance of type `SizeOf α`. Here's
how the `SizeOf` typeclass and its `sizeOf` function are introduced in the
[doc comments](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/SizeOf.lean#L12-L28):

```lean
/--
`SizeOf` is a typeclass automatically derived for every inductive type,
which equips the type with a "size" function to `Nat`.
The default instance defines each constructor to be `1` plus the sum of the
sizes of all the constructor fields.

This is used for proofs by well-founded induction, since every field of the
constructor has a smaller size than the constructor itself,
and in many cases this will suffice to do the proof that a recursive function
is only called on smaller values.
If the default proof strategy fails, it is recommended to supply a custom
size measure using the `termination_by` argument on the function definition.
-/
class SizeOf (α : Sort u) where
  /-- The "size" of an element, a natural number which decreases on fields of
  each inductive type. -/
  sizeOf : α → Nat
```

In short, `instWellFoundedRelation` ensures that every sized type `α` (hence the
implicit instance parameter `[SizeOf α]`) satisfies `WellFoundedRelation α`, in
the sense that `Nat.lt` _over its size_ is well-founded:

```lean
  instWellFoundedRelation.rel
= (let f a b := sizeOf a < sizeOf b; { rel := f, wf := (_ : WellFounded f) }).rel
= let f a b := sizeOf a < sizeOf b; f
= (sizeOf · < sizeOf ·)
```

Now we are ready to write our `decreasing_by` clause by hand (just to prove it
is possible, please don't try this at home).

As usual, let's first copy the function declaration and the `termination_by`
clause over:

```lean
def factₛ : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * factₛ n
termination_by
  _ n => n
```

A tiny syntax sugar here: in the `termination_by` clause, you can write `_`
instead of the name of the function `factₛ`.

... and here it is, the `decreasing_by` clause:

```lean
decreasing_by
  show instWellFoundedRelation.rel n n.succ;                  unfold instWellFoundedRelation
  show @WellFoundedRelation.rel ℕ sizeOfWFRel n n.succ;       unfold sizeOfWFRel
  show @WellFoundedRelation.rel ℕ (measure sizeOf) n n.succ;  unfold measure
  show invImage sizeOf Nat.lt_wfRel |>.rel n n.succ;          unfold Nat.lt_wfRel
  show sizeOf n < sizeOf n.succ;                              simp only [sizeOf_nat]
  show n < n.succ;                                            apply Nat.lt_succ_self
```

Don't be scared by the snippet above! I have carefully formatted the _tactics
block_ (i.e. the block that follows `decreasing_by`) into two columns:

- The left column is composed entirely of uses of the `show` tactic. `show` is
  usually used to replace a goal's target to its unified version, but here it's
  used carefully as a no-op simply to illustrate the current state of the target
  on that line.

- The right column contains all the actual tactics that we have used to complete
  the proof.

As you can see, what we are doing in that snippet is basically replaying the
equational reasoning above. The thing that the compiler really wants us to prove
is in fact `sizeOf n < sizeOf n.succ`, but the statement is given in such a
complicated way that a few times of definition `unfold`ing turned out to be
necessary for us to see it more clearly.

Also, this _is_ the same as `n < n + 1`, since `sizeOf n = n`. This is called
[`sizeOf_nat`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/SizeOf.lean#L52):

```lean
@[simp] theorem sizeOf_nat (n : Nat) : sizeOf n = n := rfl
```

After applying that `theorem` to our goal, the termination proof is completed
for the third time.

As a matter of fact,
[`decreasing_with`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WFTactics.lean#L33-L44)
is defined as follows:

```lean
macro "decreasing_with " ts:tacticSeq : tactic =>
 `(tactic|
   (simp_wf
    repeat (first | apply Prod.Lex.right | apply Prod.Lex.left)
    repeat (first | apply PSigma.Lex.right | apply PSigma.Lex.left)
    first
    | done
    | $ts
    | fail "failed to prove termination, possible solutions:
  - Use `have`-expressions to prove the remaining goals
  - Use `termination_by` to specify a different well-founded relation
  - Use `decreasing_by` to specify your own tactic for discharging this kind of goal"))
```

... and
[`simp_wf`](https://github.com/leanprover/lean4/blob/a62d2fd/src/Init/WFTactics.lean#L12-L13)
as follows:

```lean
macro "simp_wf" : tactic =>
  `(tactic| try simp [invImage, InvImage, Prod.lex, sizeOfWFRel, measure, Nat.lt_wfRel, WellFoundedRelation.rel])
```

Thanks to these carefully-written definitions, many recursions can be
automatically proven to be "decreasing" with just the default
`decreasing_tactic`. Kudos to the Lean compiler! 🙌
