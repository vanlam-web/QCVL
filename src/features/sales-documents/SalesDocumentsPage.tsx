import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, FileOutput, Pencil, Printer, Save, Search, Trash2 } from 'lucide-react'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementConfirmDialog,
  ManagementDataTable,
  type ManagementDataTableColumn,
  ManagementDateRangeInputs,
  ManagementDetailActionFooter,
  ManagementDetailNoteInput,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementImportButton,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, sortManagementItemsByDateDesc, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { downloadManagementCsv } from '../../components/ui-shell/management-export'
import { EmptyState, ManagementRecordLink, MetricCard, MetricGrid, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { formatApiError } from '../../lib/api/error-message'
import { dateRangeFromItems, displayDateRangeForData } from '../../lib/date-ranges'
import { displayPriceListName } from '../../lib/price-list-display'
import type { SalesDocumentDetail, SalesDocumentListItem } from './types'
import type { SalesDocumentService } from './sales-document-service'
import type { InvoiceRevisionHandoffPayload, OrderService, QuoteReopenPayload } from '../orders/order-service'
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
  parseSalesDocumentDateTimeInputText,
  salesDocumentDateTimeInputText,
  salesDocumentDateTimeText,
  salesDocumentCreatedDateTimeText,
  salesDocumentLineSellPrice,
  salesDocumentLineSubtexts,
  salesDocumentListSummary,
  salesDocumentStatusLabel,
  salesDocumentStatusTone,
  salesDocumentUnitNameText,
} from './sales-document-presenter'
import { SalesDocumentImportDialog } from './SalesDocumentImportDialog'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'

function initialSalesDocumentRouteFilters() {
  const params = new URLSearchParams(window.location.search)
  const search = (params.get('search') ?? '').trim()
  const open = (params.get('open') ?? '').trim()
  const routeType = params.get('type')
  const type: SalesDocumentTypeFilter[] = routeType === 'invoice' || routeType === 'quote' ? [routeType] : allTypeFilters
  const monthRange = currentMonthRange()
  const hasSearch = search.length > 0
  const hasOpen = open.length > 0

  return {
    search,
    open,
    type,
    time: (hasSearch || hasOpen ? 'all' : 'month') as TimeFilter,
    from: hasSearch || hasOpen ? '' : monthRange.from,
    to: hasSearch || hasOpen ? '' : monthRange.to,
    shouldOpenSingleResult: hasSearch || hasOpen,
  }
}

function salesDocumentCreatedAtPayload(value: string) {
  return parseSalesDocumentDateTimeInputText(value) ?? undefined
}

type SalesDocumentSortKey = 'code' | 'created_at' | 'customer_name' | 'subtotal_amount' | 'discount_amount' | 'total_amount' | 'paid_amount'
const defaultSalesDocumentSortState: NonNullable<ManagementSortState<SalesDocumentSortKey>> = { key: 'created_at', direction: 'desc' }

interface SalesDocumentsState {
  items: SalesDocumentListItem[]
  total: number
  page: number
  pageSize: number
  summary?: {
    total_amount: number
    debt_amount: number
  }
}

