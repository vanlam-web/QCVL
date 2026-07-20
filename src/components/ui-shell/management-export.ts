export type ManagementExportCell = string | number | boolean | null | undefined

export function buildManagementCsv(rows: ManagementExportCell[][]) {
  return `\uFEFF${rows.map((row) => row.map(formatCsvCell).join(',')).join('\r\n')}`
}

export function downloadManagementCsv({ filename, rows }: { filename: string; rows: ManagementExportCell[][] }) {
  const csv = buildManagementCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatCsvCell(value: ManagementExportCell) {
  const text = value === null || value === undefined ? '' : String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}
