import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\100.84.228.125\\docker\\QCVL\\app'
const restart = process.env.QCVL_NAS_RESTART === 'true'
const confirmed = process.env.QCVL_NAS_DEPLOY_CONFIRM === 'true'

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
  'scripts/seed-dev20-data.mjs',
]) {
  copyFile(join(root, file), join(nasRoot, file))
}

if (restart) {
  if (!confirmed) throw new Error('QCVL_NAS_DEPLOY_CONFIRM=true is required when QCVL_NAS_RESTART=true')

  const sshTarget = process.env.QCVL_NAS_SSH_TARGET
  if (!sshTarget) throw new Error('QCVL_NAS_SSH_TARGET is required when QCVL_NAS_RESTART=true')

  run('ssh', ['-tt', '-o', 'StrictHostKeyChecking=no', sshTarget, 'sudo -S /usr/local/bin/docker restart qcvl-app'])
}

run('npm', ['run', 'health:nas'])

if (!confirmed) {
  console.log('NAS deploy dry-run complete. Set QCVL_NAS_DEPLOY_CONFIRM=true to copy files.')
}
