/** matrixStore + the trit mint: one byte store. Every record and every judgment is content written in order and closed by a count written last; its key is where it ends. The trits and the key brand are minted here and nowhere else; the checked reads and the content order live here as the one producer each. Doctrine: no sentinel, no shorthand, no alias; the one cast is the brand's mint; the error strings are the only strings in src and belong here. */
export type Key = number & { readonly key: unique symbol };

/** The brand's mint: the only cast in src. A key is the end offset of a write in this store. */
function constructKey(endOffset: number): Key { return endOffset as Key; }

const kindBytes = 0;
const kindCell = 1;
const wayYes = 0;
const wayNo = 1;
const wayUnknown = 2;
const countWidth = 4;
const numberWidth = 8;

export class Yes { readonly way: 0 = wayYes; }
class No { readonly way: 1 = wayNo; }
class Unknown {
  readonly way: 2 = wayUnknown;
  readonly waitsOn: Key;
  constructor(waitsOn: Key) { this.waitsOn = waitsOn; }
}
export type Way = Yes | No | Unknown;

/** One chance measure: a chance, or its log, on its bar's scale; it clears at or under its bar. */
type Chance = { readonly chance: number; readonly bar: number };
/** Evidence for one verdict, of the kinds the data supplies: chances toward and against; counts of instances found (toward at one or more); counterexample counts from an exhaustive check, a census (toward at zero, against at one or more). */
type Evidence = { readonly toward: readonly Chance[]; readonly against: readonly Chance[]; readonly found: readonly number[]; readonly census: readonly number[] };

/** The one door from evidence to a trit. Toward clears where any toward chance is at most its bar, any found count is one or more, or any census count is zero; against clears where any against chance is at most its bar or any census count is one or more. The arm is read from the table [neither: unknown, against only: no; toward only: yes, both: unknown], indexed by how many of each side clear, so no boolean enters or leaves; unknown carries waitsOn, its reason, whether nothing cleared or both sides did. No and Unknown are minted here and nowhere else. */
export function judgeEvidence(cellEvidence: Evidence, waitsOn: Key): Way {
  const towardClears = Math.min(1, cellEvidence.toward.filter((chanceItem) => chanceItem.chance <= chanceItem.bar).length + cellEvidence.found.filter((foundCount) => foundCount >= 1).length + cellEvidence.census.filter((counterCount) => counterCount === 0).length);
  const againstClears = Math.min(1, cellEvidence.against.filter((chanceItem) => chanceItem.chance <= chanceItem.bar).length + cellEvidence.census.filter((counterCount) => counterCount >= 1).length);
  const armTable = [[(): Way => new Unknown(waitsOn), (): Way => new No()], [(): Way => new Yes(), (): Way => new Unknown(waitsOn)]];
  return findItem(findItem(armTable, towardClears), againstClears)();
}

export type Cell = { readonly way: Way; readonly readKeys: readonly Key[]; readonly numbers: readonly number[] };

/** A slot's number. A slot outside its array is a defect, never a zero. */
export function findSlot(slotArray: ArrayLike<number>, slotIndex: number): number {
  const slotValue = slotArray[slotIndex];
  if (slotValue === undefined) throw new Error(`slot ${slotIndex} outside ${slotArray.length}`);
  return slotValue;
}
/** An item of a list. An index outside the list is a defect, never an absence. */
export function findItem<ItemType>(itemList: readonly ItemType[], itemIndex: number): ItemType {
  const itemValue = itemList[itemIndex];
  if (itemValue === undefined) throw new Error(`item ${itemIndex} outside ${itemList.length}`);
  return itemValue;
}
/** Content order of two keys' bytes: the one producer of record and piece identity order. */
export function compareContent(cellMatrix: Matrix, leftKey: Key, rightKey: Key): number {
  return Buffer.compare(cellMatrix.listBytes(leftKey), cellMatrix.listBytes(rightKey));
}

export class Matrix {
  contents = new Uint8Array(1 << 16);
  view = new DataView(this.contents.buffer);
  end = 0;

