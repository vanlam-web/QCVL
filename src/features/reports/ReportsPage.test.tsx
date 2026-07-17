import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReportsPage } from './ReportsPage'
import type { ReportService } from './report-service'
import type { CashbookEntry, CustomerDebtSummary } from '../finance/types'
import type { InventoryProduct } from '../inventory/types'
import type { SalesDocumentListItem } from '../sales-documents/types'

const sale: SalesDocumentListItem = {
  id: 'sale-1',
  code: 'HD0001',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-05T02:00:00Z',
  customer: { id: 'customer-1', code: 'KH001', name: 'Anh Nam', phone: null },
  seller: { id: 'seller-1', name: 'Chủ xưởng' },
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
  total_debt: 200000,
  oldest_order_code: 'HD0001',
  open_invoice_count: 1,
}

const cashbookEntry: CashbookEntry = {
  id: 'entry-1',
  code: 'PT0001',
  status: 'posted',
  direction: 'in',
  amount_delta: 300000,
  finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-05T02:05:00Z',
  note: null,
  counterparty: { type: 'none', name: null, phone: null },
}

const inventoryProduct: InventoryProduct = {
  product_id: 'product-1',
  code: 'MICA-3MM',
  name: 'Mica 3mm',
  status: 'active',
  inventory_shape: 'normal',
  stock_unit: 'tấm',
  available_qty: -2,
  is_negative: true,
}

function makeService(empty = false): ReportService {
  return {
    listSalesDocuments: vi.fn(async () => ({ items: empty ? [] : [sale], page: 1, page_size: 100, total: empty ? 0 : 1 })),
    listCustomerDebts: vi.fn(async () => ({ items: empty ? [] : [debt], page: 1, page_size: 100, total: empty ? 0 : 1 })),
    listCashbook: vi.fn(async () => ({
      summary: { opening_balance: 100000, total_in: empty ? 0 : 300000, total_out: 0, ending_balance: empty ? 100000 : 400000 },
      items: empty ? [] : [cashbookEntry],
      page: 1,
      page_size: 100,
      total: empty ? 0 : 1,
    })),
    listInventoryProducts: vi.fn(async () => ({ items: empty ? [] : [inventoryProduct], page: 1, page_size: 100, total: empty ? 0 : 1 })),
  }
}

describe('ReportsPage', () => {
  it('shows empty report states', async () => {
    render(<ReportsPage service={makeService(true)} />)

    expect(await screen.findByText('Chưa có hóa đơn bán hàng trong khoảng ngày.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có khách còn nợ.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có hàng hóa đang kinh doanh.')).toBeInTheDocument()
  })

  it('shows sales, debt, cashbook, and inventory report data', async () => {
    render(<ReportsPage service={makeService()} />)

    expect((await screen.findAllByText('HD0001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Anh Nam').length).toBeGreaterThan(0)
    expect(screen.getByText('PT0001')).toBeInTheDocument()
    expect(screen.getByText('MICA-3MM')).toBeInTheDocument()
    expect(screen.getAllByText('Âm kho').length).toBeGreaterThan(0)
  })

  it('sorts report tables from shared column headers', async () => {
    const secondSale: SalesDocumentListItem = {
      ...sale,
      id: 'sale-2',
      code: 'HD0002',
      total_amount: 900000,
      paid_amount: 900000,
      debt_amount: 0,
      customer: { id: 'customer-2', code: 'KH002', name: 'Chi Hoa', phone: null },
    }
    const service = {
      ...makeService(),
      listSalesDocuments: vi.fn(async () => ({ items: [sale, secondSale], page: 1, page_size: 100, total: 2 })),
    }
    render(<ReportsPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Bán hàng' })
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('HD0001')

    await userEvent.click(within(table).getByRole('button', { name: 'Tổng tiền' }))

    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('HD0002')
    expect(within(table).getByRole('columnheader', { name: 'Tổng tiền' })).toHaveAttribute('aria-sort', 'descending')
  })

  it('filters reports by date range', async () => {
    const service = makeService()
    render(<ReportsPage service={service} />)

    await screen.findAllByText('HD0001')
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc báo cáo' })
    expect(within(sidebar).getByRole('heading', { name: 'Thời gian' })).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Từ ngày'))
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-07-01')
    await userEvent.clear(screen.getByLabelText('Đến ngày'))
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-07-05')
    await userEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))

    expect(service.listSalesDocuments).toHaveBeenLastCalledWith({ from: '2026-07-01', to: '2026-07-05', page: 1, page_size: 100 })
    expect(service.listCashbook).toHaveBeenLastCalledWith({ from: '2026-07-01', to: '2026-07-05', page: 1, page_size: 100 })
  })

  it('keeps report apply action without a reset shortcut in the shared sidebar action bar', async () => {
    const service = makeService()
    render(<ReportsPage service={service} />)

    await screen.findAllByText('HD0001')
    await userEvent.clear(screen.getByLabelText('Từ ngày'))
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-07-01')

    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc báo cáo' })
    expect(within(sidebar).getByRole('button', { name: 'Xem báo cáo' }).closest('.management-filter-actions')).not.toBeNull()
    expect(within(sidebar).queryByRole('button', { name: 'Hôm nay' })).not.toBeInTheDocument()
  })

  it('uses the shared management date range inputs in the report filter', async () => {
    const service = makeService()
    render(<ReportsPage service={service} />)

    await screen.findAllByText('HD0001')

    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc báo cáo' })
    expect(within(sidebar).getByLabelText('Từ ngày').closest('.management-filter-date-range')).not.toBeNull()
    expect(within(sidebar).getByRole('button', { name: 'Mở lịch Từ ngày' })).toBeInTheDocument()
  })
})
