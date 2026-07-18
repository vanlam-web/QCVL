import { describe, expect, it } from 'vitest'
import type { CustomerDebtSummary } from '../finance/types'
import type { InventoryProduct } from '../inventory/types'
import type { SalesDocumentListItem } from '../sales-documents/types'
import { reportOverviewSummary, reportDateText, reportNumberText } from './reports-presenter'

const sale: SalesDocumentListItem = {
  id: 'sale-1',
  code: 'HD0001',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-05T02:00:00Z',
  customer: { id: 'customer-1', code: 'KH001', name: 'Anh Nam', phone: null },
  seller: { id: 'seller-1', name: 'Nhan vien' },
  subtotal_amount: 600000,
  discount_amount: 100000,
  total_amount: 500000,
  paid_amount: 300000,
  debt_amount: 200000,
  payment_status: 'partial',
  note: null,
}

const debt: CustomerDebtSummary = {
  customer_id: 'customer-1',
  customer_code: 'KH001',
  customer_name: 'Anh Nam',
  total_debt: 250000,
  oldest_order_code: 'HD0001',
  open_invoice_count: 1,
}

const inventoryProduct: InventoryProduct = {
  product_id: 'product-1',
  code: 'SP001',
  name: 'Mica',
  status: 'active',
  inventory_shape: 'normal',
  stock_unit: 'tam',
  available_qty: -2.5,
  is_negative: true,
}

describe('reports-presenter', () => {
  it('summarizes report data outside the reports page', () => {
    expect(reportOverviewSummary({
      sales: [sale],
      debts: [debt],
      inventory: [inventoryProduct],
    })).toEqual({
      salesTotal: 500000,
      salesPaid: 300000,
      salesDebt: 200000,
      debtTotal: 250000,
      negativeStockCount: 1,
      inventoryQty: -2.5,
    })
  })

  it('formats report display values outside the reports page', () => {
    expect(reportDateText('not-a-date')).toBe('')
    expect(reportNumberText(1234.567)).toBe('1.234,567')
  })
})
