import { describe, expect, it } from 'vitest'
import { displayPriceListName } from './price-list-display'

describe('displayPriceListName', () => {
  it('shows the default price list as Giá chung', () => {
    expect(displayPriceListName({ name: 'Bảng giá chung' })).toBe('Giá chung')
    expect(displayPriceListName({ name: 'Bang gia le' })).toBe('Giá chung')
    expect(displayPriceListName({ name: 'Tên bất kỳ', is_default: true })).toBe('Giá chung')
  })

  it('keeps named price lists unchanged', () => {
    expect(displayPriceListName({ name: '25' })).toBe('25')
    expect(displayPriceListName({ name: 'Đại lý' })).toBe('Đại lý')
  })
})
