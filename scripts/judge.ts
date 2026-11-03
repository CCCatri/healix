/** The judge's pipeline and the product's claims over it, moved whole from run.ts so the runner (run.ts) and the demonstration (demo.ts) read one producer: bytes to records, views and pieces (constructPieces); the product's claims and the judge's right pairs (judgeTables); the refutation rule on each claim, each claim's ruling kept in claim order (judgeClaims); the answers of two runs of the same tables compared (compareAnswers). */
import type { Key } from "../src/matrix.ts";
import { Matrix, findSlot, findItem } from "../src/matrix.ts";
import type { Part } from "../src/record.ts";
import { writeRecords, listFields } from "../src/record.ts";
import { constructViews } from "../src/view.ts";
import type { Views } from "../src/view.ts";
import { judgeWrappers, judgeCuts, writePieces } from "../src/piece.ts";
import type { Pieces } from "../src/piece.ts";
import { constructInside, groupViews } from "../src/inside.ts";
import type { Priced } from "../src/price.ts";
import { priceSegment, priceAcross, constructFloor, judgePair, refutePair } from "../src/price.ts";
import type { Claim } from "../src/claim.ts";
import { constructClaims } from "../src/claim.ts";
import { readField } from "../src/construction.ts";

export type PairAt = { readonly a: number; readonly b: number };
type RightPair = { readonly a: number; readonly b: number; readonly cell: Key };
export type Judged = { readonly cellMatrix: Matrix; readonly partA: Part; readonly partB: Part; readonly priced: Priced; readonly floorCell: Key; readonly chanceBar: number; readonly rightPairs: readonly RightPair[]; readonly rightKeys: ReadonlySet<string>; readonly claims: readonly Claim[]; readonly productWork: number; readonly productAll: ReturnType<typeof constructClaims>; readonly viewSet: Views; readonly piecesPerView: readonly Pieces[]; readonly numberingFields: readonly number[]; readonly groupNames: string; readonly viewGroups: readonly (readonly number[])[]; readonly linkCells: readonly Key[]; readonly linkBar: number; readonly reachable: boolean };

export type Rulings = { readonly right: number; readonly refuted: number; readonly unknown: number; readonly firedKeys: readonly string[]; readonly words: readonly string[] };

/** Two contents as one key. */
export function joinPair(leftText: string, rightText: string): string { return `${leftText}\u0001${rightText}`; }

/** A record's content. */
export function readRecord(cellMatrix: Matrix, recordPart: Part, recordAt: number): string { return Buffer.from(cellMatrix.listBytes(findItem(recordPart.records, recordAt))).toString("latin1"); }

/** A row's body: its decoded fields less the numbering fields. */
export function readBody(rowBytes: Uint8Array, numberingFields: readonly number[]): string {
  return [...listFields(rowBytes).keys()].filter((fieldAt) => !numberingFields.includes(fieldAt)).map((fieldAt) => Buffer.from(readField(rowBytes, fieldAt)).toString("latin1")).join("\u0002");
}

/** A row's decoded fields, in order or reversed back. */
function readValues(rowBytes: Uint8Array, isReversed: boolean): string {
  const valueList = [...listFields(rowBytes).keys()].map((fieldAt) => Buffer.from(readField(rowBytes, fieldAt)).toString("latin1"));
  return (isReversed ? valueList.reverse() : valueList).join("\u0002");
}

/** The one pipeline: bytes, records, views, pieces; the product's claims over every non-numbering view; the judge's price over the measured views. */
type Pieced = { readonly cellMatrix: Matrix; readonly partA: Part; readonly partB: Part; readonly viewSet: Views; readonly piecesPerView: Pieces[]; readonly numberingFields: number[] };

