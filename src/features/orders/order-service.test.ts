import { describe, expect, it, vi } from 'vitest'
import { createOrderService } from './order-service'

describe('createOrderService', () => {
  it('loads customer open debts with amount and limit query params', async () => {
    const request = vi.fn(async () => ({ items: [], has_more: false }))
    const service = createOrderService({ request: request as <T>(path: string, init?: RequestInit) => Promise<T> })

    await service.getCustomerOpenDebts('customer-1', { amount: 70000, limit: 50 })

    expect(request).toHaveBeenCalledWith('/api/v1/finance/customers/customer-1/open-debts?amount=70000&limit=50')
  })

  it('posts invoice revision payload to the locked-order revise endpoint', async () => {
    const request = vi.fn(async () => ({
      order: {
        id: 'order-2',
        code: 'HD000123.01',
        order_type: 'invoice' as const,
        status: 'completed' as const,
        total_amount: 150000,
        paid_amount: 150000,
        debt_amount: 0,
        payment_status: 'paid' as const,
      },
      payment_receipt: null,
      inventory_warnings: [],
    }))
    const service = createOrderService({ request: request as <T>(path: string, init?: RequestInit) => Promise<T> })

    await service.reviseInvoice('order-1', {
      customer_id: 'customer-1',
      created_at: '2026-07-18T04:51:00.000Z',
      note: 'Sua hoa don',
      revision_reason_code: 'wrong_price',
      items: [
        {
          product_id: 'product-1',
          quantity: 1,
          unit_price: 150000,
          discount_amount: 0,
          price_source: 'manual',
        },
      ],
      payment: {
        cash_amount: 150000,
        bank_amount: 0,
        bank_account_id: null,
        old_debt_payment_amount: 0,
        change_returned_amount: 0,
      },
    })

    expect(request).toHaveBeenCalledWith('/api/v1/orders/order-1/revise', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: 'customer-1',
        created_at: '2026-07-18T04:51:00.000Z',
        note: 'Sua hoa don',
        revision_reason_code: 'wrong_price',
        items: [
          {
            product_id: 'product-1',
            quantity: 1,
            unit_price: 150000,
            discount_amount: 0,
            price_source: 'manual',
          },
        ],
        payment: {
          cash_amount: 150000,
          bank_amount: 0,
          bank_account_id: null,
          old_debt_payment_amount: 0,
          change_returned_amount: 0,
        },
      }),
    })
  })
})
