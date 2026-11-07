/** The demonstration: what the method shows a reader in one screen, on three tables (c2_copy, built copies; fodors_zagat, two real tables; the fodors chimera, records stitched from fields of different rows). It reads the judge's pipeline from judge.ts, the one producer run.ts also reads, and writes nothing: no lock, ledger or history. Every number it prints is measured on this run. A record is named by content: its numbering value where the table has a numbering view, else the first 12 hex of the sha256 of its bytes. Sentences are sorted by content, so which ones print does not depend on row order. argv: the tests directory. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { findItem } from "../src/matrix.ts";
import type { Part } from "../src/record.ts";
import { listRows, constructReversed } from "../src/record.ts";
import type { Claim } from "../src/claim.ts";
import { priceAcross } from "../src/price.ts";
import { constructChimera, readField } from "../src/construction.ts";
import type { Judged, Rulings } from "./judge.ts";
import { judgeTables, judgeClaims, countDifference } from "./judge.ts";

type Shown = { readonly judged: Judged; readonly rulings: Rulings; readonly sentences: readonly string[]; readonly orderSame: boolean };

/** Two tables' bytes from the tests directory. */
function readTables(testsDir: string, pathA: string, pathB: string): readonly [Uint8Array, Uint8Array] {
  return [new Uint8Array(readFileSync(`${testsDir}/${pathA}`)), new Uint8Array(readFileSync(`${testsDir}/${pathB}`))];
}

/** A record's name by content. */
function readName(judgedTables: Judged, sideWord: string, recordPart: Part, recordAt: number): string {
  const rowBytes = judgedTables.cellMatrix.listBytes(findItem(recordPart.records, recordAt));
  if (judgedTables.numberingFields.length > 0) return `${sideWord}#${judgedTables.numberingFields.map((fieldAt) => Buffer.from(readField(rowBytes, fieldAt)).toString("latin1")).join("/")}`;
  return `${sideWord}#${createHash("sha256").update(rowBytes).digest("hex").slice(0, 12)}`;
}

/** The fields where a claim's two records share a piece, by header. */
function listAgreeing(judgedTables: Judged, claimItem: Claim): string[] {
  const cellMatrix = judgedTables.cellMatrix;
  return judgedTables.piecesPerView.filter((viewPieces) => findItem(viewPieces.a, claimItem.a).some((leftKey) => findItem(viewPieces.b, claimItem.b).some((rightKey) => Buffer.compare(cellMatrix.listBytes(leftKey), cellMatrix.listBytes(rightKey)) === 0))).map((viewPieces) => Buffer.from(cellMatrix.listBytes(viewPieces.view.a.header)).toString("latin1"));
}

/** One claim as one sentence in the four-slot shape, its verb from the judge's ruling; a refuted claim has no verb in the closed list and is refused. */
function writeSentence(judgedTables: Judged, claimItem: Claim, wordText: string): string {
  const namesText = `${readName(judgedTables, "A", judgedTables.partA, claimItem.a)} and ${readName(judgedTables, "B", judgedTables.partB, claimItem.b)}`;
  const agreeList = listAgreeing(judgedTables, claimItem);
  const fieldsText = agreeList.length > 0 ? agreeList.join("+") : "no field";
  const priceText = `chance ${priceAcross(judgedTables.priced, claimItem.a, claimItem.b).chance.toPrecision(3)} against the judge's bar ${judgedTables.chanceBar.toPrecision(3)}`;
  if (wordText === "right") return `${namesText} are one: ${fieldsText} agree, ${priceText}; refuted if a judge-right pair holds exactly one of these two records.`;
  if (wordText === "unknown") return `${namesText}: can't tell. Measured: ${fieldsText} agree, ${priceText}. Decided by: a chance at or under that bar.`;
  throw new Error(`demo REFUSED: ruling ${wordText} on ${namesText} has no verb in the closed list`);
}

/** One pair of tables judged forward and with every row reversed: the rulings, the sentences sorted by content, and whether the reversed run writes the same sentences. */
function measureTable(bytesA: Uint8Array, bytesB: Uint8Array): Shown {
  const judgedTables = judgeTables(bytesA, bytesB);
  const claimRulings = judgeClaims(judgedTables);
  const backwardTables = judgeTables(constructReversed(bytesA, listRows(bytesA).rows), constructReversed(bytesB, listRows(bytesB).rows));
  const backwardRulings = judgeClaims(backwardTables);
  const sentenceList = judgedTables.claims.map((claimItem, claimAt) => writeSentence(judgedTables, claimItem, findItem(claimRulings.words, claimAt)));
  const backwardList = backwardTables.claims.map((claimItem, claimAt) => writeSentence(backwardTables, claimItem, findItem(backwardRulings.words, claimAt)));
  return { judged: judgedTables, rulings: claimRulings, sentences: [...sentenceList].sort(), orderSame: countDifference(sentenceList, backwardList) === 0 };
}

