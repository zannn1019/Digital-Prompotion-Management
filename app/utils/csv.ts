/** Byte-order mark so Excel opens the UTF-8 file with the right characters. */
const BOM = '﻿'

/** Builds a CSV string and triggers a browser download. Cells are quoted when needed. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const text = rows.map(r => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([BOM + text], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 500)
}

/**
 * Quotes a cell when needed and neutralises spreadsheet formulas
 * (cells starting with = + - @), which Excel would otherwise execute.
 */
export function csvCell(v: string | number | null | undefined) {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
