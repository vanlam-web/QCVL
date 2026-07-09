import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const assetsDir = join(distDir, 'assets')
const forbidden = '100.84.228.125:3100'
const required = '100.84.228.125:3200'

if (!existsSync(assetsDir)) {
  throw new Error('dist/assets not found. Run npm run build:nas first.')
}

const files = readdirSync(assetsDir)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => join(assetsDir, file))

const offenders = []
let requiredFound = false

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  if (content.includes(forbidden)) offenders.push(file)
  if (content.includes(required)) requiredFound = true
}

if (offenders.length > 0) {
  throw new Error(`NAS bundle points to container-only API port ${forbidden}: ${offenders.join(', ')}`)
}

if (!requiredFound) {
  throw new Error(`NAS bundle does not contain public API base URL ${required}. Run npm run build:nas before verify/deploy.`)
}

console.log(`NAS bundle OK: uses ${required} and does not use ${forbidden}.`)
