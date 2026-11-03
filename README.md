# Healix

**One sentence.** Hand it two tables of records and it says which rows are the same thing, shows what led to each answer, and says "can't tell" when it can't. The claim it is built to earn: zero false matches.

**Why it exists, in my words.** Healix is a tool I developed based on the clear gaps found in inefficiently attempting to vibe code large projects with LLMs. Then I was contracted to build the LeNoble Lumber learning platform, in which I tried to do with an LLM.. this turned out chaotic and inefficient.. which brought me back to completing Healix. Hallucinations are context failures, Healix makes context failures unconstructable. Healix is essentially a verification layer.. just as it verifies itself, as we work on Healix we learn and that internal machinery gets refined and is used to verify others as well. Healix6 shows it took 5 previous iterations to finally understand that we were building a house on gravel never really knowing what variables we were measuring. The previous versions of Healix ballooned to hundreds of files due to hardening lies that were allowed through side doors.. but now I realize focused restraint is better. I do not want strings, sentinels, as casts, guards, shorthand, aliases to exist in the project. The judge needs established from the start as a verification layer through Healix, used to dogfood itself to verify its own product through the iterative development.

## Where it stands (Oct 18, 2026, from .gate/locks.tsv and .gate/verdicts.tsv)

The matcher has two sides that never read each other's evidence: the **judge** (does this pair survive every test that could show it wrong?) and the **product** (which pairs does it claim?).

| | Result | Meaning |
|---|---|---|
| Judge, built known-wrong records | 0 called right, all three benchmarks | It adds no false matches. |
| Judge, order test | identical answers under reversed rows, 39 of 39 tables | Nothing depends on where a row sits. |
| Judge, held-out copies with one field cut | Fodors 267 of 267; beer 9 of 2,173; dirty 0 of 1,308 | Sound, but weak where tables hold near-duplicates. This is the open cause; nothing else moves until it is explained. |
| Product, built known-wrong records | claims 101 of 101, 1,028 of 1,028, 504 of 504 | It does not discriminate yet. Marked FAILED by the falsifier. |
| Product, real tables | Fodors 113 claims / 0 judged right / 113 unknown; dirty 1,866 / 43 / 1,823; beer 1,507 / 7 / 1,500 | "Unknown" is printed, never filled. |

Benchmarks: Fodors–Zagat, the "dirty" and "beer" tables, and a c2 set with copy / exact / same variants.

## How the work is done

Three roles. The **owner** (me) sets the laws and rules on what a read may decide. The **builder** is an AI agent that writes and runs code, one chain per session. The **falsifier** is a separate AI session that never sees the builder's reasoning and writes every verdict into `.gate/verdicts.tsv` with its reason. A change lands only when: its targets were written before its code and name the cell it moves; every check fails its planted fault before its pass counts; no ceiling in `.gate/laws.tsv` rises; and the gate (`scripts/gate.ts`) finds zero errors. Every landing's files are hashed into history so any state can be rebuilt. The gate also counts, in this tree's own code, the things it forbids: silent fills, `any` leaking through a typed name, guards, duplicate units, dead exports.

## Known defects, counted by the tree's own gate

- 24 exported names nothing imports.
- A record's body is defined twice (`src/construction.ts`, `scripts/run.ts`); on a table whose numbering column is not first, they disagree.
- Views align by column position, so a reordered column is silently unmeasured.
- The product claims nearly everything (above). Six candidate bars were read and closed; the next product read waits on the judge's open cause.

## What was thrown away

Seven trees since May 2025: 228, 187, 281, 167, 103, 90 and now 20 files. Each rebuild kept the same laws and dropped a variable: learning machinery (bandits, Markov, CEGIS), a dashboard, a parser, three metaphors, a buyer. The laws that survived all seven are the ones below.

## Where it is going

The laws it is held to, the moves it does not yet make, and the order of the next changes are in `ASPIRATIONS.md`.

## Reading this repo

- `.gate/` — laws (ceilings), reads (wall / if yes / if no), verdicts (check, verdict, supersedes, reason).
- `chains/` — the next chain's targets, the mechanisms carried from earlier rebuilds, and the invariants the repo is held to.
- `src/` — eight files, one law each, from the byte store up to claims. `scripts/` — the harness.
