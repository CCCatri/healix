# Healix: a proposed match is not a match you can act on

Measured 2026-11-07 on commit c3b14ac; reproduced by CI from a clean checkout on every push (`npm ci`, `npm run demo -- tests`, `npm run check`).

## The product case

Two tables of invented customer records: A holds 60; B holds their 60 copies plus 60 different records. Healix has two stages with different jobs, reading the same extracted pieces: the matcher proposes pairs; the judge measures each proposal against the pairs inside the tables and rules right, unknown, or refuted.

| Case | Matcher proposed | Judge ruled |
|---|---|---|
| 60 built copies | 60 | 60 right |
| 12 records stitched from different rows of A | 12 | 12 unknown |
| The same 60 copies with B's 60 non-matching records removed | 60 | 60 unknown |
| Fodors–Zagat, real tables (not in this repo) | 113 | 113 unknown |

A judge that approved everything would fail the stitched case; a judge that abstained on everything would fail the copy case. Together the first two rows are the demonstration. The third row is the observation that the judge's verdict depends on the population it is measured against. The fourth is the coverage boundary on real data: 113 proposed, 0 confirmed. No accuracy claim is made beyond these fixtures.

The practical pair: A#1000 and B#11000 are copies. Change B#11000's phone to a number sharing no piece with the original, and `AddressTelephone1` leaves the pair's agreement list while the judge still confirms them on the other seven fields: two records that disagree on a field and are the same customer. Change the phone, contact and email together, and the matcher no longer proposes the pair: 59 proposed, 59 right. A pair the matcher never proposes receives no judge verdict.

`check` verifies every one of the 72 proposed pairs against `tests/positive/own_copy/expected.tsv`, which was written from the fixture's construction. Alter one expected pair id and `check` fails with the counts unchanged (tested).

## The QA case: what I changed, and how I knew

**The failure.** On 2026-11-04 the README recorded that `npm run gate` did not complete from a clean clone. On 2026-11-07, from a fresh clone at commit 3341e51, `npm install` completed and `npm run gate` crashed: `ENOENT: scandir .gate/audit` at `scripts/gate.ts:129`. `.gate/audit/` is gitignored and `.gate/history/` and `.gate/locks.tsv` are untracked; the gate read all three bare.

**The fix.** Five bare reads became the tree's own MISSING shape (a noted error and an if/else), the four comparisons against the newest history point run only when a point exists, and an error line printed now sets exit 1. The gate rejected my first version: it used `existsSync` ternaries, which the gate's own law `absenceFills` counts, and the count on `scripts/gate.ts` rose from 0 to 3 on the author's tree. Rewritten in the if/else shape the tree already uses, the count stayed 0.

**The checks.** (1) Clean clone: 268 LAW lines reached, MISSING printed for audit, history and locks, no false LANDING line, exit 1. (2) Control: the newest history point's own saved tree runs the original gate with exit 0 and no errors; swapping in the edited gate produces exactly one LANDING line (the gate's own source changed) and exit 1, with all 239 LAW and LAWNOTE lines byte-identical and `scripts/gate.ts` the only changed path in the manifest comparison. (3) Plant: reinstating one bare read reproduces the ENOENT crash. Scorer and falsifier packet: `.gate/audit/gateClean.try/` (author's tree). The falsifier approved the edit for the tested clean-clone case; its ledger landing is pending (see README, Landing status).

**The judge finding, by elimination.** The 60-row fixture first ruled 0 right. Three explanations were tested with controls and failed: repeated names (unique names, still 0), schema (the Fodors-derived c2 set cut to 40 rows, still 0), row count (c2 at 60, 100, 150, 200, 267 rows, all 0). The fourth held both ways on real data: c2 with its 266 non-matching rows present, 267 right; filtered to the 267 copies alone, 0 right. The own fixture rebuilt with 60 non-matching records in B: 60 right.

**What the plants taught.** Changing one copy's phone to `516-000-0000` left `AddressTelephone1` in the agreement list and the ruling unchanged, which contradicted my prediction; the file on disk had changed, so the judge was agreeing on a shared piece (`516`), not the field. A phone sharing no piece removed the field from the list; three fields changed removed the pair at the matcher. The first prediction was wrong and the record says so.

**Scope.** Harness and demo changes: `scripts/gate.ts`, `scripts/demo.ts`, `scripts/check.ts`, a fixture, a workflow. The matcher and judge (`src/`, `scripts/judge.ts`) are unchanged. Agents wrote the code against targets written first; I designed the checks, ran them, read the results, and ruled on what landed; a separate falsifier session reviewed the packet.
