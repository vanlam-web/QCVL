import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { releaseIdFrom, releaseManifest } from './nas-release-helpers.mjs'

const root = process.cwd()
const outputDir = join(root, '.nas-image')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
}
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() }

const commit = git(['rev-parse', 'HEAD'])
const dirty = git(['status', '--porcelain']).length > 0
if (dirty && process.env.QCVL_ALLOW_DIRTY_RELEASE !== 'true') throw new Error('Refusing dirty NAS image release. Commit first or set QCVL_ALLOW_DIRTY_RELEASE=true.')
const releaseId = process.env.QCVL_NAS_RELEASE_ID ?? releaseIdFrom({ commit })
const imageRef = `qcvl-app:${releaseId}`
const builtAt = new Date().toISOString()

run('docker', ['build', '--build-arg', `VCS_REF=${commit}`, '--build-arg', `BUILD_DATE=${builtAt}`, '--build-arg', `VITE_API_BASE_URL=${process.env.VITE_API_BASE_URL ?? 'http://100.84.228.125:3200'}`, '--build-arg', `VITE_APP_ENV=${process.env.VITE_APP_ENV ?? 'nas-dev'}`, '--tag', imageRef, '.'])
const imageId = execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', imageRef], { cwd: root, encoding: 'utf8' }).trim()
mkdirSync(outputDir, { recursive: true })
const manifest = releaseManifest({ releaseId, commit, sourceDirty: dirty, builtAt, imageRef, imageId })
writeFileSync(join(outputDir, `${releaseId}.json`), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))