  private growTo(neededSize: number): void {
    if (neededSize <= this.contents.length) return;
    const grownContents = new Uint8Array(Math.max(neededSize, this.contents.length * 2));
    grownContents.set(this.contents);
    this.contents = grownContents;
    this.view = new DataView(grownContents.buffer);
  }
  private writeByte(byteValue: number): void {
    this.growTo(this.end + 1);
    this.contents[this.end] = byteValue;
    this.end += 1;
  }
  private writeNumber(numberValue: number): void {
    this.growTo(this.end + numberWidth);
    this.view.setFloat64(this.end, numberValue, true);
    this.end += numberWidth;
  }
  private writeCount(writeStart: number): void {
    this.growTo(this.end + countWidth);
    this.view.setUint32(this.end, this.end - writeStart, true);
    this.end += countWidth;
  }

  writeBytes(contentBytes: Uint8Array): Key {
    const writeStart = this.end;
    this.writeByte(kindBytes);
    this.growTo(this.end + contentBytes.length);
    this.contents.set(contentBytes, this.end);
    this.end += contentBytes.length;
    this.writeCount(writeStart);
    return constructKey(this.end);
  }
  writeCell(cellWay: Way, readKeys: readonly Key[], cellNumbers: readonly number[]): Key {
    const writeStart = this.end;
    this.writeByte(kindCell);
    this.writeByte(cellWay.way);
    this.writeNumber(readKeys.length);
    for (const readKey of readKeys) this.writeNumber(readKey);
    this.writeNumber(cellNumbers.length);
    for (const numberValue of cellNumbers) this.writeNumber(numberValue);
    if (cellWay instanceof Unknown) this.writeNumber(cellWay.waitsOn);
    this.writeCount(writeStart);
    return constructKey(this.end);
  }

  private findStart(cellKey: Key, expectedKind: number): number {
    const writeStart = cellKey - countWidth - this.view.getUint32(cellKey - countWidth, true);
    if (findSlot(this.contents, writeStart) !== expectedKind) throw new Error(`key ${cellKey} does not end a write of kind ${expectedKind}`);
    return writeStart;
  }
  listBytes(contentKey: Key): Uint8Array {
    return this.contents.subarray(this.findStart(contentKey, kindBytes) + 1, contentKey - countWidth);
  }
  listCell(cellKey: Key): Cell {
    let readAt = this.findStart(cellKey, kindCell) + 1;
    const wayByte = findSlot(this.contents, readAt);
    readAt += 1;
    const readCount = this.view.getFloat64(readAt, true);
    readAt += numberWidth;
    const readKeys: Key[] = [];
    for (let keyAt = 0; keyAt < readCount; keyAt += 1) { readKeys.push(constructKey(this.view.getFloat64(readAt, true))); readAt += numberWidth; }
    const numberCount = this.view.getFloat64(readAt, true);
    readAt += numberWidth;
    const cellNumbers: number[] = [];
    for (let numberAt = 0; numberAt < numberCount; numberAt += 1) { cellNumbers.push(this.view.getFloat64(readAt, true)); readAt += numberWidth; }
    if (wayByte === wayYes) return { way: new Yes(), readKeys, numbers: cellNumbers };
    if (wayByte === wayNo) return { way: new No(), readKeys, numbers: cellNumbers };
    if (wayByte === wayUnknown) return { way: new Unknown(constructKey(this.view.getFloat64(readAt, true))), readKeys, numbers: cellNumbers };
    throw new Error(`cell ending at ${cellKey} holds no way`);
  }
  judgeWay<Outcome>(cellKey: Key, onYes: (cell: Cell) => Outcome, onNo: (cell: Cell) => Outcome, onUnknown: (waitsOn: Key, cell: Cell) => Outcome): Outcome {
    const cellValue = this.listCell(cellKey);
    if (cellValue.way instanceof Unknown) return onUnknown(cellValue.way.waitsOn, cellValue);
    if (cellValue.way instanceof No) return onNo(cellValue);
    return onYes(cellValue);
  }
  countCells(): number {
    let cellCount = 0;
    let readAt = this.end;
    while (readAt > 0) {
      const writeStart = readAt - countWidth - this.view.getUint32(readAt - countWidth, true);
      if (findSlot(this.contents, writeStart) === kindCell) cellCount += 1;
      readAt = writeStart;
    }
    return cellCount;
  }
  /** The key of the last write: where the store ends. Minted here, so a loaded store can be continued without a cast. */
  lastKey(): Key { return constructKey(this.end); }
}
