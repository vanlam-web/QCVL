import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, UserRound, X } from 'lucide-react'
import { ManagementCompactCreateAction, ManagementCompactSearch } from '../../components/ui-shell/management-layout'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import { customerDateTime, customerSalesDocumentStatusText } from '../catalog/customer-presenter'
import {
  buildCustomerDebtLedgerRows,
  customerDebtCounterpartyMatches,
  customerDebtHasLiveLedger,
  customerDebtLedgerDefinesCurrentDebt,
} from '../catalog/customer-debt-ledger'
import type { CatalogService } from '../catalog/catalog-service'
import type { Customer, CustomerGroup } from '../catalog/types'
import type { FinanceService } from '../finance/finance-service'
import type { CashbookEntry } from '../finance/types'
import type { OrderService, CustomerDebtDetail } from '../orders/order-service'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'

type CustomerDetailTab = 'info' | 'debt' | 'history'
type CustomerDebtState = CustomerDebtDetail | 'loading' | 'error'
type CustomerPosDebtLedgerState = {
  debt: CustomerDebtDetail
  invoiceHistory: SalesDocumentListItem[]
  cashbookHistory: CashbookEntry[]
} | 'loading' | 'error'
type CustomerHistoryState = { items: SalesDocumentListItem[]; total: number } | 'loading' | 'error'
type CustomerDetailForm = {
  code: string
  name: string
  phone: string
  tax_code: string
  customer_group_id: string
  customer_type: string
  company_name: string
  address: string
  note: string
}
type CustomerDetailDropdownKey = 'group' | 'type' | null
const customerDebtLedgerFetchPageSize = 1000
const hiddenPosCustomerGroupNames = new Set(['khach le', 'khach si'])

function customerPosCurrentDebtFromLedger(debtLedger: Exclude<CustomerPosDebtLedgerState, 'loading' | 'error'>, fallbackDebt: number) {
  const hasLiveDebtLedger = customerDebtHasLiveLedger(debtLedger.debt)
  const totalDebt = hasLiveDebtLedger ? debtLedger.debt.total_debt : fallbackDebt
  const invoiceRows = debtLedger.invoiceHistory.length > 0
    ? debtLedger.invoiceHistory
    : debtLedger.debt.invoices.map((invoice) => ({
        id: invoice.order_id,
        code: invoice.order_code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
      }))
  const ledgerRows = buildCustomerDebtLedgerRows(
    invoiceRows,
    debtLedger.cashbookHistory,
    debtLedger.debt.adjustments ?? [],
    debtLedger.debt.linked_supplier_receipts ?? [],
  )
  const ledgerDefinesCurrentDebt = customerDebtLedgerDefinesCurrentDebt(debtLedger)
  return ledgerDefinesCurrentDebt ? ledgerRows[0]?.running_debt ?? totalDebt : totalDebt
}

