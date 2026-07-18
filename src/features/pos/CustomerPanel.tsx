import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { ManagementCompactCreateAction, ManagementCompactSearch } from '../../components/ui-shell/management-layout'
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
  const searchRequestId = useRef(0)
  const searchPanelRef = useRef<HTMLElement | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const selectedCustomerSearchText = selectedCustomer?.name.trim() ?? ''
  const searchQuery = search.trim()
  const searchShowsSelectedCustomer = selectedCustomer !== null && searchQuery === selectedCustomerSearchText

  useEffect(() => {
    if (!suggestionsOpen) return undefined

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && searchPanelRef.current?.contains(target)) return
      setSuggestionsOpen(false)
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [suggestionsOpen])

  async function searchCustomers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const response = await service.listCustomers({ search: search.trim() || undefined })
      setResults(response.items)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tìm được khách hàng.'))
    }
  }

  async function suggestCustomers(nextSearch: string) {
    setSearch(nextSearch)
    const query = nextSearch.trim()
    setSuggestionsOpen(query.length > 0 && !(selectedCustomer !== null && query === selectedCustomerSearchText))
    const requestId = searchRequestId.current + 1
    searchRequestId.current = requestId
    if (query.length === 0 || (selectedCustomer !== null && query === selectedCustomerSearchText)) {
      setResults([])
      return
    }
    setError(null)
    try {
      const response = await service.listCustomers({ search: query, page: 1, page_size: 8 })
      if (searchRequestId.current !== requestId) return
      setResults(response.items)
    } catch (cause) {
      if (searchRequestId.current !== requestId) return
      setResults([])
      setError(formatApiError(cause, 'Không tìm được khách hàng.'))
    }
  }

  function selectCustomer(customer: Customer) {
    setSearch(customer.name)
    setResults([])
    setSuggestionsOpen(false)
    onSelectCustomer(customer)
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
      setResults([])
      setSearch(created.name)
      setSuggestionsOpen(false)
      setForm({ code: '', name: '', phone: '' })
      setCreateOpen(false)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được khách hàng.'))
    }
  }

  return (
    <section ref={searchPanelRef} aria-label="Khách hàng" className="customer-panel">
      {error ? <p role="alert">{error}</p> : null}

      <form aria-label="Tìm khách hàng" className="customer-search" onSubmit={searchCustomers}>
        <ManagementCompactSearch
          label="Tìm khách"
          placeholder="Tìm khách hàng (F4)"
          value={search}
          leadingIcon={<Search aria-hidden="true" size={16} />}
          trailingAction={<ManagementCompactCreateAction ariaLabel="Tạo khách nhanh" onClick={() => setCreateOpen(true)} />}
          onFocus={() => {
            const query = search.trim()
            setSuggestionsOpen(query.length > 0 && !(selectedCustomer !== null && query === selectedCustomerSearchText))
          }}
          suggestions={
            suggestionsOpen && searchQuery.length > 0 && !searchShowsSelectedCustomer
              ? results.map((customer) => ({
                  id: customer.id,
                  primary: customer.name,
                  secondary: `Mã: ${customer.code}`,
                  ariaLabel: `Chọn ${customer.code} ${customer.name}`,
                }))
              : undefined
          }
          suggestionsLabel="Gợi ý khách hàng"
          emptySuggestion="Không có kết quả phù hợp"
          onChange={(nextSearch) => void suggestCustomers(nextSearch)}
          onSuggestionSelect={(suggestion) => {
            const customer = results.find((item) => item.id === suggestion.id)
            if (customer) selectCustomer(customer)
          }}
        />
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
    </section>
  )
}
