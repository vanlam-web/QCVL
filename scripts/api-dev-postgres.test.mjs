import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { apiDevCommand, postgresUrlFromNasEnv, resolveNasEnvPath } from './api-dev-postgres.mjs'

describe('api dev PostgreSQL startup', () => {
  test('routes npm api:dev through NAS PostgreSQL env loader', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

    expect(packageJson.scripts['api:dev']).toBe('node scripts/api-dev-postgres.mjs')
  })

  test('uses Tailscale NAS host and port when NAS env only has postgres credentials', () => {
    const url = postgresUrlFromNasEnv({
      POSTGRES_DB: 'qcvl',
      POSTGRES_USER: 'qcvl_user',
      POSTGRES_PASSWORD: 'secret value',
    }, {})

    expect(url).toBe('postgres://qcvl_user:secret%20value@100.84.228.125:55433/qcvl')
  })

  test('allows explicit NAS DB host override without exposing passwords', () => {
    const url = postgresUrlFromNasEnv({
      POSTGRES_DB: 'qcvl',
      POSTGRES_USER: 'qcvl_user',
      POSTGRES_PASSWORD: 'secret value',
    }, {
      QCVL_NAS_DB_HOST: '127.0.0.1',
      QCVL_NAS_DB_PORT: '15432',
    })

    expect(url).toBe('postgres://qcvl_user:secret%20value@127.0.0.1:15432/qcvl')
  })

  test('resolves Tailscale NAS env path by default', () => {
    expect(resolveNasEnvPath({})).toBe('\\\\100.84.228.125\\docker\\QCVL\\.env')
  })

  test('uses cmd.exe to launch tsx watch on Windows', () => {
    expect(apiDevCommand('win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'tsx', 'watch', 'server/index.ts'],
    })
  })
})
