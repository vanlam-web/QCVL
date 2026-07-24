import { describe, expect, test } from 'vitest'
import { buildSshArgs } from './deploy-nas-helpers.mjs'

describe('buildSshArgs', () => {
  test('includes optional key and port without interactive authentication', () => {
    expect(buildSshArgs({ QCVL_NAS_SSH_KEY: 'C:/Users/Admin/.ssh/qcvl', QCVL_NAS_SSH_PORT: '2222' }, 'admin@100.84.228.125')).toEqual([
      '-tt',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=20',
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=4',
      '-o', 'StrictHostKeyChecking=no',
      '-i', 'C:/Users/Admin/.ssh/qcvl',
      '-o', 'IdentitiesOnly=yes',
      '-p', '2222',
      'admin@100.84.228.125',
    ])
  })
})
