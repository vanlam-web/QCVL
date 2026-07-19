import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckoutPanel } from './CheckoutPanel'
import type { CheckoutCartLine, OrderService } from '../orders/order-service'
import type { Customer } from '../catalog/types'

const customer: Customer = {
  id: 'customer-1',
  code: 'KH000001',
  name: 'Cong ty ABC',
  phone: null,
  tax_code: null,
  address: null,
  customer_group_id: null,
  customer_group: null,
}

const line: CheckoutCartLine = {
  id: 'line-1',
  product: {
    id: 'p-1',
    code: 'MICA-3MM',
    name: 'Mica 3mm',
    status: 'active',
    unit_name: 'm tới',
    sell_method: 'linear_m',
  },
  quantity: 2,
  unitPrice: 120000,
  priceSource: 'default_price_list',
  isManualPrice: false,
}

const dimensionLine: CheckoutCartLine = {
  ...line,
  width_m: 1.2,
  height_m: 0.5,
  linear_m: 2.4,
}

beforeEach(() => {
  window.localStorage.clear()
})

function makeOrderService(overrides: Partial<OrderService> = {}): OrderService {
  return {
    validateCart: vi.fn(),
    checkout: vi.fn(async () => ({
      order: {
        id: 'order-1',
        code: 'HD000001',
        order_type: 'invoice' as const,
        status: 'completed' as const,
        total_amount: 240000,
        paid_amount: 240000,
        debt_amount: 0,
        payment_status: 'paid' as const,
      },
      payment_receipt: { id: 'receipt-1', code: 'PT000001', total_received_amount: 240000 },
      inventory_warnings: [],
    })),
    saveQuote: vi.fn(async () => ({
      id: 'quote-1',
      code: 'BG000001',
      order_type: 'quote' as const,
      status: 'active' as const,
      total_amount: 240000,
    })),
    reviseInvoice: vi.fn(),
    getQuoteReopenPayload: vi.fn(),
    listFinanceAccounts: vi.fn(async () => ({
      items: [
        {
          id: 'bank-1',
          code: 'MB01',
          name: 'MB Bank',
          account_type: 'bank' as const,
          is_default_cash: false,
          is_active: true,
        },
      ],
    })),
    getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-1', total_debt: 100000, invoices: [] })),
    listRecentCustomerProductPrices: vi.fn(async () => ({
      items: [{ unitPrice: 110000, soldAt: '2026-06-30T10:00:00Z', orderCode: 'HD000099' }],
    })),
    ...overrides,
  }
}

it('shows only QCVL cash bank transfer and mixed payment choices', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  expect(screen.getByRole('radio', { name: 'Tiền mặt' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Chuyển khoản' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Kết hợp' })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Thẻ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Ví' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Báo giá' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tạo hóa đơn' })).toBeInTheDocument()
})

it('keeps customer payment inline in cash mode and reveals bank account fields in transfer mode', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '0')
  expect(screen.getByLabelText('Khách thanh toán')).toHaveValue('0')
  expect(screen.getByText('Còn nợ')).toBeInTheDocument()
  expect(screen.getAllByText('240 000').length).toBeGreaterThan(0)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '240000')
  expect(screen.getByLabelText('Khách thanh toán')).toHaveValue('240000')

  await userEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }))
  expect(screen.getByLabelText('Khách thanh toán')).toHaveValue('240 000')
  expect(screen.getByRole('button', { name: 'Tài khoản nhận chuyển khoản Chọn tài khoản' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Chuyển khoản trả hóa đơn')).not.toBeInTheDocument()
})

it('splits mixed payment into cash and bank rows with bank account selector', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Kết hợp' }))

  expect(screen.queryByLabelText('Khách thanh toán')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Thanh toán tiền mặt')).toHaveValue('240 000')
  expect(screen.getByLabelText('Thanh toán ngân hàng')).toHaveValue('0')
  expect(screen.getByRole('button', { name: 'Tài khoản nhận chuyển khoản Chọn tài khoản' })).toBeInTheDocument()
})

it('fills the remaining mixed payment into bank only until bank amount is edited', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Kết hợp' }))
  await userEvent.clear(screen.getByLabelText('Thanh toán tiền mặt'))
  await userEvent.type(screen.getByLabelText('Thanh toán tiền mặt'), '100000')

  expect(screen.getByLabelText('Thanh toán ngân hàng')).toHaveValue('140 000')

  await userEvent.clear(screen.getByLabelText('Thanh toán ngân hàng'))
  await userEvent.type(screen.getByLabelText('Thanh toán ngân hàng'), '50000')
  await userEvent.clear(screen.getByLabelText('Thanh toán tiền mặt'))
  await userEvent.type(screen.getByLabelText('Thanh toán tiền mặt'), '120000')

  expect(screen.getByLabelText('Thanh toán ngân hàng')).toHaveValue('50 000')
})

