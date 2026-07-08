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

it('calculates cart total and submits cash checkout', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  expect(screen.getAllByText('240 000').length).toBeGreaterThan(0)
  await userEvent.clear(screen.getByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '240000')
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
      sourceQuote={{ id: 'quote-1', code: 'BG000001' }}
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
      sourceQuote={{ id: 'quote-1', code: 'BG000001' }}
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
      sourceQuote={{ id: 'quote-1', code: 'BG000001' }}
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

  expect(screen.getByText('Tiền hàng')).toBeInTheDocument()
  expect(screen.getByText('Chiết khấu')).toBeInTheDocument()
  expect(screen.getByText('Khách cần trả')).toBeInTheDocument()
  expect(screen.getByText('200 000')).toBeInTheDocument()

  await userEvent.clear(screen.getByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '200000')
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

it('requires a bank account when bank amount is entered', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.clear(screen.getByLabelText('Chuyển khoản trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Chuyển khoản trả hóa đơn'), '240000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Chọn tài khoản nhận chuyển khoản')
  expect(service.checkout).not.toHaveBeenCalled()
})

it('offers recent prices for the selected customer and product', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.click(screen.getByRole('button', { name: 'Giá gần đây Mica 3mm' }))

  expect(service.listRecentCustomerProductPrices).toHaveBeenCalledWith('customer-1', 'p-1')
  expect(await screen.findByText('HD000099')).toBeInTheDocument()
  expect(screen.getByText('110 000')).toBeInTheDocument()
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

  await userEvent.clear(screen.getByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '240000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  const receipt = await screen.findByLabelText('Kết quả checkout')
  expect(within(receipt).getByText('HD000002')).toBeInTheDocument()
  expect(within(receipt).getByText('Tồn kho âm sau bán hàng')).toBeInTheDocument()
})

it('requires retail debt note when no customer is selected and invoice has debt', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={null} orderService={service} />)

  await userEvent.clear(screen.getByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '100000')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Nhập ghi chú nợ khách lẻ')
  expect(service.checkout).not.toHaveBeenCalled()
})

it('asks whether customer surplus is returned or applied to old debt', async () => {
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={makeOrderService()} />)

  await userEvent.clear(screen.getByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '300000')

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
  expect(await screen.findByText('Tổng nợ hiện tại')).toBeInTheDocument()
  const debtList = screen.getByLabelText('Hóa đơn còn nợ')
  expect(within(debtList).getByText('150 000')).toBeInTheDocument()
  expect(screen.getByText('HD000099')).toBeInTheDocument()
})

it('submits old debt collection separately from the current invoice payment', async () => {
  const service = makeOrderService()
  render(<CheckoutPanel cartLines={[line]} selectedCustomer={customer} orderService={service} />)

  await userEvent.clear(await screen.findByLabelText('Tiền mặt trả hóa đơn'))
  await userEvent.type(screen.getByLabelText('Tiền mặt trả hóa đơn'), '240000')
  await userEvent.clear(screen.getByLabelText('Thu nợ cũ'))
  await userEvent.type(screen.getByLabelText('Thu nợ cũ'), '50000')
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

  expect(screen.queryByLabelText('Thu nợ cũ')).not.toBeInTheDocument()
  expect(screen.queryByText('Tổng nợ hiện tại')).not.toBeInTheDocument()
  await waitFor(() => expect(service.listFinanceAccounts).toHaveBeenCalled())
})
