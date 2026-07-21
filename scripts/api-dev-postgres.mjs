import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.cwd()

export function resolveNasEnvPath(env) {
  if (env.QCVL_NAS_ENV_PATH) return env.QCVL_NAS_ENV_PATH
  const nasRoot = env.QCVL_NAS_APP_PATH ?? '\\\\100.84.228.125\\docker\\QCVL\\app'
  // Keep Windows UNC siblings portable on Linux CI (path.dirname breaks \\server\share).
  if (nasRoot.includes('\\')) {
    const trimmed = nasRoot.replace(/[\\/]+$/, '')
    const parent = trimmed.replace(/[\\/][^\\/]+$/, '')
    return `${parent}\\.env`
  }
  return join(dirname(nasRoot), '.env')
}

export function readEnvFile(path) {
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

export function postgresUrlFromNasEnv(nasEnv, processEnv) {
  if (processEnv.QCVL_NAS_DATABASE_URL) return processEnv.QCVL_NAS_DATABASE_URL
  if (processEnv.DATABASE_URL) return processEnv.DATABASE_URL
  if (nasEnv.DATABASE_URL) return nasEnv.DATABASE_URL
  if (!nasEnv.POSTGRES_DB || !nasEnv.POSTGRES_USER || !nasEnv.POSTGRES_PASSWORD) return undefined

  const host = processEnv.QCVL_NAS_DB_HOST ?? nasEnv.POSTGRES_HOST ?? '100.84.228.125'
  const port = processEnv.QCVL_NAS_DB_PORT ?? nasEnv.POSTGRES_PORT ?? '55433'
  return `postgres://${encodeURIComponent(nasEnv.POSTGRES_USER)}:${encodeURIComponent(nasEnv.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(nasEnv.POSTGRES_DB)}`
}

function maskedTarget(databaseUrl) {
  try {
    const url = new URL(databaseUrl)
    return `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`
  } catch {
    return 'postgres'
  }
}

export function apiDevCommand(platform = process.platform) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'tsx', 'watch', 'server/index.ts'],
    }
  }
  return {
    command: join(root, 'node_modules', '.bin', 'tsx'),
    args: ['watch', 'server/index.ts'],
  }
}

function startApiDev() {
  const nasEnvPath = resolveNasEnvPath(process.env)
  const nasEnv = readEnvFile(nasEnvPath)
  const databaseUrl = postgresUrlFromNasEnv(nasEnv, process.env)
  if (!databaseUrl) {
    throw new Error(`Cannot start api:dev with PostgreSQL. Set DATABASE_URL/QCVL_NAS_DATABASE_URL or make NAS env readable at ${nasEnvPath}.`)
  }

  const command = apiDevCommand(process.platform)
  console.log(`api:dev using PostgreSQL ${maskedTarget(databaseUrl)} from ${nasEnvPath}`)
  const child = spawn(command.command, command.args, {
    cwd: root,
    env: {
      ...process.env,
      ...nasEnv,
      DATABASE_URL: databaseUrl,
      PORT: process.env.PORT ?? '3100',
    },
    stdio: 'inherit',
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
  child.on('error', (error) => {
    throw error
  })
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && currentFile === resolve(process.argv[1])) {
  startApiDev()
}
