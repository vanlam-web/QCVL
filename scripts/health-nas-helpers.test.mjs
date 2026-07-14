import { describe, expect, test } from 'vitest'
import { validateNasHealthBody } from './health-nas-helpers.mjs'

describe('validateNasHealthBody', () => {
  test('accepts healthy NAS PostgreSQL response', () => {
    expect(
      validateNasHealthBody(
        {
          success: true,
          data: { persistence: 'postgres', service: 'qcvl-api', status: 'ok' },
          trace_id: 'trace-1',
        },
        'postgres',
      ),
    ).toEqual({ ok: true })
  })

  test('rejects memory persistence when PostgreSQL is required', () => {
    expect(
      validateNasHealthBody(
        {
          success: true,
          data: { persistence: 'memory', service: 'qcvl-api', status: 'ok' },
          trace_id: 'trace-2',
        },
        'postgres',
      ),
    ).toEqual({ ok: false, reason: 'expected persistence postgres, got memory' })
  })
})
