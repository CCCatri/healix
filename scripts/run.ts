/** The runner: for each pair of tables it reports which records the judge and the product hold to be the same thing, and how far each statement can be trusted, from the tables alone. A record is its content; its row is only where it was read. Truth exists only where a construction made it: a record built as a copy of another is the same thing (conserved, keyed by the source's body: its fields less the numbering fields the judge's cells found); a chimera's donor that shares no piece with the chimera's other donors in any measured view is a different thing (contradicted, K1'); every other pair is unknown, and a claim on it is uncertain, never false. A judge count is printed with the most it could have reached; where it could only be zero it is printed as none with the reason (a rank-0 pair can be right only where pairs inside are at least as many as pairs across). Line kinds: RECORDS (the record law's and the view law's own counts: uneven rows, blank lines and open quotes per part, columns per part, unaligned columns, and per view the records missing the field on each side; printed so no parse or alignment decision passes without a record), CLAIMS (the product's claims, and its ties and unshared records per side: its unknowns), FLOOR (inside, across, and whether rank 0 can be right), SEGMENT and BUILT (judge), PRODUCT (claims as conserved, contradicted, uncertain, beside the refutation rule's rulings), ORDER, SWAP and COLUMNS (the same answers under reversed rows, exchanged tables and reversed fields; mismatches are the size of the two answer sets' difference; COLUMNS says nothing where no field moved; fieldsMoved counts the non-numbering views, matched by header, whose column index differs between the forward run and the run with every field reversed), COPIES, LINK (every link cell between two views inside a table: observed, expected and upper tail of their pairs inside, against the links' bar, with the door's reading), RULINGS (each built table's right, refuted and unknown claims), COST; every CRITERION line carries its own null (see printCriteria and measureNull) and judges its R only where that null reads yes. control is the judge's right count on built known-different pairs (K1'): it exists only on tables built with chimera donors (chimera, planted: differentRight and the knownDifferent line's right) and is printed as control none controlWhy noBuiltControl on every other table. argv: the tests directory. Not derived from the data, and declared here: the construction sizes (every 2nd record, every 4th, three residues) and the construction API's -1 for "no field shortened". */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Key } from "../src/matrix.ts";
import { Matrix, findSlot, findItem, judgeEvidence } from "../src/matrix.ts";
import type { Part } from "../src/record.ts";
import { listRows, constructReversed, judgeOrder } from "../src/record.ts";
import { listRuns } from "../src/piece.ts";
import type { Pieces } from "../src/piece.ts";
import { priceAcross } from "../src/price.ts";
import type { Claim } from "../src/claim.ts";
import { constructClaims } from "../src/claim.ts";
import { constructShortened, constructChimera, constructDoubled, constructPlanted, constructPermuted, readField } from "../src/construction.ts";
import type { Judged, Rulings, PairAt } from "./judge.ts";
import { joinPair, readRecord, readBody, constructPieces, judgeTables, judgeClaims, compareAnswers } from "./judge.ts";

const testsRoot = findItem(process.argv.slice(2), 0);
const readTable = (relativePath: string): Uint8Array => new Uint8Array(readFileSync(`${testsRoot}/${relativePath}`));
const emptyKeys: ReadonlySet<string> = new Set<string>();

type Verdicts = { readonly conserved: number; readonly contradicted: number; readonly uncertain: number };
type Different = { readonly differentKeys: ReadonlySet<string>; readonly pairs: number; readonly rejected: number; readonly unmeasured: number; readonly emptyDonated: number; readonly unpieced: number; readonly agreeOne: number; readonly agreeMore: number; readonly aligned: number; readonly right: number; readonly ratioList: readonly number[]; readonly donatedKeys: ReadonlySet<string> };

/** A judge count with the most it could reach; none, with the reason, where it could only be zero. */
function showReach(judgedTables: Judged, countValue: number, reachValue: number, fieldName: string): string {
  if (!judgedTables.reachable) return `${fieldName} none ${fieldName}Reach 0 ${fieldName}Why rankZeroCannotBeRight`;
  if (reachValue === 0) return `${fieldName} none ${fieldName}Reach 0 ${fieldName}Why nothingToJudge`;
  return `${fieldName} ${countValue} ${fieldName}Reach ${reachValue}`;
}

/** Claims as conserved, contradicted and uncertain; a side with no built truth prints none. */
function showClaims(claimVerdicts: Verdicts, claimCount: number, hasSame: boolean, hasDifferent: boolean): string {
  return `claims ${claimCount} conserved ${hasSame ? claimVerdicts.conserved : "none"} contradicted ${hasDifferent ? claimVerdicts.contradicted : "none"} uncertain ${claimVerdicts.uncertain}`;
}

/** Built copies as pair contents, source and copy. */
function collectTwins(judgedTables: Judged, twinList: readonly (readonly [number, number])[]): ReadonlySet<string> {
  return new Set(twinList.map(([sourceAt, copyAt]) => joinPair(readRecord(judgedTables.cellMatrix, judgedTables.partA, sourceAt), readRecord(judgedTables.cellMatrix, judgedTables.partB, copyAt))));
}

/** Built copies as known-same keys: the source's body with the copy's content, so any record with the source's body is the same thing. */
function collectSame(judgedTables: Judged, twinList: readonly (readonly [number, number])[]): ReadonlySet<string> {
  return new Set(twinList.map(([sourceAt, copyAt]) => joinPair(readBody(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partA.records, sourceAt)), judgedTables.numberingFields), readRecord(judgedTables.cellMatrix, judgedTables.partB, copyAt))));
}

/** Built copies the judge priced right. */
function countRight(judgedTables: Judged, twinList: readonly (readonly [number, number])[]): number {
  const twinKeys = collectTwins(judgedTables, twinList);
  return [...twinKeys].filter((twinKey) => judgedTables.rightKeys.has(twinKey)).length;
}

/** Distinct contents that appear more than once. */
function countRepeats(textList: readonly string[]): number {
  const sortedTexts = [...textList].sort();
  return sortedTexts.filter((textItem, textAt) => textAt > 0 && findItem(sortedTexts, textAt - 1) === textItem && (textAt === 1 || findItem(sortedTexts, textAt - 2) !== textItem)).length;
}

