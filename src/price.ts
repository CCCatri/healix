/** rankPrice + cutDoor + refutationRule + disagreementPricing, single-group set law (owner, 2026-10-16). Per measured view, every pair a shared piece touches is counted, inside (both parts) and across; pairs no piece touches score 0 and are never visited (cost rule): inside they are ranked as `insideZeros` zeros. insideWall (identity): an inside pair whose records hold identical pieces in every view less numbering is one record written twice and leaves the rank population (`insideSame`). Agreement: a view's shared count weighs -log((pairs inside sharing at least that count + 1) / (inside + 1)). disagreementPricing disagreement: a touched pair's unshared count (|a| + |b| - 2 shared) weighs -log((touched pairs inside with unshared at most that + 1) / (inside + 1)) — disagreeing little is evidence, priced like agreeing much, never automatic refutation. The weights over all measured views sum to one score. A pair across is ranked as one more draw among the pairs inside; chance = (rank + 1) / (inside + 1); yes where chance <= 1 / (across + 1), unknown otherwise (waiting on the segment's floor cell). No comes only from refutationRule. Closed: a product over view groups (c2_same 70 right, control 2 of 266); the share law (dirty exact copies 80 -> 0). Doctrine: no sentinel, no shorthand, no alias, no cast, no string; the one guard left is the first-touch flag per slot. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, judgeEvidence } from "./matrix.ts";
import type { Pieces } from "./piece.ts";
import { listRuns } from "./piece.ts";
import { countDistinct } from "./view.ts";

export type Priced = {
  readonly views: readonly number[];
  /** scores of the pairs inside some piece touched, sorted ascending */
  readonly insideSorted: Float32Array;
  /** pairs inside no piece touched: ranked as zeros */
  readonly insideZeros: number;
  /** pairs inside identical in every view less numbering: one record twice; out of the population */
  readonly insideSame: number;
  readonly acrossScore: Float32Array;
  /** the pairs across some piece touched: the only pairs a right-pair pass visits */
  readonly touchedAcross: Int32Array;
  readonly inside: number; readonly across: number; readonly recordsA: number; readonly recordsB: number;
  /** piece-driven increments, inside and across (provisional: counted by the code doing the work) */
  readonly work: number;
  /** piece-driven increments of the identity pass (insideWall), counted apart from the scoring pass so neither is hidden */
  readonly workIdentity: number;
};

/** The slot arrays of one part: a pair of its records is the slot first * records + second. */
type PartSlots = {
  readonly recordCount: number;
  readonly sharedCount: Uint16Array;
  readonly touchFlag: Uint8Array;
  readonly identicalViews: Uint8Array;
  readonly insideScore: Float32Array;
  readonly touchedPairs: number[];
  readonly sizesPerView: number[][];
};
type WorkCount = { workTotal: number };
/** Weights for one view: by shared count, and by unshared count among touched pairs (unshared beyond the largest seen weighs as the whole touched population). */
type ViewWeights = { readonly agree: Float64Array; readonly disagree: Float64Array; readonly disagreeTail: number };

function constructPartSlots(recordCount: number): PartSlots {
  const slotCount = recordCount * recordCount;
  return { recordCount, sharedCount: new Uint16Array(slotCount), touchFlag: new Uint8Array(slotCount), identicalViews: new Uint8Array(slotCount), insideScore: new Float32Array(slotCount), touchedPairs: [], sizesPerView: [] };
}

/** Counts one more shared piece for a pair; a slot counted for the first time in this view joins the view's touched list (the first-touch guard). */
function countTouch(sharedCount: Uint16Array, viewTouched: number[], pairIndex: number, workCount: WorkCount): void {
  workCount.workTotal += 1;
  const countBefore = findSlot(sharedCount, pairIndex);
  if (countBefore === 0) viewTouched.push(pairIndex);
  sharedCount[pairIndex] = countBefore + 1;
}

/** Every pair inside a part that one run of a piece touches. */
function countRunInside(partSlots: PartSlots, runRecords: readonly number[], viewTouched: number[], workCount: WorkCount): void {
  for (let firstAt = 0; firstAt < runRecords.length; firstAt += 1) {
    for (let secondAt = firstAt + 1; secondAt < runRecords.length; secondAt += 1) {
      countTouch(partSlots.sharedCount, viewTouched, findSlot(runRecords, firstAt) * partSlots.recordCount + findSlot(runRecords, secondAt), workCount);
    }
  }
}

