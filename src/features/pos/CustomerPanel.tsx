import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, UserRound, X } from 'lucide-react'
import { ManagementCompactCreateAction, ManagementCompactSearch } from '../../components/ui-shell/management-layout'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import { customerDateTime, customerSalesDocumentStatusText } from '../catalog/customer-presenter'
import type { CatalogService } from '../catalog/catalog-service'
import type { Customer } from '../catalog/types'
import type { OrderService, CustomerDebtDetail } from '../orders/order-service'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'

type CustomerDetailTab = 'info' | 'debt' | 'history'
type CustomerDebtState = CustomerDebtDetail | 'loading' | 'error'
type CustomerHistoryState = { items: SalesDocumentListItem[]; total: number } | 'loading' | 'error'

export function CustomerPanel({
  service,
  orderService,
  salesDocumentService,
  selectedCustomer,
  onSelectCustomer,
}: {
  service: CatalogService
  orderService?: Pick<OrderService, 'getCustomerDebt'>
  salesDocumentService?: Pick<SalesDocumentService, 'listSalesDocuments'>
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
}) {
  const [search, setSearch] = useState(() => selectedCustomer?.name ?? '')
  const [results, setResults] = useState<Customer[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<CustomerDetailTab>('info')
  const [detailDebt, setDetailDebt] = useState<CustomerDebtState | undefined>(undefined)
  const [detailHistory, setDetailHistory] = useState<CustomerHistoryState | undefined>(undefined)
  const [form, setForm] = useState({ code: '', name: '', phone: '' })
  const [error, setError] = useState<string | null>(null)
  const searchRequestId = useRef(0)
  const detailRequestId = useRef(0)
  const searchPanelRef = useRef<HTMLElement | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const selectedCustomerSearchText = selectedCustomer?.name.trim() ?? ''
  const searchQuery = search.trim()
  const searchShowsSelectedCustomer = selectedCustomer !== null && searchQuery === selectedCustomerSearchText
  const selectedCustomerDebt = selectedCustomer?.total_debt_amount ?? 0
  const selectedCustomerGroupName = selectedCustomer?.customer_group?.name?.trim() ?? ''

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

  useEffect(() => {
    if (!detailOpen || selectedCustomer === null) return
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setDetailDebt(orderService ? 'loading' : undefined)
    setDetailHistory(salesDocumentService ? 'loading' : undefined)

    if (orderService) {
      orderService
        .getCustomerDebt(selectedCustomer.id)
        .then((debt) => {
          if (detailRequestId.current === requestId) setDetailDebt(debt)
        })
        .catch(() => {
          if (detailRequestId.current === requestId) setDetailDebt('error')
        })
    }

    if (salesDocumentService) {
      salesDocumentService
        .listSalesDocuments({ customer_id: selectedCustomer.id, type: 'invoice', page: 1, page_size: 10 })
        .then((history) => {
          if (detailRequestId.current === requestId) setDetailHistory({ items: history.items, total: history.total })
        })
        .catch(() => {
          if (detailRequestId.current === requestId) setDetailHistory('error')
        })
    }
  }, [detailOpen, orderService, salesDocumentService, selectedCustomer])

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

  function clearSelectedCustomer() {
    setSearch('')
    setResults([])
    setSuggestionsOpen(false)
    setDetailOpen(false)
    setDetailTab('info')
    setDetailDebt(undefined)
    setDetailHistory(undefined)
    onSelectCustomer(null)
  }

  function openCustomerDetail() {
    setDetailTab('info')
    setDetailOpen(true)
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

      {selectedCustomer ? (
        <div aria-label="Khách đã chọn" className="customer-selected" role="group">
          <span className="customer-selected-row">
            <span className="customer-selected-chip">
              <button
                aria-label={`Mở chi tiết khách ${selectedCustomer.name}`}
                className="customer-selected-open"
                type="button"
                onClick={openCustomerDetail}
              >
                <UserRound aria-hidden="true" size={16} />
                <span className="customer-selected-name">{selectedCustomer.name}</span>
              </button>
              <button
                aria-label={`Bỏ khách ${selectedCustomer.name}`}
                className="customer-selected-clear"
                type="button"
                onClick={clearSelectedCustomer}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </span>
            {selectedCustomerGroupName ? (
              <span aria-label={`Bảng giá ${selectedCustomerGroupName}`} className="customer-selected-group">
                {selectedCustomerGroupName}
                <ChevronDown aria-hidden="true" size={14} />
              </span>
            ) : null}
          </span>
          {selectedCustomerDebt > 0 ? (
          <span className="customer-selected-debt">Còn nợ: <strong>{formatMoney(selectedCustomerDebt)}</strong></span>
          ) : null}
          {detailOpen ? (
            <SelectedCustomerDetailDialog
              activeTab={detailTab}
              customer={selectedCustomer}
              debt={detailDebt}
              history={detailHistory}
              onClose={() => setDetailOpen(false)}
              onSelectTab={setDetailTab}
            />
          ) : null}
        </div>
      ) : (
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
      )}

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

function SelectedCustomerDetailDialog({
  activeTab,
  customer,
  debt,
  history,
  onClose,
  onSelectTab,
}: {
  activeTab: CustomerDetailTab
  customer: Customer
  debt: CustomerDebtState | undefined
  history: CustomerHistoryState | undefined
  onClose: () => void
  onSelectTab: (tab: CustomerDetailTab) => void
}) {
  const groupName = customer.customer_group?.name?.trim() ?? ''
  const summaryDebt = customer.total_debt_amount ?? 0
  const totalSales = customer.total_sales_amount ?? 0
  const detailRows = [
    { label: 'Mã khách hàng', value: customer.code },
    { label: 'Tên khách hàng', value: customer.name },
    { label: 'Điện thoại', value: customer.phone },
    { label: 'Mã số thuế', value: customer.tax_code },
    { label: 'Địa chỉ', value: customer.address },
    { label: 'Nhóm', value: groupName },
    { label: 'Loại khách', value: customerTypeText(customer.customer_type) },
    { label: 'Công ty', value: customer.company_name },
    { label: 'Ghi chú', value: customer.note },
  ].filter((row) => hasDetailValue(row.value))

  return (
    <div className="management-modal-backdrop customer-pos-detail-backdrop" onMouseDown={onClose}>
      <section
        aria-label={`Chi tiết khách ${customer.code}`}
        aria-modal="true"
        className="management-modal-dialog customer-pos-detail-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="management-modal-header customer-pos-detail-header">
          <div>
            <h2>{customer.name} <span>{customer.code}</span></h2>
          </div>
          <button aria-label="Đóng chi tiết khách" className="management-icon-button" type="button" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="customer-pos-detail-summary" aria-label="Tổng quan khách hàng">
          <span>Còn nợ: <strong>{formatMoney(summaryDebt)}</strong></span>
          <span>Tổng bán: <strong>{formatMoney(totalSales)}</strong></span>
          {customer.linked_supplier ? (
            <span>NCC liên kết: <span>{customer.linked_supplier.code} {customer.linked_supplier.name}</span></span>
          ) : null}
        </div>

        <div aria-label="Chi tiết khách hàng" className="customer-pos-detail-tabs" role="tablist">
          {([
            ['info', 'Thông tin'],
            ['debt', 'Công nợ'],
            ['history', 'Lịch sử'],
          ] as const).map(([tab, label]) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'customer-pos-detail-tab-active' : undefined}
              key={tab}
              role="tab"
              type="button"
              onClick={() => onSelectTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'info' ? <section className="customer-pos-detail-section" aria-label="Thông tin khách hàng">
          <dl className="customer-pos-detail-list">
            {detailRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section> : null}

        {activeTab === 'debt' ? <CustomerPosDebtPanel debt={debt} fallbackDebt={summaryDebt} /> : null}
        {activeTab === 'history' ? <CustomerPosHistoryPanel history={history} /> : null}

        <footer className="management-modal-footer">
          <button className="button button-secondary" type="button" onClick={onClose}>Đóng</button>
        </footer>
      </section>
    </div>
  )
}

function CustomerPosDebtPanel({ debt, fallbackDebt }: { debt: CustomerDebtState | undefined; fallbackDebt: number }) {
  if (debt === undefined || debt === 'loading') return <p>Đang tải công nợ...</p>
  if (debt === 'error') return <p role="alert">Không tải được công nợ.</p>
  const totalDebt = Math.max(debt.total_debt, fallbackDebt)
  return (
    <section aria-label="Công nợ khách hàng" className="customer-pos-detail-panel">
      <div className="customer-pos-detail-money-row">
        <span>Tổng nợ</span>
        <strong>{formatMoney(totalDebt)}</strong>
      </div>
      {debt.invoices.length === 0 ? <p>Chưa có hóa đơn còn nợ.</p> : (
        <table aria-label="Hóa đơn còn nợ POS" className="customer-pos-detail-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Ngày</th>
              <th>Tổng</th>
              <th>Đã thu</th>
              <th>Còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {debt.invoices.map((invoice) => (
              <tr key={invoice.order_id}>
                <td>{invoice.order_code}</td>
                <td>{customerDateTime(invoice.created_at)}</td>
                <td>{formatMoney(invoice.total_amount)}</td>
                <td>{formatMoney(invoice.paid_amount)}</td>
                <td><strong>{formatMoney(invoice.remaining_debt)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function CustomerPosHistoryPanel({ history }: { history: CustomerHistoryState | undefined }) {
  if (history === undefined || history === 'loading') return <p>Đang tải lịch sử...</p>
  if (history === 'error') return <p role="alert">Không tải được lịch sử.</p>
  if (history.items.length === 0) return <p>Chưa có lịch sử bán hàng.</p>
  return (
    <section aria-label="Lịch sử khách hàng" className="customer-pos-detail-panel">
      <table aria-label="Lịch sử hóa đơn POS" className="customer-pos-detail-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ngày</th>
            <th>Tổng</th>
            <th>Đã thu</th>
            <th>Nợ</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {history.items.map((document) => (
            <tr key={document.id}>
              <td>{document.code}</td>
              <td>{customerDateTime(document.created_at)}</td>
              <td>{formatMoney(document.total_amount)}</td>
              <td>{formatMoney(document.paid_amount)}</td>
              <td><strong>{formatMoney(document.debt_amount)}</strong></td>
              <td>{customerSalesDocumentStatusText(document)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function hasDetailValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function customerTypeText(type: Customer['customer_type']) {
  switch (type) {
    case 'individual':
      return 'Cá nhân'
    case 'company':
      return 'Công ty'
    case 'other':
      return 'Khác'
    default:
      return ''
  }
}