/** K1': for each chimera and each donor of a measured, non-numbering field, the pair is a different thing where no other content donor shares a piece with the donor in any measured view, the donated field has bytes, and donor and chimera share a piece in at least one measured view. */
function certifyDifferent(judgedTables: Judged, donorList: readonly (readonly number[])[]): Different {
  const cellMatrix = judgedTables.cellMatrix;
  const measuredFields = judgedTables.priced.views.map((viewAt) => findItem(judgedTables.piecesPerView, viewAt).view.index);
  const sharePiece = (leftPieces: readonly Key[], rightPieces: readonly Key[]): boolean => leftPieces.some((leftKey) => rightPieces.some((rightKey) => Buffer.compare(cellMatrix.listBytes(leftKey), cellMatrix.listBytes(rightKey)) === 0));
  const countAgreeing = (leftAt: number, rightAt: number, onRight: boolean): number => judgedTables.priced.views.filter((viewAt) => { const viewPieces = findItem(judgedTables.piecesPerView, viewAt); return sharePiece(findItem(viewPieces.a, leftAt), findItem(onRight ? viewPieces.b : viewPieces.a, rightAt)); }).length;
  const differentKeys = new Set<string>();
  const donatedKeys = new Set<string>();
  const ratioList: number[] = [];
  let pairCount = 0; let rejectedCount = 0; let unmeasuredCount = 0; let emptyCount = 0; let unpiecedCount = 0; let agreeOne = 0; let agreeMore = 0; let alignedCount = 0; let rightCount = 0;
  donorList.forEach((donorRows, chimeraAt) => donorRows.forEach((donorAt, fieldAt) => {
    if (judgedTables.numberingFields.includes(fieldAt)) return;
    if (!measuredFields.includes(fieldAt)) { unmeasuredCount += 1; return; }
    const otherDonors = donorRows.flatMap((otherAt, otherField) => (judgedTables.numberingFields.includes(otherField) || otherField === fieldAt ? [] : [otherAt]));
    if (otherDonors.some((otherAt) => countAgreeing(otherAt, donorAt, false) > 0)) { rejectedCount += 1; return; }
    const donorBytes = cellMatrix.listBytes(findItem(judgedTables.partA.records, donorAt));
    if (readField(donorBytes, fieldAt).length === 0) { emptyCount += 1; return; }
    const agreeCount = countAgreeing(donorAt, chimeraAt, true);
    if (agreeCount === 0) { unpiecedCount += 1; return; }
    pairCount += 1;
    if (agreeCount === 1) agreeOne += 1; else agreeMore += 1;
    if (Buffer.compare(readField(donorBytes, fieldAt), readField(cellMatrix.listBytes(findItem(judgedTables.partB.records, chimeraAt)), fieldAt)) !== 0) alignedCount += 1;
    if (judgedTables.rightKeys.has(joinPair(readRecord(cellMatrix, judgedTables.partA, donorAt), readRecord(cellMatrix, judgedTables.partB, chimeraAt)))) rightCount += 1;
    const differentKey = joinPair(readBody(donorBytes, judgedTables.numberingFields), readRecord(cellMatrix, judgedTables.partB, chimeraAt));
    differentKeys.add(differentKey); donatedKeys.add(`${differentKey}\u0003${fieldAt}`);
    ratioList.push(priceAcross(judgedTables.priced, donorAt, chimeraAt).chance / judgedTables.chanceBar);
  }));
  return { differentKeys, pairs: pairCount, rejected: rejectedCount, unmeasured: unmeasuredCount, emptyDonated: emptyCount, unpieced: unpiecedCount, agreeOne, agreeMore, aligned: alignedCount, right: rightCount, ratioList, donatedKeys };
}

/** The product's claims against built truth, by the claimed A record's body and the B record's content. */
function countClaims(judgedTables: Judged, sameKeys: ReadonlySet<string>, differentKeys: ReadonlySet<string>): Verdicts {
  let conservedCount = 0; let contradictedCount = 0;
  for (const claimItem of judgedTables.claims) {
    const claimKey = joinPair(readBody(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partA.records, claimItem.a)), judgedTables.numberingFields), readRecord(judgedTables.cellMatrix, judgedTables.partB, claimItem.b));
    if (sameKeys.has(claimKey)) conservedCount += 1;
    else if (differentKeys.has(claimKey)) contradictedCount += 1;
  }
  return { conserved: conservedCount, contradicted: contradictedCount, uncertain: judgedTables.claims.length - conservedCount - contradictedCount };
}