/** A pair's unshared pieces in a view: both records' pieces less the shared ones twice. */
function countDisagreement(sharedHere: number, sizeFirst: number, sizeSecond: number): number {
  return sizeFirst + sizeSecond - 2 * sharedHere;
}

/** insideWall marking for one view: a touched pair whose shared count equals both records' piece counts is identical in this view. Resets the view's counts. */
function markIdentical(partSlots: PartSlots, viewTouched: readonly number[], pieceSizes: readonly number[]): void {
  for (const pairIndex of viewTouched) {
    const firstRecord = Math.floor(pairIndex / partSlots.recordCount);
    const secondRecord = pairIndex % partSlots.recordCount;
    const sharedHere = findSlot(partSlots.sharedCount, pairIndex);
    if (sharedHere === findSlot(pieceSizes, firstRecord) && sharedHere === findSlot(pieceSizes, secondRecord)) partSlots.identicalViews[pairIndex] = findSlot(partSlots.identicalViews, pairIndex) + 1;
    partSlots.sharedCount[pairIndex] = 0;
  }
}

/** Weights for this view from the touched pairs inside of both parts. */
function constructWeights(partA: PartSlots, partB: PartSlots, viewA: readonly number[], viewB: readonly number[], sizesA: readonly number[], sizesB: readonly number[], pairsInside: number): ViewWeights {
  const countLimit = 65536;
  const sharedHistogram = new Float64Array(countLimit + 1);
  sharedHistogram[0] = pairsInside - viewA.length - viewB.length;
  const unsharedValues: number[] = [];
  let largestUnshared = 0;
  const tallyPart = (partSlots: PartSlots, viewTouched: readonly number[], pieceSizes: readonly number[]): void => {
    for (const pairIndex of viewTouched) {
      const sharedHere = findSlot(partSlots.sharedCount, pairIndex);
      sharedHistogram[sharedHere] = findSlot(sharedHistogram, sharedHere) + 1;
      const unsharedHere = countDisagreement(sharedHere, findSlot(pieceSizes, Math.floor(pairIndex / partSlots.recordCount)), findSlot(pieceSizes, pairIndex % partSlots.recordCount));
      unsharedValues.push(unsharedHere);
      if (unsharedHere > largestUnshared) largestUnshared = unsharedHere;
    }
  };
  tallyPart(partA, viewA, sizesA);
  tallyPart(partB, viewB, sizesB);
  const agree = new Float64Array(countLimit + 1);
  let atLeastCount = 0;
  for (let sharedCount = countLimit; sharedCount >= 0; sharedCount -= 1) { atLeastCount += findSlot(sharedHistogram, sharedCount); agree[sharedCount] = -Math.log((atLeastCount + 1) / (pairsInside + 1)); }
  const unsharedHistogram = new Float64Array(largestUnshared + 1);
  for (const unsharedHere of unsharedValues) unsharedHistogram[unsharedHere] = findSlot(unsharedHistogram, unsharedHere) + 1;
  const disagree = new Float64Array(largestUnshared + 1);
  let atMostCount = 0;
  for (let unsharedCount = 0; unsharedCount <= largestUnshared; unsharedCount += 1) { atMostCount += findSlot(unsharedHistogram, unsharedCount); disagree[unsharedCount] = -Math.log((atMostCount + 1) / (pairsInside + 1)); }
  return { agree, disagree, disagreeTail: -Math.log((unsharedValues.length + 1) / (pairsInside + 1)) };
}

function weighPair(viewWeights: ViewWeights, sharedHere: number, unsharedHere: number): number {
  const disagreeWeight = unsharedHere < viewWeights.disagree.length ? findSlot(viewWeights.disagree, unsharedHere) : viewWeights.disagreeTail;
  return findSlot(viewWeights.agree, sharedHere) + disagreeWeight;
}

