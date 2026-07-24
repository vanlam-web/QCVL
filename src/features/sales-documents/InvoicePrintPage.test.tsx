import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoicePrintPage } from './InvoicePrintPage'
import type { SalesDocumentDetail, SalesDocumentService } from './sales-document-service'

beforeEach(() => {
  window.localStorage.clear()
})

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
  expect(screen.getByText(/Số hóa đơn:\s*HD010991/)).toBeInTheDocument()
  expect(screen.getByText('Công ty Phong Cảnh')).toBeInTheDocument()
  expect(screen.queryByText(/NV:\s*Admin/)).not.toBeInTheDocument()
  expect(screen.getByText('Người bán')).toBeInTheDocument()
  expect(screen.getByText('Admin')).toBeInTheDocument()
  expect(screen.getByText(/Ghi chú:\s*Giao trong ngày/)).toBeInTheDocument()
  expect(screen.getByText(/ngày 01 tháng 07 năm 2026/i)).toBeInTheDocument()

  const lines = screen.getByRole('table', { name: 'Dòng hàng hóa đơn' })
  expect(within(lines).queryByText('DECAL-PP')).not.toBeInTheDocument()
  expect(within(lines).getByText('Decal PP')).toBeInTheDocument()
  expect(within(lines).getByText('1.2m x 0.5m x 1')).toBeInTheDocument()
  expect(within(lines).queryByText('FORMEX-5')).not.toBeInTheDocument()
  expect(within(lines).getByText(/Cắt theo mẫu/)).toBeInTheDocument()
  expect(within(lines).queryByRole('columnheader', { name: 'Mã hàng' })).not.toBeInTheDocument()
  expect(within(lines).queryByRole('columnheader', { name: 'CK' })).not.toBeInTheDocument()

  expect(screen.getByText('Tổng toa')).toBeInTheDocument()
  expect(screen.getByText('Khách hàng thanh toán')).toBeInTheDocument()
  expect(screen.getByText('Còn lại')).toBeInTheDocument()
  expect(screen.getByText(/Một trăm nghìn đồng chẵn/)).toBeInTheDocument()
  expect(screen.getByText(/Tổng thanh toán bằng chữ:/)).toBeInTheDocument()
})

it('prints invoice remaining debt when customer debt snapshot is stale', async () => {
  const staleCustomerDebt = {
    ...invoiceDetail,
    paid_amount: 0,
    debt_amount: 600000,
    payment_status: 'unpaid' as const,
    customer: { ...invoiceDetail.customer, total_debt_amount: 0 },
  }

  render(<InvoicePrintPage documentId="invoice-1" service={makeService(staleCustomerDebt)} onClose={vi.fn()} />)

  const totals = await screen.findByRole('region', { name: 'Tổng hóa đơn' })
  expect(within(totals).getByText('Tổng nợ')).toBeInTheDocument()
  expect(within(totals).getByText('Nợ cũ')).toBeInTheDocument()
  expect(within(totals).getAllByText('600 000')).toHaveLength(2)
  expect(within(totals).getAllByText('0').length).toBeGreaterThan(0)
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
  expect(screen.getByText('Còn lại')).toBeInTheDocument()
})

it('uses saved shop header and switches between A4 and K80 templates', async () => {
  window.localStorage.setItem(
    'qcvl.organizationBillSettings',
    JSON.stringify({
      shop_name: 'In ảnh Văn Lâm',
      shop_address: '12 Nguyễn Trãi',
      shop_phone: '0909111222',
      default_bill_template: 'a4',
    }),
  )

  const { container } = render(
    <InvoicePrintPage documentId="invoice-1" service={makeService()} onClose={vi.fn()} />,
  )

  expect(await screen.findByText('In ảnh Văn Lâm')).toBeInTheDocument()
  expect(screen.getByText(/Địa chỉ:\s*12 Nguyễn Trãi/)).toBeInTheDocument()
  expect(screen.getByText(/Điện thoại:\s*0909111222/)).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-a4')

  await userEvent.click(screen.getByRole('button', { name: /Xem mẫu Hóa đơn K80/ }))
  expect(container.querySelector('main')).toHaveClass('bill-template-k80')
})

it('honors initialTemplate when opening the bill', async () => {
  const { container } = render(
    <InvoicePrintPage documentId="invoice-1" service={makeService()} onClose={vi.fn()} initialTemplate="k80" />,
  )

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-k80')
  expect(screen.getByRole('button', { name: /Xem mẫu Hóa đơn K80/ })).toHaveAttribute('aria-current', 'true')
})

it('uses customer preferred bill template when query template is absent', async () => {
  const preferred = {
    ...invoiceDetail,
    customer: { ...invoiceDetail.customer, preferred_bill_template: 'k80' as const },
  }
  const { container } = render(
    <InvoicePrintPage documentId="invoice-1" service={makeService(preferred)} onClose={vi.fn()} />,
  )

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-k80')
})

it('lets query template override customer preference', async () => {
  const preferred = {
    ...invoiceDetail,
    customer: { ...invoiceDetail.customer, preferred_bill_template: 'k80' as const },
  }
  const { container } = render(
    <InvoicePrintPage
      documentId="invoice-1"
      service={makeService(preferred)}
      onClose={vi.fn()}
      initialTemplate="a4"
    />,
  )

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-a4')
})

it('saves customer preference when staff changes template', async () => {
  const saveCustomerBillPreference = vi.fn(async () => undefined)

  render(
    <InvoicePrintPage
      documentId="invoice-1"
      service={makeService()}
      onClose={vi.fn()}
      saveCustomerBillPreference={saveCustomerBillPreference}
    />,
  )

  await userEvent.click(await screen.findByRole('button', { name: /Xem mẫu Hóa đơn K80/ }))

  expect(saveCustomerBillPreference).toHaveBeenCalledWith('cus-1', {
    preferred_bill_template: 'tpl-invoice-k80',
    preferred_bill_templates: expect.arrayContaining(['tpl-invoice-a4', 'tpl-invoice-k80']),
  })
  expect(await screen.findByRole('status')).toHaveTextContent(/Đã nhớ/)
})

it('restores multiple remembered bill templates for the customer', async () => {
  const preferred = {
    ...invoiceDetail,
    customer: {
      ...invoiceDetail.customer,
      preferred_bill_template: 'tpl-invoice-k80',
      preferred_bill_templates: ['tpl-invoice-a4', 'tpl-invoice-k80'],
    },
  }
  const { container } = render(
    <InvoicePrintPage documentId="invoice-1" service={makeService(preferred)} onClose={vi.fn()} />,
  )

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-k80')
  expect(screen.getByRole('checkbox', { name: /Nhớ mẫu Hóa đơn A4/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Nhớ mẫu Hóa đơn K80/ })).toBeChecked()
})

it('does not save preference for walk-in customers', async () => {
  const walkIn = {
    ...invoiceDetail,
    customer: {
      id: 'walk-1',
      code: 'khachle',
      name: 'Khách lẻ',
      phone: null,
      preferred_bill_template: 'k80' as const,
    },
  }
  const saveCustomerBillPreference = vi.fn(async () => undefined)
  const { container } = render(
    <InvoicePrintPage
      documentId="invoice-1"
      service={makeService(walkIn)}
      onClose={vi.fn()}
      saveCustomerBillPreference={saveCustomerBillPreference}
    />,
  )

  expect(await screen.findByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG' })).toBeInTheDocument()
  expect(container.querySelector('main')).toHaveClass('bill-template-a4')

  await userEvent.click(screen.getByRole('button', { name: /Xem mẫu Hóa đơn K80/ }))
  expect(saveCustomerBillPreference).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
