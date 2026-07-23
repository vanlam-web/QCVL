export function restartPlanFromEnv(env, confirmed) {
  if (env.QCVL_NAS_RESTART === 'true') {
    return { restart: true, reason: 'QCVL_NAS_RESTART=true' }
  }
  if (env.QCVL_NAS_RESTART === 'false') {
    return { restart: false, reason: 'QCVL_NAS_RESTART=false' }
  }
  if (confirmed) {
    return { restart: true, reason: 'confirmed deploy defaults to restarting qcvl-app' }
  }
  return { restart: false, reason: 'dry run does not restart qcvl-app' }
}

export function requireRestartConfig({ confirmed, restart, sshTarget }) {
  if (!restart) return
  if (!confirmed) throw new Error('QCVL_NAS_DEPLOY_CONFIRM=true is required when restarting qcvl-app')
  if (!sshTarget) {
    throw new Error(
      'QCVL_NAS_SSH_TARGET is required when restarting qcvl-app. Set it once, for example <nas-user>@100.84.228.125.',
    )
  }
}

export function buildSshArgs(env, sshTarget) {
  const args = [
    '-tt',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4',
    '-o', 'StrictHostKeyChecking=no',
  ]
  if (env.QCVL_NAS_SSH_KEY) args.push('-i', env.QCVL_NAS_SSH_KEY, '-o', 'IdentitiesOnly=yes')
  if (env.QCVL_NAS_SSH_PORT) args.push('-p', env.QCVL_NAS_SSH_PORT)
  args.push(sshTarget)
  return args
}
