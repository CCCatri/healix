/** viewsLaw pieces. Wrapper law: a byte that begins and ends every value it is in, two or more occurrences per such value. Cut door, three-way: yes where a byte is never at an edge of an unwrapped value in any view of the segment and the chance of that clears 1/(places+1); unknown (shy) where interior but not beyond chance; no where at an edge. All counted from the values alone. Runs: every piece held by two or more records, with the records holding it — the data both judge and product read. Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, compareContent, judgeEvidence } from "./matrix.ts";
import type { View, Views } from "./view.ts";

const byteSpan = 256;

type EdgeCounts = {
  readonly presence: Int32Array;
  readonly occurrences: Int32Array;
  readonly starts: Int32Array;
  readonly ends: Int32Array;
  /** sum over values of log of the chance the byte's occurrences avoid both ends: (len-n)(len-n-1) / (len(len-1)) */
  readonly logChance: Float64Array;
};

function countEdges(valueList: readonly Uint8Array[]): EdgeCounts {
  const presence = new Int32Array(byteSpan);
  const occurrences = new Int32Array(byteSpan);
  const starts = new Int32Array(byteSpan);
  const ends = new Int32Array(byteSpan);
  const logChance = new Float64Array(byteSpan);
  const perValue = new Int32Array(byteSpan);
  for (const valueBytes of valueList) {
    perValue.fill(0);
    for (const byteValue of valueBytes) perValue[byteValue] = findSlot(perValue, byteValue) + 1;
    const valueLength = valueBytes.length;
    if (valueLength > 0) {
      const firstByte = findSlot(valueBytes, 0);
      const lastByte = findSlot(valueBytes, valueLength - 1);
      starts[firstByte] = findSlot(starts, firstByte) + 1;
      ends[lastByte] = findSlot(ends, lastByte) + 1;
    }
    perValue.forEach((heldCount, byteValue) => {
      if (heldCount > 0) {
        presence[byteValue] = findSlot(presence, byteValue) + 1;
        occurrences[byteValue] = findSlot(occurrences, byteValue) + heldCount;
        const edgeChance = valueLength >= 2 ? Math.log(((valueLength - heldCount) * (valueLength - heldCount - 1)) / (valueLength * (valueLength - 1))) : 0;
        logChance[byteValue] = findSlot(logChance, byteValue) + edgeChance;
      }
    });
  }
  return { presence, occurrences, starts, ends, logChance };
}

export function judgeWrappers(matrix: Matrix, view: View): Key {
  const edgeCounts = countEdges([...view.a.values, ...view.b.values].map((valueKey) => matrix.listBytes(valueKey)));
  const wrapperBytes: number[] = [];
  edgeCounts.presence.forEach((presentCount, byteValue) => {
    if (presentCount > 0 && findSlot(edgeCounts.starts, byteValue) === presentCount && findSlot(edgeCounts.ends, byteValue) === presentCount && findSlot(edgeCounts.occurrences, byteValue) >= 2 * presentCount) wrapperBytes.push(byteValue);
  });
  return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [wrapperBytes.length], census: [] }, view.a.header), [view.a.header], wrapperBytes);
}

/** The value inside its wrapper, or the value itself where no wrapper encloses it. */
export function findInterior(valueBytes: Uint8Array, wrapperBytes: readonly number[]): Uint8Array {
  if (valueBytes.length < 2) return valueBytes;
  const firstByte = findSlot(valueBytes, 0);
  const lastByte = findSlot(valueBytes, valueBytes.length - 1);
  return firstByte === lastByte && wrapperBytes.includes(firstByte) ? valueBytes.subarray(1, valueBytes.length - 1) : valueBytes;
}

export type Cuts = { readonly cuts: Key; readonly shy: Key };

