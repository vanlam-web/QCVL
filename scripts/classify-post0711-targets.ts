import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const manifestPath = process.env.QCVL_RECOVERY_MANIFEST
const databaseUrl = process.env.QCVL_NAS_DATABASE_URL
if (!manifestPath || !databaseUrl) throw new Error('QCVL_RECOVERY_MANIFEST and QCVL_NAS_DATABASE_URL required')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { records: Array<{ source_kind: string; date_range: string; source_code: string | null }> }
const cutoff = '2026-07-11T17:00:00.000Z'
const byKind = new Map<string, Set<string>>()
for (const row of manifest.records) {
  if (!row.source_code) continue
  const codes = byKind.get(row.source_kind) ?? new Set<string>()
  codes.add(row.source_code.toUpperCase())
  byKind.set(row.source_kind, codes)
}
const sourceCodes = new Set([...byKind.values()].flatMap((codes) => [...codes]))
async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const queries: Array<[string, string]> = [
    ['orders', `select code, created_at from orders where created_at >= $1 order by code`],
    ['cashbook_entries', `select code, created_at from cashbook_entries where created_at >= $1 order by code`],
    ['purchase_receipt_snapshots', `select code, created_at from purchase_receipt_snapshots where created_at >= $1 order by code`],
    ['stock_movements', `select coalesce(document_type, '') || ':' || coalesce(document_code, '') as code, created_at from stock_movements where created_at >= $1 order by 1`],
  ]
  const result: Record<string, unknown> = { cutoff, source_code_counts: Object.fromEntries([...byKind].map(([kind, codes]) => [kind, codes.size])) }
  for (const [domain, sql] of queries) {
    const rows = (await pool.query<{ code: string; created_at: string }>(sql, [cutoff])).rows
    const classified = rows.filter((row) => sourceCodes.has(row.code.split(':').at(-1)!.toUpperCase()))
    const unclassified = rows.filter((row) => !sourceCodes.has(row.code.split(':').at(-1)!.toUpperCase()))
    result[domain] = { total: rows.length, source_backed: classified.length, unclassified }
  }
  await pool.end()
  const outputPath = process.env.QCVL_RECOVERY_CLASSIFICATION_OUTPUT ?? 'logs/post0711-recovery-classification.json'
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
