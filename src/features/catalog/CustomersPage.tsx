import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  FileDown,
  Lock,
  Network,
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
import { parseQcvDateTimeInputToStoredIso } from '../../lib/date-format'
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
import type { OrderService } from '../orders/order-service'
import type { FinanceService } from '../finance/finance-service'
import type { FinanceAccount } from '../finance/types'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'
import { buildCustomerListFilters, customerHistoryKey, type CustomerHistoryType } from './customer-filters'
import {
  customerDate,
  customerDateTime as dateTime,
  customerSalesDocumentStatusText as salesDocumentStatusText,
  customerVisibleSummary,
} from './customer-presenter'
import { CustomerCreateDialog, createCustomerFormDefaults } from './CustomerCreateDialog'
import { CustomerImportDialog } from './CustomerImportDialog'
import { CustomerDebtPanel, type CustomerDebtState } from './CustomerDebtPanel'
import { CustomerDebtAdjustmentDialog } from './CustomerDebtAdjustmentDialog'
import { formatCustomerDebtAdjustmentDateTime, type CustomerDebtAdjustmentForm } from './customer-debt-adjustment-form'
import {
  customerDebtCurrentAmount,
  type CustomerDebtPaymentRow,
} from './customer-debt-ledger'
import {
  CustomerDebtPaymentDialog,
  type CustomerDebtLedgerState,
  type CustomerDebtPaymentForm,
} from './CustomerDebtPaymentDialog'

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

type CustomerHistoryState = { items: SalesDocumentListItem[]; page: number; pageSize: number; total: number } | 'loading' | 'error'
type CustomerDetailTab = 'info' | 'debt' | 'history'
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
    bankAccountId: '',
    amount: '',
    note: '',
    allocateToInvoices: true,
    invoicePayments: {},
  }))
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
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
      bankAccountId: '',
      amount: '',
      note: '',
      allocateToInvoices: true,
      invoicePayments: {},
    })
    financeService?.listAccounts?.({ is_active: true })
      .then((result) => setFinanceAccounts(result.items))
      .catch(() => setFinanceAccounts([]))
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
    if (form.method === 'bank_transfer' && form.bankAccountId.trim() === '') {
      setDebtPaymentError('Chọn tài khoản ngân hàng khi thu chuyển khoản.')
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
          ...(form.method === 'bank_transfer' ? { bank_account_id: form.bankAccountId } : {}),
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
          financeAccounts={financeAccounts}
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