it('auto-selects the pinned bank account when bank payment is opened', async () => {
  window.localStorage.setItem('finance.bankAccounts.pinnedIds', JSON.stringify(['bank-1']))
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }))

  expect(await screen.findByRole('button', { name: 'Tài khoản nhận chuyển khoản MB01 - MB Bank' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tài khoản nhận chuyển khoản MB01 - MB Bank' }))
  expect(screen.getByRole('button', { name: 'Bỏ ghim tài khoản MB01 - MB Bank' })).toHaveAttribute('aria-pressed', 'true')
})

it('pins a bank account from the account dropdown for future checkout sessions', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Tài khoản nhận chuyển khoản Chọn tài khoản' }))
  const pinButton = screen.getByRole('button', { name: 'Ghim tài khoản MB01 - MB Bank' })

  await userEvent.click(pinButton)

  expect(JSON.parse(window.localStorage.getItem('finance.bankAccounts.pinnedIds') ?? '[]')).toEqual(['bank-1'])
  expect(pinButton).toHaveAttribute('aria-pressed', 'true')
})

it('uses the pinned bank account in mixed payment mode', async () => {
  window.localStorage.setItem('finance.bankAccounts.pinnedIds', JSON.stringify(['bank-1']))
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Kết hợp' }))

  expect(await screen.findByRole('button', { name: 'Tài khoản nhận chuyển khoản MB01 - MB Bank' })).toBeInTheDocument()
})

it('submits mixed cash and bank transfer payment when combination mode is selected', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Kết hợp' }))
  await userEvent.clear(screen.getByLabelText('Thanh toán tiền mặt'))
  await userEvent.type(screen.getByLabelText('Thanh toán tiền mặt'), '100000')
  await userEvent.clear(screen.getByLabelText('Thanh toán ngân hàng'))
  await userEvent.type(screen.getByLabelText('Thanh toán ngân hàng'), '140000')
  await userEvent.click(screen.getByRole('button', { name: 'Tài khoản nhận chuyển khoản Chọn tài khoản' }))
  await userEvent.click(screen.getByRole('option', { name: 'MB01 - MB Bank' }))
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      payment: expect.objectContaining({
        cash_amount: 100000,
        bank_amount: 140000,
        bank_account_id: 'bank-1',
      }),
    }),
  )
})

it('keeps old debt payment collapsed until the user expands it', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  expect(await screen.findByText('Tổng nợ cũ')).toBeInTheDocument()
  expect(screen.queryByLabelText('Thanh toán nợ cũ')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Trả thêm nợ cũ' }))
  expect(screen.getByLabelText('Thanh toán nợ cũ')).toBeInTheDocument()
})

it('does not show a redundant payment drawer heading', () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  expect(screen.getByRole('region', { name: 'Thanh toán' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Thanh toán' })).not.toBeInTheDocument()
})

it('shows compact payment header metadata and line summary', () => {
  render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={makeOrderService()}
      sellerName="Văn Viết Phương Lâm"
      orderCreatedAt="2026-07-08T07:29:00.000Z"
    />,
  )

  expect(screen.getByRole('group', { name: 'Thông tin hóa đơn' })).toHaveTextContent('Văn Viết Phương Lâm')
  expect(within(screen.getByRole('group', { name: 'Thông tin hóa đơn' })).getByLabelText('Ngày hóa đơn')).toHaveValue('08/07/2026')
  expect(within(screen.getByRole('group', { name: 'Thông tin hóa đơn' })).getByLabelText('Thời gian hóa đơn')).toHaveValue('07:29')
  expect(screen.getByLabelText('Tóm tắt thanh toán')).toHaveClass('checkout-summary-compact')
  expect(screen.queryByText('Khách cần trả')).toBeInTheDocument()
  expect(screen.getByText('Cong ty ABC')).toBeInTheDocument()
  expect(document.querySelector('.checkout-summary-kv')).not.toBeInTheDocument()
})

it('marks the seller as a display name and lets the invoice date and time be edited', async () => {
  const service = makeOrderService()
  render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
      sellerName="Văn Viết Phương Lâm"
      orderCreatedAt="2026-07-08T07:29:00.000Z"
    />,
  )

  const meta = screen.getByRole('group', { name: 'Thông tin hóa đơn' })
  expect(within(meta).getByLabelText('Tên hiển thị')).toHaveTextContent('Văn Viết Phương Lâm')

  const timeInput = within(meta).getByLabelText('Thời gian hóa đơn')
  expect(timeInput).toHaveValue('07:29')
  const dateInput = within(meta).getByLabelText('Ngày hóa đơn')
  expect(dateInput).toHaveValue('08/07/2026')

  await userEvent.clear(dateInput)
  await userEvent.type(dateInput, '09/07/2026')
  await userEvent.clear(timeInput)
  await userEvent.type(timeInput, '08:15')

  expect(dateInput).toHaveValue('09/07/2026')
  expect(timeInput).toHaveValue('08:15')

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      created_at: '2026-07-09T08:15:00.000Z',
    }),
  )
})

