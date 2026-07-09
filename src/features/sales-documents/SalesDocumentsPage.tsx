import { Fragment, useEffect, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Pencil, Printer, Save, Search, Trash2 } from 'lucide-react'
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
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import { formatApiError } from '../../lib/api/error-message'
import type { SalesDocumentDetail, SalesDocumentListItem } from './types'
import type { SalesDocumentService } from './sales-document-service'
import type { OrderService, QuoteReopenPayload } from '../orders/order-service'
import type { CatalogService } from '../catalog/catalog-service'
import type { FoundationService } from '../users/foundation-service'
import {
  allPaymentStatusFilters,
  allSalesDocumentStatusFilters as allStatusFilters,
  allSalesDocumentTypeFilters as allTypeFilters,
  buildSalesDocumentListRequest,
  currentMonthRange,
  defaultSalesDocumentStatusFilters as defaultStatusFilters,
  displayDate,
  quickTimeGroups,
  quickTimeLabels,
  quickTimeRange,
  salesDocumentsPageSize,
  sameFilterValues,
  toggleFilterValue,
  type PaymentMethodFilter,
  type PaymentStatusValue,
  type SalesDocumentStatusFilter,
  type SalesDocumentTypeFilter,
  type TimeFilter,
} from './sales-document-filters'
import {
  documentTypeFilterLabel,
  lifecycleFilterLabel,
  paymentMethodFilterLabel,
  paymentReceiptCreatorLabel,
  paymentReceiptMethodLabel,
  paymentReceiptMethodTotal,
  paymentReceiptStatusLabel,
  paymentStatusFilterLabel,
  salesDocumentDateTimeText,
  salesDocumentLineSellPrice,
  salesDocumentListSummary,
  salesDocumentStatusLabel,
  salesDocumentStatusTone,
} from './sales-document-presenter'

type SalesDocumentSortKey = 'code' | 'created_at' | 'customer_name' | 'subtotal_amount' | 'discount_amount' | 'total_amount' | 'paid_amount'

