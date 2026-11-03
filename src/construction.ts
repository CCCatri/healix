/** constructions: what a construction knows about itself, counted from the construction, never from the judge, and the constructions built in memory from one part's own bytes (rung 2). Known wrong: every claim is a false match. Known right: a claim outside the twins is a false match (a true inside duplicate can appear here; recorded). Doctrine: no sentinel, no shorthand, no alias, no cast, no string. */
import { findSlot, findItem } from "./matrix.ts";
import { listRows, listFields } from "./record.ts";


const newlineByte = 0x0a;
const commaByte = 0x2c;
const quoteByte = 0x22;
const onePrefix = 0x31;
const twoPrefix = 0x32;
const threePrefix = 0x33;
const separatorByte = 0x01;

function joinRows(headerBytes: Uint8Array, rowList: readonly Uint8Array[]): Uint8Array {
  let totalLength = headerBytes.length + 1;
  for (const rowBytes of rowList) totalLength += rowBytes.length + 1;
  const joinedBytes = new Uint8Array(totalLength);
  let writeAt = 0;
  joinedBytes.set(headerBytes, writeAt); writeAt += headerBytes.length; joinedBytes[writeAt] = newlineByte; writeAt += 1;
  for (const rowBytes of rowList) { joinedBytes.set(rowBytes, writeAt); writeAt += rowBytes.length; joinedBytes[writeAt] = newlineByte; writeAt += 1; }
  return joinedBytes.subarray(0, writeAt);
}

/** A field's value by the format law (quoted interior with "" as one quote). */
function decodeField(rowBytes: Uint8Array, fieldSpan: { readonly start: number; readonly end: number; readonly quoted: 0 | 1 }): Uint8Array {
  if (fieldSpan.quoted === 0) return rowBytes.subarray(fieldSpan.start, fieldSpan.end);
  const interiorBytes: number[] = [];
  for (let byteAt = fieldSpan.start + 1; byteAt < fieldSpan.end - 1; byteAt += 1) { const byteValue = findSlot(rowBytes, byteAt); interiorBytes.push(byteValue); if (byteValue === quoteByte) byteAt += 1; }
  return Uint8Array.from(interiorBytes);
}
/** One field's value of a row, decoded by the format law; the row's fields are listed by the record law. For readers outside this file that hold a record's bytes (knownDifferent: aligned and overlapRaw). */
export function readField(rowBytes: Uint8Array, fieldAt: number): Uint8Array {
  return decodeField(rowBytes, findItem(listFields(rowBytes), fieldAt));
}
/** The same table with every field in reverse order, header and rows alike, by the format law; both parts permuted alike keep every view aligned. Row order is untouched, so a record keeps its index (COLUMNS). */
export function constructPermuted(partBytes: Uint8Array): Uint8Array {
  const listedBody = listBody(partBytes);
  const permuteRow = (rowBytes: Uint8Array): Uint8Array => joinFields(listFields(rowBytes).map((fieldSpan) => encodeField(decodeField(rowBytes, fieldSpan))).reverse());
  return joinRows(permuteRow(listedBody.headerBytes), listedBody.bodyRows.map(permuteRow));
}
/** A value encoded back by the format law: quoted where it holds a comma, a quote or a newline, with quotes doubled. */
function encodeField(valueBytes: Uint8Array): Uint8Array {
  if (!valueBytes.some((byteValue) => byteValue === commaByte || byteValue === quoteByte || byteValue === newlineByte)) return valueBytes;
  const encodedBytes: number[] = [quoteByte];
  for (const byteValue of valueBytes) { encodedBytes.push(byteValue); if (byteValue === quoteByte) encodedBytes.push(quoteByte); }
  encodedBytes.push(quoteByte);
  return Uint8Array.from(encodedBytes);
}
function joinFields(fieldList: readonly Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const fieldBytes of fieldList) totalLength += fieldBytes.length + 1;
  const joinedBytes = new Uint8Array(totalLength);
  let writeAt = 0;
  fieldList.forEach((fieldBytes, fieldAt) => { joinedBytes.set(fieldBytes, writeAt); writeAt += fieldBytes.length; if (fieldAt < fieldList.length - 1) { joinedBytes[writeAt] = commaByte; writeAt += 1; } });
  return joinedBytes.subarray(0, writeAt);
}
function listBody(partBytes: Uint8Array): { headerBytes: Uint8Array; bodyRows: Uint8Array[] } {
  const rowList = listRows(partBytes).rows.map((rowSpan) => partBytes.subarray(rowSpan.start, rowSpan.end));
  return { headerBytes: findItem(rowList, 0), bodyRows: rowList.slice(1) };
}

