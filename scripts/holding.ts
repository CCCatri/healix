/** holdStates, the library (phase two, read.holdStatesTwo#3). Every judgment a point holds — law lines, lock lines (COST excluded), read rows, verdict rows, and the file hashes of files.tsv — is a cell in one Matrix: read keys are the place's bytes then each value's bytes; a state cell closes the point with the point's cells as its read keys. Places: a law is laws, file, metric (its value must parse as a finite number, else the line is refused); a lock is its kind and name tokens; a ledger row is its kind and line position (reads #n, verdicts #n), so an insert, an edit or a reorder shows on that row and every later one; a file hash is files, path. The delta between two states is a merge of two place-sorted lists: places new, gone, or with changed values, each with both values. The store persists as the Matrix bytes in one file. */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import type { Key } from "../src/matrix.ts";
import { Matrix, Yes, findItem } from "../src/matrix.ts";

type Placed = { readonly place: string; readonly values: readonly string[] };
type Tagged = { readonly lineKind: string; readonly rowAt: number; readonly lineText: string };
type Stated = { readonly stateKey: Key; readonly placeList: readonly (readonly [string, string])[] };
export type Delta = { readonly change: string; readonly place: string; readonly leftValue: string; readonly rightValue: string };

const costPrefix = "COST ";
const trailingStarts = ["(", "["];
const wordValues = ["yes", "no", "unknown", "none", "-"];
export const ledgerKinds = ["laws", "locks", "reads", "verdicts", "files"];
const rowKinds = ["reads", "verdicts"];
const valueJoin = "\u0001";

/** A judgment line to its place and values. */
function parsePlace(taggedLine: Tagged): Placed {
  const fieldList = taggedLine.lineText.split("\t");
  if (taggedLine.lineKind === "laws") {
    if (fieldList.length !== 4) throw new Error(`law line with ${fieldList.length} fields: ${taggedLine.lineText}`);
    if (!Number.isFinite(Number(findItem(fieldList, 3)))) throw new Error(`law value is not a finite number: ${taggedLine.lineText}`);
    return { place: `laws\t${findItem(fieldList, 1)}\t${findItem(fieldList, 2)}`, values: [findItem(fieldList, 3)] };
  }
  if (taggedLine.lineKind === "files") {
    if (fieldList.length !== 2) throw new Error(`files line with ${fieldList.length} fields: ${taggedLine.lineText}`);
    return { place: `files\t${findItem(fieldList, 0)}`, values: [findItem(fieldList, 1)] };
  }
  if (rowKinds.includes(taggedLine.lineKind)) return { place: `${taggedLine.lineKind}\t#${taggedLine.rowAt}`, values: fieldList };
  const tokenList = taggedLine.lineText.split(" ");
  let placeEnd = 1;
  while (placeEnd + 1 < tokenList.length && !/^-?[0-9.]+$/.test(findItem(tokenList, placeEnd + 1)) && !wordValues.includes(findItem(tokenList, placeEnd + 1))) placeEnd += 1;
  const valueList: string[] = [];
  for (let tokenAt = placeEnd; tokenAt + 1 < tokenList.length; tokenAt += 2) {
    const valueText = findItem(tokenList, tokenAt + 1);
    if (trailingStarts.some((startText) => valueText.startsWith(startText))) { valueList.push(tokenList.slice(tokenAt + 1).join(" ")); break; }
    valueList.push(valueText);
  }
  return { place: `${taggedLine.lineKind}\t${tokenList.slice(0, placeEnd).join(" ")}`, values: valueList };
}

/** The judgment lines of one point, tagged with kind and (for ledger rows) line position among rows. COST and LAWNOTE excluded. A ledger named in requiredKinds must be present; one not named may be absent. */
function listLines(pointRoot: string, requiredKinds: readonly string[]): readonly Tagged[] {
  const taggedList: Tagged[] = [];
  for (const lineKind of ledgerKinds) {
    const filePath = `${pointRoot}/${lineKind}.tsv`;
    if (!existsSync(filePath)) { if (requiredKinds.includes(lineKind)) throw new Error(`${filePath} missing from a point that must hold it`); continue; }
    let rowAt = 0;
    for (const lineText of readFileSync(filePath, "utf8").split("\n")) {
      if (lineText.length === 0 || lineText.startsWith("#") || lineText.startsWith("LAWNOTE") || lineText.startsWith(costPrefix)) continue;
      taggedList.push({ lineKind, rowAt, lineText });
      rowAt += 1;
    }
  }
  return taggedList;
}

/** One point as cells: a bytes write per place and per value, a cell per judgment (read keys: the place then its values), a state cell closing the point with [pointNumber, cellCount]. */
export function writePoint(stateMatrix: Matrix, pointRoot: string, pointName: string, requiredKinds: readonly string[]): Key {
  const cellKeys: Key[] = [];
  for (const taggedLine of listLines(pointRoot, requiredKinds)) {
    const placedLine = parsePlace(taggedLine);
    const placeKey = stateMatrix.writeBytes(Buffer.from(placedLine.place, "utf8"));
    const valueKeys = placedLine.values.map((valueText) => stateMatrix.writeBytes(Buffer.from(valueText, "utf8")));
    cellKeys.push(stateMatrix.writeCell(new Yes(), [placeKey, ...valueKeys], [valueKeys.length]));
  }
  return stateMatrix.writeCell(new Yes(), cellKeys, [Number(pointName), cellKeys.length]);
}

