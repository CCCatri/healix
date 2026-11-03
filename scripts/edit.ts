/** The edit instrument. argv: <file> <edits.json>. Each edit names one node by syntax: every key of its select is a criterion — kind (a SyntaxKind name, compared by enum value), within (an enclosing function or method name), name (the declared name of a VariableStatement, TypeAlias or Function), module (an ImportDeclaration's module text), typeOnly, whenTrueNew (a ConditionalExpression whose whenTrue is `new <X>()`), identifier, callee, startsWith — and a key naming no criterion refuses the run. Each edit carries exactly one action, replace or insertAfter. A selector that resolves to 0 or more than 1 node refuses the whole file. A unit is its leading doc comments plus its node, so a replace span begins at the first leading `/**` comment. Edits apply by span, descending, never overlapping. Before writing, the result is refused if any doc comment or top-level statement appears twice (scripts/doubles.ts); after writing, the file is read back and must equal what was written. Doctrine: the edits file is read as unknown and checked at the door — an array of objects, a select object of string or boolean values, exactly one action holding a string — each failure a thrown refusal naming the edit; names are identifier children; comment ranges arrive by callback; no absence is tested or filled and no value takes a typed name unchecked. */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { findItem } from "../src/matrix.ts";
import { findDoubles } from "./doubles.ts";

type Criterion = (treeNode: ts.Node, wantedValue: string | boolean) => boolean;
type Span = { readonly spanStart: number; readonly spanEnd: number; readonly spanText: string };
type EditSpec = { readonly selectMap: Record<string, string | boolean>; readonly actionName: string; readonly actionText: string };

const argList = process.argv.slice(2);
const filePath = findItem(argList, 0);
const editsPath = findItem(argList, 1);
const sourceText = readFileSync(filePath, "utf8");
const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
const actionNames = ["replace", "insertAfter"];

/** JSON text as a value of unknown type: every field is checked before it takes a typed name. */
function parseJson(jsonText: string): unknown { return JSON.parse(jsonText); }
/** One field of an object by key; a key absent is a refusal, never an absent value. */
function findField(recordValue: object, keyName: string): unknown {
  const fieldList = Object.entries(recordValue).filter(([entryName]) => entryName === keyName).map(([, entryValue]) => entryValue);
  if (fieldList.length !== 1) throw new Error(`no field ${keyName}`);
  return findItem(fieldList, 0);
}
/** The edits file checked at the door into typed edit specs. */
function listEdits(editsText: string): readonly EditSpec[] {
  const parsedValue = parseJson(editsText);
  if (!Array.isArray(parsedValue)) throw new Error("edits file is not an array");
  return parsedValue.map((editItem: unknown, editAt): EditSpec => {
    if (!(editItem instanceof Object)) throw new Error(`edit ${editAt} is not an object`);
    const selectValue = findField(editItem, "select");
    if (!(selectValue instanceof Object)) throw new Error(`edit ${editAt}: select is not an object`);
    const selectMap: Record<string, string | boolean> = Object.fromEntries(Object.entries(selectValue).map(([criterionName, wantedValue]) => { if (typeof wantedValue !== "string" && typeof wantedValue !== "boolean") throw new Error(`edit ${editAt}: criterion ${criterionName} is not a string or boolean`); return [criterionName, wantedValue]; }));
    const actionKeys = Object.keys(editItem).filter((keyName) => actionNames.includes(keyName));
    if (actionKeys.length !== 1) throw new Error(`edit ${editAt}: ${actionKeys.length} actions, expected one of ${actionNames.join(", ")}`);
    const actionName = findItem(actionKeys, 0);
    const actionValue = findField(editItem, actionName);
    if (typeof actionValue !== "string") throw new Error(`edit ${editAt}: ${actionName} is not a string`);
    return { selectMap, actionName, actionText: actionValue };
  });
}
/** A SyntaxKind by name, as its enum value; an unknown name is a defect. */
function findKind(kindName: string): number {
  const kindEntries = Object.entries(ts.SyntaxKind).filter(([entryName, entryValue]) => entryName === kindName && typeof entryValue === "number");
  if (kindEntries.length !== 1) throw new Error(`no SyntaxKind named ${kindName}`);
  return Number(findItem(kindEntries, 0)[1]);
}
/** Identifier children of a node, in order; a declaration's own name is the first. */
function listIdentifiers(treeNode: ts.Node): readonly string[] { return treeNode.getChildren(sourceFile).filter(ts.isIdentifier).map((nameNode) => nameNode.text); }
/** The declared name of a VariableStatement, TypeAlias or Function: a list of one, or none. */
function listDeclared(treeNode: ts.Node): readonly string[] {
  if (ts.isVariableStatement(treeNode)) return listIdentifiers(findItem(treeNode.declarationList.declarations, 0)).slice(0, 1);
  if (ts.isTypeAliasDeclaration(treeNode) || ts.isFunctionDeclaration(treeNode)) return listIdentifiers(treeNode).slice(0, 1);
  return [];
}
/** The ancestors of a node, nearest first, ending at the source file. */
function listAncestors(treeNode: ts.Node): readonly ts.Node[] { return ts.isSourceFile(treeNode) ? [] : [treeNode.parent, ...listAncestors(treeNode.parent)]; }

