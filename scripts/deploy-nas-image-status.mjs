import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { imageRefFromEnvText } from './nas-release-helpers.mjs'

const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? '\\\\192.168.1.188\\docker\\QCVL\\.env'
const root = dirname(nasEnvPath)
const activePath = join(root, 'active-image.env')
const previousPath = join(root, 'previous-image.env')
const readRef = (path) => existsSync(path) ? imageRefFromEnvText(readFileSync(path, 'utf8')) : null
console.log(JSON.stringify({
  activeImageRef: readRef(activePath),
  previousImageRef: readRef(previousPath),
  activeStatePath: activePath,
  previousStatePath: previousPath,
  status: existsSync(activePath) ? 'configured' : 'not-configured',
}, null, 2))
