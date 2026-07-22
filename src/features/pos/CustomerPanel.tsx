import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, UserRound, X } from 'lucide-react'
import { ManagementCompactCreateAction, ManagementCompactSearch } from '../../components/ui-shell/management-layout'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import { quickPickCustomerPageSize, quickPickDefaultPage, quickPickSearchContext } from '../../lib/search-contract'
import { useQuickPickSearch } from '../../lib/use-quick-pick-search'
import { CustomerCreateDialog, createCustomerFormDefaults, type CustomerCreateForm } from '../catalog/CustomerCreateDialog'
import { customerDateTime, customerSalesDocumentStatusText } from '../catalog/customer-presenter'
import {
  buildCustomerDebtLedgerRows,
  customerDebtCurrentAmountFromLedger,
  customerDebtLedgerRowsFromBackend,
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
const hiddenPosCustomerGroupNames = new Set(['khach le', 'khach si'])
export function CustomerPanel({
  service,
  orderService,
  salesDocumentService,
  selectedCustomer,
  onSelectCustomer,
}: {
  service: CatalogService
  orderService?: Pick<OrderService, 'getCustomerDebt'>
  financeService?: Pick<FinanceService, never>
  salesDocumentService?: Pick<SalesDocumentService, 'listSalesDocuments'>
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<CustomerDetailTab>('info')
  const [detailDebt, setDetailDebt] = useState<CustomerDebtState | undefined>(undefined)
  const [detailDebtLedger, setDetailDebtLedger] = useState<CustomerPosDebtLedgerState | undefined>(undefined)
  const [detailHistory, setDetailHistory] = useState<CustomerHistoryState | undefined>(undefined)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [detailSaving, setDetailSaving] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [detailDropdownOpen, setDetailDropdownOpen] = useState<CustomerDetailDropdownKey>(null)
  const [form, setForm] = useState<CustomerCreateForm>(createCustomerFormDefaults)
  const [error, setError] = useState<string | null>(null)
  const detailRequestId = useRef(0)
  const searchPanelRef = useRef<HTMLElement | null>(null)
  const selectedCustomerSearchText = selectedCustomer?.name.trim() ?? ''
  const searchCustomersForQuickPick = useCallback((query: string) => service.listCustomers({
    search: query,
    status: 'active',
    page: quickPickDefaultPage,
    page_size: quickPickCustomerPageSize,
    search_context: quickPickSearchContext,
  }), [service])
  const formatCustomerSearchError = useCallback((cause: unknown) => formatApiError(cause, 'Không tìm được khách hàng.'), [])
  const shouldSearchCustomer = useCallback(
    (query: string) => !(selectedCustomer !== null && query === selectedCustomerSearchText),
    [selectedCustomer, selectedCustomerSearchText],
  )
  const customerSearch = useQuickPickSearch<Customer>({
    search: searchCustomersForQuickPick,
    formatError: formatCustomerSearchError,
    shouldSearch: shouldSearchCustomer,
  })
  const search = customerSearch.query
  const results = customerSearch.results
  const searchLoading = customerSearch.loading
  const suggestionsOpen = customerSearch.suggestionsOpen
  const searchQuery = search.trim()
  const searchShowsSelectedCustomer = selectedCustomer !== null && searchQuery === selectedCustomerSearchText
  const visibleError = error ?? customerSearch.error
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
      ? customerDebtCurrentAmountFromLedger(detailDebtLedger, selectedCustomer?.total_debt_amount ?? 0)
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
      customerSearch.setSuggestionsOpen(false)
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [customerSearch, suggestionsOpen])

  useEffect(() => {
    if (selectedCustomer === null) return
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    queueMicrotask(() => {
      if (detailRequestId.current !== requestId) return
      setDetailDebt(orderService ? 'loading' : undefined)
      setDetailDebtLedger(orderService ? 'loading' : undefined)
      setDetailHistory(salesDocumentService ? 'loading' : undefined)
    })

    if (orderService) {
      orderService.getCustomerDebt(selectedCustomer.id)
        .then((debt) => {
          if (detailRequestId.current !== requestId) return
          setDetailDebt(debt)
          setDetailDebtLedger({
            debt,
            invoiceHistory: [],
            cashbookHistory: debt.cashbook_entries ?? [],
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
  }, [orderService, salesDocumentService, selectedCustomer])

  useEffect(() => {
    if (!detailOpen && !createOpen) return
    service
      .listCustomerGroups()
      .then((response) => setCustomerGroups(response.items))
      .catch(() => setCustomerGroups([]))
  }, [createOpen, detailOpen, selectedCustomer, service])

  function suggestCustomers(nextSearch: string) {
    customerSearch.changeQuery(nextSearch)
  }

  function selectCustomer(customer: Customer) {
    void Promise.resolve(service.recordSearchSelection({ entity_type: 'customer', entity_id: customer.id })).catch(() => undefined)
    customerSearch.setQuery(customer.name)
    customerSearch.setResults([])
    customerSearch.setSuggestionsOpen(false)
    onSelectCustomer(customer)
  }

  function clearSelectedCustomer() {
    customerSearch.clear()
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

  function openCreateCustomer() {
    setForm(createCustomerFormDefaults())
    setCreateOpen(true)
  }

  async function saveCustomerDetail(event: React.FormEvent<HTMLFormElement>, detailForm: CustomerDetailForm) {
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
      customerSearch.setQuery(updated.name)
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
    setCreateSaving(true)
    try {
      const created = await service.createCustomer({
        code: form.code.trim() || undefined,
        name: form.name,
        phone: form.phone.trim() || undefined,
        tax_code: form.taxCode.trim() || undefined,
        address: form.address.trim() || undefined,
        note: form.note.trim() || undefined,
        customer_group_id: form.customerGroupId || null,
        customer_type: form.customerType,
        company_name: form.customerType === 'company' ? form.companyName.trim() || null : null,
      })
      onSelectCustomer(created)
      customerSearch.setResults([])
      customerSearch.setQuery(created.name)
      customerSearch.setSuggestionsOpen(false)
      setForm(createCustomerFormDefaults())
      setCreateOpen(false)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được khách hàng.'))
    } finally {
      setCreateSaving(false)
    }
  }

  return (
    <section ref={searchPanelRef} aria-label="Khách hàng" className="customer-panel">
      {visibleError ? <p role="alert">{visibleError}</p> : null}

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
          {selectedCustomerDebt !== null && selectedCustomerDebt !== 0 ? (
          <span className="customer-selected-debt">
            {selectedCustomerDebt > 0 ? 'Còn nợ' : 'Dư có'}:{' '}
            <strong>{formatMoney(Math.abs(selectedCustomerDebt))}</strong>
          </span>
          ) : null}
          {detailOpen ? (
            <SelectedCustomerDetailDialog
              key={selectedCustomer.id}
              activeTab={detailTab}
              customer={selectedCustomer}
              customerGroups={mergeSelectedCustomerGroup(customerGroups, selectedCustomer)}
              debt={detailDebt}
              debtLedger={detailDebtLedger}
              history={detailHistory}
              saving={detailSaving}
              summaryDebt={selectedCustomerDebt}
              detailDropdownOpen={detailDropdownOpen}
              onClose={() => {
                setDetailDropdownOpen(null)
                setDetailOpen(false)
              }}
              onCloseDropdown={() => setDetailDropdownOpen(null)}
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
        <form aria-label="Tìm khách hàng" className="customer-search" onSubmit={(event) => void customerSearch.submitSearch(event)}>
          <ManagementCompactSearch
            label="Tìm khách"
            placeholder="Tìm khách hàng (F4)"
            value={search}
            leadingIcon={<Search aria-hidden="true" size={16} />}
            trailingAction={<ManagementCompactCreateAction ariaLabel="Tạo khách nhanh" onClick={openCreateCustomer} />}
            onFocus={() => customerSearch.changeQuery(search)}
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
            emptySuggestion={searchLoading ? 'Đang tìm...' : 'Không có kết quả phù hợp'}
            onChange={(nextSearch) => void suggestCustomers(nextSearch)}
            onSuggestionSelect={(suggestion) => {
              const customer = results.find((item) => item.id === suggestion.id)
              if (customer) selectCustomer(customer)
            }}
          />
        </form>
      )}

      {createOpen ? (
        <CustomerCreateDialog
          error={error}
          form={form}
          formId="pos-customer-create-form"
          groups={customerGroups.filter((group) => !isHiddenPosCustomerGroup(group))}
          saving={createSaving}
          onClose={() => setCreateOpen(false)}
          onFormChange={setForm}
          onSubmit={createCustomer}
        />
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
  history,
  saving,
  summaryDebt,
  onClose,
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
  history: CustomerHistoryState | undefined
  saving: boolean
  summaryDebt: number | null
  onClose: () => void
  onSaveInfo: (event: React.FormEvent<HTMLFormElement>, form: CustomerDetailForm) => void
  onSelectTab: (tab: CustomerDetailTab) => void
  detailDropdownOpen: CustomerDetailDropdownKey
  onToggleDropdown: (key: Exclude<CustomerDetailDropdownKey, null>) => void
  onCloseDropdown: () => void
}) {
  const [form, setForm] = useState<CustomerDetailForm>(() => customerDetailFormFromCustomer(customer))
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
          <form aria-label="Sửa thông tin khách hàng" className="customer-pos-detail-section customer-pos-detail-form" id="customer-pos-detail-form" onSubmit={(event) => onSaveInfo(event, form)}>
            <label>
              <span>Mã KH</span>
              <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </label>
            <label>
              <span>Tên KH</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              <span>SĐT</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label>
              <span>MST</span>
              <input value={form.tax_code} onChange={(event) => setForm({ ...form, tax_code: event.target.value })} />
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
              onChange={(value) => setForm({ ...form, customer_group_id: value })}
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
              onChange={(value) => setForm({ ...form, customer_type: value })}
            />
            <label className="customer-pos-detail-form-wide">
              <span>Công ty</span>
              <input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
            </label>
            <label className="customer-pos-detail-form-wide">
              <span>Địa chỉ</span>
              <textarea rows={1} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </label>
            <label className="customer-pos-detail-form-wide">
              <span>Ghi chú</span>
              <textarea rows={1} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
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
  const ledgerRows = (debtLedger.debt.ledger_rows?.length ?? 0) > 0
    ? customerDebtLedgerRowsFromBackend(debtLedger.debt)
    : buildCustomerDebtLedgerRows(
        invoiceRows,
        debtLedger.cashbookHistory,
        debtLedger.debt.adjustments ?? [],
        debtLedger.debt.linked_supplier_receipts ?? [],
        { currentTotal: debtLedger.debt.total_debt },
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
