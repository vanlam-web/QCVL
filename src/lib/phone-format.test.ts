import { describe, expect, it } from 'vitest'
import { formatPhoneDisplay } from './phone-format'

describe('formatPhoneDisplay', () => {
  it('adds a leading zero and groups Vietnamese phone numbers for display', () => {
    expect(formatPhoneDisplay('947900909')).toBe('0947 900 909')
    expect(formatPhoneDisplay('0947900909')).toBe('0947 900 909')
    expect(formatPhoneDisplay('767179678')).toBe('0767 179 678')
  })

  it('keeps input-free fallback behavior for empty values', () => {
    expect(formatPhoneDisplay(null)).toBe('')
    expect(formatPhoneDisplay('', 'Chưa có')).toBe('Chưa có')
  })
})
