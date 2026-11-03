# Healix — where it is going

The current state is in README.md. This page is the target, and beside each target, how much of it exists today.

## The seven laws, as targets

| Law | Target | Built today |
|---|---|---|
| 1 | Measure the pile against itself. No outside truth, no golden record. | Yes. The judge ranks every cross-table pair against every pair inside the tables. |
| 2 | Find the same things every time: conflated, fragmented, redundant, missing, dormant, dead. | One of six: "same" (the merge move). |
| 3 | Unmeasured means "can't tell". Never a guess, a default or a guard. | Yes. Every verdict is yes, no or unknown with a stored reason; the gate forbids fills and guards in the code itself. |
| 4 | Healix on Healix is the same as Healix on anyone's. | True of the harness (the gate holds this tree to its laws). The matcher does not yet read its own source. |
| 5 | Every finding carries its evidence; every fix is a move with a receipt and a way back. | Evidence: yes (every cell holds its read keys; history holds hashed bodies). Moves: merge only; split, bridge and drain are named, not built. |
| 6 | The reader is not an engineer: one plain sentence per finding. | From outside, on three tables (`npm run demo`). Not inside the product. |
| 7 | It sits between the person and the AI: the check the agent cannot do on itself. | Yes, for code: the gate, the edit instrument and the commit judge constrain the builder agent. Not yet for language. |

## The four moves

| Move | Meaning | Today |
|---|---|---|
| merge | two records proven one | built: the product claims, the judge confirms or abstains |
| split | one record proven two | not built |
| bridge | a record with no match where one should exist | counted (unshared records per side), not stated |
| drain | a record that matches nothing it should | not built |

## Next, in order

1. **The gate aimed at language.** An AI-written paragraph (the README, a verdict's reason) is refused if it states a number or a check the ledger does not hold. Law 7 for prose.
2. **`npm test`.** Every plant run, pass/fail per check; every refusal prints the command that reproduces it.
3. **One definition of a record's body.** Today two (`src/construction.ts`, `scripts/run.ts`); landed as the worked example of a change: targets, plant, receipt, ledger line.
4. **Sentences inside the product.** Law 6 moved from the demo into `scripts/run.ts`.
5. **The judge's open cause.** Held-out copies with one field cut: dirty 0 of 1,308, beer 9 of 2,173. Near-duplicates inside the tables are the presumed wall (`.gate/verdicts.tsv`, insideWall). Nothing on the product side moves before this is explained.
6. **Product soundness.** The product claims 99–100% of known-right and known-wrong alike. Six candidate bars were read and closed (`.gate/verdicts.tsv`); the next read waits on item 5.

## What will not be built

Learning machinery (bandits, Markov chains, CEGIS), a dashboard, a parser, metaphors: each was built in an earlier rebuild and removed. Their absence is a decision, recorded in the ledger, not a gap.

## How a target becomes code

Targets written before any code, naming the cell they move; a planted fault each check must fail before its pass counts; one file per landing; no ceiling in `.gate/laws.tsv` may rise; a falsifier who never sees the builder's reasoning writes the verdict. The evidence: `.gate/locks.tsv` and `.gate/verdicts.tsv`.
