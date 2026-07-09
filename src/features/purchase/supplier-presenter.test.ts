import { describe, expect, it } from 'vitest'
import type { Supplier } from './types'
import { supplierListSummary, supplierMoneyText } from './supplier-presenter'

const supplier: Supplier = {
  id: 'supplier-1',
  code: 'NCC001',
  name: 'Nha cung cap',
  phone: null,
  email: null,
  address: null,
  tax_code: null,
  linked_customer_id: null,
  linked_customer: null,
  notes: null,
  status: 'active',
  current_payable_amount: 250000,
  total_purchase_amount: 900000,
}

describe('supplier presenter', () => {
  it('summarizes supplier list outside the page', () => {
    expect(supplierListSummary([supplier, { ...supplier, id: 'supplier-2', current_payable_amount: 50000 }])).toEqual({
      payableTotal: 300000,
      purchaseTotal: 1800000,
    })
    expect(supplierListSummary(null)).toEqual({ payableTotal: 0, purchaseTotal: 0 })
  })

  it('formats supplier money outside the page', () => {
    expect(supplierMoneyText(1200000)).toBe('1 200 000')
  })
})
