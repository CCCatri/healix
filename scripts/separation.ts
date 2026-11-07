/** WORK_ORDER 1 instrument. On one tests directory, prices every copy pair (right by construction) in the own_copy run and every chimera-vs-donor pair (wrong by construction) in the chimera run, each against its own run's bar, under two rules: the current rule (chance <= bar) and the candidate leave-one-view-out rule (chance <= bar with every single view removed in turn — an identity verdict may not rest on one piece). Prints false confirmations and lost controls by name under each. Changes nothing in the product. argv: the tests directory. */
import { readFileSync } from "node:fs";
import { judgeTables } from "./judge.ts";
import { priceAcross, priceSegment } from "../src/price.ts";
import { constructChimera } from "../src/construction.ts";
const dir = process.argv[2]; if (!dir) throw new Error("separation REFUSED: argv is <tests directory>");
const bytesA = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableA.csv`)); const bytesB = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableB.csv`));
const idOf = (bytes: Uint8Array, row: number): string => Buffer.from(bytes).toString("latin1").split("\n").filter((l) => l.length > 0)[row + 1].split(",")[0];
function run(name: string, a: Uint8Array, b: Uint8Array, pairs: Array<[number, number]>, kind: "right" | "wrong"): [number, number] {
  const judged = judgeTables(a, b); const priced = judged.priced; const bar = judged.chanceBar;
  const views = Array.from(priced.views);
  const leaveOneOut = views.map((v) => priceSegment(judged.cellMatrix, judged.piecesPerView, views.filter((w) => w !== v), priced.recordsA, priced.recordsB));
  console.log(`\n${name}: inside ${priced.inside} across ${priced.across} bar ${bar.toFixed(6)}; ${views.length} measured views; ${pairs.length} ${kind}-by-construction pairs`);
  let offendCurrent = 0; let offendCandidate = 0;
  for (const [ra, rb] of pairs) {
    const current = priceAcross(priced, ra, rb).chance <= bar;
    const worst = Math.max(...leaveOneOut.map((p) => priceAcross(p, ra, rb).chance));
    const candidate = current && worst <= bar;
    const offC = kind === "wrong" ? current : !current; const offK = kind === "wrong" ? candidate : !candidate;
    if (offC) offendCurrent += 1; if (offK) offendCandidate += 1;
    if (offC || offK) console.log(`  A#${idOf(a, ra)} x B#${idOf(b, rb)}  current ${current ? "SUPPORTED" : "INSUFFICIENT_EVIDENCE"}  candidate ${candidate ? "SUPPORTED" : "INSUFFICIENT_EVIDENCE"} (worst leave-one-out chance ${worst.toFixed(6)})  ${kind === "wrong" ? (offC ? "FALSE under current" : "") + (offK ? " FALSE under candidate" : "") : (offC ? "LOST under current" : "") + (offK ? " LOST under candidate" : "")}`);
  }
  console.log(`  ${kind === "wrong" ? "false confirmations" : "lost controls"}: current ${offendCurrent}, candidate ${offendCandidate} of ${pairs.length}`);
  return [offendCurrent, offendCandidate];
}
const copies: Array<[number, number]> = []; for (let i = 0; i < 60; i += 1) copies.push([i, i]);
const lost = run("own_copy run (A vs B)", bytesA, bytesB, copies, "right");
const chimera = constructChimera(bytesA, 2);
const wrong: Array<[number, number]> = []; chimera.donors.forEach((donors, j) => donors.forEach((d) => wrong.push([d, j])));
const falseConf = run("chimera run (A vs stitched rows; every donor pair)", chimera.a, chimera.b, wrong, "wrong");
console.log(`\nSEPARATION  current rule: false confirmations ${falseConf[0]}, lost controls ${lost[0]}   candidate (leave-one-view-out): false confirmations ${falseConf[1]}, lost controls ${lost[1]}`);
