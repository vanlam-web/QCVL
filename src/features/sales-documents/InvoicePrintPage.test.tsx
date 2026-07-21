import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoicePrintPage } from './InvoicePrintPage'
import type { SalesDocumentDetail, SalesDocumentService } from './sales-document-service'

const invoiceDetail: SalesDocumentDetail = {
  id: 'invoice-1',
  code: 'HD010991',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-01T03:30:00Z',
  customer: { id: 'cus-1', code: 'KH001', name: 'Công ty Phong Cảnh', phone: '0909000000' },
  seller: { id: 'seller-1', name: 'Admin' },
  price_list: { id: 'pl-1', code: 'BGCHUNG', name: 'Bảng giá chung' },
  subtotal_amount: 640000,
  discount_amount: 40000,
  total_amount: 600000,
  paid_amount: 500000,
  debt_amount: 100000,
  change_returned_amount: 0,
  payment_status: 'partial',
  note: 'Giao trong ngày',
  items: [
    {
      id: 'item-1',
      line_no: 1,
      product: {
        id: 'product-1',
        code: 'DECAL-PP',
        name: 'Decal PP',
        unit_name: 'm²',
        sell_method: 'area_m2',
      },
      quantity: 0.6,
      width_m: 1.2,
      height_m: 0.5,
      linear_m: null,
      unit_price: 200000,
      line_subtotal_amount: 120000,
      discount_amount: 0,
      line_total: 120000,
      price_source: 'manual',
      note: null,
    },
    {
      id: 'item-2',
      line_no: 2,
      product: {
        id: 'product-2',
        code: 'FORMEX-5',
        name: 'Fomex 5mm',
        unit_name: 'tấm',
        sell_method: 'quantity',
      },
      quantity: 1,
      width_m: null,
      height_m: null,
      linear_m: null,
      unit_price: 240000,
      line_subtotal_amount: 240000,
      discount_amount: 40000,
      line_total: 200000,
      price_source: 'manual',
      note: 'Cắt theo mẫu',
    },
  ],
  payment_receipts: [],
  debt_entries: [],
  stock_movements: [],
  history: [{ at: '2026-07-01T03:30:00Z', action: 'created', actor_name: 'Admin', note: null }],
}

function makeService(detail: SalesDocumentDetail = invoiceDetail): SalesDocumentService {
  return {
    listSalesDocuments: vi.fn(),
    getSalesDocument: vi.fn(async () => detail),
    previewKiotVietInvoiceImport: vi.fn(),
    importKiotVietInvoices: vi.fn(),
    deleteImportedKiotVietInvoices: vi.fn(),
    cancelSalesDocument: vi.fn(),
    updateSalesDocumentNote: vi.fn(),
  }
}

it('renders invoice bill preview from saved snapshot data', async () => {
  render(<InvoicePrintPage documentId="invoice-1" service={makeService()} onClose={vi.fn()} />)

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(screen.getByText('QCVL')).toBeInTheDocument()
  expect(screen.getByText('HD010991')).toBeInTheDocument()
  expect(screen.getByText('Công ty Phong Cảnh')).toBeInTheDocument()
  expect(screen.getByText('Admin')).toBeInTheDocument()
  expect(screen.getByText('Giao trong ngày')).toBeInTheDocument()

  const lines = screen.getByRole('table', { name: 'Dòng hàng hóa đơn' })
  expect(within(lines).getByText('DECAL-PP')).toBeInTheDocument()
  expect(within(lines).getByText('1.2m x 0.5m x 1')).toBeInTheDocument()
  expect(within(lines).getByText('FORMEX-5')).toBeInTheDocument()
  expect(within(lines).getByText('Cắt theo mẫu')).toBeInTheDocument()

  expect(screen.getByText('Khách cần trả')).toBeInTheDocument()
  expect(screen.getByText('Khách đã trả')).toBeInTheDocument()
  expect(screen.getByText('Còn nợ')).toBeInTheDocument()
  expect(screen.getByText('100 000')).toBeInTheDocument()
})

it('calls browser print from the invoice print action', async () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)

  render(<InvoicePrintPage documentId="invoice-1" service={makeService()} onClose={vi.fn()} />)

  await userEvent.click(await screen.findByRole('button', { name: 'In' }))

  expect(print).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})

it('blocks quote documents from the invoice print route', async () => {
  const quoteDetail = { ...invoiceDetail, code: 'BG000123', order_type: 'quote' as const, status: 'active' as const }

  render(<InvoicePrintPage documentId="quote-1" service={makeService(quoteDetail)} onClose={vi.fn()} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ in hóa đơn HD... trong màn này')
  expect(screen.queryByRole('button', { name: 'In' })).not.toBeInTheDocument()
})

it('shows change returned when the invoice has surplus', async () => {
  const withChange = { ...invoiceDetail, paid_amount: 650000, debt_amount: 0, change_returned_amount: 50000, payment_status: 'paid' as const }

  render(<InvoicePrintPage documentId="invoice-1" service={makeService(withChange)} onClose={vi.fn()} />)

  expect(await screen.findByText('Tiền thừa')).toBeInTheDocument()
  expect(screen.getByText('50 000')).toBeInTheDocument()
  expect(screen.queryByText('Còn nợ')).not.toBeInTheDocument()
})
