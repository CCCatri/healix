/** recordsLaw: a record is its part's content and its own bytes. A row closes at a newline outside double quotes, a field at a comma outside them, "" inside quotes is one quote (law read from dirty tableB and quoted_newline). Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import type { Key } from "./matrix.ts";
import { Matrix, findSlot, findItem, compareContent, judgeEvidence } from "./matrix.ts";

const commaByte = 0x2c;
const quoteByte = 0x22;
const newlineByte = 0x0a;
const carriageByte = 0x0d;

export type Row = { readonly start: number; readonly end: number; readonly fields: number };
export type Rows = { readonly rows: readonly Row[]; readonly blanks: number; readonly openQuotes: number };
export type Part = {
  readonly header: Key; readonly records: readonly Key[]; readonly headerFields: number;
  readonly uneven: number; readonly blanks: number; readonly openQuotes: number;
};
export type Field = { readonly start: number; readonly end: number; readonly quoted: 0 | 1 };

export function listRows(partBytes: Uint8Array): Rows {
  const rowList: Row[] = [];
  let blankCount = 0;
  let rowStart = 0;
  let fieldCount = 1;
  let insideQuotes = false;
  let byteAt = 0;
  const closeRow = (rowEnd: number): void => {
    const trimmedEnd = rowEnd > rowStart && findSlot(partBytes, rowEnd - 1) === carriageByte ? rowEnd - 1 : rowEnd;
    if (trimmedEnd > rowStart) rowList.push({ start: rowStart, end: trimmedEnd, fields: fieldCount }); else blankCount += 1;
  };
  while (byteAt < partBytes.length) {
    const byteValue = findSlot(partBytes, byteAt);
    if (insideQuotes) {
      if (byteValue === quoteByte) { if (byteAt + 1 < partBytes.length && findSlot(partBytes, byteAt + 1) === quoteByte) byteAt += 1; else insideQuotes = false; }
    } else if (byteValue === quoteByte) insideQuotes = true;
    else if (byteValue === commaByte) fieldCount += 1;
    else if (byteValue === newlineByte) { closeRow(byteAt); rowStart = byteAt + 1; fieldCount = 1; }
    byteAt += 1;
  }
  if (rowStart < partBytes.length) closeRow(partBytes.length);
  return { rows: rowList, blanks: blankCount, openQuotes: insideQuotes ? 1 : 0 };
}

/** The fields of one record, by the same quote law; quoted = 1 where the field opens with a double quote. */
export function listFields(recordBytes: Uint8Array): Field[] {
  const fieldList: Field[] = [];
  let fieldStart = 0;
  let insideQuotes = false;
  let byteAt = 0;
  const quotedAt = (fieldBegin: number): 0 | 1 => (fieldBegin < recordBytes.length && findSlot(recordBytes, fieldBegin) === quoteByte ? 1 : 0);
  while (byteAt < recordBytes.length) {
    const byteValue = findSlot(recordBytes, byteAt);
    if (insideQuotes) {
      if (byteValue === quoteByte) { if (byteAt + 1 < recordBytes.length && findSlot(recordBytes, byteAt + 1) === quoteByte) byteAt += 1; else insideQuotes = false; }
    } else if (byteValue === quoteByte) insideQuotes = true;
    else if (byteValue === commaByte) { fieldList.push({ start: fieldStart, end: byteAt, quoted: quotedAt(fieldStart) }); fieldStart = byteAt + 1; }
    byteAt += 1;
  }
  fieldList.push({ start: fieldStart, end: recordBytes.length, quoted: quotedAt(fieldStart) });
  return fieldList;
}

/** A field's value: its bytes, or for a quoted field its interior with "" written as one quote. */
export function writeValue(matrix: Matrix, recordBytes: Uint8Array, fieldSpan: Field): Key {
  if (fieldSpan.quoted === 0) return matrix.writeBytes(recordBytes.subarray(fieldSpan.start, fieldSpan.end));
  const interiorBytes = new Uint8Array(fieldSpan.end - fieldSpan.start);
  let interiorAt = 0;
  for (let byteAt = fieldSpan.start + 1; byteAt < fieldSpan.end - 1; byteAt += 1) {
    const byteValue = findSlot(recordBytes, byteAt);
    interiorBytes[interiorAt] = byteValue;
    interiorAt += 1;
    if (byteValue === quoteByte) byteAt += 1;
  }
  return matrix.writeBytes(interiorBytes.subarray(0, interiorAt));
}

export function writeRecords(matrix: Matrix, partBytes: Uint8Array): Part {
  const listed = listRows(partBytes);
  const headerRow = findItem(listed.rows, 0);
  const headerKey = matrix.writeBytes(partBytes.subarray(headerRow.start, headerRow.end));
  const recordKeys: Key[] = [];
  let unevenCount = 0;
  for (const bodyRow of listed.rows.slice(1)) {
    if (bodyRow.fields !== headerRow.fields) unevenCount += 1;
    recordKeys.push(matrix.writeBytes(partBytes.subarray(bodyRow.start, bodyRow.end)));
  }
  return { header: headerKey, records: recordKeys, headerFields: headerRow.fields, uneven: unevenCount, blanks: listed.blanks, openQuotes: listed.openQuotes };
}

export function constructReversed(partBytes: Uint8Array, rowList: readonly Row[]): Uint8Array {
  const reversedBytes = new Uint8Array(partBytes.length + rowList.length);
  let writeAt = 0;
  const placeRow = (rowSpan: Row): void => {
    reversedBytes.set(partBytes.subarray(rowSpan.start, rowSpan.end), writeAt);
    writeAt += rowSpan.end - rowSpan.start;
    reversedBytes[writeAt] = newlineByte;
    writeAt += 1;
  };
  placeRow(findItem(rowList, 0));
  for (let rowAt = rowList.length - 1; rowAt >= 1; rowAt -= 1) placeRow(findItem(rowList, rowAt));
  return reversedBytes.subarray(0, writeAt);
}

/** recordsLaw pass test: reversed record order gives the same records. Evidence against = mismatched records. Numbers [forward, backward, mismatches]. */
export function judgeOrder(matrix: Matrix, partBytes: Uint8Array, forwardPart: Part): Key {
  const backwardPart = writeRecords(matrix, constructReversed(partBytes, listRows(partBytes).rows));
  const sortedForward = [...forwardPart.records].sort((leftKey, rightKey) => compareContent(matrix, leftKey, rightKey));
  const sortedBackward = [...backwardPart.records].sort((leftKey, rightKey) => compareContent(matrix, leftKey, rightKey));
  let mismatchCount = Math.abs(sortedForward.length - sortedBackward.length);
  const sharedLength = Math.min(sortedForward.length, sortedBackward.length);
  for (let recordAt = 0; recordAt < sharedLength; recordAt += 1) {
    if (compareContent(matrix, findItem(sortedForward, recordAt), findItem(sortedBackward, recordAt)) !== 0) mismatchCount += 1;
  }
  return matrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [mismatchCount] }, forwardPart.header), [forwardPart.header, backwardPart.header], [forwardPart.records.length, backwardPart.records.length, mismatchCount]);
}