export function CustomerPanel({
  service,
  orderService,
  financeService,
  salesDocumentService,
  selectedCustomer,
  onSelectCustomer,
}: {
  service: CatalogService
  orderService?: Pick<OrderService, 'getCustomerDebt'>
  financeService?: Pick<FinanceService, 'listCashbookEntries'>
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
  const [detailDebtLedger, setDetailDebtLedger] = useState<CustomerPosDebtLedgerState | undefined>(undefined)
  const [detailHistory, setDetailHistory] = useState<CustomerHistoryState | undefined>(undefined)
  const [detailForm, setDetailForm] = useState<CustomerDetailForm>(() => customerDetailFormFromCustomer(selectedCustomer))
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailDropdownOpen, setDetailDropdownOpen] = useState<CustomerDetailDropdownKey>(null)
  const [form, setForm] = useState({ code: '', name: '', phone: '' })
  const [error, setError] = useState<string | null>(null)
  const searchRequestId = useRef(0)
  const detailRequestId = useRef(0)
  const searchPanelRef = useRef<HTMLElement | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const selectedCustomerSearchText = selectedCustomer?.name.trim() ?? ''
  const searchQuery = search.trim()
  const searchShowsSelectedCustomer = selectedCustomer !== null && searchQuery === selectedCustomerSearchText
  const hasSelectedCustomerDebtLedger =
    selectedCustomer !== null
    && detailDebt !== undefined
    && detailDebt !== 'loading'
    && detailDebt !== 'error'
    && detailDebt.customer_id === selectedCustomer.id
    && detailDebtLedger !== undefined
    && detailDebtLedger !== 'loading'
    && detailDebtLedger !== 'error'
  const selectedCustomerDebt =
    hasSelectedCustomerDebtLedger
      ? customerPosCurrentDebtFromLedger(detailDebtLedger, selectedCustomer?.total_debt_amount ?? 0)
      : orderService === undefined ? selectedCustomer?.total_debt_amount ?? 0 : null
  const selectedCustomerGroupName =
    selectedCustomer?.customer_group && !isHiddenPosCustomerGroup(selectedCustomer.customer_group)
      ? selectedCustomer.customer_group.name.trim()
      : ''

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
    if (selectedCustomer === null) return
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setDetailDebt(orderService ? 'loading' : undefined)
    setDetailDebtLedger(orderService ? 'loading' : undefined)
    setDetailHistory(salesDocumentService ? 'loading' : undefined)

    if (orderService) {
      const counterpartySearch = selectedCustomer.name.trim() || selectedCustomer.code
      Promise.all([
        orderService.getCustomerDebt(selectedCustomer.id),
        salesDocumentService?.listSalesDocuments({
          customer_id: selectedCustomer.id,
          type: 'invoice',
          page: 1,
          page_size: customerDebtLedgerFetchPageSize,
        }) ?? Promise.resolve({ items: [], page: 1, page_size: customerDebtLedgerFetchPageSize, total: 0 }),
        financeService?.listCashbookEntries({
          search: counterpartySearch || undefined,
          search_scope: 'counterparty',
          status: 'posted',
          page: 1,
          page_size: customerDebtLedgerFetchPageSize,
        }) ?? Promise.resolve({
          items: [],
          page: 1,
          page_size: customerDebtLedgerFetchPageSize,
          total: 0,
          summary: { opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 },
        }),
      ])
        .then(([debt, invoiceHistory, cashbookHistory]) => {
          if (detailRequestId.current !== requestId) return
          setDetailDebt(debt)
          setDetailDebtLedger({
            debt,
            invoiceHistory: invoiceHistory.items,
            cashbookHistory: cashbookHistory.items.filter((entry) => customerDebtCounterpartyMatches(entry, selectedCustomer)),
          })
        })
        .catch(() => {
          if (detailRequestId.current !== requestId) return
          setDetailDebt('error')
          setDetailDebtLedger('error')
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
  }, [financeService, orderService, salesDocumentService, selectedCustomer])

  useEffect(() => {
    if (!detailOpen || selectedCustomer === null) return
    setDetailForm(customerDetailFormFromCustomer(selectedCustomer))
    service
      .listCustomerGroups()
      .then((response) => setCustomerGroups(response.items))
      .catch(() => setCustomerGroups([]))
  }, [detailOpen, selectedCustomer, service])

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
    setDetailDebtLedger(undefined)
    setDetailHistory(undefined)
    onSelectCustomer(null)
  }

  function openCustomerDetail() {
    setDetailTab('info')
    setDetailOpen(true)
  }

  async function saveCustomerDetail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedCustomer === null) return
    setError(null)
    setDetailSaving(true)
    try {
      const updated = await service.updateCustomer(selectedCustomer.id, {
        code: detailForm.code.trim(),
        name: detailForm.name.trim(),
        phone: nullableFormText(detailForm.phone),
        tax_code: nullableFormText(detailForm.tax_code),
        customer_group_id: detailForm.customer_group_id || null,
        customer_type: detailForm.customer_type || null,
        company_name: nullableFormText(detailForm.company_name),
        address: nullableFormText(detailForm.address),
        note: nullableFormText(detailForm.note),
      })
      onSelectCustomer(updated)
      setSearch(updated.name)
      setDetailForm(customerDetailFormFromCustomer(updated))
      setDetailDropdownOpen(null)
      setDetailOpen(false)
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được khách hàng.'))
    } finally {
      setDetailSaving(false)
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
          {selectedCustomerDebt !== null && selectedCustomerDebt > 0 ? (
          <span className="customer-selected-debt">Còn nợ: <strong>{formatMoney(selectedCustomerDebt)}</strong></span>
          ) : null}
          {detailOpen ? (
            <SelectedCustomerDetailDialog
              activeTab={detailTab}
              customer={selectedCustomer}
              customerGroups={mergeSelectedCustomerGroup(customerGroups, selectedCustomer)}
              debt={detailDebt}
              debtLedger={detailDebtLedger}
              form={detailForm}
              history={detailHistory}
              saving={detailSaving}
              summaryDebt={selectedCustomerDebt}
              detailDropdownOpen={detailDropdownOpen}
              onClose={() => {
                setDetailDropdownOpen(null)
                setDetailOpen(false)
              }}
              onCloseDropdown={() => setDetailDropdownOpen(null)}
              onFormChange={setDetailForm}
              onSaveInfo={saveCustomerDetail}
              onSelectTab={(tab) => {
                setDetailDropdownOpen(null)
                setDetailTab(tab)
              }}
              onToggleDropdown={(key) => setDetailDropdownOpen((current) => (current === key ? null : key))}
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
  customerGroups,
  debt,
  debtLedger,
  form,
  history,
  saving,
  summaryDebt,
  onClose,
  onFormChange,
  onSaveInfo,
  onSelectTab,
  detailDropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
}: {
  activeTab: CustomerDetailTab
  customer: Customer
  customerGroups: CustomerGroup[]
  debt: CustomerDebtState | undefined
  debtLedger: CustomerPosDebtLedgerState | undefined
  form: CustomerDetailForm
  history: CustomerHistoryState | undefined
  saving: boolean
  summaryDebt: number | null
  onClose: () => void
  onFormChange: (form: CustomerDetailForm) => void
  onSaveInfo: (event: React.FormEvent<HTMLFormElement>) => void
  onSelectTab: (tab: CustomerDetailTab) => void
  detailDropdownOpen: CustomerDetailDropdownKey
  onToggleDropdown: (key: Exclude<CustomerDetailDropdownKey, null>) => void
  onCloseDropdown: () => void
}) {
  const totalSales = customer.total_sales_amount ?? 0
  return (
    <div className="management-modal-backdrop customer-pos-detail-backdrop" onMouseDown={onClose}>
      <section
        aria-label={`Chi tiết khách ${customer.code}`}
        aria-modal="true"
        className="management-modal-dialog customer-pos-detail-dialog"
        role="dialog"
        onMouseDown={(event) => {
          event.stopPropagation()
          const target = event.target
          if (target instanceof Element && target.closest('.customer-pos-detail-dropdown')) return
          onCloseDropdown()
        }}
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
          {summaryDebt !== null ? <span>Còn nợ: <strong>{formatMoney(summaryDebt)}</strong></span> : null}
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

        {activeTab === 'info' ? (
          <form aria-label="Sửa thông tin khách hàng" className="customer-pos-detail-section customer-pos-detail-form" id="customer-pos-detail-form" onSubmit={onSaveInfo}>
            <label>
              <span>Mã KH</span>
              <input required value={form.code} onChange={(event) => onFormChange({ ...form, code: event.target.value })} />
            </label>
            <label>
              <span>Tên KH</span>
              <input required value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} />
            </label>
            <label>
              <span>SĐT</span>
              <input value={form.phone} onChange={(event) => onFormChange({ ...form, phone: event.target.value })} />
            </label>
            <label>
              <span>MST</span>
              <input value={form.tax_code} onChange={(event) => onFormChange({ ...form, tax_code: event.target.value })} />
            </label>
            <CustomerPosDetailDropdownField
              label="Nhóm"
              open={detailDropdownOpen === 'group'}
              options={customerGroups
                .filter((group) => !isHiddenPosCustomerGroup(group))
                .map((group) => ({ label: group.name, value: group.id }))}
              value={form.customer_group_id}
              onClose={onCloseDropdown}
              onOpen={() => onToggleDropdown('group')}
              onChange={(value) => onFormChange({ ...form, customer_group_id: value })}
            />
            <CustomerPosDetailDropdownField
              label="Loại khách"
              open={detailDropdownOpen === 'type'}
              options={[
                { label: 'Cá nhân', value: 'individual' },
                { label: 'Tổ chức', value: 'company' },
                { label: 'Khác', value: 'other' },
              ]}
              value={form.customer_type}
              onClose={onCloseDropdown}
              onOpen={() => onToggleDropdown('type')}
              onChange={(value) => onFormChange({ ...form, customer_type: value })}
            />
            <label className="customer-pos-detail-form-wide">
              <span>Công ty</span>
              <input value={form.company_name} onChange={(event) => onFormChange({ ...form, company_name: event.target.value })} />
            </label>
            <label className="customer-pos-detail-form-wide">
              <span>Địa chỉ</span>
              <textarea rows={1} value={form.address} onChange={(event) => onFormChange({ ...form, address: event.target.value })} />
            </label>
            <label className="customer-pos-detail-form-wide">
              <span>Ghi chú</span>
              <textarea rows={1} value={form.note} onChange={(event) => onFormChange({ ...form, note: event.target.value })} />
            </label>
          </form>
        ) : null}

        {activeTab === 'debt' ? <CustomerPosDebtPanel debt={debt} debtLedger={debtLedger} /> : null}
        {activeTab === 'history' ? <CustomerPosHistoryPanel history={history} /> : null}

        <footer className={`management-modal-footer${activeTab === 'info' ? ' management-modal-footer-split' : ''}`}>
          {activeTab === 'info' ? (
            <button className="button button-primary" disabled={saving} form="customer-pos-detail-form" type="submit">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          ) : null}
          <button className="button button-secondary" type="button" onClick={onClose}>Đóng</button>
        </footer>
      </section>
    </div>
  )
}

