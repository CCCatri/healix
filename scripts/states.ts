/** holdStates, the retro check. argv: <history dir>, and optionally `plant <dir>` to compare the newest point against a planted copy. Prints one REQUIRED line per ledger (the first history point holding it: from there on a point missing it is refused), one RETRO line per consecutive pair of points (matrix delta places against text-diff places, agree yes or no), DELTA lines for a plant, and one SUMMARY. */
import { findItem } from "../src/matrix.ts";
import { buildStore, compareStates, ledgerKinds, listDiff, listRequired, listState, findFirst, writePoint } from "./holding.ts";

const historyRoot = findItem(process.argv.slice(2), 0);
const modeList = process.argv.slice(3);
const { stateMatrix, pointList, stateKeys } = buildStore(historyRoot);
for (const lineKind of ledgerKinds) console.log(`REQUIRED ${lineKind} from ${findFirst(historyRoot, pointList, lineKind)}`);
if (modeList.length === 0) {
  let agreeCount = 0;
  for (let pointAt = 1; pointAt < pointList.length; pointAt += 1) {
    const deltaPlaces = compareStates(listState(stateMatrix, findItem(stateKeys, pointAt - 1)), listState(stateMatrix, findItem(stateKeys, pointAt))).map((deltaLine) => deltaLine.place).sort();
    const diffPlaces = listDiff(`${historyRoot}/${findItem(pointList, pointAt - 1)}`, `${historyRoot}/${findItem(pointList, pointAt)}`, listRequired(historyRoot, pointList, findItem(pointList, pointAt - 1)));
    const agreeText = JSON.stringify(deltaPlaces) === JSON.stringify(diffPlaces) ? "yes" : "no";
    if (agreeText === "yes") agreeCount += 1;
    console.log(`RETRO ${findItem(pointList, pointAt - 1)} -> ${findItem(pointList, pointAt)} deltaPlaces ${deltaPlaces.length} textPlaces ${diffPlaces.length} agree ${agreeText}`);
  }
  console.log(`SUMMARY points ${pointList.length} pairs ${pointList.length - 1} agree ${agreeCount} cells ${stateMatrix.countCells()}`);
} else {
  const plantKey = writePoint(stateMatrix, findItem(modeList, 1), "0", ledgerKinds);
  for (const deltaLine of compareStates(listState(stateMatrix, findItem(stateKeys, stateKeys.length - 1)), listState(stateMatrix, plantKey))) console.log(`DELTA ${deltaLine.change}\t${deltaLine.place}`);
  console.log(`SUMMARY plant against ${findItem(pointList, pointList.length - 1)}`);
}
