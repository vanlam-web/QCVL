import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createPgRepository } from '../server/db.ts'
import { applyKiotVietCashbookImport, mapKiotVietCashbookRows, parseKiotVietCashbookWorkbookBuffer, previewKiotVietCashbookImport } from '../server/modules/finance/kiotviet-cashbook-import.ts'

const url = process.env.QCVL_NAS_DATABASE_URL
const files = (process.env.QCVL_KV_CASHBOOK_FILES ?? '').split(';').filter(Boolean)
const apply = process.env.QCVL_IMPORT_CONFIRM === 'true'
if (!url || files.length === 0) throw new Error('QCVL_NAS_DATABASE_URL and QCVL_KV_CASHBOOK_FILES required')
const repo = createPgRepository(url)
const pool = new pg.Pool({ connectionString: url })
const organizationId = String((await pool.query(`select id::text as id from organizations where code='VAN-LAM'`)).rows[0]?.id ?? '')
if (!organizationId) throw new Error('VAN-LAM organization not found')
const invalidRows = [] as ReturnType<typeof mapKiotVietCashbookRows>['invalid']
let ignoredSummaryRows = 0
const byCode = new Map<string, ReturnType<typeof mapKiotVietCashbookRows>['valid'][number]>()
for (const file of files) {
  const mapped = mapKiotVietCashbookRows(parseKiotVietCashbookWorkbookBuffer(readFileSync(file)))
  for (const invalid of mapped.invalid) {
    if (invalid.source_code === null && invalid.errors.length === 1 && invalid.errors[0] === 'missing_source_code') ignoredSummaryRows += 1
    else invalidRows.push(invalid)
  }
  for (const row of mapped.valid) {
    const key = row.source_code.toUpperCase()
    const existing = byCode.get(key)
    if (!existing || (existing.account_type === 'cash' && row.account_type === 'bank')) byCode.set(key, row)
  }
}
const input = { organizationId, repository: repo, rows: [...byCode.values()], invalidRows, createdBy: { id: '8e18abe9-a61f-4be9-9773-1093d4076161', name: 'Văn Lâm' } }
const preview = await previewKiotVietCashbookImport(input)
if (!apply) console.log(JSON.stringify({ dry_run: true, source_files: files, deduped_rows: input.rows.length, ignored_summary_rows: ignoredSummaryRows, preview }, null, 2))
else console.log(JSON.stringify({ dry_run: false, source_files: files, deduped_rows: input.rows.length, ignored_summary_rows: ignoredSummaryRows, preview, result: await applyKiotVietCashbookImport(input) }, null, 2))
await repo.close(); await pool.end()
