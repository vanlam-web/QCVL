import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import pg from 'pg'
import { createPgRepository } from '../server/db.js'
import {
  applyKiotVietInvoiceImport,
  mapKiotVietInvoiceRows,
  parseKiotVietInvoiceWorkbookBuffer,
  previewKiotVietInvoiceImport,
  type KiotVietInvoiceImportRow,
} from '../server/modules/sales/kiotviet-invoice-import.js'

const { Pool } = pg

const confirmImport = process.env.QCVL_IMPORT_CONFIRM === 'true'
const organizationCode = process.env.QCVL_IMPORT_ORGANIZATION_CODE ?? 'VAN-LAM'
const exportDir = resolve(process.env.QCVL_KV_EXPORT_DIR ?? 'Y:\\DuLieuKV')

function readEnvFile(path: string) {
  if (!existsSync(path)) return {} as Record<string, string>
  const entries: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^\"(.*)\"$/, '$1').replace(/^'(.*)'$/, '$1')
    entries[key] = value
  }
  return entries
}

function postgresUrlFromParts(env: Record<string, string>) {
  if (!env.POSTGRES_DB || !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) return undefined
  const host = process.env.QCVL_NAS_DB_HOST ?? env.POSTGRES_HOST ?? '192.168.1.188'
  const port = process.env.QCVL_NAS_DB_PORT ?? env.POSTGRES_PORT ?? '55433'
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`
}

function databaseUrl() {
  const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\192.168.1.188\\docker\\QCVL\\app'
  const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? join(dirname(nasRoot), '.env')
  const nasEnv = readEnvFile(nasEnvPath)
  return process.env.QCVL_NAS_DATABASE_URL ?? process.env.DATABASE_URL ?? nasEnv.DATABASE_URL ?? postgresUrlFromParts(nasEnv)
}

function latestSourceFile() {
  const explicitFile = process.env.QCVL_KV_INVOICE_FILE
  if (explicitFile) return resolve(explicitFile)
  if (!existsSync(exportDir)) throw new Error(`KV export dir not found: ${exportDir}`)
  const candidates = readdirSync(exportDir)
    .filter((name) => /^DanhSachChiTietHoaDon_KV.*\.xlsx$/i.test(name))
    .map((name) => join(exportDir, name))
  if (candidates.length === 0) throw new Error(`No KiotViet invoice export found in: ${exportDir}`)
  return candidates
    .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime || left.file.localeCompare(right.file))
    [0].file
}

function rowsFromFile(file: string) {
  const rawRows = parseKiotVietInvoiceWorkbookBuffer(readFileSync(file))
  return mapKiotVietInvoiceRows(rawRows)
}

async function resolveOrganizationId(pool: pg.Pool) {
  const result = await pool.query('select id::text from organizations where code = $1 limit 1', [organizationCode])
  const id = result.rows[0]?.id
  if (!id) throw new Error(`Organization code not found: ${organizationCode}`)
  return String(id)
}

async function main() {
  const url = databaseUrl()
  if (!url) throw new Error('DATABASE_URL or NAS .env database settings are required')
  const pool = new Pool({ connectionString: url })
  const repo = createPgRepository(url)
  try {
    const organizationId = await resolveOrganizationId(pool)
    const file = latestSourceFile()
    const mapped = rowsFromFile(file)
    const preview = await previewKiotVietInvoiceImport({
      organizationId,
      repository: repo,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })
    if (!confirmImport) {
      console.log(JSON.stringify({ dry_run: true, file, preview: preview.summary, invalid_rows: preview.invalid_rows.slice(0, 10) }, null, 2))
      return
    }
    const result = await applyKiotVietInvoiceImport({
      organizationId,
      repository: repo,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })
    console.log(JSON.stringify({ dry_run: false, file, result: result.summary, invalid_rows: result.invalid_rows.slice(0, 10) }, null, 2))
  } finally {
    await repo.close?.()
    await pool.end()
  }
}

await main()
