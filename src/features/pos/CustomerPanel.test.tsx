import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CatalogService } from '../catalog/catalog-service'
import type { Customer } from '../catalog/types'
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
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    resolvePrices: vi.fn(),
    listCustomers: vi.fn(async () => ({ items: [customer], page: 1, page_size: 20, total: 1 })),
    createCustomer: vi.fn(async () => customer),
    ...overrides,
  } as CatalogService
}

describe('CustomerPanel', () => {
  it('searches and selects a customer', async () => {
    const service = serviceStub()
    const onSelectCustomer = vi.fn()

    render(<CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={onSelectCustomer} />)

    await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))

    expect(service.listCustomers).toHaveBeenCalledWith({ search: 'khach' })
    expect(onSelectCustomer).toHaveBeenCalledWith(customer)
  })

  it('shows customer suggestions while typing', async () => {
    const service = serviceStub()

    render(<CustomerPanel service={service} selectedCustomer={null} onSelectCustomer={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText('Tìm khách hàng (F4)'), 'khach')

    expect(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' })).toBeInTheDocument()
    expect(service.listCustomers).toHaveBeenCalledWith({ search: 'khach', page: 1, page_size: 8 })
  })

  it('creates and selects a quick customer without requiring phone', async () => {
    const created = { ...customer, id: 'customer-2', code: 'KH000002', name: 'Cong ty ABC' }
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
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Cong ty ABC')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo khách' }))

    expect(service.createCustomer).toHaveBeenCalledWith({
      code: undefined,
      name: 'Cong ty ABC',
      phone: undefined,
      customer_group_id: null,
    })
    expect(onSelectCustomer).toHaveBeenCalledWith(created)
    expect(await screen.findByDisplayValue('Cong ty ABC')).toBeInTheDocument()
  })
})
