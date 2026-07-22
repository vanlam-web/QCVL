import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  FileDown,
  Info,
  Lock,
  Network,
  Pencil,
  Percent,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { ManagementRecordLink, MetricCard, MetricGrid, MoneyText, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney, parseMoneyInput } from '../../lib/number-format'
import { dateRangeFromItems, displayDateRangeForData, quickDateRange, toDisplayDateInput, type QuickDateRangePreset } from '../../lib/date-ranges'
import { currentSystemDate } from '../../lib/system-clock'
import { dateTimeStoredIsoFromLocalClock, parseDateTimeValue, parseQcvDateTimeInputToStoredIso } from '../../lib/date-format'
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
import { preventManagementSearchSubmit } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, nextManagementSortState, type ManagementSortState } from '../../components/ui-shell/management-table-sort'
import { downloadManagementCsv } from '../../components/ui-shell/management-export'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { useManagementSearch } from '../../lib/use-management-search'
import { formatPhoneDisplay } from '../../lib/phone-format'
import type { CatalogService, CustomerListFilters } from './catalog-service'
import type { Customer, CustomerGroup } from './types'
import type { CustomerDebtDetail, OrderService } from '../orders/order-service'
import type { FinanceService } from '../finance/finance-service'
import type { CashbookEntry } from '../finance/types'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'
import { buildCustomerListFilters, customerHistoryKey, type CustomerHistoryType } from './customer-filters'
import {
  buildCustomerDebtLedgerRows,
  customerDebtHasLiveLedger,
  customerDebtLedgerRowsFromBackend,
  type CustomerDebtAdjustment,
  type CustomerDebtLedgerRow,
} from './customer-debt-ledger'
import {
  customerDate,
  customerDateTime as dateTime,
  customerSalesDocumentStatusText as salesDocumentStatusText,
  customerVisibleSummary,
} from './customer-presenter'
import { CustomerCreateDialog, createCustomerFormDefaults } from './CustomerCreateDialog'
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
type CustomerDebtLedgerState = {
  debt: CustomerDebtDetail
  invoiceHistory: SalesDocumentListItem[]
  cashbookHistory: CashbookEntry[]
} | 'loading' | 'error'
type CustomerHistoryState = { items: SalesDocumentListItem[]; page: number; pageSize: number; total: number } | 'loading' | 'error'
type CustomerDetailTab = 'info' | 'debt' | 'history'
type CustomerDebtView = 'summary' | 'detail'
type CustomerDebtSummaryRow = {
  id: string
  code: string
  created_at: string
  total_amount: number
  remaining_debt: number
  running_debt: number
}
type CustomerDebtPaymentForm = {
  paidAt: string
  method: 'cash' | 'bank_transfer'
  amount: string
  note: string
  allocateToInvoices: boolean
  invoicePayments: Record<string, string>
}
type CustomerDebtPaymentRow = CustomerDebtSummaryRow & {
  paid_before: number
  payment_amount: number
}
type CustomerSortKey = 'code' | 'created_at' | 'name' | 'phone' | 'group' | 'total_debt_amount' | 'total_sales_amount'
const defaultCustomerSortState: NonNullable<ManagementSortState<CustomerSortKey>> = { key: 'created_at', direction: 'desc' }
const customerHistoryPageSize = 10
const customerDebtLedgerPageSize = 10
type CustomerCreatedDateFilter = QuickDateRangePreset | 'custom'
type CustomerStatusFilter = 'active' | 'inactive' | 'all'
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
  return customer.source_creator_name?.trim() ? 'Chưa khớp tài khoản' : ''
}

function customerHistoryStatus(historyType: CustomerHistoryType) {
  return historyType === 'invoice' ? 'completed' : 'active'
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
      return ''
  }
}

const hiddenCustomerGroupNames = new Set(['cg-retail', 'cg retail', 'cg-vip', 'cg vip', 'khach le', 'khach si'])

function normalizedCustomerGroupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function isHiddenCustomerGroup(group: Pick<CustomerGroup, 'id' | 'name'> | null | undefined) {
  if (!group) return false
  return hiddenCustomerGroupNames.has(normalizedCustomerGroupText(group.id)) ||
    hiddenCustomerGroupNames.has(normalizedCustomerGroupText(group.name))
}

function customerGroupLabel(customer: Customer) {
  if (isHiddenCustomerGroup(customer.customer_group)) return ''
  return customer.customer_group?.name?.trim() || ''
}

function CustomerSupplierLinkIcon() {
  return (
    <span aria-label="Có liên kết nhà cung cấp" className="management-linked-partner-icon" title="Có liên kết nhà cung cấp">
      <Network aria-hidden="true" size={16} />
    </span>
  )
}

