/** WORK_ORDER 1 instrument. On one tests directory, prices every copy pair (right by construction) in the own_copy run and every chimera-vs-donor pair (wrong by construction) in the chimera run, each against its own run's bar. Prints per run: inside, across, floor, bar; false confirmations (wrong pairs with chance <= bar) by name; lost controls (right pairs with chance > bar) by name. Changes nothing. argv: the tests directory. */
import { readFileSync } from "node:fs";
import { judgeTables } from "./judge.ts";
import { priceAcross } from "../src/price.ts";
import { constructChimera } from "../src/construction.ts";
const dir = process.argv[2]; if (!dir) throw new Error("separation REFUSED: argv is <tests directory>");
const bytesA = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableA.csv`)); const bytesB = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableB.csv`));
const idOf = (bytes: Uint8Array, row: number): string => Buffer.from(bytes).toString("latin1").split("\n").filter((l) => l.length > 0)[row + 1].split(",")[0];
function run(name: string, a: Uint8Array, b: Uint8Array, pairs: Array<[number, number]>, kind: "right" | "wrong"): number {
  const judged = judgeTables(a, b); const priced = judged.priced; const bar = judged.chanceBar;
  console.log(`\n${name}: inside ${priced.inside} across ${priced.across} floor ${(1 / (priced.inside + 1)).toFixed(6)} bar ${bar.toFixed(6)}; ${pairs.length} ${kind}-by-construction pairs priced`);
  let offenders = 0;
  for (const [ra, rb] of pairs) {
    const price = priceAcross(priced, ra, rb); const under = price.chance <= bar;
    const offends = kind === "wrong" ? under : !under;
    if (offends) { offenders += 1; console.log(`  ${kind === "wrong" ? "FALSE CONFIRMATION" : "LOST CONTROL     "} A#${idOf(a, ra)} x B#${idOf(b, rb)} score ${priced.acrossScore[ra * priced.recordsB + rb].toFixed(3)} rank ${price.rank} chance ${price.chance.toFixed(6)} bar ${bar.toFixed(6)}`); }
  }
  console.log(`  ${kind === "wrong" ? "false confirmations" : "lost controls"}: ${offenders} of ${pairs.length}`);
  return offenders;
}
const copies: Array<[number, number]> = []; for (let i = 0; i < 60; i += 1) copies.push([i, i]);
const lost = run("own_copy run (A vs B)", bytesA, bytesB, copies, "right");
const chimera = constructChimera(bytesA, 2);
const wrong: Array<[number, number]> = []; chimera.donors.forEach((donors, j) => donors.forEach((d) => wrong.push([d, j])));
const falseConf = run("chimera run (A vs stitched rows; every donor pair)", chimera.a, chimera.b, wrong, "wrong");
console.log(`\nSEPARATION: false confirmations ${falseConf}, lost controls ${lost} (a right rule reaches 0 and 0)`);