/** A state read back from its cells: place text and joined values, sorted by place. A place written twice in one state is a defect. */
export function listState(stateMatrix: Matrix, stateKey: Key): Stated {
  const placeList: [string, string][] = [];
  for (const cellKey of stateMatrix.listCell(stateKey).readKeys) {
    const judgmentCell = stateMatrix.listCell(cellKey);
    const placeText = Buffer.from(stateMatrix.listBytes(findItem(judgmentCell.readKeys, 0))).toString("utf8");
    const valueText = judgmentCell.readKeys.slice(1).map((valueKey) => Buffer.from(stateMatrix.listBytes(valueKey)).toString("utf8")).join(valueJoin);
    placeList.push([placeText, valueText]);
  }
  placeList.sort((leftPair, rightPair) => (leftPair[0] < rightPair[0] ? -1 : leftPair[0] > rightPair[0] ? 1 : 0));
  for (let placeAt = 1; placeAt < placeList.length; placeAt += 1) if (findItem(placeList, placeAt)[0] === findItem(placeList, placeAt - 1)[0]) throw new Error(`place written twice in one state: ${findItem(placeList, placeAt)[0]}`);
  return { stateKey, placeList };
}

/** The delta between two states by merging their place-sorted lists: places new in the right, gone from the left, or present in both with changed values. */
export function compareStates(leftState: Stated, rightState: Stated): readonly Delta[] {
  const deltaList: Delta[] = [];
  let leftAt = 0; let rightAt = 0;
  while (leftAt < leftState.placeList.length || rightAt < rightState.placeList.length) {
    if (leftAt >= leftState.placeList.length) { const [placeText, rightValue] = findItem(rightState.placeList, rightAt); deltaList.push({ change: "new", place: placeText, leftValue: "", rightValue }); rightAt += 1; continue; }
    if (rightAt >= rightState.placeList.length) { const [placeText, leftValue] = findItem(leftState.placeList, leftAt); deltaList.push({ change: "gone", place: placeText, leftValue, rightValue: "" }); leftAt += 1; continue; }
    const [leftPlace, leftValue] = findItem(leftState.placeList, leftAt);
    const [rightPlace, rightValue] = findItem(rightState.placeList, rightAt);
    if (leftPlace === rightPlace) { if (leftValue !== rightValue) deltaList.push({ change: "changed", place: leftPlace, leftValue, rightValue }); leftAt += 1; rightAt += 1; }
    else if (leftPlace < rightPlace) { deltaList.push({ change: "gone", place: leftPlace, leftValue, rightValue: "" }); leftAt += 1; }
    else { deltaList.push({ change: "new", place: rightPlace, leftValue: "", rightValue }); rightAt += 1; }
  }
  return deltaList;
}

/** The text diff's places, for the retro check: judgments gone or new between two points, each tagged line parsed to its place and values first, so a line's position counts only where its place carries it (reads and verdicts rows), never for law, lock or file lines. */
export function listDiff(leftRoot: string, rightRoot: string, requiredKinds: readonly string[]): readonly string[] {
  const placedText = (taggedLine: Tagged): string => JSON.stringify(parsePlace(taggedLine));
  const leftLines = new Set(listLines(leftRoot, requiredKinds).map(placedText));
  const rightLines = new Set(listLines(rightRoot, requiredKinds).map(placedText));
  const placeSet = new Set<string>();
  for (const placedJson of rightLines) if (!leftLines.has(placedJson)) placeSet.add(JSON.parse(placedJson).place);
  for (const placedJson of leftLines) if (!rightLines.has(placedJson)) placeSet.add(JSON.parse(placedJson).place);
  return [...placeSet].sort();
}

/** The first history point holding a ledger; no point holding it is a defect. */
export function findFirst(historyRoot: string, pointList: readonly string[], lineKind: string): string {
  const holdingPoints = pointList.filter((pointName) => existsSync(`${historyRoot}/${pointName}/${lineKind}.tsv`));
  if (holdingPoints.length === 0) throw new Error(`no point holds ${lineKind}.tsv`);
  return findItem(holdingPoints, 0);
}

/** The ledgers a history point must hold: every kind from its first holding point onward. */
export function listRequired(historyRoot: string, pointList: readonly string[], pointName: string): readonly string[] {
  return ledgerKinds.filter((lineKind) => pointName >= findFirst(historyRoot, pointList, lineKind));
}

/** The store on disk: the Matrix bytes up to its end. */
export function saveStore(stateMatrix: Matrix, storePath: string): void {
  writeFileSync(storePath, stateMatrix.contents.subarray(0, stateMatrix.end));
}

/** The store read back: a Matrix whose contents are the file's bytes and whose end is their length, so the next write continues the same keys. */
export function loadStore(storePath: string): Matrix {
  const storedBytes = Uint8Array.from(readFileSync(storePath));
  const stateMatrix = new Matrix();
  stateMatrix.contents = storedBytes;
  stateMatrix.view = new DataView(storedBytes.buffer);
  stateMatrix.end = storedBytes.length;
  return stateMatrix;
}

/** Every history point written into one fresh store, oldest first; the state keys in point order. */
export function buildStore(historyRoot: string): { readonly stateMatrix: Matrix; readonly pointList: readonly string[]; readonly stateKeys: readonly Key[] } {
  const pointList = readdirSync(historyRoot).sort();
  const stateMatrix = new Matrix();
  const stateKeys = pointList.map((pointName) => writePoint(stateMatrix, `${historyRoot}/${pointName}`, pointName, listRequired(historyRoot, pointList, pointName)));
  return { stateMatrix, pointList, stateKeys };
}
