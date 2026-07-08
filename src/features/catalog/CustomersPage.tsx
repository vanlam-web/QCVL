import { Fragment, useEffect, useRef, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { MetricCard, MetricGrid, MoneyText } from '../../components/ui-shell/primitives'
import { formatApiError } from '../../lib/api/error-message'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import type { CatalogService, CustomerListFilters } from './catalog-service'
import type { Customer, CustomerGroup } from './types'
import type { CustomerDebtDetail, OrderService } from '../orders/order-service'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'

interface CustomerState {
  customers: Customer[]
  total: number
  page: number
  pageSize: number
}

type CustomerDebtState = CustomerDebtDetail | 'loading' | 'error'
type CustomerHistoryState = { items: SalesDocumentListItem[]; total: number } | 'loading' | 'error'
type CustomerDetailTab = 'info' | 'debt' | 'history'
type CustomerHistoryType = 'invoice' | 'quote'
const customerPageSize = 15
const customerHistoryPageSize = 10

function numberFilterValue(value: string) {
  const parsed = Number(value)
  return value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed
}

function customerHistoryKey(customerId: string, historyType: CustomerHistoryType) {
  return `${customerId}:${historyType}`
}

export function CustomersPage({
  service,
  orderService,
  salesDocumentService,
}: {
  service: CatalogService
  orderService: Pick<OrderService, 'getCustomerDebt'>
  salesDocumentService?: Pick<SalesDocumentService, 'listSalesDocuments'>
}) {
  const [state, setState] = useState<CustomerState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<CustomerDetailTab>('info')
  const [customerHistoryType, setCustomerHistoryType] = useState<CustomerHistoryType>('invoice')
  const [customerDebts, setCustomerDebts] = useState<Record<string, CustomerDebtState>>({})
  const [customerHistories, setCustomerHistories] = useState<Record<string, CustomerHistoryState>>({})
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [analysisCustomer, setAnalysisCustomer] = useState<Customer | null>(null)
  const customerDebtRequestsRef = useRef(new Set<string>())
  const customerHistoryRequestsRef = useRef(new Set<string>())
  const customerSearchRequestId = useRef(0)
  const [showFilters, setShowFilters] = useState(true)
  const [search, setSearch] = useState('')
  const [customerSearchSuggestions, setCustomerSearchSuggestions] = useState<Customer[]>([])
  const [customerSearchSuggestionsOpen, setCustomerSearchSuggestionsOpen] = useState(false)
  const [lastSearch, setLastSearch] = useState('')
  const [customerGroupId, setCustomerGroupId] = useState('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [createdBy, setCreatedBy] = useState('all')
  const [totalSalesMin, setTotalSalesMin] = useState('')
  const [totalSalesMax, setTotalSalesMax] = useState('')
  const [totalDebtMin, setTotalDebtMin] = useState('')
  const [totalDebtMax, setTotalDebtMax] = useState('')
  const [lastCustomerGroupId, setLastCustomerGroupId] = useState('all')
  const [lastCreatedFrom, setLastCreatedFrom] = useState('')
  const [lastCreatedTo, setLastCreatedTo] = useState('')
  const [lastCreatedBy, setLastCreatedBy] = useState('all')
  const [lastTotalSalesMin, setLastTotalSalesMin] = useState('')
  const [lastTotalSalesMax, setLastTotalSalesMax] = useState('')
  const [lastTotalDebtMin, setLastTotalDebtMin] = useState('')
  const [lastTotalDebtMax, setLastTotalDebtMax] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(customerPageSize)
  const [form, setForm] = useState({
    code: '',
    name: '',
    phone: '',
    taxCode: '',
    address: '',
  })

  async function load(filters: CustomerListFilters & {
    customerGroupIdValue?: string
    createdFromValue?: string
    createdToValue?: string
    createdByValue?: string
    totalSalesMinValue?: string
    totalSalesMaxValue?: string
    totalDebtMinValue?: string
    totalDebtMaxValue?: string
  } = {}) {
    const nextSearch = filters.search ?? lastSearch
    const nextCustomerGroupId = filters.customerGroupIdValue ?? lastCustomerGroupId
    const nextCreatedFrom = filters.createdFromValue ?? lastCreatedFrom
    const nextCreatedTo = filters.createdToValue ?? lastCreatedTo
    const nextCreatedBy = filters.createdByValue ?? lastCreatedBy
    const nextTotalSalesMin = filters.totalSalesMinValue ?? lastTotalSalesMin
    const nextTotalSalesMax = filters.totalSalesMaxValue ?? lastTotalSalesMax
    const nextTotalDebtMin = filters.totalDebtMinValue ?? lastTotalDebtMin
    const nextTotalDebtMax = filters.totalDebtMaxValue ?? lastTotalDebtMax
    const nextPage = filters.page ?? page
    const nextPageSize = filters.page_size ?? pageSize
    setError(null)
    try {
      const totalSalesMinFilter = numberFilterValue(nextTotalSalesMin)
      const totalSalesMaxFilter = numberFilterValue(nextTotalSalesMax)
      const totalDebtMinFilter = numberFilterValue(nextTotalDebtMin)
      const totalDebtMaxFilter = numberFilterValue(nextTotalDebtMax)
      const result = await service.listCustomers({
        search: nextSearch || undefined,
        page: nextPage,
        page_size: nextPageSize,
        ...(nextCustomerGroupId === 'all' ? {} : { customer_group_id: nextCustomerGroupId }),
        ...(nextCreatedFrom === '' ? {} : { created_from: nextCreatedFrom }),
        ...(nextCreatedTo === '' ? {} : { created_to: nextCreatedTo }),
        ...(nextCreatedBy === 'all' ? {} : { created_by: nextCreatedBy }),
        ...(totalSalesMinFilter === undefined ? {} : { total_sales_min: totalSalesMinFilter }),
        ...(totalSalesMaxFilter === undefined ? {} : { total_sales_max: totalSalesMaxFilter }),
        ...(totalDebtMinFilter === undefined ? {} : { total_debt_min: totalDebtMinFilter }),
        ...(totalDebtMaxFilter === undefined ? {} : { total_debt_max: totalDebtMaxFilter }),
      })
      setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size })
      setLastSearch(nextSearch)
      setLastCustomerGroupId(nextCustomerGroupId)
      setLastCreatedFrom(nextCreatedFrom)
      setLastCreatedTo(nextCreatedTo)
      setLastCreatedBy(nextCreatedBy)
      setLastTotalSalesMin(nextTotalSalesMin)
      setLastTotalSalesMax(nextTotalSalesMax)
      setLastTotalDebtMin(nextTotalDebtMin)
      setLastTotalDebtMax(nextTotalDebtMax)
      setPage(result.page)
      setPageSize(result.page_size)
      setSelectedCustomerId(null)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được khách hàng.'))
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialCustomers() {
      setError(null)
      try {
        const result = await service.listCustomers({ page: 1, page_size: customerPageSize })
        if (!active) return
        setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size })
        setPage(result.page)
        setPageSize(result.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được khách hàng.'))
      }
    }

    void loadInitialCustomers()

    return () => {
      active = false
    }
  }, [service])

  useEffect(() => {
    let active = true

    service
      .listCustomerGroups()
      .then((result) => {
        if (active) setCustomerGroups(result.items)
      })
      .catch(() => {
        if (active) setCustomerGroups([])
      })

    return () => {
      active = false
    }
  }, [service])

  async function filterCustomers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = search.trim()
    setCustomerSearchSuggestionsOpen(false)
    setPage(1)
    await load({
      search: trimmed,
      customerGroupIdValue: customerGroupId,
      createdFromValue: createdFrom,
      createdToValue: createdTo,
      createdByValue: createdBy,
      totalSalesMinValue: totalSalesMin,
      totalSalesMaxValue: totalSalesMax,
      totalDebtMinValue: totalDebtMin,
      totalDebtMaxValue: totalDebtMax,
      page: 1,
    })
  }

  async function suggestCustomers(nextSearch: string) {
    setSearch(nextSearch)
    const query = nextSearch.trim()
    const requestId = customerSearchRequestId.current + 1
    customerSearchRequestId.current = requestId
    if (query.length === 0) {
      setCustomerSearchSuggestions([])
      setCustomerSearchSuggestionsOpen(false)
      return
    }
    try {
      const totalSalesMinFilter = numberFilterValue(totalSalesMin)
      const totalSalesMaxFilter = numberFilterValue(totalSalesMax)
      const totalDebtMinFilter = numberFilterValue(totalDebtMin)
      const totalDebtMaxFilter = numberFilterValue(totalDebtMax)
      const result = await service.listCustomers({
        search: query,
        page: 1,
        page_size: 8,
        ...(customerGroupId === 'all' ? {} : { customer_group_id: customerGroupId }),
        ...(createdFrom === '' ? {} : { created_from: createdFrom }),
        ...(createdTo === '' ? {} : { created_to: createdTo }),
        ...(createdBy === 'all' ? {} : { created_by: createdBy }),
        ...(totalSalesMinFilter === undefined ? {} : { total_sales_min: totalSalesMinFilter }),
        ...(totalSalesMaxFilter === undefined ? {} : { total_sales_max: totalSalesMaxFilter }),
        ...(totalDebtMinFilter === undefined ? {} : { total_debt_min: totalDebtMinFilter }),
        ...(totalDebtMaxFilter === undefined ? {} : { total_debt_max: totalDebtMaxFilter }),
      })
      if (customerSearchRequestId.current !== requestId) return
      setCustomerSearchSuggestions(result.items)
      setCustomerSearchSuggestionsOpen(true)
    } catch {
      if (customerSearchRequestId.current !== requestId) return
      setCustomerSearchSuggestions([])
      setCustomerSearchSuggestionsOpen(false)
    }
  }

  async function selectCustomerSuggestion(customer: Customer) {
    setSearch(customer.code)
    setCustomerSearchSuggestionsOpen(false)
    setPage(1)
    await load({
      search: customer.code,
      customerGroupIdValue: customerGroupId,
      createdFromValue: createdFrom,
      createdToValue: createdTo,
      createdByValue: createdBy,
      totalSalesMinValue: totalSalesMin,
      totalSalesMaxValue: totalSalesMax,
      totalDebtMinValue: totalDebtMin,
      totalDebtMaxValue: totalDebtMax,
      page: 1,
    })
  }

  async function applySidebarFilters(nextFilters: Partial<{
    customerGroupId: string
    createdFrom: string
    createdTo: string
    createdBy: string
    totalSalesMin: string
    totalSalesMax: string
    totalDebtMin: string
    totalDebtMax: string
  }>) {
    const nextCustomerGroupId = nextFilters.customerGroupId ?? customerGroupId
    const nextCreatedFrom = nextFilters.createdFrom ?? createdFrom
    const nextCreatedTo = nextFilters.createdTo ?? createdTo
    const nextCreatedBy = nextFilters.createdBy ?? createdBy
    const nextTotalSalesMin = nextFilters.totalSalesMin ?? totalSalesMin
    const nextTotalSalesMax = nextFilters.totalSalesMax ?? totalSalesMax
    const nextTotalDebtMin = nextFilters.totalDebtMin ?? totalDebtMin
    const nextTotalDebtMax = nextFilters.totalDebtMax ?? totalDebtMax
    setCustomerGroupId(nextCustomerGroupId)
    setCreatedFrom(nextCreatedFrom)
    setCreatedTo(nextCreatedTo)
    setCreatedBy(nextCreatedBy)
    setTotalSalesMin(nextTotalSalesMin)
    setTotalSalesMax(nextTotalSalesMax)
    setTotalDebtMin(nextTotalDebtMin)
    setTotalDebtMax(nextTotalDebtMax)
    setPage(1)
    await load({
      search: search.trim(),
      customerGroupIdValue: nextCustomerGroupId,
      createdFromValue: nextCreatedFrom,
      createdToValue: nextCreatedTo,
      createdByValue: nextCreatedBy,
      totalSalesMinValue: nextTotalSalesMin,
      totalSalesMaxValue: nextTotalSalesMax,
      totalDebtMinValue: nextTotalDebtMin,
      totalDebtMaxValue: nextTotalDebtMax,
      page: 1,
    })
  }

  async function goToPage(nextPage: number) {
    await load({ page: nextPage })
  }

  function toggleCustomerDetail(customer: Customer) {
    setSelectedCustomerId((current) => {
      const next = current === customer.id ? null : customer.id
      if (next !== null) {
        setActiveDetailTab('info')
        setCustomerHistoryType('invoice')
      }
      return next
    })
  }

  function loadCustomerDebt(customerId: string) {
    if (customerDebts[customerId] !== undefined || customerDebtRequestsRef.current.has(customerId)) return

    customerDebtRequestsRef.current.add(customerId)
    setCustomerDebts((debts) => ({ ...debts, [customerId]: 'loading' }))
    orderService
      .getCustomerDebt(customerId)
      .then((debt) => setCustomerDebts((debts) => ({ ...debts, [customerId]: debt })))
      .catch(() => setCustomerDebts((debts) => ({ ...debts, [customerId]: 'error' })))
      .finally(() => customerDebtRequestsRef.current.delete(customerId))
  }

  function loadCustomerHistory(customerId: string, historyType: CustomerHistoryType) {
    const key = customerHistoryKey(customerId, historyType)
    if (salesDocumentService === undefined || customerHistories[key] !== undefined || customerHistoryRequestsRef.current.has(key)) return

    customerHistoryRequestsRef.current.add(key)
    setCustomerHistories((histories) => ({ ...histories, [key]: 'loading' }))
    salesDocumentService
      .listSalesDocuments({ customer_id: customerId, type: historyType, page: 1, page_size: customerHistoryPageSize })
      .then((history) => setCustomerHistories((histories) => ({ ...histories, [key]: { items: history.items, total: history.total } })))
      .catch(() => setCustomerHistories((histories) => ({ ...histories, [key]: 'error' })))
      .finally(() => customerHistoryRequestsRef.current.delete(key))
  }

  function openCustomerHistory(customerId: string) {
    setActiveDetailTab('history')
    loadCustomerHistory(customerId, customerHistoryType)
  }

  function selectCustomerHistoryType(customerId: string, historyType: CustomerHistoryType) {
    setCustomerHistoryType(historyType)
    loadCustomerHistory(customerId, historyType)
  }

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await service.createCustomer({
        code: form.code.trim() || undefined,
        name: form.name,
        phone: form.phone.trim() || undefined,
        tax_code: form.taxCode.trim() || undefined,
        address: form.address.trim() || undefined,
        customer_group_id: null,
      })
      setForm({ code: '', name: '', phone: '', taxCode: '', address: '' })
      setCreateOpen(false)
      await load({ page })
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được khách hàng.'))
    } finally {
      setSaving(false)
    }
  }

  function openCreateCustomer() {
    setForm({ code: '', name: '', phone: '', taxCode: '', address: '' })
    setCreateOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil((state?.total ?? 0) / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = lastSearch
    ? `Tìm: ${lastSearch}`
    : lastCustomerGroupId === 'all' &&
        lastCreatedFrom === '' &&
        lastCreatedTo === '' &&
        lastCreatedBy === 'all' &&
        lastTotalSalesMin === '' &&
        lastTotalSalesMax === '' &&
        lastTotalDebtMin === '' &&
        lastTotalDebtMax === ''
      ? 'Đang hoạt động'
      : 'Bộ lọc khách hàng'
  const creatorOptions = Array.from(
    new Map(
      (state?.customers ?? [])
        .map((customer) => customer.created_by)
        .filter((creator): creator is { id: string; name: string } => creator !== null && creator !== undefined)
        .map((creator) => [creator.id, creator]),
    ).values(),
  )
  const visibleDebtTotal = state?.customers.reduce((sum, customer) => {
    return sum + (customer.total_debt_amount ?? 0)
  }, 0) ?? 0
  const visibleSalesTotal = state?.customers.reduce((sum, customer) => sum + (customer.total_sales_amount ?? 0), 0) ?? 0
  const customerKpis = (
    <MetricGrid ariaLabel="Tổng quan khách hàng">
      <MetricCard hint="Từ danh sách đang xem" label="Nợ hiện tại" tone={visibleDebtTotal > 0 ? 'warning' : 'neutral'} value={<MoneyText value={visibleDebtTotal} />} />
      <MetricCard hint="Từ danh sách đang xem" label="Tổng bán" tone="success" value={<MoneyText value={visibleSalesTotal} />} />
    </MetricGrid>
  )

  return (
    <ManagementPage
      title="Khách hàng"
      actions={
        <ManagementCompactToolbar ariaLabel="Lọc khách hàng" onSubmit={filterCustomers}>
          <ManagementCompactSearch
            label="Tìm khách hàng"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Tìm mã, tên, số điện thoại"
            trailingAction={
              <ManagementCompactCreateAction ariaLabel="Tạo khách hàng" onClick={openCreateCustomer} />
            }
            value={search}
            suggestions={
              customerSearchSuggestionsOpen
                ? customerSearchSuggestions.map((customer) => ({
                    id: customer.id,
                    primary: `${customer.code} ${customer.name}`,
                    secondary: customer.phone ?? 'Chưa có số điện thoại',
                    meta: customer.total_debt_amount === undefined ? undefined : <MoneyText value={customer.total_debt_amount} />,
                    ariaLabel: `${customer.code} ${customer.name} ${customer.phone ?? ''}`.trim(),
                  }))
                : undefined
            }
            suggestionsLabel="Gợi ý khách hàng"
            emptySuggestion="Không có kết quả phù hợp"
            onChange={(nextSearch) => void suggestCustomers(nextSearch)}
            onSuggestionSelect={(suggestion) => {
              const customer = customerSearchSuggestions.find((candidate) => candidate.id === suggestion.id)
              if (customer) void selectCustomerSuggestion(customer)
            }}
          />
        </ManagementCompactToolbar>
      }
      kpis={customerKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary}
          ariaLabel="Bộ lọc khách hàng"
          title="Bộ lọc"
        >
          <button
            aria-label="Ẩn bộ lọc khách hàng"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <ManagementFilterGroup title="Nhóm khách hàng">
            <label>
              <span className="sr-only">Nhóm khách hàng</span>
              <select
                aria-label="Nhóm khách hàng"
                className="management-filter-select"
                value={customerGroupId}
                onChange={(event) => void applySidebarFilters({ customerGroupId: event.target.value })}
              >
                <option value="all">Tất cả</option>
                {customerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Ngày tạo">
            <div className="management-filter-date-range">
              <label>
                <span>Từ</span>
                <input
                  aria-label="Ngày tạo từ"
                  type="date"
                  value={createdFrom}
                  onChange={(event) => void applySidebarFilters({ createdFrom: event.target.value })}
                />
              </label>
              <label>
                <span>Tới</span>
                <input
                  aria-label="Ngày tạo tới"
                  type="date"
                  value={createdTo}
                  onChange={(event) => void applySidebarFilters({ createdTo: event.target.value })}
                />
              </label>
            </div>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Người tạo">
            <label>
              <span className="sr-only">Người tạo</span>
              <select
                aria-label="Người tạo"
                className="management-filter-select"
                value={createdBy}
                onChange={(event) => void applySidebarFilters({ createdBy: event.target.value })}
              >
                <option value="all">Tất cả</option>
                {creatorOptions.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.name}
                  </option>
                ))}
              </select>
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Tổng bán">
            <label>
              <span className="sr-only">Tổng bán từ</span>
              <input
                aria-label="Tổng bán từ"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Từ"
                type="number"
                value={totalSalesMin}
                onChange={(event) => void applySidebarFilters({ totalSalesMin: event.target.value })}
              />
            </label>
            <label>
              <span className="sr-only">Tổng bán tới</span>
              <input
                aria-label="Tổng bán tới"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Tới"
                type="number"
                value={totalSalesMax}
                onChange={(event) => void applySidebarFilters({ totalSalesMax: event.target.value })}
              />
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Nợ hiện tại">
            <label>
              <span className="sr-only">Nợ hiện tại từ</span>
              <input
                aria-label="Nợ hiện tại từ"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Từ"
                type="number"
                value={totalDebtMin}
                onChange={(event) => void applySidebarFilters({ totalDebtMin: event.target.value })}
              />
            </label>
            <label>
              <span className="sr-only">Nợ hiện tại tới</span>
              <input
                aria-label="Nợ hiện tại tới"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Tới"
                type="number"
                value={totalDebtMax}
                onChange={(event) => void applySidebarFilters({ totalDebtMax: event.target.value })}
              />
            </label>
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc khách hàng"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      {createOpen ? (
        <div className="management-modal-backdrop">
          <section aria-label="Tạo khách hàng" aria-modal="true" className="management-modal-dialog" role="dialog">
            <header className="management-modal-header">
              <div>
                <h2>Tạo khách hàng</h2>
                <p>Mã khách hàng sẽ tự sinh nếu để trống.</p>
              </div>
              <button className="management-icon-button" type="button" aria-label="Đóng tạo khách hàng" onClick={() => setCreateOpen(false)}>
                ×
              </button>
            </header>

            <form id="customer-create-form" aria-label="Tạo khách hàng" className="customer-create-form" onSubmit={createCustomer}>
              <fieldset>
                <legend>Thông tin chính</legend>
                <div className="form-grid form-grid-two">
                  <label>
                    Tên khách hàng
                    <input
                      autoFocus
                      required
                      placeholder="Bắt buộc"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Mã khách hàng
                    <input
                      placeholder="Bỏ trống để tự sinh"
                      value={form.code}
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    />
                  </label>
                  <label>
                    Điện thoại
                    <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                  </label>
                  <label>
                    MST
                    <input value={form.taxCode} onChange={(event) => setForm((current) => ({ ...current, taxCode: event.target.value }))} />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Địa chỉ</legend>
                <label>
                  Địa chỉ
                  <input
                    placeholder="Nhập một dòng địa chỉ"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  />
                </label>
              </fieldset>

              {error ? <p role="alert">{error}</p> : null}
            </form>

            <footer className="management-modal-footer">
              <button className="button button-secondary" type="button" onClick={() => setCreateOpen(false)}>
                Bỏ qua
              </button>
              <button className="button button-primary" disabled={saving} type="submit" form="customer-create-form">
                Lưu
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <ManagementListSurface ariaLabel="Danh sách khách hàng">
        {error ? <p role="alert">{error}</p> : null}
        {state === null && error === null ? <p>Đang tải khách hàng...</p> : null}

        {state ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Danh sách khách hàng" className="customer-management-table">
                <thead>
                  <tr>
                    <th>Mã KH</th>
                    <th>Tên khách hàng</th>
                    <th>Điện thoại</th>
                    <th>Nhóm khách hàng</th>
                    <th>Nợ hiện tại</th>
                    <th>Tổng bán</th>
                </tr>
              </thead>
              <tbody>
                {state.customers.map((customer) => {
                  const debt = customerDebts[customer.id]
                  const history = customerHistories[customerHistoryKey(customer.id, customerHistoryType)]
                  const debtAmount = customer.total_debt_amount ?? null
                  return (
                    <Fragment key={customer.id}>
                    <tr
                      aria-expanded={selectedCustomerId === customer.id}
                      className={`management-data-row${selectedCustomerId === customer.id ? ' management-data-row-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => toggleCustomerDetail(customer)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleCustomerDetail(customer)
                        }
                      }}
                    >
                      <td>
                        <button
                          className="management-link-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleCustomerDetail(customer)
                          }}
                        >
                          <strong>{customer.code}</strong>
                        </button>
                      </td>
                      <td>{customer.name}</td>
                      <td>{customer.phone ?? '-'}</td>
                      <td>{customer.customer_group?.name ?? '-'}</td>
                      <td>{debtAmount === null ? '-' : <MoneyText value={debtAmount} />}</td>
                      <td>{customer.total_sales_amount === undefined ? '-' : <MoneyText value={customer.total_sales_amount} />}</td>
                    </tr>
                    {selectedCustomerId === customer.id ? (
                      <ManagementDetailRow
                        colSpan={6}
                        detailClassName="customer-inline-detail"
                        label={`Chi tiết khách hàng ${customer.code}`}
                        rowClassName="management-detail-row-selected"
                      >
                            <div className="inline-detail-tabbar">
                              <div aria-label="Chi tiết khách hàng" className="inline-detail-tabs" role="tablist">
                                <button
                                  aria-selected={activeDetailTab === 'info'}
                                  role="tab"
                                  type="button"
                                  onClick={() => setActiveDetailTab('info')}
                                >
                                  Thông tin
                                </button>
                                <button
                                  aria-selected={activeDetailTab === 'debt'}
                                  role="tab"
                                  type="button"
                                  onClick={() => {
                                    setActiveDetailTab('debt')
                                    loadCustomerDebt(customer.id)
                                  }}
                                >
                                  Nợ cần thu
                                </button>
                                <button
                                  aria-selected={activeDetailTab === 'history'}
                                  role="tab"
                                  type="button"
                                  onClick={() => openCustomerHistory(customer.id)}
                                >
                                  Lịch sử
                                </button>
                              </div>
                              <button
                                aria-label="Xem phân tích"
                                className="management-icon-button"
                                title="Xem phân tích"
                                type="button"
                                onClick={() => setAnalysisCustomer(customer)}
                              >
                                <BarChart3 aria-hidden="true" size={17} />
                              </button>
                            </div>
                            {activeDetailTab === 'info' ? (
                              <section aria-label="Thông tin khách hàng" className="customer-detail-tab-panel" role="tabpanel">
                                <dl>
                                  <div>
                                    <dt>MST</dt>
                                    <dd>{customer.tax_code ?? 'Chưa có MST'}</dd>
                                  </div>
                                  <div>
                                    <dt>Địa chỉ</dt>
                                    <dd>{customer.address ?? 'Chưa có địa chỉ'}</dd>
                                  </div>
                                  <div>
                                    <dt>Nhóm khách</dt>
                                    <dd>{customer.customer_group?.name ?? 'Chưa có nhóm'}</dd>
                                  </div>
                                  <div>
                                    <dt>Bảng giá áp dụng</dt>
                                    <dd>{priceRuleLabel(customer)}</dd>
                                  </div>
                                  <div>
                                    <dt>Người tạo</dt>
                                    <dd>{customer.created_by?.name || 'Chưa có dữ liệu'}</dd>
                                  </div>
                                  <div>
                                    <dt>Ngày tạo</dt>
                                    <dd>{dateTime(customer.created_at)}</dd>
                                  </div>
                                </dl>
                              </section>
                            ) : activeDetailTab === 'debt' ? (
                              <section aria-label="Nợ cần thu khách hàng" className="customer-detail-tab-panel" role="tabpanel">
                                <CustomerDebtPanel debt={debt} />
                              </section>
                            ) : (
                              <section aria-label="Lịch sử khách hàng" className="customer-detail-tab-panel" role="tabpanel">
                                <CustomerHistoryPanel
                                  history={history}
                                  historyType={customerHistoryType}
                                  onSelectHistoryType={(historyType) => selectCustomerHistoryType(customer.id, historyType)}
                                />
                              </section>
                            )}
                      </ManagementDetailRow>
                    ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang khách hàng"
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              entityLabel="khách hàng"
              page={page}
              pageSize={pageSize}
              total={state.total}
              onFirst={() => void goToPage(1)}
              onLast={() => void goToPage(totalPages)}
              onNext={() => void goToPage(page + 1)}
              onPageSizeChange={(nextPageSize) => void load({ page: 1, page_size: nextPageSize })}
              onPrevious={() => void goToPage(page - 1)}
            />
          </>
        ) : null}
      </ManagementListSurface>
      {analysisCustomer ? (
        <CustomerAnalysisDialog customer={analysisCustomer} onClose={() => setAnalysisCustomer(null)} />
      ) : null}
    </ManagementPage>
  )
}

function priceRuleLabel(customer: Customer) {
  return customer.customer_group === null ? 'Bảng giá chung' : `Theo nhóm: ${customer.customer_group.name}`
}

function CustomerDebtPanel({ debt }: { debt: CustomerDebtState | undefined }) {
  if (debt === undefined || debt === 'loading') return <p>Đang tải nợ cần thu...</p>
  if (debt === 'error') return <p role="alert">Không tải được nợ cần thu.</p>

  return (
    <section aria-label="Nợ cần thu" className="customer-debt-panel">
      <dl>
        <div>
          <dt>Tổng nợ</dt>
          <dd><MoneyText value={debt.total_debt} /></dd>
        </div>
        <div>
          <dt>Hóa đơn mở</dt>
          <dd>{debt.invoices.length} hóa đơn mở</dd>
        </div>
      </dl>
      {debt.invoices.length > 0 ? (
        <table aria-label="Hóa đơn còn nợ">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Thời gian</th>
              <th>Tổng tiền</th>
              <th>Đã trả</th>
              <th>Còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {debt.invoices.map((invoice) => (
              <tr key={invoice.order_id}>
                <td>{invoice.order_code}</td>
                <td>{dateTime(invoice.created_at)}</td>
                <td><MoneyText value={invoice.total_amount} /></td>
                <td><MoneyText value={invoice.paid_amount} /></td>
                <td><MoneyText value={invoice.remaining_debt} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}

function CustomerHistoryPanel({
  history,
  historyType,
  onSelectHistoryType,
}: {
  history: CustomerHistoryState | undefined
  historyType: CustomerHistoryType
  onSelectHistoryType: (historyType: CustomerHistoryType) => void
}) {
  const codeHeader = historyType === 'invoice' ? 'Mã hóa đơn' : 'Mã báo giá'

  return (
    <section aria-label="Lịch sử bán hàng" className="customer-history-panel">
      <div aria-label="Loại lịch sử" className="customer-history-type-toggle">
        <button aria-pressed={historyType === 'invoice'} type="button" onClick={() => onSelectHistoryType('invoice')}>
          Hóa đơn
        </button>
        <button aria-pressed={historyType === 'quote'} type="button" onClick={() => onSelectHistoryType('quote')}>
          Báo giá
        </button>
      </div>
      {history === undefined || history === 'loading' ? <p>Đang tải lịch sử...</p> : null}
      {history === 'error' ? <p role="alert">Không tải được lịch sử khách hàng.</p> : null}
      {typeof history === 'object' && history.items.length === 0 ? <p>Chưa có giao dịch bán hàng.</p> : null}
      {typeof history === 'object' && history.items.length > 0 ? (
      <table aria-label="Lịch sử chứng từ khách hàng" className="customer-history-table">
        <thead>
          <tr>
            <th>{codeHeader}</th>
            <th>Thời gian</th>
            <th>Người bán</th>
            <th>Tổng cộng</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {history.items.map((document) => (
            <tr key={document.id}>
              <td>{document.code}</td>
              <td>{dateTime(document.created_at)}</td>
              <td>{document.seller.name || '-'}</td>
              <td><MoneyText value={document.total_amount} /></td>
              <td>{salesDocumentStatusText(document)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      ) : null}
    </section>
  )
}

function CustomerAnalysisDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <div className="management-modal-backdrop">
      <section aria-label={`Phân tích khách hàng ${customer.code}`} aria-modal="true" className="management-modal-dialog management-modal-dialog-compact customer-analysis-dialog" role="dialog">
        <header className="management-modal-header">
          <div>
            <h2>Phân tích khách hàng</h2>
            <p>{customer.code} - {customer.name}</p>
          </div>
          <button aria-label="Đóng phân tích khách hàng" className="management-icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <label>
          Khoảng thời gian
          <select defaultValue="all">
            <option value="all">Toàn thời gian</option>
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm nay</option>
          </select>
        </label>
        <div className="customer-analysis-grid">
          <article>
            <span>Doanh thu</span>
            <strong>-</strong>
          </article>
          <article>
            <span>Số chứng từ</span>
            <strong>-</strong>
          </article>
          <article>
            <span>Tần suất</span>
            <strong>-</strong>
          </article>
        </div>
      </section>
    </div>
  )
}

function salesDocumentStatusText(document: SalesDocumentListItem) {
  if (document.order_type === 'invoice') {
    if (document.status === 'cancelled') return 'Đã hủy'
    if (document.payment_status === 'partial') return 'Nợ 1 phần'
    if (document.payment_status === 'unpaid' || document.debt_amount > 0) return 'Nợ'
    return 'Hoàn tất'
  }

  if (document.status === 'active') return 'Đang hiệu lực'
  if (document.status === 'converted') return 'Đã chuyển'
  return 'Đã hủy'
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Chưa có dữ liệu'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Chưa có dữ liệu'

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed)
}
