# Healix

[![demo](https://github.com/CCCatri/healix/actions/workflows/demo.yml/badge.svg)](https://github.com/CCCatri/healix/actions/workflows/demo.yml) — on every push, a clean Ubuntu checkout runs `npm ci`, `npm run demo -- tests`, `npm run check`: all 60 built copy pairs confirmed, all 12 stitched records left unknown, verified pair by pair.

**One sentence.** Healix reads two tables of records and, for each pair the matcher proposes, says whether the judge confirms them as one record ("right"), cannot tell ("unknown"), or refutes them, with the measured reason. The matcher and the judge are two stages with different jobs, reading the same extracted pieces. Internal consistency is not real-world correctness: a "right" means the records agree with each other under the checks run against the rest of the tables, not that they are the same entity in the world.

**Why it exists, in my words.** Healix is a tool I developed based on the clear gaps found in inefficiently attempting to vibe code large projects with LLMs. Then I was contracted to build the LeNoble Lumber learning platform, in which I tried to do with an LLM.. this turned out chaotic and inefficient.. which brought me back to completing Healix. Hallucinations are context failures, Healix makes context failures unconstructable. Healix6 shows it took 5 previous iterations to finally understand that we were building a house on gravel never really knowing what variables we were measuring. The previous versions of Healix ballooned to hundreds of files due to hardening lies that were allowed through side doors.. but now I realize focused restraint is better. I do not want strings, sentinels, as casts, guards, shorthand, aliases to exist in the project. The judge needs established from the start as a verification layer through Healix, used to dogfood itself to verify its own product through the iterative development.

## Run it

The case, with the measurements and the harness fix that made the demo runnable: [`cases/healix-demo.md`](cases/healix-demo.md).

```
npm ci
npm run demo -- tests
npm run check
```


`tests/positive/own_copy/` is a tracked fixture of invented customer records (seeded generator; no real data): table A holds 60, table B holds their 60 copies plus 60 different records. The demo also builds 12 stitched records from table A at run time (fields taken from different rows, wrong by construction). It prints the matcher's proposals and the judge's rulings separately, writes every proposed pair with its ruling to `out/demo_pairs.tsv`, and `check` verifies that file against `tests/positive/own_copy/expected.tsv`, which was written from the fixture's construction, never from a run. `check` fails on a wrong pair id even when the counts still match (tested 2026-11-07).

## What the demo shows (measured 2026-11-07, commit c3b14ac)

| Case | Matcher proposed | Judge ruled |
|---|---|---|
| 60 built copies (B holds 60 non-matching records too) | 60 | 60 right, 0 unknown |
| 12 stitched records from table A | 12 | 0 right, 12 unknown |
| Same 60 copies, B reduced to the copies alone | 60 | 0 right, 60 unknown |
| Fodors–Zagat (real tables, not in this repo) | 113 | 0 right, 113 unknown |

Two observations at fixture scope, not stated as rules of the method:

- **The judge's verdict depends on the comparison population.** Holding the 60 proposed copy pairs fixed and removing the 60 non-matching records from table B changed every ruling from right to unknown; the same held on the Fodors-derived c2 set (267 right with 266 non-matching rows present, 0 right without them). The judge measures a pair's chance of agreement against the pairs inside the tables, so a table of pure copies gives it no population of different records to measure against.
- **Agreement is by shared piece, and a changed field can drop a pair at the matcher.** Changing one copy's phone to a number sharing no piece removed `AddressTelephone1` from that pair's agreement list and the judge still confirmed it on the other seven fields (the practical case: two records that disagree on a field and are the same customer). Changing the same copy's phone, contact and email removed the pair from the matcher's proposals: 59 proposed, 59 right. A pair the matcher never proposes receives no judge verdict.

The Fodors run is the coverage boundary: 113 proposed, 0 confirmed. No accuracy claim is made on real data.

## Where the labeled matches are lost (measured 2026-11-07)

`npm run evaluate -- <table> <labels.csv> <a column> <b column> <tableA.csv> <tableB.csv>` (`scripts/evaluate.ts`) joins a file of expected matches, kept outside the product's decision path, to the pairs export written by the demo, checks every label id against its own table, and gives every labeled match exactly one outcome. On Fodors–Zagat (112 labeled matches; inputs pinned by sha256 f3b08d69…, f8daf43e…; labels b336a18c…):

| Outcome | Count |
|---|---|
| never proposed by the matcher | 5 |
| proposed, judge unknown | 107 |
| proposed, judge refuted | 0 |
| proposed, judge right | 0 |
| proposals not in the labels (ungraded) | 6 |

Candidate recall is 107 of 112: on this fixture the matcher finds almost every known match and the judge leaves them undecided. A proposer change could recover at most five; the loss on this fixture is at confirmation. The traced pair A#534 ↔ B#219 is a labeled match, proposed, left unknown; its measured chance exceeded the judge's bar by about seven times, which locates what to investigate. The evaluation does not say whether that bar is right or what moving it would do. Plants: a label whose id is in neither table is refused by name (exit 1); removing one valid proposal from a copy of the export moves exactly one pair from unknown to never proposed with the denominator unchanged. The Fodors tables and labels are DeepMatcher/Magellan benchmark files and are not in this repo; run the demo with a tests directory holding them first, so the export contains the Fodors proposals.

## The commands

**`npm run demo -- <tests dir>`** (`scripts/demo.ts`). Runs own_copy and its stitched records always; when `<tests dir>/unlabeled/fodors_zagat/` exists it also runs the Fodors tables and a Fodors chimera. With no argument it refuses by name. Writes `out/demo_pairs.tsv`.

**`npm run check`** (`scripts/check.ts`). Reads `out/demo_pairs.tsv` and `tests/positive/own_copy/expected.tsv`; exit 1 unless every expected copy pair is proposed and ruled right and every stitched pair is ruled unknown.

**`npm run gate`** (`scripts/gate.ts`). The development ledger check over this tree: compiles, counts the forms the laws forbid against the ceilings in `.gate/laws.tsv`, checks the ledgers against the newest `.gate/history` point. `.gate/audit/` and `.gate/history/` are not published, so on a clean clone the gate reports them as MISSING and exits 1; it no longer crashes (fixed 2026-11-07: five bare reads, and an error line now sets the exit status). Its success control is the author's recorded tree.

**`npm run run -- <tests dir>`** (`scripts/run.ts`). The matcher on the six benchmark segments; needs the benchmark inputs described below.

## Landing status

Three records, three different states:

- **Committed in git:** the 2026-11-03 change (`demo.ts`, `judge.ts`, `run.ts`) and the 2026-11-07 changes (`gate.ts` fix, demo fixture, `check.ts`, `evaluate.ts`, CI workflow).
- **Checked in public CI:** the demo and `check` only (the badge). The Fodors evaluation was run locally on 2026-11-07 against benchmark files not in this repo; CI does not run it.
- **Recorded in the harness ledger** (`.gate/landing.tsv` manifest, falsifier verdict, history point): none of the above yet. `npm run gate` on the author's tree reports one LANDING line until they land. The gate fix's scorer and falsifier packet (nine checks, reviewed for the tested clean-clone case; no harness approval is recorded in the ledger yet) are kept under `.gate/audit/gateClean.try/`.

## Benchmark inputs (not in this repo)

`scripts/run.ts` (`segmentList`) and `scripts/demo.ts` expect this layout under `<tests dir>`:

| Segment | Table A | Table B | Pairs file |
|---|---|---|---|
| c2_copy | `positive/c2_copy/tableA.csv` | `positive/c2_copy/tableB.csv` | `positive/c2_copy.pairs` |
| c2_exact | `positive/c2_exact/tableA.csv` | `positive/c2_exact/tableB.csv` | `positive/c2_exact.pairs` |
| c2_same | `unlabeled/c2_same/tableA_even.csv` | `unlabeled/c2_same/tableA_odd.csv` | none |
| fodors_zagat | `unlabeled/fodors_zagat/tableA.csv` | `unlabeled/fodors_zagat/tableB.csv` | none |
| dirty | `splits/dirty/1/tableA.csv` | `splits/dirty/1/tableB.csv` | none |
| beer | `splits/structured/beer/tableA.csv` | `splits/structured/beer/tableB.csv` | none |

Sources, as far as this repo's record establishes them: Fodors–Zagat, Beer and the "dirty" set are the public record-matching benchmarks of the DeepMatcher / Magellan collection; the exact dataset version used on Oct 18, 2026, the download location, and the preparation that produced the `tableA.csv` / `tableB.csv` files above are **not recorded in this repo**. The c2 set (copy / exact / same) was built by the author from a source table; how it was built is **not recorded in this repo**. The `.pairs` files' format is read by `scripts/run.ts` and not documented elsewhere.

## Test evidence, and what it does and does not show

- **Valid cases:** the c2 copies (`c2_copy`, `c2_exact`), where every pair was built to be the same record. The intended expectation is that the judge rules these right.
- **Known-wrong cases:** the chimeras built by `constructChimera` (`scripts/demo.ts`): records stitched from fields of different rows, wrong by construction unless those rows were one entity. The expectation is that the judge rules none of them right; on the tracked synthetic fixture on 2026-11-07 it ruled all 12 unknown (none refuted).
- **Real tables:** `fodors_zagat`, `dirty`, `beer`. The matcher and judge never read labels; they run on the tables alone and are expected to abstain ("unknown") rather than guess. The evaluator (`scripts/evaluate.ts`) reads 112 external Fodors labels after the run, to account for the matches the product never confirmed; the labels stay outside the decision path.
- **Where expectations come from:** the expected copy pairs and stitched cases come from how the synthetic fixture was built. Public CI checks those fixture results pair by pair. The Nov 7 Fodors result was measured locally using external benchmark files. The Oct 18 runs are historical baselines, not regenerated here. `ASPIRATIONS.md` records the hypothesis about near-duplicates that came out of that earlier work; it is kept separate from the Fodors evaluation above until reproduced.
- **What a run establishes:** on the inputs it was given, that the judge rejected the constructed wrong cases it rejected and accepted the constructed copies it accepted, with the counts it printed. If execution is possible, the actual printed counts, including failures and abstentions, are the evidence. It does not establish general matching correctness, and constructed examples are not labelled real-world pairs.
- **The gate's own plant:** `scripts/gate.ts` accepts extra root files as fixtures so that a planted forbidden form can be shown to count against a law ceiling. That tests the gate's counting, not the matcher.

## Reproducibility status

The tracked demo reproduces from a clean clone in CI (badge above). The benchmark segments under `npm run run` still need the inputs below; the Oct 18 recorded results remain recorded, not regenerated here.

## How the work is done

Three roles. The **owner** (me) sets the laws and rules on what a read may decide. The **builder** is an AI agent that writes and runs code, one chain per session. The **falsifier** is a separate AI session that never sees the builder's reasoning and writes every verdict into `.gate/verdicts.tsv` with its reason. A change lands only when: its targets were written before its code and name the cell it moves; every check fails its planted fault before its pass counts; no ceiling in `.gate/laws.tsv` rises; and the gate (`scripts/gate.ts`) finds zero errors. Every landing's files are hashed into `.gate/history` on the author's machine; that history is not in this repo, so a clone cannot rebuild earlier states from it. The gate also counts, in this tree's own code, the things it forbids: silent fills, `any` leaking through a typed name, guards, duplicate units, dead exports.

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

- `.gate/` — laws (ceilings), reads (wall / if yes / if no), verdicts (check, verdict, supersedes, reason). `.gate/history/` and `.gate/audit/`, which the gate also reads, are not in this repo.
- `PLAYBOOK.md` — the healix6 agent skill, kept as history; the current workflow is *How the work is done* above. Its three rules still hold here: read before claiming, measure before counting, edits obey the tree's own laws.
- `src/` — eight files, one law each, from the byte store up to claims. `scripts/` — the harness.
