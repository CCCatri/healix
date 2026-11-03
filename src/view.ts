/** viewsLaw: a view is a column both parts hold at the same position with the same header bytes; the numbering column is the view whose values are all digits and all distinct within each part. Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, compareContent, judgeEvidence } from "./matrix.ts";
import type { Part } from "./record.ts";
import { listFields, writeValue } from "./record.ts";

const digitLow = 0x30;
const digitHigh = 0x39;
const byteSpan = 256;

export type Column = { readonly header: Key; readonly values: readonly Key[]; readonly absent: number };
export type View = { readonly index: number; readonly a: Column; readonly b: Column; readonly numbering: Key };
export type Views = { readonly views: readonly View[]; readonly columnsA: number; readonly columnsB: number; readonly unaligned: number };

type ColumnValues = { readonly values: Key[][]; readonly absent: number[] };

function writeColumns(matrix: Matrix, part: Part, alignedColumns: readonly number[]): ColumnValues {
  const values: Key[][] = alignedColumns.map(() => []);
  const absent: number[] = alignedColumns.map(() => 0);
  for (const recordKey of part.records) {
    const recordBytes = matrix.listBytes(recordKey);
    const recordFields = listFields(recordBytes);
    alignedColumns.forEach((columnIndex, alignedAt) => {
      const fieldValue = recordFields[columnIndex];
      if (fieldValue === undefined) absent[alignedAt] = findSlot(absent, alignedAt) + 1;
      else findItem(values, alignedAt).push(writeValue(matrix, recordBytes, fieldValue));
    });
  }
  return { values, absent };
}

/** The one producer of "how many distinct contents" over a list of keys. */
export function countDistinct(matrix: Matrix, keyList: readonly Key[]): number {
  const sortedKeys = [...keyList].sort((leftKey, rightKey) => compareContent(matrix, leftKey, rightKey));
  let distinctCount = 0;
  sortedKeys.forEach((sortedKey, sortedAt) => {
    const sameAsBefore = sortedAt > 0 && compareContent(matrix, findItem(sortedKeys, sortedAt - 1), sortedKey) === 0;
    if (!sameAsBefore) distinctCount += 1;
  });
  return distinctCount;
}

export function countNonDigit(matrix: Matrix, keyList: readonly Key[]): number {
  let nonDigitCount = 0;
  for (const valueKey of keyList) {
    const valueBytes = matrix.listBytes(valueKey);
    if (valueBytes.length === 0 || valueBytes.some((byteValue) => byteValue < digitLow || byteValue > digitHigh)) nonDigitCount += 1;
  }
  return nonDigitCount;
}

/** One cell per view: evidence against numbering = non-digit values + repeated values; yes where none. numbers [distinctA, distinctB, nonDigitA, nonDigitB]. */
export function judgeNumbering(matrix: Matrix, columnA: Column, columnB: Column): Key {
  const distinctA = countDistinct(matrix, columnA.values);
  const distinctB = countDistinct(matrix, columnB.values);
  const nonDigitA = countNonDigit(matrix, columnA.values);
  const nonDigitB = countNonDigit(matrix, columnB.values);
  const evidenceAgainst = nonDigitA + nonDigitB + (columnA.values.length - distinctA) + (columnB.values.length - distinctB);
  return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [evidenceAgainst] }, columnA.header), [columnA.header, columnB.header], [distinctA, distinctB, nonDigitA, nonDigitB]);
}

export function constructViews(matrix: Matrix, partA: Part, partB: Part): Views {
  const headerBytesA = matrix.listBytes(partA.header);
  const headerBytesB = matrix.listBytes(partB.header);
  const headerFieldsA = listFields(headerBytesA);
  const headerFieldsB = listFields(headerBytesB);
  const alignedColumns: number[] = [];
  const headerKeys: Key[] = [];
  const sharedCount = Math.min(headerFieldsA.length, headerFieldsB.length);
  for (let columnIndex = 0; columnIndex < sharedCount; columnIndex += 1) {
    const fieldA = findItem(headerFieldsA, columnIndex);
    const fieldB = findItem(headerFieldsB, columnIndex);
    if (Buffer.compare(headerBytesA.subarray(fieldA.start, fieldA.end), headerBytesB.subarray(fieldB.start, fieldB.end)) === 0) {
      alignedColumns.push(columnIndex);
      headerKeys.push(writeValue(matrix, headerBytesA, fieldA));
    }
  }
  const columnsA = writeColumns(matrix, partA, alignedColumns);
  const columnsB = writeColumns(matrix, partB, alignedColumns);
  const views: View[] = alignedColumns.map((columnIndex, alignedAt) => {
    const headerKey = findItem(headerKeys, alignedAt);
    const columnA: Column = { header: headerKey, values: findItem(columnsA.values, alignedAt), absent: findSlot(columnsA.absent, alignedAt) };
    const columnB: Column = { header: headerKey, values: findItem(columnsB.values, alignedAt), absent: findSlot(columnsB.absent, alignedAt) };
    return { index: columnIndex, a: columnA, b: columnB, numbering: judgeNumbering(matrix, columnA, columnB) };
  });
  return { views, columnsA: headerFieldsA.length, columnsB: headerFieldsB.length, unaligned: Math.max(headerFieldsA.length, headerFieldsB.length) - alignedColumns.length };
}

/** How many values of a view hold each byte at least once; the numbers the cut law was read from. */
export function countPresence(matrix: Matrix, keyList: readonly Key[]): Int32Array {
  const presence = new Int32Array(byteSpan);
  const stamp = new Int32Array(byteSpan);
  keyList.forEach((valueKey, valueAt) => {
    for (const byteValue of matrix.listBytes(valueKey)) {
      if (findSlot(stamp, byteValue) !== valueAt + 1) { stamp[byteValue] = valueAt + 1; presence[byteValue] = findSlot(presence, byteValue) + 1; }
    }
  });
  return presence;
}
