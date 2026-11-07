/** The gate. (1) The unmasked error set: syntactic + semantic, per file, bare compiler API, no line numbers, sorted; the ledger errors (a ledger missing, a row not its file's shape, a verdict neither approved nor refused, a supersedes that does not name the check's previous verdict); the history errors against the newest .gate/history point (laws.tsv or locks.tsv differing: STALE; reads.tsv or verdicts.tsv not extending its last copy byte for byte: TRUNCATED; verdicts.tsv changed while reads.tsv or any src/scripts file also changed: VERDICTS — a verdicts landing changes nothing else, and only such a landing moves refusalsOpen). The gate writes .gate/files.tsv (sha256 of every src and scripts file) on every run; the commit copies it with the four ledgers. (2) The law counts from the syntax tree, per file: casts; sentinel fills (every ??, every || whose left side is not boolean-typed, reduce seeded 0); ternaries on undefined; ternaries minting a trit from a number; bindings under two words; function names not jobThing (exactly two camelCase words); functions defined in more than one file; exports nothing imports (replace, never add beside); product files importing judge files (independence, hard 0); absence tests, absence forms, and absence fills (the disguised forms: a value yielded in place of an absence by an Array.isArray, typeof or instanceof test, an Object() call, a .get() result compared to a word, an existsSync ternary). Ledger laws: readsOpen, readsSameNextStep (.gate/reads.tsv, six columns), refusalsOpen (.gate/verdicts.tsv, four columns: checks whose latest verdict is refused). Printed as LAW lines; the harness holds the ceilings. argv: extra root files (fixtures) counted alongside the program's files, so a planted form can be shown to count. Doctrine, kept by the gate itself: no absence is read — a compiler node's optional parts are read from its syntax children (a name is the identifier child, a return's expression its non-token child, an initializer what follows the = token, modifiers the keywords in the modifier list), the config is parsed by the API that returns a value, a map entry is held before use and a verdict is looked up by has before it is read. */
import ts from "typescript";
import { relative, basename } from "node:path";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { findItem } from "../src/matrix.ts";
import { findDoubles } from "./doubles.ts";

/** The direct syntax children of a node, tokens included. */
function listChildren(treeNode: ts.Node): readonly ts.Node[] { return treeNode.getChildren(treeNode.getSourceFile()); }
/** A declaration's own name: the first identifier among its direct children, as a list of one or none. */
function listNamed(treeNode: ts.Node): readonly string[] { return listChildren(treeNode).filter(ts.isIdentifier).map((nameNode) => nameNode.text).slice(0, 1); }
/** A return statement's expression: its children that are not the return keyword or the semicolon. */
function listReturned(returnNode: ts.ReturnStatement): readonly ts.Node[] { return listChildren(returnNode).filter((childNode) => childNode.kind !== ts.SyntaxKind.ReturnKeyword && childNode.kind !== ts.SyntaxKind.SemicolonToken); }
/** A variable declaration's initializer: the child that follows the = token. */
function listInitial(declarationNode: ts.VariableDeclaration): readonly ts.Node[] { const childList = listChildren(declarationNode); return [...childList.keys()].filter((childAt) => childAt > 0 && findItem(childList, childAt - 1).kind === ts.SyntaxKind.EqualsToken).map((childAt) => findItem(childList, childAt)); }
/** Whether a node carries the export keyword among its modifiers (a modifier list is a SyntaxList child holding keywords). */
function hasExport(treeNode: ts.Node): boolean { return listChildren(treeNode).some((childNode) => childNode.kind === ts.SyntaxKind.SyntaxList && listChildren(childNode).some((keywordNode) => keywordNode.kind === ts.SyntaxKind.ExportKeyword)); }
/** The set a map holds for a key, created empty when the key is new. */
function holdSet(setMap: Map<string, Set<string>>, keyName: string): Set<string> {
  if (!setMap.has(keyName)) setMap.set(keyName, new Set<string>());
  return findItem([...setMap.entries()].filter(([entryName]) => entryName === keyName).map(([, entrySet]) => entrySet), 0);
}
/** A map's value for a key it holds; a key it does not hold is a defect, so callers ask has() first. */
function findHeld(wordMap: Map<string, string>, keyName: string): string { return findItem([...wordMap.entries()].filter(([entryName]) => entryName === keyName).map(([, entryWord]) => entryWord), 0); }

const rootPath = process.cwd();
const extraRoots = process.argv.slice(2);
const configPath = `${rootPath}/tsconfig.json`;
if (!existsSync(configPath)) throw new Error("no tsconfig.json in cwd");
const parsedConfig = ts.parseJsonConfigFileContent(JSON.parse(readFileSync(configPath, "utf8")), ts.sys, rootPath);
const typeProgram = ts.createProgram({ rootNames: [...parsedConfig.fileNames, ...extraRoots], options: parsedConfig.options, configFileParsingDiagnostics: parsedConfig.errors });
const typeChecker = typeProgram.getTypeChecker();

const errorLines = new Set<string>();
const noteError = (fileName: string, errorText: string): void => { errorLines.add(`${fileName}\t${errorText}`); };
const noteDiagnostic = (fileName: string, diagnosticItem: ts.Diagnostic): void => { noteError(fileName, `TS${diagnosticItem.code}\t${ts.flattenDiagnosticMessageText(diagnosticItem.messageText, " ")}`); };
for (const diagnosticItem of [...typeProgram.getConfigFileParsingDiagnostics(), ...typeProgram.getOptionsDiagnostics(), ...typeProgram.getGlobalDiagnostics()]) noteDiagnostic("(program)", diagnosticItem);
for (const sourceFile of typeProgram.getSourceFiles()) {
  if (sourceFile.isDeclarationFile) continue;
  for (const diagnosticItem of [...typeProgram.getSyntacticDiagnostics(sourceFile), ...typeProgram.getSemanticDiagnostics(sourceFile)]) noteDiagnostic(relative(rootPath, sourceFile.fileName), diagnosticItem);
}

