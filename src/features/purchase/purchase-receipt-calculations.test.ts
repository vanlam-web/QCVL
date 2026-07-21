import { describe, expect, it } from 'vitest'
import {
  defaultPhysicalPayload,
  lineAmount,
  physicalSummary,
  purchaseReceiptListSummary,
  purchaseReceiptTotals,
  purchaseUnitForProduct,
  receiptOutstandingAfterPost,
  rollTotalArea,
  sheetGroupQuantity,
  sheetTotalArea,
  supplierPaymentsTotal,
} from './purchase-receipt-calculations'
import type { PurchaseReceiptInput, PurchaseReceiptProduct } from './purchase-receipt-types'

describe('purchase receipt calculations', () => {
  it('calculates line amount and receipt totals', () => {
    const form = {
      discount_amount: 10000,
      paid_amount: 50000,
      items: [
        { quantity: 2, unit_cost: 100000, discount_amount: 20000 },
        { quantity: 1, unit_cost: 50000, discount_amount: 0 },
      ],
    } as PurchaseReceiptInput

    expect(lineAmount(form.items[0])).toBe(180000)
    expect(purchaseReceiptTotals(form)).toEqual({ subtotal: 230000, payable: 220000, remaining: 170000 })
  })

  it('calculates physical roll and sheet summaries', () => {
    const rollPayload = { rolls: { width_m: 1.2, lengths_m: [10, 5] } }
    const sheetPayload = { sheet_groups: [{ width_m: 1, length_m: 2, quantity: 3 }] }

    expect(rollTotalArea(rollPayload)).toBe(18)
    expect(sheetTotalArea(sheetPayload)).toBe(6)
    expect(physicalSummary({ inventory_shape: 'roll', physical_payload: rollPayload })).toBe('2 cuộn, khổ 1.2m, tổng 18.000 m²')
    expect(physicalSummary({ inventory_shape: 'sheet', physical_payload: sheetPayload })).toBe('3 tấm, 1 nhóm kích thước, tổng 6.000 m²')
  })

  it('maps default physical payload and purchase unit', () => {
    expect(defaultPhysicalPayload('normal')).toBeNull()
    expect(defaultPhysicalPayload('roll')).toEqual({ rolls: { width_m: 1, lengths_m: [1] } })
    expect(defaultPhysicalPayload('sheet')).toEqual({ sheet_groups: [{ width_m: 1, length_m: 1, quantity: 1 }] })
    expect(purchaseUnitForProduct({ inventory_shape: 'roll' } as PurchaseReceiptProduct)).toBe('cuộn')
    expect(purchaseUnitForProduct({ inventory_shape: 'normal', unit_name: 'cái' } as PurchaseReceiptProduct)).toBe('cái')
    expect(purchaseUnitForProduct({
      inventory_shape: 'normal',
      unit_name: 'm2',
      unit_conversions: [
        { source_code: 'B100', unit_name: 'Khổ 100', stock_qty_per_unit: 80, is_default_purchase_unit: true, is_default_sale_unit: false },
      ],
    } as PurchaseReceiptProduct)).toBe('Khổ 100')
  })
  it('summarizes receipt lists and posted supplier payments', () => {
    const receipt = {
      payable_amount: 500000,
      remaining_amount: 300000,
      supplier_payments: [{ amount: 100000 }, { amount: 50000 }],
    }

    expect(purchaseReceiptListSummary([receipt])).toEqual({ payable: 500000, remaining: 300000 })
    expect(supplierPaymentsTotal(receipt.supplier_payments)).toBe(150000)
    expect(receiptOutstandingAfterPost(receipt)).toBe(150000)
    expect(sheetGroupQuantity([{ quantity: 2 }, { quantity: '3' }])).toBe(5)
  })
})
