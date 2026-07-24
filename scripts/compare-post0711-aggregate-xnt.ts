import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'
import { compareQcvAggregateMovementsWithKiotVietXnt, mapKiotVietAggregateXntReportRows, parseKiotVietXntReportWorkbookBuffer } from '../server/modules/inventory/kiotviet-xnt-report.ts'

const url = process.env.QCVL_NAS_DATABASE_URL
const file = process.env.QCVL_KV_XNT_FILE
const output = process.env.QCVL_XNT_REPORT_OUTPUT
if (!url || !file || !output) throw new Error('QCVL_NAS_DATABASE_URL, QCVL_KV_XNT_FILE, QCVL_XNT_REPORT_OUTPUT required')
const cutoff = '2026-07-11T17:00:00.000Z'
const end = '2026-07-23T17:00:00.000Z'
async function main() {
  const mapped = mapKiotVietAggregateXntReportRows(parseKiotVietXntReportWorkbookBuffer(readFileSync(file)))
  if (mapped.invalid.length) throw new Error(`Invalid aggregate XNT rows: ${JSON.stringify(mapped.invalid.slice(0, 10))}`)
  const pool = new pg.Pool({ connectionString: url })
  const rows = (await pool.query<{ product_code: string; total_in_qty: string; total_out_qty: string }>(`
    select p.code as product_code,
      coalesce(sum(case when m.quantity_delta > 0 then m.quantity_delta else 0 end), 0) as total_in_qty,
      coalesce(sum(case when m.quantity_delta < 0 then -m.quantity_delta else 0 end), 0) as total_out_qty
    from stock_movements m join products p on p.id=m.product_id
    where m.created_at >= $1 and m.created_at < $2
    group by p.code
  `, [cutoff, end])).rows.map((row) => ({ product_code: row.product_code, total_in_qty: Number(row.total_in_qty), total_out_qty: Number(row.total_out_qty), ending_qty: null }))
  await pool.end()
  const comparison = compareQcvAggregateMovementsWithKiotVietXnt({ xntRows: mapped.valid, qcvRows: rows })
  const mismatches = comparison.filter((row) => row.qcv_total_in_qty === null || row.qcv_total_out_qty === null || Math.abs(row.total_in_diff ?? 0) > 0.001 || Math.abs(row.total_out_diff ?? 0) > 0.001)
  const report = { source: file, cutoff, end, kv_rows: mapped.valid.length, qcv_product_rows: rows.length, mismatch_count: mismatches.length, mismatches }
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ kv_rows: report.kv_rows, qcv_product_rows: report.qcv_product_rows, mismatch_count: report.mismatch_count, mismatches: mismatches.slice(0, 25) }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