/** A ledger: tab-separated rows of exactly `columnCount` fields; blank lines and # lines are not rows. A missing ledger is an error, never an empty ledger; a row of another shape is an error, never dropped. */
const readLedger = (ledgerPath: string, columnCount: number): string[][] => {
  const rowList: string[][] = [];
  if (!existsSync(ledgerPath)) { noteError(relative(rootPath, ledgerPath), "MISSING\tledger absent; not read as empty"); return rowList; }
  readFileSync(ledgerPath, "utf8").split("\n").forEach((lineText, lineAt) => {
    if (lineText.length === 0 || lineText.startsWith("#")) return;
    const fieldList = lineText.split("\t");
    if (fieldList.length !== columnCount) { noteError(relative(rootPath, ledgerPath), `SHAPE\tline ${lineAt + 1} has ${fieldList.length} columns, not ${columnCount}`); return; }
    rowList.push(fieldList);
  });
  return rowList;
};
const readsPath = `${rootPath}/.gate/reads.tsv`;
const verdictsPath = `${rootPath}/.gate/verdicts.tsv`;
let readsOpen = 0;
let readsSameNextStep = 0;
for (const readRow of readLedger(readsPath, 6)) {
  if (findItem(readRow, 5).length === 0) readsOpen += 1;
  if (findItem(readRow, 2) === findItem(readRow, 3)) readsSameNextStep += 1;
}
const verdictRows = readLedger(verdictsPath, 4);
const latestVerdicts = new Map<string, string>();
verdictRows.forEach((verdictRow, rowAt) => {
  const checkName = findItem(verdictRow, 0); const verdictText = findItem(verdictRow, 1); const supersedesText = findItem(verdictRow, 2);
  if (verdictText !== "approved" && verdictText !== "refused") noteError(relative(rootPath, verdictsPath), `VERDICT\tverdict ${rowAt + 1} (${checkName}): '${verdictText}' is neither approved nor refused`);
  const verdictOrdinal = verdictRows.slice(0, rowAt + 1).filter((priorRow) => findItem(priorRow, 0) === checkName).length;
  const expectedSupersedes = verdictOrdinal === 1 ? "" : `${checkName}#${verdictOrdinal - 1}`;
  if (supersedesText !== expectedSupersedes) noteError(relative(rootPath, verdictsPath), `SUPERSEDES\tverdict ${rowAt + 1} (${checkName}): '${supersedesText}', expected '${expectedSupersedes}'`);
  latestVerdicts.set(checkName, verdictText);
});
let refusalsOpen = 0;
const refusedNames: string[] = [];

for (const [checkName, verdictText] of latestVerdicts) if (verdictText === "refused") { refusalsOpen += 1; refusedNames.push(checkName); }

/** The source hashes, written every run; the commit copies the file into history so a verdicts landing can be shown to have changed no source. */
const hashFile = (filePath: string): string => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const hashLines: string[] = [];
for (const folderName of ["src", "scripts"]) for (const entryName of readdirSync(`${rootPath}/${folderName}`).sort()) hashLines.push(`${folderName}/${entryName}\t${hashFile(`${rootPath}/${folderName}/${entryName}`)}`);
const hashText = `${hashLines.join("\n")}\n`;
writeFileSync(`${rootPath}/.gate/files.tsv`, hashText);

