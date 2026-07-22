import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CatalogService } from '../catalog/catalog-service'
import type { Customer } from '../catalog/types'
import type { FinanceService } from '../finance/finance-service'
import type { OrderService } from '../orders/order-service'
import type { SalesDocumentService } from '../sales-documents/sales-document-service'
import { CustomerPanel } from './CustomerPanel'

const customer: Customer = {
  id: 'customer-1',
  code: 'KH000001',
  name: 'Khach le',
  phone: null,
  tax_code: null,
  address: null,
  customer_group_id: null,
  customer_group: null,
}

function serviceStub(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    listProducts: vi.fn(),
    recordSearchSelection: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    resolvePrices: vi.fn(),
    listCustomers: vi.fn(async () => ({ items: [customer], page: 1, page_size: 20, total: 1 })),
    listCustomerGroups: vi.fn(async () => ({
      items: [
        { id: 'group-35', code: '35', name: '35', price_list_id: '', is_active: true },
        { id: 'group-vip', code: 'VIP', name: 'VIP', price_list_id: '', is_active: true },
      ],
    })),
    createCustomer: vi.fn(async () => customer),
    updateCustomer: vi.fn(async (_id, input) => ({
      ...customer,
      id: _id,
      code: input.code ?? customer.code,
      name: input.name,
      phone: input.phone ?? null,
      tax_code: input.tax_code ?? null,
      address: input.address ?? null,
      note: input.note ?? null,
      customer_group_id: input.customer_group_id ?? null,
      customer_group: input.customer_group_id === 'group-vip'
        ? { id: 'group-vip', code: 'VIP', name: 'VIP' }
        : input.customer_group_id === 'group-35'
          ? { id: 'group-35', code: '35', name: '35' }
          : null,
      customer_type: input.customer_type,
      company_name: input.company_name ?? null,
    })),
    ...overrides,
  } as CatalogService
}

function orderServiceStub(overrides: Partial<Pick<OrderService, 'getCustomerDebt'>> = {}) {
  return {
    getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-1', total_debt: 0, invoices: [] })),
    ...overrides,
  } satisfies Pick<OrderService, 'getCustomerDebt'>
}

function salesDocumentServiceStub(overrides: Partial<Pick<SalesDocumentService, 'listSalesDocuments'>> = {}) {
  return {
    listSalesDocuments: vi.fn(async () => ({ items: [], page: 1, page_size: 10, total: 0 })),
    ...overrides,
  } satisfies Pick<SalesDocumentService, 'listSalesDocuments'>
}

function financeServiceStub(overrides: Partial<Pick<FinanceService, 'listCashbookEntries'>> = {}) {
  return {
    listCashbookEntries: vi.fn(async () => ({
      items: [],
      page: 1,
      page_size: 1000,
      total: 0,
      summary: { opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 },
    })),
    ...overrides,
  } satisfies Pick<FinanceService, 'listCashbookEntries'>
}