export function CustomersPage({
  currentUserName = '',
  service,
  orderService,
  salesDocumentService,
  financeService,
}: {
  currentUserName?: string
  service: CatalogService
  orderService: Pick<OrderService, 'getCustomerDebt'>
  salesDocumentService?: Pick<SalesDocumentService, 'listSalesDocuments'>
  financeService?: Pick<FinanceService, 'listAccounts' | 'collectCustomerDebt' | 'updateCustomerDebtAdjustment'>
}) {
  const [routeSearch] = useState(() => (new URLSearchParams(window.location.search).get('search') ?? '').trim())
  const [routeOpen] = useState(() => (new URLSearchParams(window.location.search).get('open') ?? '').trim())
  const [state, setState] = useState<CustomerState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [customerImportOpen, setCustomerImportOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<CustomerDetailTab>('info')
  const [customerHistoryType, setCustomerHistoryType] = useState<CustomerHistoryType>('invoice')
  const [customerDebts, setCustomerDebts] = useState<Record<string, CustomerDebtState>>({})
  const [customerDebtLedgers, setCustomerDebtLedgers] = useState<Record<string, CustomerDebtLedgerState>>({})
  const [customerDebtLedgerPages, setCustomerDebtLedgerPages] = useState<Record<string, number>>({})
  const [customerHistories, setCustomerHistories] = useState<Record<string, CustomerHistoryState>>({})
  const [customerHistoryPages, setCustomerHistoryPages] = useState<Record<string, number>>({})
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [analysisCustomer, setAnalysisCustomer] = useState<Customer | null>(null)
  const [debtAdjustmentCustomer, setDebtAdjustmentCustomer] = useState<Customer | null>(null)
  const [debtAdjustmentForm, setDebtAdjustmentForm] = useState<CustomerDebtAdjustmentForm>({ adjustmentId: '', adjustedAt: '', adjustedAtIso: null, amount: '', note: '' })
  const [savingDebtAdjustment, setSavingDebtAdjustment] = useState(false)
  const [debtAdjustmentError, setDebtAdjustmentError] = useState<string | null>(null)
  const [debtPaymentCustomer, setDebtPaymentCustomer] = useState<Customer | null>(null)
  const [debtPaymentForm, setDebtPaymentForm] = useState<CustomerDebtPaymentForm>(() => ({
    paidAt: formatCustomerDebtAdjustmentDateTime(currentSystemDate()),
    method: 'cash',
    amount: '',
    note: '',
    allocateToInvoices: true,
    invoicePayments: {},
  }))
  const [savingDebtPayment, setSavingDebtPayment] = useState(false)
  const [debtPaymentError, setDebtPaymentError] = useState<string | null>(null)
  const customerDebtLedgerRequestsRef = useRef(new Set<string>())
  const customerHistoryRequestsRef = useRef(new Set<string>())
  const [showFilters, setShowFilters] = useState(true)
  const customerManagementSearch = useManagementSearch({ initialSearch: routeSearch })
  const search = customerManagementSearch.draftSearch
  const [lastSearch, setLastSearch] = useState(routeSearch)
  const [customerGroupId, setCustomerGroupId] = useState('all')
  const [status, setStatus] = useState<CustomerStatusFilter>('active')
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
  const [lastStatus, setLastStatus] = useState<CustomerStatusFilter>('active')
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
  const [customerSortState, setCustomerSortState] = useState<ManagementSortState<CustomerSortKey>>(defaultCustomerSortState)
  const [form, setForm] = useState(createCustomerFormDefaults)

  async function load(filters: CustomerListFilters & {
    customerGroupIdValue?: string
    statusValue?: CustomerStatusFilter
    createdFromValue?: string
    createdToValue?: string
    createdByValue?: string
    totalSalesMinValue?: string
    totalSalesMaxValue?: string
    totalDebtMinValue?: string
    totalDebtMaxValue?: string
    sortStateValue?: ManagementSortState<CustomerSortKey>
  } = {}) {
    const nextSearch = filters.search ?? lastSearch
    const nextCustomerGroupId = filters.customerGroupIdValue ?? lastCustomerGroupId
    const nextStatus = filters.statusValue ?? lastStatus
    const nextCreatedFrom = filters.createdFromValue ?? lastCreatedFrom
    const nextCreatedTo = filters.createdToValue ?? lastCreatedTo
    const nextCreatedBy = filters.createdByValue ?? lastCreatedBy
    const nextTotalSalesMin = filters.totalSalesMinValue ?? lastTotalSalesMin
    const nextTotalSalesMax = filters.totalSalesMaxValue ?? lastTotalSalesMax
    const nextTotalDebtMin = filters.totalDebtMinValue ?? lastTotalDebtMin
    const nextTotalDebtMax = filters.totalDebtMaxValue ?? lastTotalDebtMax
    const nextSortState = filters.sortStateValue === undefined ? customerSortState : filters.sortStateValue
    const nextPage = filters.page ?? page
    const nextPageSize = filters.page_size ?? pageSize
    setError(null)
    try {
      const result = await service.listCustomers({
        ...buildCustomerListFilters({
          search: nextSearch,
          status: nextStatus,
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
        }),
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultCustomerSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
      })
      setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
      setLastSearch(nextSearch)
      setLastCustomerGroupId(nextCustomerGroupId)
      setLastStatus(nextStatus)
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

  async function exportCustomers() {
    setError(null)
    try {
      const exportPageSize = Math.max(state?.total ?? 0, state?.customers.length ?? 0, 1)
      const exportSortState = customerSortState ?? defaultCustomerSortState
      const result = await service.listCustomers({
        ...buildCustomerListFilters({
          search: lastSearch,
          status: lastStatus,
          page: 1,
          page_size: exportPageSize,
          customerGroupId: lastCustomerGroupId,
          createdFrom: lastCreatedFrom,
          createdTo: lastCreatedTo,
          createdBy: lastCreatedBy,
          totalSalesMin: lastTotalSalesMin,
          totalSalesMax: lastTotalSalesMax,
          totalDebtMin: lastTotalDebtMin,
          totalDebtMax: lastTotalDebtMax,
        }),
        sort_key: exportSortState.key,
        sort_direction: exportSortState.direction,
      })
      downloadManagementCsv({
        filename: 'khach-hang.csv',
        rows: [
          ['Mã KH', 'Tên khách hàng', 'Điện thoại', 'Nhóm khách', 'Loại khách', 'Trạng thái', 'Công nợ', 'Tổng bán', 'Người tạo', 'Ngày tạo'],
          ...result.items.map((customer) => [
            customer.code,
            customer.name,
            customer.phone ?? '',
            customerGroupLabel(customer),
            customerTypeLabel(customer),
            customer.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động',
            customer.total_debt_amount ?? 0,
            customer.total_sales_amount ?? 0,
            customerCreatorLabel(customer),
            customer.created_at,
          ]),
        ],
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không xuất được file khách hàng.'))
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialCustomers() {
      setError(null)
      try {
        const result = await service.listCustomers({
          search: routeSearch || routeOpen || undefined,
          page: 1,
          page_size: defaultPageSize,
          status: 'active',
        })
        if (!active) return
        setState({ customers: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
        setPage(result.page)
        setPageSize(result.page_size)
        if (routeOpen) {
          const openedCustomer = result.items.find((customer) => customer.code === routeOpen || customer.name === routeOpen)
          if (openedCustomer) {
            setSelectedCustomerId(openedCustomer.id)
            setActiveDetailTab('info')
            setCustomerHistoryType('invoice')
          }
        }
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được khách hàng.'))
      }
    }

    void loadInitialCustomers()

    return () => {
      active = false
    }
  }, [defaultPageSize, routeOpen, routeSearch, service])

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
    preventManagementSearchSubmit(event, () => {
      const nextSearch = search.trim()
      customerManagementSearch.applySearch(nextSearch)
      return applyCustomerSearch(nextSearch)
    })
  }

  function applyCustomerSearch(nextSearch: string) {
    setPage(1)
    return load({
      search: nextSearch,
      customerGroupIdValue: customerGroupId,
      statusValue: status,
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
    customerManagementSearch.changeSearch(nextSearch)
    setSelectedCustomerId(null)
    if (nextSearch.trim().length === 0) {
      customerManagementSearch.applySearch('')
      void applyCustomerSearch('')
    }
  }

  async function applySidebarFilters(nextFilters: Partial<{
    customerGroupId: string
    status: CustomerStatusFilter
    createdFrom: string
    createdTo: string
    createdBy: string
    totalSalesMin: string
    totalSalesMax: string
    totalDebtMin: string
    totalDebtMax: string
  }>) {
    const nextCustomerGroupId = nextFilters.customerGroupId ?? customerGroupId
    const nextStatus = nextFilters.status ?? status
    const nextCreatedFrom = nextFilters.createdFrom ?? createdFrom
    const nextCreatedTo = nextFilters.createdTo ?? createdTo
    const nextCreatedBy = nextFilters.createdBy ?? createdBy
    const nextTotalSalesMin = nextFilters.totalSalesMin ?? totalSalesMin
    const nextTotalSalesMax = nextFilters.totalSalesMax ?? totalSalesMax
    const nextTotalDebtMin = nextFilters.totalDebtMin ?? totalDebtMin
    const nextTotalDebtMax = nextFilters.totalDebtMax ?? totalDebtMax
    setCustomerGroupId(nextCustomerGroupId)
    setStatus(nextStatus)
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
      statusValue: nextStatus,
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

  async function requestCustomerSort(key: CustomerSortKey) {
    const kind = key === 'created_at' ? 'date' : key === 'total_debt_amount' || key === 'total_sales_amount' ? 'number' : 'text'
    const nextSortState = nextManagementSortState(customerSortState, key, kind)
    setCustomerSortState(nextSortState)
    setPage(1)
    await load({ page: 1, sortStateValue: nextSortState })
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

  function loadCustomerDebtLedger(customer: Customer, options: { force?: boolean } = {}) {
    if (!options.force && customerDebtLedgers[customer.id] !== undefined) return
    if (customerDebtLedgerRequestsRef.current.has(customer.id)) return

    customerDebtLedgerRequestsRef.current.add(customer.id)
    setCustomerDebts((debts) => ({ ...debts, [customer.id]: 'loading' }))
    setCustomerDebtLedgers((ledgers) => ({ ...ledgers, [customer.id]: 'loading' }))
    orderService.getCustomerDebt(customer.id)
      .then((debt) => {
        setCustomerDebts((debts) => ({ ...debts, [customer.id]: debt }))
        setCustomerDebtLedgers((ledgers) => ({
          ...ledgers,
          [customer.id]: {
            debt,
            invoiceHistory: [],
            cashbookHistory: debt.cashbook_entries ?? [],
          },
        }))
      })
      .catch(() => setCustomerDebtLedgers((ledgers) => ({ ...ledgers, [customer.id]: 'error' })))
      .finally(() => customerDebtLedgerRequestsRef.current.delete(customer.id))
  }

  function loadCustomerHistory(customerId: string, historyType: CustomerHistoryType, options: { page?: number; force?: boolean } = {}) {
    const key = customerHistoryKey(customerId, historyType)
    const nextPage = Math.max(1, options.page ?? customerHistoryPages[key] ?? 1)
    const currentHistory = customerHistories[key]
    const requestKey = `${key}:${nextPage}`
    if (salesDocumentService === undefined) return
    if (!options.force && typeof currentHistory === 'object' && currentHistory.page === nextPage) return
    if (customerHistoryRequestsRef.current.has(requestKey)) return

    customerHistoryRequestsRef.current.add(requestKey)
    setCustomerHistories((histories) => ({ ...histories, [key]: 'loading' }))
    salesDocumentService
      .listSalesDocuments({
        customer_id: customerId,
        type: historyType,
        status: customerHistoryStatus(historyType),
        page: nextPage,
        page_size: customerHistoryPageSize,
      })
      .then((history) => {
        setCustomerHistoryPages((pages) => ({ ...pages, [key]: history.page }))
        setCustomerHistories((histories) => ({
          ...histories,
          [key]: {
            items: history.items,
            page: history.page,
            pageSize: history.page_size,
            total: history.total,
          },
        }))
      })
      .catch(() => setCustomerHistories((histories) => ({ ...histories, [key]: 'error' })))
      .finally(() => customerHistoryRequestsRef.current.delete(requestKey))
  }

  function openCustomerHistory(customerId: string) {
    setActiveDetailTab('history')
    loadCustomerHistory(customerId, customerHistoryType)
  }

  function openCustomerDebt(customer: Customer) {
    setActiveDetailTab('debt')
    setCustomerDebtLedgerPages((pages) => ({ ...pages, [customer.id]: pages[customer.id] ?? 1 }))
    loadCustomerDebtLedger(customer, { force: true })
    loadCustomerHistory(customer.id, 'invoice')
  }

  function openDebtPaymentDialog(customer: Customer) {
    setDebtPaymentCustomer(customer)
    setDebtPaymentError(null)
    setDebtPaymentForm({
      paidAt: formatCustomerDebtAdjustmentDateTime(currentSystemDate()),
      method: 'cash',
      amount: '',
      note: '',
      allocateToInvoices: true,
      invoicePayments: {},
    })
    loadCustomerDebtLedger(customer, { force: true })
  }

  async function collectCustomerDebt(customer: Customer, form: CustomerDebtPaymentForm, currentDebt: number, paymentRows: CustomerDebtPaymentRow[] = []) {
    if (!financeService?.collectCustomerDebt) return
    const amount = parseMoneyInput(form.amount)
    if (amount <= 0) {
      setDebtPaymentError('Số tiền thu phải lớn hơn 0.')
      return
    }
    if (amount > currentDebt) {
      setDebtPaymentError('Số tiền thu không được lớn hơn công nợ hiện tại.')
      return
    }
    setSavingDebtPayment(true)
    setDebtPaymentError(null)
    try {
      const paidAt = parseQcvDateTimeInputToStoredIso(form.paidAt)
      const result = await financeService.collectCustomerDebt({
        customer_id: customer.id,
        amount,
        ...(paidAt ? { created_at: paidAt } : {}),
        allocations: paymentRows
          .filter((row) => row.payment_amount > 0)
          .map((row) => ({
            order_id: row.id,
            order_code: row.code,
            allocated_amount: row.payment_amount,
          })),
        payment_method: {
          cash_amount: form.method === 'cash' ? amount : 0,
          bank_amount: form.method === 'bank_transfer' ? amount : 0,
        },
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      })
      setState((current) => {
        if (!current) return current
        const nextDebt = (current.summary?.total_debt_amount ?? 0) - result.allocated_amount
        return {
          ...current,
          customers: current.customers.map((item) => (
            item.id === customer.id
              ? { ...item, total_debt_amount: (item.total_debt_amount ?? 0) - result.allocated_amount }
              : item
          )),
          summary: current.summary
            ? { ...current.summary, total_debt_amount: nextDebt }
            : current.summary,
        }
      })
      setDebtPaymentCustomer(null)
      loadCustomerDebtLedger(customer, { force: true })
    } catch (cause) {
      setDebtPaymentError(formatApiError(cause, 'Không tạo được phiếu thu công nợ.'))
    } finally {
      setSavingDebtPayment(false)
    }
  }

  async function saveCustomerDebtAdjustment(customer: Customer, form: CustomerDebtAdjustmentForm) {
    if (!financeService?.updateCustomerDebtAdjustment) return
    const selectedAdjustmentDateTime = parseQcvDateTimeInputToStoredIso(form.adjustedAt)
    if (!form.adjustmentId || selectedAdjustmentDateTime === null) {
      setDebtAdjustmentError('Thời gian điều chỉnh không hợp lệ.')
      return
    }
    const amount = parseMoneyInput(form.amount)
    if (amount <= 0) {
      setDebtAdjustmentError('Giá trị nợ điều chỉnh phải lớn hơn 0.')
      return
    }
    setSavingDebtAdjustment(true)
    setDebtAdjustmentError(null)
    try {
      const formattedIso = form.adjustedAtIso && form.adjustedAt === dateTime(form.adjustedAtIso)
        ? form.adjustedAtIso
        : selectedAdjustmentDateTime
      await financeService.updateCustomerDebtAdjustment(form.adjustmentId, {
        adjusted_at: formattedIso,
        amount_delta: amount,
        note: form.note.trim() || null,
      })
      setDebtAdjustmentCustomer(null)
      loadCustomerDebtLedger(customer, { force: true })
      void load({ page })
    } catch (cause) {
      setDebtAdjustmentError(formatApiError(cause, 'Không lưu được phiếu điều chỉnh.'))
    } finally {
      setSavingDebtAdjustment(false)
    }
  }

  function selectCustomerHistoryType(customerId: string, historyType: CustomerHistoryType) {
    setCustomerHistoryType(historyType)
    loadCustomerHistory(customerId, historyType, { page: customerHistoryPages[customerHistoryKey(customerId, historyType)] ?? 1 })
  }

  function changeCustomerHistoryPage(customerId: string, historyType: CustomerHistoryType, nextPage: number) {
    const key = customerHistoryKey(customerId, historyType)
    setCustomerHistoryPages((pages) => ({ ...pages, [key]: nextPage }))
    loadCustomerHistory(customerId, historyType, { page: nextPage, force: true })
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
        note: form.note.trim() || undefined,
        customer_group_id: form.customerGroupId || null,
        customer_type: form.customerType,
        company_name: form.customerType === 'company' ? form.companyName.trim() || null : null,
      })
      setForm(createCustomerFormDefaults())
      setCreateOpen(false)
      setPage(1)
      await load({ page: 1, page_size: pageSize })
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được khách hàng.'))
    } finally {
      setSaving(false)
    }
  }

  function openCreateCustomer() {
    setForm(createCustomerFormDefaults())
    setCreateOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil((state?.total ?? 0) / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const statusFilterSummary = lastStatus === 'active'
    ? 'Đang hoạt động'
    : lastStatus === 'inactive'
      ? 'Trạng thái: Ngừng hoạt động'
      : 'Trạng thái: Tất cả'
  const activeFilterSummary = lastCustomerGroupId === 'all' &&
        lastCreatedFrom === '' &&
        lastCreatedTo === '' &&
        lastCreatedBy === 'all' &&
        lastTotalSalesMin === '' &&
        lastTotalSalesMax === '' &&
        lastTotalDebtMin === '' &&
        lastTotalDebtMax === ''
      ? statusFilterSummary
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
  const visibleCustomerGroups = customerGroups.filter((group) => !isHiddenCustomerGroup(group))
  const customerVisibleDateRange = createdDateFilter === 'custom'
    ? { from: createdFrom, to: createdTo }
    : displayDateRangeForData(
        { from: createdFrom, to: createdTo },
        dateRangeFromItems(state?.customers ?? [], (customer) => customer.created_at),
      )
  const sortedCustomers = state?.customers ?? []
  const customerKpis = (
    <MetricGrid ariaLabel="Tổng quan khách hàng">
      <MetricCard hint="Theo bộ lọc hiện tại" label="Công nợ" tone={visibleDebtTotal > 0 ? 'warning' : 'neutral'} value={<MoneyText value={visibleDebtTotal} />} />
      <MetricCard hint="Theo bộ lọc hiện tại" label="Tổng bán" tone="success" value={<MoneyText value={visibleSalesTotal} />} />
    </MetricGrid>
  )

  function openDebtAdjustmentDialog(customer: Customer, form?: CustomerDebtAdjustmentForm) {
    setDebtAdjustmentCustomer(customer)
    setDebtAdjustmentError(null)
    setDebtAdjustmentForm(form ?? { adjustmentId: '', adjustedAt: '', adjustedAtIso: null, amount: '', note: '' })
  }

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
          <button className="button button-secondary" type="button" onClick={() => void exportCustomers()}>
            <FileDown aria-hidden="true" size={16} />
            Xuất file
          </button>
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
              {visibleCustomerGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </ManagementFilterSelectField>
          </ManagementFilterGroup>
          <ManagementFilterGroup title={'Tr\u1ea1ng th\u00e1i'}>
            {[
              { value: 'all', label: 'T\u1ea5t c\u1ea3' },
              { value: 'active', label: '\u0110ang ho\u1ea1t \u0111\u1ed9ng' },
              { value: 'inactive', label: 'Ng\u1eebng ho\u1ea1t \u0111\u1ed9ng' },
            ].map((option) => (
              <label className={`management-filter-choice${status === option.value ? ' management-filter-choice-active' : ''}`} key={option.value}>
                <input
                  checked={status === option.value}
                  name="customer-status"
                  type="radio"
                  onChange={() => void applySidebarFilters({ status: option.value as CustomerStatusFilter })}
                />
                <span>{option.label}</span>
              </label>
            ))}
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
        <CustomerCreateDialog
          error={error}
          form={form}
          groups={visibleCustomerGroups}
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onFormChange={setForm}
          onSubmit={createCustomer}
        />
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
                    cell: (customer) => formatPhoneDisplay(customer.phone, ''),
                  },
                  {
                    key: 'group',
                    header: <ManagementSortableHeader kind="text" sortKey="group" sortState={customerSortState} onSort={requestCustomerSort}>Nhóm khách</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customerGroupLabel(customer),
                  },
                  {
                    key: 'debt',
                    header: <ManagementSortableHeader kind="number" sortKey="total_debt_amount" sortState={customerSortState} onSort={requestCustomerSort}>Công nợ</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.total_debt_amount === undefined || customer.total_debt_amount === null ? '' : <MoneyText value={customer.total_debt_amount} />,
                  },
                  {
                    key: 'sales',
                    header: <ManagementSortableHeader kind="number" sortKey="total_sales_amount" sortState={customerSortState} onSort={requestCustomerSort}>Tổng bán</ManagementSortableHeader>,
                    headerIsCell: true,
                    cell: (customer) => customer.total_sales_amount === undefined ? '' : <MoneyText value={customer.total_sales_amount} />,
                  },
                ]}
                getDetailLabel={(customer) => `Chi tiết khách hàng ${customer.code}`}
                getRowKey={(customer) => customer.id}
                items={sortedCustomers}
                selectedRowKey={selectedCustomerId}
                renderDetail={(customer) => {
                  const debt = customerDebts[customer.id]
                  const debtLedger = customerDebtLedgers[customer.id]
                  const debtLedgerPage = customerDebtLedgerPages[customer.id] ?? 1
                  const payableDebtAmount = customerDebtCurrentAmount(debtLedger, customer.total_debt_amount ?? 0)
                  const historyKey = customerHistoryKey(customer.id, customerHistoryType)
                  const history = customerHistories[historyKey]
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
                            key: 'history',
                            label: 'Lịch sử',
                            onSelect: () => openCustomerHistory(customer.id),
                          },
                          {
                            key: 'debt',
                            label: 'Công nợ',
                            onSelect: () => openCustomerDebt(customer),
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
                              { label: 'Điện thoại', value: formatPhoneDisplay(customer.phone) },
                              { label: 'MST', value: customer.tax_code ?? '' },
                              { label: 'Địa chỉ', value: customer.address ?? '' },
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
                            {customer.note?.trim() ? customer.note : ''}
                          </ManagementDetailInlineNote>
                        </ManagementDetailSection>
                      ) : activeDetailTab === 'debt' ? (
                        <ManagementDetailSection ariaLabel="Công nợ khách hàng" role="tabpanel">
                          <CustomerDebtPanel
                            debt={debt}
                            debtLedger={debtLedger}
                            fallbackDebt={customer.total_debt_amount ?? 0}
                            ledgerPage={debtLedgerPage}
                            ledgerPageSize={customerDebtLedgerPageSize}
                            onOpenAdjustment={(adjustment) => openDebtAdjustmentDialog(customer, {
                              adjustmentId: adjustment.id,
                              adjustedAt: dateTime(adjustment.created_at),
                              adjustedAtIso: adjustment.created_at,
                              amount: formatMoney(adjustment.amount_delta),
                              note: adjustment.source_file ?? adjustment.transaction_type ?? '',
                            })}
                            onLedgerPageChange={(nextPage) => setCustomerDebtLedgerPages((pages) => ({ ...pages, [customer.id]: nextPage }))}
                          />
                        </ManagementDetailSection>
                      ) : (
                        <ManagementDetailSection ariaLabel="Lịch sử khách hàng" role="tabpanel">
                          <CustomerHistoryPanel
                            history={history}
                            historyType={customerHistoryType}
                            historyPage={customerHistoryPages[historyKey] ?? (typeof history === 'object' ? history.page : 1)}
                            onSelectHistoryType={(historyType) => selectCustomerHistoryType(customer.id, historyType)}
                            onHistoryPageChange={(nextPage) => changeCustomerHistoryPage(customer.id, customerHistoryType, nextPage)}
                          />
                        </ManagementDetailSection>
                      )}
                      {activeDetailTab === 'debt' ? (
                        <ManagementDetailActionFooter
                          leftActions={[
                            {
                              label: 'Xuất file công nợ',
                              disabled: true,
                              icon: <FileDown aria-hidden="true" size={15} />,
                            },
                            {
                              label: 'Xuất file',
                              disabled: true,
                              icon: <FileDown aria-hidden="true" size={15} />,
                            },
                          ]}
                          rightActions={[
                            {
                              label: 'Thanh toán',
                              disabled: !(payableDebtAmount > 0 && financeService?.collectCustomerDebt),
                              variant: 'primary',
                              icon: <CircleDollarSign aria-hidden="true" size={15} />,
                              onClick: () => openDebtPaymentDialog(customer),
                            },
                            {
                              label: 'Điều chỉnh',
                              icon: <Edit3 aria-hidden="true" size={15} />,
                              onClick: () => openDebtAdjustmentDialog(customer),
                            },
                            {
                              label: 'Chiết khấu thanh toán',
                              disabled: true,
                              icon: <Percent aria-hidden="true" size={15} />,
                            },
                          ]}
                        />
                      ) : (
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
                      )}
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
              onPageChange={(nextPage) => void goToPage(nextPage)}
              onPageSizeChange={(nextPageSize) => void load({ page: 1, page_size: nextPageSize })}
              onPrevious={() => void goToPage(page - 1)}
            />
          </>
        ) : null}
      </ManagementListSurface>
      {analysisCustomer ? (
        <CustomerAnalysisDialog customer={analysisCustomer} onClose={() => setAnalysisCustomer(null)} />
      ) : null}
      {debtAdjustmentCustomer ? (
        <CustomerDebtAdjustmentDialog
          customer={debtAdjustmentCustomer}
          form={debtAdjustmentForm}
          currentDebt={debtAdjustmentCustomer.total_debt_amount ?? 0}
          onChange={setDebtAdjustmentForm}
          onClose={() => setDebtAdjustmentCustomer(null)}
          saving={savingDebtAdjustment}
          error={debtAdjustmentError}
          canSave={Boolean(financeService?.updateCustomerDebtAdjustment)}
          onSubmit={(form) => void saveCustomerDebtAdjustment(debtAdjustmentCustomer, form)}
        />
      ) : null}
      {debtPaymentCustomer ? (
        <CustomerDebtPaymentDialog
          collectorName={currentUserName}
          customer={debtPaymentCustomer}
          debt={customerDebtLedgers[debtPaymentCustomer.id]}
          fallbackDebt={debtPaymentCustomer.total_debt_amount ?? 0}
          form={debtPaymentForm}
          saving={savingDebtPayment}
          error={debtPaymentError}
          canSave={Boolean(financeService?.collectCustomerDebt)}
          onChange={setDebtPaymentForm}
          onClose={() => setDebtPaymentCustomer(null)}
          onSubmit={(form, currentDebt, paymentRows) => void collectCustomerDebt(debtPaymentCustomer, form, currentDebt, paymentRows)}
        />
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


function buildCustomerDebtSummaryRows(
  invoices: Array<{
    id: string
    code: string
    created_at: string
    total_amount: number
    paid_amount?: number
    debt_amount?: number
    payment_status?: string
    status?: SalesDocumentListItem['status']
  }>,
  _ledgerRows: CustomerDebtLedgerRow[],
  currentDebt: number,
): CustomerDebtSummaryRow[] {
  const openRows = invoices
    .filter((invoice) => invoice.status !== 'cancelled' && invoice.payment_status !== 'paid')
    .map((invoice) => {
      const remainingDebt = typeof invoice.debt_amount === 'number'
        ? invoice.debt_amount
        : invoice.total_amount - (invoice.paid_amount ?? 0)
      return {
        id: invoice.id,
        code: invoice.code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        remaining_debt: remainingDebt,
        running_debt: remainingDebt,
      }
    })
    .filter((invoice) => invoice.remaining_debt > 0)

  const openDebtTotal = openRows.reduce((sum, invoice) => sum + invoice.remaining_debt, 0)
  let alreadySettled = Math.max(openDebtTotal - currentDebt, 0)
  const remainingDebtById = new Map(openRows.map((invoice) => [invoice.id, invoice.remaining_debt]))
  const oldestRows = [...openRows].sort((left, right) => {
    const timeDiff = (parseDateTimeValue(left.created_at) ?? 0) - (parseDateTimeValue(right.created_at) ?? 0)
    if (timeDiff !== 0) return timeDiff
    return left.code.localeCompare(right.code)
  })
  for (const invoice of oldestRows) {
    if (alreadySettled <= 0) break
    const remainingDebt = remainingDebtById.get(invoice.id) ?? 0
    const settled = Math.min(remainingDebt, alreadySettled)
    remainingDebtById.set(invoice.id, remainingDebt - settled)
    alreadySettled -= settled
  }

  const summaryRows = openRows
    .map((invoice) => ({
      ...invoice,
      remaining_debt: remainingDebtById.get(invoice.id) ?? invoice.remaining_debt,
    }))
    .filter((invoice) => invoice.remaining_debt > 0)
    .sort((left, right) => {
      const timeDiff = (parseDateTimeValue(right.created_at) ?? 0) - (parseDateTimeValue(left.created_at) ?? 0)
      if (timeDiff !== 0) return timeDiff
      return right.code.localeCompare(left.code)
    })

  let runningDebt = currentDebt
  return summaryRows.map((invoice) => {
    const row = { ...invoice, running_debt: runningDebt }
    runningDebt -= invoice.remaining_debt
    return row
  })
}

function buildCustomerDebtPaymentRows(summaryRows: CustomerDebtSummaryRow[], paymentAmount: number): CustomerDebtPaymentRow[] {
  let remainingPayment = Math.max(paymentAmount, 0)
  const paymentById = new Map<string, number>()
  const oldestRows = [...summaryRows].sort((left, right) => {
    const timeDiff = (parseDateTimeValue(left.created_at) ?? 0) - (parseDateTimeValue(right.created_at) ?? 0)
    if (timeDiff !== 0) return timeDiff
    return left.code.localeCompare(right.code)
  })
  for (const row of oldestRows) {
    const paymentAmountForRow = Math.min(row.remaining_debt, remainingPayment)
    paymentById.set(row.id, paymentAmountForRow)
    remainingPayment -= paymentAmountForRow
    if (remainingPayment <= 0) break
  }
  return summaryRows.map((row) => {
    return {
      ...row,
      paid_before: Math.max(row.total_amount - row.remaining_debt, 0),
      payment_amount: paymentById.get(row.id) ?? 0,
    }
  })
}

function customerDebtCurrentAmount(debtLedger: CustomerDebtLedgerState | undefined, fallbackDebt: number) {
  if (debtLedger === undefined || debtLedger === 'loading' || debtLedger === 'error') return fallbackDebt
  return customerDebtHasLiveLedger(debtLedger.debt) ? debtLedger.debt.total_debt : fallbackDebt
}

function CustomerDebtPanel({
  debt,
  debtLedger,
  fallbackDebt,
  ledgerPage,
  ledgerPageSize,
  onOpenAdjustment,
  onLedgerPageChange,
}: {
  debt: CustomerDebtState | undefined
  debtLedger: CustomerDebtLedgerState | undefined
  fallbackDebt: number
  ledgerPage: number
  ledgerPageSize: number
  onOpenAdjustment: (adjustment: CustomerDebtAdjustment) => void
  onLedgerPageChange: (page: number) => void
}) {
  const [debtView, setDebtView] = useState<CustomerDebtView>('summary')
  const [summaryPage, setSummaryPage] = useState(1)
  if (debt === undefined || debt === 'loading' || debtLedger === undefined || debtLedger === 'loading') return <p>Đang tải công nợ...</p>
  if (debt === 'error' || debtLedger === 'error') return <p role="alert">Không tải được công nợ.</p>
  const hasLiveDebtLedger = customerDebtHasLiveLedger(debtLedger.debt)
  const totalDebt = hasLiveDebtLedger ? debtLedger.debt.total_debt : fallbackDebt
  const invoiceRows = debtLedger.invoiceHistory.length > 0
    ? debtLedger.invoiceHistory
    : debtLedger.debt.invoices.map((invoice) => ({
        id: invoice.order_id,
        code: invoice.order_code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
        debt_amount: invoice.remaining_debt,
        payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
        status: 'completed' as const,
        seller: { id: '', name: '' },
      }))
  const ledgerRows = (debtLedger.debt.ledger_rows?.length ?? 0) > 0
    ? customerDebtLedgerRowsFromBackend(debtLedger.debt)
    : buildCustomerDebtLedgerRows(
        invoiceRows,
        debtLedger.cashbookHistory,
        debtLedger.debt.adjustments ?? [],
        debtLedger.debt.linked_supplier_receipts ?? [],
        { currentTotal: totalDebt },
      )
  const totalPages = Math.max(1, Math.ceil(ledgerRows.length / ledgerPageSize))
  const safeLedgerPage = Math.min(Math.max(ledgerPage, 1), totalPages)
  const visibleLedgerRows = ledgerRows.slice((safeLedgerPage - 1) * ledgerPageSize, safeLedgerPage * ledgerPageSize)
  const summaryRows = buildCustomerDebtSummaryRows(invoiceRows, ledgerRows, totalDebt)
  const summaryTotalPages = Math.max(1, Math.ceil(summaryRows.length / ledgerPageSize))
  const safeSummaryPage = Math.min(Math.max(summaryPage, 1), summaryTotalPages)
  const visibleSummaryRows = summaryRows.slice((safeSummaryPage - 1) * ledgerPageSize, safeSummaryPage * ledgerPageSize)

  return (
    <section aria-label="Công nợ" className="customer-debt-panel">
      <div aria-label="Loại công nợ" className="customer-debt-view-toggle customer-history-type-toggle">
        <button aria-pressed={debtView === 'summary'} type="button" onClick={() => setDebtView('summary')}>
          Tóm tắt
        </button>
        <button aria-pressed={debtView === 'detail'} type="button" onClick={() => setDebtView('detail')}>
          Chi tiết
        </button>
      </div>
      {debtView === 'summary' ? (
        summaryRows.length > 0 ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Tóm tắt công nợ" className="customer-debt-summary-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Thời gian</th>
                    <th>Còn nợ</th>
                    <th>Công nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaryRows.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <ManagementRecordLink href={managementRecordOpenHref('/sales-documents', invoice.code, { type: 'invoice' })}>
                          {invoice.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{dateTime(invoice.created_at)}</td>
                      <td><MoneyText value={invoice.remaining_debt} /></td>
                      <td><MoneyText value={invoice.running_debt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang tóm tắt công nợ"
              entityLabel="hóa đơn mở"
              page={safeSummaryPage}
              pageSize={ledgerPageSize}
              pageSizeOptions={[ledgerPageSize]}
              total={summaryRows.length}
              canGoPrevious={safeSummaryPage > 1}
              canGoNext={safeSummaryPage < summaryTotalPages}
              onFirst={() => setSummaryPage(1)}
              onPrevious={() => setSummaryPage(Math.max(1, safeSummaryPage - 1))}
              onNext={() => setSummaryPage(Math.min(summaryTotalPages, safeSummaryPage + 1))}
              onLast={() => setSummaryPage(summaryTotalPages)}
              onPageChange={(nextPage) => setSummaryPage(nextPage)}
            />
          </>
        ) : <ManagementDetailInlineNote>Không có hóa đơn chưa thanh toán.</ManagementDetailInlineNote>
      ) : ledgerRows.length > 0 ? (
        <>
          <ManagementTableViewport>
            <table aria-label="Lịch sử công nợ" className="management-detail-table management-detail-linked-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Giá trị</th>
                  <th>Công nợ</th>
                </tr>
              </thead>
              <tbody>
                {visibleLedgerRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {'adjustment' in row && row.adjustment && /^CB/i.test(row.code) ? (
                        <button className="management-record-link customer-debt-record-button" type="button" onClick={() => {
                          if (row.adjustment) onOpenAdjustment(row.adjustment)
                        }}>
                          {row.code}
                        </button>
                      ) : row.href ? (
                        <ManagementRecordLink href={row.href}>
                          {row.code}
                        </ManagementRecordLink>
                      ) : <strong>{row.code}</strong>}
                    </td>
                    <td>{dateTime(row.created_at)}</td>
                    <td>{row.type}</td>
                    <td><MoneyText value={row.value_delta} /></td>
                    <td><MoneyText value={row.running_debt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang công nợ"
              entityLabel="dòng công nợ"
              page={safeLedgerPage}
              pageSize={ledgerPageSize}
              pageSizeOptions={[ledgerPageSize]}
              total={ledgerRows.length}
              canGoPrevious={safeLedgerPage > 1}
              canGoNext={safeLedgerPage < totalPages}
              onFirst={() => onLedgerPageChange(1)}
              onPrevious={() => onLedgerPageChange(Math.max(1, safeLedgerPage - 1))}
              onNext={() => onLedgerPageChange(Math.min(totalPages, safeLedgerPage + 1))}
              onLast={() => onLedgerPageChange(totalPages)}
              onPageChange={(nextPage) => onLedgerPageChange(nextPage)}
            />
        </>
      ) : <ManagementDetailInlineNote>Chưa có lịch sử công nợ.</ManagementDetailInlineNote>}
    </section>
  )
}

function CustomerHistoryPanel({
  history,
  historyType,
  historyPage,
  onSelectHistoryType,
  onHistoryPageChange,
}: {
  history: CustomerHistoryState | undefined
  historyType: CustomerHistoryType
  historyPage: number
  onSelectHistoryType: (historyType: CustomerHistoryType) => void
  onHistoryPageChange: (page: number) => void
}) {
  const codeHeader = historyType === 'invoice' ? 'Mã hóa đơn' : 'Mã báo giá'
  const historyPageSize = typeof history === 'object' ? history.pageSize : customerHistoryPageSize
  const historyTotal = typeof history === 'object' ? history.total : 0
  const totalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize))
  const safeHistoryPage = Math.min(Math.max(historyPage, 1), totalPages)
  const historyEntityLabel = historyType === 'invoice' ? 'hóa đơn' : 'báo giá'

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
        <>
          <ManagementTableViewport>
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
                    <td>
                      <ManagementRecordLink href={managementRecordOpenHref('/sales-documents', document.code, { type: historyType })}>
                        {document.code}
                      </ManagementRecordLink>
                    </td>
                    <td>{dateTime(document.created_at)}</td>
                    <td>{document.seller.name || ''}</td>
                    <td><MoneyText value={document.total_amount} /></td>
                    <td>{salesDocumentStatusText(document)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel={`Phân trang lịch sử ${historyEntityLabel}`}
              entityLabel={historyEntityLabel}
              page={safeHistoryPage}
              pageSize={historyPageSize}
              pageSizeOptions={[historyPageSize]}
              total={historyTotal}
              canGoPrevious={safeHistoryPage > 1}
              canGoNext={safeHistoryPage < totalPages}
              onFirst={() => onHistoryPageChange(1)}
              onPrevious={() => onHistoryPageChange(Math.max(1, safeHistoryPage - 1))}
              onNext={() => onHistoryPageChange(Math.min(totalPages, safeHistoryPage + 1))}
              onLast={() => onHistoryPageChange(totalPages)}
              onPageChange={(nextPage) => onHistoryPageChange(nextPage)}
            />
        </>
      ) : null}
    </section>
  )
}

type CustomerDebtAdjustmentForm = {
  adjustmentId: string
  adjustedAt: string
  adjustedAtIso: string | null
  amount: string
  note: string
}

function parseCustomerDebtAdjustmentDateTime(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!match) return null
  const [, day, month, year, hour = '0', minute = '00'] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatCustomerDebtAdjustmentDateTime(value: Date) {
  return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

function customerDebtAdjustmentCalendarDays(month: Date) {
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstDate.getDay() + 6) % 7
  const startDate = new Date(firstDate)
  startDate.setDate(firstDate.getDate() - offset)
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return date
  })
}

const customerDebtAdjustmentTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

function CustomerDebtPaymentDialog({
  customer,
  collectorName,
  debt,
  fallbackDebt,
  form,
  saving,
  error,
  canSave,
  onChange,
  onClose,
  onSubmit,
}: {
  customer: Customer
  collectorName: string
  debt: CustomerDebtLedgerState | undefined
  fallbackDebt: number
  form: CustomerDebtPaymentForm
  saving: boolean
  error: string | null
  canSave: boolean
  onChange: (form: CustomerDebtPaymentForm) => void
  onClose: () => void
  onSubmit: (form: CustomerDebtPaymentForm, currentDebt: number, paymentRows: CustomerDebtPaymentRow[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState<'date' | 'time' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = currentSystemDate()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const selectedPaidDateTime = parseCustomerDebtAdjustmentDateTime(form.paidAt)
  const calendarDays = customerDebtAdjustmentCalendarDays(calendarMonth)
  const updateField = (field: keyof CustomerDebtPaymentForm, value: string | boolean | Record<string, string>) => {
    onChange({ ...form, [field]: value })
  }
  const selectPaidDate = (date: Date) => {
    const base = selectedPaidDateTime ?? currentSystemDate()
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())
    updateField('paidAt', formatCustomerDebtAdjustmentDateTime(next))
    setPickerOpen(null)
  }
  const selectPaidTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const base = selectedPaidDateTime ?? currentSystemDate()
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    updateField('paidAt', formatCustomerDebtAdjustmentDateTime(next))
    setPickerOpen(null)
  }
  const currentDebt = customerDebtCurrentAmount(debt, fallbackDebt)
  const invoiceRows = typeof debt === 'object'
    ? debt.invoiceHistory.length > 0
      ? debt.invoiceHistory
      : debt.debt.invoices.map((invoice) => ({
          id: invoice.order_id,
          code: invoice.order_code,
          created_at: invoice.created_at,
          total_amount: invoice.total_amount,
          paid_amount: invoice.paid_amount,
          debt_amount: invoice.remaining_debt,
          payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
          status: 'completed' as const,
          seller: { id: '', name: '' },
        }))
    : []
  const ledgerRows = typeof debt === 'object'
    ? (debt.debt.ledger_rows?.length ?? 0) > 0
      ? customerDebtLedgerRowsFromBackend(debt.debt)
      : buildCustomerDebtLedgerRows(
          invoiceRows,
          debt.cashbookHistory,
          debt.debt.adjustments ?? [],
          debt.debt.linked_supplier_receipts ?? [],
          { currentTotal: currentDebt },
        )
    : []
  const summaryRows = buildCustomerDebtSummaryRows(invoiceRows, ledgerRows, currentDebt)
  const hasManualInvoicePayments = Object.values(form.invoicePayments).some((value) => parseMoneyInput(value) > 0)
  const manualPaymentAmount = summaryRows.reduce((sum, row) => sum + Math.min(parseMoneyInput(form.invoicePayments[row.id] ?? ''), row.remaining_debt), 0)
  const paymentAmount = hasManualInvoicePayments ? manualPaymentAmount : parseMoneyInput(form.amount)
  const paymentRows = hasManualInvoicePayments
    ? summaryRows.map((row) => ({
        ...row,
        paid_before: Math.max(row.total_amount - row.remaining_debt, 0),
        payment_amount: Math.min(parseMoneyInput(form.invoicePayments[row.id] ?? ''), row.remaining_debt),
      }))
    : buildCustomerDebtPaymentRows(summaryRows, paymentAmount)
  const allocatedAmount = paymentRows.reduce((sum, row) => sum + row.payment_amount, 0)
  const unallocatedAmount = Math.max(paymentAmount - allocatedAmount, 0)
  const collectorLabel = collectorName.trim() || customer.created_by?.name || 'Chưa xác định'
  const updateAmount = (value: string) => {
    const digits = value.replace(/\D/g, '')
    onChange({ ...form, amount: digits === '' ? '' : formatMoney(Number(digits)), invoicePayments: {} })
  }
  const updateInvoicePayment = (row: CustomerDebtPaymentRow, value: string) => {
    const digits = value.replace(/\D/g, '')
    const nextAmount = digits === '' ? 0 : Math.min(Number(digits), row.remaining_debt)
    const nextInvoicePayments = {
      ...form.invoicePayments,
      [row.id]: nextAmount > 0 ? formatMoney(nextAmount) : '',
    }
    const nextTotal = summaryRows.reduce((sum, summaryRow) => {
      const rawValue = summaryRow.id === row.id ? nextInvoicePayments[summaryRow.id] : form.invoicePayments[summaryRow.id] ?? ''
      return sum + Math.min(parseMoneyInput(rawValue), summaryRow.remaining_debt)
    }, 0)
    onChange({ ...form, amount: nextTotal > 0 ? formatMoney(nextTotal) : '', invoicePayments: nextInvoicePayments })
  }
  const canSubmit = canSave
    && !saving
    && paymentAmount > 0
    && paymentAmount <= currentDebt
    && debt !== undefined
    && debt !== 'loading'
    && debt !== 'error'
    && summaryRows.length > 0

  return (
    <div className="management-modal-backdrop">
      <section aria-label={`Thanh toán công nợ ${customer.code}`} aria-modal="true" className="management-modal-dialog customer-debt-payment-dialog" role="dialog">
        <header className="management-modal-header">
          <div>
            <h2>Thanh toán</h2>
            <p>{customer.name} · Nợ hiện tại: {formatMoney(currentDebt)} · Người thu: {collectorLabel}</p>
          </div>
          <button aria-label="Đóng thanh toán công nợ" className="management-icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form
          aria-label="Thanh toán công nợ"
          className="management-modal-form customer-debt-payment-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(form, currentDebt, paymentRows)
          }}
        >
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          {debt === undefined || debt === 'loading' ? <p>Đang tải hóa đơn công nợ...</p> : null}
          {debt === 'error' ? <p role="alert">Không tải được hóa đơn công nợ.</p> : null}
          <div className="customer-debt-payment-grid">
            <label>
              <span>Thời gian</span>
              <span className="customer-debt-adjustment-input-shell">
                <input
                  placeholder="dd/mm/yyyy hh:mm"
                  value={form.paidAt}
                  onChange={(event) => updateField('paidAt', event.target.value)}
                />
                <button aria-expanded={pickerOpen === 'date'} aria-label="Chọn ngày thanh toán" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-date" type="button" onClick={() => setPickerOpen((current) => current === 'date' ? null : 'date')}>
                  <CalendarDays size={15} />
                </button>
                <button aria-expanded={pickerOpen === 'time'} aria-label="Chọn giờ thanh toán" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-time" type="button" onClick={() => setPickerOpen((current) => current === 'time' ? null : 'time')}>
                  <Clock3 size={15} />
                </button>
                {pickerOpen === 'date' ? (
                  <section aria-label="Lịch chọn ngày thanh toán" className="customer-debt-adjustment-picker customer-debt-adjustment-date-picker">
                    <header>
                      <button aria-label="Tháng trước" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                        ‹
                      </button>
                      <strong>Tháng {calendarMonth.getMonth() + 1} {calendarMonth.getFullYear()}</strong>
                      <button aria-label="Tháng sau" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                        ›
                      </button>
                    </header>
                    <div className="customer-debt-adjustment-weekdays" aria-hidden="true">
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="customer-debt-adjustment-calendar-grid">
                      {calendarDays.map((date) => {
                        const selected = selectedPaidDateTime ? date.toDateString() === selectedPaidDateTime.toDateString() : false
                        return (
                          <button
                            aria-pressed={selected}
                            className={date.getMonth() === calendarMonth.getMonth() ? undefined : 'customer-debt-adjustment-muted-day'}
                            key={date.toISOString()}
                            type="button"
                            onClick={() => selectPaidDate(date)}
                          >
                            {date.getDate()}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ) : null}
                {pickerOpen === 'time' ? (
                  <section aria-label="Chọn giờ thanh toán" className="customer-debt-adjustment-picker customer-debt-adjustment-time-picker">
                    {customerDebtAdjustmentTimeOptions.map((time) => (
                      <button key={time} type="button" onClick={() => selectPaidTime(time)}>
                        {time}
                      </button>
                    ))}
                  </section>
                ) : null}
              </span>
            </label>
            <label>
              <span>Phương thức TT</span>
              <select value={form.method} onChange={(event) => updateField('method', event.target.value)}>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
              </select>
            </label>
          </div>
          <label className="customer-debt-payment-full">
            <span>Số tiền</span>
            <input
              aria-label="Số tiền"
              autoFocus
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => updateAmount(event.target.value)}
            />
            <small>Nợ còn: {formatMoney(currentDebt - paymentAmount)}</small>
          </label>
          <label className="customer-debt-payment-full">
            <span>Ghi chú</span>
            <input placeholder="Nhập ghi chú" value={form.note} onChange={(event) => updateField('note', event.target.value)} />
          </label>
          <label className="customer-debt-payment-checkbox">
            <input checked={form.allocateToInvoices} type="checkbox" onChange={(event) => updateField('allocateToInvoices', event.target.checked)} />
            <span>Phân bổ vào hóa đơn</span>
          </label>
          {form.allocateToInvoices ? (
            <section aria-label="Phân bổ hóa đơn công nợ" className="customer-debt-payment-allocation">
              <ManagementTableViewport>
                <table aria-label="Danh sách phân bổ hóa đơn công nợ" className="customer-debt-payment-table">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Thời gian</th>
                      <th>Giá trị hóa đơn</th>
                      <th>Đã thu trước</th>
                      <th>Còn cần thu</th>
                      <th>Tiền thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <ManagementRecordLink href={managementRecordOpenHref('/sales-documents', row.code, { type: 'invoice' })}>
                            {row.code}
                          </ManagementRecordLink>
                        </td>
                        <td>{dateTime(row.created_at)}</td>
                        <td><MoneyText value={row.total_amount} /></td>
                        <td><MoneyText value={row.paid_before} /></td>
                        <td><MoneyText value={row.remaining_debt} /></td>
                        <td>
                          <input
                            aria-label={`Tiền thu ${row.code}`}
                            inputMode="numeric"
                            value={row.payment_amount > 0 ? formatMoney(row.payment_amount) : ''}
                            onChange={(event) => updateInvoicePayment(row, event.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ManagementTableViewport>
              <div className="customer-debt-payment-unallocated">
                <span>Tiền chưa phân bổ:</span>
                <strong>{formatMoney(unallocatedAmount)}</strong>
              </div>
            </section>
          ) : null}
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>
              Bỏ qua
            </button>
            <button className="button button-secondary" disabled={!canSubmit} type="submit">
              Tạo phiếu thu & In
            </button>
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              Tạo phiếu thu
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function CustomerDebtAdjustmentDialog({
  customer,
  currentDebt,
  form,
  onChange,
  onClose,
  saving,
  error,
  canSave,
  onSubmit,
}: {
  customer: Customer
  currentDebt: number
  form: CustomerDebtAdjustmentForm
  onChange: (form: CustomerDebtAdjustmentForm) => void
  onClose: () => void
  saving: boolean
  error: string | null
  canSave: boolean
  onSubmit: (form: CustomerDebtAdjustmentForm) => void
}) {
  const selectedAdjustmentDateTime = parseCustomerDebtAdjustmentDateTime(form.adjustedAt)
  const [pickerOpen, setPickerOpen] = useState<'date' | 'time' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = currentSystemDate()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const calendarDays = customerDebtAdjustmentCalendarDays(calendarMonth)
  const canSubmit = canSave && !saving && form.adjustmentId.trim() !== '' && selectedAdjustmentDateTime !== null && parseMoneyInput(form.amount) > 0
  const updateField = (field: keyof CustomerDebtAdjustmentForm, value: string) => {
    onChange({ ...form, [field]: value })
  }
  const selectAdjustmentDate = (date: Date) => {
    const base = selectedAdjustmentDateTime ?? currentSystemDate()
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())
    onChange({ ...form, adjustedAt: formatCustomerDebtAdjustmentDateTime(next), adjustedAtIso: dateTimeStoredIsoFromLocalClock(next) })
    setPickerOpen(null)
  }
  const selectAdjustmentTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const base = selectedAdjustmentDateTime ?? currentSystemDate()
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    onChange({ ...form, adjustedAt: formatCustomerDebtAdjustmentDateTime(next), adjustedAtIso: dateTimeStoredIsoFromLocalClock(next) })
    setPickerOpen(null)
  }

  return (
    <div className="management-modal-backdrop">
      <section aria-label={`Điều chỉnh công nợ ${customer.code}`} aria-modal="true" className="management-modal-dialog management-modal-dialog-compact customer-debt-adjustment-dialog" role="dialog">
        <header className="management-modal-header">
          <h2>
            Điều chỉnh
            <span aria-label="Thông tin điều chỉnh công nợ" className="customer-debt-adjustment-info">
              <Info aria-hidden="true" size={13} />
            </span>
          </h2>
          <button aria-label="Đóng điều chỉnh công nợ" className="management-icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form
          aria-label="Điều chỉnh công nợ"
          className="management-modal-form customer-debt-adjustment-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) onSubmit(form)
          }}
        >
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          <div className="customer-debt-adjustment-row">
            <span>Nợ cần thu hiện tại</span>
            <strong>{formatMoney(currentDebt)}</strong>
          </div>
          <label>
            <span>Ngày điều chỉnh</span>
            <span className="customer-debt-adjustment-input-shell">
              <input
                placeholder="dd/mm/yyyy hh:mm"
                value={form.adjustedAt}
                onChange={(event) => updateField('adjustedAt', event.target.value)}
              />
              <button aria-expanded={pickerOpen === 'date'} aria-label="Chọn ngày điều chỉnh" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-date" type="button" onClick={() => setPickerOpen((current) => current === 'date' ? null : 'date')}>
                <CalendarDays size={15} />
              </button>
              <button aria-expanded={pickerOpen === 'time'} aria-label="Chọn giờ điều chỉnh" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-time" type="button" onClick={() => setPickerOpen((current) => current === 'time' ? null : 'time')}>
                <Clock3 size={15} />
              </button>
              {pickerOpen === 'date' ? (
                <section aria-label="Lịch chọn ngày điều chỉnh" className="customer-debt-adjustment-picker customer-debt-adjustment-date-picker">
                  <header>
                    <button aria-label="Tháng trước" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                      ‹
                    </button>
                    <strong>Tháng {calendarMonth.getMonth() + 1} {calendarMonth.getFullYear()}</strong>
                    <button aria-label="Tháng sau" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                      ›
                    </button>
                  </header>
                  <div className="customer-debt-adjustment-weekdays" aria-hidden="true">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="customer-debt-adjustment-calendar-grid">
                    {calendarDays.map((date) => {
                      const selected = selectedAdjustmentDateTime
                        ? date.toDateString() === selectedAdjustmentDateTime.toDateString()
                        : false
                      return (
                        <button
                          aria-pressed={selected}
                          className={date.getMonth() === calendarMonth.getMonth() ? undefined : 'customer-debt-adjustment-muted-day'}
                          key={date.toISOString()}
                          type="button"
                          onClick={() => selectAdjustmentDate(date)}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}
              {pickerOpen === 'time' ? (
                <section aria-label="Chọn giờ điều chỉnh" className="customer-debt-adjustment-picker customer-debt-adjustment-time-picker">
                  {customerDebtAdjustmentTimeOptions.map((time) => (
                    <button key={time} type="button" onClick={() => selectAdjustmentTime(time)}>
                      {time}
                    </button>
                  ))}
                </section>
              ) : null}
            </span>
          </label>
          <label>
            <span>Giá trị nợ điều chỉnh</span>
            <input
              autoFocus
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => updateField('amount', event.target.value)}
            />
          </label>
          <label>
            <span>Mô tả</span>
            <span className="customer-debt-adjustment-input-shell">
              <input
                value={form.note}
                onChange={(event) => updateField('note', event.target.value)}
              />
              <span aria-hidden="true" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-left">
                <Pencil size={15} />
              </span>
            </span>
          </label>
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>
              Bỏ qua
            </button>
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              {saving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </footer>
        </form>
      </section>
    </div>
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

