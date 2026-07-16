import { useEffect, useRef, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Edit3, Lock, Network, Search, StickyNote, Trash2 } from 'lucide-react'
import { MetricCard, MetricGrid, MoneyText } from '../../components/ui-shell/primitives'
import { formatApiError } from '../../lib/api/error-message'
import { dateRangeFromItems, displayDateRangeForData, quickDateRange, toDisplayDateInput, type QuickDateRangePreset } from '../../lib/date-ranges'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDateRangeInputs,
  ManagementDataTable,
  ManagementDetailActionFooter,
  ManagementDetailCard,
  ManagementDetailInfoList,
  ManagementDetailInlineNote,
  ManagementDetailPanel,
  ManagementDetailSection,
  ManagementDetailSummary,
  ManagementFilterGroup,
  ManagementFilterNumberRange,
  ManagementFilterSidebar,
  ManagementFilterSelectField,
  ManagementImportButton,
  ManagementInlineDetailTabs,
  ManagementListSurface,
  ManagementPage,
  ManagementTableCheckboxControl,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { formatPhoneDisplay } from '../../lib/phone-format'
import type { CatalogService, CustomerListFilters } from './catalog-service'
import type { Customer, CustomerGroup } from './types'
import type { CustomerDebtDetail, OrderService } from '../orders/order-service'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'
import { buildCustomerListFilters, customerHistoryKey, type CustomerHistoryType } from './customer-filters'
import {
  customerDate,
  customerDateTime as dateTime,
  customerSalesDocumentStatusText as salesDocumentStatusText,
  customerVisibleSummary,
} from './customer-presenter'
import { CustomerImportDialog } from './CustomerImportDialog'

interface CustomerState {
  customers: Customer[]
  total: number
  page: number
  pageSize: number
  summary?: {
    total_debt_amount: number
    total_sales_amount: number
  }
}

type CustomerDebtState = CustomerDebtDetail | 'loading' | 'error'
type CustomerHistoryState = { items: SalesDocumentListItem[]; total: number } | 'loading' | 'error'
type CustomerDetailTab = 'info' | 'debt' | 'history'
type CustomerSortKey = 'code' | 'name' | 'phone' | 'group' | 'total_debt_amount' | 'total_sales_amount'
const customerHistoryPageSize = 10
type CustomerCreatedDateFilter = QuickDateRangePreset | 'custom'
const customerCreatedDateGroups: Array<{ title: string; presets: Array<Exclude<CustomerCreatedDateFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]
const customerCreatedDateLabels: Record<CustomerCreatedDateFilter, string> = {
  all: 'Toàn thời gian',
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  week: 'Tuần này',
  last_week: 'Tuần trước',
  last_7_days: '7 ngày qua',
  month: 'Tháng này',
  last_month: 'Tháng trước',
  last_30_days: '30 ngày qua',
  quarter: 'Quý này',
  last_quarter: 'Quý trước',
  year: 'Năm nay',
  last_year: 'Năm trước',
  custom: 'Tùy chỉnh',
}

function customerCreatorLabel(customer: Customer) {
  if (customer.created_by?.name) return customer.created_by.name
  return customer.source_creator_name?.trim() ? 'Chưa khớp tài khoản' : 'Chưa có dữ liệu'
}

function customerTypeLabel(customer: Customer) {
  switch (customer.customer_type) {
    case 'individual':
      return 'Cá nhân'
    case 'company':
      return 'Công ty'
    case 'other':
      return 'Khác'
    default:
      return 'Chưa có dữ liệu'
  }
}

function customerGroupLabel(customer: Customer) {
  return customer.customer_group?.name?.trim() || 'Chưa có'
}

