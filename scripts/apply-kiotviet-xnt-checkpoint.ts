import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  mapKiotVietXntReportRows,
  parseKiotVietXntReportWorkbookBuffer,
  toKiotVietXntCheckpointRows,
} from '../server/modules/inventory/kiotviet-xnt-report.ts'

const apiBase = process.env.QCVL_API_BASE ?? 'http://127.0.0.1:3100'
const login = process.env.QCVL_LOGIN ?? 'admin'
const password = process.env.QCVL_PASSWORD ?? 'ChangeMe123!'
const reportPath = process.argv[2]

if (!reportPath) {
  throw new Error('Can truyen file BaoCaoXuatNhapTonChiTiet_KV*.xlsx.')
}

const sourceCode = process.env.QCVL_XNT_SOURCE_CODE ?? sourceCodeFromFilename(reportPath)
const checkpointAt = process.env.QCVL_XNT_CHECKPOINT_AT ?? new Date().toISOString()
const token = await loginToken()
const rawRows = parseKiotVietXntReportWorkbookBuffer(readFileSync(reportPath))
const mapped = mapKiotVietXntReportRows(rawRows)
const checkpointRows = toKiotVietXntCheckpointRows({
  sourceCode,
  checkpointAt,
  rows: mapped.valid,
})
const response = await apiPost('/api/v1/inventory/stocktakes/import/kiotviet', token, {
  allow_partial: true,
  cleanup_demo: false,
  rows: checkpointRows.map((row) => ({
    rowNumber: row.rowNumber,
    'Ma kiem kho': row.source_code,
    'Thoi gian': row.source_created_at,
    'Ngay can bang': row.source_balanced_at,
    'Trang thai': 'Da can bang kho',
    'Ma hang': row.product_code,
    'Ten hang': row.product_name,
    'Don vi tinh': row.unit_name,
    'Ton kho': row.actual_qty,
    'Kiem thuc te': row.actual_qty,
    'SL lech': 0,
    'Ghi chu': row.note,
  })),
})

console.log(`Da tao checkpoint XNT: ${sourceCode}`)
console.log(`File: ${basename(reportPath)}`)
console.log(`Checkpoint at: ${checkpointAt}`)
console.log(JSON.stringify(response.data?.summary ?? response.data ?? response, null, 2))

async function loginToken() {
  const response = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login, password }),
  })
  const body = await response.json() as { data?: { access_token?: string } }
  if (!body.data?.access_token) throw new Error('Dang nhap QCVL API that bai.')
  return body.data.access_token
}

async function apiPost(path: string, token: string, body: unknown) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`QCVL API loi ${response.status}: ${JSON.stringify(data)}`)
  return data
}

function sourceCodeFromFilename(path: string) {
  const name = basename(path, '.xlsx')
  const match = name.match(/KV(\d{8})-(\d{6})/)
  if (!match) return `XNT-KV-${new Date().toISOString().slice(0, 10)}`
  const [, date, time] = match
  return `XNT-KV-${date.slice(4, 8)}-${date.slice(2, 4)}-${date.slice(0, 2)}-${time}`
}