/** FLOOR, ORDER, SWAP and COLUMNS for one judged pair of tables. */
/** The claims' digest (claimsDigest): each claimed pair is the sha256 of its A record's own bytes beside the sha256 of its B record's, the pairs sorted and the list hashed, so a row's position never enters: reordering rows cannot move it, and claim sets of equal count with different pairs read different. */
function digestClaims(cellMatrix: Matrix, partA: Part, partB: Part, claimList: readonly Claim[]): string {
  const pairTexts = claimList.map((claimItem) => `${createHash("sha256").update(cellMatrix.listBytes(findItem(partA.records, claimItem.a))).digest("hex")}:${createHash("sha256").update(cellMatrix.listBytes(findItem(partB.records, claimItem.b))).digest("hex")}`);
  return createHash("sha256").update(pairTexts.sort().join("\n")).digest("hex");
}
/** The digest's own plant per table: the first two claims with their B records exchanged, equal count and different pairs, must read differs; none where the swap cannot change the pairs: the table has fewer than two claims, or the two B records hold equal bytes, or the two A records do. */
function digestSwapped(judgedTables: Judged, claimsDigest: string): string {
  if (judgedTables.claims.length < 2) return "none";
  const firstClaim = findItem(judgedTables.claims, 0); const secondClaim = findItem(judgedTables.claims, 1);
  if (Buffer.compare(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partB.records, firstClaim.b)), judgedTables.cellMatrix.listBytes(findItem(judgedTables.partB.records, secondClaim.b))) === 0) return "none";
  if (Buffer.compare(judgedTables.cellMatrix.listBytes(findItem(judgedTables.partA.records, firstClaim.a)), judgedTables.cellMatrix.listBytes(findItem(judgedTables.partA.records, secondClaim.a))) === 0) return "none";
  const swappedClaims = [{ ...firstClaim, b: secondClaim.b }, { ...secondClaim, b: firstClaim.b }, ...judgedTables.claims.slice(2)];
  return digestClaims(judgedTables.cellMatrix, judgedTables.partA, judgedTables.partB, swappedClaims) === claimsDigest ? "same" : "differs";
}
function printChecks(tableLabel: string, judgedTables: Judged, bytesA: Uint8Array, bytesB: Uint8Array): void {
  const pricedTables = judgedTables.priced;
  console.log(`FLOOR ${tableLabel} recordsA ${pricedTables.recordsA} recordsB ${pricedTables.recordsB} inside ${pricedTables.inside} insideSame ${pricedTables.insideSame} across ${pricedTables.across} rankZeroCanBeRight ${judgedTables.reachable ? "yes" : "no"}`);
  console.log(`RECORDS ${tableLabel} unevenA ${judgedTables.partA.uneven} blanksA ${judgedTables.partA.blanks} openQuotesA ${judgedTables.partA.openQuotes} unevenB ${judgedTables.partB.uneven} blanksB ${judgedTables.partB.blanks} openQuotesB ${judgedTables.partB.openQuotes} columnsA ${judgedTables.viewSet.columnsA} columnsB ${judgedTables.viewSet.columnsB} unaligned ${judgedTables.viewSet.unaligned} absent [${judgedTables.viewSet.views.map((viewItem) => `${Buffer.from(judgedTables.cellMatrix.listBytes(viewItem.a.header)).toString("latin1")}:${viewItem.a.absent}/${viewItem.b.absent}`).join(" ")}]`);
  const backwardTables = judgeTables(constructReversed(bytesA, listRows(bytesA).rows), constructReversed(bytesB, listRows(bytesB).rows));
  const claimsDigest = digestClaims(judgedTables.cellMatrix, judgedTables.partA, judgedTables.partB, judgedTables.claims);
  const reversedWord = digestClaims(backwardTables.cellMatrix, backwardTables.partA, backwardTables.partB, backwardTables.claims) === claimsDigest ? "same" : "differs";
  console.log(`CLAIMS ${tableLabel} claims ${judgedTables.claims.length} digest ${claimsDigest} reversedDigest ${reversedWord} swappedDigest ${digestSwapped(judgedTables, claimsDigest)} tiesA ${judgedTables.productAll.tiesA} tiesB ${judgedTables.productAll.tiesB} unsharedA ${judgedTables.productAll.unsharedA} unsharedB ${judgedTables.productAll.unsharedB}`);
  const orderWay = (orderCell: Key): string => judgedTables.cellMatrix.judgeWay(orderCell, () => "yes", () => "no", () => "unknown");
  const recordsOrderA = orderWay(judgeOrder(judgedTables.cellMatrix, bytesA, judgedTables.partA)); const recordsOrderB = orderWay(judgeOrder(judgedTables.cellMatrix, bytesB, judgedTables.partB));
  console.log(`ORDER ${tableLabel} recordsA ${recordsOrderA} recordsB ${recordsOrderB} ${compareAnswers(judgedTables, backwardTables, false, false, "reversed")}`);
  console.log(`SWAP ${tableLabel} ${compareAnswers(judgedTables, judgeTables(bytesB, bytesA), true, false, "swapped")}`);
  const permutedTables = judgeTables(constructPermuted(bytesA), constructPermuted(bytesB));
  const headerPlace = (viewTables: Judged, viewPieces: Pieces): string => joinPair(Buffer.from(viewTables.cellMatrix.listBytes(viewPieces.view.a.header)).toString("latin1"), String(viewPieces.view.index));
  const permutedPlaces = new Set(permutedTables.piecesPerView.map((viewPieces) => headerPlace(permutedTables, viewPieces)));
  const fieldsMoved = judgedTables.piecesPerView.filter((viewPieces) => !permutedPlaces.has(headerPlace(judgedTables, viewPieces))).length;
  const measuredNames = (viewTables: Judged): string => viewTables.priced.views.map((viewAt) => Buffer.from(viewTables.cellMatrix.listBytes(findItem(viewTables.piecesPerView, viewAt).view.a.header)).toString("latin1")).join("|");
  let deltaMax = 0;
  for (const pairIndex of pricedTables.touchedAcross) deltaMax = Math.max(deltaMax, Math.abs(findSlot(pricedTables.acrossScore, pairIndex) - findSlot(permutedTables.priced.acrossScore, pairIndex)));
  const scoreText = pricedTables.touchedAcross.length > 0 ? String(deltaMax) : "none";
  const answerText = fieldsMoved > 0 ? compareAnswers(judgedTables, permutedTables, false, true, "permuted") : "claims none permuted none mismatches none right none permutedRight none rightMismatches none columnsWhy noFieldMoved";
  console.log(`COLUMNS ${tableLabel} fieldsMoved ${fieldsMoved} ${answerText} scoreDelta ${scoreText} viewsForward [${measuredNames(judgedTables)}] viewsPermuted [${measuredNames(permutedTables)}]`);
}

/** The pairs across the judge priced at all. */
function pricedCount(judgedTables: Judged): number { return judgedTables.priced.touchedAcross.length; }

/** MULT (variety map, printed every run): per table and view, the shared pieces by multiplicity class (1,1), (1,k+), (k+,1), (k+,k+) as (A records, B records holding it), the pairs each class touches, and the A records holding a (1,1) piece; a print, it decides nothing. CRITERION (criterion.crossGroup, approved): for each view group R of a judged pair of tables, the product's claims are rebuilt from the other groups only, and that held-out set's agreement on R (sharing at least one piece in R's views) is read against u, the exact share of all pairs across that agree on R. The control pairs each claimed A record with a B record chosen by the SHA-256 of its content mod |B|, no piece read. Conserved and contradicted come from built truth only (copies; K1' donors, each contradicted claim left out of its donated field's group). Every share is kept as two counts. All lines print at the end, once m, the number of planned comparisons (one control per group, plus one copies check where copies were built, plus one K1' check where donors were built), fixes z = the inverse normal at 1 - 1/(2m): about one false flag across all m. Precision (held share - u)/(copies share - u) and the estimated right claims (precision x held claims) print only where the copies check is testable (1 - u at least the bar) and passes. invertNormal is Acklam's rational approximation (relative error about 1e-9); its coefficients are his, not chosen here. */
type Tally = { readonly agree: number; readonly total: number };
type Criterion = { readonly tableLabel: string; readonly groupName: string; readonly touchedCount: number; readonly acrossCount: number; readonly control: Tally; readonly held: Tally; readonly conserved: Tally; readonly contradicted: Tally; readonly uncertain: Tally; readonly hasSame: boolean; readonly hasDifferent: boolean; readonly claimNames: readonly string[]; readonly groupViewNames: readonly string[] };
const criterionList: Criterion[] = [];
type NullPieces = { readonly cellMatrix: Matrix; readonly partA: Part; readonly partB: Part; readonly piecesPerView: readonly Pieces[] };
const nullSources: { readonly source: string; readonly pieced: NullPieces }[] = [];
const centralTop = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const centralBottom = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01, 1];
const tailTop = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const tailBottom = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00, 1];

/** A polynomial by Horner's rule, coefficients from the highest power. */
function foldHorner(coefList: readonly number[], pointValue: number): number { return coefList.reduce((sumSoFar, coefValue) => sumSoFar * pointValue + coefValue); }

/** The inverse of the standard normal distribution (Acklam). */
function invertNormal(probValue: number): number {
  const tailBreak = 0.02425;
  if (probValue < tailBreak) { const tailRoot = Math.sqrt(-2 * Math.log(probValue)); return foldHorner(tailTop, tailRoot) / foldHorner(tailBottom, tailRoot); }
  if (probValue <= 1 - tailBreak) { const centralShift = probValue - 0.5; const centralSquare = centralShift * centralShift; return foldHorner(centralTop, centralSquare) * centralShift / foldHorner(centralBottom, centralSquare); }
  const upperRoot = Math.sqrt(-2 * Math.log(1 - probValue)); return -foldHorner(tailTop, upperRoot) / foldHorner(tailBottom, upperRoot);
}

