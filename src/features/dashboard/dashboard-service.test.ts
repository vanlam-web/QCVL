import { describe, expect, it, vi } from 'vitest'
import { buildDashboardData, createDashboardService } from './dashboard-service'
import type { SalesDocumentService } from '../sales-documents/sales-document-service'
import type { SalesDocumentDetail, SalesDocumentListItem } from '../sales-documents/types'
import type { PurchaseReceiptService } from '../purchase/purchase-receipt-service'
import type { PurchaseReceipt } from '../purchase/purchase-receipt-types'

const baseDocument: SalesDocumentListItem = {
  id: 'order-1',
  code: 'HD011143',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-17T08:00:00.000Z',
  customer: { id: 'customer-1', code: 'KH000514', name: 'Siêu thị Thành Cổ', phone: null },
  seller: { id: 'seller-1', name: 'Admin' },
  subtotal_amount: 120_000,
  discount_amount: 50_000,
  total_amount: 70_000,
  paid_amount: 70_000,
  debt_amount: 0,
  payment_status: 'paid',
  note: null,
}

function documentItem(input: Partial<SalesDocumentListItem>): SalesDocumentListItem {
  return { ...baseDocument, ...input }
}

function documentDetail(input: Partial<SalesDocumentDetail>): SalesDocumentDetail {
  return {
    ...baseDocument,
    price_list: null,
    change_returned_amount: 0,
    items: [],
    payment_receipts: [],
    debt_entries: [],
    stock_movements: [],
    history: [],
    ...input,
  }
}

function purchaseReceipt(input: Partial<PurchaseReceipt>): PurchaseReceipt {
  return {
    id: 'purchase-1',
    code: 'PN000001',
    supplier_id: 'supplier-1',
    supplier: { id: 'supplier-1', code: 'NCC000035', name: 'Thu Nghĩa' },
    received_at: '2026-07-17T08:30:00.000Z',
    status: 'posted',
    supplier_document_no: null,
    subtotal_amount: 500_000,
    discount_amount: 0,
    payable_amount: 500_000,
    paid_amount: 0,
    remaining_amount: 500_000,
    notes: null,
    created_by: { id: 'user-1', name: 'Nguyễn Quản Lý' },
    created_at: '2026-07-17T08:30:00.000Z',
    updated_at: '2026-07-17T08:30:00.000Z',
    items: [],
    supplier_payments: [],
    ...input,
  }
}

