import { describe, expect, it } from 'vitest'
import { databaseUrlFromEnv } from './runtime-config'

describe('databaseUrlFromEnv', () => {
  it('uses DATABASE_URL when it is provided', () => {
    expect(databaseUrlFromEnv({ DATABASE_URL: 'postgres://direct/db' })).toBe('postgres://direct/db')
  })

  it('builds a PostgreSQL URL from NAS POSTGRES_* variables', () => {
    expect(
      databaseUrlFromEnv({
        POSTGRES_DB: 'qcoms_dev',
        POSTGRES_USER: 'qcoms_dev',
        POSTGRES_PASSWORD: 'secret value',
      }),
    ).toBe('postgres://qcoms_dev:secret%20value@postgres:5432/qcoms_dev')
  })

  it('returns undefined when no database configuration exists', () => {
    expect(databaseUrlFromEnv({})).toBeUndefined()
  })
})
