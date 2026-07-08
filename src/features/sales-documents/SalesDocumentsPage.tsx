import { Fragment, useEffect, useState, type MouseEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, Pencil, Printer, Save, Search, Trash2 } from 'lucide-react'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDetailActionFooter,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import { paymentSettlementStatusLabel, paymentSettlementStatusTone, type PaymentSettlementStatus } from '../../components/ui-shell/payment-status'
import { formatApiError } from '../../lib/api/error-message'
import type { SalesDocumentDetail, SalesDocumentListItem } from './types'
import type { SalesDocumentService } from './sales-document-service'
import type { OrderService, QuoteReopenPayload } from '../orders/order-service'
import type { CatalogService } from '../catalog/catalog-service'
import type { FoundationService } from '../users/foundation-service'

function dateTime(value: string | null | undefined, fallback?: string | null): string {
  if (!value) return fallback ? dateTime(fallback) : '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback ? dateTime(fallback) : '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed)
}

const salesDocumentsPageSize = 15
type TimeFilter = 'all' | 'today' | 'yesterday' | 'week' | 'last_week' | 'last_7_days' | 'month' | 'last_month' | 'last_30_days' | 'quarter' | 'last_quarter' | 'year' | 'last_year' | 'custom'

const quickTimeGroups: Array<{ title: string; presets: Array<Exclude<TimeFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]

const quickTimeLabels: Record<TimeFilter, string> = {
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

function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function currentMonthRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: localDateString(firstDay), to: localDateString(lastDay) }
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function quickTimeRange(preset: Exclude<TimeFilter, 'custom'>) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const currentQuarter = Math.floor(today.getMonth() / 3)

  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'today') return { from: localDateString(today), to: localDateString(today) }
  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1)
    return { from: localDateString(yesterday), to: localDateString(yesterday) }
  }
  if (preset === 'week') {
    const firstDay = addDays(today, mondayOffset)
    return { from: localDateString(firstDay), to: localDateString(addDays(firstDay, 6)) }
  }
  if (preset === 'last_week') {
    const firstDay = addDays(today, mondayOffset - 7)
    return { from: localDateString(firstDay), to: localDateString(addDays(firstDay, 6)) }
  }
  if (preset === 'last_7_days') return { from: localDateString(addDays(today, -6)), to: localDateString(today) }
  if (preset === 'month') return currentMonthRange()
  if (preset === 'last_month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'last_30_days') return { from: localDateString(addDays(today, -29)), to: localDateString(today) }
  if (preset === 'quarter') {
    const firstDay = new Date(today.getFullYear(), currentQuarter * 3, 1)
    const lastDay = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'last_quarter') {
    const firstDay = new Date(today.getFullYear(), currentQuarter * 3 - 3, 1)
    const lastDay = new Date(today.getFullYear(), currentQuarter * 3, 0)
    return { from: localDateString(firstDay), to: localDateString(lastDay) }
  }
  if (preset === 'year') {
    return { from: localDateString(new Date(today.getFullYear(), 0, 1)), to: localDateString(new Date(today.getFullYear(), 11, 31)) }
  }
  return { from: localDateString(new Date(today.getFullYear() - 1, 0, 1)), to: localDateString(new Date(today.getFullYear() - 1, 11, 31)) }
}

