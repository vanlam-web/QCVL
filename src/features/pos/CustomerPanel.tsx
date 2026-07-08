import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import type { CatalogService } from '../catalog/catalog-service'
import type { Customer } from '../catalog/types'

export function CustomerPanel({
  service,
  selectedCustomer,
  onSelectCustomer,
}: {
  service: CatalogService
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
}) {
  const [search, setSearch] = useState(() => selectedCustomer?.name ?? '')
  const [results, setResults] = useState<Customer[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', phone: '' })
  const [error, setError] = useState<string | null>(null)

  async function searchCustomers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const response = await service.listCustomers({ search })
      setResults(response.items)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tìm được khách hàng.'))
    }
  }

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const created = await service.createCustomer({
        code: form.code.trim() || undefined,
        name: form.name,
        phone: form.phone.trim() || undefined,
        customer_group_id: null,
      })
      onSelectCustomer(created)
      setResults([created])
      setSearch(created.name)
      setForm({ code: '', name: '', phone: '' })
      setCreateOpen(false)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được khách hàng.'))
    }
  }

  return (
    <section aria-label="Khách hàng" className="customer-panel">
      {error ? <p role="alert">{error}</p> : null}

      <form aria-label="Tìm khách hàng" className="customer-search" onSubmit={searchCustomers}>
        <label>
          <span>Tìm khách</span>
          <Search aria-hidden="true" size={18} />
          <input
            value={search}
            placeholder="Tìm khách hàng (F4)"
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            aria-label="Tạo khách nhanh"
            title="Tạo khách nhanh"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" size={18} />
          </button>
        </label>
      </form>

      {createOpen ? (
        <form aria-label="Tạo khách nhanh" className="customer-create-popover" onSubmit={createCustomer}>
          <label>
            Mã khách
            <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
          </label>
          <label>
            Tên khách
            <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            SĐT
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <button className="button button-primary" type="submit">Tạo khách</button>
        </form>
      ) : null}

      {results.length > 0 ? (
        <ul className="customer-results">
          {results.map((customer) => (
            <li key={customer.id}>
              <button className="button button-secondary" type="button" onClick={() => {
                setSearch(customer.name)
                onSelectCustomer(customer)
              }}>
                Chọn {customer.code} {customer.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