function CustomerPosDetailDropdownField({
  label,
  options,
  open,
  value,
  onChange,
  onClose,
  onOpen,
}: {
  label: string
  options: Array<{ label: string; value: string }>
  open: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onOpen: () => void
}) {
  const selected = options.find((option) => option.value === value)
  const selectedLabel = selected?.label.trim() ?? ''
  return (
    <div className="customer-pos-detail-dropdown">
      <span>{label}</span>
      <div className="customer-pos-detail-dropdown-trigger-wrap">
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="customer-pos-detail-dropdown-trigger"
          type="button"
          onClick={() => (open ? onClose() : onOpen())}
        >
          <span>{selectedLabel}</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
        {open ? (
          <div className="customer-pos-detail-dropdown-menu" role="menu">
            {options.map((option) => (
              <button
                aria-pressed={option.value === value}
                className={option.value === value ? 'is-selected' : undefined}
                key={option.value}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  onChange(option.value)
                  onClose()
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CustomerPosDebtPanel({
  debt,
  debtLedger,
}: {
  debt: CustomerDebtState | undefined
  debtLedger: CustomerPosDebtLedgerState | undefined
}) {
  if (debt === undefined || debt === 'loading' || debtLedger === undefined || debtLedger === 'loading') return <p>Đang tải công nợ...</p>
  if (debt === 'error' || debtLedger === 'error') return <p role="alert">Không tải được công nợ.</p>
  const invoiceRows = debtLedger.invoiceHistory.length > 0
    ? debtLedger.invoiceHistory
    : debtLedger.debt.invoices.map((invoice) => ({
        id: invoice.order_id,
        code: invoice.order_code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
      }))
  const ledgerRows = buildCustomerDebtLedgerRows(
    invoiceRows,
    debtLedger.cashbookHistory,
    debtLedger.debt.adjustments ?? [],
    debtLedger.debt.linked_supplier_receipts ?? [],
  )
  const visibleLedgerRows = ledgerRows.slice(0, 10)

  return (
    <section aria-label="Công nợ khách hàng" className="customer-pos-detail-panel">
      {ledgerRows.length === 0 ? <p>Chưa có lịch sử công nợ.</p> : (
        <table aria-label="Lịch sử công nợ POS" className="customer-pos-detail-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Giá trị</th>
              <th>Công nợ</th>
            </tr>
          </thead>
          <tbody>
            {visibleLedgerRows.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{customerDateTime(row.created_at)}</td>
                <td>{row.type}</td>
                <td>{formatMoney(row.value_delta)}</td>
                <td><strong>{formatMoney(row.running_debt)}</strong></td>
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

function customerDetailFormFromCustomer(customer: Customer | null): CustomerDetailForm {
  return {
    code: customer?.code ?? '',
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    tax_code: customer?.tax_code ?? '',
    customer_group_id: customer?.customer_group_id ?? '',
    customer_type: customer?.customer_type ?? 'individual',
    company_name: customer?.company_name ?? '',
    address: customer?.address ?? '',
    note: customer?.note ?? '',
  }
}

function nullableFormText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mergeSelectedCustomerGroup(groups: CustomerGroup[], customer: Customer) {
  if (!customer.customer_group) return groups
  if (groups.some((group) => group.id === customer.customer_group?.id)) return groups
  return [
    ...groups,
    {
      ...customer.customer_group,
      price_list_id: '',
      is_active: true,
    },
  ]
}

function isHiddenPosCustomerGroup(group: Pick<CustomerGroup, 'id' | 'name'>) {
  const normalizedName = group.name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return group.id === 'cg-retail' || group.id === 'cg-vip' || hiddenPosCustomerGroupNames.has(normalizedName)
}
