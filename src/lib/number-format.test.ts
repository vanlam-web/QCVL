import { describe, expect, test } from 'vitest'
import { formatMeasure, formatMoney, parseMoneyInput } from './number-format'

describe('number formatting', () => {
  test('formats money without currency text and groups thousands with spaces', () => {
    expect(formatMoney(150000)).toBe('150 000')
    expect(formatMoney(2222222222222220)).toBe('2 222 222 222 222 220')
    expect(formatMoney(-120000)).toBe('-120 000')
  })

  test('parses money input with spaces as group separators and dot as decimal separator', () => {
    expect(parseMoneyInput('150 000')).toBe(150000)
    expect(parseMoneyInput('1.2')).toBe(1.2)
  })

  test('formats decimal quantities with a dot decimal separator', () => {
    expect(formatMeasure(1.2)).toBe('1.2')
    expect(formatMeasure(2706.125)).toBe('2706.125')
  })
})
