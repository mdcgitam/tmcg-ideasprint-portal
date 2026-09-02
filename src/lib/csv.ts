/**
 * Dependency-free CSV export — Excel opens CSV natively, so this satisfies
 * every "export as CSV / Excel" requirement without pulling in a
 * spreadsheet-writing library for what's ultimately flat tabular data.
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  // Leading BOM so Excel detects UTF-8 instead of guessing the system codepage.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
