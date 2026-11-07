/** WORK_ORDER 1 instrument. Separation on constructed truths: prices every copy pair (right by construction) and every chimera-vs-donor pair (wrong by construction) on one tests directory, and prints score, rank, chance and verdict beside the top within-table score they are ranked against. Changes nothing. argv: the tests directory. */
import { readFileSync } from "node:fs";
import { judgeTables } from "./judge.ts";
import { priceAcross } from "../src/price.ts";
import { constructChimera } from "../src/construction.ts";
const dir = process.argv[2]; if (!dir) throw new Error("separation REFUSED: argv is <tests directory>");
const bytesA = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableA.csv`)); const bytesB = new Uint8Array(readFileSync(`${dir}/positive/own_copy/tableB.csv`));
const idOf = (bytes: Uint8Array, row: number): string => { const lines = Buffer.from(bytes).toString("latin1").split("\n").filter((l) => l.length > 0); return lines[row + 1].split(",")[0]; };
function table(name: string, a: Uint8Array, b: Uint8Array, pairs: Array<[number, number, string]>): void {
  const judged = judgeTables(a, b); const priced = judged.priced; const bar = judged.chanceBar;
  const topInside = priced.insideSorted.length > 0 ? priced.insideSorted[priced.insideSorted.length - 1] : 0;
  console.log(`\n${name}: inside ${priced.inside} across ${priced.across} floor ${(1 / (priced.inside + 1)).toFixed(6)} bar ${bar.toFixed(6)} top within-table score ${topInside.toFixed(3)}`);
  let minWrong = Infinity; let maxRight = -Infinity;
  for (const [ra, rb, kind] of pairs) {
    const score = priced.acrossScore[ra * priced.recordsB + rb]; const price = priceAcross(priced, ra, rb);
    const verdict = price.chance <= bar ? "SUPPORTED" : "INSUFFICIENT_EVIDENCE";
    if (kind === "wrong") minWrong = Math.min(minWrong, price.chance); else maxRight = Math.max(maxRight, price.chance);
    if (kind === "wrong" || price.rank > 0 || rb !== ra) console.log(`  ${kind.padEnd(5)} A#${idOf(a, ra)} x B#${idOf(b, rb)} score ${score.toFixed(3)} rank ${price.rank} chance ${price.chance.toFixed(6)} ${verdict}`);
  }
  console.log(`  copies: ${pairs.filter((p) => p[2] === "right").length} pairs, max chance ${maxRight.toFixed(6)}; wrong: ${pairs.filter((p) => p[2] === "wrong").length} pairs, min chance ${minWrong === Infinity ? "n/a" : minWrong.toFixed(6)}`);
  console.log(`  SEPARATION (min wrong chance - max right chance): ${minWrong === Infinity ? "n/a" : (minWrong - maxRight).toFixed(6)}  (0 or negative = a wrong pair priced like a copy)`);
}
const copies: Array<[number, number, string]> = []; for (let i = 0; i < 60; i += 1) copies.push([i, i, "right"]);
table("own_copy (A vs B)", bytesA, bytesB, copies);
const chimera = constructChimera(bytesA, 2);
const wrong: Array<[number, number, string]> = []; chimera.donors.forEach((donors, j) => donors.forEach((d) => wrong.push([d, j, "wrong"])));
table("own chimera (A vs stitched rows; every donor pair)", chimera.a, chimera.b, wrong);
