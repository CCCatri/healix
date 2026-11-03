/** Units appearing twice in one source text: doc comments by their bytes (each comment position read once) and top-level statements by their bytes. One definition, used by the edit instrument (which refuses the write) and by the gate (law unitsTwice, ceiling 0). Comment ranges are read as a list, so a position with none contributes nothing without an absence test. */
import ts from "typescript";

export function findDoubles(fileName: string, sourceText: string): string[] {
  const parsedSource = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const seenUnits = new Set<string>();
  const seenPositions = new Set<number>();
  const doubledUnits: string[] = [];
  const noteUnit = (unitText: string): void => { if (seenUnits.has(unitText)) doubledUnits.push(unitText.slice(0, 80)); seenUnits.add(unitText); };
  const scanComments = (scanAt: number): void => {
    ts.forEachLeadingCommentRange(sourceText, scanAt, (rangeStart, rangeEnd) => { if (!seenPositions.has(rangeStart) && sourceText.startsWith("/**", rangeStart)) { seenPositions.add(rangeStart); noteUnit(sourceText.slice(rangeStart, rangeEnd)); } });
  };
  const walkTree = (treeNode: ts.Node): void => { scanComments(treeNode.getFullStart()); ts.forEachChild(treeNode, walkTree); };
  walkTree(parsedSource);
  for (const topStatement of parsedSource.statements) noteUnit(topStatement.getText(parsedSource));
  return doubledUnits;
}
