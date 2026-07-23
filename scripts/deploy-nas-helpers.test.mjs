import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSshArgs, requireRestartConfig, restartPlanFromEnv } from './deploy-nas-helpers.mjs'

describe('restartPlanFromEnv', () => {
  test('requires restart by default for confirmed NAS deploys', () => {
    expect(restartPlanFromEnv({}, true)).toEqual({
      reason: 'confirmed deploy defaults to restarting qcvl-app',
      restart: true,
    })
  })

  test('does not restart during dry runs unless explicitly requested', () => {
    expect(restartPlanFromEnv({}, false)).toEqual({
      reason: 'dry run does not restart qcvl-app',
      restart: false,
    })
  })

  test('allows explicit no-restart only when requested', () => {
    expect(restartPlanFromEnv({ QCVL_NAS_RESTART: 'false' }, true)).toEqual({
      reason: 'QCVL_NAS_RESTART=false',
      restart: false,
    })
  })
})

describe('requireRestartConfig', () => {
  test('rejects confirmed restart without SSH target', () => {
    expect(() => requireRestartConfig({ confirmed: true, restart: true, sshTarget: undefined })).toThrow(
      'QCVL_NAS_SSH_TARGET is required',
    )
  })

  test('accepts confirmed restart with SSH target', () => {
    expect(() => requireRestartConfig({ confirmed: true, restart: true, sshTarget: 'admin@100.84.228.125' })).not.toThrow()
  })
})

describe('buildSshArgs', () => {
  test('includes key and port when configured', () => {
    expect(buildSshArgs({ QCVL_NAS_SSH_KEY: 'C:/Users/Admin/.ssh/qcvl', QCVL_NAS_SSH_PORT: '2222' }, 'admin@100.84.228.125')).toEqual([
      '-tt',
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=20',
      '-o',
      'ServerAliveInterval=15',
      '-o',
      'ServerAliveCountMax=4',
      '-o',
      'StrictHostKeyChecking=no',
      '-i',
      'C:/Users/Admin/.ssh/qcvl',
      '-o',
      'IdentitiesOnly=yes',
      '-p',
      '2222',
      'admin@100.84.228.125',
    ])
  })
})

describe('deploy script restart command', () => {
  test('does not use sudo stdin restart command', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'deploy-nas.mjs'), 'utf8')
    expect(script).not.toContain('sudo -S')
    expect(script).toContain('sudo /usr/local/bin/docker restart qcvl-app')
  })
})
