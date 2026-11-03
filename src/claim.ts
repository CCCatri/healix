/** The product. A pair across is claimed where each record is the other's unique best by pieces shared, summed over the product's views (viewsLaw, every view whose numbering cell reads no); a best is chosen only among the pairs a shared piece touched (a pair sharing nothing has no evidence and cannot be best). No number of the judge's enters here. One cell per claim: numbers [a, b, shared]. Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, judgeEvidence } from "./matrix.ts";
import type { Pieces } from "./piece.ts";
import { listRuns } from "./piece.ts";

export type Claim = { readonly a: number; readonly b: number; readonly shared: number; readonly cell: Key };
export type Claims = { readonly claims: readonly Claim[]; readonly tiesA: number; readonly tiesB: number; readonly unsharedA: number; readonly unsharedB: number; readonly work: number };

/** One side's best partners: the top shared count (0 = no piece shared with anyone), the partner holding it, and whether a second partner ties it. */
type BestSide = { readonly topShared: Uint16Array; readonly bestPartner: Int32Array; readonly tieFlag: Uint8Array };

function constructBestSide(recordCount: number): BestSide {
  return { topShared: new Uint16Array(recordCount), bestPartner: new Int32Array(recordCount), tieFlag: new Uint8Array(recordCount) };
}

function countBest(bestSide: BestSide, recordIndex: number, partnerIndex: number, sharedPieces: number): void {
  const topBefore = findSlot(bestSide.topShared, recordIndex);
  if (sharedPieces > topBefore) { bestSide.topShared[recordIndex] = sharedPieces; bestSide.bestPartner[recordIndex] = partnerIndex; bestSide.tieFlag[recordIndex] = 0; }
  else if (sharedPieces === topBefore) bestSide.tieFlag[recordIndex] = 1;
}

function countTies(bestSide: BestSide): number {
  let tieCount = 0;
  bestSide.tieFlag.forEach((tieValue, recordIndex) => { if (tieValue === 1 && findSlot(bestSide.topShared, recordIndex) > 0) tieCount += 1; });
  return tieCount;
}

function countUnshared(bestSide: BestSide): number {
  let unsharedCount = 0;
  bestSide.topShared.forEach((topValue) => { if (topValue === 0) unsharedCount += 1; });
  return unsharedCount;
}

export function constructClaims(matrix: Matrix, piecesPerView: readonly Pieces[], views: readonly number[], recordsA: readonly Key[], recordsB: readonly Key[]): Claims {
  const countA = recordsA.length;
  const countB = recordsB.length;
  const sharedCount = new Uint16Array(countA * countB);
  const touchedPairs: number[] = [];
  let workTotal = 0;
  for (const viewIndex of views) {
    for (const pieceRun of listRuns(matrix, findItem(piecesPerView, viewIndex))) {
      const runRecordsA = pieceRun.filter((runTag) => runTag.part === 0).map((runTag) => runTag.record);
      const runRecordsB = pieceRun.filter((runTag) => runTag.part === 1).map((runTag) => runTag.record);
      for (const recordA of runRecordsA) for (const recordB of runRecordsB) {
        workTotal += 1;
        const pairIndex = recordA * countB + recordB;
        const sharedBefore = findSlot(sharedCount, pairIndex);
        if (sharedBefore === 0) touchedPairs.push(pairIndex);
        sharedCount[pairIndex] = sharedBefore + 1;
      }
    }
  }
  const sideA = constructBestSide(countA);
  const sideB = constructBestSide(countB);
  for (const pairIndex of touchedPairs) {
    const recordA = Math.floor(pairIndex / countB);
    const recordB = pairIndex % countB;
    const sharedPieces = findSlot(sharedCount, pairIndex);
    countBest(sideA, recordA, recordB, sharedPieces);
    countBest(sideB, recordB, recordA, sharedPieces);
  }
  const claims: Claim[] = [];
  for (let recordA = 0; recordA < countA; recordA += 1) {
    const uniqueBestA = findSlot(sideA.topShared, recordA) > 0 && findSlot(sideA.tieFlag, recordA) === 0;
    if (!uniqueBestA) continue;
    const recordB = findSlot(sideA.bestPartner, recordA);
    const uniqueBestB = findSlot(sideB.topShared, recordB) > 0 && findSlot(sideB.tieFlag, recordB) === 0 && findSlot(sideB.bestPartner, recordB) === recordA;
    if (!uniqueBestB) continue;
    const sharedPieces = findSlot(sharedCount, recordA * countB + recordB);
    const recordKeyA = findItem(recordsA, recordA);
    const recordKeyB = findItem(recordsB, recordB);
    claims.push({ a: recordA, b: recordB, shared: sharedPieces, cell: matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [sharedPieces], census: [] }, recordKeyA), [recordKeyA, recordKeyB], [recordA, recordB, sharedPieces]) });
  }
  return { claims, tiesA: countTies(sideA), tiesB: countTies(sideB), unsharedA: countUnshared(sideA), unsharedB: countUnshared(sideB), work: workTotal };
}
