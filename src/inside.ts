/** withinReading (diagnostic only). A pair inside a part is two records joined by a piece only they hold. WITHIN: two views are linked where their pairs inside, pooled over both parts, overlap beyond independence (hypergeometric upper tail clearing 1/(links measured + 1)); unknown where not beyond chance (reason: the first view's header) or where a view has no pairs. Groups are the transitive closure of yes links. Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, compareContent, judgeEvidence } from "./matrix.ts";
import type { View } from "./view.ts";
import type { Pieces } from "./piece.ts";

export type Inside = { readonly view: View; readonly a: readonly number[]; readonly b: readonly number[] };

type TaggedPiece = { readonly key: Key; readonly record: number };

/** Pairs of records in one part joined by a piece exactly two of them hold; a pair is the number first * records + second. */
export function listPairsInside(matrix: Matrix, pieceLists: readonly (readonly Key[])[]): number[] {
  const taggedPieces: TaggedPiece[] = [];
  pieceLists.forEach((pieceList, recordIndex) => {
    const sortedKeys = [...pieceList].sort((leftKey, rightKey) => compareContent(matrix, leftKey, rightKey));
    sortedKeys.forEach((pieceKey, sortedAt) => {
      const sameAsBefore = sortedAt > 0 && compareContent(matrix, findItem(sortedKeys, sortedAt - 1), pieceKey) === 0;
      if (!sameAsBefore) taggedPieces.push({ key: pieceKey, record: recordIndex });
    });
  });
  taggedPieces.sort((leftTag, rightTag) => { const byContent = compareContent(matrix, leftTag.key, rightTag.key); return byContent !== 0 ? byContent : leftTag.record - rightTag.record; });
  const pairList: number[] = [];
  const recordCount = pieceLists.length;
  let runStart = 0;
  for (let tagAt = 1; tagAt <= taggedPieces.length; tagAt += 1) {
    const runEnds = tagAt === taggedPieces.length || compareContent(matrix, findItem(taggedPieces, runStart).key, findItem(taggedPieces, tagAt).key) !== 0;
    if (runEnds) {
      if (tagAt - runStart === 2) pairList.push(findItem(taggedPieces, runStart).record * recordCount + findItem(taggedPieces, runStart + 1).record);
      runStart = tagAt;
    }
  }
  pairList.sort((leftPair, rightPair) => leftPair - rightPair);
  return pairList.filter((pairValue, pairAt) => pairAt === 0 || pairValue !== findSlot(pairList, pairAt - 1));
}

export function constructInside(matrix: Matrix, pieces: Pieces): Inside {
  return { view: pieces.view, a: listPairsInside(matrix, pieces.a), b: listPairsInside(matrix, pieces.b) };
}

function countShared(leftPairs: readonly number[], rightPairs: readonly number[]): number {
  let leftAt = 0;
  let rightAt = 0;
  let sharedCount = 0;
  while (leftAt < leftPairs.length && rightAt < rightPairs.length) {
    const leftValue = findSlot(leftPairs, leftAt);
    const rightValue = findSlot(rightPairs, rightAt);
    if (leftValue === rightValue) { sharedCount += 1; leftAt += 1; rightAt += 1; } else if (leftValue < rightValue) leftAt += 1; else rightAt += 1;
  }
  return sharedCount;
}

const lanczosTerms = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function countLogGamma(gammaArgument: number): number {
  if (gammaArgument < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * gammaArgument)) - countLogGamma(1 - gammaArgument);
  const shiftedArgument = gammaArgument - 1;
  let termSum = findSlot(lanczosTerms, 0);
  for (let termAt = 1; termAt < lanczosTerms.length; termAt += 1) termSum += findSlot(lanczosTerms, termAt) / (shiftedArgument + termAt);
  const tailBase = shiftedArgument + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (shiftedArgument + 0.5) * Math.log(tailBase) - tailBase + Math.log(termSum);
}

