/** The release check. Reads out/demo_pairs.tsv (written by scripts/demo.ts) and tests/positive/own_copy/expected.tsv (written from the fixture's construction, never from a run). Passes only when every expected own_copy pair is present and ruled SUPPORTED, and every proposed own chimera pair is ruled INSUFFICIENT_EVIDENCE. Counts alone never pass it: a wrong id fails it with the counts unchanged. Exit 1 on any failure, each printed by name. */
import { readFileSync } from "node:fs";
import { findItem } from "../src/matrix.ts";
function readRows(pathText: string): string[][] { return readFileSync(pathText, "utf8").split("\n").filter((lineText) => lineText.length > 0).slice(1).map((lineText) => lineText.split("\t")); }
const seenRows = readRows("out/demo_pairs.tsv");
const expectedRows = readRows("tests/positive/own_copy/expected.tsv");
const seenMap = new Map<string, string>();
for (const seenRow of seenRows) seenMap.set(`${findItem(seenRow, 0)}\t${findItem(seenRow, 1)}\t${findItem(seenRow, 2)}`, findItem(seenRow, 3));
const failList: string[] = [];
for (const expectedRow of expectedRows) {
  const pairKey = `${findItem(expectedRow, 0)}\t${findItem(expectedRow, 1)}\t${findItem(expectedRow, 2)}`;
  if (!seenMap.has(pairKey)) { failList.push(`MISSING\t${pairKey}\tnot proposed`); continue; }
  const seenWord = seenMap.get(pairKey); if (seenWord !== findItem(expectedRow, 3)) failList.push(`RULING\t${pairKey}\texpected ${findItem(expectedRow, 3)}, got ${seenWord}`);
}
const chimeraRows = seenRows.filter((seenRow) => findItem(seenRow, 0) === "own chimera");
for (const chimeraRow of chimeraRows) if (findItem(chimeraRow, 3) !== "INSUFFICIENT_EVIDENCE") failList.push(`CHIMERA\t${chimeraRow.join("\t")}\tjudged ${findItem(chimeraRow, 3)}, expected INSUFFICIENT_EVIDENCE`);
for (const failText of failList) console.log(failText);
console.log(`CHECK ${failList.length === 0 ? "PASS" : "FAIL"}: ${expectedRows.length} expected copy pairs, ${seenRows.filter((seenRow) => findItem(seenRow, 0) === "own_copy").length} proposed, ${chimeraRows.length} chimera pairs proposed, ${failList.length} failures`);
if (failList.length > 0) process.exitCode = 1;