/** Folds this view's weights into the part's scores and the part's union of touched pairs; resets the view's counts. */
function foldInside(partSlots: PartSlots, viewTouched: readonly number[], viewWeights: ViewWeights, pieceSizes: readonly number[]): void {
  for (const pairIndex of viewTouched) {
    const sharedHere = findSlot(partSlots.sharedCount, pairIndex);
    const unsharedHere = countDisagreement(sharedHere, findSlot(pieceSizes, Math.floor(pairIndex / partSlots.recordCount)), findSlot(pieceSizes, pairIndex % partSlots.recordCount));
    partSlots.insideScore[pairIndex] = findSlot(partSlots.insideScore, pairIndex) + weighPair(viewWeights, sharedHere, unsharedHere);
    partSlots.sharedCount[pairIndex] = 0;
    if (findSlot(partSlots.touchFlag, pairIndex) === 0) { partSlots.touchFlag[pairIndex] = 1; partSlots.touchedPairs.push(pairIndex); }
  }
}

/** insideWall: a pair is one record twice where it is identical in every view, counting views where both records hold no pieces. */
function judgeIdentical(partSlots: PartSlots, pairIndex: number, viewCount: number): boolean {
  const firstRecord = Math.floor(pairIndex / partSlots.recordCount);
  const secondRecord = pairIndex % partSlots.recordCount;
  let emptyBoth = 0;
  for (const pieceSizes of partSlots.sizesPerView) if (findSlot(pieceSizes, firstRecord) === 0 && findSlot(pieceSizes, secondRecord) === 0) emptyBoth += 1;
  return findSlot(partSlots.identicalViews, pairIndex) + emptyBoth === viewCount;
}

export function priceSegment(matrix: Matrix, piecesPerView: readonly Pieces[], views: readonly number[], recordsA: number, recordsB: number): Priced {
  const pairsInside = (recordsA * (recordsA - 1)) / 2 + (recordsB * (recordsB - 1)) / 2;
  const pairsAcross = recordsA * recordsB;
  const partA = constructPartSlots(recordsA);
  const partB = constructPartSlots(recordsB);
  const acrossShared = new Uint16Array(pairsAcross);
  const acrossFlag = new Uint8Array(pairsAcross);
  const acrossScore = new Float32Array(pairsAcross);
  const acrossTouched: number[] = [];
  const workCount: WorkCount = { workTotal: 0 };
  const identityCount: WorkCount = { workTotal: 0 };
  const countPieces = (pieceList: readonly Key[]): number => countDistinct(matrix, pieceList);

  for (const viewPieces of piecesPerView) {
    const sizesA = viewPieces.a.map(countPieces); const sizesB = viewPieces.b.map(countPieces);
    partA.sizesPerView.push(sizesA); partB.sizesPerView.push(sizesB);
    const viewTouchedA: number[] = []; const viewTouchedB: number[] = [];
    for (const pieceRun of listRuns(matrix, viewPieces)) {
      countRunInside(partA, pieceRun.filter((runTag) => runTag.part === 0).map((runTag) => runTag.record), viewTouchedA, identityCount);
      countRunInside(partB, pieceRun.filter((runTag) => runTag.part === 1).map((runTag) => runTag.record), viewTouchedB, identityCount);
    }
    markIdentical(partA, viewTouchedA, sizesA);
    markIdentical(partB, viewTouchedB, sizesB);
  }

  for (const viewIndex of views) {
    const viewPieces = findItem(piecesPerView, viewIndex);
    const sizesA = findItem(partA.sizesPerView, viewIndex); const sizesB = findItem(partB.sizesPerView, viewIndex);
    const viewTouchedA: number[] = []; const viewTouchedB: number[] = []; const viewTouchedX: number[] = [];
    for (const pieceRun of listRuns(matrix, viewPieces)) {
      const runRecordsA = pieceRun.filter((runTag) => runTag.part === 0).map((runTag) => runTag.record);
      const runRecordsB = pieceRun.filter((runTag) => runTag.part === 1).map((runTag) => runTag.record);
      countRunInside(partA, runRecordsA, viewTouchedA, workCount);
      countRunInside(partB, runRecordsB, viewTouchedB, workCount);
      for (const recordA of runRecordsA) for (const recordB of runRecordsB) countTouch(acrossShared, viewTouchedX, recordA * recordsB + recordB, workCount);
    }
    const viewWeights = constructWeights(partA, partB, viewTouchedA, viewTouchedB, sizesA, sizesB, pairsInside);
    foldInside(partA, viewTouchedA, viewWeights, sizesA);
    foldInside(partB, viewTouchedB, viewWeights, sizesB);
    for (const pairIndex of viewTouchedX) {
      const sharedHere = findSlot(acrossShared, pairIndex);
      const unsharedHere = countDisagreement(sharedHere, findSlot(sizesA, Math.floor(pairIndex / recordsB)), findSlot(sizesB, pairIndex % recordsB));
      acrossScore[pairIndex] = findSlot(acrossScore, pairIndex) + weighPair(viewWeights, sharedHere, unsharedHere);
      acrossShared[pairIndex] = 0;
      if (findSlot(acrossFlag, pairIndex) === 0) { acrossFlag[pairIndex] = 1; acrossTouched.push(pairIndex); }
    }
  }

  const keptA = partA.touchedPairs.filter((pairIndex) => !judgeIdentical(partA, pairIndex, piecesPerView.length));
  const keptB = partB.touchedPairs.filter((pairIndex) => !judgeIdentical(partB, pairIndex, piecesPerView.length));
  const insideSame = partA.touchedPairs.length - keptA.length + (partB.touchedPairs.length - keptB.length);
  const insideSorted = new Float32Array(keptA.length + keptB.length);
  keptA.forEach((pairIndex, sortedAt) => { insideSorted[sortedAt] = findSlot(partA.insideScore, pairIndex); });
  keptB.forEach((pairIndex, sortedAt) => { insideSorted[keptA.length + sortedAt] = findSlot(partB.insideScore, pairIndex); });
  insideSorted.sort();
  const population = pairsInside - insideSame;
  return { views, insideSorted, insideZeros: population - insideSorted.length, insideSame, acrossScore, touchedAcross: Int32Array.from(acrossTouched), inside: population, across: pairsAcross, recordsA, recordsB, work: workCount.workTotal, workIdentity: identityCount.workTotal };
}