it('shows invoice date and time as focused text editors while keeping submit payload ISO-like', async () => {
  const service = makeOrderService()
  render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
      sellerName="Văn Viết Phương Lâm"
      orderCreatedAt="2026-07-08T07:29:00.000Z"
    />,
  )

  const meta = screen.getByRole('group', { name: 'Thông tin hóa đơn' })
  const dateInput = within(meta).getByLabelText('Ngày hóa đơn')
  const timeInput = within(meta).getByLabelText('Thời gian hóa đơn')

  expect(dateInput).toHaveAttribute('type', 'text')
  expect(dateInput).toHaveAttribute('inputmode', 'numeric')
  expect(dateInput).toHaveValue('08/07/2026')
  expect(timeInput).toHaveAttribute('type', 'text')
  expect(timeInput).toHaveAttribute('inputmode', 'numeric')
  expect(timeInput).toHaveValue('07:29')

  await userEvent.click(dateInput)
  expect(dateInput).toHaveFocus()

  await userEvent.clear(dateInput)
  await userEvent.type(dateInput, '09/07/2026')
  await userEvent.clear(timeInput)
  await userEvent.type(timeInput, '08:15')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      created_at: '2026-07-09T08:15:00.000Z',
    }),
  )
})

it('uses compact date and time pickers for invoice metadata', async () => {
  const service = makeOrderService()
  render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
      sellerName="Văn Viết Phương Lâm"
      orderCreatedAt="2026-07-08T07:29:00.000Z"
    />,
  )

  const meta = screen.getByRole('group', { name: 'Thông tin hóa đơn' })
  await userEvent.click(within(meta).getByRole('button', { name: 'Chọn ngày hóa đơn' }))
  expect(await screen.findByRole('region', { name: 'Lịch chọn ngày hóa đơn' })).toBeInTheDocument()
  await userEvent.click(screen.getByLabelText('Tóm tắt thanh toán'))
  expect(screen.queryByRole('region', { name: 'Lịch chọn ngày hóa đơn' })).not.toBeInTheDocument()

  await userEvent.click(within(meta).getByRole('button', { name: 'Chọn ngày hóa đơn' }))
  const calendar = await screen.findByRole('region', { name: 'Lịch chọn ngày hóa đơn' })
  await userEvent.click(within(calendar).getByRole('button', { name: '10' }))

  await userEvent.click(within(meta).getByRole('button', { name: 'Chọn giờ hóa đơn' }))
  expect(await screen.findByRole('region', { name: 'Chọn giờ hóa đơn' })).toBeInTheDocument()
  await userEvent.click(screen.getByLabelText('Tóm tắt thanh toán'))
  expect(screen.queryByRole('region', { name: 'Chọn giờ hóa đơn' })).not.toBeInTheDocument()

  await userEvent.click(within(meta).getByRole('button', { name: 'Chọn giờ hóa đơn' }))
  const timePicker = await screen.findByRole('region', { name: 'Chọn giờ hóa đơn' })
  await userEvent.click(within(timePicker).getByRole('button', { name: '08:30' }))

  expect(within(meta).getByLabelText('Ngày hóa đơn')).toHaveValue('10/07/2026')
  expect(within(meta).getByLabelText('Thời gian hóa đơn')).toHaveValue('08:30')

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      created_at: '2026-07-10T08:30:00.000Z',
    }),
  )
})

it('keeps payment drawer compact without quick amount chips and with footer actions in one row', () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  expect(screen.queryByText('Thu khác')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Gợi ý tiền mặt')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Tiền mặt trả hóa đơn')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '50 000' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Thao tác cuối đơn')).toHaveClass('checkout-action-row')
  expect(screen.getByLabelText('Tóm tắt thanh toán')).toHaveClass('checkout-summary-compact')
})

it('shows the cart line count next to the goods total label', () => {
  render(<CheckoutPanel cartLines={[line, { ...line, id: 'line-2' }]} selectedCustomer={customer} orderService={makeOrderService()} />)

  expect(screen.getByText('Tiền hàng (2)')).toBeInTheDocument()
})