describe('dashboard-service', () => {
  it('builds dashboard metrics from real sales documents', () => {
    const now = new Date('2026-07-17T09:00:00.000Z')
    const todayDocuments = [
      documentItem({ id: 'order-1', code: 'HD011143', total_amount: 70_000, discount_amount: 50_000 }),
      documentItem({ id: 'order-2', code: 'HD011144', total_amount: 12_809_710, paid_amount: 0 }),
    ]
    const monthDocuments = [
      ...todayDocuments,
      documentItem({
        id: 'order-3',
        code: 'HD011100',
        created_at: '2026-07-16T08:00:00.000Z',
        customer: { id: 'customer-2', code: 'KH000518', name: 'DUY 842', phone: null },
        total_amount: 2_000_000,
      }),
    ]
    const recentDocuments = [
      documentItem({ id: 'order-1', code: 'HD011143', total_amount: 70_000, paid_amount: 70_000 }),
    ]
    const detailedDocuments = [
      documentDetail({
        id: 'order-1',
        items: [
          {
            id: 'line-1',
            line_no: 1,
            product: { id: 'product-1', code: 'SP000056', name: 'PP', unit_name: 'Tấm', sell_method: 'quantity' },
            quantity: 2,
            unit_price: 35_000,
            line_subtotal_amount: 70_000,
            discount_amount: 0,
            line_total: 70_000,
            price_source: 'manual',
            note: null,
          },
        ],
      }),
      documentDetail({
        id: 'order-3',
        items: [
          {
            id: 'line-2',
            line_no: 1,
            product: { id: 'product-2', code: 'SP000057', name: 'DV', unit_name: '', sell_method: 'quantity' },
            quantity: 1,
            unit_price: 2_000_000,
            line_subtotal_amount: 2_000_000,
            discount_amount: 0,
            line_total: 2_000_000,
            price_source: 'manual',
            note: null,
          },
        ],
      }),
    ]

    const data = buildDashboardData({ now, todayDocuments, monthDocuments, recentDocuments, detailedDocuments })

    expect(data.todayRevenue).toBe('12 879 710')
    expect(data.todayInvoiceCount).toBe(2)
    expect(data.todayNetRevenue).toBe('12 879 710')
    expect(data.salesResultRevenue).toBe('12 879 710')
    expect(data.salesResultInvoiceCount).toBe(2)
    expect(data.salesResultNetRevenue).toBe('12 879 710')
    expect(data.salesResultComparison).toMatchObject({
      direction: 'up',
      percent: '100.00%',
      label: 'So với hôm qua',
    })
    expect(data.monthNetRevenue).toBe('14 879 710')
    expect(data.topProducts[0]).toMatchObject({ label: 'SP000057 DV', value: '2tr', width: 100 })
    expect(data.topCustomers[0]).toMatchObject({ label: 'KH000514 Siêu thị Thành Cổ', value: '12,9tr' })
    expect(data.activities).toEqual([
      {
        kind: 'payment',
        actor: 'Admin',
        action: 'bán và thu hóa đơn',
        counterpartyPreposition: 'cho',
        counterpartyLabel: 'Siêu thị Thành Cổ',
        counterpartyCode: 'KH000514',
        counterpartyType: 'customer',
        value: '70 000',
        documentCode: 'HD011143',
        documentType: 'sales_invoice',
        time: '1 giờ trước',
      },
    ])
  })

  it('buckets revenue chart days by displayed API date instead of browser timezone', () => {
    const now = new Date('2026-07-19T09:00:00.000Z')
    const monthDocuments = [
      documentItem({
        id: 'late-july-11',
        code: 'HD011143',
        created_at: '2026-07-11T17:24:14.633Z',
        total_amount: 70_000,
      }),
    ]

    const data = buildDashboardData({
      now,
      todayDocuments: [],
      monthDocuments,
      recentDocuments: [],
      detailedDocuments: [],
    })

    expect(data.monthRevenuePoints[10]).toBe(70_000)
    expect(data.monthRevenuePoints[11]).toBe(0)
  })

  it('compares selected sales result period against the previous matching period', () => {
    const now = new Date('2026-07-17T09:00:00.000Z')
    const data = buildDashboardData({
      now,
      todayDocuments: [],
      monthDocuments: [],
      salesResultDocuments: [
        documentItem({ id: 'result-1', code: 'HD-R1', total_amount: 1_118_000 }),
      ],
      previousSalesResultDocuments: [
        documentItem({ id: 'previous-1', code: 'HD-P1', total_amount: 1_000_000 }),
      ],
      salesResultComparisonLabel: 'So với cùng kỳ tháng trước',
      recentDocuments: [],
      detailedDocuments: [],
    })

    expect(data.salesResultRevenue).toBe('1 118 000')
    expect(data.salesResultInvoiceCount).toBe(1)
    expect(data.salesResultNetRevenue).toBe('1 118 000')
    expect(data.salesResultComparison).toEqual({
      direction: 'up',
      percent: '11.80%',
      label: 'So với cùng kỳ tháng trước',
    })
  })

  it('includes purchase receipts in recent activity with supplier link metadata', () => {
    const now = new Date('2026-07-17T09:00:00.000Z')
    const data = buildDashboardData({
      now,
      todayDocuments: [],
      monthDocuments: [],
      recentDocuments: [documentItem({ created_at: '2026-07-17T08:00:00.000Z' })],
      recentPurchaseReceipts: [purchaseReceipt({})],
      detailedDocuments: [],
    })

    expect(data.activities[0]).toMatchObject({
      kind: 'purchase',
      actor: 'Nguyễn Quản Lý',
      action: 'mua hàng',
      counterpartyPreposition: 'từ',
      counterpartyLabel: 'Thu Nghĩa',
      counterpartyCode: 'NCC000035',
      counterpartyType: 'supplier',
      value: '500 000',
      documentCode: 'PN000001',
      documentType: 'purchase_receipt',
      time: '30 phút trước',
    })
  })

  it('limits product and customer ranks to top 10', () => {
    const now = new Date('2026-07-17T09:00:00.000Z')
    const monthDocuments = Array.from({ length: 11 }, (_, index) => {
      const rank = index + 1
      return documentItem({
        id: `order-rank-${rank}`,
        code: `HD${String(rank).padStart(6, '0')}`,
        customer: {
          id: `customer-${rank}`,
          code: `KH${String(rank).padStart(6, '0')}`,
          name: `Khách ${rank}`,
          phone: null,
        },
        total_amount: (12 - rank) * 1_000_000,
      })
    })
    const detailedDocuments = monthDocuments.map((document, index) => {
      const rank = index + 1
      return documentDetail({
        ...document,
        items: [
          {
            id: `line-rank-${rank}`,
            line_no: 1,
            product: {
              id: `product-${rank}`,
              code: `SP${String(rank).padStart(6, '0')}`,
              name: `Hàng ${rank}`,
              unit_name: '',
              sell_method: 'quantity',
            },
            quantity: 1,
            unit_price: document.total_amount,
            line_subtotal_amount: document.total_amount,
            discount_amount: 0,
            line_total: document.total_amount,
            price_source: 'manual',
            note: null,
          },
        ],
      })
    })

    const data = buildDashboardData({
      now,
      todayDocuments: [],
      monthDocuments,
      recentDocuments: [],
      detailedDocuments,
    })

    expect(data.topProducts).toHaveLength(10)
    expect(data.topCustomers).toHaveLength(10)
    expect(data.topProducts[0].label).toBe('SP000001 Hàng 1')
    expect(data.topCustomers[0].label).toBe('KH000001 Khách 1')
    expect(data.topProducts.map((item) => item.label)).not.toContain('SP000011 Hàng 11')
    expect(data.topCustomers.map((item) => item.label)).not.toContain('KH000011 Khách 11')
  })

  it('loads every dashboard page so early month invoices are included', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const firstPage = Array.from({ length: 100 }, (_, index) => documentItem({
      id: `month-page-1-${index}`,
      code: `HD-P1-${index}`,
      created_at: '2026-07-06T08:00:00.000Z',
      total_amount: 1_000,
    }))
    const secondPage = [
      documentItem({
        id: 'month-page-2-early',
        code: 'HD-P2-EARLY',
        created_at: '2026-07-01T08:00:00.000Z',
        total_amount: 5_000_000,
      }),
    ]
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (input.from === '2026-07-17') return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
      if (input.from === '2026-07-01') {
        return {
          items: input.page === 2 ? secondPage : firstPage,
          page: input.page ?? 1,
          page_size: input.page_size ?? 100,
          total: 101,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 8, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData()

      expect(data.monthRevenuePoints).toHaveLength(17)
      expect(data.monthRevenuePoints[0]).toBe(5_000_000)
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-01',
        page: 2,
        page_size: 100,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses the server clock for dashboard date ranges instead of the browser clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const listSalesDocuments = vi.fn(async (input = {}) => ({
      items: [],
      page: input.page ?? 1,
      page_size: input.page_size ?? 100,
      total: 0,
    })) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    }, undefined, undefined, {
      now: vi.fn(async () => new Date('2026-07-19T02:00:00.000Z')),
    })

    try {
      await service.loadDashboardData({ salesResultPeriod: 'today' })

      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-19',
        to: '2026-07-19',
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads only the first recent activity page for dashboard preview', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const firstActivityPage = Array.from({ length: 20 }, (_, index) => documentItem({
      id: `recent-page-1-${index}`,
      code: `HD-R1-${index}`,
      created_at: '2026-07-17T08:00:00.000Z',
      total_amount: index + 1,
    }))
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (!input.from && input.type === 'invoice') {
        return {
          items: firstActivityPage,
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 60,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData()

      expect(data.activities).toHaveLength(20)
      expect(data.hasMoreActivities).toBe(true)
      expect(data.activities.at(-1)).toMatchObject({
        documentCode: 'HD-R1-19',
        value: '20',
      })
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        type: 'invoice',
        page: 1,
        page_size: 20,
      }))
      expect(listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'invoice',
        page: 2,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads additional recent activity pages in batches of 20', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const thirdActivityPage = Array.from({ length: 20 }, (_, index) => documentItem({
      id: `recent-page-3-${index}`,
      code: `HD-R3-${index}`,
      created_at: '2026-07-17T08:00:00.000Z',
      total_amount: index + 41,
    }))
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (!input.from && input.type === 'invoice') {
        return {
          items: input.page === 3 ? thirdActivityPage : [],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 80,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardActivities?.({ page: 3, pageSize: 20 })

      expect(data?.activities).toHaveLength(20)
      expect(data?.activities[0]).toMatchObject({
        documentCode: 'HD-R3-0',
        value: '41',
      })
      expect(data?.hasMore).toBe(true)
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        type: 'invoice',
        page: 3,
        page_size: 20,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps loading sales activities when optional purchase activity source fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const salesPage = Array.from({ length: 20 }, (_, index) => documentItem({
      id: `recent-page-${index}`,
      code: `HD-R-${index}`,
      created_at: '2026-07-17T08:00:00.000Z',
      total_amount: index + 1,
    }))
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (!input.from && input.type === 'invoice') {
        return {
          items: input.page === 2 ? salesPage : [],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 40,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const purchaseReceiptService = {
      listReceipts: vi.fn(async () => {
        throw new Error('purchase source unavailable')
      }),
    } as unknown as PurchaseReceiptService
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    }, purchaseReceiptService)

    try {
      const data = await service.loadDashboardActivities?.({ page: 2, pageSize: 20 })

      expect(data?.activities).toHaveLength(20)
      expect(data?.activities[0]).toMatchObject({ documentCode: 'HD-R-0' })
      expect(data?.hasMore).toBe(true)
      expect(purchaseReceiptService.listReceipts).toHaveBeenCalledWith(expect.objectContaining({
        status: 'posted',
        page: 2,
        page_size: 20,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads recent purchase receipts alongside sales activity pages', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (!input.from && input.type === 'invoice') {
        return {
          items: [documentItem({ created_at: '2026-07-17T08:00:00.000Z' })],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 1,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const purchaseReceiptService = {
      listReceipts: vi.fn(async (input = {}) => ({
        items: [purchaseReceipt({})],
        page: input.page ?? 1,
        page_size: input.page_size ?? 20,
        total: 1,
      })),
    } as unknown as PurchaseReceiptService
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    }, purchaseReceiptService)

    try {
      const data = await service.loadDashboardData()

      expect(data.activities[0]).toMatchObject({ documentCode: 'PN000001', documentType: 'purchase_receipt' })
      expect(data.activities[1]).toMatchObject({ documentCode: 'HD011143', documentType: 'sales_invoice' })
      expect(purchaseReceiptService.listReceipts).toHaveBeenCalledWith(expect.objectContaining({
        status: 'posted',
        page: 1,
        page_size: 20,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps sales dashboard data when optional purchase activity source fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const monthOrder = documentItem({
      id: 'month-order',
      code: 'HD-MONTH',
      created_at: '2026-07-10T08:00:00.000Z',
      total_amount: 4_000,
    })
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (input.from === '2026-07-01' && input.to === '2026-07-17') {
        return {
          items: [monthOrder],
          page: input.page ?? 1,
          page_size: input.page_size ?? 100,
          total: 1,
        }
      }
      if (!input.from && input.type === 'invoice') {
        return {
          items: [monthOrder],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 1,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const purchaseReceiptService = {
      listReceipts: vi.fn(async () => {
        throw new Error('purchase source unavailable')
      }),
    } as unknown as PurchaseReceiptService
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({
        ...monthOrder,
        id,
        items: [
          {
            id: `line-${id}`,
            line_no: 1,
            product: { id: `product-${id}`, code: 'SP000001', name: 'Hàng', unit_name: '', sell_method: 'quantity' },
            quantity: 1,
            unit_price: 4_000,
            line_subtotal_amount: 4_000,
            discount_amount: 0,
            line_total: 4_000,
            price_source: 'manual',
            note: null,
          },
        ],
      })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    }, purchaseReceiptService)

    try {
      const data = await service.loadDashboardData()

      expect(data.salesResultRevenue).toBe('4 000')
      expect(data.monthNetRevenue).toBe('4 000')
      expect(data.activities[0]).toMatchObject({ documentCode: 'HD-MONTH' })
      expect(purchaseReceiptService.listReceipts).toHaveBeenCalledWith(expect.objectContaining({
        status: 'posted',
        page: 1,
        page_size: 20,
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('builds shared dashboard sections without hydrating document details', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const monthOrder = documentItem({
      id: 'shared-order',
      code: 'HD-SHARED',
      created_at: '2026-07-10T08:00:00.000Z',
      total_amount: 4_000,
    }) as SalesDocumentListItem & {
      items: Array<{
        product_id: string
        product_snapshot: { code: string; name: string; unit_name: string; sell_method: 'quantity' }
        quantity: number
        unit_price: number
        discount_amount: number
        line_total: number
      }>
    }
    monthOrder.items = [
      {
        product_id: 'product-shared',
        product_snapshot: { code: 'SP000001', name: 'Hàng', unit_name: '', sell_method: 'quantity' },
        quantity: 1,
        unit_price: 4_000,
        discount_amount: 0,
        line_total: 4_000,
      },
    ]
    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (input.from === '2026-07-01' && input.to === '2026-07-17') {
        return {
          items: [monthOrder],
          page: input.page ?? 1,
          page_size: input.page_size ?? 100,
          total: 1,
        }
      }
      if (!input.from && input.type === 'invoice') {
        return {
          items: [],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 0,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const getSalesDocument = vi.fn(async (id: string) => documentDetail({
      ...monthOrder,
      id,
      items: [
        {
          id: `line-${id}`,
          line_no: 1,
          product: { id: `product-${id}`, code: 'SP000001', name: 'Hàng', unit_name: '', sell_method: 'quantity' },
          quantity: 1,
          unit_price: 4_000,
          line_subtotal_amount: 4_000,
          discount_amount: 0,
          line_total: 4_000,
          price_source: 'manual',
          note: null,
        },
      ],
      history: [
        { at: '2026-07-17T08:00:00.000Z', action: 'create', actor_name: 'Admin', note: null },
      ],
    }))
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument,
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData()

      expect(data.topProducts[0]).toMatchObject({ label: 'SP000001 Hàng', value: '4 000' })
      expect(data.systemActivities).toEqual([])
      expect(getSalesDocument).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('builds dashboard rankings from list items without hydrating document details', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const rankedDocument = documentItem({
      id: 'ranked-order',
      code: 'HD-RANK',
      created_at: '2026-07-10T08:00:00.000Z',
      total_amount: 4_000,
    }) as SalesDocumentListItem & {
      items: Array<{
        product_id: string
        product_snapshot: { code: string; name: string; unit_name: string; sell_method: 'quantity' }
        quantity: number
        unit_price: number
        discount_amount: number
        line_total: number
      }>
    }
    rankedDocument.items = [
      {
        product_id: 'product-1',
        product_snapshot: { code: 'SP000001', name: 'Hang A', unit_name: 'cay', sell_method: 'quantity' },
        quantity: 1,
        unit_price: 4_000,
        discount_amount: 0,
        line_total: 4_000,
      },
    ]

    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (input.from === '2026-07-01' && input.to === '2026-07-17') {
        return {
          items: [rankedDocument],
          page: input.page ?? 1,
          page_size: input.page_size ?? 100,
          total: 1,
        }
      }
      if (!input.from && input.type === 'invoice') {
        return {
          items: [rankedDocument],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 1,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const getSalesDocument = vi.fn(async (id: string) => documentDetail({
      ...rankedDocument,
      id,
      items: [],
      history: [{ at: '2026-07-17T08:00:00.000Z', action: 'create', actor_name: 'Admin', note: null }],
    }))
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument,
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData()

      expect(data.topProducts[0]).toMatchObject({ label: 'SP000001 Hang A', value: '4 000' })
      expect(data.systemActivities).toEqual([])
      expect(getSalesDocument).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves product rank labels from catalog when list item snapshots are missing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const rankedDocument = documentItem({
      id: 'catalog-rank-order',
      code: 'HD-CATALOG-RANK',
      created_at: '2026-07-10T08:00:00.000Z',
      total_amount: 6_400_000,
    }) as SalesDocumentListItem & {
      items: Array<{
        product_id: string
        quantity: number
        unit_price: number
        discount_amount: number
      }>
    }
    rankedDocument.items = [
      {
        product_id: 'product-f5dc',
        quantity: 2,
        unit_price: 3_200_000,
        discount_amount: 0,
      },
    ]

    const listSalesDocuments = vi.fn(async (input = {}) => {
      if (input.from === '2026-07-01' && input.to === '2026-07-17') {
        return {
          items: [rankedDocument],
          page: input.page ?? 1,
          page_size: input.page_size ?? 100,
          total: 1,
        }
      }
      if (!input.from && input.type === 'invoice') {
        return {
          items: [rankedDocument],
          page: input.page ?? 1,
          page_size: input.page_size ?? 20,
          total: 1,
        }
      }
      return { items: [], page: input.page ?? 1, page_size: input.page_size ?? 100, total: 0 }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const getSalesDocument = vi.fn(async (id: string) => documentDetail({ id }))
    const productService = {
      listProducts: vi.fn(async () => ({
        items: [{ id: 'product-f5dc', code: 'IB', name: 'In bat' }],
        page: 1,
        page_size: 10000,
        total: 1,
      })),
    }
    const service = (createDashboardService as unknown as (...args: unknown[]) => ReturnType<typeof createDashboardService>)({
      listSalesDocuments,
      getSalesDocument,
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    }, undefined, productService)

    try {
      const data = await service.loadDashboardData()

      expect(data.topProducts[0]).toMatchObject({ label: 'IB In bat', value: '6,4tr' })
      expect(productService.listProducts).toHaveBeenCalledWith({ status: 'all', page: 1, page_size: 10000 })
      expect(getSalesDocument).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads dashboard sections from independent requested periods', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const todayOrder = documentItem({ id: 'today-order', created_at: '2026-07-17T08:00:00.000Z', total_amount: 1_000 })
    const yesterdayOrder = documentItem({ id: 'yesterday-order', created_at: '2026-07-16T08:00:00.000Z', total_amount: 2_000 }) as SalesDocumentListItem & {
      items: Array<{
        product_id: string
        product_snapshot: { code: string; name: string; unit_name: string; sell_method: 'quantity' }
        quantity: number
        unit_price: number
        discount_amount: number
        line_total: number
      }>
    }
    const lastWeekOrder = documentItem({ id: 'last-week-order', created_at: '2026-07-11T08:00:00.000Z', total_amount: 7_000 })
    const monthOrder = documentItem({ id: 'month-order', created_at: '2026-07-10T08:00:00.000Z', total_amount: 4_000 })
    const lastMonthOrder = documentItem({ id: 'last-month-order', created_at: '2026-06-10T08:00:00.000Z', total_amount: 9_000 })

    yesterdayOrder.items = [
      {
        product_id: 'product-yesterday',
        product_snapshot: { code: 'yesterday-order', name: 'Hàng', unit_name: '', sell_method: 'quantity' },
        quantity: 1,
        unit_price: 2_000,
        discount_amount: 0,
        line_total: 2_000,
      },
    ]

    const listSalesDocuments = vi.fn(async (input = {}) => {
      const key = `${input.from ?? ''}:${input.to ?? ''}`
      const itemsByRange: Record<string, SalesDocumentListItem[]> = {
        '2026-07-17:2026-07-17': [todayOrder],
        '2026-07-16:2026-07-16': [yesterdayOrder],
        '2026-07-11:2026-07-17': [lastWeekOrder],
        '2026-07-01:2026-07-17': [monthOrder],
        '2026-06-01:2026-06-30': [lastMonthOrder],
      }
      return {
        items: itemsByRange[key] ?? [],
        page: input.page ?? 1,
        page_size: input.page_size ?? 100,
        total: itemsByRange[key]?.length ?? 0,
      }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const getSalesDocument = vi.fn(async (id: string) => documentDetail({
      id,
      items: [
        {
          id: `line-${id}`,
          line_no: 1,
          product: { id: `product-${id}`, code: id, name: 'Hàng', unit_name: '', sell_method: 'quantity' },
          quantity: 1,
          unit_price: id === 'yesterday-order' ? 2_000 : 1_000,
          line_subtotal_amount: id === 'yesterday-order' ? 2_000 : 1_000,
          discount_amount: 0,
          line_total: id === 'yesterday-order' ? 2_000 : 1_000,
          price_source: 'manual',
          note: null,
        },
      ],
    }))
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument,
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData({
        revenuePeriod: 'last_7_days',
        productRankPeriod: 'yesterday',
        customerRankPeriod: 'last_month',
      })

      expect(data.monthNetRevenue).toBe('7 000')
      expect(data.topProducts[0]).toMatchObject({ label: 'yesterday-order Hàng', value: '2 000' })
      expect(data.topCustomers[0]).toMatchObject({ value: '9 000' })
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-11',
        to: '2026-07-17',
      }))
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-16',
        to: '2026-07-16',
      }))
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-06-01',
        to: '2026-06-30',
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads sales result period and matching previous comparison independently', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))

    const currentResultOrder = documentItem({ id: 'current-result', created_at: '2026-07-10T08:00:00.000Z', total_amount: 1_118_000 })
    const previousResultOrder = documentItem({ id: 'previous-result', created_at: '2026-06-10T08:00:00.000Z', total_amount: 1_000_000 })
    const listSalesDocuments = vi.fn(async (input = {}) => {
      const key = `${input.from ?? ''}:${input.to ?? ''}`
      const itemsByRange: Record<string, SalesDocumentListItem[]> = {
        '2026-07-01:2026-07-17': [currentResultOrder],
        '2026-06-01:2026-06-17': [previousResultOrder],
      }
      return {
        items: itemsByRange[key] ?? [],
        page: input.page ?? 1,
        page_size: input.page_size ?? 100,
        total: itemsByRange[key]?.length ?? 0,
      }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData({ salesResultPeriod: 'month' })

      expect(data.salesResultNetRevenue).toBe('1 118 000')
      expect(data.salesResultComparison).toEqual({
        direction: 'up',
        percent: '11.80%',
        label: 'So với cùng kỳ tháng trước',
      })
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-06-01',
        to: '2026-06-17',
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads remaining dashboard period pages in parallel after the first page reports total', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'))
    const monthItems = Array.from({ length: 156 }, (_, index) => documentItem({
      id: `month-${index + 1}`,
      code: `HD${String(index + 1).padStart(6, '0')}`,
      created_at: '2026-07-10T08:00:00.000Z',
      total_amount: 1_000,
      discount_amount: 0,
      paid_amount: 1_000,
      debt_amount: 0,
    }))
    const listSalesDocuments = vi.fn(async (input = {}) => {
      const page = input.page ?? 1
      const pageSize = input.page_size ?? 100
      const isCurrentMonth = input.from === '2026-07-01' && input.to === '2026-07-17'
      const items = isCurrentMonth ? monthItems.slice((page - 1) * pageSize, page * pageSize) : []
      return {
        items,
        page,
        page_size: pageSize,
        total: isCurrentMonth ? monthItems.length : 0,
      }
    }) satisfies SalesDocumentService['listSalesDocuments']
    const service = createDashboardService({
      listSalesDocuments,
      getSalesDocument: vi.fn(async (id: string) => documentDetail({ id })),
      cancelSalesDocument: vi.fn(),
      updateSalesDocumentNote: vi.fn(),
      previewKiotVietInvoiceImport: vi.fn(),
      importKiotVietInvoices: vi.fn(),
      deleteImportedKiotVietInvoices: vi.fn(),
    })

    try {
      const data = await service.loadDashboardData({ salesResultPeriod: 'month' })

      expect(data.salesResultInvoiceCount).toBe(156)
      expect(listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-01',
        to: '2026-07-17',
        page: 2,
        page_size: 100,
      }))
      expect(listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-07-01',
        to: '2026-07-17',
        page: 3,
      }))
    } finally {
      vi.useRealTimers()
    }
  })
})