function CustomerSupplierLinkIcon() {
  return (
    <span aria-label="Có liên kết nhà cung cấp" className="management-linked-partner-icon" title="Có liên kết nhà cung cấp">
      <Network aria-hidden="true" size={16} />
    </span>
  )
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
  const [customerImportOpen, setCustomerImportOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<CustomerDetailTab>('info')
  const [customerHistoryType, setCustomerHistoryType] = useState<CustomerHistoryType>('invoice')
  const [customerDebts, setCustomerDebts] = useState<Record<string, CustomerDebtState>>({})
  const [customerHistories, setCustomerHistories] = useState<Record<string, CustomerHistoryState>>({})
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [analysisCustomer, setAnalysisCustomer] = useState<Customer | null>(null)
  const customerDebtRequestsRef = useRef(new Set<string>())
  const customerHistoryRequestsRef = useRef(new Set<string>())
  const [showFilters, setShowFilters] = useState(true)
  const [search, setSearch] = useState('')
  const [lastSearch, setLastSearch] = useState('')
  const [customerGroupId, setCustomerGroupId] = useState('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [createdDateFilter, setCreatedDateFilter] = useState<CustomerCreatedDateFilter>('all')
  const [createdQuickTimeOpen, setCreatedQuickTimeOpen] = useState(false)
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
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
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
      const result = await service.listCustomers(buildCustomerListFilters({
        search: nextSearch,
        page: nextPage,
        page_size: nextPageSize,
        customerGroupId: nextCustomerGroupId,
        createdFrom: nextCreatedFrom,
        createdTo: nextCreatedTo,
        createdBy: nextCreatedBy,
        totalSalesMin: nextTotalSalesMin,
        totalSalesMax: nextTotalSalesMax,
        totalDebtMin: nextTotalDebtMin,
        totalDebtMax: nextTotalDebtMax,
      }))
      setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
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
        const result = await service.listCustomers({ page: 1, page_size: defaultPageSize })
        if (!active) return
        setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
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
  }, [defaultPageSize, service])

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
    preventManagementSearchSubmit(event, () => applyCustomerSearch(search))
  }

  function applyCustomerSearch(nextSearch: string) {
    setPage(1)
    return load({
      search: nextSearch,
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

  function changeCustomerSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch,
      resetSelection: () => setSelectedCustomerId(null),
      load: applyCustomerSearch,
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

  async function applyCustomerQuickDateFilter(nextFilter: Exclude<CustomerCreatedDateFilter, 'custom'>) {
    const range = quickDateRange(nextFilter)
    setCreatedDateFilter(nextFilter)
    setCreatedQuickTimeOpen(false)
    setCreatedFrom(range.from)
    setCreatedTo(range.to)
    await load({
      createdFromValue: range.from,
      createdToValue: range.to,
      page: 1,
    })
  }

  async function applyCustomerCustomDateFilter(nextFilters: Partial<{ from: string; to: string }> = {}) {
    const nextFrom = nextFilters.from ?? createdFrom
    const nextTo = nextFilters.to ?? createdTo
    setCreatedDateFilter('custom')
    setCreatedFrom(nextFrom)
    setCreatedTo(nextTo)
    await load({
      createdFromValue: nextFrom,
      createdToValue: nextTo,
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

  function loadCustomerDebt(customerId: string, options: { force?: boolean } = {}) {
    if (!options.force && customerDebts[customerId] !== undefined) return
    if (customerDebtRequestsRef.current.has(customerId)) return

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

  function openCustomerDebt(customerId: string) {
    loadCustomerDebt(customerId, { force: true })
    loadCustomerHistory(customerId, 'invoice')
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
  const activeFilterSummary = lastCustomerGroupId === 'all' &&
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
  const fallbackCustomerSummary = customerVisibleSummary(state?.customers ?? [])
  const visibleDebtTotal = state?.summary?.total_debt_amount ?? fallbackCustomerSummary.visibleDebtTotal
  const visibleSalesTotal = state?.summary?.total_sales_amount ?? fallbackCustomerSummary.visibleSalesTotal
  const customerVisibleDateRange = createdDateFilter === 'custom'
    ? { from: createdFrom, to: createdTo }
    : displayDateRangeForData(
        { from: createdFrom, to: createdTo },
        dateRangeFromItems(state?.customers ?? [], (customer) => customer.created_at),
      )
  const {
    sortedItems: sortedCustomers,
    sortState: customerSortState,
    requestSort: requestCustomerSort,
  } = useManagementTableSort<Customer, CustomerSortKey>(state?.customers ?? [], {
    code: { kind: 'text', value: (customer) => customer.code },
    name: { kind: 'text', value: (customer) => customer.name },
    phone: { kind: 'text', value: (customer) => customer.phone },
    group: { kind: 'text', value: (customer) => customer.customer_group?.name },
    total_debt_amount: { kind: 'number', value: (customer) => customer.total_debt_amount },
    total_sales_amount: { kind: 'number', value: (customer) => customer.total_sales_amount },
  })
  const customerKpis = (
    <MetricGrid ariaLabel="Tổng quan khách hàng">
      <MetricCard hint="Theo bộ lọc hiện tại" label="Công nợ" tone={visibleDebtTotal > 0 ? 'warning' : 'neutral'} value={<MoneyText value={visibleDebtTotal} />} />
      <MetricCard hint="Theo bộ lọc hiện tại" label="Tổng bán" tone="success" value={<MoneyText value={visibleSalesTotal} />} />
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
            onChange={changeCustomerSearch}
          />
          <ManagementImportButton onClick={() => setCustomerImportOpen(true)}>Import</ManagementImportButton>
        </ManagementCompactToolbar>
      }
      kpis={customerKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary}
          ariaLabel="Bộ lọc khách hàng"
          onPopoverClose={() => setCreatedQuickTimeOpen(false)}
          popoverOpen={createdQuickTimeOpen}
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
          <ManagementFilterGroup title="Nhóm khách">
            <ManagementFilterSelectField
              label="Nhóm khách"
              value={customerGroupId}
              onChange={(value) => void applySidebarFilters({ customerGroupId: value })}
            >
              <option value="all">Tất cả</option>
              {customerGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </ManagementFilterSelectField>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Ngày tạo">
            <div className="management-filter-time-options">
              <button
                aria-expanded={createdQuickTimeOpen}
                className="management-filter-choice management-filter-time-trigger"
                type="button"
                onClick={() => setCreatedQuickTimeOpen((current) => !current)}
              >
                <span>{createdDateFilter === 'custom' ? `${toDisplayDateInput(createdFrom)} - ${toDisplayDateInput(createdTo)}` : customerCreatedDateLabels[createdDateFilter]}</span>
                <span className="management-filter-choice-trailing">
                  <ChevronRight aria-hidden="true" size={17} />
                </span>
              </button>
            </div>
            {createdQuickTimeOpen ? (
              <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                {customerCreatedDateGroups.map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    <div>
                      {group.presets.map((preset) => (
                        <button
                          className={createdDateFilter === preset ? 'management-filter-quick-time-active' : undefined}
                          key={preset}
                          type="button"
                          onClick={() => void applyCustomerQuickDateFilter(preset)}
                        >
                          {customerCreatedDateLabels[preset]}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
            <ManagementDateRangeInputs
              displayFrom={customerVisibleDateRange.from}
              displayTo={customerVisibleDateRange.to}
              from={createdFrom}
              to={createdTo}
              onCalendarOpen={() => setCreatedQuickTimeOpen(false)}
              onFromChange={(value) => void applyCustomerCustomDateFilter({ from: value })}
              onToChange={(value) => void applyCustomerCustomDateFilter({ to: value })}
            />
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Người tạo">
            <ManagementFilterSelectField
              label="Người tạo"
              value={createdBy}
              onChange={(value) => void applySidebarFilters({ createdBy: value })}
            >
              <option value="all">Tất cả</option>
              {creatorOptions.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </ManagementFilterSelectField>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Tổng bán">
            <ManagementFilterNumberRange
              fromLabel="Tổng bán từ"
              fromValue={totalSalesMin}
              toLabel="Tổng bán tới"
              toValue={totalSalesMax}
              onFromChange={(value) => void applySidebarFilters({ totalSalesMin: value })}
              onToChange={(value) => void applySidebarFilters({ totalSalesMax: value })}
            />
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Công nợ">
            <ManagementFilterNumberRange
              fromLabel="Công nợ từ"
              fromValue={totalDebtMin}
              toLabel="Công nợ tới"
              toValue={totalDebtMax}
              onFromChange={(value) => void applySidebarFilters({ totalDebtMin: value })}
              onToChange={(value) => void applySidebarFilters({ totalDebtMax: value })}
            />
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
              <ManagementDataTable
                ariaLabel="Danh sách khách hàng"
                columns={[
                  {
                    key: 'select',
                    className: 'finance-cashbook-select-column',
                    header: <ManagementTableCheckboxControl ariaLabel="Chọn tất cả dòng khách hàng" />,
                    cell: (customer) => (
                      <ManagementTableCheckboxControl
                        ariaLabel={`Chọn dòng ${customer.code}`}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ),
                  },
                  {
                    key: 'code',
                    header: <ManagementSortableHeader kind="text" sortKey="code" sortState={customerSortState} onSort={requestCustomerSort}>Mã KH</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => (
                      <button
                        aria-label={customer.code}
                        className="management-link-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleCustomerDetail(customer)
                        }}
                      >
                        {customer.linked_supplier ? <CustomerSupplierLinkIcon /> : null}
                        <strong>{customer.code}</strong>
                      </button>
                    ),
                  },
                  {
                    key: 'name',
                    header: <ManagementSortableHeader kind="text" sortKey="name" sortState={customerSortState} onSort={requestCustomerSort}>Tên khách hàng</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.name,
                  },
                  {
                    key: 'phone',
                    header: <ManagementSortableHeader kind="text" sortKey="phone" sortState={customerSortState} onSort={requestCustomerSort}>Điện thoại</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => formatPhoneDisplay(customer.phone),
                  },
                  {
                    key: 'group',
                    header: <ManagementSortableHeader kind="text" sortKey="group" sortState={customerSortState} onSort={requestCustomerSort}>Nhóm khách</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.customer_group?.name ?? '-',
                  },
                  {
                    key: 'debt',
                    header: <ManagementSortableHeader kind="number" sortKey="total_debt_amount" sortState={customerSortState} onSort={requestCustomerSort}>Công nợ</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.total_debt_amount === undefined || customer.total_debt_amount === null ? '-' : <MoneyText value={customer.total_debt_amount} />,
                  },
                  {
                    key: 'sales',
                    header: <ManagementSortableHeader kind="number" sortKey="total_sales_amount" sortState={customerSortState} onSort={requestCustomerSort}>Tổng bán</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.total_sales_amount === undefined ? '-' : <MoneyText value={customer.total_sales_amount} />,
                  },
                ]}
                getDetailLabel={(customer) => `Chi tiết khách hàng ${customer.code}`}
                getRowKey={(customer) => customer.id}
                items={sortedCustomers}
                selectedRowKey={selectedCustomerId}
                renderDetail={(customer) => {
                  const debt = customerDebts[customer.id]
                  const history = customerHistories[customerHistoryKey(customer.id, customerHistoryType)]
                  return (
                    <ManagementDetailPanel>
                      <ManagementInlineDetailTabs
                        activeKey={activeDetailTab}
                        ariaLabel="Chi tiết khách hàng"
                        endAction={(
                          <button
                            aria-label="Xem phân tích"
                            className="management-icon-button"
                            title="Xem phân tích"
                            type="button"
                            onClick={() => setAnalysisCustomer(customer)}
                          >
                            <BarChart3 aria-hidden="true" size={17} />
                          </button>
                        )}
                        tabs={[
                          { key: 'info', label: 'Thông tin' },
                          {
                            key: 'debt',
                            label: 'Nợ cần thu',
                            onSelect: () => openCustomerDebt(customer.id),
                          },
                          {
                            key: 'history',
                            label: 'Lịch sử',
                            onSelect: () => openCustomerHistory(customer.id),
                          },
                        ]}
                        onSelect={(key) => setActiveDetailTab(key as CustomerDetailTab)}
                      />
                      <ManagementDetailSummary
                        ariaLabel={`Tóm tắt khách hàng ${customer.code}`}
                        code={customer.code}
                        metaAriaLabel="Thông tin tạo khách hàng"
                        metaItems={[
                          { label: 'Người tạo:', value: customerCreatorLabel(customer) },
                          { label: 'Ngày tạo:', value: customerDate(customer.created_at) },
                          { label: 'Nhóm khách:', value: customerGroupLabel(customer) },
                        ]}
                        title={customer.name}
                      />
                      {activeDetailTab === 'info' ? (
                        <ManagementDetailSection ariaLabel="Thông tin khách hàng" role="tabpanel">
                          <ManagementDetailInfoList
                            columns="four"
                            items={[
                              { label: 'Loại khách', value: customerTypeLabel(customer) },
                              { label: 'Điện thoại', value: formatPhoneDisplay(customer.phone, 'Chưa có') },
                              { label: 'MST', value: customer.tax_code ?? 'Chưa có MST' },
                              { label: 'Địa chỉ', value: customer.address ?? 'Chưa có địa chỉ' },
                            ]}
                          />
                          {customer.linked_supplier ? (
                            <ManagementDetailCard
                              ariaLabel="Khách hàng đồng thời là Nhà cung cấp"
                              title="Khách hàng đồng thời là Nhà cung cấp"
                            >
                              <p>
                                <span className="management-detail-meta-label">Nhà cung cấp:</span>{' '}
                                <strong>{customer.linked_supplier.name}</strong>
                              </p>
                              <p>
                                Khách hàng {customer.code} - {customer.name} đã được gộp với NCC {customer.linked_supplier.code} - {customer.linked_supplier.name}
                                {customer.linked_supplier.linked_at ? ` vào ngày ${dateTime(customer.linked_supplier.linked_at)}` : ''}
                              </p>
                            </ManagementDetailCard>
                          ) : null}
                          <ManagementDetailInlineNote icon={<StickyNote aria-hidden="true" size={16} />}>
                            {customer.note?.trim() ? customer.note : 'Chưa có ghi chú'}
                          </ManagementDetailInlineNote>
                        </ManagementDetailSection>
                      ) : activeDetailTab === 'debt' ? (
                        <ManagementDetailSection ariaLabel="Nợ cần thu khách hàng" role="tabpanel">
                          <CustomerDebtPanel debt={debt} invoiceHistory={customerHistories[customerHistoryKey(customer.id, 'invoice')]} />
                        </ManagementDetailSection>
                      ) : (
                        <ManagementDetailSection ariaLabel="Lịch sử khách hàng" role="tabpanel">
                          <CustomerHistoryPanel
                            history={history}
                            historyType={customerHistoryType}
                            onSelectHistoryType={(historyType) => selectCustomerHistoryType(customer.id, historyType)}
                          />
                        </ManagementDetailSection>
                      )}
                      <ManagementDetailActionFooter
                        leftActions={[
                          {
                            label: 'Xóa',
                            danger: true,
                            disabled: true,
                            icon: <Trash2 aria-hidden="true" size={15} />,
                          },
                        ]}
                        rightActions={[
                          {
                            label: 'Chỉnh sửa',
                            disabled: true,
                            variant: 'primary',
                            icon: <Edit3 aria-hidden="true" size={15} />,
                          },
                          {
                            label: customer.status === 'inactive' ? 'Kích hoạt' : 'Ngừng hoạt động',
                            disabled: true,
                            icon: <Lock aria-hidden="true" size={15} />,
                          },
                        ]}
                      />
                    </ManagementDetailPanel>
                  )
                }}
                onRowClick={toggleCustomerDetail}
                onRowKeyDown={(customer, event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleCustomerDetail(customer)
                  }
                }}
              />
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
      <CustomerImportDialog
        open={customerImportOpen}
        service={service}
        onClose={() => setCustomerImportOpen(false)}
        onImported={() => {
          setCustomerImportOpen(false)
          void load({ page: 1 })
        }}
      />
    </ManagementPage>
  )
}


function CustomerDebtPanel({
  debt,
  invoiceHistory,
}: {
  debt: CustomerDebtState | undefined
  invoiceHistory: CustomerHistoryState | undefined
}) {
  if (debt === undefined || debt === 'loading') return <p>Đang tải nợ cần thu...</p>
  if (debt === 'error') return <p role="alert">Không tải được nợ cần thu.</p>
  const debtInvoicesByOrderId = new Map(debt.invoices.map((invoice) => [invoice.order_id, invoice]))
  const invoiceRows = typeof invoiceHistory === 'object'
    ? invoiceHistory.items.map((invoice) => {
        const debtInvoice = debtInvoicesByOrderId.get(invoice.id)
        const remainingDebt = debtInvoice?.remaining_debt
          ?? (invoice.payment_status === 'paid' ? 0 : Math.max(invoice.debt_amount, 0))
        const paidAmount = debtInvoice?.paid_amount ?? invoice.paid_amount
        return {
          id: invoice.id,
          code: invoice.code,
          created_at: invoice.created_at,
          total_amount: invoice.total_amount,
          paid_amount: paidAmount,
          remaining_debt: remainingDebt,
          status: remainingDebt <= 0 ? 'Hoàn tất' : paidAmount > 0 ? 'Nợ 1 phần' : salesDocumentStatusText(invoice),
        }
      })
    : debt.invoices.map((invoice) => ({
        id: invoice.order_id,
        code: invoice.order_code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
        remaining_debt: invoice.remaining_debt,
        status: invoice.remaining_debt > 0 ? 'Còn nợ' : 'Đã thanh toán',
      }))
  const openInvoiceRows = invoiceRows.filter((invoice) => invoice.remaining_debt > 0)
  const totalDebt = debt.total_debt > 0 || debt.invoices.length > 0
    ? debt.total_debt
    : openInvoiceRows.reduce((sum, invoice) => sum + invoice.remaining_debt, 0)
  const openInvoiceCount = debt.invoices.length > 0 ? debt.invoices.length : openInvoiceRows.length

  return (
    <section aria-label="Nợ cần thu" className="customer-debt-panel">
      <ManagementDetailInfoList
        columns="three"
        items={[
          { label: 'Tổng nợ', value: <MoneyText value={totalDebt} /> },
          { label: 'Hóa đơn mở', value: `${openInvoiceCount} hóa đơn mở` },
          { label: 'Lịch sử hóa đơn', value: invoiceHistory === 'loading' ? 'Đang tải' : `${invoiceRows.length} hóa đơn` },
        ]}
      />
      {invoiceHistory === 'error' ? <p role="alert">Không tải được lịch sử nợ cần thu.</p> : null}
      {invoiceRows.length > 0 ? (
        <table aria-label="Lịch sử nợ cần thu" className="management-detail-table management-detail-linked-table">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Thời gian</th>
              <th>Tổng sau giảm</th>
              <th>Đã thu</th>
              <th>Còn nợ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {invoiceRows.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.code}</td>
                <td>{dateTime(invoice.created_at)}</td>
                <td><MoneyText value={invoice.total_amount} /></td>
                <td><MoneyText value={invoice.paid_amount} /></td>
                <td><MoneyText value={invoice.remaining_debt} /></td>
                <td>{invoice.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <ManagementDetailInlineNote>Chưa có lịch sử nợ cần thu.</ManagementDetailInlineNote>}
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

