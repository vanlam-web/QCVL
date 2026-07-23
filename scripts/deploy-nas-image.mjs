import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { buildSshArgs } from './deploy-nas-helpers.mjs'
import { assertSafeImageRef, checksumForFile, imageRefFromEnvText, releaseIdFrom, releaseManifest } from './nas-release-helpers.mjs'

const root = process.cwd()
const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? '\\\\192.168.1.188\\docker\\QCVL\\.env'
const nasRoot = dirname(nasEnvPath)
const activePath = join(nasRoot, 'active-image.env')
const composePath = join(nasRoot, 'docker-compose.yml')
const imageComposePath = join(root, 'docker-compose.nas.yml')
const archiveDir = join(root, '.nas-image')
const confirmed = process.env.QCVL_NAS_IMAGE_DEPLOY_CONFIRM === 'true'
const sshTarget = process.env.QCVL_NAS_SSH_TARGET
const linuxRoot = process.env.QCVL_NAS_LINUX_ROOT ?? '/volume1/docker/QCVL'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
}
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() }
function ssh(command) { run('ssh', [...buildSshArgs(process.env, sshTarget), command]) }
function remote(command) { return `set -eu; cd '${linuxRoot}'; ${command}` }
function backupPathFor(releaseId) { return join(nasRoot, 'backups', `docker-compose.before-image-${releaseId}.yml`) }

const commit = git(['rev-parse', 'HEAD'])
const dirty = git(['status', '--porcelain']).length > 0
if (dirty && process.env.QCVL_ALLOW_DIRTY_RELEASE !== 'true') throw new Error('Refusing dirty NAS image release. Commit first or set QCVL_ALLOW_DIRTY_RELEASE=true.')
const releaseId = releaseIdFrom({ commit })
const imageRef = assertSafeImageRef(`qcvl-app:${releaseId}`)
const archive = join(archiveDir, `${releaseId}.tar`)
const staging = join(nasRoot, 'images', '.staging', `${releaseId}.tar`)
const previous = existsSync(activePath) ? imageRefFromEnvText(readFileSync(activePath, 'utf8')) : null
const legacyComposeBackup = previous ? null : backupPathFor(releaseId)

if (!confirmed) {
  console.log(JSON.stringify({ mode: 'dry-run', releaseId, imageRef, previousImageRef: previous, archive, staging, legacyComposeBackup, requiresSsh: true }, null, 2))
  process.exit(0)
}
if (!sshTarget) throw new Error('QCVL_NAS_SSH_TARGET is required for image deployment.')
if (!existsSync(composePath)) throw new Error(`NAS Compose file not found: ${composePath}`)
run(process.execPath, ['scripts/build-nas-image.mjs'])
if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })
run('docker', ['save', '--output', archive, imageRef])
const checksum = checksumForFile(archive)
mkdirSync(dirname(staging), { recursive: true })
run('robocopy', [archiveDir, dirname(staging), `${releaseId}.tar`, '/R:2', '/W:2', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'])
const copiedChecksum = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-FileHash -LiteralPath '${staging}' -Algorithm SHA256).Hash.ToLowerInvariant()`], { encoding: 'utf8' }).trim()
if (copiedChecksum !== checksum) throw new Error(`NAS image archive checksum mismatch for ${staging}`)
ssh(remote(`mkdir -p images/.staging; test -f 'images/.staging/${releaseId}.tar'; sudo /usr/local/bin/docker load -i 'images/.staging/${releaseId}.tar'; test "$(sudo /usr/local/bin/docker image inspect --format '{{.Id}}' '${imageRef}')" != ''`))
const imageId = execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', imageRef], { cwd: root, encoding: 'utf8' }).trim()
const manifest = releaseManifest({ releaseId, commit, sourceDirty: dirty, imageRef, imageId })
writeFileSync(join(archiveDir, `${releaseId}.json`), `${JSON.stringify(manifest, null, 2)}\n`)

try {
  if (legacyComposeBackup) {
    mkdirSync(dirname(legacyComposeBackup), { recursive: true })
    copyFileSync(composePath, legacyComposeBackup, constants.COPYFILE_EXCL)
    copyFileSync(imageComposePath, composePath)
  }
  ssh(remote(`printf '%s\\n' 'QCVL_APP_IMAGE_REF=${imageRef}' > active-image.env.next; sudo /usr/local/bin/docker compose --env-file .env --env-file active-image.env.next run --rm -e QCVL_SKIP_ADMIN_SEED=true app node scripts/db-migrate.mjs; test ! -f active-image.env || cp active-image.env previous-image.env; mv active-image.env.next active-image.env; sudo /usr/local/bin/docker compose --env-file .env --env-file active-image.env up -d --force-recreate app; test "$(sudo /usr/local/bin/docker inspect --format '{{.Image}}' qcvl-app)" = "$(sudo /usr/local/bin/docker image inspect --format '{{.Id}}' '${imageRef}')"`))
  run(process.execPath, ['scripts/health-nas.mjs'], { env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' } })
  if (process.env.QCVL_SMOKE_PASSWORD) run(process.execPath, ['scripts/smoke-nas-ui.mjs'])
} catch (error) {
  if (previous) {
    ssh(remote(`printf '%s\\n' 'QCVL_APP_IMAGE_REF=${previous}' > active-image.env; sudo /usr/local/bin/docker compose --env-file .env --env-file active-image.env up -d --force-recreate app`))
    run(process.execPath, ['scripts/health-nas.mjs'], { env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' } })
  } else if (legacyComposeBackup) {
    copyFileSync(legacyComposeBackup, composePath)
    ssh(remote(`rm -f active-image.env active-image.env.next; sudo /usr/local/bin/docker compose --env-file .env --env-file active-release.env up -d --force-recreate app`))
    run(process.execPath, ['scripts/health-nas.mjs'], { env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' } })
  }
  throw error
} finally {
  rmSync(archive, { force: true })
}
console.log(JSON.stringify({ mode: 'deployed', previousImageRef: previous, legacyComposeBackup, ...manifest, checksum }, null, 2))