/** History: against the newest .gate/history point, laws.tsv and locks.tsv equal their copy; reads.tsv and verdicts.tsv extend their copy; a changed verdicts.tsv comes with an unchanged reads.tsv and unchanged source hashes. */
const historyRoot = `${rootPath}/.gate/history`;
/** Every read added after the ledger entered history needs an approved verdict read.<id>, whatever its outcome (reads.approval): rows are appended complete, so an empty outcome marks nothing; the mark is absence from the oldest history copy of reads.tsv. */
const baselineReadIds = new Set<string>();
if (existsSync(historyRoot)) for (const folderName of readdirSync(historyRoot).sort()) { const copyPath = `${historyRoot}/${folderName}/reads.tsv`; if (existsSync(copyPath)) { for (const readRow of readLedger(copyPath, 6)) baselineReadIds.add(findItem(readRow, 0)); break; } }
const seenReadIds = new Set<string>();
/** Proposals (.gate/proposed/*.tsv) are read rows awaiting approval: each must hold the reads ledger's six columns, and its id must equal its file name, so a misshapen proposal is refused before the falsifier reads it (proposals.shape). */
const proposedRoot = `${rootPath}/.gate/proposed`;
if (existsSync(proposedRoot)) for (const proposedName of readdirSync(proposedRoot).sort()) { if (!proposedName.endsWith(".tsv")) continue; const proposedPath = `${proposedRoot}/${proposedName}`; for (const proposedRow of readLedger(proposedPath, 6)) { const proposedId = findItem(proposedRow, 0); if (`${proposedId}.tsv` !== proposedName) noteError(relative(rootPath, proposedPath), `PROPOSAL\tid ${proposedId} does not match the file name`); } }
for (const readRow of readLedger(readsPath, 6)) { const readId = findItem(readRow, 0); if (seenReadIds.has(readId)) noteError(relative(rootPath, readsPath), `DUPLICATE\t${readId} appears more than once; a reused id would pass the baseline unapproved (reads.idUnique)`); seenReadIds.add(readId); const verdictName = `read.${readId}`; if (!baselineReadIds.has(readId) && !(latestVerdicts.has(verdictName) && findHeld(latestVerdicts, verdictName) === "approved")) noteError(relative(rootPath, readsPath), `READ\t${readId} was added after the ledger entered history and has no approved verdict read.${readId}`); }
if (!existsSync(historyRoot)) noteError(".gate/history", "MISSING\tno history folder");
else {
  const folderNames = readdirSync(historyRoot).sort();
  if (folderNames.length === 0) noteError(".gate/history", "EMPTY\tno history point");
  else {
    const latestFolder = findItem(folderNames, folderNames.length - 1);
    const copyState = (fileName: string, mustExtend: boolean): "same" | "changed" => {
      const livePath = `${rootPath}/.gate/${fileName}`; const copyPath = `${historyRoot}/${latestFolder}/${fileName}`;
      if (!existsSync(livePath)) { noteError(`.gate/${fileName}`, "MISSING\tno live file"); return "changed"; }
      if (!existsSync(copyPath)) { noteError(`.gate/${fileName}`, `MISSING\tno copy in history/${latestFolder}`); return "changed"; }
      const liveText = readFileSync(livePath, "utf8"); const copyText = readFileSync(copyPath, "utf8");
      if (liveText === copyText) return "same";
      if (!mustExtend) { noteError(`.gate/${fileName}`, `STALE\tdiffers from history/${latestFolder}`); return "changed"; }
      if (!liveText.startsWith(copyText)) noteError(`.gate/${fileName}`, `TRUNCATED\tdoes not extend history/${latestFolder} byte for byte`);
      return "changed";
    };
    copyState("laws.tsv", false);
    copyState("locks.tsv", false);
    const readsState = copyState("reads.tsv", true);
    const verdictsState = copyState("verdicts.tsv", true);
    if (verdictsState === "changed") {
      if (readsState === "changed") noteError(".gate/verdicts.tsv", "VERDICTS\tchanged alongside reads.tsv; a verdicts landing changes nothing else");
      const hashCopyPath = `${historyRoot}/${latestFolder}/files.tsv`;
      if (!existsSync(hashCopyPath)) noteError(".gate/files.tsv", `MISSING\tno copy in history/${latestFolder}`);
      else if (readFileSync(hashCopyPath, "utf8") !== hashText) noteError(".gate/verdicts.tsv", `VERDICTS\tchanged alongside a src or scripts file (files.tsv differs from history/${latestFolder}); a verdicts landing changes nothing else`);
    }
  }
}
/** Bodies (harness.bodies): every history point from the first complete body record on holds bodies/<path> for every line of its files.tsv, with equal sha256; a missing or differing body is an error, so a landing's prior bodies are always on disk and judgeable. The record at 1792264999 is partial (its NOTE.txt names the lost file), so the rule starts at 1792265363. */
const bodiesFrom = "1792265363";
if (existsSync(historyRoot)) for (const folderName of readdirSync(historyRoot).sort()) { if (folderName < bodiesFrom) continue; const pointRoot = `${historyRoot}/${folderName}`; const hashPath = `${pointRoot}/files.tsv`; if (!existsSync(hashPath)) { noteError(`.gate/history/${folderName}`, "BODIES\tno files.tsv"); continue; } for (const hashLine of readFileSync(hashPath, "utf8").split("\n")) { if (hashLine.length === 0) continue; const hashFields = hashLine.split("\t"); if (hashFields.length !== 2) { noteError(`.gate/history/${folderName}/files.tsv`, `SHAPE\t${hashLine}`); continue; } const bodyPath = `${pointRoot}/bodies/${findItem(hashFields, 0)}`; if (!existsSync(bodyPath)) { noteError(`.gate/history/${folderName}`, `BODIES\tno body for ${findItem(hashFields, 0)}`); continue; } if (hashFile(bodyPath) !== findItem(hashFields, 1)) noteError(`.gate/history/${folderName}`, `BODIES\tbody differs from files.tsv for ${findItem(hashFields, 0)}`); } }
/** Law 1, the scorer kept (ruling.lawScorer): a landing's scorer and its saved output are bound to the landing's own commit by a manifest, landing.tsv, of one row and seven columns (check, then path and sha256 of the edit, the scorer and the scorer's output, each a file under .gate/audit), which the commit copies into the new history point. The law starts at the first history point whose stored scripts/gate.ts holds this law's mark, read from content; from there every point whose files.tsv differs from the point before holds its own manifest, and a live tree whose files.tsv differs from the newest point holds .gate/landing.tsv. Every manifest's three files exist under .gate/audit with equal sha256, each sha256 64 hex digits; its edit sha256 is cited in full by a row that is approved and is its check's latest row (a refused row never counts, whatever its check's later verdict); no output sha256 appears in two manifests. Points before files.tsv existed are unknown and source changes before the law's start are a fact: both print as counts, never as errors. The gate checks that a scorer and its output were kept unchanged, not that the output came from running it: that is the falsifier's read of the saved output. */
const lawMark = "Law 1, the scorer kept (ruling.lawScorer)";
const auditRoot = `${rootPath}/.gate/audit`;
let auditNames: readonly string[] = [];
if (!existsSync(auditRoot)) noteError(".gate/audit", "MISSING\tno audit folder; landing manifests cannot be checked");
else auditNames = readdirSync(auditRoot, { recursive: true, encoding: "utf8" });
const auditFiles = new Set(auditNames.map((entryPath) => `.gate/audit/${entryPath}`));
const approvedTexts = verdictRows.filter((verdictRow, rowAt) => findItem(verdictRow, 1) === "approved" && verdictRows.slice(rowAt + 1).every((laterRow) => findItem(laterRow, 0) !== findItem(verdictRow, 0))).map((verdictRow) => verdictRow.join("\t"));
const outputsSeen = new Set<string>();
const checkManifest = (manifestPath: string, placeName: string): void => {
  const manifestRows = readLedger(manifestPath, 7);
  if (manifestRows.length !== 1) { noteError(placeName, `LANDING\tmanifest holds ${manifestRows.length} rows, not 1`); return; }
  const manifestRow = findItem(manifestRows, 0);
  for (const fieldAt of [1, 3, 5]) {
    const keptPath = findItem(manifestRow, fieldAt); const keptHash = findItem(manifestRow, fieldAt + 1);
    if (!/^[0-9a-f]{64}$/.test(keptHash)) { noteError(placeName, `LANDING\t${keptPath} sha256 is not 64 hex digits`); continue; }
    if (!auditFiles.has(keptPath)) { noteError(placeName, `LANDING\t${keptPath} is not a file under .gate/audit`); continue; }
    if (hashFile(`${rootPath}/${keptPath}`) !== keptHash) noteError(placeName, `LANDING\t${keptPath} sha256 differs from the manifest`);
  }
  const editHash = findItem(manifestRow, 2);
  if (!approvedTexts.some((rowText) => rowText.includes(editHash))) noteError(placeName, `LANDING\tedit sha256 ${editHash} is cited by no approved row that is its check's latest`);
  const outputHash = findItem(manifestRow, 6);
  if (outputsSeen.has(outputHash)) noteError(placeName, `LANDING\toutput sha256 ${outputHash} appears in an earlier manifest; each landing keeps its own scorer output`);
  outputsSeen.add(outputHash);
};
let pointsUnhashed = 0;
let landingsBefore = 0;
let landingsBound = 0;
let lawStarted = false;
let previousFiles: readonly string[] = [];
let pointList: readonly string[] = [];
if (existsSync(historyRoot)) pointList = readdirSync(historyRoot).sort();
for (const pointName of pointList) {
  const pointRoot = `${historyRoot}/${pointName}`;
  const pointFiles = readdirSync(pointRoot);
  if (!pointFiles.includes("files.tsv")) { pointsUnhashed += 1; previousFiles = []; continue; }
  const filesText = readFileSync(`${pointRoot}/files.tsv`, "utf8");
  let holdsLaw = false;
  if (pointFiles.includes("bodies") && readdirSync(`${pointRoot}/bodies`).includes("scripts") && readdirSync(`${pointRoot}/bodies/scripts`).includes("gate.ts")) holdsLaw = readFileSync(`${pointRoot}/bodies/scripts/gate.ts`, "utf8").includes(lawMark);
  if (holdsLaw) lawStarted = true;
  const holdsManifest = pointFiles.includes("landing.tsv");
  if (holdsManifest) checkManifest(`${pointRoot}/landing.tsv`, `.gate/history/${pointName}`);
  const sourceChanged = previousFiles.length === 1 && findItem(previousFiles, 0) !== filesText;
  if (sourceChanged && !lawStarted) landingsBefore += 1;
  if (sourceChanged && lawStarted && holdsManifest) landingsBound += 1;
  if (sourceChanged && lawStarted && !holdsManifest) noteError(`.gate/history/${pointName}`, "LANDING\tsource changed (files.tsv differs from the point before) and no landing.tsv: the scorer is not kept");
  previousFiles = [filesText];
}
let newestFiles = "";
if (pointList.length > 0) newestFiles = readFileSync(`${historyRoot}/${findItem(pointList, pointList.length - 1)}/files.tsv`, "utf8");
if (pointList.length > 0 && newestFiles !== hashText) { if (readdirSync(`${rootPath}/.gate`).includes("landing.tsv")) checkManifest(`${rootPath}/.gate/landing.tsv`, ".gate/landing.tsv"); else noteError(".gate/landing.tsv", "LANDING\tsource changed (files.tsv differs from the newest history point) and no .gate/landing.tsv: the scorer is not kept"); }
/** Law 2, product lines named (ruling.productGuard): a CLAIMS or PRODUCT lock line is keyed by its kind and table (its first two words); between two history points whose locks.tsv both exist, a key moves when its line changed, was added or is gone. The law starts at the first history point whose stored scripts/gate.ts holds this law's mark, read from content, and reads no file classes, so a change in any file is guarded alike. From there the moved keys must equal the keys the point's moves.tsv names (one key per line; none when the point holds no moves.tsv); moves.tsv's sha256 is cited in full by an approved row that is its check's latest, and no moves.tsv repeats an earlier one's sha256. A live locks.tsv differing from the newest point is held to .gate/moves.tsv the same way. A key appearing twice in one locks.tsv is an error. Lock changes before the law's start are a fact, printed as a count; product lines moved since are printed as a count. */
const productMark = "Law 2, product lines named (ruling.productGuard)";
const productKey = (lockLine: string): string => lockLine.split(" ").slice(0, 2).join(" ");
const listProduct = (locksText: string, placeName: string): Map<string, string> => {
  const productLines = new Map<string, string>();
  for (const lockLine of locksText.split("\n")) {
    if (!lockLine.startsWith("CLAIMS ") && !lockLine.startsWith("PRODUCT ")) continue;
    const keyText = productKey(lockLine);
    if (productLines.has(keyText)) noteError(placeName, `PRODUCTLINE\t${keyText} appears twice; a product line is keyed by its kind and table`);
    productLines.set(keyText, lockLine);
  }
  return productLines;
};
const movesSeen = new Set<string>();
const checkNamed = (movesPath: string, placeName: string): readonly string[] => {
  const movesText = readFileSync(movesPath, "utf8");
  const movesHash = hashFile(movesPath);
  if (!approvedTexts.some((rowText) => rowText.includes(movesHash))) noteError(placeName, `PRODUCTLINE\tmoves.tsv sha256 ${movesHash} is cited by no approved row that is its check's latest`);
  if (movesSeen.has(movesHash)) noteError(placeName, `PRODUCTLINE\tmoves.tsv sha256 ${movesHash} names an earlier landing's moves; each landing names its own`);
  movesSeen.add(movesHash);
  return [movesText];
};
const checkMoves = (beforeText: string, afterText: string, namedText: readonly string[], placeName: string): number => {
  const beforeLines = listProduct(beforeText, placeName);
  const afterLines = listProduct(afterText, placeName);
  const movedKeys = new Set<string>();
  for (const [keyText, lockLine] of afterLines) if (!beforeLines.has(keyText) || findHeld(beforeLines, keyText) !== lockLine) movedKeys.add(keyText);
  for (const keyText of beforeLines.keys()) if (!afterLines.has(keyText)) movedKeys.add(keyText);
  const namedKeys = new Set(namedText.flatMap((movesText) => movesText.split("\n").filter((keyLine) => keyLine.length > 0 && !keyLine.startsWith("#"))));
  for (const keyText of movedKeys) if (!namedKeys.has(keyText)) noteError(placeName, `PRODUCTLINE\t${keyText} moved and the approved filing does not name it`);
  for (const keyText of namedKeys) if (!movedKeys.has(keyText)) noteError(placeName, `PRODUCTLINE\t${keyText} is named and did not move; a named move is a prediction`);
  return movedKeys.size;
};
let productStarted = false;
let productBefore = 0;
let productMoved = 0;
let previousLocks: readonly string[] = [];
for (const pointName of pointList) {
  const pointRoot = `${historyRoot}/${pointName}`;
  const pointFiles = readdirSync(pointRoot);
  if (!pointFiles.includes("locks.tsv")) { previousLocks = []; continue; }
  const locksText = readFileSync(`${pointRoot}/locks.tsv`, "utf8");
  if (pointFiles.includes("bodies") && readdirSync(`${pointRoot}/bodies`).includes("scripts") && readdirSync(`${pointRoot}/bodies/scripts`).includes("gate.ts") && readFileSync(`${pointRoot}/bodies/scripts/gate.ts`, "utf8").includes(productMark)) productStarted = true;
  if (previousLocks.length === 1 && !productStarted && findItem(previousLocks, 0) !== locksText) productBefore += 1;
  if (previousLocks.length === 1 && productStarted) {
    let namedText: readonly string[] = [];
    if (pointFiles.includes("moves.tsv")) namedText = checkNamed(`${pointRoot}/moves.tsv`, `.gate/history/${pointName}`);
    productMoved += checkMoves(findItem(previousLocks, 0), locksText, namedText, `.gate/history/${pointName}`);
  }
  previousLocks = [locksText];
}
let newestLocks = "";
if (pointList.length > 0) newestLocks = readFileSync(`${historyRoot}/${findItem(pointList, pointList.length - 1)}/locks.tsv`, "utf8");
const liveLocksPath = `${rootPath}/.gate/locks.tsv`;
let liveLocks = "";
if (!existsSync(liveLocksPath)) noteError(".gate/locks.tsv", "MISSING\tledger absent; not read as empty");
else liveLocks = readFileSync(liveLocksPath, "utf8");
if (pointList.length > 0 && newestLocks !== liveLocks) {
  let liveNamed: readonly string[] = [];
  if (readdirSync(`${rootPath}/.gate`).includes("moves.tsv")) liveNamed = checkNamed(`${rootPath}/.gate/moves.tsv`, ".gate/moves.tsv");
  checkMoves(newestLocks, liveLocks, liveNamed, ".gate/locks.tsv");
}
/** Law leftover (ruling.leftover): a landing's manifest is moved into its history point at commit, never copied, so each is a leftover against its own law's trigger: .gate/landing.tsv while the live files.tsv equals the newest point's (law 1 reads it only while they differ), .gate/moves.tsv while the live locks.tsv equals the newest point's (law 2 reads it only while they differ); each is refused with its own line. */
if (pointList.length > 0 && newestFiles === hashText && readdirSync(`${rootPath}/.gate`).includes("landing.tsv")) noteError(".gate/landing.tsv", "LEFTOVER\tpresent while the live source equals the newest history point; a commit moves it into the point");
if (pointList.length > 0 && newestLocks === liveLocks && readdirSync(`${rootPath}/.gate`).includes("moves.tsv")) noteError(".gate/moves.tsv", "LEFTOVER\tpresent while the live locks equal the newest history point; a commit moves it into the point");
for (const errorLine of [...errorLines].sort()) console.log(errorLine);
if (errorLines.size > 0) process.exitCode = 1;