export function judgeCuts(matrix: Matrix, views: Views, wrapperCells: readonly Key[]): Cuts {
  const viewsPresent = new Int32Array(byteSpan);
  const viewsInterior = new Int32Array(byteSpan);
  const logChance = new Float64Array(byteSpan);
  views.views.forEach((view, viewAt) => {
    const wrapperBytes = matrix.listCell(findItem(wrapperCells, viewAt)).numbers;
    const edgeCounts = countEdges([...view.a.values, ...view.b.values].map((valueKey) => findInterior(matrix.listBytes(valueKey), wrapperBytes)));
    edgeCounts.presence.forEach((presentCount, byteValue) => {
      if (presentCount > 1) {
        viewsPresent[byteValue] = findSlot(viewsPresent, byteValue) + 1;
        logChance[byteValue] = findSlot(logChance, byteValue) + findSlot(edgeCounts.logChance, byteValue);
        if (findSlot(edgeCounts.starts, byteValue) === 0 && findSlot(edgeCounts.ends, byteValue) === 0) viewsInterior[byteValue] = findSlot(viewsInterior, byteValue) + 1;
      }
    });
  });
  let placeCount = 0;
  viewsPresent.forEach((presentViews) => { if (presentViews > 0) placeCount += 1; });
  const chanceBar = -Math.log(placeCount + 1);
  const cutBytes: number[] = [];
  const shyBytes: number[] = [];
  viewsPresent.forEach((presentViews, byteValue) => {
    if (presentViews > 0 && findSlot(viewsInterior, byteValue) === presentViews) { if (findSlot(logChance, byteValue) <= chanceBar) cutBytes.push(byteValue); else shyBytes.push(byteValue); }
  });
  const cutCell = matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [cutBytes.length], census: [] }, findItem(wrapperCells, 0)), wrapperCells, [placeCount, ...cutBytes]);
  const shyCell = matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [] }, cutCell), wrapperCells, shyBytes);
  return { cuts: cutCell, shy: shyCell };
}

export type Pieces = { readonly view: View; readonly a: readonly (readonly Key[])[]; readonly b: readonly (readonly Key[])[] };

export function writePieces(matrix: Matrix, view: View, wrapperBytes: readonly number[], cutBytes: readonly number[]): Pieces {
  const cutValue = (valueKey: Key): Key[] => {
    const interiorBytes = findInterior(matrix.listBytes(valueKey), wrapperBytes);
    const pieceKeys: Key[] = [];
    let pieceStart = 0;
    for (let byteAt = 0; byteAt <= interiorBytes.length; byteAt += 1) {
      const atEnd = byteAt === interiorBytes.length;
      if (atEnd || cutBytes.includes(findSlot(interiorBytes, byteAt))) {
        if (byteAt > pieceStart) pieceKeys.push(matrix.writeBytes(interiorBytes.subarray(pieceStart, byteAt)));
        pieceStart = byteAt + 1;
      }
    }
    return pieceKeys;
  };
  return { view, a: view.a.values.map(cutValue), b: view.b.values.map(cutValue) };
}

export type Tag = { readonly key: Key; readonly part: number; readonly record: number };

/** Pieces as data: every piece held by two or more records, with the records (part, index) holding it. Shared by the judge and the product. */
export function listRuns(matrix: Matrix, pieces: Pieces): Tag[][] {
  const compareKeys = (leftKey: Key, rightKey: Key): number => compareContent(matrix, leftKey, rightKey);
  const taggedPieces: Tag[] = [];
  const tagPart = (pieceLists: readonly (readonly Key[])[], partIndex: number): void => pieceLists.forEach((pieceList, recordIndex) => {
    const sortedKeys = [...pieceList].sort(compareKeys);
    sortedKeys.forEach((pieceKey, sortedAt) => {
      const sameAsBefore = sortedAt > 0 && compareKeys(findItem(sortedKeys, sortedAt - 1), pieceKey) === 0;
      if (!sameAsBefore) taggedPieces.push({ key: pieceKey, part: partIndex, record: recordIndex });
    });
  });
  tagPart(pieces.a, 0);
  tagPart(pieces.b, 1);
  taggedPieces.sort((leftTag, rightTag) => { const byKey = compareKeys(leftTag.key, rightTag.key); if (byKey !== 0) return byKey; const byPart = leftTag.part - rightTag.part; return byPart !== 0 ? byPart : leftTag.record - rightTag.record; });
  const pieceRuns: Tag[][] = [];
  let runStart = 0;
  for (let tagAt = 1; tagAt <= taggedPieces.length; tagAt += 1) {
    const runEnds = tagAt === taggedPieces.length || compareKeys(findItem(taggedPieces, runStart).key, findItem(taggedPieces, tagAt).key) !== 0;
    if (runEnds) {
      if (tagAt - runStart >= 2) pieceRuns.push(taggedPieces.slice(runStart, tagAt));
      runStart = tagAt;
    }
  }
  return pieceRuns;
}
