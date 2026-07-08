import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import pg from 'pg'

const scrypt = promisify(scryptCallback)
const { Client } = pg

const databaseUrl = process.env.DATABASE_URL
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@qc-oms.local'
const adminPassword = process.env.ADMIN_PASSWORD
const adminName = process.env.ADMIN_NAME ?? 'Admin'

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

if (!adminPassword) {
  throw new Error('ADMIN_PASSWORD is required for dev admin seed')
}

const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8')
  await client.query(schema)

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

  await client.query('delete from sessions where expires_at <= now()')
  console.log(`Migrated database and seeded admin ${adminEmail}`)
} finally {
  await client.end()
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt:v1:16384:8:1:${salt}:${key.toString('hex')}`
}
