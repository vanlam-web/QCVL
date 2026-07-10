import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import pg from 'pg'

const scrypt = promisify(scryptCallback)
const { Client } = pg

export function planMigrations(files, applied) {
  return files
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
    .filter((file) => !applied.has(file))
}

export function migrationFiles(migrationsDir = defaultMigrationsDir()) {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort()
}

export async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `)
}

export async function appliedMigrations(client) {
  await ensureMigrationTable(client)
  const result = await client.query('select filename from schema_migrations')
  return new Set(result.rows.map((row) => row.filename))
}

export async function baselineExistingSchema(client, files) {
  await ensureMigrationTable(client)
  const result = await client.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'organizations'
    ) as has_schema
  `)
  if (result.rows[0]?.has_schema !== true) return []

  const stamped = []
  for (const filename of files) {
    await client.query('insert into schema_migrations (filename) values ($1) on conflict do nothing', [filename])
    stamped.push(filename)
  }
  return stamped
}

export async function runMigrations(client, migrationsDir = defaultMigrationsDir(), options = {}) {
  const files = migrationFiles(migrationsDir)
  if (options.baseline) {
    return { applied: [], baselineStamped: await baselineExistingSchema(client, files) }
  }

  const applied = await appliedMigrations(client)
  const pending = planMigrations(files, applied)
  const appliedNow = []

  for (const filename of pending) {
    const sql = readFileSync(join(migrationsDir, filename), 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into schema_migrations (filename) values ($1)', [filename])
      await client.query('commit')
      appliedNow.push(filename)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  return { applied: appliedNow, baselineStamped: [] }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@qc-oms.local'
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME ?? 'Admin'
  const skipAdminSeed = process.env.QCVL_SKIP_ADMIN_SEED === 'true'

  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  if (!skipAdminSeed && !adminPassword) throw new Error('ADMIN_PASSWORD is required for dev admin seed')

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const result = await runMigrations(client, defaultMigrationsDir(), {
      baseline: process.env.QCVL_MIGRATION_BASELINE === 'true',
    })
    if (!skipAdminSeed) await seedAdmin(client, { adminEmail, adminPassword, adminName })
    await client.query('delete from sessions where expires_at <= now()')
    console.log(JSON.stringify({ migrated: result.applied, baseline_stamped: result.baselineStamped, admin: skipAdminSeed ? null : adminEmail }))
  } finally {
    await client.end()
  }
}

async function seedAdmin(client, { adminEmail, adminPassword, adminName }) {
  const passwordHash = await hashPassword(adminPassword)
  await client.query(
    `
      with org as (
        select id from organizations where code = 'VAN-LAM'
      ),
      upserted_user as (
        insert into users (organization_id, email, password_hash, display_name, status)
        select org.id, lower($1), $2, $3, 'active'
        from org
        on conflict (organization_id, email) do update
        set password_hash = excluded.password_hash,
            display_name = excluded.display_name,
            status = 'active',
            updated_at = now()
        returning id
      )
      insert into user_permissions (user_id, permission_code)
      select upserted_user.id, permissions.code
      from upserted_user
      cross join permissions
      on conflict do nothing
    `,
    [adminEmail, passwordHash, adminName],
  )
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt:v1:16384:8:1:${salt}:${key.toString('hex')}`
}

function defaultMigrationsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
