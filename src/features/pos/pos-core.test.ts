import { describe, expect, it } from 'vitest'
import type { Product } from '../catalog/types'
import {
  areaQuantity,
  clampLineDiscount,
  invoiceTabLabel,
  isInvoiceTabDirty,
  makeCartLine,
  makeInvoiceTab,
  normalizeSearch,
  readNonNegativeNumber,
  readPositiveMoney,
} from './pos-core'

const areaProduct: Product = {
  id: 'p-area',
  code: 'AREA',
  name: 'Area product',
  status: 'active',
  unit_name: 'm2',
  sell_method: 'area_m2',
}

describe('pos-core', () => {
  it('normalizes Vietnamese search text without touching UI components', () => {
    expect(normalizeSearch(' Mica Đỏ 3mm ')).toBe('mica đo 3mm')
  })

  it('creates default area cart lines in domain logic', () => {
    const line = makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })

    expect(line.quantity).toBe(1)
    expect(line.width_m).toBe(1)
    expect(line.height_m).toBe(1)
    expect(line.pieceCount).toBe(1)
  })

  it('keeps cart amount calculations capped by subtotal', () => {
    const line = makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })

    expect(clampLineDiscount({ ...line, discountAmount: 999999 }).discountAmount).toBe(600000)
  })

  it('keeps invoice tab dirtiness independent from tab rendering', () => {
    const cleanTab = makeInvoiceTab(1)
    const dirtyTab = { ...cleanTab, orderNote: 'Ghi chu' }

    expect(isInvoiceTabDirty(cleanTab)).toBe(false)
    expect(isInvoiceTabDirty(dirtyTab)).toBe(true)
    expect(invoiceTabLabel(dirtyTab)).toContain('•')
  })

  it('parses POS numeric inputs in the core layer', () => {
    expect(areaQuantity(1.2, 0.5, 3)).toBe(1.8)
    expect(readNonNegativeNumber('1,25 m')).toBe(1.25)
    expect(readPositiveMoney('600 000')).toBe(600000)
  })
})