function countAtLeast(sortedScores: Float32Array, scoreValue: number): number {
  let lowBound = 0;
  let highBound = sortedScores.length;
  while (lowBound < highBound) { const midBound = (lowBound + highBound) >>> 1; if (findSlot(sortedScores, midBound) < scoreValue) lowBound = midBound + 1; else highBound = midBound; }
  return sortedScores.length - lowBound;
}

export type Price = { readonly chance: number; readonly rank: number };

export function priceAcross(priced: Priced, recordA: number, recordB: number): Price {
  const scoreValue = findSlot(priced.acrossScore, recordA * priced.recordsB + recordB);
  const zeroRank = scoreValue > 0 ? 0 : priced.insideZeros;
  const rankValue = countAtLeast(priced.insideSorted, scoreValue) + zeroRank;
  return { chance: (rankValue + 1) / (priced.inside + 1), rank: rankValue };
}

/** The segment's floor cell: numbers [inside, across, floor, bar]; yes where a rank-0 pair can be right here, no where the floor sits above the bar (c2_same, by arithmetic). */
export function constructFloor(matrix: Matrix, priced: Priced, readKeys: readonly Key[]): Key {
  const floorChance = 1 / (priced.inside + 1);
  const chanceBar = 1 / (priced.across + 1);
  return matrix.writeCell(judgeEvidence({ toward: [{ chance: floorChance, bar: chanceBar }], against: [{ chance: chanceBar, bar: floorChance }], found: [], census: [] }, findItem(readKeys, 0)), readKeys, [priced.inside, priced.across, floorChance, chanceBar]);
}

/** cutDoor door on one pair across: yes, or unknown waiting on the floor cell. Cell numbers: [a, b, chance, bar, rank]. */
export function judgePair(matrix: Matrix, priced: Priced, floorCell: Key, recordA: number, recordB: number, readKeys: readonly Key[]): Key {
  const pairPrice = priceAcross(priced, recordA, recordB);
  const chanceBar = 1 / (priced.across + 1);
  return matrix.writeCell(judgeEvidence({ toward: [{ chance: pairPrice.chance, bar: chanceBar }], against: [], found: [], census: [] }, floorCell), readKeys, [recordA, recordB, pairPrice.chance, chanceBar, pairPrice.rank]);
}

/** refutationRule: a right pair is refuted where either record holds another right pair. The only no. */
export function refutePair(matrix: Matrix, pairCell: Key, otherRightCell: Key): Key {
  return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [1] }, pairCell), [pairCell, otherRightCell], matrix.listCell(pairCell).numbers);
}