interface SalesDocumentsState {
  items: SalesDocumentListItem[]
  total: number
  page: number
  pageSize: number
}

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
  const [documentSearchSuggestions, setDocumentSearchSuggestions] = useState<SalesDocumentListItem[]>([])
  const [documentSearchSuggestionsOpen, setDocumentSearchSuggestionsOpen] = useState(false)
  const [lastSearch, setLastSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SalesDocumentTypeFilter[]>(allTypeFilters)
  const [statusFilter, setStatusFilter] = useState<SalesDocumentStatusFilter[]>(defaultStatusFilters)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusValue[]>(allPaymentStatusFilters)
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
  const documentSearchRequestId = useRef(0)

  async function loadDocuments(input: {
    search?: string
    type?: SalesDocumentTypeFilter[]
    status?: SalesDocumentStatusFilter[]
    paymentStatus?: PaymentStatusValue[]
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
      const result = await service.listSalesDocuments(buildSalesDocumentListRequest({
        search: nextSearch,
        type: nextType,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        paymentMethod: nextPaymentMethod,
        seller: nextSeller,
        priceList: nextPriceList,
        time: nextTime,
        from: nextFrom,
        to: nextTo,
        page: nextPage,
        page_size: nextPageSize,
      }))
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
        const result = await service.listSalesDocuments(buildSalesDocumentListRequest({
          type: allTypeFilters,
          status: defaultStatusFilters,
          paymentStatus: allPaymentStatusFilters,
          paymentMethod: 'all',
          seller: 'all',
          priceList: 'all',
          time: 'month',
          from: monthRange.from,
          to: monthRange.to,
          page: 1,
          page_size: salesDocumentsPageSize,
        }))
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
    setDocumentSearchSuggestionsOpen(false)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setLastSearch(trimmed)
    setQuickTimeOpen(false)
    await loadDocuments({ search: trimmed, page: 1 })
  }

  async function suggestDocuments(nextSearch: string) {
    setSearch(nextSearch)
    const query = nextSearch.trim()
    const requestId = documentSearchRequestId.current + 1
    documentSearchRequestId.current = requestId
    if (query.length === 0) {
      setDocumentSearchSuggestions([])
      setDocumentSearchSuggestionsOpen(false)
      return
    }
    try {
      const result = await service.listSalesDocuments(buildSalesDocumentListRequest({
        search: query,
        type: typeFilter,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        paymentMethod: paymentMethodFilter,
        seller: sellerFilter,
        priceList: priceListFilter,
        time: timeFilter,
        from: dateFrom,
        to: dateTo,
        page: 1,
        page_size: 8,
      }))
      if (documentSearchRequestId.current !== requestId) return
      setDocumentSearchSuggestions(result.items)
      setDocumentSearchSuggestionsOpen(true)
    } catch {
      if (documentSearchRequestId.current !== requestId) return
      setDocumentSearchSuggestions([])
      setDocumentSearchSuggestionsOpen(false)
    }
  }

  async function selectDocumentSuggestion(document: SalesDocumentListItem) {
    setSearch(document.code)
    setDocumentSearchSuggestionsOpen(false)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setLastSearch(document.code)
    setQuickTimeOpen(false)
    await loadDocuments({ search: document.code, page: 1 })
  }

  async function applyTypeFilter(nextType: SalesDocumentTypeFilter[]) {
    setTypeFilter(nextType)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ type: nextType, page: 1 })
  }

  async function applyStatusFilter(nextStatus: SalesDocumentStatusFilter[]) {
    setStatusFilter(nextStatus)
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    await loadDocuments({ status: nextStatus, page: 1 })
  }

  async function applyPaymentStatusFilter(nextPaymentStatus: PaymentStatusValue[]) {
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
  const {
    sortedItems: sortedDocuments,
    sortState: documentSortState,
    requestSort: requestDocumentSort,
  } = useManagementTableSort<SalesDocumentListItem, SalesDocumentSortKey>(documents, {
    code: { kind: 'text', value: (document) => document.code },
    created_at: { kind: 'date', value: (document) => document.created_at },
    customer_name: { kind: 'text', value: (document) => document.customer.name },
    subtotal_amount: { kind: 'number', value: (document) => document.subtotal_amount },
    discount_amount: { kind: 'number', value: (document) => document.discount_amount },
    total_amount: { kind: 'number', value: (document) => document.total_amount },
    paid_amount: { kind: 'number', value: (document) => document.paid_amount },
  })
  const total = state?.total ?? 0
  const page = state?.page ?? 1
  const pageSize = state?.pageSize ?? salesDocumentsPageSize
  const hasFilter = lastSearch.length > 0
    || !sameFilterValues(typeFilter, allTypeFilters)
    || !sameFilterValues(statusFilter, defaultStatusFilters)
    || !sameFilterValues(paymentStatusFilter, allPaymentStatusFilters)
    || paymentMethodFilter !== 'all'
    || sellerFilter !== 'all'
    || priceListFilter !== 'all'
    || timeFilter !== 'month'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = [
    ...(lastSearch ? [`Tìm: ${lastSearch}`] : []),
    ...(timeFilter === 'custom' ? [`Thời gian: ${dateFrom || '...'} - ${dateTo || '...'}`] : []),
    ...(timeFilter !== 'month' && timeFilter !== 'custom' ? [`Thời gian: ${quickTimeLabels[timeFilter]}`] : []),
    ...(!sameFilterValues(typeFilter, allTypeFilters) ? [`Loại: ${typeFilter.map(documentTypeFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(!sameFilterValues(statusFilter, defaultStatusFilters) ? [`Trạng thái: ${statusFilter.map(lifecycleFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(!sameFilterValues(paymentStatusFilter, allPaymentStatusFilters) ? [`Thanh toán: ${paymentStatusFilter.map(paymentStatusFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(paymentMethodFilter !== 'all' ? [`PTTT: ${paymentMethodFilterLabel(paymentMethodFilter)}`] : []),
    ...(sellerFilter !== 'all' ? [`Người bán: ${sellerOptions.find((seller) => seller.id === sellerFilter)?.name ?? sellerFilter}`] : []),
    ...(priceListFilter !== 'all' ? [`Bảng giá: ${priceListOptions.find((priceList) => priceList.id === priceListFilter)?.name ?? priceListFilter}`] : []),
  ].join(' • ')
  const { totalAmount: documentTotalAmount, debtAmount: documentDebtAmount } = salesDocumentListSummary(documents)
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
            suggestions={
              documentSearchSuggestionsOpen
                ? documentSearchSuggestions.map((document) => ({
                    id: document.id,
                    primary: `${document.code} ${document.customer.name}`,
                    secondary: `${document.customer.code ?? ''} ${document.note ?? ''}`.trim(),
                    meta: <MoneyText value={document.total_amount} />,
                    ariaLabel: `${document.code} ${document.customer.name} ${document.note ?? ''}`.trim(),
                  }))
                : undefined
            }
            suggestionsLabel="Gợi ý chứng từ"
            emptySuggestion="Không có kết quả phù hợp"
            onChange={(nextSearch) => void suggestDocuments(nextSearch)}
            onSuggestionSelect={(suggestion) => {
              const document = documentSearchSuggestions.find((candidate) => candidate.id === suggestion.id)
              if (document) void selectDocumentSuggestion(document)
            }}
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
          <ManagementFilterGroup title="Loại hóa đơn">
            {allTypeFilters.map((value) => {
              const checked = typeFilter.includes(value)
              return (
                <label className={`management-filter-choice${checked ? ' management-filter-choice-active' : ''}`} key={value}>
                  <input
                    aria-label={documentTypeFilterLabel(value)}
                    checked={checked}
                    type="checkbox"
                    onChange={() => void applyTypeFilter(toggleFilterValue(typeFilter, value))}
                  />
                  <span>{documentTypeFilterLabel(value)}</span>
                </label>
              )
            })}
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Trạng thái hóa đơn">
            {allStatusFilters.map((value) => {
              const checked = statusFilter.includes(value)
              return (
                <label className={`management-filter-choice${checked ? ' management-filter-choice-active' : ''}`} key={value}>
                  <input
                    aria-label={lifecycleFilterLabel(value)}
                    checked={checked}
                    type="checkbox"
                    onChange={() => void applyStatusFilter(toggleFilterValue(statusFilter, value))}
                  />
                  <span>{lifecycleFilterLabel(value)}</span>
                </label>
              )
            })}
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Thanh toán">
            {allPaymentStatusFilters.map((value) => {
              const checked = paymentStatusFilter.includes(value)
              return (
                <label className={`management-filter-choice${checked ? ' management-filter-choice-active' : ''}`} key={value}>
                  <input
                    aria-label={paymentStatusFilterLabel(value)}
                    checked={checked}
                    type="checkbox"
                    onChange={() => void applyPaymentStatusFilter(toggleFilterValue(paymentStatusFilter, value))}
                  />
                  <span>{paymentStatusFilterLabel(value)}</span>
                </label>
              )
            })}
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
                      <ManagementSortableHeader kind="text" sortKey="code" sortState={documentSortState} onSort={requestDocumentSort}>Mã hóa đơn</ManagementSortableHeader>
                      <ManagementSortableHeader kind="date" sortKey="created_at" sortState={documentSortState} onSort={requestDocumentSort}>Thời gian</ManagementSortableHeader>
                      <ManagementSortableHeader kind="text" sortKey="customer_name" sortState={documentSortState} onSort={requestDocumentSort}>Khách hàng</ManagementSortableHeader>
                      <ManagementSortableHeader kind="number" sortKey="subtotal_amount" sortState={documentSortState} onSort={requestDocumentSort}>Tổng tiền hàng</ManagementSortableHeader>
                      <ManagementSortableHeader kind="number" sortKey="discount_amount" sortState={documentSortState} onSort={requestDocumentSort}>Giảm giá</ManagementSortableHeader>
                      <ManagementSortableHeader kind="number" sortKey="total_amount" sortState={documentSortState} onSort={requestDocumentSort}>Tổng sau giảm</ManagementSortableHeader>
                      <ManagementSortableHeader kind="number" sortKey="paid_amount" sortState={documentSortState} onSort={requestDocumentSort}>Khách đã trả</ManagementSortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDocuments.map((document) => (
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
                          <td>{salesDocumentDateTimeText(document.created_at)}</td>
                          <td>{document.customer.name}</td>
                          <td><MoneyText value={document.subtotal_amount} /></td>
                          <td><MoneyText value={document.discount_amount} /></td>
                          <td><MoneyText value={document.total_amount} /></td>
                          <td><MoneyText value={document.paid_amount} /></td>
                        </tr>
                        {selected?.id === document.id || detailErrorDocumentId === document.id || loadingDocumentId === document.id ? (
                          <ManagementDetailRow colSpan={7} label={`Chi tiết chứng từ ${document.code}`}>
                            <SalesDocumentDetailView
                              document={selected}
                              editDisabled={openingQuoteId === document.id}
                              error={detailError}
                              loading={loadingDocumentId === document.id}
                              onEdit={
                                document.order_type === 'quote' && document.status === 'active' && orderService && onOpenQuoteInPos
                                  ? () => void openQuoteInPos(document)
                                  : undefined
                              }
                              onOpenQuotePrint={onOpenQuotePrint}
                            />
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
  editDisabled,
  error,
  loading,
  onEdit,
  onOpenQuotePrint,
}: {
  document: SalesDocumentDetail | null
  editDisabled?: boolean
  error: string | null
  loading: boolean
  onEdit?: () => void
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
              <dd>{salesDocumentDateTimeText(document.created_at)}</dd>
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
                  <td><MoneyText value={salesDocumentLineSellPrice(item)} /></td>
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
                    <td>{salesDocumentDateTimeText(receipt.created_at, document.created_at)}</td>
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
          { label: 'Sửa', disabled: editDisabled, icon: <Pencil aria-hidden="true" size={15} />, onClick: onEdit },
          { label: 'Lưu', icon: <Save aria-hidden="true" size={15} /> },
          { label: 'In', icon: <Printer aria-hidden="true" size={15} /> },
        ]}
      />
    </div>
  )
}

