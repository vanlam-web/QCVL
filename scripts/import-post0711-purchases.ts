import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createPgRepository } from '../server/db.ts'
import { applyKiotVietPurchaseReceiptImport, mapKiotVietPurchaseReceiptRows, parseKiotVietPurchaseReceiptWorkbookBuffer, previewKiotVietPurchaseReceiptImport } from '../server/modules/purchase/purchase-receipt-import.ts'

const url = process.env.QCVL_NAS_DATABASE_URL
const file = process.env.QCVL_KV_PURCHASE_FILE
const apply = process.env.QCVL_IMPORT_CONFIRM === 'true'
if (!url || !file) throw new Error('QCVL_NAS_DATABASE_URL and QCVL_KV_PURCHASE_FILE required')
const repo = createPgRepository(url)
const pool = new pg.Pool({ connectionString: url })
const organizationId = String((await pool.query(`select id::text as id from organizations where code='VAN-LAM'`)).rows[0]?.id ?? '')
if (!organizationId) throw new Error('VAN-LAM organization not found')
const mapped = mapKiotVietPurchaseReceiptRows(parseKiotVietPurchaseReceiptWorkbookBuffer(readFileSync(file)))
const input = { organizationId, repository: repo, rows: mapped.valid, invalidRows: mapped.invalid }
const preview = await previewKiotVietPurchaseReceiptImport(input)
if (!apply) console.log(JSON.stringify({ dry_run: true, preview }, null, 2))
else console.log(JSON.stringify({ dry_run: false, preview, result: await applyKiotVietPurchaseReceiptImport(input) }, null, 2))
await repo.close(); await pool.end()
