/** Split one CSV record line into fields (handles quoted commas). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

export function parseCsvTable(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map((line) =>
    parseCsvLine(line).map((c) => c.replace(/^"|"$/g, "").trim()),
  );
  return { headers, rows };
}