/** One table's CRITERION counts, one record per view group. */
function measureCriterion(tableLabel: string, judgedTables: Judged, sameKeys: ReadonlySet<string>, donatedKeys: ReadonlySet<string>, hasSame: boolean, hasDifferent: boolean): void {
  const cellMatrix = judgedTables.cellMatrix;
  const countB = judgedTables.partB.records.length;
  const allViews = [...judgedTables.piecesPerView.keys()];
  for (const viewAt of allViews) {
    const sharedRuns = listRuns(cellMatrix, findItem(judgedTables.piecesPerView, viewAt)).map((pieceRun) => ({ runA: pieceRun.filter((runTag) => runTag.part === 0).map((runTag) => runTag.record), sizeB: pieceRun.filter((runTag) => runTag.part === 1).length })).filter((pieceRun) => pieceRun.runA.length > 0 && pieceRun.sizeB > 0);
    const showClass = (nameText: string, keepRun: (sizeA: number, sizeB: number) => boolean): string => {
      const classRuns = sharedRuns.filter((pieceRun) => keepRun(pieceRun.runA.length, pieceRun.sizeB));
      let pairTotal = 0;
      for (const pieceRun of classRuns) pairTotal += pieceRun.runA.length * pieceRun.sizeB;
      return `pieces${nameText} ${classRuns.length} pairs${nameText} ${pairTotal}`;
    };
    const holdersA = new Set(sharedRuns.filter((pieceRun) => pieceRun.runA.length === 1 && pieceRun.sizeB === 1).map((pieceRun) => findItem(pieceRun.runA, 0)));
    console.log(`MULT ${tableLabel} view [${Buffer.from(cellMatrix.listBytes(findItem(judgedTables.piecesPerView, viewAt).view.a.header)).toString("latin1")}] ${showClass("11", (sizeA, sizeB) => sizeA === 1 && sizeB === 1)} ${showClass("1k", (sizeA, sizeB) => sizeA === 1 && sizeB > 1)} ${showClass("k1", (sizeA, sizeB) => sizeA > 1 && sizeB === 1)} ${showClass("kk", (sizeA, sizeB) => sizeA > 1 && sizeB > 1)} recordsA11 ${holdersA.size} recordsA ${judgedTables.partA.records.length} recordsB ${countB}`);
  }
  for (const linkCell of judgedTables.linkCells) {
    const linkValue = cellMatrix.listCell(linkCell);
    const linkNames = linkValue.readKeys.map((headerKey) => Buffer.from(cellMatrix.listBytes(headerKey)).toString("latin1")).join("|");
    const linkWord = cellMatrix.judgeWay(linkCell, () => "yes", () => "no", () => "unknown");
    const linkWhy = findItem(linkValue.numbers, 4) === 0 || findItem(linkValue.numbers, 5) === 0 ? "noPairs" : "notBeyondChance";
    console.log(`LINK ${tableLabel} views [${linkNames}] observed ${findItem(linkValue.numbers, 0)} expected ${findItem(linkValue.numbers, 1)} upperTail ${findItem(linkValue.numbers, 2)} bar ${judgedTables.linkBar} totalPairs ${findItem(linkValue.numbers, 3)} leftPairs ${findItem(linkValue.numbers, 4)} rightPairs ${findItem(linkValue.numbers, 5)} link ${linkWord}${linkWord === "unknown" ? ` linkWhy ${linkWhy}` : ""}`);
  }
  const fieldGroups = (keyText: string): number[] => [...Array(judgedTables.partA.headerFields).keys()].filter((fieldAt) => donatedKeys.has(`${keyText}\u0003${fieldAt}`)).map((fieldAt) => judgedTables.viewGroups.findIndex((memberViews) => memberViews.some((viewAt) => findItem(judgedTables.piecesPerView, viewAt).view.index === fieldAt)));
  const claimKey = (claimItem: Claim): string => joinPair(readBody(cellMatrix.listBytes(findItem(judgedTables.partA.records, claimItem.a)), judgedTables.numberingFields), readRecord(cellMatrix, judgedTables.partB, claimItem.b));
  const controlPairs: PairAt[] = judgedTables.claims.map((claimItem) => ({ a: claimItem.a, b: createHash("sha256").update(cellMatrix.listBytes(findItem(judgedTables.partA.records, claimItem.a))).digest().readUInt32BE(0) % countB }));
  const nameView = (viewAt: number): string => Buffer.from(cellMatrix.listBytes(findItem(judgedTables.piecesPerView, viewAt).view.a.header)).toString("latin1");
  judgedTables.viewGroups.forEach((memberViews, groupAt) => {
    const touchedPairs = new Uint8Array(judgedTables.partA.records.length * countB);
    for (const viewAt of memberViews) for (const pieceRun of listRuns(cellMatrix, findItem(judgedTables.piecesPerView, viewAt))) {
      const runA = pieceRun.filter((runTag) => runTag.part === 0); const runB = pieceRun.filter((runTag) => runTag.part === 1);
      for (const tagA of runA) for (const tagB of runB) touchedPairs[tagA.record * countB + tagB.record] = 1;
    }
    let touchedCount = 0;
    touchedPairs.forEach((flagValue) => { touchedCount += flagValue; });
    const tallyPairs = (pairList: readonly PairAt[]): Tally => ({ agree: pairList.filter((pairItem) => findSlot(touchedPairs, pairItem.a * countB + pairItem.b) === 1).length, total: pairList.length });
    const heldViews = allViews.filter((viewAt) => !memberViews.includes(viewAt));
    const heldClaims: readonly Claim[] = heldViews.length > 0 ? constructClaims(cellMatrix, judgedTables.piecesPerView, heldViews, judgedTables.partA.records, judgedTables.partB.records).claims : [];
    const classedClaims = heldClaims.map((claimItem) => ({ pairItem: { a: claimItem.a, b: claimItem.b }, keyText: claimKey(claimItem) }));
    const conservedPairs = classedClaims.filter((classItem) => sameKeys.has(classItem.keyText)).map((classItem) => classItem.pairItem);
    const contradictedPairs = classedClaims.filter((classItem) => !sameKeys.has(classItem.keyText) && fieldGroups(classItem.keyText).length > 0 && !fieldGroups(classItem.keyText).includes(groupAt)).map((classItem) => classItem.pairItem);
    const uncertainPairs = classedClaims.filter((classItem) => !sameKeys.has(classItem.keyText) && fieldGroups(classItem.keyText).length === 0).map((classItem) => classItem.pairItem);
    const groupName = memberViews.map((viewAt) => Buffer.from(cellMatrix.listBytes(findItem(judgedTables.piecesPerView, viewAt).view.a.header)).toString("latin1")).join("+");
    criterionList.push({ tableLabel, groupName, touchedCount, acrossCount: judgedTables.partA.records.length * countB, control: tallyPairs(controlPairs), held: tallyPairs(classedClaims.map((classItem) => classItem.pairItem)), conserved: tallyPairs(conservedPairs), contradicted: tallyPairs(contradictedPairs), uncertain: tallyPairs(uncertainPairs), hasSame, hasDifferent, claimNames: heldViews.map(nameView), groupViewNames: memberViews.map(nameView) });
  });
}