/** Words of a camelCase identifier. `_` is a discard and has none; any other identifier matching no word is refused, not counted as none. */
const countWords = (identifierName: string): number => {
  if (identifierName === "_") return 0;
  const wordList = [...identifierName.matchAll(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g)];
  if (wordList.length === 0) throw new Error(`identifier without words: ${identifierName}`);
  return wordList.length;
};
const isZero = (treeNode: ts.Node): boolean => ts.isNumericLiteral(treeNode) && treeNode.text === "0";
/** A `||` whose left side is boolean-typed is logic; any other `||`, and every `??`, falls back from an absence to a value (law.fills.blind). */
const findBoolean = (treeNode: ts.Node): boolean => (typeChecker.getTypeAtLocation(treeNode).flags & ts.TypeFlags.BooleanLike) !== 0;
/** A ternary on `x === undefined` or `x !== undefined` fills an absence with a value instead of refusing it (law.sentinelFills). */
const findFill = (treeNode: ts.Node): boolean => ts.isConditionalExpression(treeNode) && ts.isBinaryExpression(treeNode.condition) && (treeNode.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || treeNode.condition.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) && ((ts.isIdentifier(treeNode.condition.right) && treeNode.condition.right.text === "undefined") || (ts.isIdentifier(treeNode.condition.left) && treeNode.condition.left.text === "undefined"));
/** An absence test: `x === undefined` or `x === null`, either side (law.fills.blind, second layer). An `if` on one whose then-branch is a bare `return <value>` fills the absence instead of refusing it; a `return` of a negative numeric literal is a sentinel. */
const findAbsence = (treeNode: ts.Node): boolean => ts.isBinaryExpression(treeNode) && treeNode.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ((ts.isIdentifier(treeNode.right) && treeNode.right.text === "undefined") || treeNode.right.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(treeNode.left) && treeNode.left.text === "undefined") || treeNode.left.kind === ts.SyntaxKind.NullKeyword);
/** Law absenceTests (law.fills.blind, the whole class rather than its forms): every site that tests for an absence — an equality comparison to undefined or null with any operator, an optional chain, or a truthiness test (an if, while, for or ternary condition, or the operand of !) on a value whose type includes undefined or null. The doctrine forbids guards; the ceiling only falls. */
const holdsAbsence = (treeNode: ts.Node): boolean => { const nodeType = typeChecker.getTypeAtLocation(treeNode); const partList = nodeType.isUnion() ? nodeType.types : [nodeType]; return partList.some((partType) => (partType.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) !== 0); };
const isAbsent = (sideNode: ts.Node): boolean => (ts.isIdentifier(sideNode) && sideNode.text === "undefined") || sideNode.kind === ts.SyntaxKind.NullKeyword;
const isEquality = (operatorKind: ts.SyntaxKind): boolean => operatorKind === ts.SyntaxKind.EqualsEqualsEqualsToken || operatorKind === ts.SyntaxKind.ExclamationEqualsEqualsToken || operatorKind === ts.SyntaxKind.EqualsEqualsToken || operatorKind === ts.SyntaxKind.ExclamationEqualsToken;
const findGuard = (treeNode: ts.Node): boolean => {
  if (ts.isBinaryExpression(treeNode)) return isEquality(treeNode.operatorToken.kind) && (isAbsent(treeNode.left) || isAbsent(treeNode.right));
  if ((ts.isPropertyAccessExpression(treeNode) || ts.isElementAccessExpression(treeNode) || ts.isCallExpression(treeNode)) && listChildren(treeNode).some((childNode) => childNode.kind === ts.SyntaxKind.QuestionDotToken)) return true;
  if (ts.isPrefixUnaryExpression(treeNode) && treeNode.operator === ts.SyntaxKind.ExclamationToken) return holdsAbsence(treeNode.operand);
  if (ts.isSourceFile(treeNode)) return false;
  const parentNode = treeNode.parent;
  return ((ts.isIfStatement(parentNode) && parentNode.expression === treeNode) || (ts.isWhileStatement(parentNode) && parentNode.expression === treeNode) || (ts.isForStatement(parentNode) && parentNode.condition === treeNode) || (ts.isConditionalExpression(parentNode) && parentNode.condition === treeNode)) && holdsAbsence(treeNode);
};
/** Law absenceForms (law.fills.residual): the guard forms absenceTests does not see — `typeof x` compared to "undefined" with any equality operator, a do-while condition on a type holding undefined or null, and an operand of && or || whose type holds undefined or null. A new law: its ceiling enters at today's counts and only falls. */
const findTypeof = (sideNode: ts.Node, otherNode: ts.Node): boolean => ts.isTypeOfExpression(sideNode) && ts.isStringLiteral(otherNode) && otherNode.text === "undefined";
const findForm = (treeNode: ts.Node): boolean => {
  if (ts.isBinaryExpression(treeNode) && isEquality(treeNode.operatorToken.kind) && (findTypeof(treeNode.left, treeNode.right) || findTypeof(treeNode.right, treeNode.left))) return true;
  const parentNode = treeNode.parent;
  return ((ts.isDoStatement(parentNode) && parentNode.expression === treeNode) || (ts.isBinaryExpression(parentNode) && (parentNode.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || parentNode.operatorToken.kind === ts.SyntaxKind.BarBarToken) && (parentNode.left === treeNode || parentNode.right === treeNode))) && holdsAbsence(treeNode);
};
/** Law absenceFills (law.fills.disguised): a form that reads an absence and yields a value in its place, unseen by absenceTests and absenceForms — a ternary or an expression-bodied arrow (a filter predicate) whose test is Array.isArray(x), `typeof x` compared with any equality operator, or `x instanceof`, with x of a type holding undefined or null; a call Object(x) on such an x; an equality comparing a .get(...) result of such a type to a string literal; a ternary whose condition is a call to existsSync. Ruling (law.conversions): a read counts when its operand's type holds undefined or null, decided by the type checker — so get(k) === word is a fill, while has(k) && findHeld(k) === word is not, because has returns a boolean (a membership count of 0 or 1, like a filtered list's length) and findHeld returns a string or throws; the two differ in type, not in spelling. A test whose branch throws is a refusal and is not a form here; an `if` is governed by absenceTests. A new law: its ceiling enters at today's counts and only falls. */
const findDisguise = (treeNode: ts.Node): boolean => {
  const findTest = (testNode: ts.Node): boolean => {
    if (ts.isCallExpression(testNode) && ts.isPropertyAccessExpression(testNode.expression) && testNode.expression.name.text === "isArray") return testNode.arguments.length === 1 && holdsAbsence(findItem(testNode.arguments, 0));
    if (ts.isBinaryExpression(testNode) && isEquality(testNode.operatorToken.kind)) return (ts.isTypeOfExpression(testNode.left) && holdsAbsence(testNode.left.expression)) || (ts.isTypeOfExpression(testNode.right) && holdsAbsence(testNode.right.expression));
    if (ts.isBinaryExpression(testNode) && testNode.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return holdsAbsence(testNode.left);
    return false;
  };
  const findGetter = (sideNode: ts.Node): boolean => ts.isCallExpression(sideNode) && ts.isPropertyAccessExpression(sideNode.expression) && sideNode.expression.name.text === "get" && holdsAbsence(sideNode);
  if (ts.isConditionalExpression(treeNode)) return findTest(treeNode.condition) || (ts.isCallExpression(treeNode.condition) && ts.isIdentifier(treeNode.condition.expression) && treeNode.condition.expression.text === "existsSync");
  if (ts.isArrowFunction(treeNode) && !ts.isBlock(treeNode.body)) return findTest(treeNode.body);
  if (ts.isCallExpression(treeNode) && ts.isIdentifier(treeNode.expression) && treeNode.expression.text === "Object") return treeNode.arguments.length === 1;
  if (ts.isBinaryExpression(treeNode) && isEquality(treeNode.operatorToken.kind)) return (findGetter(treeNode.left) && ts.isStringLiteral(treeNode.right)) || (findGetter(treeNode.right) && ts.isStringLiteral(treeNode.left));
  return false;
};
const findTrit = (treeNode: ts.Node): boolean => ts.isNewExpression(treeNode) && ts.isIdentifier(treeNode.expression) && (treeNode.expression.text === "Yes" || treeNode.expression.text === "No" || treeNode.expression.text === "Unknown");
/** Law anyBindings: a variable declaration that carries a type annotation and whose initializer's type is any — the JSON.parse door, where untyped input takes a typed name without a check. The honest form checks the shape and throws, or reads fields one by one through typed producers. A new law: its ceiling enters at today's counts and only falls. */
const findAny = (treeNode: ts.Node): boolean => ts.isVariableDeclaration(treeNode) && listChildren(treeNode).some((childNode) => childNode.kind === ts.SyntaxKind.ColonToken) && listInitial(treeNode).some((initialNode) => (typeChecker.getTypeAtLocation(initialNode).flags & ts.TypeFlags.Any) !== 0);
/** Law anyReturns: a yielded expression whose type is any, inside a function, arrow or method whose declared return type is neither any nor unknown — the typed-return door, where untyped input leaves a function under a typed name. The yielded expression is a return statement's expression, or the body of an arrow written without braces, which returns it with no return statement. The holder is the nearest enclosing function, the arrow itself when it is the yielder. The honest form returns unknown and checks at the caller, or checks the shape before returning. A new law: its ceiling enters at today's counts and only falls. */
const findLeak = (treeNode: ts.Node): boolean => {
  const yieldedList: ts.Node[] = [];
  if (ts.isReturnStatement(treeNode)) yieldedList.push(...listReturned(treeNode));
  if (ts.isArrowFunction(treeNode) && !ts.isBlock(treeNode.body)) yieldedList.push(treeNode.body);
  if (yieldedList.length !== 1 || (typeChecker.getTypeAtLocation(findItem(yieldedList, 0)).flags & ts.TypeFlags.Any) === 0) return false;
  const holderList = [treeNode, ...listUpward(treeNode)].filter((upNode) => ts.isFunctionDeclaration(upNode) || ts.isArrowFunction(upNode) || ts.isMethodDeclaration(upNode) || ts.isFunctionExpression(upNode));
  if (holderList.length === 0) return false;
  const typeNodes = listChildren(findItem(holderList, 0)).filter(ts.isTypeNode);
  if (typeNodes.length === 0) return false;
  const declaredFlags = typeChecker.getTypeFromTypeNode(findItem(typeNodes, typeNodes.length - 1)).flags;
  return (declaredFlags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) === 0;
};
/** The ancestors of a node, nearest first, ending at the source file. */
const listUpward = (treeNode: ts.Node): readonly ts.Node[] => (ts.isSourceFile(treeNode) ? [] : [treeNode.parent, ...listUpward(treeNode.parent)]);

const definitionMap = new Map<string, Set<string>>();
const exportedNames = new Map<string, Set<string>>();
const importedNames = new Set<string>();
const importGraph = new Map<string, Set<string>>();
const lawLines: string[] = [];
for (const sourceFile of typeProgram.getSourceFiles()) {
  if (sourceFile.isDeclarationFile) continue;
  const fileName = relative(rootPath, sourceFile.fileName);
  const fileBase = basename(sourceFile.fileName);
  const lawCounts = { casts: 0, sentinelFills: 0, undefinedFills: 0, statementFills: 0, sentinelReturns: 0, absenceTests: 0, absenceForms: 0, absenceFills: 0, anyBindings: 0, anyReturns: 0, numberToTrit: 0, bindingsUnderTwoWords: 0, functionsNotJobThing: 0 };
  const noteDefinition = (definedName: string): void => { holdSet(definitionMap, definedName).add(fileName); };
  const noteExport = (exportedName: string): void => { holdSet(exportedNames, fileName).add(exportedName); };
  const visitNode = (treeNode: ts.Node): void => {
    if (ts.isAsExpression(treeNode)) lawCounts.casts += 1;
    if (ts.isBinaryExpression(treeNode) && treeNode.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) lawCounts.sentinelFills += 1;
    if (ts.isBinaryExpression(treeNode) && treeNode.operatorToken.kind === ts.SyntaxKind.BarBarToken && !findBoolean(treeNode.left)) lawCounts.sentinelFills += 1;
    if (ts.isCallExpression(treeNode) && ts.isPropertyAccessExpression(treeNode.expression) && treeNode.expression.name.text === "reduce" && treeNode.arguments.length === 2 && isZero(findItem(treeNode.arguments, 1))) lawCounts.sentinelFills += 1;
    if (findFill(treeNode)) lawCounts.undefinedFills += 1;
    if (ts.isIfStatement(treeNode) && findAbsence(treeNode.expression) && ts.isReturnStatement(treeNode.thenStatement) && listReturned(treeNode.thenStatement).length > 0) lawCounts.statementFills += 1;
    if (ts.isReturnStatement(treeNode)) for (const returnedNode of listReturned(treeNode)) if (ts.isPrefixUnaryExpression(returnedNode) && returnedNode.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(returnedNode.operand)) lawCounts.sentinelReturns += 1;
    if (findGuard(treeNode)) lawCounts.absenceTests += 1;
    if (!ts.isSourceFile(treeNode) && findForm(treeNode)) lawCounts.absenceForms += 1;
    if (findDisguise(treeNode)) lawCounts.absenceFills += 1;
    if (findAny(treeNode)) lawCounts.anyBindings += 1;
    if (findLeak(treeNode)) lawCounts.anyReturns += 1;
    if (ts.isConditionalExpression(treeNode) && (findTrit(treeNode.whenTrue) || findTrit(treeNode.whenFalse))) lawCounts.numberToTrit += 1;
    if ((ts.isVariableDeclaration(treeNode) || ts.isParameter(treeNode)) && ts.isIdentifier(treeNode.name) && countWords(treeNode.name.text) < 2) lawCounts.bindingsUnderTwoWords += 1;
    if (ts.isFunctionDeclaration(treeNode)) for (const nameText of listNamed(treeNode)) { if (countWords(nameText) !== 2) lawCounts.functionsNotJobThing += 1; noteDefinition(nameText); if (hasExport(treeNode)) noteExport(nameText); }
    if (ts.isMethodDeclaration(treeNode) && ts.isIdentifier(treeNode.name) && countWords(treeNode.name.text) !== 2) lawCounts.functionsNotJobThing += 1;
    if (ts.isVariableDeclaration(treeNode) && ts.isIdentifier(treeNode.name)) for (const initialNode of listInitial(treeNode)) if (ts.isArrowFunction(initialNode) || ts.isFunctionExpression(initialNode)) { if (countWords(treeNode.name.text) !== 2) lawCounts.functionsNotJobThing += 1; noteDefinition(treeNode.name.text); }
    if ((ts.isClassDeclaration(treeNode) || ts.isTypeAliasDeclaration(treeNode)) && hasExport(treeNode)) for (const nameText of listNamed(treeNode)) noteExport(nameText);
    if (ts.isVariableStatement(treeNode) && hasExport(treeNode)) for (const declarationItem of treeNode.declarationList.declarations) if (ts.isIdentifier(declarationItem.name)) noteExport(declarationItem.name.text);
    if (ts.isImportDeclaration(treeNode) && ts.isStringLiteral(treeNode.moduleSpecifier)) {
      const moduleBase = basename(treeNode.moduleSpecifier.text);
      if (fileName.startsWith("src/")) holdSet(importGraph, fileBase).add(moduleBase);
      for (const clauseNode of listChildren(treeNode).filter(ts.isImportClause)) for (const bindingsNode of listChildren(clauseNode).filter(ts.isNamedImports)) for (const importSpecifier of bindingsNode.elements) importedNames.add(`${moduleBase}:${importSpecifier.name.text}`);
    }
    ts.forEachChild(treeNode, visitNode);
  };
  visitNode(sourceFile);
  for (const [metricName, metricCount] of Object.entries(lawCounts)) lawLines.push(`LAW\t${fileName}\t${metricName}\t${metricCount}`);
}
let duplicatedCount = 0;
const duplicatedNames: string[] = [];
for (const [definedName, fileSet] of definitionMap) if (fileSet.size > 1) { duplicatedCount += 1; duplicatedNames.push(`${definedName}(${[...fileSet].join(",")})`); }
lawLines.push(`LAW\t(all)\tfunctionsDefinedInMoreThanOneFile\t${duplicatedCount}`);
lawLines.push(`LAW\t(reads)\treadsOpen\t${readsOpen}`);
lawLines.push(`LAW\t(reads)\treadsSameNextStep\t${readsSameNextStep}`);
lawLines.push(`LAW\t(verdicts)\trefusalsOpen\t${refusalsOpen}`);
const unimportedNames: string[] = [];
/** Independence from the import graph (independence.roster): judge files are inside.ts, price.ts and every src file importing one; product files are claim.ts and every src file importing one; a file in both sets, or an import across the sets in either direction, counts. Scripts are the harness and read both. */
const closeSet = (rootNames: readonly string[]): Set<string> => {
  const closedSet = new Set(rootNames);
  let setGrew = true;
  while (setGrew) { setGrew = false; for (const [fileBase, moduleBases] of importGraph) if (!closedSet.has(fileBase)) for (const moduleBase of moduleBases) if (closedSet.has(moduleBase)) { closedSet.add(fileBase); setGrew = true; } }
  return closedSet;
};
const judgeSet = closeSet(["inside.ts", "price.ts"]);
const productSet = closeSet(["claim.ts"]);
for (const [fileBase, moduleBases] of importGraph) { let crossCount = 0; if (judgeSet.has(fileBase) && productSet.has(fileBase)) crossCount += 1; for (const moduleBase of moduleBases) if ((productSet.has(fileBase) && judgeSet.has(moduleBase)) || (judgeSet.has(fileBase) && productSet.has(moduleBase))) crossCount += 1; lawLines.push(`LAW\tsrc/${fileBase}\tproductImportsJudge\t${crossCount}`); }
/** Law unitsTwice: doc comments or top-level statements appearing twice in a file (edit.write); the instrument refuses such a write, the gate counts what reached disk. */
for (const sourceFile of typeProgram.getSourceFiles()) { if (sourceFile.isDeclarationFile) continue; lawLines.push(`LAW\t${relative(rootPath, sourceFile.fileName)}\tunitsTwice\t${findDoubles(sourceFile.fileName, sourceFile.text).length}`); }
for (const [fileName, nameSet] of exportedNames) { let unimportedHere = 0; for (const exportedName of nameSet) if (!importedNames.has(`${basename(fileName)}:${exportedName}`)) { unimportedHere += 1; unimportedNames.push(`${basename(fileName)}:${exportedName}`); } lawLines.push(`LAW\t${fileName}\texportsUnimported\t${unimportedHere}`); }
for (const lawLine of lawLines.sort()) console.log(lawLine);
const listNames = (nameList: readonly string[]): string => (nameList.length === 0 ? "none" : nameList.join(" "));
console.log(`LAWNOTE duplicates: ${listNames(duplicatedNames)}`);
console.log(`LAWNOTE unimported exports: ${listNames(unimportedNames)}`);
console.log(`LAWNOTE refusals open: ${listNames(refusedNames)}`);
console.log(`LAWNOTE points before files.tsv: ${pointsUnhashed}`);
console.log(`LAWNOTE landings before law 1, no scorer kept: ${landingsBefore}`);
console.log(`LAWNOTE landings bound by law 1: ${landingsBound}`);
console.log(`LAWNOTE lock changes before law 2: ${productBefore}`);
console.log(`LAWNOTE product lines moved since law 2: ${productMoved}`);