function countLogChoose(totalCount: number, chosenCount: number): number {
  return countLogGamma(totalCount + 1) - countLogGamma(chosenCount + 1) - countLogGamma(totalCount - chosenCount + 1);
}

/** P(overlap >= observed) drawing |right| pairs from the total with |left| marked. */
export function countUpperTail(totalPairs: number, leftCount: number, rightCount: number, observedCount: number): number {
  const topOverlap = Math.min(leftCount, rightCount);
  const logAll = countLogChoose(totalPairs, rightCount);
  let logSum = Number.NEGATIVE_INFINITY;
  for (let overlapCount = observedCount; overlapCount <= topOverlap; overlapCount += 1) {
    if (rightCount - overlapCount > totalPairs - leftCount) continue;
    const logTerm = countLogChoose(leftCount, overlapCount) + countLogChoose(totalPairs - leftCount, rightCount - overlapCount) - logAll;
    if (logSum !== Number.NEGATIVE_INFINITY && logTerm < logSum - 745) break;
    logSum = logSum === Number.NEGATIVE_INFINITY ? logTerm : logSum + Math.log1p(Math.exp(logTerm - logSum));
  }
  return Math.min(1, Math.exp(logSum));
}

export function judgeLink(matrix: Matrix, leftInside: Inside, rightInside: Inside, recordsA: number, recordsB: number, chanceBar: number): Key {
  const totalPairs = (recordsA * (recordsA - 1)) / 2 + (recordsB * (recordsB - 1)) / 2;
  const leftCount = leftInside.a.length + leftInside.b.length;
  const rightCount = rightInside.a.length + rightInside.b.length;
  const readKeys = [leftInside.view.a.header, rightInside.view.a.header];
  if (leftCount === 0) return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [] }, leftInside.view.a.header), readKeys, [0, 0, 1, totalPairs, leftCount, rightCount]);
  if (rightCount === 0) return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [] }, rightInside.view.a.header), readKeys, [0, 0, 1, totalPairs, leftCount, rightCount]);
  const observedCount = countShared(leftInside.a, rightInside.a) + countShared(leftInside.b, rightInside.b);
  const expectedCount = (leftCount * rightCount) / totalPairs;
  const upperTail = countUpperTail(totalPairs, leftCount, rightCount, observedCount);
  return matrix.writeCell(judgeEvidence({ toward: [{ chance: upperTail, bar: chanceBar }], against: [], found: [], census: [] }, leftInside.view.a.header), readKeys, [observedCount, expectedCount, upperTail, totalPairs, leftCount, rightCount]);
}

export type Groups = { readonly links: readonly Key[]; readonly group: readonly number[]; readonly bar: number };

export function groupViews(matrix: Matrix, insideList: readonly Inside[], recordsA: number, recordsB: number): Groups {
  let measuredCount = 0;
  insideList.forEach((leftInside, leftAt) => insideList.forEach((rightInside, rightAt) => {
    if (rightAt > leftAt && leftInside.a.length + leftInside.b.length > 0 && rightInside.a.length + rightInside.b.length > 0) measuredCount += 1;
  }));
  const chanceBar = 1 / (measuredCount + 1);
  const groupRoot = insideList.map((_, insideAt) => insideAt);
  const findRoot = (insideAt: number): number => { let rootAt = insideAt; for (;;) { const nextRoot = findSlot(groupRoot, rootAt); if (nextRoot === rootAt) return rootAt; rootAt = nextRoot; } };
  const linkCells: Key[] = [];
  insideList.forEach((leftInside, leftAt) => insideList.forEach((rightInside, rightAt) => {
    if (rightAt <= leftAt) return;
    const linkCell = judgeLink(matrix, leftInside, rightInside, recordsA, recordsB, chanceBar);
    linkCells.push(linkCell);
    matrix.judgeWay(linkCell, () => { groupRoot[findRoot(rightAt)] = findRoot(leftAt); }, () => undefined, () => undefined);
  }));
  return { links: linkCells, group: insideList.map((_, insideAt) => findRoot(insideAt)), bar: chanceBar };
}
