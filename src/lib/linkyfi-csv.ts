function parseDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

/** Extracts Linkyfi token codes exclusively from CSV column B. */
export function parseLinkyfiTokenCsv(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const delimiter = [',', ';', '\t'].reduce((best, candidate) =>
    parseDelimitedRow(lines[0], candidate).length > parseDelimitedRow(lines[0], best).length
      ? candidate
      : best
  );

  const seen = new Set<string>();
  const codes: string[] = [];

  for (const line of lines) {
    const code = (parseDelimitedRow(line, delimiter)[1] ?? '').trim();
    if (!code || /^(token\s*code|token|code|c[oó]digo)$/i.test(code)) continue;
    const normalized = code.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      codes.push(normalized);
    }
  }

  return codes;
}
