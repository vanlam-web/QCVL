import { spawnSync } from 'node:child_process'
import { buildSshArgs, requireRestartConfig } from './deploy-nas-helpers.mjs'

const root = process.cwd()
const sshTarget = process.env.QCVL_NAS_SSH_TARGET

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

requireRestartConfig({ confirmed: true, restart: true, sshTarget })

run('ssh', [
  ...buildSshArgs(process.env, sshTarget),
  'sudo /usr/local/bin/docker restart qcvl-app',
])

run('npm', ['run', 'health:nas'], {
  env: { ...process.env, QCVL_NAS_REQUIRE_PERSISTENCE: 'postgres' },
})