/** A record's body: its field values from field 1 on, decoded by the format law and joined by a byte no value holds. Field 0 is the numbering value every construction rewrites with a prefix, so identity for constructions is identity of bodies, never of whole rows (chimera.skip). */
function joinBody(rowBytes: Uint8Array): Uint8Array {
  const valueList = listFields(rowBytes).map((fieldSpan) => decodeField(rowBytes, fieldSpan)).slice(1);
  let totalLength = 0;
  for (const valueBytes of valueList) totalLength += valueBytes.length + 1;
  const bodyBytes = new Uint8Array(totalLength);
  let writeAt = 0;
  for (const valueBytes of valueList) { bodyBytes.set(valueBytes, writeAt); writeAt += valueBytes.length; bodyBytes[writeAt] = separatorByte; writeAt += 1; }
  return bodyBytes;
}
const sameBody = (leftRow: Uint8Array, rightRow: Uint8Array): boolean => Buffer.compare(joinBody(leftRow), joinBody(rightRow)) === 0;

/** Declared known wrong (not built): one table split unevenly — every `every`-th record on side A, the rest on side B. Carries true pairs where the table holds duplicates (dirty ÷4: 4). */
export function constructSplit(partBytes: Uint8Array, everyCount: number): { a: Uint8Array; b: Uint8Array } {
  const listed = listBody(partBytes);
  return { a: joinRows(listed.headerBytes, listed.bodyRows.filter((_, rowAt) => rowAt % everyCount === 0)), b: joinRows(listed.headerBytes, listed.bodyRows.filter((_, rowAt) => rowAt % everyCount !== 0)) };
}

/** Known right: side B is a copy of every record with index ≡ residue (mod every), its numbering value prefixed with 1, and field `fieldIndex` shortened to the first half of its value (FORM: shorten), re-encoded by the format law; a field of -1 copies exactly. Twins are (A index, B index). */
export function constructShortened(partBytes: Uint8Array, everyCount: number, residueValue: number, fieldIndex: number): { a: Uint8Array; b: Uint8Array; twins: [number, number][] } {
  const listed = listBody(partBytes);
  const copyRows: Uint8Array[] = [];
  const twinList: [number, number][] = [];
  listed.bodyRows.forEach((rowBytes, rowAt) => {
    if (rowAt % everyCount !== residueValue) return;
    const fieldValues = listFields(rowBytes).map((fieldSpan, fieldAt) => {
      const valueBytes = decodeField(rowBytes, fieldSpan);
      if (fieldAt === 0) return Uint8Array.from([onePrefix, ...valueBytes]);
      if (fieldAt === fieldIndex) return encodeField(valueBytes.subarray(0, Math.floor(valueBytes.length / 2)));
      return encodeField(valueBytes);
    });
    twinList.push([rowAt, copyRows.length]);
    copyRows.push(joinFields(fieldValues));
  });
  return { a: joinRows(listed.headerBytes, listed.bodyRows), b: joinRows(listed.headerBytes, copyRows), twins: twinList };
}

/** Known right, built (doubledRead): for every `every`-th record two B copies, the first with field `fieldOne` shortened and numbering prefixed 1, the second with field `fieldTwo` shortened and numbering prefixed 3 (FORM: shorten, re-encoded by the format law). Both copies are true matches of their A record; twins list both. A refutation of either is a refutation of a truth. */
export function constructDoubled(partBytes: Uint8Array, everyCount: number, fieldOne: number, fieldTwo: number): { a: Uint8Array; b: Uint8Array; twins: [number, number][] } {
  const listedBody = listBody(partBytes);
  const copyRows: Uint8Array[] = [];
  const twinList: [number, number][] = [];
  const shortenRow = (rowBytes: Uint8Array, shortenAt: number, prefixByte: number): Uint8Array => joinFields(listFields(rowBytes).map((fieldSpan, fieldAt) => {
    const valueBytes = decodeField(rowBytes, fieldSpan);
    if (fieldAt === 0) return Uint8Array.from([prefixByte, ...valueBytes]);
    if (fieldAt === shortenAt) return encodeField(valueBytes.subarray(0, Math.floor(valueBytes.length / 2)));
    return encodeField(valueBytes);
  }));
  listedBody.bodyRows.forEach((rowBytes, rowAt) => {
    if (rowAt % everyCount !== 0) return;
    twinList.push([rowAt, copyRows.length]); copyRows.push(shortenRow(rowBytes, fieldOne, onePrefix));
    twinList.push([rowAt, copyRows.length]); copyRows.push(shortenRow(rowBytes, fieldTwo, threePrefix));
  });
  return { a: joinRows(listedBody.headerBytes, listedBody.bodyRows), b: joinRows(listedBody.headerBytes, copyRows), twins: twinList };
}