export function SalesDocumentsPage({
  service,
  orderService,
  userService,
  catalogService,
  onCreateSalesDocument,
  onOpenQuoteInPos,
  onOpenInvoiceRevisionInPos,
  onOpenQuotePrint,
}: {
  service: SalesDocumentService
  orderService?: Pick<OrderService, 'getQuoteReopenPayload'>
  userService?: Pick<FoundationService, 'listUsers'>
  catalogService?: Pick<CatalogService, 'listPriceLists'>
  onCreateSalesDocument?: () => void
  onOpenDashboard: () => void
  onOpenQuoteInPos?: (payload: QuoteReopenPayload) => void
  onOpenInvoiceRevisionInPos?: (payload: InvoiceRevisionHandoffPayload) => void
  onOpenQuotePrint?: (documentId: string) => void
}) {
  const [state, setState] = useState<SalesDocumentsState | null>(null)
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [routeFilters] = useState(initialSalesDocumentRouteFilters)
  const [search, setSearch] = useState(routeFilters.search)
  const [lastSearch, setLastSearch] = useState(routeFilters.search)
  const [typeFilter, setTypeFilter] = useState<SalesDocumentTypeFilter[]>(routeFilters.type)
  const [statusFilter, setStatusFilter] = useState<SalesDocumentStatusFilter[]>(defaultStatusFilters)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusValue[]>(allPaymentStatusFilters)
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')
  const [sellerFilter, setSellerFilter] = useState('all')
  const [priceListFilter, setPriceListFilter] = useState('all')
  const [sellerOptions, setSellerOptions] = useState<Array<{ id: string; name: string }>>([])
  const [priceListOptions, setPriceListOptions] = useState<Array<{ id: string; name: string }>>([])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(routeFilters.time)
  const [dateFrom, setDateFrom] = useState(() => routeFilters.from)
  const [dateTo, setDateTo] = useState(() => routeFilters.to)
  const [quickTimeOpen, setQuickTimeOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [selected, setSelected] = useState<SalesDocumentDetail | null>(null)
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailErrorDocumentId, setDetailErrorDocumentId] = useState<string | null>(null)
  const [openingQuoteId, setOpeningQuoteId] = useState<string | null>(null)
  const [openingRevisionId, setOpeningRevisionId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const documentsSortInitialRender = useRef(true)
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
    sortStateValue?: ManagementSortState<SalesDocumentSortKey>
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
    const nextSortState = input.sortStateValue ?? documentSortState
    const nextPage = input.page ?? state?.page ?? 1
    const nextPageSize = input.page_size ?? state?.pageSize ?? defaultPageSize
    setError(null)
    try {
      const result = await service.listSalesDocuments({
        ...buildSalesDocumentListRequest({
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
      }),
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultSalesDocumentSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
      })
      setState({ items: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
      if (result.items.length === 0) setSelected(null)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chứng từ bán hàng.'))
    }
  }

  async function exportDocuments() {
    setError(null)
    try {
      const exportPageSize = Math.max(state?.total ?? 0, state?.items.length ?? 0, 1)
      const exportSortState = documentSortState ?? defaultSalesDocumentSortState
      const result = await service.listSalesDocuments({
        ...buildSalesDocumentListRequest({
          search: lastSearch,
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
          page_size: exportPageSize,
        }),
        sort_key: exportSortState.key,
        sort_direction: exportSortState.direction,
      })
      downloadManagementCsv({
        filename: 'hoa-don.csv',
        rows: [
          ['Mã hóa đơn', 'Loại', 'Thời gian', 'Khách hàng', 'Trạng thái', 'Tổng tiền hàng', 'Giảm giá', 'Tổng sau giảm', 'Khách đã trả', 'Còn nợ', 'Người bán', 'Ghi chú'],
          ...result.items.map((document) => [
            document.code,
            documentTypeFilterLabel(document.order_type),
            salesDocumentCreatedDateTimeText(document),
            document.customer.name,
            salesDocumentStatusLabel(document),
            document.subtotal_amount,
            document.discount_amount,
            document.total_amount,
            document.paid_amount,
            document.debt_amount,
            document.seller.name,
            document.note ?? '',
          ]),
        ],
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không xuất được file chứng từ bán hàng.'))
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

  async function openInvoiceRevisionInPos(document: SalesDocumentListItem) {
    if (onOpenInvoiceRevisionInPos === undefined) return
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setOpeningRevisionId(document.id)
    try {
      const sourceDocument = selected?.id === document.id ? selected : await service.getSalesDocument(document.id)
      if (sourceDocument === null) throw new Error('Sales document not found')
      onOpenInvoiceRevisionInPos({
        mode: 'invoice-revision',
        original_order: { id: sourceDocument.id, code: sourceDocument.code },
        customer: {
          customer_id: sourceDocument.customer.id,
          snapshot: {
            code: sourceDocument.customer.code,
            name: sourceDocument.customer.name,
            phone: sourceDocument.customer.phone,
          },
        },
        items: sourceDocument.items.map((item) => ({
          order_item_id: item.id,
          product_id: item.product.id,
          product_snapshot: {
            code: item.product.code,
            name: item.product.name,
            unit_name: item.product.unit_name,
            sell_method: item.product.sell_method,
          },
          quantity: item.quantity,
          width_m: item.width_m,
          height_m: item.height_m,
          linear_m: item.linear_m,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          price_source: item.price_source,
          note: item.note,
        })),
        summary: {
          subtotal_amount: sourceDocument.subtotal_amount,
          discount_amount: sourceDocument.discount_amount,
          total_amount: sourceDocument.total_amount,
        },
        note: sourceDocument.note,
        created_at: sourceDocument.created_at,
      })
    } catch (cause) {
      setSelected(null)
      setDetailError(formatApiError(cause, 'KhÃ´ng má»Ÿ Ä‘Æ°á»£c hÃ³a Ä‘Æ¡n sá»­a táº¡i POS.'))
      setDetailErrorDocumentId(document.id)
    } finally {
      setOpeningRevisionId(null)
    }
  }

  useEffect(() => {
    let active = true

  async function loadInitialDocuments() {
    setError(null)
    try {
      const openDetailPromise = routeFilters.open ? service.getSalesDocument(routeFilters.open) : null
      let openDetailSettled = false
      if (openDetailPromise) {
        openDetailPromise
          .then((detail) => {
            if (!active) return
            setSelected(detail)
            setState((current) => current ?? {
              items: [detail],
              total: 1,
              page: 1,
              pageSize: defaultPageSize,
              summary: {
                total_amount: detail.total_amount,
                debt_amount: detail.debt_amount,
              },
            })
            openDetailSettled = true
          })
          .catch((cause) => {
            if (!active) return
            setDetailError(formatApiError(cause, 'Không tải được chi tiết chứng từ.'))
          })
      }
      const result = await service.listSalesDocuments({
        ...buildSalesDocumentListRequest({
          search: routeFilters.search || routeFilters.open,
          type: routeFilters.type,
          status: defaultStatusFilters,
          paymentStatus: allPaymentStatusFilters,
          paymentMethod: 'all',
          seller: 'all',
          priceList: 'all',
          time: routeFilters.time,
          from: routeFilters.from,
          to: routeFilters.to,
          page: 1,
          page_size: defaultPageSize,
        }),
      })
      if (!active) return
      setState({ items: result.items, total: result.total, page: result.page, pageSize: result.page_size, summary: result.summary })
      if (routeFilters.open && openDetailPromise) {
        const openDocument = result.items.find((document) => document.code === routeFilters.open)
        if (openDocument) setLoadingDocumentId(openDocument.id)
        try {
          if (!openDetailSettled) {
            const detail = await openDetailPromise
            if (!active) return
            setSelected(detail)
          }
        } catch {
          if (!active) return
          if (openDocument) setDetailErrorDocumentId(openDocument.id)
        } finally {
          if (active) setLoadingDocumentId(null)
        }
      } else if (routeFilters.shouldOpenSingleResult && result.items.length === 1) {
          const [singleDocument] = result.items
          setLoadingDocumentId(singleDocument.id)
          try {
            const detail = await service.getSalesDocument(singleDocument.id)
            if (!active) return
            setSelected(detail)
          } catch (cause) {
            if (!active) return
            setDetailError(formatApiError(cause, 'Không tải được chi tiết chứng từ.'))
            setDetailErrorDocumentId(singleDocument.id)
          } finally {
            if (active) setLoadingDocumentId(null)
          }
        } else if (routeFilters.open) {
          const openDocument = result.items.find((document) => document.code === routeFilters.open)
          if (openDocument) {
            setLoadingDocumentId(openDocument.id)
            try {
              const detail = await service.getSalesDocument(openDocument.id)
              if (!active) return
              setSelected(detail)
            } catch (cause) {
              if (!active) return
              setDetailError(formatApiError(cause, 'KhÃ´ng táº£i Ä‘Æ°á»£c chi tiáº¿t chá»©ng tá»«.'))
              setDetailErrorDocumentId(openDocument.id)
            } finally {
              if (active) setLoadingDocumentId(null)
            }
          }
        }
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được chứng từ bán hàng.'))
      }
    }

    void loadInitialDocuments()

    return () => {
      active = false
    }
  }, [defaultPageSize, routeFilters, service])

  useEffect(() => {
    let active = true

    async function loadFilterOptions() {
      const [users, priceLists] = await Promise.all([
        userService?.listUsers({ status: 'active' }),
        catalogService?.listPriceLists(),
      ])
      if (!active) return
      setSellerOptions((users?.items ?? []).map((user) => ({ id: user.id, name: user.display_name })))
      setPriceListOptions((priceLists?.items ?? []).filter((priceList) => priceList.is_active).map((priceList) => ({ id: priceList.id, name: displayPriceListName(priceList) })))
    }

    void loadFilterOptions()

    return () => {
      active = false
    }
  }, [catalogService, userService])

  async function searchDocuments(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyDocumentSearch(search))
  }

  function applyDocumentSearch(nextSearch: string) {
    const trimmed = nextSearch.trim()
    setSelected(null)
    setLoadingDocumentId(null)
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setLastSearch(trimmed)
    setQuickTimeOpen(false)
    return loadDocuments({ search: trimmed, page: 1 })
  }

  function changeDocumentSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch,
      resetSelection: () => {
        setSelected(null)
        setLoadingDocumentId(null)
        setDetailError(null)
        setDetailErrorDocumentId(null)
      },
      load: applyDocumentSearch,
    })
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

  async function cancelSelectedDocument() {
    if (!selected) return
    setDetailError(null)
    setDetailErrorDocumentId(null)
    setCanceling(true)
    try {
      const saved = await service.cancelSalesDocument(selected.id)
      setSelected(saved)
      setState((current) => current
        ? {
            ...current,
            items: current.items.map((item) => (
              item.id === saved.id ? { ...item, status: saved.status, payment_status: saved.payment_status } : item
            )),
          }
        : current)
      setCancelOpen(false)
      await loadDocuments({ page: state?.page ?? 1 })
    } catch (cause) {
      setDetailError(formatApiError(cause, 'Không hủy được hóa đơn.'))
      setDetailErrorDocumentId(selected.id)
      throw cause
    } finally {
      setCanceling(false)
    }
  }

  async function saveSelectedDocumentChanges(input: { note: string; createdAt: string }) {
    if (!selected) return
    setDetailError(null)
    setDetailErrorDocumentId(null)
    try {
      const saved = await service.updateSalesDocumentNote(selected.id, {
        note: input.note.trim() || null,
        created_at: salesDocumentCreatedAtPayload(input.createdAt),
      })
      setSelected(saved)
      setState((current) => current
        ? {
            ...current,
            items: current.items.map((item) => (
              item.id === saved.id ? { ...item, note: saved.note, created_at: saved.created_at } : item
            )),
          }
        : current)
    } catch (cause) {
      setDetailError(formatApiError(cause, 'Không lưu được ghi chú hóa đơn.'))
      setDetailErrorDocumentId(selected.id)
      throw cause
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
  }, defaultSalesDocumentSortState)
  useEffect(() => {
    if (documentsSortInitialRender.current) {
      documentsSortInitialRender.current = false
      return
    }
    queueMicrotask(() => void loadDocuments({ page: 1, sortStateValue: documentSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSortState?.key, documentSortState?.direction])
  const total = state?.total ?? 0
  const page = state?.page ?? 1
  const pageSize = state?.pageSize ?? defaultPageSize
  const visibleDateRange = timeFilter === 'custom'
    ? { from: dateFrom, to: dateTo }
    : displayDateRangeForData({ from: dateFrom, to: dateTo }, dateRangeFromItems(documents, (document) => document.created_at))
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
  const salesDocumentColumns: Array<ManagementDataTableColumn<SalesDocumentListItem>> = [
    {
      key: 'code',
      header: <ManagementSortableHeader kind="text" sortKey="code" sortState={documentSortState} onSort={requestDocumentSort}>Mã hóa đơn</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => (
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
      ),
    },
    {
      key: 'created-at',
      header: <ManagementSortableHeader kind="date" sortKey="created_at" sortState={documentSortState} onSort={requestDocumentSort}>Thời gian</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => salesDocumentCreatedDateTimeText(document),
    },
    {
      key: 'customer-name',
      header: <ManagementSortableHeader kind="text" sortKey="customer_name" sortState={documentSortState} onSort={requestDocumentSort}>Khách hàng</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => document.customer.name,
    },
    {
      key: 'subtotal',
      header: <ManagementSortableHeader kind="number" sortKey="subtotal_amount" sortState={documentSortState} onSort={requestDocumentSort}>Tổng tiền hàng</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => <MoneyText value={document.subtotal_amount} />,
    },
    {
      key: 'discount',
      header: <ManagementSortableHeader kind="number" sortKey="discount_amount" sortState={documentSortState} onSort={requestDocumentSort}>Giảm giá</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => <MoneyText value={document.discount_amount} />,
    },
    {
      key: 'total',
      header: <ManagementSortableHeader kind="number" sortKey="total_amount" sortState={documentSortState} onSort={requestDocumentSort}>Tổng sau giảm</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => <MoneyText value={document.total_amount} />,
    },
    {
      key: 'paid',
      header: <ManagementSortableHeader kind="number" sortKey="paid_amount" sortState={documentSortState} onSort={requestDocumentSort}>Khách đã trả</ManagementSortableHeader>,
      headerIsCell: true,
      cell: (document) => <MoneyText value={document.paid_amount} />,
    },
  ]
  const activeFilterSummary = [
    ...(timeFilter === 'custom' ? [`Thời gian: ${dateFrom || '...'} - ${dateTo || '...'}`] : []),
    ...(timeFilter !== 'month' && timeFilter !== 'custom' ? [`Thời gian: ${quickTimeLabels[timeFilter]}`] : []),
    ...(!sameFilterValues(typeFilter, allTypeFilters) ? [`Loại: ${typeFilter.map(documentTypeFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(!sameFilterValues(statusFilter, defaultStatusFilters) ? [`Trạng thái: ${statusFilter.map(lifecycleFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(!sameFilterValues(paymentStatusFilter, allPaymentStatusFilters) ? [`Thanh toán: ${paymentStatusFilter.map(paymentStatusFilterLabel).join(', ') || 'Không chọn'}`] : []),
    ...(paymentMethodFilter !== 'all' ? [`PTTT: ${paymentMethodFilterLabel(paymentMethodFilter)}`] : []),
    ...(sellerFilter !== 'all' ? [`Người bán: ${sellerOptions.find((seller) => seller.id === sellerFilter)?.name ?? sellerFilter}`] : []),
    ...(priceListFilter !== 'all' ? [`Bảng giá: ${priceListOptions.find((priceList) => priceList.id === priceListFilter)?.name ?? priceListFilter}`] : []),
  ].join(' • ')
  const fallbackDocumentSummary = salesDocumentListSummary(documents)
  const documentTotalAmount = state?.summary?.total_amount ?? fallbackDocumentSummary.totalAmount
  const documentDebtAmount = state?.summary?.debt_amount ?? fallbackDocumentSummary.debtAmount
  const documentKpis = (
    <MetricGrid ariaLabel="Tổng quan chứng từ bán hàng">
      <MetricCard hint="Theo bộ lọc hiện tại" label="Tổng tiền" tone="success" value={<MoneyText value={documentTotalAmount} />} />
      <MetricCard hint="Theo bộ lọc hiện tại" label="Còn nợ" tone={documentDebtAmount > 0 ? 'warning' : 'neutral'} value={<MoneyText value={documentDebtAmount} />} />
    </MetricGrid>
  )

  return (
    <>
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
            onChange={changeDocumentSearch}
          />
          <ManagementImportButton onClick={() => setImportOpen(true)}>Import</ManagementImportButton>
          <button className="button button-secondary" type="button" onClick={() => void exportDocuments()}>
            <FileOutput aria-hidden="true" size={16} />
            Xuất file
          </button>
        </ManagementCompactToolbar>
      }
      kpis={documentKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary || undefined}
          ariaLabel="Bộ lọc chứng từ bán hàng"
          onPopoverClose={() => setQuickTimeOpen(false)}
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
              <button
                className="management-filter-choice management-filter-time-trigger"
                aria-expanded={quickTimeOpen}
                type="button"
                onClick={() => setQuickTimeOpen((current) => !current)}
              >
                <span>{timeFilter === 'custom' ? `${displayDate(dateFrom)} - ${displayDate(dateTo)}` : quickTimeLabels[timeFilter]}</span>
                <span className="management-filter-choice-trailing">
                  <ChevronRight aria-hidden="true" size={17} />
                </span>
              </button>
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
            <ManagementDateRangeInputs
              displayFrom={visibleDateRange.from}
              displayTo={visibleDateRange.to}
              from={dateFrom}
              to={dateTo}
              onCalendarOpen={() => setQuickTimeOpen(false)}
              onFromChange={(value) => void applyCustomDateFilter({ from: value })}
              onToChange={(value) => void applyCustomDateFilter({ to: value })}
            />
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
          <ManagementFilterGroup title="Phương thức TT">
            <select
              aria-label="Phương thức TT"
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
                <ManagementDataTable
                  ariaLabel="Danh sách chứng từ bán hàng"
                  columns={salesDocumentColumns}
                  getDetailLabel={(document) => `Chi tiết chứng từ ${document.code}`}
                  getRowKey={(document) => document.id}
                  items={sortedDocuments}
                  renderDetail={(document) => (
                    <SalesDocumentDetailView
                      key={selected ? selected.id : `loading-${detailErrorDocumentId ?? loadingDocumentId ?? document.id}`}
                      document={selected}
                      editDisabled={openingQuoteId === document.id || openingRevisionId === document.id}
                      error={detailError}
                      loading={loadingDocumentId === document.id}
                      onEdit={
                        document.order_type === 'quote' && document.status === 'active' && orderService && onOpenQuoteInPos
                          ? () => void openQuoteInPos(document)
                          : document.order_type === 'invoice' && document.status === 'completed' && onOpenInvoiceRevisionInPos
                            ? () => void openInvoiceRevisionInPos(document)
                            : undefined
                      }
                      onCancel={() => setCancelOpen(true)}
                      onOpenQuotePrint={onOpenQuotePrint}
                      onSaveNote={saveSelectedDocumentChanges}
                    />
                  )}
                  selectedRowKey={selected?.id ?? detailErrorDocumentId ?? loadingDocumentId}
                  onRowClick={(document, event) => {
                    if (isDetailInteractionTarget(event.target)) return
                    if (selected?.id === document.id && isOutsideRowClick(event)) return
                    void openDocument(document)
                  }}
                  onRowKeyDown={(document, event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void openDocument(document)
                    }
                  }}
                />
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
    <SalesDocumentImportDialog
      open={importOpen}
      service={service}
      onClose={() => setImportOpen(false)}
      onImported={() => void loadDocuments({ page: 1 })}
      onOldDataDeleted={() => void loadDocuments({ page: 1 })}
    />
    <ManagementConfirmDialog
      open={cancelOpen && Boolean(selected)}
      title="Hủy hóa đơn"
      message={(
        <>
          Bạn có chắc chắn muốn hủy hóa đơn <strong>{selected?.code}</strong> không?
        </>
      )}
      loading={canceling}
      onCancel={() => setCancelOpen(false)}
      onConfirm={() => void cancelSelectedDocument()}
    />
    </>
  )
}

function SalesDocumentDetailView({
  document,
  editDisabled,
  error,
  loading,
  onCancel,
  onEdit,
  onOpenQuotePrint,
  onSaveNote,
}: {
  document: SalesDocumentDetail | null
  editDisabled?: boolean
  error: string | null
  loading: boolean
  onCancel?: () => void
  onEdit?: () => void
  onOpenQuotePrint?: (documentId: string) => void
  onSaveNote?: (input: { note: string; createdAt: string }) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'payment-history'>('info')
  const [note, setNote] = useState(document?.note ?? '')
  const [createdAtInput, setCreatedAtInput] = useState(() => salesDocumentDateTimeInputText(document?.created_at))
  const [editingCreatedAt, setEditingCreatedAt] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const infoTabId = `sales-document-${document?.id ?? 'loading'}-info-tab`
  const infoPanelId = `sales-document-${document?.id ?? 'loading'}-info-panel`
  const paymentTabId = `sales-document-${document?.id ?? 'loading'}-payment-tab`
  const paymentPanelId = `sales-document-${document?.id ?? 'loading'}-payment-panel`
  const hasPaymentHistory = Array.isArray(document?.payment_receipts) && document.payment_receipts.length > 0
  const selectedTab = hasPaymentHistory ? activeTab : 'info'

  async function saveNote() {
    if (!document || !onSaveNote) return
    setSavingNote(true)
    try {
      await onSaveNote({ note, createdAt: createdAtInput })
      setEditingCreatedAt(false)
    } finally {
      setSavingNote(false)
    }
  }

  if (error) return <p role="alert">{error}</p>
  if (loading || !document) return <p>Đang tải chi tiết...</p>

  const paymentReceipts = sortManagementItemsByDateDesc(
    Array.isArray(document.payment_receipts) ? document.payment_receipts : [],
    (receipt) => receipt.created_at,
  )

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
            <h2>
              <ManagementRecordLink href={managementRecordOpenHref('/customers', document.customer.code ?? document.customer.name)}>
                {document.customer.name}
              </ManagementRecordLink>
            </h2>
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
              <dd>
                {editingCreatedAt ? (
                  <input
                    aria-label="Sửa ngày bán"
                    className="management-detail-inline-input"
                    placeholder="dd/mm/yyyy hh:mm"
                    type="text"
                    value={createdAtInput}
                    onChange={(event) => setCreatedAtInput(event.target.value)}
                  />
                ) : (
                  <button
                    className="management-link-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setEditingCreatedAt(true)
                    }}
                  >
                    {salesDocumentCreatedDateTimeText(document)}
                  </button>
                )}
              </dd>
            </div>
            {document.price_list ? (
              <div>
                <dt>Bảng giá:</dt>
                <dd>{displayPriceListName(document.price_list)}</dd>
              </div>
            ) : null}
          </dl>

          <table aria-label="Dòng hàng" className="management-detail-table management-detail-lines-table sales-document-lines-table">
            <thead>
              <tr>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>Số lượng</th>
                <th>Đơn vị</th>
                <th>Đơn giá</th>
                <th>Giảm giá</th>
                <th>Giá bán</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <ManagementRecordLink href={managementRecordOpenHref('/products', item.product.code)}>
                      {item.product.code}
                    </ManagementRecordLink>
                  </td>
                  <td>
                    <span>{item.product.name}</span>
                    {salesDocumentLineSubtexts(item).map((subtext) => (
                      <small className="sales-document-line-subtext" key={subtext}>{subtext}</small>
                    ))}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{salesDocumentUnitNameText(item.product.unit_name)}</td>
                  <td><MoneyText value={item.unit_price} /></td>
                  <td><MoneyText value={item.discount_amount} /></td>
                  <td><MoneyText value={salesDocumentLineSellPrice(item)} /></td>
                  <td><MoneyText value={item.line_total} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="management-detail-lower management-detail-lower-right">
            <ManagementDetailNoteInput
              ariaLabel="Ghi chú hóa đơn"
              placeholder="Ghi chú..."
              value={note}
              onChange={setNote}
            />
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
                    <td>
                      <ManagementRecordLink href={managementRecordOpenHref('/finance', receipt.code)}>
                        {receipt.code}
                      </ManagementRecordLink>
                    </td>
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
          { label: 'Hủy', danger: true, disabled: document.status === 'cancelled', icon: <Trash2 aria-hidden="true" size={15} />, onClick: onCancel },
          { label: 'Sao chép', icon: <Copy aria-hidden="true" size={15} /> },
        ]}
        rightActions={[
          { label: 'Sửa', disabled: editDisabled, icon: <Pencil aria-hidden="true" size={15} />, onClick: onEdit },
          { label: savingNote ? 'Đang lưu' : 'Lưu', disabled: savingNote || !onSaveNote, icon: <Save aria-hidden="true" size={15} />, onClick: () => void saveNote() },
          { label: 'Xuất file', disabled: true, title: 'Chưa hỗ trợ xuất file chứng từ bán hàng', icon: <FileOutput aria-hidden="true" size={15} /> },
          { label: 'In', icon: <Printer aria-hidden="true" size={15} /> },
        ]}
      />
    </div>
  )
}

