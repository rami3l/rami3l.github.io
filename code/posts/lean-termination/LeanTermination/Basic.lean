import Mathlib.Tactic

-- * The Factorial

def fact : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * fact n

example : fact <$> [1, 2, 3, 4, 5, 6] = [1, 2, 6, 24, 120, 720] := rfl

def factₜ : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * factₜ n
termination_by factₜ n => n

example : sizeOf 42 = 42 := rfl

def factₛ : ℕ → ℕ
| 0 => 1
| n + 1 => (n + 1) * factₛ n
termination_by
  _ n => n
decreasing_by
  -- `instWellFoundedRelation` basically converts the "decrease" of any sized argument
  -- to the "decrease" of its size.
  show instWellFoundedRelation.rel n n.succ;                  unfold instWellFoundedRelation
  show @WellFoundedRelation.rel ℕ sizeOfWFRel n n.succ;       unfold sizeOfWFRel
  show @WellFoundedRelation.rel ℕ (measure sizeOf) n n.succ;  unfold measure
  show invImage sizeOf Nat.lt_wfRel |>.rel n n.succ;          unfold Nat.lt_wfRel
  show sizeOf n < sizeOf n.succ;                              simp only [sizeOf_nat]
  show n < n.succ;                                            apply Nat.lt_succ_self

-- * `Nat.toBin` from TPL4
-- https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html#well-founded-recursion-and-induction

def Nat.toBin : ℕ → List ℕ
| 0 => [0]
| 1 => [1]
| n + 2 =>
  (n / 2 + 1).toBin ++ [n % 2]
termination_by _ n => n
decreasing_by
  /-
  macro "simp_wf" : tactic =>
  `(tactic| try simp [invImage, InvImage, Prod.lex, sizeOfWFRel, measure, Nat.lt_wfRel, WellFoundedRelation.rel])
  -/
  show invImage id instWellFoundedRelation |>.rel (n / 2 + 1) n.succ.succ; simp_wf
  show n / 2 + 1 < n + 2; simp_arith; apply div_le_self

def Nat.toBin' : ℕ → List ℕ
| 0 => [0]
| 1 => [1]
| n + 2 =>
  have : n / 2 + 1 < n + 2 := by simp_arith; apply div_le_self
  (n / 2 + 1).toBin' ++ [n % 2]
termination_by _ n => n

example : Nat.toBin 42 = [1, 0, 1, 0, 1, 0] := rfl

mutual
  def isOdd : ℕ → Bool
  | 0 => False
  | n => !(isEven n)

  def isEven : ℕ → Bool
  | 0 => True
  | n + 1 => isOdd n
end
-- termination_by _ n => n
-- ^ This won't work!
termination_by
  isOdd n => (n, 1)
  isEven n => (n, 0)

example : isEven 42 = true := rfl
example : isOdd 42 = false := rfl
example : isEven 99 = false := rfl

-- TODO: decreasing_tactic, decreasing_with, decrasing_trivial
-- TODO the `induction` tactic