/** Known both, built (plantTruths): side B holds the chimeras of constructChimera (false in direction) plus, for every `plantEvery`-th record, an exact copy with numbering prefixed 1 — a built true pair, listed in twins (A index, B index). donors are the chimeras' donor rows, in B order (knownDifferent). An refutationRule firing against a chimera claim sharing a record with a right planted pair is a correct refutation; a firing against a twin claim refutes a truth. */
export function constructPlanted(partBytes: Uint8Array, everyCount: number, plantEvery: number): { a: Uint8Array; b: Uint8Array; twins: [number, number][]; skipped: number; donors: number[][] } {
  const chimeraPart = constructChimera(partBytes, everyCount);
  const listedBody = listBody(partBytes);
  const chimeraRows = listBody(chimeraPart.b).bodyRows;
  const copyRows: Uint8Array[] = [];
  const twinList: [number, number][] = [];
  listedBody.bodyRows.forEach((rowBytes, rowAt) => {
    if (rowAt % plantEvery !== 0) return;
    twinList.push([rowAt, chimeraRows.length + copyRows.length]);
    copyRows.push(joinFields(listFields(rowBytes).map((fieldSpan, fieldAt) => { const valueBytes = decodeField(rowBytes, fieldSpan); return fieldAt === 0 ? Uint8Array.from([onePrefix, ...valueBytes]) : encodeField(valueBytes); })));
  });
  return { a: chimeraPart.a, b: joinRows(listedBody.headerBytes, [...chimeraRows, ...copyRows]), twins: twinList, skipped: chimeraPart.skipped, donors: chimeraPart.donors };
}

/** Known wrong, built not declared: side B holds chimeras — for every `every`-th record, field j is taken from record k + j * stride (stride = floor(records / fields) + 1), numbering value prefixed with 2. A chimera whose source rows include two of the same body is not built (its fields could be one entity's) and is counted as skipped. donors lists, per chimera built, the source row index of each field, so a reader can pair a chimera with one donor and check the other donors against it (knownDifferent). Asserted: fieldCount >= 3, no source collision, no same-body source pair. Not asserted: that rows with different bodies are different entities. */
export function constructChimera(partBytes: Uint8Array, everyCount: number): { a: Uint8Array; b: Uint8Array; skipped: number; donors: number[][] } {
  const listed = listBody(partBytes);
  const fieldCount = listFields(listed.headerBytes).length;
  if (fieldCount < 3) throw new Error(`a chimera needs three fields; this part has ${fieldCount}`);
  const rowCount = listed.bodyRows.length;
  const strideLength = Math.floor(rowCount / fieldCount) + 1;
  if ((fieldCount - 1) * strideLength >= rowCount) throw new Error(`chimera sources collide: (${fieldCount} - 1) * ${strideLength} >= ${rowCount}`);
  const chimeraRows: Uint8Array[] = [];
  const donorList: number[][] = [];
  let skippedCount = 0;
  listed.bodyRows.forEach((_, rowAt) => {
    if (rowAt % everyCount !== 0) return;
    const donorRows: number[] = [];
    for (let fieldAt = 0; fieldAt < fieldCount; fieldAt += 1) donorRows.push((rowAt + fieldAt * strideLength) % rowCount);
    const sourceRows = donorRows.map((donorAt) => findItem(listed.bodyRows, donorAt));
    let sameSource = false;
    sourceRows.forEach((leftRow, leftAt) => { for (let rightAt = leftAt + 1; rightAt < sourceRows.length; rightAt += 1) if (sameBody(leftRow, findItem(sourceRows, rightAt))) sameSource = true; });
    if (sameSource) { skippedCount += 1; return; }
    const fieldValues = sourceRows.map((sourceRow, fieldAt) => { const sourceField = findItem(listFields(sourceRow), fieldAt); const valueBytes = decodeField(sourceRow, sourceField); return fieldAt === 0 ? Uint8Array.from([twoPrefix, ...valueBytes]) : encodeField(valueBytes); });
    chimeraRows.push(joinFields(fieldValues));
    donorList.push(donorRows);
  });
  return { a: joinRows(listed.headerBytes, listed.bodyRows), b: joinRows(listed.headerBytes, chimeraRows), skipped: skippedCount, donors: donorList };
}
