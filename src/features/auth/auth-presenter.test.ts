import { describe, expect, it } from 'vitest'
import { normalizeLogin } from './auth-presenter'

describe('auth presenter', () => {
  it('normalizes local login ids outside the login page', () => {
    expect(normalizeLogin(' Admin ')).toBe('admin@qc-oms.local')
    expect(normalizeLogin('Admin@Example.com')).toBe('admin@example.com')
  })
})
