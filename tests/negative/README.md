# The population sets the bar — three variants of the tracked fixture (2026-11-07)

Measured with `scripts/separation.ts` (every copy pair and every chimera-vs-donor pair priced at the judge level against its run's own bar; the demo's matcher proposes only some of these pairs).

| Variant | Tables | False confirmations | Lost controls | What was confirmed |
|---|---|---|---|---|
| tracked fixture (`tests/positive/own_copy`) | 60 customers, 60 copies + 60 others | 0 | 0 | — |
| `own_copy_65/` | plus five customers, every address unique | 3 | 0 | one unique value (an address or an email) + one common value, six disagreements |
| `own_copy_65_colocated/` | six businesses moved to share an address block with six others | 0 | 0 | — (judge unchanged) |
| `own_copy_60_colocated/` | the tracked fixture with the same six moves | 4 | 0 | one unique value (a name or an email) + one or two common values |

Finding. A pair is SUPPORTED at rank 0: its agreement outscores every pair of different records inside the tables, and the floor 1/(inside+1) sits under the bar 1/(across+1). The judge does read disagreement (it enters every view's score), but a single value unique in the table outweighs several disagreements, and rank 0 does not record by how much. So a population-relative judge is only as calibrated as the richest agreement between different records in its population: where no two different records share anything rare, one rare shared value confirms. On the Fodors-derived c2 set the richest within-table pairs are different restaurants in one hotel or casino sharing address and phone, so a single rare value cannot reach rank 0 there and 267 of 267 copies still clear the top (by as little as 0.95). Co-location recipes do not transfer between fixtures (65 rows: 3 -> 0; 60 rows: 0 -> 4). A population-independent floor was measured and closed: leave-one-view-out gives 0 / 0 on every variant here but loses 51 of 267 true c2 copies.

Open ruling (WORK_ORDER 1): whether this limitation is acceptable for the product's claims, or a population-independent floor is worth its measured cost on real copies. Until ruled, the README states the limitation beside the result.