/** A held-out share, or none with its reason. */
function showShare(tallyItem: Tally, fieldName: string, isBuilt: boolean): string {
  if (!isBuilt) return `${fieldName} none ${fieldName}Why noBuiltTruth`;
  if (tallyItem.total === 0) return `${fieldName} none ${fieldName}Why noClaims`;
  return `${fieldName} ${tallyItem.agree / tallyItem.total} ${fieldName}N ${tallyItem.total}`;
}

/** One table's rulings on its own claims (right, refuted, unknown); printed for every built table. */
function printRulings(tableLabel: string, rulingsItem: Rulings): void { console.log(`RULINGS ${tableLabel} right ${rulingsItem.right} refuted ${rulingsItem.refuted} unknown ${rulingsItem.unknown}`); }

/** A table's source: the name after a construction's prefix, or a read table's part A where a chimera is built from it; nothing otherwise. */
function listSources(tableLabel: string): string[] {
  const labelParts = tableLabel.split(":");
  if (labelParts.length >= 2) return [findItem(labelParts, 1)];
  return segmentList.filter((segmentItem) => segmentItem.name === tableLabel).flatMap((segmentItem) => [...builtSources, ...nullOnlySources].filter((builtSource) => builtSource.path === segmentItem.pathA).map((builtSource) => builtSource.name));
}

/** A held-out group's null, built from its line's own question: on its source's chimera (every claim false by construction), the claims rebuilt from the same claiming fields, tallied on the same R fields, against that chimera's own u. Nothing where the source has no chimera, the line has no claiming field, or a field is not a view there. */
function measureNull(sourceList: readonly string[], claimNames: readonly string[], groupViewNames: readonly string[]): { readonly agree: number; readonly total: number; readonly touched: number; readonly across: number }[] {
  return nullSources.filter((nullSource) => sourceList.includes(nullSource.source)).flatMap((nullSource) => {
    const piecedNull = nullSource.pieced;
    const findViews = (nameText: string): number[] => [...piecedNull.piecesPerView.keys()].filter((viewAt) => Buffer.from(piecedNull.cellMatrix.listBytes(findItem(piecedNull.piecesPerView, viewAt).view.a.header)).toString("latin1") === nameText);
    const claimAts = claimNames.flatMap(findViews);
    const groupAts = groupViewNames.flatMap(findViews);
    const viewsFound = claimAts.length > 0 && claimAts.length === claimNames.length && groupAts.length === groupViewNames.length;
    const tallyNull = (): { readonly agree: number; readonly total: number; readonly touched: number; readonly across: number } => {
      const countB = piecedNull.partB.records.length;
      const touchedPairs = new Uint8Array(piecedNull.partA.records.length * countB);
      for (const viewAt of groupAts) for (const pieceRun of listRuns(piecedNull.cellMatrix, findItem(piecedNull.piecesPerView, viewAt))) {
        const runA = pieceRun.filter((runTag) => runTag.part === 0); const runB = pieceRun.filter((runTag) => runTag.part === 1);
        for (const tagA of runA) for (const tagB of runB) touchedPairs[tagA.record * countB + tagB.record] = 1;
      }
      let touchedCount = 0;
      touchedPairs.forEach((flagValue) => { touchedCount += flagValue; });
      const nullClaims = constructClaims(piecedNull.cellMatrix, piecedNull.piecesPerView, claimAts, piecedNull.partA.records, piecedNull.partB.records).claims;
      return { agree: nullClaims.filter((claimItem) => findSlot(touchedPairs, claimItem.a * countB + claimItem.b) === 1).length, total: nullClaims.length, touched: touchedCount, across: piecedNull.partA.records.length * countB };
    };
    return viewsFound ? [tallyNull()] : [];
  });
}

