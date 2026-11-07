/** WORK_ORDER 1 independent evidence. Prices every labeled pair (two id columns, outside the product's decision path) under the current rule (chance <= bar) and the candidate leave-one-view-out rule, against the run's own bar. Prints SUPPORTED counts under each and the pairs that change. Changes nothing in the product. argv: <tableA.csv> <tableB.csv> <labels.csv> [a column] [b column] */
import { readFileSync } from "node:fs";
import { judgeTables } from "./judge.ts";
import { priceAcross, priceSegment } from "../src/price.ts";
const [pathA, pathB, pathL, colA, colB] = process.argv.slice(2); if (!pathL) throw new Error("argv: <tableA.csv> <tableB.csv> <labels.csv> [a column] [b column]");
const a = new Uint8Array(readFileSync(pathA)); const b = new Uint8Array(readFileSync(pathB));
const ids = (bytes: Uint8Array): Map<string, number> => { const m = new Map<string, number>(); Buffer.from(bytes).toString("latin1").split("\n").filter((l) => l.length > 0).slice(1).forEach((l, i) => m.set(l.split(",")[0], i)); return m; };
const idsA = ids(a); const idsB = ids(b);
const lines = readFileSync(pathL, "utf8").split("\n").filter((l) => l.length > 0); const header = lines[0].split(",");
const sa = colA ? header.indexOf(colA) : 0; const sb = colB ? header.indexOf(colB) : 1; if (sa < 0 || sb < 0) throw new Error(`columns not in header ${header.join(",")}`);
const judged = judgeTables(a, b); const priced = judged.priced; const bar = judged.chanceBar; const views = Array.from(priced.views);
const leaveOneOut = views.map((v) => priceSegment(judged.cellMatrix, judged.piecesPerView, views.filter((w) => w !== v), priced.recordsA, priced.recordsB));
let labeled = 0; let cur = 0; let cand = 0; let skipped = 0; const changed: string[] = [];
for (const l of lines.slice(1)) { const f = l.split(","); const ia = idsA.get(f[sa]); const ib = idsB.get(f[sb]); if (ia === undefined || ib === undefined) { skipped += 1; continue; } labeled += 1;
  const c = priceAcross(priced, ia, ib).chance <= bar; const worst = Math.max(...leaveOneOut.map((p) => priceAcross(p, ia, ib).chance)); const k = c && worst <= bar;
  if (c) cur += 1; if (k) cand += 1; if (c !== k) changed.push(`${f[sa]} x ${f[sb]} current SUPPORTED, candidate INSUFFICIENT_EVIDENCE (worst leave-one-out ${worst.toFixed(6)})`); }
console.log(`${pathA.split("/").slice(-2, -1)[0]}: inside ${priced.inside} across ${priced.across} bar ${bar.toFixed(6)} views ${views.length}; labeled pairs ${labeled} (ids not in their table: ${skipped})`);
console.log(`  SUPPORTED under current rule ${cur}; under candidate ${cand}; changed ${changed.length}`); changed.slice(0, 12).forEach((t) => console.log("  " + t)); if (changed.length > 12) console.log(`  ... ${changed.length - 12} more`);