/** The pieces of two tables: records, views, wrappers, cuts, numbering, pieces per non-numbering view; the one producer of pieces, read by judgeTables and by every null. */
export function constructPieces(bytesA: Uint8Array, bytesB: Uint8Array): Pieced {
  const cellMatrix = new Matrix();
  const partA = writeRecords(cellMatrix, bytesA);
  const partB = writeRecords(cellMatrix, bytesB);
  const viewSet = constructViews(cellMatrix, partA, partB);
  const wrapperCells = viewSet.views.map((viewItem) => judgeWrappers(cellMatrix, viewItem));
  const cutBytes = cellMatrix.listCell(judgeCuts(cellMatrix, viewSet, wrapperCells).cuts).numbers.slice(1);
  const piecesPerView: Pieces[] = [];
  const numberingFields: number[] = [];
  viewSet.views.forEach((viewItem, viewAt) => cellMatrix.judgeWay(viewItem.numbering, () => { numberingFields.push(viewItem.index); }, () => { piecesPerView.push(writePieces(cellMatrix, viewItem, cellMatrix.listCell(findItem(wrapperCells, viewAt)).numbers, cutBytes)); }, () => undefined));
  return { cellMatrix, partA, partB, viewSet, piecesPerView, numberingFields };
}

export function judgeTables(bytesA: Uint8Array, bytesB: Uint8Array): Judged {
  const piecedTables = constructPieces(bytesA, bytesB);
  const cellMatrix = piecedTables.cellMatrix; const partA = piecedTables.partA; const partB = piecedTables.partB; const viewSet = piecedTables.viewSet; const piecesPerView = piecedTables.piecesPerView; const numberingFields = piecedTables.numberingFields;
  const productClaims = constructClaims(cellMatrix, piecesPerView, [...piecesPerView.keys()], partA.records, partB.records);
  const insideList = piecesPerView.map((viewPieces) => constructInside(cellMatrix, viewPieces));
  const measuredViews = [...insideList.keys()].filter((insideAt) => findItem(insideList, insideAt).a.length + findItem(insideList, insideAt).b.length > 0);
  const groupedViews = groupViews(cellMatrix, insideList, partA.records.length, partB.records.length);
  const viewGroups = [...new Set(groupedViews.group)].map((rootAt) => [...piecesPerView.keys()].filter((viewAt) => findSlot(groupedViews.group, viewAt) === rootAt));
  const groupNames = viewGroups.map((memberViews) => memberViews.map((viewAt) => Buffer.from(cellMatrix.listBytes(findItem(piecesPerView, viewAt).view.a.header)).toString("latin1")).join("+")).join(" | ");
  const pricedTables = priceSegment(cellMatrix, piecesPerView, measuredViews, partA.records.length, partB.records.length);
  const floorCell = constructFloor(cellMatrix, pricedTables, [partA.header, partB.header]);
  const chanceBar = 1 / (pricedTables.across + 1);
  const rightPairs: RightPair[] = [];
  for (const pairIndex of pricedTables.touchedAcross) {
    const recordA = Math.floor(pairIndex / partB.records.length); const recordB = pairIndex % partB.records.length;
    if (priceAcross(pricedTables, recordA, recordB).chance <= chanceBar) rightPairs.push({ a: recordA, b: recordB, cell: judgePair(cellMatrix, pricedTables, floorCell, recordA, recordB, [findItem(partA.records, recordA), findItem(partB.records, recordB)]) });
  }
  const rightKeys = new Set(rightPairs.map((rightPair) => joinPair(readRecord(cellMatrix, partA, rightPair.a), readRecord(cellMatrix, partB, rightPair.b))));
  return { cellMatrix, partA, partB, priced: pricedTables, floorCell, chanceBar, rightPairs, rightKeys, claims: productClaims.claims, productWork: productClaims.work, productAll: productClaims, viewSet, piecesPerView, numberingFields, groupNames, viewGroups, linkCells: groupedViews.links, linkBar: groupedViews.bar, reachable: pricedTables.inside >= pricedTables.across };
}

