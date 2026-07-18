import { describe, expect, it } from 'vitest'
import type { Product } from '../catalog/types'
import {
  areaQuantity,
  cartLineDiscountPercent,
  checkoutSummary,
  clampLineDiscount,
  displaySaleUnitName,
  invoiceTabLabel,
  isInvoiceTabDirty,
  linesToCheckoutItems,
  makeCartLine,
  makeInvoiceTab,
  normalizeSearch,
  posPriceWithUnitText,
  readNonNegativeNumber,
  readPositiveMoney,
  removeCompletedInvoiceTab,
  initialQuotePayloadToTabs,
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

  it('builds checkout totals without UI state doing payment math', () => {
    const line = makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })

    const summary = checkoutSummary({
      cartLines: [{ ...line, discountAmount: 100000 }],
      checkoutDiscountAmount: 50000,
      cashAmount: 200000,
      bankAmount: 100000,
      paymentMode: 'mixed',
      selectedCustomerId: 'customer-1',
      surplusMode: 'old-debt',
      oldDebtPaymentAmount: 25000,
    })

    expect(summary.subtotal).toBe(600000)
    expect(summary.lineDiscountAmount).toBe(100000)
    expect(summary.maxCheckoutDiscount).toBe(500000)
    expect(summary.discountAmount).toBe(150000)
    expect(summary.total).toBe(450000)
    expect(summary.customerPaymentAmount).toBe(200000)
    expect(summary.received).toBe(300000)
    expect(summary.debt).toBe(150000)
    expect(summary.surplus).toBe(0)
    expect(summary.oldDebtPayment).toBe(25000)
    expect(summary.grossCashAmount).toBe(225000)
  })

  it('moves invoice-level discount into checkout line items in core logic', () => {
    const first = makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })
    const second = makeCartLine({ id: 'line-2', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })

    const items = linesToCheckoutItems([
      { ...first, discountAmount: 500000 },
      { ...second, discountAmount: 0 },
    ], 300000)

    expect(items.map((item) => item.discount_amount)).toEqual([600000, 200000])
  })

  it('carries selected sale unit conversion into checkout items', () => {
    const sheetProduct: Product = {
      id: 'p-f5',
      code: 'F5',
      name: 'Fomex 5mm',
      status: 'active',
      unit_name: 'Tấm',
      sell_method: 'quantity',
      unit_conversions: [
        {
          unit_id: 'unit-tac',
          unit_name: 'Tấc',
          stock_qty_per_unit: 0.05,
          is_default_purchase_unit: false,
          is_default_sale_unit: false,
        },
      ],
    }
    const line = makeCartLine({ id: 'line-f5', product: sheetProduct, unitPrice: 30000, priceSource: 'manual' })

    const [item] = linesToCheckoutItems([{ ...line, saleUnitName: 'Tấc', stockQtyPerSaleUnit: 0.05 }], 0)

    expect(item).toEqual(expect.objectContaining({
      product_id: 'p-f5',
      quantity: 1,
      sale_unit_name: 'Tấc',
      stock_qty_per_sale_unit: 0.05,
    }))
  })

  it('hides placeholder sale unit names from POS display helpers', () => {
    expect(displaySaleUnitName('Cần cập nhật')).toBe('')
    expect(displaySaleUnitName('Can cap nhat')).toBe('')
    expect(posPriceWithUnitText('0', 'Cần cập nhật')).toBe('0')
    expect(posPriceWithUnitText('120 000', 'm')).toBe('120 000/m')
  })

  it('keeps discount percent conversion in core logic', () => {
    const line = makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })

    expect(cartLineDiscountPercent({ ...line, discountAmount: 150000 })).toBe(25)
  })

  it('keeps invoice tab dirtiness independent from tab rendering', () => {
    const cleanTab = makeInvoiceTab(1)
    const dirtyTab = { ...cleanTab, orderNote: 'Ghi chu' }

    expect(isInvoiceTabDirty(cleanTab)).toBe(false)
    expect(isInvoiceTabDirty(dirtyTab)).toBe(true)
    expect(invoiceTabLabel(dirtyTab)).toContain('•')
  })

  it('removes the completed invoice tab and activates a remaining draft', () => {
    const first = makeInvoiceTab(1)
    const completed = {
      ...makeInvoiceTab(2),
      cartLines: [makeCartLine({ id: 'line-1', product: areaProduct, unitPrice: 600000, priceSource: 'manual' })],
    }

    const result = removeCompletedInvoiceTab([first, completed], completed.id)

    expect(result.tabs).toEqual([first])
    expect(result.activeTabId).toBe(first.id)
  })

  it('moves reopened quote marker into the draft note', () => {
    const [tab] = initialQuotePayloadToTabs({
      quote: { id: 'quote-1', code: 'BG000123', status: 'active' },
      customer: { customer_id: null, snapshot: { code: null, name: 'Khach le', phone: null }, warnings: [] },
      price_list: { price_list_id: null, snapshot: { code: null, name: null }, warnings: [] },
      items: [],
      summary: { subtotal_amount: 0, discount_amount: 0, total_amount: 0 },
      note: null,
    })

    expect(tab.orderNote).toBe('Từ báo giá BG000123')
    expect(tab.sourceQuote).toEqual({ id: 'quote-1', code: 'BG000123' })
  })

  it('parses POS numeric inputs in the core layer', () => {
    expect(areaQuantity(1.2, 0.5, 3)).toBe(1.8)
    expect(readNonNegativeNumber('1,25 m')).toBe(1.25)
    expect(readPositiveMoney('600 000')).toBe(600000)
  })
})