const startedAt = Date.now();
if (process.argv.length < 3) throw new Error("demo REFUSED: no tests directory given; run `npm run demo -- tests` (the tracked fixture) or name a directory in the README's layout");
const testsDir = findItem(process.argv, 2);
/** The tracked fixture: 60 invented customers in A; B holds their 60 copies plus 60 different invented customers. The judge is measured against the pairs inside the tables, so B carries non-matching records on purpose; a B of copies alone yields all-unknown by construction (measured 2026-11-07). */
const [ownA, ownB] = readTables(testsDir, "positive/own_copy/tableA.csv", "positive/own_copy/tableB.csv");
const ownChimera = constructChimera(ownA, 2);
const ownShown = measureTable(ownA, ownB);
const ownChimeraShown = measureTable(ownChimera.a, ownChimera.b);
const shownList = [{ tableName: "own_copy", tableShown: ownShown }, { tableName: "own chimera", tableShown: ownChimeraShown }];
const fodorsPresent = readdirSync(testsDir).includes("unlabeled") && readdirSync(`${testsDir}/unlabeled`).includes("fodors_zagat");
let fodorsShownList: Shown[] = [];
if (fodorsPresent) {
  const [fodorsA, fodorsB] = readTables(testsDir, "unlabeled/fodors_zagat/tableA.csv", "unlabeled/fodors_zagat/tableB.csv");
  const fodorsChimera = constructChimera(fodorsA, 2);
  fodorsShownList = [measureTable(fodorsA, fodorsB), measureTable(fodorsChimera.a, fodorsChimera.b)];
  shownList.push({ tableName: "fodors_zagat", tableShown: findItem(fodorsShownList, 0) }, { tableName: "fodors chimera", tableShown: findItem(fodorsShownList, 1) });
}
console.log("Healix says two records from different tables are one entity, found from the data alone; every number below is measured on this run.");
console.log("");
for (const shownItem of shownList) console.log(`${shownItem.tableName}: the product claims ${shownItem.tableShown.judged.claims.length} pairs; the judge rules ${shownItem.tableShown.rulings.right} right, ${shownItem.tableShown.rulings.unknown} unknown, ${shownItem.tableShown.rulings.refuted} refuted.`);
console.log("\nFive claims the judge confirms (own_copy, where every copy was built):");
for (const sentenceText of ownShown.sentences.filter((lineText) => lineText.includes(" are one: ")).slice(0, 5)) console.log(`  ${sentenceText}`);
console.log(`\nThe own chimera, records stitched from fields of different rows (wrong unless those rows were one entity): the product claimed ${ownChimeraShown.judged.claims.length}, the judge called ${ownChimeraShown.rulings.right} right.`);
if (fodorsPresent) {
  const fodorsShown = findItem(fodorsShownList, 0); const chimeraShown = findItem(fodorsShownList, 1);
  console.log("\nThree claims the judge cannot decide (fodors_zagat):");
  for (const sentenceText of fodorsShown.sentences.filter((lineText) => lineText.includes(": can't tell.")).slice(0, 3)) console.log(`  ${sentenceText}`);
  console.log(`\nThe fodors chimera, records stitched from fields of different rows (wrong unless those rows were one entity): the product claimed ${chimeraShown.judged.claims.length}, the judge called ${chimeraShown.rulings.right} right.`);
}
/** Every proposed pair and its ruling, machine-readable, for scripts/check.ts: the screen above shows five; the file holds all. */
const pairLines: string[] = ["table\ta\tb\truling"];
for (const shownItem of shownList) shownItem.tableShown.judged.claims.forEach((claimItem, claimAt) => pairLines.push(`${shownItem.tableName}\t${readName(shownItem.tableShown.judged, "A", shownItem.tableShown.judged.partA, claimItem.a)}\t${readName(shownItem.tableShown.judged, "B", shownItem.tableShown.judged.partB, claimItem.b)}\t${findItem(shownItem.tableShown.rulings.words, claimAt)}`));
mkdirSync("out", { recursive: true }); writeFileSync("out/demo_pairs.tsv", pairLines.join("\n") + "\n");
console.log(`\nEvery proposed pair with its ruling: out/demo_pairs.tsv (${pairLines.length - 1} rows).`);
console.log(`\nRows reversed, same sentences: ${shownList.map((shownItem) => `${shownItem.tableName} ${shownItem.tableShown.orderSame ? "yes" : "no"}`).join(", ")}.`);
console.log(`Ran in ${((Date.now() - startedAt) / 1000).toFixed(2)} s.`);