/** Every CRITERION line, after the structure has fixed m. The null gate: a line with no held claims reads unknown noClaims and builds no null; every other line's null is measureNull's tally; with claims and power on both sides (min(u, 1 - u) at least its step) its evidence is a chance toward (|held - u| at most the step) and a chance against (the step at most |held - u|) through judgeEvidence, reading yes, no, or unknown at the edge; without claims or power no evidence exists and it reads unknown, its reason a cell [N, u, step]. A line reads its R (copiesCheck, contradictedCheck, precision) only where its null reads yes; otherwise those read unknown naming why, each beside its own reading (copiesOwn, contradictedOwn, ownPrecision with ownPrecisionWhy and ownRightEstimate), every key once per line. Each null's step is its own: z the inverse normal at 1 - 1/(2(N + 1)), N the null's own claims, at the chance bar 1/(N + 1); the nulls are not counted into m, so the criterion's z is unchanged. */
function printCriteria(): void {
  const nullRuns = criterionList.map((criterionItem) => {
    const sourceList = listSources(criterionItem.tableLabel);
    return { criterionItem, sourceList, nullList: criterionItem.held.total > 0 ? measureNull(sourceList, criterionItem.claimNames, criterionItem.groupViewNames) : [] };
  });
  let plannedChecks = 0;
  for (const criterionItem of criterionList) plannedChecks += 1 + (criterionItem.hasSame ? 1 : 0) + (criterionItem.hasDifferent ? 1 : 0);
  const zValue = invertNormal(1 - 1 / (2 * plannedChecks));
  console.log(`CRITERIONPLAN comparisons ${plannedChecks} z ${zValue} expectedFalseFlags 1 (two-sided, each comparison flags by chance with probability 1/${plannedChecks})`);
  const nullMatrix = new Matrix();
  for (const nullRun of nullRuns) {
    const criterionItem = nullRun.criterionItem;
    const uValue = criterionItem.touchedCount / criterionItem.acrossCount;
    const barOf = (tallyItem: Tally): number => zValue * Math.sqrt(uValue * (1 - uValue) / tallyItem.total);
    const controlText = criterionItem.control.total > 0 ? `controlBar ${barOf(criterionItem.control)} controlStep ${1 / criterionItem.control.total} controlCheck ${Math.abs(criterionItem.control.agree / criterionItem.control.total - uValue) <= barOf(criterionItem.control) ? "atU" : "offU"}` : "controlCheck none";
    const copiesKnown = criterionItem.hasSame && criterionItem.conserved.total > 0;
    const copiesTestable = copiesKnown && 1 - uValue >= barOf(criterionItem.conserved);
    const copiesAbove = copiesTestable && criterionItem.conserved.agree / criterionItem.conserved.total > uValue + barOf(criterionItem.conserved);
    const copiesWhy = !criterionItem.hasSame ? "noBuiltCopies" : !copiesKnown ? "noHeldOutCopies" : !copiesTestable ? "untestableOneMinusUBelowBar" : "copiesNotAboveU";
    const contradictedWords = criterionItem.hasDifferent && criterionItem.contradicted.total > 0 ? [Math.abs(criterionItem.contradicted.agree / criterionItem.contradicted.total - uValue) <= barOf(criterionItem.contradicted) ? "nearU" : "offU"] : [];
    const contradictedText = contradictedWords.length === 1 ? `contradictedCheck ${findItem(contradictedWords, 0)}` : "contradictedCheck none";
    const heldKnown = criterionItem.held.total > 0;
    const precisionValue = copiesAbove && heldKnown ? (criterionItem.held.agree / criterionItem.held.total - uValue) / (criterionItem.conserved.agree / criterionItem.conserved.total - uValue) : 0;
    const precisionKnown = copiesAbove && heldKnown;
    const precisionWhy = heldKnown ? copiesWhy : "noHeldOutClaims";
    const estimateValue = precisionValue * criterionItem.held.total;
    const precisionText = precisionKnown ? `precision ${precisionValue} rightEstimate ${estimateValue}` : `precision none precisionWhy ${precisionWhy} rightEstimate none`;
    const ownPrecisionText = precisionKnown ? `ownPrecision ${precisionValue} ownPrecisionWhy measured ownRightEstimate ${estimateValue}` : `ownPrecision none ownPrecisionWhy ${precisionWhy} ownRightEstimate none`;
    const nullReads = nullRun.nullList.map((nullTally) => {
      const nullU = nullTally.touched / nullTally.across;
      const stepList = nullTally.total > 0 ? [invertNormal(1 - 1 / (2 * (nullTally.total + 1))) * Math.sqrt((nullU * (1 - nullU)) / nullTally.total)] : [];
      const shareList = nullTally.total > 0 ? [nullTally.agree / nullTally.total] : [];
      const poweredSteps = stepList.filter((stepValue) => Math.min(nullU, 1 - nullU) >= stepValue);
      const nameKey = nullMatrix.writeBytes(Buffer.from(`${criterionItem.tableLabel}\u0003${criterionItem.groupName}`, "latin1"));
      const reasonCell = nullMatrix.writeCell(judgeEvidence({ toward: [], against: [], found: [], census: [] }, nameKey), [nameKey], [nullTally.total, nullU, ...stepList]);
      const towardList = poweredSteps.flatMap((stepValue) => shareList.map((shareValue) => ({ chance: Math.abs(shareValue - nullU), bar: stepValue })));
      const againstList = poweredSteps.flatMap((stepValue) => shareList.map((shareValue) => ({ chance: stepValue, bar: Math.abs(shareValue - nullU) })));
      const nullCell = nullMatrix.writeCell(judgeEvidence({ toward: towardList, against: againstList, found: [], census: [] }, reasonCell), [reasonCell], [nullTally.total, nullU, ...shareList, ...stepList]);
      const nullWord = nullMatrix.judgeWay(nullCell, () => "yes", () => "no", () => "unknown");
      const whyText = nullTally.total === 0 ? "nullNoClaims" : poweredSteps.length === 0 ? "nullNoPower" : nullWord === "unknown" ? "atEdge" : "measured";
      return { nullWord, whyText, nullTotal: nullTally.total, nullU, shareList, stepList };
    });
    const judgeOpen = nullReads.length === 1 && findItem(nullReads, 0).nullWord === "yes";
    const closedWhy = !heldKnown ? "noClaims" : nullReads.length === 1 ? `null${findItem(nullReads, 0).nullWord}:${findItem(nullReads, 0).whyText}` : nullRun.sourceList.length === 0 ? "noNullBuilt" : criterionItem.claimNames.length === 0 ? "noClaimingFields" : "noNullViews";
    const nullTokens = nullReads.length === 1 ? (() => { const nullRead = findItem(nullReads, 0); return `null ${nullRead.nullWord} nullWhy ${nullRead.whyText} nullN ${nullRead.nullTotal} nullU ${nullRead.nullU} nullHeld ${nullRead.shareList.length === 1 ? String(findItem(nullRead.shareList, 0)) : "none"} nullStep ${nullRead.stepList.length === 1 ? String(findItem(nullRead.stepList, 0)) : "none"}`; })() : `null none nullWhy ${closedWhy}`;
    const copiesOwn = copiesAbove ? "aboveU" : copiesWhy;
    const copiesText = judgeOpen ? copiesOwn : `unknown copiesCheckWhy ${closedWhy} copiesOwn ${copiesOwn}`;
    const judgedContradicted = judgeOpen || contradictedWords.length === 0 ? contradictedText : `contradictedCheck unknown contradictedCheckWhy ${closedWhy} contradictedOwn ${findItem(contradictedWords, 0)}`;
    const judgedPrecision = judgeOpen ? precisionText : `precision none precisionWhy ${closedWhy} rightEstimate none ${ownPrecisionText}`;
    console.log(`CRITERION ${criterionItem.tableLabel} R [${criterionItem.groupName}] u ${uValue} ${showShare(criterionItem.control, "control", true)} ${controlText} ${showShare(criterionItem.held, "held", true)} ${showShare(criterionItem.conserved, "conserved", criterionItem.hasSame)} copiesCheck ${copiesText} ${showShare(criterionItem.contradicted, "contradicted", criterionItem.hasDifferent)} ${judgedContradicted} ${showShare(criterionItem.uncertain, "uncertain", true)} ${judgedPrecision} ${nullTokens}`);
  }
}

