/** The commit: one delta, judged, appended (read.holdStatesTwo#3). argv: <staging dir holding laws.tsv locks.tsv reads.tsv verdicts.tsv files.tsv> <store path> [bootstrap]. With bootstrap the store is built from .gate/history, saved, loaded again and its last state compared to the built one (delta 0, or a defect), with REQUIRED lines and seconds printed; without it the store is loaded and a missing store is a thrown refusal. The point's number is derived: the larger of the current second and the previous state's number plus one, so two commits in one second cannot collide. The staging point is written as a new state and its delta against the last state is read from the cells. The landing's kind is read from the delta: a delta touching any verdicts row is a verdicts landing. Refused, each by its named rule: LAW RISE — a law value rising (refusalsOpen is governed by OPEN, not here); LAW NEW — a (file, metric) line new while the metric exists elsewhere, unless its value is 0 or its file is new in files; LAW GONE — a law line gone while its file is still in files; LEDGER — a reads or verdicts row changed or gone (rows are keyed by position, so an insert or a reorder shows on every later row); VERDICTS LANDING — any change outside verdicts rows and refusalsOpen in a verdicts landing; OPEN — refusalsOpen changing outside a verdicts landing; LOCK GONE — a lock line gone. Accepted and printed: a metric new to the whole previous state entering at its counts; refusalsOpen moving in a verdicts landing; lock lines new or changed (LOCK, for the falsifier); file hashes new, changed or gone (FILES). On refusal nothing is saved; on acceptance the store is saved and the state's place count, delta size and seconds printed. */
import { findItem } from "../src/matrix.ts";
import type { Delta } from "./holding.ts";
import { buildStore, compareStates, findFirst, ledgerKinds, listState, loadStore, saveStore, writePoint } from "./holding.ts";

const argList = process.argv.slice(2);
const stagingRoot = findItem(argList, 0);
const storePath = findItem(argList, 1);
const isBootstrap = argList.slice(2).includes("bootstrap");
const historyRoot = ".gate/history";
const openPlace = "laws\t(verdicts)\trefusalsOpen";
const startedAt = Date.now();

/** The kind of a place: its first tab field. */
function pickKind(placeText: string): string { return findItem(placeText.split("\t"), 0); }
/** The file a law place names: its second tab field. */
function findFile(placeText: string): string { return findItem(placeText.split("\t"), 1); }
/** The metric a law place names: its third tab field. */
function findMetric(placeText: string): string { return findItem(placeText.split("\t"), 2); }

/** The refusals a delta earns, given the previous state's places. */
function judgeDelta(deltaList: readonly Delta[], previousPlaces: readonly string[]): readonly string[] {
  const refusalList: string[] = [];
  const previousMetrics = new Set(previousPlaces.filter((placeText) => pickKind(placeText) === "laws").map(findMetric));
  const filesNew = new Set(deltaList.filter((deltaLine) => pickKind(deltaLine.place) === "files" && deltaLine.change === "new").map((deltaLine) => findItem(deltaLine.place.split("\t"), 1)));
  const filesGone = new Set(deltaList.filter((deltaLine) => pickKind(deltaLine.place) === "files" && deltaLine.change === "gone").map((deltaLine) => findItem(deltaLine.place.split("\t"), 1)));
  const verdictsLanding = deltaList.some((deltaLine) => pickKind(deltaLine.place) === "verdicts");
  for (const deltaLine of deltaList) {
    const lineKind = pickKind(deltaLine.place);
    const isOpen = deltaLine.place === openPlace;
    if (lineKind === "laws" && isOpen) { if (deltaLine.change === "changed" && !verdictsLanding) refusalList.push(`OPEN ${deltaLine.leftValue} -> ${deltaLine.rightValue} outside a verdicts landing`); continue; }
    if (lineKind === "laws" && deltaLine.change === "changed" && Number(deltaLine.rightValue) > Number(deltaLine.leftValue)) refusalList.push(`LAW RISE ${deltaLine.place} ${deltaLine.leftValue} -> ${deltaLine.rightValue}`);
    if (lineKind === "laws" && deltaLine.change === "new" && previousMetrics.has(findMetric(deltaLine.place)) && Number(deltaLine.rightValue) !== 0 && !filesNew.has(findFile(deltaLine.place))) refusalList.push(`LAW NEW ${deltaLine.place} ${deltaLine.rightValue}: a ceiling appearing from nowhere`);
    if (lineKind === "laws" && deltaLine.change === "gone" && !filesGone.has(findFile(deltaLine.place))) refusalList.push(`LAW GONE ${deltaLine.place} while its file is still hashed`);
    if ((lineKind === "reads" || lineKind === "verdicts") && deltaLine.change !== "new") refusalList.push(`LEDGER ${deltaLine.change} ${deltaLine.place}: ledgers are append-only`);
    if (verdictsLanding && lineKind !== "verdicts" && !isOpen) refusalList.push(`VERDICTS LANDING ${deltaLine.change} ${deltaLine.place}: a verdicts landing changes nothing else`);
    if (lineKind === "locks" && deltaLine.change === "gone") refusalList.push(`LOCK GONE ${deltaLine.place}`);
  }
  return refusalList;
}

