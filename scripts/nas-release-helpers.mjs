import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const NAS_RELEASE_SLOTS = ['app-a', 'app-b']
export const REQUIRED_RUNTIME_FILES = ['dist/index.html', 'dist-server/index.js', 'package.json', 'package-lock.json']

export function releaseIdFrom({ now = new Date(), commit }) {
  const compactUtc = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const shortCommit = String(commit ?? '').trim().slice(0, 12)
  if (!/^[0-9a-f]{7,12}$/i.test(shortCommit)) throw new Error('A Git commit SHA is required to create a NAS release ID.')
  return `${compactUtc}-${shortCommit.toLowerCase()}`
}

export function inactiveSlotFrom(activeSlot) {
  if (!NAS_RELEASE_SLOTS.includes(activeSlot)) throw new Error(`Unknown NAS release slot: ${activeSlot}`)
  return NAS_RELEASE_SLOTS.find((slot) => slot !== activeSlot)
}

export function activeSlotFromEnvText(text) {
  const match = /^QCVL_RELEASE_PATH=\.\/(app-[ab])\s*$/m.exec(String(text ?? ''))
  return match?.[1] ?? null
}

export function imageRefFromEnvText(text) {
  const match = /^QCVL_APP_IMAGE_REF=([^\s#]+)\s*$/m.exec(String(text ?? ''))
  return match?.[1] ?? null
}

export function assertSafeImageRef(ref) {
  const value = String(ref ?? '').trim()
  if (!/^qcvl-app:\d{14}-[0-9a-f]{7,12}$/i.test(value)) throw new Error('NAS image ref must be immutable qcvl-app:<UTC>-<commit>.')
  return value
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

export function artifactStats(root) {
  const files = filesIn(root)
  return { files: files.length, bytes: files.reduce((total, file) => total + statSync(file).size, 0) }
}

export function verifyRuntimeArtifacts(root) {
  const missing = REQUIRED_RUNTIME_FILES.filter((relativePath) => !existsSync(join(root, relativePath)))
  if (missing.length > 0) throw new Error(`NAS release staging is missing required artifacts: ${missing.join(', ')}`)
  return artifactStats(root)
}

export function checksumForFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function releaseManifest({ releaseId, commit, sourceDirty, builtAt = new Date().toISOString(), artifact, imageRef, imageId }) {
  return { releaseId, commit, builtAt, sourceDirty: Boolean(sourceDirty), ...(artifact ?? {}), ...(imageRef ? { imageRef } : {}), ...(imageId ? { imageId } : {}) }
}