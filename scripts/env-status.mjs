import pg from 'pg'
import { appliedMigrations, migrationFiles, planMigrations } from './db-migrate.mjs'

const name = process.env.QCVL_ENV_NAME ?? 'local'
const baseUrl = process.env.QCVL_ENV_BASE_URL
const databaseUrl = process.env.DATABASE_URL

const status = { name, base_url: baseUrl ?? null, health: null, database: null }

if (baseUrl) {
  try {
    const response = await fetch(new URL('/api/v1/health', baseUrl))
    status.health = { ok: response.ok, status: response.status, body: await response.json().catch(() => null) }
  } catch (error) {
    status.health = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

if (databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const files = migrationFiles()
    const applied = await appliedMigrations(client)
    const pending = planMigrations(files, applied)
    status.database = { connected: true, files, applied: [...applied].sort(), pending, in_sync: pending.length === 0 }
  } finally {
    await client.end()
  }
} else {
  const files = migrationFiles()
  status.database = { connected: false, files, pending: files, in_sync: false }
}

console.log(JSON.stringify(status, null, 2))
