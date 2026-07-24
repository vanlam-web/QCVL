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