/** The refutation rule on the product's claims: refuted where a judge-right pair shares exactly one of the claim's records by content, else the judge's own verdict; firedKeys lists the refuted claims by body and content. */
export function judgeClaims(judgedTables: Judged): Rulings {
  const cellMatrix = judgedTables.cellMatrix;
  const rightTexts = judgedTables.rightPairs.map((rightPair) => ({ textA: readRecord(cellMatrix, judgedTables.partA, rightPair.a), textB: readRecord(cellMatrix, judgedTables.partB, rightPair.b), cell: rightPair.cell }));
  const firedKeys: string[] = [];
  const wordList: string[] = [];
  let rightCount = 0; let refutedCount = 0; let unknownCount = 0;
  for (const claimItem of judgedTables.claims) {
    const claimA = readRecord(cellMatrix, judgedTables.partA, claimItem.a); const claimB = readRecord(cellMatrix, judgedTables.partB, claimItem.b);
    const verdictCell = judgePair(cellMatrix, judgedTables.priced, judgedTables.floorCell, claimItem.a, claimItem.b, [claimItem.cell]);
    const otherRights = rightTexts.filter((rightText) => (rightText.textA === claimA) !== (rightText.textB === claimB));
    if (otherRights.length > 0) { refutePair(cellMatrix, verdictCell, findItem(otherRights, 0).cell); refutedCount += 1; firedKeys.push(joinPair(readBody(cellMatrix.listBytes(findItem(judgedTables.partA.records, claimItem.a)), judgedTables.numberingFields), claimB)); wordList.push("refuted"); continue; }
    cellMatrix.judgeWay(verdictCell, () => { rightCount += 1; wordList.push("right"); }, () => { refutedCount += 1; wordList.push("refuted"); }, () => { unknownCount += 1; wordList.push("unknown"); });
  }
  return { right: rightCount, refuted: refutedCount, unknown: unknownCount, firedKeys, words: wordList };
}

/** The size of the difference between two answer lists, each answer counted as often as it appears. */
export function countDifference(leftList: readonly string[], rightList: readonly string[]): number {
  const leftSorted = [...leftList].sort(); const rightSorted = [...rightList].sort();
  let leftAt = 0; let rightAt = 0; let differenceCount = 0;
  while (leftAt < leftSorted.length && rightAt < rightSorted.length) {
    const leftText = findItem(leftSorted, leftAt); const rightText = findItem(rightSorted, rightAt);
    if (leftText === rightText) { leftAt += 1; rightAt += 1; } else if (leftText < rightText) { differenceCount += 1; leftAt += 1; } else { differenceCount += 1; rightAt += 1; }
  }
  return differenceCount + (leftSorted.length - leftAt) + (rightSorted.length - rightAt);
}

/** Answers as A content then B content, read from either table order and either field order. */
function listAnswers(judgedTables: Judged, pairList: readonly PairAt[], isSwapped: boolean, isReversed: boolean): string[] {
  return pairList.map((pairItem) => {
    const textA = readValues(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partA.records, pairItem.a)), isReversed);
    const textB = readValues(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partB.records, pairItem.b)), isReversed);
    return isSwapped ? joinPair(textB, textA) : joinPair(textA, textB);
  });
}

/** Claims and right pairs of a forward run against another run of the same tables. */
export function compareAnswers(forwardTables: Judged, otherTables: Judged, isSwapped: boolean, isReversed: boolean, otherName: string): string {
  const forwardClaims = listAnswers(forwardTables, forwardTables.claims, false, false); const otherClaims = listAnswers(otherTables, otherTables.claims, isSwapped, isReversed);
  const forwardRight = listAnswers(forwardTables, forwardTables.rightPairs, false, false); const otherRight = listAnswers(otherTables, otherTables.rightPairs, isSwapped, isReversed);
  return `claims ${forwardClaims.length} ${otherName} ${otherClaims.length} mismatches ${countDifference(forwardClaims, otherClaims)} right ${forwardRight.length} ${otherName}Right ${otherRight.length} rightMismatches ${countDifference(forwardRight, otherRight)}`;
}