const criteriaMap: Record<string, Criterion> = {
  kind: (treeNode, wantedValue) => treeNode.kind === findKind(String(wantedValue)),
  within: (treeNode, wantedValue) => listAncestors(treeNode).some((upNode) => (ts.isFunctionDeclaration(upNode) || ts.isMethodDeclaration(upNode)) && listIdentifiers(upNode).slice(0, 1).includes(String(wantedValue))),
  name: (treeNode, wantedValue) => listDeclared(treeNode).includes(String(wantedValue)),
  module: (treeNode, wantedValue) => ts.isImportDeclaration(treeNode) && ts.isStringLiteral(treeNode.moduleSpecifier) && treeNode.moduleSpecifier.text === wantedValue,
  typeOnly: (treeNode, wantedValue) => ts.isImportDeclaration(treeNode) && treeNode.getChildren(sourceFile).filter(ts.isImportClause).some((clauseNode) => clauseNode.isTypeOnly) === wantedValue,
  whenTrueNew: (treeNode, wantedValue) => ts.isConditionalExpression(treeNode) && ts.isNewExpression(treeNode.whenTrue) && ts.isIdentifier(treeNode.whenTrue.expression) && treeNode.whenTrue.expression.text === wantedValue,
  identifier: (treeNode, wantedValue) => ts.isIdentifier(treeNode) && treeNode.text === wantedValue,
  callee: (treeNode, wantedValue) => ts.isExpressionStatement(treeNode) && ts.isCallExpression(treeNode.expression) && ts.isIdentifier(treeNode.expression.expression) && treeNode.expression.expression.text === wantedValue,
  startsWith: (treeNode, wantedValue) => treeNode.getText(sourceFile).startsWith(String(wantedValue)),
};
/** The criterion a select key names; a key naming none is a defect. */
function findCriterion(criterionName: string): Criterion {
  const criterionEntries = Object.entries(criteriaMap).filter(([entryName]) => entryName === criterionName);
  if (criterionEntries.length !== 1) throw new Error(`no criterion named ${criterionName}`);
  return findItem(criterionEntries, 0)[1];
}
/** Whether a node meets every criterion of a select. */
function judgeSelect(treeNode: ts.Node, selectMap: Record<string, string | boolean>): boolean { return Object.entries(selectMap).every(([criterionName, wantedValue]) => findCriterion(criterionName)(treeNode, wantedValue)); }
/** Where a unit begins: the first leading `/**` comment of the node, or the node itself when it has none; the comment positions arrive by callback. */
function findStart(unitNode: ts.Node): number {
  const docStarts: number[] = [];
  ts.forEachLeadingCommentRange(sourceText, unitNode.getFullStart(), (rangeStart) => { if (sourceText.startsWith("/**", rangeStart)) docStarts.push(rangeStart); });
  return docStarts.length === 0 ? unitNode.getStart(sourceFile) : findItem(docStarts, 0);
}

const editList = listEdits(readFileSync(editsPath, "utf8"));
const spanList: Span[] = [];
let refusedCount = 0;
editList.forEach((editSpec, editAt) => {
  const foundNodes: ts.Node[] = [];
  const visitTree = (treeNode: ts.Node): void => { if (judgeSelect(treeNode, editSpec.selectMap)) foundNodes.push(treeNode); ts.forEachChild(treeNode, visitTree); };
  visitTree(sourceFile);
  if (foundNodes.length !== 1) { refusedCount += 1; console.log(`REFUSE edit ${editAt} ${JSON.stringify(editSpec.selectMap)}: ${foundNodes.length} nodes`); return; }
  const foundNode = findItem(foundNodes, 0);
  if (editSpec.actionName === "replace") spanList.push({ spanStart: findStart(foundNode), spanEnd: foundNode.getEnd(), spanText: editSpec.actionText });
  else spanList.push({ spanStart: foundNode.getEnd(), spanEnd: foundNode.getEnd(), spanText: `\n${editSpec.actionText}` });
  console.log(`edit ${editAt} ${JSON.stringify(editSpec.selectMap)}: 1 node at ${findStart(foundNode)}-${foundNode.getEnd()}`);
});
if (refusedCount > 0) { console.log(`REFUSED ${filePath}: ${refusedCount} edits`); process.exit(1); }
spanList.sort((leftSpan, rightSpan) => rightSpan.spanStart - leftSpan.spanStart);
for (let spanAt = 1; spanAt < spanList.length; spanAt += 1) { const laterSpan = findItem(spanList, spanAt - 1); const earlierSpan = findItem(spanList, spanAt); if (earlierSpan.spanEnd > laterSpan.spanStart) { console.log(`REFUSED ${filePath}: overlapping edits`); process.exit(1); } }
let outText = sourceText;
for (const spanValue of spanList) outText = outText.slice(0, spanValue.spanStart) + spanValue.spanText + outText.slice(spanValue.spanEnd);
const doubledUnits = findDoubles(filePath, outText);
if (doubledUnits.length > 0) { console.log(`REFUSED ${filePath}: ${doubledUnits.length} units would appear twice: ${doubledUnits.join(" | ")}`); process.exit(1); }
writeFileSync(filePath, outText);
if (readFileSync(filePath, "utf8") !== outText) { console.log(`REFUSED ${filePath}: read-back differs from what was written`); process.exit(1); }
console.log(`WROTE ${filePath}: ${spanList.length} edits, read back equal`);
