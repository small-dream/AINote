export interface ParsedTable {
  header: string[];
  rows: string[][];
  align: ("left" | "center" | "right" | null)[];
}

/** 解析 Markdown 表格源码为表头 + 数据行；支持转义竖线与单元格内代码。 */
export function parseMarkdownTable(source: string): ParsedTable | null {
  const rawLines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rawLines.length < 2) return null;
  const [first, second, ...rest] = rawLines;
  if (!first || !second) return null;
  const header = splitCells(first);
  const separatorCells = splitCells(second);
  if (!isValidHeader(header, separatorCells)) return null;
  const align = parseAlignment(second);
  return { header: padCells(header, align.length), rows: parseRows(rest, align.length), align };
}

function isValidHeader(header: string[], separatorCells: string[]): boolean {
  return header.length > 0 && !isSeparatorRow(header) && isSeparatorRow(separatorCells);
}

function parseRows(lines: string[], cellCount: number): string[][] {
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = splitCells(line);
    if (cells.length === 0) continue;
    rows.push(padCells(cells, cellCount));
  }
  return rows;
}

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === undefined) continue;
    ({ current, inCode, escaped } = stepCell(char, current, inCode, escaped, cells));
  }
  cells.push(current);
  trimEdgeCells(cells);
  return cells.map((cell) => cell.trim());
}

interface CellState {
  current: string;
  inCode: boolean;
  escaped: boolean;
}

function stepCell(char: string, current: string, inCode: boolean, escaped: boolean, cells: string[]): CellState {
  if (escaped) return { current: current + char, inCode, escaped: false };
  if (char === "\\" && !inCode) return { current, inCode, escaped: true };
  if (char === "`") return { current: current + char, inCode: !inCode, escaped: false };
  if (!inCode && char === "|") {
    cells.push(current);
    return { current: "", inCode, escaped: false };
  }
  return { current: current + char, inCode, escaped: false };
}

function trimEdgeCells(cells: string[]): void {
  while (cells[0]?.trim() === "") cells.shift();
  while (cells[cells.length - 1]?.trim() === "") cells.pop();
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

function parseAlignment(line: string): ("left" | "center" | "right" | null)[] {
  const cells = splitCells(line);
  return cells.map((cell) => {
    const text = cell.trim();
    if (!/^:?-+:?$/.test(text)) return null;
    const left = text.startsWith(":");
    const right = text.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

function padCells(cells: string[], length: number): string[] {
  const result = [...cells];
  while (result.length < length) result.push("");
  return result.slice(0, length);
}