describe('CustomerPanel', () => {
  it('searches and selects a customer', async () => {
    const service = serviceStub()
    const onSelectCustomer = vi.fn()

    render(<CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={onSelectCustomer} />)

    await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))

    expect(service.listCustomers).toHaveBeenCalledWith({ search: 'khach', status: 'active', search_context: 'quick_pick' })
    expect(service.recordSearchSelection).toHaveBeenCalledWith({ entity_type: 'customer', entity_id: customer.id })
    expect(onSelectCustomer).toHaveBeenCalledWith(customer)
  })

  it('shows customer suggestions while typing', async () => {
    const service = serviceStub()

    render(<CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText('Tìm khách hàng (F4)'), 'khach')

    const option = await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' })
    expect(within(option).getByText('Khach le')).toBeInTheDocument()
    expect(within(option).getByText('Mã: KH000001')).toBeInTheDocument()
    expect(service.listCustomers).toHaveBeenCalledWith({ search: 'khach', status: 'active', page: 1, page_size: 8, search_context: 'quick_pick' })
  })

  it('closes customer suggestions when clicking outside the customer search', async () => {
    const service = serviceStub()

    render(
      <>
        <CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={vi.fn()} />
        <button type="button">Bên ngoài</button>
      </>,
    )

    await userEvent.type(screen.getByPlaceholderText('Tìm khách hàng (F4)'), 'khach')
    expect(await screen.findByRole('listbox', { name: 'Gợi ý khách hàng' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bên ngoài' }))

    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Gợi ý khách hàng' })).not.toBeInTheDocument())
    expect(screen.getByPlaceholderText('Tìm khách hàng (F4)')).toHaveValue('khach')
  })

  it('hides suggestions when the selected customer name is shown', () => {
    render(<CustomerPanel service={serviceStub()} selectedCustomer={customer} onSelectCustomer={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Khách đã chọn' })).toBeInTheDocument()
    expect(screen.getByText('Khach le')).toBeInTheDocument()
    expect(screen.queryByText('Còn nợ: 0')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Tìm khách hàng (F4)')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('hides seed retail group label and keeps no-group customer on general price', () => {
    const retailCustomer = {
      ...customer,
      customer_group_id: 'cg-retail',
      customer_group: { id: 'cg-retail', code: 'LE', name: 'Khach le' },
    }

    render(<CustomerPanel service={serviceStub()} selectedCustomer={retailCustomer} onSelectCustomer={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Khách đã chọn' })).toHaveTextContent('Khach le')
    expect(screen.queryByLabelText('Bảng giá Khach le')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bảng giá cg-retail')).not.toBeInTheDocument()
  })

  it('shows debt badge and can clear selected customer', async () => {
    const onSelectCustomer = vi.fn()
    const debtCustomer = {
      ...customer,
      customer_group_id: 'group-35',
      customer_group: { id: 'group-35', code: '35', name: '35' },
      total_debt_amount: 17647014,
    }

    render(<CustomerPanel service={serviceStub()} selectedCustomer={debtCustomer} onSelectCustomer={onSelectCustomer} />)

    expect(screen.getByLabelText('Bảng giá 35')).toHaveTextContent('35')
    expect(screen.getByText('Còn nợ:', { exact: false })).toHaveTextContent('17 647 014')
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ khách Khach le' }))

    expect(onSelectCustomer).toHaveBeenCalledWith(null)
  })

  it('opens customer detail popup from selected chip and keeps only QCVL fields', async () => {
    const detailedCustomer = {
      ...customer,
      customer_group_id: 'group-35',
      customer_group: { id: 'group-35', code: '35', name: '35' },
      customer_type: 'company' as const,
      company_name: 'Công ty Hoàng Lợi',
      phone: '0909000000',
      address: '123 Đường Lớn',
      note: 'Khách QCVL',
      tax_code: '0123456789',
      total_debt_amount: 50130458,
      total_sales_amount: 147692016,
      linked_supplier: { id: 'supplier-1', code: 'NCC001', name: 'Nhà cung cấp 1' },
    }
    const orderService = orderServiceStub({
      getCustomerDebt: vi.fn(async () => ({
        customer_id: detailedCustomer.id,
        total_debt: 50130458,
        invoices: [
          {
            order_id: 'order-1',
            order_code: 'HD011146',
            created_at: '2026-07-13T09:30:00.000Z',
            total_amount: 4866121,
            paid_amount: 0,
            debt_amount: 4866121,
            remaining_debt: 4866121,
          },
        ],
        adjustments: [
          {
            id: 'adjustment-1',
            source_code: 'CB000001',
            created_at: '2026-07-14T08:30:00.000Z',
            transaction_type: 'Điều chỉnh',
            amount_delta: 21159562,
            paid_amount: 0,
            remaining_amount: 21159562,
            balance_after: 50130458,
            source_file: 'BaoCaoCongNoTheoKhachHang_KV.xlsx',
          },
        ],
        cashbook_entries: [
          {
            id: 'cashbook-1',
            code: 'TT001838',
            status: 'posted' as const,
            direction: 'in' as const,
            amount_delta: 29104775,
            finance_account: { id: 'cash', code: 'TM', name: 'Tiền mặt', account_type: 'cash' as const },
            is_business_accounted: true,
            source_type: 'kiotviet_cashbook' as const,
            created_at: '2026-07-15T10:00:00.000Z',
            note: null,
            counterparty: { type: 'customer' as const, name: detailedCustomer.name, phone: detailedCustomer.phone },
            created_by: null,
            source: {
              type: 'payment_receipt',
              id: 'payment-1',
              code: 'TT001838',
              order_code: null,
              counterparty_code: detailedCustomer.code,
            },
          },
        ],
      })),
    })
    const salesDocumentService = salesDocumentServiceStub({
      listSalesDocuments: vi.fn(async () => ({
        items: [
          {
            id: 'order-1',
            code: 'HD011146',
            order_type: 'invoice' as const,
            status: 'completed' as const,
            created_at: '2026-07-13T09:30:00.000Z',
            customer: { id: detailedCustomer.id, code: detailedCustomer.code, name: detailedCustomer.name, phone: detailedCustomer.phone },
            seller: { id: 'seller-1', name: 'Văn Lâm' },
            subtotal_amount: 4866121,
            discount_amount: 0,
            total_amount: 4866121,
            paid_amount: 0,
            debt_amount: 4866121,
            payment_status: 'unpaid' as const,
            note: 'Khách QCVL',
          },
        ],
        page: 1,
        page_size: 10,
        total: 1,
      })),
    })
    const financeService = financeServiceStub()
    const updatedCustomer = {
      ...detailedCustomer,
      name: 'Út Tèo mới',
      address: 'Địa chỉ mới',
      customer_group_id: 'group-35',
      customer_group: { id: 'group-35', code: '35', name: '35' },
      customer_type: 'company' as const,
    }
    const service = serviceStub({ updateCustomer: vi.fn(async () => updatedCustomer) })
    const onSelectCustomer = vi.fn()

    render(
      <CustomerPanel
        service={service}
        orderService={orderService}
        financeService={financeService}
        salesDocumentService={salesDocumentService}
        selectedCustomer={detailedCustomer}
        onSelectCustomer={onSelectCustomer}
      />,
    )

    await waitFor(() => expect(screen.getByText('Còn nợ:', { exact: false })).toHaveTextContent('50 130 458'))

    await userEvent.click(screen.getByRole('button', { name: 'Mở chi tiết khách Khach le' }))

    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết khách KH000001' })
    expect(within(dialog).getByText('Mã KH')).toBeInTheDocument()
    expect(within(dialog).getByText('Tên KH')).toBeInTheDocument()
    expect(within(dialog).getByText('SĐT')).toBeInTheDocument()
    expect(within(dialog).getByText('MST')).toBeInTheDocument()
    expect(within(dialog).getByText('Địa chỉ')).toBeInTheDocument()
    expect(within(dialog).getByText('Nhóm')).toBeInTheDocument()
    expect(within(dialog).getByText('Loại khách')).toBeInTheDocument()
    expect(within(dialog).getByText('Công ty')).toBeInTheDocument()
    expect(within(dialog).getByText('Ghi chú')).toBeInTheDocument()
    expect(within(dialog).getByText('NCC liên kết:', { exact: false })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Thông tin' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Công nợ' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Lịch sử' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Facebook')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Ngày sinh')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Giới tính')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('avatar', { exact: false })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Đóng chi tiết khách' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Địa chỉ')).toHaveValue('123 Đường Lớn')
    await userEvent.clear(within(dialog).getByLabelText('Tên KH'))
    await userEvent.type(within(dialog).getByLabelText('Tên KH'), 'Út Tèo mới')
    await userEvent.click(within(dialog).getByRole('button', { name: '35' }))
    await userEvent.click(within(dialog).getAllByRole('menuitemradio')[0])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tổ chức' }))
    await userEvent.clear(within(dialog).getByLabelText('Địa chỉ'))
    await userEvent.type(within(dialog).getByLabelText('Địa chỉ'), 'Địa chỉ mới')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

    expect(service.updateCustomer).toHaveBeenCalledWith(detailedCustomer.id, {
      code: 'KH000001',
      name: 'Út Tèo mới',
      phone: '0909000000',
      tax_code: '0123456789',
      customer_group_id: 'group-35',
      customer_type: 'company',
      company_name: 'Công ty Hoàng Lợi',
      address: 'Địa chỉ mới',
      note: 'Khách QCVL',
    })
    expect(onSelectCustomer).toHaveBeenCalledWith(updatedCustomer)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chi tiết khách KH000001' })).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Mở chi tiết khách Khach le' }))
    const reopenedDialog = await screen.findByRole('dialog', { name: 'Chi tiết khách KH000001' })
    await userEvent.click(within(reopenedDialog).getByRole('tab', { name: 'Công nợ' }))
    await within(reopenedDialog).findByRole('table', { name: 'Lịch sử công nợ POS' })
    expect(within(reopenedDialog).queryByText('Tổng nợ')).not.toBeInTheDocument()
    expect(within(reopenedDialog).getAllByText('50 130 458').length).toBeGreaterThan(0)
    expect(within(reopenedDialog).getByText('CB000001')).toBeInTheDocument()
    expect(within(reopenedDialog).getByText('TT001838')).toBeInTheDocument()
    expect(financeService.listCashbookEntries).not.toHaveBeenCalled()

    await userEvent.click(within(reopenedDialog).getByRole('tab', { name: 'Lịch sử' }))
    expect(await within(reopenedDialog).findByRole('table', { name: 'Lịch sử hóa đơn POS' })).toBeInTheDocument()
    expect(within(reopenedDialog).getByText('HD011146')).toBeInTheDocument()
    expect(within(reopenedDialog).getAllByText('Nợ').length).toBeGreaterThan(0)

    await userEvent.click(within(reopenedDialog).getByRole('button', { name: 'Đóng chi tiết khách' }))

    expect(screen.queryByRole('dialog', { name: 'Chi tiết khách KH000001' })).not.toBeInTheDocument()
  })

  it('creates and selects a quick customer without requiring phone', async () => {
    const created = {
      ...customer,
      id: 'customer-2',
      code: 'KH000002',
      name: 'Cong ty ABC',
      customer_group_id: 'group-vip',
      customer_group: { id: 'group-vip', code: 'VIP', name: 'VIP' },
    }
    const service = serviceStub({ createCustomer: vi.fn(async () => created) })
    const onSelectCustomer = vi.fn()

    function Harness() {
      const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
      return (
        <CustomerPanel
          service={service}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={(nextCustomer) => {
            setSelectedCustomer(nextCustomer)
            onSelectCustomer(nextCustomer)
          }}
        />
      )
    }

    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Tạo khách nhanh' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạo khách hàng' })
    await userEvent.type(within(dialog).getByLabelText('Tên khách hàng'), 'Cong ty ABC')
    await userEvent.selectOptions(within(dialog).getByLabelText('Nhóm khách hàng'), 'group-vip')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

    expect(service.createCustomer).toHaveBeenCalledWith({
      code: undefined,
      name: 'Cong ty ABC',
      phone: undefined,
      tax_code: undefined,
      address: undefined,
      note: undefined,
      customer_group_id: 'group-vip',
      customer_type: 'individual',
      company_name: null,
    })
    expect(onSelectCustomer).toHaveBeenCalledWith(created)
    expect(await screen.findByRole('group', { name: 'Khách đã chọn' })).toHaveTextContent('Cong ty ABC')
  })
})
