import pg from 'pg'
import { appliedMigrations, migrationFiles, planMigrations } from './db-migrate.mjs'

const files = migrationFiles()
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.log(JSON.stringify({ files, pending: files, connected: false }, null, 2))
  process.exit(0)
}

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

try {
  const applied = await appliedMigrations(client)
  const pending = planMigrations(files, applied)
  console.log(JSON.stringify({ files, applied: [...applied].sort(), pending, connected: true }, null, 2))
} finally {
  await client.end()
}