function displayDate(value: string) {
  if (!value) return '--/--/----'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

interface SalesDocumentsState {
  items: SalesDocumentListItem[]
  total: number
  page: number
  pageSize: number
}

type PaymentStatusFilter = 'all' | 'unpaid' | 'partial' | 'paid'
type PaymentMethodFilter = 'all' | 'cash' | 'bank_transfer'

export function SalesDocumentsPage({
  service,
  orderService,
  userService,
  catalogService,
  onCreateSalesDocument,
  onOpenQuoteInPos,
  onOpenQuotePrint,
}: {
  service: SalesDocumentService
  orderService?: Pick<OrderService, 'getQuoteReopenPayload'>
  userService?: Pick<FoundationService, 'listUsers'>
  catalogService?: Pick<CatalogService, 'listPriceLists'>
  onCreateSalesDocument?: () => void
  onOpenDashboard: () => void
  onOpenQuoteInPos?: (payload: QuoteReopenPayload) => void
  onOpenQuotePrint?: (documentId: string) => void
}) {
  const [state, setState] = useState<SalesDocumentsState | null>(null)
  const [search, setSearch] = useState('')
  const [lastSearch, setLastSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'invoice' | 'quote'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')
  const [sellerFilter, setSellerFilter] = useState('all')
  const [priceListFilter, setPriceListFilter] = useState('all')
  const [sellerOptions, setSellerOptions] = useState<Array<{ id: string; name: string }>>([])
  const [priceListOptions, setPriceListOptions] = useState<Array<{ id: string; name: string }>>([])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from)
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to)
  const [quickTimeOpen, setQuickTimeOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [selected, setSelected] = useState<SalesDocumentDetail | null>(null)
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailErrorDocumentId, setDetailErrorDocumentId] = useState<string | null>(null)
  const [openingQuoteId, setOpeningQuoteId] = useState<string | null>(null)

  async function loadDocuments(input: {
    search?: string
    type?: typeof typeFilter
    status?: typeof statusFilter
    paymentStatus?: PaymentStatusFilter
    paymentMethod?: PaymentMethodFilter
    seller?: string
    priceList?: string
    time?: typeof timeFilter
    from?: string
    to?: string
    page?: number
    page_size?: number
  } = {}) {
    const nextSearch = input.search ?? lastSearch
    const nextType = input.type ?? typeFilter
    const nextStatus = input.status ?? statusFilter
    const nextPaymentStatus = input.paymentStatus ?? paymentStatusFilter
    const nextPaymentMethod = input.paymentMethod ?? paymentMethodFilter
    const nextSeller = input.seller ?? sellerFilter
    const nextPriceList = input.priceList ?? priceListFilter
    const nextTime = input.time ?? timeFilter
    const nextFrom = input.from ?? dateFrom
    const nextTo = input.to ?? dateTo
    const nextPage = input.page ?? state?.page ?? 1
    const nextPageSize = input.page_size ?? state?.pageSize ?? salesDocumentsPageSize
    setError(null)
    try {
      const result = await service.listSalesDocuments({
        ...(nextSearch ? { search: nextSearch } : {}),
        ...(nextType === 'all' ? {} : { type: nextType }),
        ...(nextStatus === 'all' ? {} : { status: nextStatus }),
        ...(nextPaymentStatus === 'all' ? {} : { payment_status: nextPaymentStatus }),
        ...(nextPaymentMethod === 'all' ? {} : { payment_method: nextPaymentMethod }),
        ...(nextSeller === 'all' ? {} : { created_by: nextSeller }),
        ...(nextPriceList === 'all' ? {} : { price_list_id: nextPriceList }),
        ...(nextTime !== 'all' && nextFrom ? { from: nextFrom } : {}),
        ...(nextTime !== 'all' && nextTo ? { to: nextTo } : {}),
        page: nextPage,
        page_size: nextPageSize,
      })
      setState({ items: result.items, total: result.total, page: result.page, pageSize: result.page_size })
      if (result.items.length === 0) setSelected(null)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chứng từ bán hàng.'))
    }
  }

  async function openQuoteInPos(document: SalesDocumentListItem) {
    if (orderService === undefined || onOpenQuoteInPos === undefined) return
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setOpeningQuoteId(document.id)
    try {
      const payload = await orderService.getQuoteReopenPayload(document.id)
      onOpenQuoteInPos(payload)
    } catch (cause) {
      setSelected(null)
      setDetailError(formatApiError(cause, 'Không mở được báo giá tại POS.'))
      setDetailErrorDocumentId(document.id)
    } finally {
      setOpeningQuoteId(null)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialDocuments() {
      setError(null)
      try {
        const monthRange = currentMonthRange()
        const result = await service.listSalesDocuments({
          from: monthRange.from,
          to: monthRange.to,
          page: 1,
          page_size: salesDocumentsPageSize,
        })
        if (!active) return
        setState({ items: result.items, total: result.total, page: result.page, pageSize: result.page_size })
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được chứng từ bán hàng.'))
      }
    }

    void loadInitialDocuments()

    return () => {
      active = false
    }
  }, [service])

  useEffect(() => {
    let active = true

    async function loadFilterOptions() {
      const [users, priceLists] = await Promise.all([
        userService?.listUsers({ status: 'active' }),
        catalogService?.listPriceLists(),
      ])
      if (!active) return
      setSellerOptions((users?.items ?? []).map((user) => ({ id: user.id, name: user.display_name })))
      setPriceListOptions((priceLists?.items ?? []).filter((priceList) => priceList.is_active).map((priceList) => ({ id: priceList.id, name: priceList.name })))
    }

    void loadFilterOptions()

    return () => {
      active = false
    }
  }, [catalogService, userService])

  async function searchDocuments(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = search.trim()
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setLastSearch(trimmed)
    setQuickTimeOpen(false)
    await loadDocuments({ search: trimmed, page: 1 })
  }

  async function applyTypeFilter(nextType: typeof typeFilter) {
    setTypeFilter(nextType)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ type: nextType, page: 1 })
  }

  async function applyStatusFilter(nextStatus: typeof statusFilter) {
    setStatusFilter(nextStatus)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ status: nextStatus, page: 1 })
  }

  async function applyPaymentStatusFilter(nextPaymentStatus: PaymentStatusFilter) {
    setPaymentStatusFilter(nextPaymentStatus)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ paymentStatus: nextPaymentStatus, page: 1 })
  }

  async function applyPaymentMethodFilter(nextPaymentMethod: PaymentMethodFilter) {
    setPaymentMethodFilter(nextPaymentMethod)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ paymentMethod: nextPaymentMethod, page: 1 })
  }

  async function applySellerFilter(nextSeller: string) {
    setSellerFilter(nextSeller)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ seller: nextSeller, page: 1 })
  }

  async function applyPriceListFilter(nextPriceList: string) {
    setPriceListFilter(nextPriceList)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ priceList: nextPriceList, page: 1 })
  }

  async function applyQuickTimeFilter(nextTime: Exclude<TimeFilter, 'custom'>) {
    const range = quickTimeRange(nextTime)
    setTimeFilter(nextTime)
    setDateFrom(range.from)
    setDateTo(range.to)
    setQuickTimeOpen(false)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ time: nextTime, from: range.from, to: range.to, page: 1 })
  }

  async function applyCustomDateFilter(next: { from?: string; to?: string }) {
    const nextFrom = next.from ?? dateFrom
    const nextTo = next.to ?? dateTo
    setTimeFilter('custom')
    setDateFrom(nextFrom)
    setDateTo(nextTo)
    setQuickTimeOpen(false)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ time: 'custom', from: nextFrom, to: nextTo, page: 1 })
  }

  async function goToPage(nextPage: number) {
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ page: nextPage })
  }

  function isDetailInteractionTarget(target: EventTarget | null) {
    return target instanceof Element && target.closest('.management-inline-detail, .management-detail-row, .management-detail-panel') !== null
  }

  function isOutsideRowClick(event: MouseEvent<HTMLTableRowElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }

  async function openDocument(document: SalesDocumentListItem) {
    if (selected?.id === document.id) {
      setSelected(null)
      setLoadingDocumentId(null)
      setDetailError(null)
      setDetailErrorDocumentId(null)
      return
    }

    setDetailError(null)
    setDetailErrorDocumentId(null)
    setSelected(null)
    setLoadingDocumentId(document.id)
    try {
      setSelected(await service.getSalesDocument(document.id))
    } catch (cause) {
      setDetailError(formatApiError(cause, 'Không tải được chi tiết chứng từ.'))
      setDetailErrorDocumentId(document.id)
    } finally {
      setLoadingDocumentId(null)
    }
  }

  const documents = state?.items ?? []
  const total = state?.total ?? 0
  const page = state?.page ?? 1
  const pageSize = state?.pageSize ?? salesDocumentsPageSize
  const hasFilter = lastSearch.length > 0 || typeFilter !== 'all' || statusFilter !== 'all' || paymentStatusFilter !== 'all' || paymentMethodFilter !== 'all' || sellerFilter !== 'all' || priceListFilter !== 'all' || timeFilter !== 'month'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = [
    ...(lastSearch ? [`Tìm: ${lastSearch}`] : []),
    ...(timeFilter === 'custom' ? [`Thời gian: ${dateFrom || '...'} - ${dateTo || '...'}`] : []),
    ...(timeFilter !== 'month' && timeFilter !== 'custom' ? [`Thời gian: ${quickTimeLabels[timeFilter]}`] : []),
    ...(typeFilter !== 'all' ? [`Loại: ${documentTypeFilterLabel(typeFilter)}`] : []),
    ...(statusFilter !== 'all' ? [`Trạng thái: ${lifecycleFilterLabel(statusFilter)}`] : []),
    ...(paymentStatusFilter !== 'all' ? [`Thanh toán: ${paymentStatusFilterLabel(paymentStatusFilter)}`] : []),
    ...(paymentMethodFilter !== 'all' ? [`PTTT: ${paymentMethodFilterLabel(paymentMethodFilter)}`] : []),
    ...(sellerFilter !== 'all' ? [`Người bán: ${sellerOptions.find((seller) => seller.id === sellerFilter)?.name ?? sellerFilter}`] : []),
    ...(priceListFilter !== 'all' ? [`Bảng giá: ${priceListOptions.find((priceList) => priceList.id === priceListFilter)?.name ?? priceListFilter}`] : []),
  ].join(' • ')
  const documentTotalAmount = documents.reduce((sum, document) => sum + document.total_amount, 0)
  const documentDebtAmount = documents.reduce((sum, document) => sum + document.debt_amount, 0)
  const documentKpis = (
    <MetricGrid ariaLabel="Tổng quan chứng từ bán hàng">
      <MetricCard hint="Từ danh sách đang xem" label="Tổng tiền" tone="success" value={<MoneyText value={documentTotalAmount} />} />
      <MetricCard hint="Từ danh sách đang xem" label="Còn nợ" tone={documentDebtAmount > 0 ? 'warning' : 'neutral'} value={<MoneyText value={documentDebtAmount} />} />
    </MetricGrid>
  )

  return (
    <ManagementPage
      title="Chứng từ bán hàng"
      actions={
        <ManagementCompactToolbar ariaLabel="Lọc chứng từ bán hàng" onSubmit={searchDocuments}>
          <ManagementCompactSearch
            label="Tìm chứng từ"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Mã chứng từ, khách hàng, ghi chú"
            trailingAction={
              onCreateSalesDocument ? (
                <ManagementCompactCreateAction ariaLabel="Tạo chứng từ bán hàng" onClick={onCreateSalesDocument} />
              ) : undefined
            }
            value={search}
            onChange={setSearch}
          />
        </ManagementCompactToolbar>
      }
      kpis={documentKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary || undefined}
          ariaLabel="Bộ lọc chứng từ bán hàng"
          popoverOpen={quickTimeOpen}
          title="Bộ lọc"
        >
          <button
            aria-label="Ẩn bộ lọc chứng từ bán hàng"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <ManagementFilterGroup title="Thời gian">
            <div className="management-filter-time-options">
              <div
                className={`management-filter-choice${timeFilter !== 'custom' ? ' management-filter-choice-active' : ''}`}
                aria-expanded={quickTimeOpen}
                onClick={() => {
                  if (timeFilter === 'custom') void applyQuickTimeFilter('month')
                  else setQuickTimeOpen((current) => !current)
                }}
              >
                <input
                  aria-label={timeFilter === 'custom' ? quickTimeLabels.month : quickTimeLabels[timeFilter]}
                  checked={timeFilter !== 'custom'}
                  name="sales-document-time"
                  readOnly
                  type="radio"
                  onChange={() => undefined}
                />
                <span>{timeFilter === 'custom' ? quickTimeLabels.month : quickTimeLabels[timeFilter]}</span>
                <span className="management-filter-choice-trailing">
                  <ChevronRight aria-hidden="true" size={17} />
                </span>
              </div>
              <label className={`management-filter-choice${timeFilter === 'custom' ? ' management-filter-choice-active' : ''}`}>
                <input
                  aria-label="Tùy chỉnh"
                  checked={timeFilter === 'custom'}
                  name="sales-document-time"
                  type="radio"
                  onChange={() => void applyCustomDateFilter({})}
                />
                <span>{timeFilter === 'custom' ? `${displayDate(dateFrom)} - ${displayDate(dateTo)}` : 'Tùy chỉnh'}</span>
                <CalendarDays aria-hidden="true" size={17} />
              </label>
            </div>
            {quickTimeOpen ? (
              <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                {quickTimeGroups.map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    <div>
                      {group.presets.map((preset) => (
                        <button
                          className={timeFilter === preset ? 'management-filter-quick-time-active' : undefined}
                          key={preset}
                          type="button"
                          onClick={() => void applyQuickTimeFilter(preset)}
                        >
                          {quickTimeLabels[preset]}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
            {timeFilter === 'custom' ? (
              <div className="management-filter-date-range">
                <label>
                  <span>Từ ngày</span>
                  <input
                    aria-label="Từ ngày"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => void applyCustomDateFilter({ from: event.target.value })}
                  />
                </label>
                <label>
                  <span>Đến ngày</span>
                  <input
                    aria-label="Đến ngày"
                    type="date"
                    value={dateTo}
                    onChange={(event) => void applyCustomDateFilter({ to: event.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Loại chứng từ">
            <select
              aria-label="Loại chứng từ"
              className="management-filter-select"
              value={typeFilter}
              onChange={(event) => void applyTypeFilter(event.target.value as typeof typeFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="invoice">Hóa đơn</option>
              <option value="quote">Báo giá</option>
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Trạng thái chứng từ">
            <select
              aria-label="Trạng thái chứng từ"
              className="management-filter-select"
              value={statusFilter}
              onChange={(event) => void applyStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hiệu lực</option>
              <option value="completed">Hoàn tất</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Thanh toán">
            <select
              aria-label="Thanh toán"
              className="management-filter-select"
              value={paymentStatusFilter}
              onChange={(event) => void applyPaymentStatusFilter(event.target.value as PaymentStatusFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="partial">Thanh toán một phần</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Phương thức thanh toán">
            <select
              aria-label="Phương thức thanh toán"
              className="management-filter-select"
              value={paymentMethodFilter}
              onChange={(event) => void applyPaymentMethodFilter(event.target.value as PaymentMethodFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Người bán">
            <select
              aria-label="Người bán"
              className="management-filter-select"
              value={sellerFilter}
              onChange={(event) => void applySellerFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {sellerOptions.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
              ))}
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Bảng giá">
            <select
              aria-label="Bảng giá"
              className="management-filter-select"
              value={priceListFilter}
              onChange={(event) => void applyPriceListFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {priceListOptions.map((priceList) => (
                <option key={priceList.id} value={priceList.id}>{priceList.name}</option>
              ))}
            </select>
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc chứng từ bán hàng"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      <ManagementListSurface ariaLabel="Danh sách chứng từ bán hàng">
        {error ? <p role="alert">{error}</p> : null}

        {state === null && error === null ? <p>Đang tải chứng từ...</p> : null}

        {state ? (
          <>
            {documents.length === 0 ? (
              <EmptyState>
                <p>{hasFilter ? 'Không thấy chứng từ theo bộ lọc hiện tại.' : 'Chưa có chứng từ phù hợp bộ lọc.'}</p>
                {hasFilter ? <p>Hãy thử mở rộng thời gian hoặc bỏ bớt bộ lọc.</p> : null}
              </EmptyState>
            ) : (
              <ManagementTableViewport>
                <table aria-label="Danh sách chứng từ bán hàng" className="sales-documents-management-table">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Thời gian</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền hàng</th>
                      <th>Giảm giá</th>
                      <th>Tổng sau giảm</th>
                      <th>Khách đã trả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <Fragment key={document.id}>
                        <tr
                          aria-expanded={selected?.id === document.id}
                          className={`management-data-row${selected?.id === document.id ? ' management-data-row-selected' : ''}`}
                          tabIndex={0}
                          onClick={(event: MouseEvent<HTMLTableRowElement>) => {
                            if (isDetailInteractionTarget(event.target)) return
                            if (selected?.id === document.id && isOutsideRowClick(event)) return
                            void openDocument(document)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              void openDocument(document)
                            }
                          }}
                        >
                          <td>
                            <button
                              className="management-link-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void openDocument(document)
                              }}
                            >
                              <strong>{document.code}</strong>
                            </button>
                          </td>
                          <td>{dateTime(document.created_at)}</td>
                          <td>{document.customer.name}</td>
                          <td><MoneyText value={document.subtotal_amount} /></td>
                          <td><MoneyText value={document.discount_amount} /></td>
                          <td><MoneyText value={document.total_amount} /></td>
                          <td><MoneyText value={document.paid_amount} /></td>
                        </tr>
                        {selected?.id === document.id || detailErrorDocumentId === document.id || loadingDocumentId === document.id ? (
                          <ManagementDetailRow colSpan={7} label={`Chi tiết chứng từ ${document.code}`}>
                            {document.order_type === 'quote' && document.status === 'active' && orderService && onOpenQuoteInPos ? (
                              <div className="row-actions">
                                <button
                                  className="button button-secondary"
                                  disabled={openingQuoteId === document.id}
                                  type="button"
                                  onClick={() => void openQuoteInPos(document)}
                                >
                                  <ExternalLink aria-hidden="true" size={15} />
                                  Mở tại POS
                                </button>
                              </div>
                            ) : null}
                            <SalesDocumentDetailView document={selected} error={detailError} loading={loadingDocumentId === document.id} onOpenQuotePrint={onOpenQuotePrint} />
                          </ManagementDetailRow>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </ManagementTableViewport>
            )}
            <ManagementTableFooter
              ariaLabel="Phân trang chứng từ"
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              entityLabel="chứng từ"
              page={page}
              pageSize={pageSize}
              total={total}
              onFirst={() => void goToPage(1)}
              onLast={() => void goToPage(totalPages)}
              onNext={() => void goToPage(page + 1)}
              onPageSizeChange={(nextPageSize) => void loadDocuments({ page: 1, page_size: nextPageSize })}
              onPrevious={() => void goToPage(page - 1)}
            />
          </>
        ) : null}
      </ManagementListSurface>
    </ManagementPage>
  )
}

function SalesDocumentDetailView({
  document,
  error,
  loading,
  onOpenQuotePrint,
}: {
  document: SalesDocumentDetail | null
  error: string | null
  loading: boolean
  onOpenQuotePrint?: (documentId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'payment-history'>('info')
  const infoTabId = `sales-document-${document?.id ?? 'loading'}-info-tab`
  const infoPanelId = `sales-document-${document?.id ?? 'loading'}-info-panel`
  const paymentTabId = `sales-document-${document?.id ?? 'loading'}-payment-tab`
  const paymentPanelId = `sales-document-${document?.id ?? 'loading'}-payment-panel`
  const hasPaymentHistory = Array.isArray(document?.payment_receipts) && document.payment_receipts.length > 0
  const selectedTab = hasPaymentHistory ? activeTab : 'info'

  if (error) return <p role="alert">{error}</p>
  if (loading || !document) return <p>Đang tải chi tiết...</p>

  const paymentReceipts = Array.isArray(document.payment_receipts) ? document.payment_receipts : []

  return (
    <div className="management-detail-panel">
      <div className="inline-detail-tabbar">
        <div aria-label="Chi tiết chứng từ" className="inline-detail-tabs" role="tablist">
          <button
            aria-controls={infoPanelId}
            aria-selected={selectedTab === 'info'}
            id={infoTabId}
            role="tab"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setActiveTab('info')
            }}
          >
            Thông tin
          </button>
          {hasPaymentHistory ? (
            <button
              aria-controls={paymentPanelId}
              aria-selected={selectedTab === 'payment-history'}
              id={paymentTabId}
              role="tab"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setActiveTab('payment-history')
              }}
            >
              Lịch sử thanh toán
            </button>
          ) : null}
        </div>
      </div>
      {selectedTab === 'info' ? (
        <section aria-label="Thông tin chứng từ" aria-labelledby={infoTabId} id={infoPanelId} role="tabpanel">
          <header className="management-detail-header">
            <h2>{document.customer.name}</h2>
            <span>{document.code}</span>
            <StatusChip tone={salesDocumentStatusTone(document)}>
              {salesDocumentStatusLabel(document)}
            </StatusChip>
            {document.order_type === 'quote' && document.code.startsWith('BG') && onOpenQuotePrint ? (
              <button type="button" onClick={() => onOpenQuotePrint(document.id)}>
                Xem/In báo giá
              </button>
            ) : null}
          </header>

          <dl className="management-detail-meta-grid">
            <div>
              <dt>Người bán:</dt>
              <dd>{document.seller.name}</dd>
            </div>
            <div>
              <dt>Ngày bán:</dt>
              <dd>{dateTime(document.created_at)}</dd>
            </div>
            {document.price_list ? (
              <div>
                <dt>Bảng giá:</dt>
                <dd>{document.price_list.name}</dd>
              </div>
            ) : null}
          </dl>

          <table aria-label="Dòng hàng" className="management-detail-table sales-document-lines-table">
            <thead>
              <tr>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Giảm giá</th>
                <th>Giá bán</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product.code}</td>
                  <td>
                    <span>{item.product.name}</span>
                    {item.note ? <small>{item.note}</small> : null}
                  </td>
                  <td>{`${item.quantity} ${item.product.unit_name}`}</td>
                  <td><MoneyText value={item.unit_price} /></td>
                  <td><MoneyText value={item.discount_amount} /></td>
                  <td><MoneyText value={lineSellPrice(item)} /></td>
                  <td><MoneyText value={item.line_total} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="management-detail-lower management-detail-lower-right">
            {document.note ? <p className="management-detail-note sales-document-note">{document.note}</p> : null}
            <dl className="management-detail-summary-box management-detail-summary-box-right">
              <div>
                <dt>{`Tổng tiền hàng (${document.items.length})`}</dt>
                <dd><MoneyText value={document.subtotal_amount} /></dd>
              </div>
              <div>
                <dt>Giảm giá hóa đơn</dt>
                <dd><MoneyText value={document.discount_amount} /></dd>
              </div>
              <div>
                <dt>Khách cần trả</dt>
                <dd><MoneyText value={document.total_amount} /></dd>
              </div>
              <div>
                <dt>Khách đã trả</dt>
                <dd><MoneyText value={document.paid_amount} /></dd>
              </div>
              {document.debt_amount > 0 ? (
                <div>
                  <dt>Công nợ</dt>
                  <dd><MoneyText value={document.debt_amount} /></dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : (
        <section aria-label="Lịch sử thanh toán" aria-labelledby={paymentTabId} id={paymentPanelId} role="tabpanel">
          {paymentReceipts.length === 0 ? (
            <p className="management-detail-inline-note">Chưa có lịch sử thanh toán.</p>
          ) : (
            <table aria-label="Lịch sử thanh toán" className="management-detail-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Thời gian</th>
                  <th>Người thu</th>
                  <th>Giá trị phiếu</th>
                  <th>Phương thức</th>
                  <th>Trạng thái</th>
                  <th>Tiền thu/chi</th>
                </tr>
              </thead>
              <tbody>
                {paymentReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{receipt.code}</td>
                    <td>{dateTime(receipt.created_at, document.created_at)}</td>
                    <td>{paymentReceiptCreatorLabel(receipt, document.seller)}</td>
                    <td><MoneyText value={receipt.total_received_amount} /></td>
                    <td>{paymentReceiptMethodLabel(receipt)}</td>
                    <td>{paymentReceiptStatusLabel(receipt.status)}</td>
                    <td><MoneyText value={paymentReceiptMethodTotal(receipt)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      <ManagementDetailActionFooter
        leftActions={[
          { label: 'Hủy', danger: true, icon: <Trash2 aria-hidden="true" size={15} /> },
          { label: 'Sao chép', icon: <Copy aria-hidden="true" size={15} /> },
        ]}
        rightActions={[
          { label: 'Sửa', icon: <Pencil aria-hidden="true" size={15} /> },
          { label: 'Lưu', icon: <Save aria-hidden="true" size={15} /> },
          { label: 'In', icon: <Printer aria-hidden="true" size={15} /> },
        ]}
      />
    </div>
  )
}

function lineSellPrice(item: SalesDocumentDetail['items'][number]) {
  if (item.quantity <= 0) return item.line_total
  return Math.round(item.line_total / item.quantity)
}

function salesDocumentStatusLabel(document: SalesDocumentDetail) {
  if (document.status === 'cancelled') return 'Đã hủy'
  if (document.order_type === 'quote') return document.status === 'converted' ? 'Đã chuyển' : 'Đang hiệu lực'
  return paymentSettlementStatusLabel(salesDocumentPaymentSettlementStatus(document))
}

function salesDocumentStatusTone(document: SalesDocumentDetail) {
  if (document.status === 'cancelled') return 'danger'
  if (document.order_type === 'quote') return document.status === 'completed' ? 'success' : 'info'
  return paymentSettlementStatusTone(salesDocumentPaymentSettlementStatus(document))
}

function salesDocumentPaymentSettlementStatus(document: SalesDocumentDetail): PaymentSettlementStatus {
  if (document.payment_status === 'paid') return 'paid'
  if (document.payment_status === 'partial') return 'partial'
  return 'unpaid'
}

function documentTypeFilterLabel(value: 'invoice' | 'quote') {
  return value === 'invoice' ? 'Hóa đơn' : 'Báo giá'
}

function lifecycleFilterLabel(value: 'active' | 'completed' | 'cancelled') {
  if (value === 'active') return 'Đang hiệu lực'
  if (value === 'completed') return 'Hoàn tất'
  return 'Đã hủy'
}

function paymentStatusFilterLabel(value: PaymentStatusFilter) {
  if (value === 'unpaid') return 'Chưa thanh toán'
  if (value === 'partial') return 'Thanh toán một phần'
  if (value === 'paid') return 'Đã thanh toán'
  return 'Tất cả'
}

function paymentMethodFilterLabel(value: PaymentMethodFilter) {
  if (value === 'cash') return 'Tiền mặt'
  if (value === 'bank_transfer') return 'Chuyển khoản'
  return 'Tất cả'
}

function paymentReceiptMethodLabel(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  const labels = paymentReceiptMethods(receipt).map((method) => (method.method_type === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'))
  return Array.from(new Set(labels)).join(', ') || '-'
}

function paymentReceiptMethodTotal(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  const methodTotal = paymentReceiptMethods(receipt).reduce((sum, method) => sum + method.amount, 0)
  return methodTotal || receipt.total_received_amount
}

function paymentReceiptStatusLabel(status: SalesDocumentDetail['payment_receipts'][number]['status']) {
  return status === 'posted' ? 'Đã thanh toán' : 'Đã hủy'
}

function paymentReceiptCreatorLabel(
  receipt: SalesDocumentDetail['payment_receipts'][number],
  seller: SalesDocumentDetail['seller'],
) {
  return receipt.created_by?.name || receipt.created_by?.id || seller.name || seller.id || 'Chưa có dữ liệu'
}

function paymentReceiptMethods(receipt: SalesDocumentDetail['payment_receipts'][number]) {
  return Array.isArray(receipt.methods) ? receipt.methods : []
}