it('calculates cart total and submits cash checkout', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  expect(screen.getAllByText('240 000').length).toBeGreaterThan(0)
  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '240000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      customer_id: 'customer-1',
      payment: expect.objectContaining({ cash_amount: 240000, bank_amount: 0 }),
    }),
  )
  const receipt = await screen.findByLabelText('Kết quả checkout')
  expect(within(receipt).getByText('HD000001')).toBeInTheDocument()
  expect(within(receipt).getByText('PT000001')).toBeInTheDocument()
  expect(within(receipt).getByText('Đã trả 240 000')).toBeInTheDocument()
  expect(within(receipt).getByText('Còn nợ 0')).toBeInTheDocument()
})

it('selects the full money value on focus so zero replaces the current amount', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  const paymentInput = screen.getByLabelText('Khách thanh toán') as HTMLInputElement
  await userEvent.click(paymentInput)

  await waitFor(() => {
    expect(paymentInput.selectionStart).toBe(0)
    expect(paymentInput.selectionEnd).toBe(paymentInput.value.length)
  })

  await userEvent.keyboard('0')

  expect(paymentInput).toHaveValue('0')
})

it('focuses and selects customer payment when checkout panel opens', async () => {
  render(
    <CheckoutPanel
      autoFocusCustomerPayment
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={makeOrderService()}
    />,
  )

  const paymentInput = screen.getByLabelText('Khách thanh toán') as HTMLInputElement

  await waitFor(() => {
    expect(paymentInput).toHaveFocus()
    expect(paymentInput.selectionStart).toBe(0)
    expect(paymentInput.selectionEnd).toBe(paymentInput.value.length)
  })
})

it('saves the current cart as a quote and shows BG code', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.click(screen.getByRole('button', { name: 'Báo giá' }))

  expect(service.saveQuote).toHaveBeenCalledWith(
    expect.objectContaining({
      customer_id: 'customer-1',
      items: [expect.objectContaining({ product_id: 'p-1', unit_price: 120000 })],
    }),
  )
  expect(await screen.findByLabelText('Kết quả báo giá')).toHaveTextContent('BG000001')
})

it('keeps line dimensions when saving quotes and checking out', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[dimensionLine]} selectedCustomer={customer} orderService={service} />)

  await userEvent.click(screen.getByRole('button', { name: 'Báo giá' }))

  expect(service.saveQuote).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'p-1',
          width_m: 1.2,
          height_m: 0.5,
          linear_m: 2.4,
        }),
      ],
    }),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'p-1',
          width_m: 1.2,
          height_m: 0.5,
          linear_m: 2.4,
        }),
      ],
    }),
  )
})

it('saving a reopened quote draft creates a new independent quote', async () => {
  const service = makeOrderService()
  render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Báo giá' }))

  expect(service.saveQuote).toHaveBeenCalledWith(
    expect.objectContaining({ items: [expect.objectContaining({ product_id: 'p-1' })] }),
  )
  expect(await screen.findByLabelText('Kết quả báo giá')).toHaveTextContent('BG000001')
})

it('checks out reopened quote drafts normally and blocks unresolved quote lines locally', async () => {
  const service = makeOrderService()
  const { rerender } = render(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.not.objectContaining({ source_quote_id: 'quote-1' }),
  )

  rerender(
    <CheckoutPanel
      cartLines={[line]}
      selectedCustomer={customer}
      orderService={service}
      quoteBlockedReason="Sản phẩm trong báo giá không còn khả dụng."
    />,
  )

  expect(screen.getByRole('button', { name: 'Tạo hóa đơn' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Báo giá' })).toBeDisabled()
  expect(screen.getByText('Sản phẩm trong báo giá không còn khả dụng.')).toBeInTheDocument()
})

it('subtracts line discounts from payable total and checkout payload', async () => {
  const service = makeOrderService()
  render(
    <CheckoutPanel
      cartLines={[{ ...line, discountAmount: 40000 } as CheckoutCartLine]}
      selectedCustomer={customer}
      orderService={service}
    />,
  )

  expect(screen.getByLabelText('Tóm tắt thanh toán')).toHaveClass('checkout-summary-compact')
  expect(screen.getAllByText('200 000').length).toBeGreaterThan(0)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '200000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'p-1',
          discount_amount: 40000,
        }),
      ],
      payment: expect.objectContaining({ cash_amount: 200000 }),
    }),
  )
})