type Segment = { readonly name: string; readonly pathA: string; readonly pathB: string; readonly pairsPaths: readonly string[] };
const segmentList: readonly Segment[] = [
  { name: "c2_copy", pathA: "positive/c2_copy/tableA.csv", pathB: "positive/c2_copy/tableB.csv", pairsPaths: ["positive/c2_copy.pairs"] },
  { name: "c2_exact", pathA: "positive/c2_exact/tableA.csv", pathB: "positive/c2_exact/tableB.csv", pairsPaths: ["positive/c2_exact.pairs"] },
  { name: "c2_same", pathA: "unlabeled/c2_same/tableA_even.csv", pathB: "unlabeled/c2_same/tableA_odd.csv", pairsPaths: [] },
  { name: "fodors_zagat", pathA: "unlabeled/fodors_zagat/tableA.csv", pathB: "unlabeled/fodors_zagat/tableB.csv", pairsPaths: [] },
  { name: "dirty", pathA: "splits/dirty/1/tableA.csv", pathB: "splits/dirty/1/tableB.csv", pairsPaths: [] },
  { name: "beer", pathA: "splits/structured/beer/tableA.csv", pathB: "splits/structured/beer/tableB.csv", pairsPaths: [] },
];
for (const segmentItem of segmentList) {
  const startedAt = Date.now();
  const bytesA = readTable(segmentItem.pathA); const bytesB = readTable(segmentItem.pathB);
  const judgedTables = judgeTables(bytesA, bytesB);
  const cellMatrix = judgedTables.cellMatrix;
  const recordsTextA = new Set(judgedTables.partA.records.map((recordKey) => Buffer.from(cellMatrix.listBytes(recordKey)).toString("latin1")));
  const recordsTextB = new Set(judgedTables.partB.records.map((recordKey) => Buffer.from(cellMatrix.listBytes(recordKey)).toString("latin1")));
  const pairLines = segmentItem.pairsPaths.flatMap((pairsPath) => Buffer.from(readTable(pairsPath)).toString("latin1").split("\n").filter((lineText) => lineText.length > 0));
  const foundPairs = pairLines.map((lineText) => lineText.split("\t")).filter((lineParts) => recordsTextA.has(findItem(lineParts, 0)) && recordsTextB.has(findItem(lineParts, 1)));
  const twinKeys = new Set(foundPairs.map((lineParts) => joinPair(findItem(lineParts, 0), findItem(lineParts, 1))));
  const sameKeys = new Set(foundPairs.map((lineParts) => joinPair(readBody(Buffer.from(findItem(lineParts, 0), "latin1"), judgedTables.numberingFields), findItem(lineParts, 1))));
  const hasPairs = segmentItem.pairsPaths.length > 0;
  const twinsRight = [...twinKeys].filter((twinKey) => judgedTables.rightKeys.has(twinKey)).length;
  const nonTwinRight = [...judgedTables.rightKeys].filter((rightKey) => !twinKeys.has(rightKey)).length;
  const repeatCount = countRepeats(judgedTables.rightPairs.map((rightPair) => readRecord(cellMatrix, judgedTables.partA, rightPair.a))) + countRepeats(judgedTables.rightPairs.map((rightPair) => readRecord(cellMatrix, judgedTables.partB, rightPair.b)));
  const claimRulings = judgeClaims(judgedTables);
  const twinsText = hasPairs ? `${showReach(judgedTables, twinsRight, twinKeys.size, "twinsRight")} twinsTotal ${twinKeys.size} twinLines ${pairLines.length} nonTwinRight ${nonTwinRight}` : "twinsRight none twinsRightWhy noBuiltTwins";
  console.log(`SEGMENT ${segmentItem.name} ${showReach(judgedTables, judgedTables.rightPairs.length, pricedCount(judgedTables), "right")} refuted ${claimRulings.refuted} two ${repeatCount} ${twinsText} control none controlWhy noBuiltControl groups [${judgedTables.groupNames}]`);
  console.log(`PRODUCT ${segmentItem.name} ${showReach(judgedTables, claimRulings.right, judgedTables.claims.length, "right")} refuted ${claimRulings.refuted} unknown ${claimRulings.unknown} ${showClaims(countClaims(judgedTables, sameKeys, emptyKeys), judgedTables.claims.length, hasPairs, false)}`);
  printChecks(segmentItem.name, judgedTables, bytesA, bytesB);
  measureCriterion(segmentItem.name, judgedTables, sameKeys, emptyKeys, hasPairs, false);
  console.log(`COST ${segmentItem.name} inside ${judgedTables.priced.inside} across ${judgedTables.priced.across} workJudge ${judgedTables.priced.work} workIdentity ${judgedTables.priced.workIdentity} workProduct ${judgedTables.productWork} sweep ${judgedTables.priced.touchedAcross.length} cells ${cellMatrix.countCells()} seconds ${((Date.now() - startedAt) / 1000).toFixed(2)}`);
}

