import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuotePrintPage } from './QuotePrintPage'
import type { SalesDocumentDetail, SalesDocumentService } from './sales-document-service'

const quoteDetail: SalesDocumentDetail = {
  id: 'quote-1',
  code: 'BG000123',
  order_type: 'quote',
  status: 'active',
  created_at: '2026-07-01T03:30:00Z',
  customer: { id: 'cus-1', code: 'KH001', name: 'Công ty Phong Cảnh', phone: '0909000000' },
  seller: { id: 'seller-1', name: 'Admin' },
  price_list: { id: 'pl-1', code: 'BGCHUNG', name: 'Bảng giá chung' },
  subtotal_amount: 640000,
  discount_amount: 40000,
  total_amount: 600000,
  paid_amount: 0,
  debt_amount: 0,
  change_returned_amount: 0,
  payment_status: 'not_applicable',
  note: 'Giao sau khi khách xác nhận',
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
      quantity: 2,
      width_m: 1.2,
      height_m: 0.5,
      linear_m: null,
      unit_price: 200000,
      line_subtotal_amount: 400000,
      discount_amount: 0,
      line_total: 400000,
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

function makeService(detail: SalesDocumentDetail = quoteDetail): SalesDocumentService {
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

it('renders a simple quote print preview from saved snapshot data', async () => {
  const service = makeService()

  render(<QuotePrintPage documentId="quote-1" service={service} onClose={vi.fn()} />)

  expect(await screen.findByRole('heading', { name: 'BÁO GIÁ' })).toBeInTheDocument()
  expect(screen.getByText('QCVL')).toBeInTheDocument()
  expect(screen.getByText('BG000123')).toBeInTheDocument()
  expect(screen.getByText('Công ty Phong Cảnh')).toBeInTheDocument()
  expect(screen.getByText('Admin')).toBeInTheDocument()
  expect(screen.getByText('Giao sau khi khách xác nhận')).toBeInTheDocument()

  const lines = screen.getByRole('table', { name: 'Dòng hàng báo giá' })
  expect(within(lines).getByText('DECAL-PP')).toBeInTheDocument()
  expect(within(lines).getByText('1.2 x 0.5 m')).toBeInTheDocument()
  expect(within(lines).getByText('FORMEX-5')).toBeInTheDocument()
  expect(within(lines).getByText('Cắt theo mẫu')).toBeInTheDocument()
  expect(screen.getByText('Tổng báo giá')).toBeInTheDocument()
  expect(screen.getByText('600 000')).toBeInTheDocument()
})

it('calls browser print from the quote print action', async () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)

  render(<QuotePrintPage documentId="quote-1" service={makeService()} onClose={vi.fn()} />)

  await userEvent.click(await screen.findByRole('button', { name: 'In' }))

  expect(print).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})

it('blocks invoice documents from the quote print route', async () => {
  const invoiceDetail = { ...quoteDetail, code: 'HD010991', order_type: 'invoice' as const, status: 'completed' as const }

  render(<QuotePrintPage documentId="invoice-1" service={makeService(invoiceDetail)} onClose={vi.fn()} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ in báo giá BG... trong màn này')
  expect(screen.queryByRole('button', { name: 'In' })).not.toBeInTheDocument()
})
