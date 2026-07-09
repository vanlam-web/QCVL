import { spawnSync } from 'node:child_process'

const env = {
  ...process.env,
  VITE_API_BASE_URL: 'http://100.84.228.125:3200',
  VITE_APP_ENV: 'nas-dev',
}

delete env.VITE_ENABLE_PWA

const shell = process.platform === 'win32'
const result = spawnSync('npm', ['run', 'build:all'], {
  env,
  shell,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