type Built = { readonly name: string; readonly path: string };
const builtSources: readonly Built[] = [{ name: "fodors_zagat/tableA", path: "unlabeled/fodors_zagat/tableA.csv" }, { name: "dirty/tableA", path: "splits/dirty/1/tableA.csv" }, { name: "beer/tableA", path: "splits/structured/beer/tableA.csv" }];
for (const builtSource of builtSources) {
  const chimeraTable = constructChimera(readTable(builtSource.path), 2);
  const judgedTables = judgeTables(chimeraTable.a, chimeraTable.b);
  nullSources.push({ source: builtSource.name, pieced: judgedTables });
  const differentPairs = certifyDifferent(judgedTables, chimeraTable.donors);
  console.log(`BUILT chimera ${builtSource.name} ${showReach(judgedTables, judgedTables.rightPairs.length, pricedCount(judgedTables), "right")} differentRight ${differentPairs.right} differentPairs ${differentPairs.pairs} ${showClaims(countClaims(judgedTables, emptyKeys, differentPairs.differentKeys), judgedTables.claims.length, false, true)}`);
  console.log(`BUILTNOTE chimera ${builtSource.name} skipped ${chimeraTable.skipped} (two source rows of the same body; not built)`);
  printChecks(`chimera:${builtSource.name}`, judgedTables, chimeraTable.a, chimeraTable.b);
  printRulings(`chimera:${builtSource.name}`, judgeClaims(judgedTables));
  measureCriterion(`chimera:${builtSource.name}`, judgedTables, emptyKeys, differentPairs.donatedKeys, false, true);
}
for (const builtSource of builtSources) {
  const shortenedTable = constructShortened(readTable(builtSource.path), 2, 0, 1);
  const judgedTables = judgeTables(shortenedTable.a, shortenedTable.b);
  const twinKeys = collectTwins(judgedTables, shortenedTable.twins);
  const nonTwinRight = [...judgedTables.rightKeys].filter((rightKey) => !twinKeys.has(rightKey)).length;
  console.log(`BUILT shortened ${builtSource.name} ${showReach(judgedTables, countRight(judgedTables, shortenedTable.twins), twinKeys.size, "twinsRight")} twinsTotal ${twinKeys.size} nonTwinRight ${nonTwinRight} control none controlWhy noBuiltControl ${showClaims(countClaims(judgedTables, collectSame(judgedTables, shortenedTable.twins), emptyKeys), judgedTables.claims.length, true, false)}`);
  printChecks(`shortened:${builtSource.name}`, judgedTables, shortenedTable.a, shortenedTable.b);
  printRulings(`shortened:${builtSource.name}`, judgeClaims(judgedTables));
  measureCriterion(`shortened:${builtSource.name}`, judgedTables, collectSame(judgedTables, shortenedTable.twins), emptyKeys, true, false);
}
for (const builtSource of builtSources) {
  const doubledTable = constructDoubled(readTable(builtSource.path), 2, 1, 2);
  const judgedTables = judgeTables(doubledTable.a, doubledTable.b);
  const twinKeys = collectTwins(judgedTables, doubledTable.twins);
  const rightTwins = doubledTable.twins.filter(([sourceAt, copyAt]) => judgedTables.rightKeys.has(joinPair(readRecord(judgedTables.cellMatrix, judgedTables.partA, sourceAt), readRecord(judgedTables.cellMatrix, judgedTables.partB, copyAt))));
  const bothRight = countRepeats(rightTwins.map(([sourceAt]) => readRecord(judgedTables.cellMatrix, judgedTables.partA, sourceAt)));
  console.log(`BUILT doubled ${builtSource.name} ${showReach(judgedTables, countRight(judgedTables, doubledTable.twins), twinKeys.size, "twinsRight")} twinsTotal ${twinKeys.size} ${showReach(judgedTables, bothRight, twinKeys.size, "bothRight")} control none controlWhy noBuiltControl ${showClaims(countClaims(judgedTables, collectSame(judgedTables, doubledTable.twins), emptyKeys), judgedTables.claims.length, true, false)}`);
  printChecks(`doubled:${builtSource.name}`, judgedTables, doubledTable.a, doubledTable.b);
  printRulings(`doubled:${builtSource.name}`, judgeClaims(judgedTables));
  measureCriterion(`doubled:${builtSource.name}`, judgedTables, collectSame(judgedTables, doubledTable.twins), emptyKeys, true, false);
}
for (const builtSource of builtSources) {
  const exactTable = constructDoubled(readTable(builtSource.path), 2, -1, -1);
  const judgedTables = judgeTables(exactTable.a, exactTable.b);
  const twinKeys = collectTwins(judgedTables, exactTable.twins);
  console.log(`BUILT doubledExact ${builtSource.name} ${showReach(judgedTables, countRight(judgedTables, exactTable.twins), twinKeys.size, "twinsRight")} twinsTotal ${twinKeys.size} control none controlWhy noBuiltControl ${showClaims(countClaims(judgedTables, collectSame(judgedTables, exactTable.twins), emptyKeys), judgedTables.claims.length, true, false)}`);
  printChecks(`doubledExact:${builtSource.name}`, judgedTables, exactTable.a, exactTable.b);
  printRulings(`doubledExact:${builtSource.name}`, judgeClaims(judgedTables));
  measureCriterion(`doubledExact:${builtSource.name}`, judgedTables, collectSame(judgedTables, exactTable.twins), emptyKeys, true, false);
}
for (const builtSource of builtSources) {
  const plantedTable = constructPlanted(readTable(builtSource.path), 2, 4);
  const judgedTables = judgeTables(plantedTable.a, plantedTable.b);
  const sameKeys = collectSame(judgedTables, plantedTable.twins);
  const twinKeys = collectTwins(judgedTables, plantedTable.twins);
  const differentPairs = certifyDifferent(judgedTables, plantedTable.donors);
  const twinsRight = countRight(judgedTables, plantedTable.twins);
  const claimRulings = judgeClaims(judgedTables);
  const firedSame = claimRulings.firedKeys.filter((firedKey) => sameKeys.has(firedKey)).length;
  console.log(`BUILT planted ${builtSource.name} ${showReach(judgedTables, twinsRight, twinKeys.size, "twinsRight")} twinsTotal ${twinKeys.size} byPairTwin ${firedSame} byPairOther ${claimRulings.firedKeys.length - firedSame} refuted ${claimRulings.refuted} ${showClaims(countClaims(judgedTables, sameKeys, differentPairs.differentKeys), judgedTables.claims.length, true, true)} skipped ${plantedTable.skipped}`);
  const marginText = differentPairs.ratioList.length > 0 ? String(differentPairs.ratioList.reduce((leastSoFar, ratioValue) => Math.min(leastSoFar, ratioValue))) : "none";
  console.log(`BUILT knownDifferent ${builtSource.name} pairs ${differentPairs.pairs} rejected ${differentPairs.rejected} unmeasured ${differentPairs.unmeasured} emptyDonated ${differentPairs.emptyDonated} unpieced ${differentPairs.unpieced} agree1 ${differentPairs.agreeOne} agree2 ${differentPairs.agreeMore} aligned ${differentPairs.aligned} ${showReach(judgedTables, differentPairs.right, differentPairs.pairs, "right")} power ${twinsRight} twins ${twinKeys.size} margin ${marginText}`);
  printChecks(`planted:${builtSource.name}`, judgedTables, plantedTable.a, plantedTable.b);
  printRulings(`planted:${builtSource.name}`, claimRulings);
  measureCriterion(`planted:${builtSource.name}`, judgedTables, sameKeys, differentPairs.donatedKeys, true, true);
}
const copySources: readonly Built[] = [...builtSources, { name: "fodors_zagat/tableB", path: "unlabeled/fodors_zagat/tableB.csv" }, { name: "dirty/tableB", path: "splits/dirty/1/tableB.csv" }, { name: "beer/tableB", path: "splits/structured/beer/tableB.csv" }];
for (const copySource of copySources) {
  let rightSum = 0; let twinsSum = 0; let nonTwinSum = 0;
  for (let residueAt = 0; residueAt < 3; residueAt += 1) {
    const copiesTable = constructShortened(readTable(copySource.path), 3, residueAt, -1);
    const judgedTables = judgeTables(copiesTable.a, copiesTable.b);
    const twinKeys = collectTwins(judgedTables, copiesTable.twins);
    rightSum += judgedTables.rightPairs.length; twinsSum += twinKeys.size;
    nonTwinSum += [...judgedTables.rightKeys].filter((rightKey) => !twinKeys.has(rightKey)).length;
    printChecks(`copies:${copySource.name}:${residueAt}`, judgedTables, copiesTable.a, copiesTable.b);
    printRulings(`copies:${copySource.name}:${residueAt}`, judgeClaims(judgedTables));
    measureCriterion(`copies:${copySource.name}:${residueAt}`, judgedTables, collectSame(judgedTables, copiesTable.twins), emptyKeys, true, false);
  }
  console.log(`COPIES ${copySource.name} right ${rightSum} twinsTotal ${twinsSum} nonTwinRight ${nonTwinSum} control none controlWhy noBuiltControl`);
}
const nullOnlySources: readonly Built[] = [{ name: "fodors_zagat/tableB", path: "unlabeled/fodors_zagat/tableB.csv" }, { name: "dirty/tableB", path: "splits/dirty/1/tableB.csv" }, { name: "beer/tableB", path: "splits/structured/beer/tableB.csv" }, { name: "c2_copy", path: "positive/c2_copy/tableA.csv" }, { name: "c2_exact", path: "positive/c2_exact/tableA.csv" }, { name: "c2_same", path: "unlabeled/c2_same/tableA_even.csv" }];
for (const nullSource of nullOnlySources) { const chimeraTable = constructChimera(readTable(nullSource.path), 2); nullSources.push({ source: nullSource.name, pieced: constructPieces(chimeraTable.a, chimeraTable.b) }); }
printCriteria();
