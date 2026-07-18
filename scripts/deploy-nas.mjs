import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildSshArgs, requireRestartConfig, restartPlanFromEnv } from './deploy-nas-helpers.mjs'

const root = process.cwd()
const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\100.84.228.125\\docker\\QCVL\\app'
const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? join(dirname(nasRoot), '.env')
const confirmed = process.env.QCVL_NAS_DEPLOY_CONFIRM === 'true'
const restartPlan = restartPlanFromEnv(process.env, confirmed)

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'cmd.exe' : command
  const executableArgs = process.platform === 'win32' && command === 'npm' ? ['/d', '/s', '/c', 'npm', ...args] : args
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
  }
}

function robocopy(source, target, flags) {
  if (!confirmed) {
    console.log(`[dry-run] robocopy ${source} ${target} ${flags.join(' ')}`)
    return
  }

  if (!existsSync(target)) mkdirSync(target, { recursive: true })

  const result = spawnSync('robocopy', [source, target, ...flags], {
    cwd: root,
    stdio: 'inherit',
  })

  if (result.error) throw result.error

  const code = result.status ?? 1
  if (code > 3) throw new Error(`robocopy failed with exit ${code}: ${source} -> ${target}`)
}

function copyFile(source, target) {
  if (!confirmed) {
    console.log(`[dry-run] copy ${source} ${target}`)
    return
  }

  const targetDir = dirname(target)
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })

  run('powershell', [
    '-NoProfile',
    '-Command',
    `Copy-Item -LiteralPath '${source}' -Destination '${target}' -Force`,
  ])
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const entries = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    entries[key] = value
  }
  return entries
}

function nasMigrationEnv() {
  const nasEnv = readEnvFile(nasEnvPath)
  const databaseUrl = process.env.QCVL_NAS_DATABASE_URL
    ?? process.env.DATABASE_URL
    ?? nasEnv.DATABASE_URL
    ?? postgresUrlFromParts(nasEnv)
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ADMIN_EMAIL: process.env.QCVL_NAS_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? nasEnv.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.QCVL_NAS_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? nasEnv.ADMIN_PASSWORD,
    ADMIN_NAME: process.env.QCVL_NAS_ADMIN_NAME ?? process.env.ADMIN_NAME ?? nasEnv.ADMIN_NAME,
    QCVL_SKIP_ADMIN_SEED: process.env.QCVL_SKIP_ADMIN_SEED ?? 'true',
  }
}

function postgresUrlFromParts(env) {
  if (!env.POSTGRES_DB || !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) return undefined

  const host = process.env.QCVL_NAS_DB_HOST ?? env.POSTGRES_HOST ?? '100.84.228.125'
  const port = process.env.QCVL_NAS_DB_PORT ?? env.POSTGRES_PORT ?? '55433'
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`
}

function migrateNasDatabase() {
  if (!confirmed) {
    console.log(`[dry-run] npm run db:migrate using NAS env ${nasEnvPath}`)
    return
  }

  const env = nasMigrationEnv()
  if (!env.DATABASE_URL) throw new Error(`DATABASE_URL is required for NAS migration. Set QCVL_NAS_DATABASE_URL or add DATABASE_URL to ${nasEnvPath}`)

  run('npm', ['run', 'db:migrate'], { env })
}

run('npm', ['run', 'build:nas'])
run('npm', ['run', 'verify:nas-bundle'])

const quiet = ['/NFL', '/NDL', '/NJH', '/NJS', '/NP']

robocopy(join(root, 'dist'), join(nasRoot, 'dist'), ['/MIR', ...quiet])
robocopy(join(root, 'dist-server'), join(nasRoot, 'dist-server'), ['/MIR', ...quiet])
robocopy(join(root, 'server'), join(nasRoot, 'server'), ['/E', ...quiet])
robocopy(join(root, 'src'), join(nasRoot, 'src'), ['/E', ...quiet])
robocopy(join(root, 'public'), join(nasRoot, 'public'), ['/E', ...quiet])
robocopy(join(root, 'database'), join(nasRoot, 'database'), ['/E', ...quiet])

for (const file of [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tsconfig.server.json',
  'scripts/build-nas.mjs',
  'scripts/db-migrate.mjs',
  'scripts/db-migrate-dry-run.mjs',
  'scripts/seed-dev20-data.mjs',
]) {
  copyFile(join(root, file), join(nasRoot, file))
}

migrateNasDatabase()

console.log(`NAS restart plan: ${restartPlan.reason}`)
requireRestartConfig({ confirmed, restart: restartPlan.restart, sshTarget: process.env.QCVL_NAS_SSH_TARGET })

if (restartPlan.restart) {
  run('ssh', [
    ...buildSshArgs(process.env, process.env.QCVL_NAS_SSH_TARGET),
    'sudo /usr/local/bin/docker restart qcvl-app',
  ])
}

run('npm', ['run', 'health:nas'], {
  env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' },
})

if (!confirmed) {
  console.log('NAS deploy dry-run complete. Set QCVL_NAS_DEPLOY_CONFIRM=true to copy files.')
}