it('lets checkout discount be edited inline and sends it as item discount', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.clear(screen.getByLabelText('Giảm giá'))
  await userEvent.type(screen.getByLabelText('Giảm giá'), '40000')
  expect(screen.getByLabelText('Giảm giá')).toHaveValue('40000')
  expect(screen.getAllByText('200 000').length).toBeGreaterThan(0)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '200000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [expect.objectContaining({ product_id: 'p-1', discount_amount: 40000 })],
      payment: expect.objectContaining({ cash_amount: 200000 }),
    }),
  )
})

it('requires a bank account when bank amount is entered', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }))
  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '240000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Chọn tài khoản nhận chuyển khoản')
  expect(service.checkout).not.toHaveBeenCalled()
})

it('does not duplicate recent prices inside the checkout drawer', () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  expect(screen.queryByRole('button', { name: 'Giá gần đây Mica 3mm' })).not.toBeInTheDocument()
  expect(service.listRecentCustomerProductPrices).not.toHaveBeenCalled()
})

it('shows checkout inventory warnings without blocking success', async () => {
  const service = makeOrderService({
    checkout: vi.fn(async () => ({
      order: {
        id: 'order-1',
        code: 'HD000002',
        order_type: 'invoice' as const,
        status: 'completed' as const,
        total_amount: 240000,
        paid_amount: 240000,
        debt_amount: 0,
        payment_status: 'paid' as const,
      },
      payment_receipt: { id: 'receipt-1', code: 'PT000001', total_received_amount: 240000 },
      inventory_warnings: [{ product_id: 'p-1', code: 'MICA-3MM', message: 'Tồn kho âm sau bán hàng' }],
    })),
  })
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '240000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  const receipt = await screen.findByLabelText('Kết quả checkout')
  expect(within(receipt).getByText('HD000002')).toBeInTheDocument()
  expect(within(receipt).getByText('Tồn kho âm sau bán hàng')).toBeInTheDocument()
})

it('requires retail debt note when no customer is selected and invoice has debt', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={null} orderService={service} />)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '100000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Nhập ghi chú nợ khách lẻ')
  expect(service.checkout).not.toHaveBeenCalled()
})

it('asks whether customer surplus is returned or applied to old debt', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.clear(screen.getByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '300000')

  expect(await screen.findByText('Khách trả dư 60 000')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Trả lại khách' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Cấn vào nợ cũ' })).toBeInTheDocument()
})

it('loads and displays customer debt for selected customers', async () => {
  const service = makeOrderService({
    getCustomerDebt: vi.fn(async () => ({
      customer_id: 'customer-1',
      total_debt: 150000,
      invoices: [
        {
          order_id: 'order-old-1',
          order_code: 'HD000099',
          created_at: '2026-06-30T03:00:00Z',
          total_amount: 200000,
          paid_amount: 50000,
          debt_amount: 150000,
          remaining_debt: 150000,
        },
      ],
    })),
  })

  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  expect(service.getCustomerDebt).toHaveBeenCalledWith('customer-1')
  expect(await screen.findByText('Tổng nợ cũ')).toBeInTheDocument()
  const customerLine = screen.getByText('Cong ty ABC').closest('.checkout-customer-line')
  expect(customerLine).not.toHaveTextContent('Nợ:')
  expect(customerLine).not.toHaveTextContent('Tổng nợ')
  expect(within(customerLine as HTMLElement).getByText('150 000')).toHaveClass('checkout-customer-debt')
  expect(screen.queryByLabelText('Hóa đơn còn nợ')).not.toBeInTheDocument()
  expect(screen.queryByText('HD000099')).not.toBeInTheDocument()
})

it('submits old debt collection separately from the current invoice payment', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.clear(await screen.findByLabelText('Khách thanh toán'))
  await userEvent.type(screen.getByLabelText('Khách thanh toán'), '240000')
  await userEvent.click(await screen.findByRole('button', { name: 'Trả thêm nợ cũ' }))
  await userEvent.clear(screen.getByLabelText('Thanh toán nợ cũ'))
  await userEvent.type(screen.getByLabelText('Thanh toán nợ cũ'), '50000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(service.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      payment: expect.objectContaining({
        cash_amount: 290000,
        old_debt_payment_amount: 50000,
        change_returned_amount: 0,
      }),
    }),
  )
})

it('hides old debt collection when no customer is selected', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={null} orderService={service} />)

  expect(screen.queryByLabelText('Thanh toán nợ cũ')).not.toBeInTheDocument()
  expect(screen.queryByText('Tổng nợ cũ')).not.toBeInTheDocument()
  await waitFor(() => expect(service.listFinanceAccounts).toHaveBeenCalled())
})
