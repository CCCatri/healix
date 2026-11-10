/** The evaluation. Joins a labels file of expected matches (two id columns, outside the product's decision path) to a pairs export (every pair the matcher proposed, with the judge's ruling) for one table name, after checking every label id against its own input table. Every labeled pair gets exactly one outcome: never proposed, proposed and INSUFFICIENT_EVIDENCE, proposed and REFUTED, proposed and SUPPORTED; the four sum to the distinct label count or the run refuses. A label whose id is in neither table is a refusal, never a matcher miss. Proposals absent from the labels are reported as unlabeled, never graded. argv: <table name as printed by demo> <labels csv> <a column> <b column> <tableA csv> <tableB csv> [pairs export, default out/demo_pairs.tsv]. */
import { readFileSync } from "node:fs";
import { findItem } from "../src/matrix.ts";
const argList = process.argv.slice(2);
if (argList.length < 6) throw new Error("evaluate REFUSED: argv is <table> <labels.csv> <a column> <b column> <tableA.csv> <tableB.csv> [pairs.tsv]");
const tableName = findItem(argList, 0); const labelsPath = findItem(argList, 1); const columnA = findItem(argList, 2); const columnB = findItem(argList, 3);
const pathA = findItem(argList, 4); const pathB = findItem(argList, 5); const pairsPath = argList.length > 6 ? findItem(argList, 6) : "out/demo_pairs.tsv";
function listIds(csvPath: string): Set<string> { return new Set(readFileSync(csvPath, "latin1").split("\n").slice(1).filter((lineText) => lineText.length > 0).map((lineText) => findItem(lineText.split(","), 0))); }
const idsA = listIds(pathA); const idsB = listIds(pathB);
const labelLines = readFileSync(labelsPath, "utf8").split("\n").filter((lineText) => lineText.length > 0);
const headerList = findItem(labelLines, 0).split(","); const slotA = headerList.indexOf(columnA); const slotB = headerList.indexOf(columnB);
if (slotA < 0 || slotB < 0) throw new Error(`evaluate REFUSED: columns ${columnA}, ${columnB} not both in header ${headerList.join(",")}`);
const labeledPairs = new Set<string>();
for (const lineText of labelLines.slice(1)) {
  const fieldList = lineText.split(","); const idA = findItem(fieldList, slotA); const idB = findItem(fieldList, slotB);
  if (!idsA.has(idA)) throw new Error(`evaluate REFUSED: label id ${idA} is not in table A (${pathA})`);
  if (!idsB.has(idB)) throw new Error(`evaluate REFUSED: label id ${idB} is not in table B (${pathB})`);
  labeledPairs.add(`A#${idA}\tB#${idB}`);
}
const proposedPairs = new Map<string, string>();
for (const lineText of readFileSync(pairsPath, "utf8").split("\n").slice(1)) { if (lineText.length === 0) continue; const fieldList = lineText.split("\t"); if (findItem(fieldList, 0) !== tableName) continue; proposedPairs.set(`${findItem(fieldList, 1)}\t${findItem(fieldList, 2)}`, findItem(fieldList, 3)); }
let neverProposed = 0; let proposedUnknown = 0; let proposedRefuted = 0; let proposedRight = 0; const neverList: string[] = [];
for (const pairKey of labeledPairs) {
  if (!proposedPairs.has(pairKey)) { neverProposed += 1; neverList.push(pairKey); continue; }
  const rulingWord = proposedPairs.get(pairKey);
  if (rulingWord === "INSUFFICIENT_EVIDENCE") proposedUnknown += 1; else if (rulingWord === "REFUTED") proposedRefuted += 1; else if (rulingWord === "SUPPORTED") proposedRight += 1; else throw new Error(`evaluate REFUSED: ruling ${rulingWord} on ${pairKey} is not in the closed list`);
}
const unlabeledList = [...proposedPairs.keys()].filter((pairKey) => !labeledPairs.has(pairKey));
const outcomeTotal = neverProposed + proposedUnknown + proposedRefuted + proposedRight;
if (outcomeTotal !== labeledPairs.size) throw new Error(`evaluate REFUSED: outcomes ${outcomeTotal} do not sum to labels ${labeledPairs.size}`);
console.log(`EVALUATE ${tableName}: ${labeledPairs.size} labeled matches (every id present in its table) | ${proposedPairs.size} proposed by the matcher`);
console.log(`  never proposed: ${neverProposed}`); console.log(`  proposed, judge INSUFFICIENT_EVIDENCE: ${proposedUnknown}`); console.log(`  proposed, judge REFUTED: ${proposedRefuted}`); console.log(`  proposed, judge SUPPORTED: ${proposedRight}`);
console.log(`  proposals not in the labels (unlabeled, not graded): ${unlabeledList.length}`);
console.log(`  candidate recall (labeled matches the matcher proposed): ${labeledPairs.size - neverProposed} of ${labeledPairs.size}`);
for (const pairKey of neverList.slice(0, 10)) console.log(`  never proposed: ${pairKey.replace("\t", " <-> ")}`);
