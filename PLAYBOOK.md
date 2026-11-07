# PLAYBOOK — the healix6 agent skill, kept as history

Not the active workflow for this tree: that is *How the work is done* in README.md (owner, builder, falsifier; targets before code; a plant per check; no ceiling rises; the gate at zero errors). Nothing in this repo reads this file. Written Sep 2026 for the previous tree (healix6) and carried unchanged. The laws it states are the ones `scripts/gate.ts` now enforces. The four edit mechanisms it names (`applyEdits.py`, `editFile.ts`, `anchorAt`, `landEdit`) and `censusTell` were that tree's; they are not in this repo. The two reference files it routes to (`migration.md`, `doctrine.md`) are not published.

---

---
name: healix
description: Use when changing, debugging, reviewing or redesigning the Healix repository, or when stating what Healix claims about code it was pointed at. Routes to MIGRATION for a door, an owner, a duplicate, a name or a deletion, and to DOCTRINE for a DISTINCT, NEEDED or AFFECTED claim. Holds the agent to the tree's own laws: read before claiming, measure before counting, one producer per fact.
---

# HEALIX

## WHICH ROUTE

Ask what the change is *about*.

```text
the REPOSITORY -- a door, an owner, a duplicate, a name, a deletion
  -> migration.md
the SUBSTRATE -- what Healix claims about code it was pointed at
  -> doctrine.md
```

- [references/migration.md](references/migration.md): phases, count ledger, residue partition, standing repository laws, completion.
- [references/doctrine.md](references/doctrine.md): the ONE LAW, the cell, the three jobs, the three populations, operators, detectors, how a law is held.

Most sessions are MIGRATION. A migration that closes a doctrine law reads
both. Do not narrate the routing; route and work.

## READ BEFORE YOU CLAIM

A handoff, a header, a comment and a memory are all evidence. None is the bytes.

Every claim about a file names how it was read this session. If it was not read,
say so and read it.

## MEASURE, NEVER FORECAST

Counts are read from a tool, not estimated. `109 -> 74 -> 34 -> 31` is
evidence; "roughly a dozen sites" is not. When a number is guessed, mark it
guessed. This applies to counts of sites, to verdicts about the substrate, and
to the agent's own claims of completion.

## THE AGENT'S EDITS OBEY THE TREE'S LAWS

The tree owns four edit mechanisms and their laws apply to the agent using them:

```text
applyEdits.py   an edit CONSUMES its anchor -- new must not contain old
editFile.ts     compare before against after; a miss throws, a no-op throws
anchorAt        an anchor comes from the FILE, never from memory of it
landEdit        postconditions read from disk, never the caller's sentence
```

Two corollaries:

**Never name what you have not read.** Not a line, not a symbol, not a function
you intend to call. Fabricating a callee is the same act as anchoring on a
remembered line.

**Strip comments before deciding anything from text.** This tree writes its
history in prose that quotes retired names. A scan that reads comments as live
sites is the exact class `censusTell` convicts, committed by the tool.

Do not build a fifth editor. If a scratch helper is unavoidable it lives in
`/tmp`, never in the repository.

Run the tree's laws as each edit lands. They are the edit's falsifier, not a
step at the end.
