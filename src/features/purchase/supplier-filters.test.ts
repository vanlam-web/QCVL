import { describe, expect, it } from 'vitest'
import { supplierNumberFilterValue } from './supplier-filters'

describe('supplier filters', () => {
  it('parses optional numeric filters outside the page', () => {
    expect(supplierNumberFilterValue('')).toBeUndefined()
    expect(supplierNumberFilterValue('abc')).toBeUndefined()
    expect(supplierNumberFilterValue('120000')).toBe(120000)
  })
})
