import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildSshArgs } from './deploy-nas-helpers.mjs'
import { assertSafeImageRef, imageRefFromEnvText } from './nas-release-helpers.mjs'

const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? '\\\\192.168.1.188\\docker\\QCVL\\.env'
const nasRoot = dirname(nasEnvPath)
const activePath = join(nasRoot, 'active-image.env')
const previousPath = join(nasRoot, 'previous-image.env')
const confirmed = process.env.QCVL_NAS_IMAGE_ROLLBACK_CONFIRM === 'true'
const sshTarget = process.env.QCVL_NAS_SSH_TARGET
const linuxRoot = process.env.QCVL_NAS_LINUX_ROOT ?? '/volume1/docker/QCVL'
if (!existsSync(activePath)) throw new Error(`NAS image state not found: ${activePath}`)
const active = imageRefFromEnvText(readFileSync(activePath, 'utf8'))
const previous = process.env.QCVL_NAS_ROLLBACK_IMAGE_REF ?? (existsSync(previousPath) ? imageRefFromEnvText(readFileSync(previousPath, 'utf8')) : null)
if (!active || !previous) throw new Error('Active and previous NAS image references are required for rollback.')
const target = assertSafeImageRef(previous)
if (!confirmed) { console.log(JSON.stringify({ mode: 'dry-run', activeImageRef: active, rollbackImageRef: target }, null, 2)); process.exit(0) }
if (!sshTarget) throw new Error('QCVL_NAS_SSH_TARGET is required for image rollback.')
const command = `set -eu; cd '${linuxRoot}'; sudo /usr/local/bin/docker image inspect '${target}' >/dev/null; cp active-image.env previous-image.env; printf '%s\\n' 'QCVL_APP_IMAGE_REF=${target}' > active-image.env; sudo /usr/local/bin/docker compose --env-file .env --env-file active-image.env up -d --force-recreate app`
const result = spawnSync('ssh', [...buildSshArgs(process.env, sshTarget), command], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`NAS image rollback failed with exit ${result.status}`)
const health = spawnSync(process.execPath, ['scripts/health-nas.mjs'], { stdio: 'inherit', env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' } })
if (health.status !== 0) process.exit(health.status ?? 1)
console.log(JSON.stringify({ mode: 'rolled-back', previousImageRef: active, activeImageRef: target, warning: 'PostgreSQL schema and data were not rolled back.' }, null, 2))