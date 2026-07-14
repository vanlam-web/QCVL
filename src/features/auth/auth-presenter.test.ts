import { describe, expect, it } from 'vitest'
import { normalizeLogin } from './auth-presenter'

describe('auth presenter', () => {
  it('normalizes login ids without forcing an email domain', () => {
    expect(normalizeLogin(' Admin ')).toBe('admin')
    expect(normalizeLogin(' 0947900909 ')).toBe('0947900909')
    expect(normalizeLogin('Admin@Example.com')).toBe('admin@example.com')
  })
})