/** The store, built and round-tripped under bootstrap, or loaded. */
function holdStore(): ReturnType<typeof loadStore> {
  if (!isBootstrap) return loadStore(storePath);
  const builtStore = buildStore(historyRoot);
  for (const lineKind of ledgerKinds) console.log(`REQUIRED ${lineKind} from ${findFirst(historyRoot, builtStore.pointList, lineKind)}`);
  saveStore(builtStore.stateMatrix, storePath);
  const loadedStore = loadStore(storePath);
  const roundTrip = compareStates(listState(builtStore.stateMatrix, findItem(builtStore.stateKeys, builtStore.stateKeys.length - 1)), listState(loadedStore, loadedStore.lastKey()));
  if (roundTrip.length !== 0) throw new Error(`round trip differs in ${roundTrip.length} places`);
  console.log(`BOOTSTRAP points ${builtStore.pointList.length} cells ${loadedStore.countCells()} roundTrip 0 seconds ${((Date.now() - startedAt) / 1000).toFixed(2)}`);
  return loadedStore;
}

const stateMatrix = holdStore();
const previousKey = stateMatrix.lastKey();
const previousState = listState(stateMatrix, previousKey);
const previousNumber = findItem(stateMatrix.listCell(previousKey).numbers, 0);
const pointName = String(Math.max(Math.floor(Date.now() / 1000), previousNumber + 1));
const stateKey = writePoint(stateMatrix, stagingRoot, pointName, ledgerKinds);
const deltaList = compareStates(previousState, listState(stateMatrix, stateKey));
const showValue = (valueText: string): string => valueText.split("\u0001").join(" ");
for (const deltaLine of deltaList) console.log(`DELTA ${deltaLine.change}\t${deltaLine.place}\t${showValue(deltaLine.leftValue)}\t->\t${showValue(deltaLine.rightValue)}`);
for (const deltaLine of deltaList) if (pickKind(deltaLine.place) === "locks" && deltaLine.change !== "gone") console.log(`LOCK ${deltaLine.change}\t${deltaLine.place}: for the falsifier`);
for (const deltaLine of deltaList) if (pickKind(deltaLine.place) === "files") console.log(`FILES ${deltaLine.change}\t${deltaLine.place}`);
const refusalList = judgeDelta(deltaList, previousState.placeList.map(([placeText]) => placeText));
for (const refusalText of refusalList) console.log(`REFUSE ${refusalText}`);
if (refusalList.length > 0) { console.log(`REFUSED ${pointName}: ${refusalList.length} refusals, nothing saved, seconds ${((Date.now() - startedAt) / 1000).toFixed(2)}`); process.exit(1); }
saveStore(stateMatrix, storePath);
console.log(`STATE ${pointName} appended: ${listState(stateMatrix, stateKey).placeList.length} places, delta ${deltaList.length}, store ${stateMatrix.end} bytes, seconds ${((Date.now() - startedAt) / 1000).toFixed(2)}`);
