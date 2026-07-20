import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronRight, Copy, FileOutput, Printer, Save, Search, Trash2 } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { EmptyState, MetricCard, MetricGrid, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementConfirmDialog,
  ManagementDetailActionFooter,
  ManagementDetailNoteInput,
  ManagementDateRangeInputs,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementImportButton,
  ManagementListSurface,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableCheckboxControl,
  ManagementTableFavoriteButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, sortManagementItemsByDateDesc, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { downloadManagementCsv } from '../../components/ui-shell/management-export'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import type { InventoryProduct, InventoryProductStatusFilter, InventoryRoll, InventoryShape, InventorySheet, StockMovement, Stocktake, StocktakeCreatorOption, StocktakeDetail } from './types'
import type { InventoryService } from './inventory-service'
import {
  dateText,
  inventoryListSummary,
  numberText,
  shapeText,
  statusText,
  stocktakeDateTimeText,
  stocktakeQuantityText,
  stocktakeStatusText,
} from './inventory-presenter'
import { StocktakeImportDialog } from './StocktakeImportDialog'
import { dateRangeFromItems, displayDateRangeForData, quickDateRange, type QuickDateRangePreset } from '../../lib/date-ranges'

type InventoryView = 'products' | 'stocktakes' | 'objects'
type StocktakeDateFilter = QuickDateRangePreset | 'custom'
type StocktakeSortKey = 'code' | 'created_at' | 'product_code' | 'product_name' | 'product_system_qty' | 'product_actual_qty' | 'product_difference_qty' | 'status'
const defaultStocktakeSortState: NonNullable<ManagementSortState<StocktakeSortKey>> = { key: 'created_at', direction: 'desc' }
const stocktakeDateGroups: Array<{ title: string; presets: Array<Exclude<StocktakeDateFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]
const stocktakeDateLabels: Record<StocktakeDateFilter, string> = {
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
const defaultStocktakeStatuses: Array<Stocktake['status']> = ['draft', 'balanced', 'cancelled']
const stocktakeFavoritesStorageKey = 'inventory.stocktake.favoriteIds'

function readStocktakeFavoriteIds() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(stocktakeFavoritesStorageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeStocktakeFavoriteIds(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(stocktakeFavoritesStorageKey, JSON.stringify(ids))
}

export function InventoryPage({ service }: { service: InventoryService }) {
  const [view] = useState<InventoryView>('stocktakes')
  const [products, setProducts] = useState<InventoryProduct[] | null>(null)
  const [total, setTotal] = useState(0)
  const [productSummary, setProductSummary] = useState<{ total_qty: number; negative_count: number } | null>(null)
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState('')
  const [lastSearch, setLastSearch] = useState('')
  const [status, setStatus] = useState<InventoryProductStatusFilter>('active')
  const [shape, setShape] = useState<InventoryShape | 'all'>('all')
  const [detail, setDetail] = useState<InventoryProduct | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([])
  const [stocktakeTotal, setStocktakeTotal] = useState(0)
  const [stocktakePage, setStocktakePage] = useState(1)
  const [stocktakePageSize, setStocktakePageSize] = useState(defaultPageSize)
  const [stocktakeSearch, setStocktakeSearch] = useState('')
  const [stocktakeLastSearch, setStocktakeLastSearch] = useState('')
  const [stocktakeDateFilter, setStocktakeDateFilter] = useState<StocktakeDateFilter>('year')
  const [stocktakeDateFrom, setStocktakeDateFrom] = useState(() => quickDateRange('year').from)
  const [stocktakeDateTo, setStocktakeDateTo] = useState(() => quickDateRange('year').to)
  const [stocktakeQuickTimeOpen, setStocktakeQuickTimeOpen] = useState(false)
  const [stocktakeStatusSelection, setStocktakeStatusSelection] = useState<Array<Stocktake['status']>>(defaultStocktakeStatuses)
  const [stocktakeCreatedBy, setStocktakeCreatedBy] = useState('all')
  const [stocktakeCreatorOptionsList, setStocktakeCreatorOptionsList] = useState<StocktakeCreatorOption[]>([])
  const [stocktakeImportOpen, setStocktakeImportOpen] = useState(false)
  const [selectedStocktakeId, setSelectedStocktakeId] = useState<string | null>(null)
  const [stocktakeDetail, setStocktakeDetail] = useState<StocktakeDetail | null>(null)
  const [stocktakeDetailLoading, setStocktakeDetailLoading] = useState(false)
  const [stocktakeCancelOpen, setStocktakeCancelOpen] = useState(false)
  const [stocktakeCancelling, setStocktakeCancelling] = useState(false)
  const [favoriteStocktakeIds, setFavoriteStocktakeIds] = useState<string[]>(readStocktakeFavoriteIds)
  const [showFavoriteStocktakesOnly, setShowFavoriteStocktakesOnly] = useState(false)
  const [rolls, setRolls] = useState<InventoryRoll[]>([])
  const [sheets, setSheets] = useState<InventorySheet[]>([])
  const [materialOpeningOpen, setMaterialOpeningOpen] = useState(false)
  const [materialOpeningProductId, setMaterialOpeningProductId] = useState('')
  const [materialOpeningUnitId, setMaterialOpeningUnitId] = useState('')
  const [materialOpeningQty, setMaterialOpeningQty] = useState('1')
  const [materialOpeningOldRemaining, setMaterialOpeningOldRemaining] = useState('0')
  const [materialOpeningOldRollId, setMaterialOpeningOldRollId] = useState('')
  const [materialOpeningOldRollLength, setMaterialOpeningOldRollLength] = useState('0')
  const [materialOpeningOldSheetId, setMaterialOpeningOldSheetId] = useState('')
  const [materialOpeningOldSheetWidth, setMaterialOpeningOldSheetWidth] = useState('')
  const [materialOpeningOldSheetLength, setMaterialOpeningOldSheetLength] = useState('')
  const [materialOpeningDiscardSheet, setMaterialOpeningDiscardSheet] = useState(false)
  const [materialOpeningNote, setMaterialOpeningNote] = useState('')
  const [materialOpeningOptions, setMaterialOpeningOptions] = useState<Awaited<ReturnType<InventoryService['getMaterialOpeningOptions']>> | null>(null)
  const [materialOpeningSaving, setMaterialOpeningSaving] = useState(false)
  const [materialOpeningNotice, setMaterialOpeningNotice] = useState<string | null>(null)
  const [actualQty, setActualQty] = useState('')
  const [reason, setReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stocktakeListRequestId = useRef(0)
  const stocktakeSortInitialRender = useRef(true)

  const fallbackProductSummary = inventoryListSummary(products)
  const negativeCount = productSummary?.negative_count ?? fallbackProductSummary.negativeCount
  const totalQty = productSummary?.total_qty ?? fallbackProductSummary.totalQty
  const visibleStocktakes = showFavoriteStocktakesOnly
    ? stocktakes.filter((item) => favoriteStocktakeIds.includes(item.id))
    : stocktakes
  const {
    sortedItems: sortedVisibleStocktakes,
    sortState: stocktakeSortState,
    requestSort: requestStocktakeSort,
  } = useManagementTableSort<Stocktake, StocktakeSortKey>(visibleStocktakes, {
    code: { kind: 'text', value: (stocktake) => stocktake.code },
    created_at: { kind: 'date', value: (stocktake) => stocktake.created_at },
    product_code: { kind: 'text', value: (stocktake) => stocktake.product_code },
    product_name: { kind: 'text', value: (stocktake) => stocktake.product_name },
    product_system_qty: { kind: 'number', value: (stocktake) => stocktake.product_system_qty },
    product_actual_qty: { kind: 'number', value: (stocktake) => stocktake.product_actual_qty },
    product_difference_qty: { kind: 'number', value: (stocktake) => stocktake.product_difference_qty },
    status: { kind: 'text', value: (stocktake) => stocktakeStatusText(stocktake.status) },
  }, defaultStocktakeSortState)
  useEffect(() => {
    if (stocktakeSortInitialRender.current) {
      stocktakeSortInitialRender.current = false
      return
    }
    queueMicrotask(() => void loadStocktakeList({ page: 1, sortStateValue: stocktakeSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocktakeSortState?.key, stocktakeSortState?.direction])
  const stocktakeVisibleDateRange = stocktakeDateFilter === 'custom'
    ? { from: stocktakeDateFrom, to: stocktakeDateTo }
    : displayDateRangeForData(
        { from: stocktakeDateFrom, to: stocktakeDateTo },
        dateRangeFromItems(stocktakes, (stocktake) => stocktake.created_at),
      )

  async function loadProducts(input: {
    search?: string
    status?: InventoryProductStatusFilter
    shape?: InventoryShape | 'all'
    page?: number
    page_size?: number
  } = {}) {
    const nextSearch = input.search ?? lastSearch
    const nextStatus = input.status ?? status
    const nextShape = input.shape ?? shape
    const nextPage = input.page ?? page
    const nextPageSize = input.page_size ?? pageSize
    setError(null)
    try {
      const result = await service.listInventoryProducts({
        search: nextSearch.trim() || undefined,
        status: nextStatus,
        inventory_shape: nextShape === 'all' ? undefined : nextShape,
        page: nextPage,
        page_size: nextPageSize,
      })
      setProducts(result.items)
      setTotal(result.total)
      setProductSummary(result.summary ?? null)
      setPage(result.page)
      setPageSize(result.page_size)
      setLastSearch(nextSearch.trim())
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được tồn kho.'))
    }
  }

  async function loadStocktakeList(input: {
    search?: string
    statusSelection?: Array<Stocktake['status']>
    dateFilter?: StocktakeDateFilter
    from?: string
    to?: string
    createdBy?: string
    page?: number
    page_size?: number
    sortStateValue?: ManagementSortState<StocktakeSortKey>
  } = {}) {
    const nextSearch = input.search ?? stocktakeLastSearch
    const nextStatusSelection = input.statusSelection ?? stocktakeStatusSelection
    const nextDateFilter = input.dateFilter ?? stocktakeDateFilter
    const nextFrom = input.from ?? stocktakeDateFrom
    const nextTo = input.to ?? stocktakeDateTo
    const nextCreatedBy = input.createdBy ?? stocktakeCreatedBy
    const nextSortState = input.sortStateValue ?? stocktakeSortState
    const nextPage = input.page ?? stocktakePage
    const nextPageSize = input.page_size ?? stocktakePageSize
    const requestId = stocktakeListRequestId.current + 1
    stocktakeListRequestId.current = requestId
    setError(null)
    try {
      const result = await service.listStocktakes({
        ...(nextSearch.trim() ? { search: nextSearch.trim() } : {}),
        status: stocktakeStatusQuery(nextStatusSelection),
        ...(nextDateFilter !== 'all' && nextFrom ? { from: nextFrom } : {}),
        ...(nextDateFilter !== 'all' && nextTo ? { to: nextTo } : {}),
        ...(nextCreatedBy !== 'all' ? { created_by: nextCreatedBy } : {}),
        page: nextPage,
        page_size: nextPageSize,
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultStocktakeSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
      })
      if (stocktakeListRequestId.current !== requestId) return
      setStocktakes(result.items)
      setStocktakeCreatorOptionsList(result.creator_options ?? stocktakeCreatorOptions(result.items))
      setStocktakeTotal(result.total)
      setStocktakePage(result.page)
      setStocktakePageSize(result.page_size)
      setStocktakeLastSearch(nextSearch.trim())
    } catch (cause) {
      if (stocktakeListRequestId.current !== requestId) return
      setError(formatApiError(cause, 'Không tải được phiếu kiểm kho.'))
    }
  }

  async function exportCurrentView() {
    setError(null)
    try {
      if (view === 'stocktakes') {
        const exportPageSize = Math.max(stocktakeTotal, stocktakes.length, 1)
        const exportSortState = stocktakeSortState ?? defaultStocktakeSortState
        const result = await service.listStocktakes({
          search: stocktakeLastSearch || undefined,
          status: stocktakeStatusQuery(stocktakeStatusSelection),
          ...(stocktakeDateFilter !== 'all' && stocktakeDateFrom ? { from: stocktakeDateFrom } : {}),
          ...(stocktakeDateFilter !== 'all' && stocktakeDateTo ? { to: stocktakeDateTo } : {}),
          ...(stocktakeCreatedBy !== 'all' ? { created_by: stocktakeCreatedBy } : {}),
          page: 1,
          page_size: exportPageSize,
          sort_key: exportSortState.key,
          sort_direction: exportSortState.direction,
        })
        downloadManagementCsv({
          filename: 'kiem-kho.csv',
          rows: [
            ['Mã phiếu', 'Thời gian', 'Mã hàng', 'Tên hàng', 'Tồn hệ thống', 'Thực tế', 'Chênh lệch', 'Trạng thái', 'Người tạo', 'Ghi chú'],
            ...result.items.map((stocktake) => [
              stocktake.code,
              stocktake.created_at,
              stocktake.product_code,
              stocktake.product_name,
              stocktake.product_system_qty ?? '',
              stocktake.product_actual_qty ?? '',
              stocktake.product_difference_qty ?? '',
              stocktakeStatusText(stocktake.status),
              stocktake.created_by?.name ?? '',
              stocktake.note ?? '',
            ]),
          ],
        })
        return
      }
      const exportPageSize = Math.max(total, products?.length ?? 0, 1)
      const result = await service.listInventoryProducts({
        search: lastSearch || undefined,
        status,
        inventory_shape: shape === 'all' ? undefined : shape,
        page: 1,
        page_size: exportPageSize,
      })
      downloadManagementCsv({
        filename: 'hang-ton-kho.csv',
        rows: [
          ['Mã hàng', 'Tên hàng', 'Đơn vị', 'Kiểu tồn', 'Tồn kho', 'Tồn âm', 'Trạng thái'],
          ...result.items.map((product) => [
            product.code,
            product.name,
            product.stock_unit,
            shapeText(product.inventory_shape),
            product.available_qty,
            product.is_negative ? 'Có' : 'Không',
            product.status === 'active' ? 'Đang kinh doanh' : 'Ngừng kinh doanh',
          ]),
        ],
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không xuất được file tồn kho.'))
    }
  }

  function closeMaterialOpening() {
    setMaterialOpeningOpen(false)
    setMaterialOpeningProductId('')
    setMaterialOpeningUnitId('')
    setMaterialOpeningQty('1')
    setMaterialOpeningOldRemaining('0')
    setMaterialOpeningOldRollId('')
    setMaterialOpeningOldRollLength('0')
    setMaterialOpeningOldSheetId('')
    setMaterialOpeningOldSheetWidth('')
    setMaterialOpeningOldSheetLength('')
    setMaterialOpeningDiscardSheet(false)
    setMaterialOpeningNote('')
    setMaterialOpeningOptions(null)
    setMaterialOpeningNotice(null)
  }

  async function selectMaterialOpeningProduct(productId: string) {
    setMaterialOpeningProductId(productId)
    setMaterialOpeningUnitId('')
    setMaterialOpeningOptions(null)
    setMaterialOpeningNotice(null)
    setMaterialOpeningOldRollId('')
    setMaterialOpeningOldRollLength('0')
    setMaterialOpeningOldSheetId('')
    setMaterialOpeningOldSheetWidth('')
    setMaterialOpeningOldSheetLength('')
    setMaterialOpeningDiscardSheet(false)
    if (!productId) return
    setError(null)
    try {
      const options = await service.getMaterialOpeningOptions(productId)
      setMaterialOpeningOptions(options)
      setMaterialOpeningUnitId(options.conversions[0]?.unit_id ?? '')
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được đơn vị khui.'))
    }
  }

  async function submitMaterialOpening(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const inventoryShape = materialOpeningOptions?.product.inventory_shape ?? 'normal'
    const openedQty = Number(materialOpeningQty)
    const oldRemainingQty = Number(materialOpeningOldRemaining)
    const oldRollLength = Number(materialOpeningOldRollLength)
    const oldSheetWidth = Number(materialOpeningOldSheetWidth)
    const oldSheetLength = Number(materialOpeningOldSheetLength)
    const note = materialOpeningNote.trim()
    if (!materialOpeningProductId) {
      setError('Thông tin khui vật tư chưa hợp lệ.')
      return
    }
    if (inventoryShape === 'normal' && (!materialOpeningUnitId || !Number.isFinite(openedQty) || openedQty <= 0 || !Number.isFinite(oldRemainingQty) || oldRemainingQty < 0)) {
      setError('Thông tin khui vật tư chưa hợp lệ.')
      return
    }
    if (inventoryShape === 'roll' && (!materialOpeningOldRollId.trim() || !Number.isFinite(oldRollLength) || oldRollLength < 0)) {
      setError('Thông tin khui cuộn chưa hợp lệ.')
      return
    }
    if (inventoryShape === 'sheet' && (!materialOpeningOldSheetId.trim() || (!materialOpeningDiscardSheet && (!Number.isFinite(oldSheetWidth) || oldSheetWidth <= 0 || !Number.isFinite(oldSheetLength) || oldSheetLength <= 0)))) {
      setError('Thông tin khui tấm chưa hợp lệ.')
      return
    }
    setMaterialOpeningSaving(true)
    setError(null)
    try {
      const result = inventoryShape === 'normal'
        ? await service.createMaterialOpening({
          product_id: materialOpeningProductId,
          inventory_shape: 'normal',
          opened_unit_id: materialOpeningUnitId,
          opened_qty: openedQty,
          old_remaining_qty: oldRemainingQty,
          ...(note ? { note } : {}),
        })
        : inventoryShape === 'roll'
          ? await service.createMaterialOpening({
            product_id: materialOpeningProductId,
            inventory_shape: 'roll',
            old_inventory_roll_id: materialOpeningOldRollId.trim(),
            old_remaining_length_m: oldRollLength,
            ...(note ? { note } : {}),
          })
          : await service.createMaterialOpening({
            product_id: materialOpeningProductId,
            inventory_shape: 'sheet',
            old_inventory_sheet_id: materialOpeningOldSheetId.trim(),
            ...(materialOpeningDiscardSheet
              ? { discard_old_sheet: true }
              : { old_remaining_width_m: oldSheetWidth, old_remaining_length_m: oldSheetLength }),
            ...(note ? { note } : {}),
          })
      setMaterialOpeningNotice(`Đã khui ${result.opened_stock_qty === null ? 'Chưa có' : numberText(result.opened_stock_qty)} ${materialOpeningOptions?.product.stock_unit.name ?? ''}.`)
      await loadProducts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không khui được vật tư.'))
    } finally {
      setMaterialOpeningSaving(false)
    }
  }

  useEffect(() => {
    let active = true
    async function loadInitial() {
      try {
        if (view === 'stocktakes') {
          const range = quickDateRange('year')
          const result = await service.listStocktakes({
            status: stocktakeStatusQuery(defaultStocktakeStatuses),
            from: range.from,
            to: range.to,
            page: 1,
            page_size: defaultPageSize,
          })
          if (!active) return
          setStocktakes(result.items)
          setStocktakeCreatorOptionsList(result.creator_options ?? stocktakeCreatorOptions(result.items))
          setStocktakeTotal(result.total)
          setStocktakePage(result.page)
          setStocktakePageSize(result.page_size)
          return
        }
        if (view === 'objects') {
          const [rollResult, sheetResult] = await Promise.all([
            service.listInventoryRolls({ page: 1, page_size: defaultPageSize }),
            service.listInventorySheets({ page: 1, page_size: defaultPageSize }),
          ])
          if (!active) return
          setRolls(rollResult.items)
          setSheets(sheetResult.items)
          return
        }
        const productResult = await service.listInventoryProducts({ status: 'active', page: 1, page_size: defaultPageSize })
        if (!active) return
        setProducts(productResult.items)
        setProductSummary(productResult.summary ?? null)
        setTotal(productResult.total)
        setPage(productResult.page)
        setPageSize(productResult.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được tồn kho.'))
      }
    }
    void loadInitial()
    return () => {
      active = false
    }
  }, [defaultPageSize, service, view])

  async function filterProducts(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyFilters(search))
  }

  async function filterStocktakes(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => {
      setStocktakePage(1)
      return loadStocktakeList({ search: stocktakeSearch, page: 1, page_size: stocktakePageSize })
    })
  }

  function changeStocktakeSearch(nextSearch: string) {
    setStocktakeSearch(nextSearch)
    setSelectedStocktakeId(null)
    setStocktakeDetail(null)
    void loadStocktakeList({ search: nextSearch, page: 1, page_size: stocktakePageSize })
  }

  function toggleStocktakeStatus(nextStatus: Stocktake['status']) {
    setStocktakeStatusSelection((current) => {
      const nextSelection = current.includes(nextStatus)
        ? current.filter((candidate) => candidate !== nextStatus)
        : [...current, nextStatus]
      setStocktakeQuickTimeOpen(false)
      void loadStocktakeList({ statusSelection: nextSelection, page: 1, page_size: stocktakePageSize })
      return nextSelection
    })
  }

  function applyStocktakeQuickDateFilter(nextFilter: Exclude<StocktakeDateFilter, 'custom'>) {
    const range = quickDateRange(nextFilter)
    setStocktakeDateFilter(nextFilter)
    setStocktakeQuickTimeOpen(false)
    setStocktakeDateFrom(range.from)
    setStocktakeDateTo(range.to)
    void loadStocktakeList({ dateFilter: nextFilter, from: range.from, to: range.to, page: 1, page_size: stocktakePageSize })
  }

  function applyStocktakeCustomDateFilter(input: { from?: string; to?: string } = {}) {
    const nextFrom = input.from ?? stocktakeDateFrom
    const nextTo = input.to ?? stocktakeDateTo
    setStocktakeDateFilter('custom')
    setStocktakeQuickTimeOpen(false)
    setStocktakeDateFrom(nextFrom)
    setStocktakeDateTo(nextTo)
    void loadStocktakeList({ dateFilter: 'custom', from: nextFrom, to: nextTo, page: 1, page_size: stocktakePageSize })
  }

  function applyStocktakeCreatorFilter(nextCreatedBy: string) {
    setStocktakeCreatedBy(nextCreatedBy)
    setStocktakeQuickTimeOpen(false)
    void loadStocktakeList({ createdBy: nextCreatedBy, page: 1, page_size: stocktakePageSize })
  }

  function toggleStocktakeFavorite(item: Stocktake) {
    const nextIds = favoriteStocktakeIds.includes(item.id)
      ? favoriteStocktakeIds.filter((id) => id !== item.id)
      : [...favoriteStocktakeIds, item.id]
    setFavoriteStocktakeIds(nextIds)
    writeStocktakeFavoriteIds(nextIds)
  }

  async function openStocktakeDetail(item: Stocktake) {
    if (selectedStocktakeId === item.id && stocktakeDetail?.id === item.id) {
      setSelectedStocktakeId(null)
      setStocktakeDetail(null)
      return
    }
    setSelectedStocktakeId(item.id)
    setStocktakeDetail(null)
    setStocktakeDetailLoading(true)
    setError(null)
    try {
      const nextDetail = await service.getStocktake(item.id)
      setStocktakeDetail(nextDetail)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết phiếu kiểm kho.'))
    } finally {
      setStocktakeDetailLoading(false)
    }
  }

  async function saveStocktakeDetailNote(nextNote: string) {
    if (!stocktakeDetail) return
    setError(null)
    try {
      const saved = await service.updateStocktakeNote(stocktakeDetail.id, { note: nextNote.trim() || null })
      setStocktakeDetail(saved)
      setStocktakes((current) => current.map((item) => (
        item.id === saved.id ? { ...item, note: saved.note } : item
      )))
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được ghi chú phiếu kiểm kho.'))
      throw cause
    }
  }

  async function cancelStocktakeDetail() {
    if (!stocktakeDetail) return
    setError(null)
    setStocktakeCancelling(true)
    try {
      const saved = await service.cancelStocktake(stocktakeDetail.id)
      setStocktakeDetail(saved)
      setStocktakes((current) => current.map((item) => (
        item.id === saved.id ? { ...item, status: saved.status, balanced_at: saved.balanced_at } : item
      )))
      setStocktakeCancelOpen(false)
    } catch (cause) {
      setError(formatApiError(cause, 'Không hủy được phiếu kiểm kho.'))
      throw cause
    } finally {
      setStocktakeCancelling(false)
    }
  }

  async function applyFilters(nextSearch = search) {
    setPage(1)
    await loadProducts({ search: nextSearch, status, shape, page: 1 })
  }

  function changeProductSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch,
      resetSelection: () => {
        setDetail(null)
        setMovements([])
      },
      load: applyFilters,
    })
  }

  async function openProduct(product: InventoryProduct) {
    setError(null)
    try {
      const [productDetail, movementResult, stocktakeResult] = await Promise.all([
        service.getInventoryProduct(product.product_id),
        service.listStockMovements({ product_id: product.product_id, page: 1, page_size: 10 }),
        service.listStocktakes({ page: 1, page_size: 10 }),
      ])
      setDetail(productDetail)
      setMovements(movementResult.items)
      setStocktakes(stocktakeResult.items)
      setStocktakeCreatorOptionsList(stocktakeResult.creator_options ?? stocktakeCreatorOptions(stocktakeResult.items))
      setActualQty(String(productDetail.available_qty))
      setReason('')
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết tồn kho.'))
    }
  }

  async function adjustStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (detail === null) return
    setAdjusting(true)
    setError(null)
    try {
      await service.adjustNormalProductStock(detail.product_id, {
        actual_qty: Number(actualQty),
        reason: reason.trim(),
      })
      await loadProducts()
      await openProduct(detail)
    } catch (cause) {
      setError(formatApiError(cause, 'Không cân bằng được tồn kho.'))
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <ManagementPage
      title={view === 'stocktakes' ? 'Phiếu kiểm kho' : view === 'objects' ? 'Tồn theo cuộn/tấm' : 'Hàng hóa'}
      actions={
        view === 'products' ? (
            <ManagementCompactToolbar ariaLabel="Lọc hàng hóa" onSubmit={filterProducts}>
              <ManagementCompactSearch
                label="Tìm hàng hóa"
                placeholder="Mã hàng, tên hàng"
                value={search}
                leadingIcon={<Search aria-hidden="true" size={16} />}
                onChange={changeProductSearch}
              />
            </ManagementCompactToolbar>
          ) : view === 'stocktakes' ? (
            <ManagementCompactToolbar ariaLabel="Lọc phiếu kiểm kho" onSubmit={filterStocktakes}>
                <ManagementCompactSearch
                  label="Tìm phiếu kiểm kho"
                  placeholder="Mã phiếu, mã hàng, tên hàng"
                  value={stocktakeSearch}
                leadingIcon={<Search aria-hidden="true" size={16} />}
                trailingAction={<ManagementCompactCreateAction ariaLabel="Tạo phiếu kiểm kho" onClick={() => undefined} />}
                onChange={changeStocktakeSearch}
              />
              <button className="button button-secondary" disabled type="button">Tồn theo cuộn/tấm</button>
              <button className="button button-secondary" disabled type="button">Khui vật tư</button>
              <ManagementImportButton onClick={() => setStocktakeImportOpen(true)}>Import</ManagementImportButton>
                <button className="button button-secondary" type="button" onClick={() => void exportCurrentView()}>Xuất file</button>
              <button className="button button-secondary" type="button" onClick={() => void exportCurrentView()}>
                <FileOutput aria-hidden="true" size={16} />
                Xuất file nhiều phiếu
              </button>
            </ManagementCompactToolbar>
          ) : (
            <div className="management-page-actions">
              <button className="button button-secondary" type="button">+ Cuộn</button>
              <button className="button button-secondary" type="button">+ Tấm</button>
            </div>
          )
      }
      kpis={view === 'products' ? (
        <MetricGrid ariaLabel="Tổng quan hàng hóa">
          <MetricCard label="Mặt hàng" value={total} hint="Theo bộ lọc hiện tại" tone="info" />
          <MetricCard label="Tồn kho" value={numberText(totalQty)} hint="Theo bộ lọc hiện tại" tone="neutral" />
          <MetricCard label="Âm kho" value={negativeCount} hint="Cần kiểm tra" tone={negativeCount > 0 ? 'danger' : 'success'} />
        </MetricGrid>
      ) : undefined}
      filter={
        view === 'products' ? (
          <ManagementFilterSidebar
            ariaLabel="Bộ lọc hàng hóa"
            actions={
              <button className="button button-primary" type="button" onClick={() => void applyFilters()}>Áp dụng bộ lọc</button>
            }
          >
            <ManagementFilterGroup title="Trạng thái hàng hóa">
              <select
                aria-label="Trạng thái hàng hóa"
                className="management-filter-select"
                value={status}
                onChange={(event) => setStatus(event.target.value as InventoryProductStatusFilter)}
              >
                <option value="active">{statusText('active')}</option>
                <option value="inactive">{statusText('inactive')}</option>
                <option value="all">{statusText('all')}</option>
                <option value="deleted">{statusText('deleted')}</option>
              </select>
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Loại hàng">
              <select
                aria-label="Loại hàng"
                className="management-filter-select"
                value={shape}
                onChange={(event) => setShape(event.target.value as InventoryShape | 'all')}
              >
                <option value="all">{shapeText('all')}</option>
                <option value="normal">{shapeText('normal')}</option>
                <option value="roll">{shapeText('roll')}</option>
                <option value="sheet">{shapeText('sheet')}</option>
              </select>
            </ManagementFilterGroup>
          </ManagementFilterSidebar>
        ) : view === 'stocktakes' ? (
          <ManagementFilterSidebar
            ariaLabel="Bộ lọc phiếu kiểm kho"
            onPopoverClose={() => setStocktakeQuickTimeOpen(false)}
            popoverOpen={stocktakeQuickTimeOpen}
          >
            <ManagementFilterGroup title="Ngày tạo">
              <div className="management-filter-time-options">
                <button
                  aria-expanded={stocktakeQuickTimeOpen}
                  className="management-filter-choice management-filter-time-trigger"
                  type="button"
                  onClick={() => setStocktakeQuickTimeOpen((current) => !current)}
                >
                  <span>{stocktakeDateFilter === 'custom' ? `${stocktakeDisplayDate(stocktakeDateFrom)} - ${stocktakeDisplayDate(stocktakeDateTo)}` : stocktakeDateLabels[stocktakeDateFilter]}</span>
                  <span className="management-filter-choice-trailing">
                    <ChevronRight aria-hidden="true" size={17} />
                  </span>
                </button>
              </div>
              {stocktakeQuickTimeOpen ? (
                <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                  {stocktakeDateGroups.map((group) => (
                    <section key={group.title}>
                      <h3>{group.title}</h3>
                      <div>
                        {group.presets.map((preset) => (
                          <button
                            className={stocktakeDateFilter === preset ? 'management-filter-quick-time-active' : undefined}
                            key={preset}
                            type="button"
                            onClick={() => applyStocktakeQuickDateFilter(preset)}
                          >
                            {stocktakeDateLabels[preset]}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
              <ManagementDateRangeInputs
                displayFrom={stocktakeVisibleDateRange.from}
                displayTo={stocktakeVisibleDateRange.to}
                from={stocktakeDateFrom}
                to={stocktakeDateTo}
                onCalendarOpen={() => setStocktakeQuickTimeOpen(false)}
                onFromChange={(value) => applyStocktakeCustomDateFilter({ from: value })}
                onToChange={(value) => applyStocktakeCustomDateFilter({ to: value })}
              />
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Trạng thái">
              {[
                ['draft', 'Phiếu tạm'],
                ['balanced', 'Đã cân bằng kho'],
                ['cancelled', 'Đã hủy'],
              ].map(([value, label]) => {
                const stocktakeStatus = value as Stocktake['status']
                const checked = stocktakeStatusSelection.includes(stocktakeStatus)
                return (
                  <label className={`management-filter-choice${checked ? ' management-filter-choice-active' : ''}`} key={value}>
                    <input
                      aria-label={label}
                      checked={checked}
                      type="checkbox"
                      onChange={() => toggleStocktakeStatus(stocktakeStatus)}
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Người tạo">
              <select
                aria-label="Người tạo"
                className="management-filter-select"
                value={stocktakeCreatedBy}
                onChange={(event) => applyStocktakeCreatorFilter(event.target.value)}
              >
                <option value="all">Tất cả người tạo</option>
                {stocktakeCreatorOptionsList.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.name}
                  </option>
                ))}
              </select>
            </ManagementFilterGroup>
          </ManagementFilterSidebar>
        ) : (
          <ManagementFilterSidebar ariaLabel="Bộ lọc tồn theo cuộn tấm">
            <ManagementFilterGroup title="Loại đối tượng">
              <select aria-label="Loại đối tượng tồn" className="management-filter-select" defaultValue="all">
                <option value="all">Tất cả</option>
                <option value="roll">Cuộn</option>
                <option value="sheet">Tấm</option>
              </select>
            </ManagementFilterGroup>
          </ManagementFilterSidebar>
        )
      }
    >
      {view === 'stocktakes' ? (
        <ManagementListSurface ariaLabel="Danh sách phiếu kiểm kho">
          {error ? <p role="alert">{error}</p> : null}
          <ManagementTableViewport>
            <table aria-label="Danh sách phiếu kiểm kho" className="management-table">
              <thead>
                <tr>
                  <th className="finance-cashbook-select-column">
                    <ManagementTableCheckboxControl ariaLabel="Chọn tất cả phiếu kiểm kho" />
                  </th>
                  <th aria-label="Đánh dấu" className="finance-cashbook-star-column">
                    <ManagementTableFavoriteButton
                      active={showFavoriteStocktakesOnly}
                      ariaLabel={showFavoriteStocktakesOnly ? 'Hiện tất cả phiếu kiểm kho' : 'Chỉ hiện phiếu kiểm kho ưu tiên'}
                      onClick={() => setShowFavoriteStocktakesOnly(!showFavoriteStocktakesOnly)}
                    />
                  </th>
                  <ManagementSortableHeader kind="text" sortKey="code" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Mã phiếu</ManagementSortableHeader>
                  <ManagementSortableHeader kind="date" sortKey="created_at" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Ngày kiểm</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="product_code" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Mã hàng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="product_name" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Tên hàng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="product_system_qty" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Tồn trước</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="product_actual_qty" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Kiểm được</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="product_difference_qty" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Lệch</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="status" sortState={stocktakeSortState} onSort={requestStocktakeSort}>Trạng thái</ManagementSortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedVisibleStocktakes.map((item) => (
                  <Fragment key={item.id}>
                    <tr
                      aria-expanded={selectedStocktakeId === item.id}
                      className={`management-data-row${selectedStocktakeId === item.id ? ' management-data-row-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => void openStocktakeDetail(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          void openStocktakeDetail(item)
                        }
                      }}
                    >
                      <td className="finance-cashbook-select-column">
                        <ManagementTableCheckboxControl
                          ariaLabel={`Chọn phiếu kiểm kho ${item.code}`}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                      <td className="finance-cashbook-star-column">
                        <ManagementTableFavoriteButton
                          active={favoriteStocktakeIds.includes(item.id)}
                          ariaLabel={favoriteStocktakeIds.includes(item.id) ? `Bỏ ưu tiên ${item.code}` : `Đánh dấu ưu tiên ${item.code}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleStocktakeFavorite(item)
                          }}
                        />
                      </td>
                      <td>
                        <button
                          className="management-link-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void openStocktakeDetail(item)
                          }}
                        >
                          <strong>{item.code}</strong>
                        </button>
                      </td>
                      <td>{stocktakeDateTimeText(item.created_at)}</td>
                      <td>{item.product_code || ''}</td>
                      <td>{item.product_name || ''}</td>
                      <td>{stocktakeQuantityText(item.product_system_qty ?? null)}</td>
                      <td>{stocktakeQuantityText(item.product_actual_qty ?? null)}</td>
                      <td>{stocktakeQuantityText(item.product_difference_qty ?? null)}</td>
                      <td><StatusChip tone={item.status === 'balanced' ? 'success' : 'neutral'}>{stocktakeStatusText(item.status)}</StatusChip></td>
                    </tr>
                    {selectedStocktakeId === item.id ? (
                      <ManagementDetailRow colSpan={10} label={`Chi tiết phiếu kiểm kho ${item.code}`}>
                        {stocktakeDetailLoading ? <p>Đang tải chi tiết phiếu kiểm kho...</p> : null}
                        {!stocktakeDetailLoading && stocktakeDetail ? (
                          <StocktakeInlineDetail
                            key={stocktakeDetail.id}
                            detail={stocktakeDetail}
                            onCancel={() => setStocktakeCancelOpen(true)}
                            onSaveNote={saveStocktakeDetailNote}
                          />
                        ) : null}
                      </ManagementDetailRow>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
          <ManagementTableFooter
            ariaLabel="Phân trang phiếu kiểm kho"
            entityLabel="phiếu kiểm"
            page={stocktakePage}
            pageSize={stocktakePageSize}
            total={stocktakeTotal}
            canGoPrevious={stocktakePage > 1}
            canGoNext={stocktakePage * stocktakePageSize < stocktakeTotal}
            onPageSizeChange={(nextPageSize) => void loadStocktakeList({ page: 1, page_size: nextPageSize })}
            onFirst={() => void loadStocktakeList({ page: 1 })}
            onPrevious={() => void loadStocktakeList({ page: Math.max(1, stocktakePage - 1) })}
            onNext={() => void loadStocktakeList({ page: stocktakePage + 1 })}
            onLast={() => void loadStocktakeList({ page: Math.max(1, Math.ceil(stocktakeTotal / stocktakePageSize)) })}
          />
        </ManagementListSurface>
      ) : view === 'objects' ? (
        <ManagementListSurface ariaLabel="Danh sách tồn theo cuộn tấm">
          {error ? <p role="alert">{error}</p> : null}
          <ManagementTableViewport>
            <table aria-label="Danh sách tồn theo cuộn tấm" className="management-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Mã đối tượng</th>
                  <th>Sản phẩm</th>
                  <th>Khổ rộng</th>
                  <th>Chiều dài</th>
                  <th>Diện tích</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((roll) => (
                  <tr key={`roll-${roll.id}`}>
                    <td>Cuộn</td>
                    <td><strong>{roll.code}</strong></td>
                    <td>{roll.product_id}</td>
                    <td>{numberText(roll.width_m)} m</td>
                    <td>{numberText(roll.remaining_length_m)} m</td>
                    <td>{numberText(roll.remaining_area_m2)} m²</td>
                    <td><StatusChip tone={roll.status === 'empty' || roll.status === 'discarded' ? 'neutral' : 'success'}>{roll.status}</StatusChip></td>
                    <td>{roll.note ?? ''}</td>
                  </tr>
                ))}
                {sheets.map((sheet) => (
                  <tr key={`sheet-${sheet.id}`}>
                    <td>Tấm</td>
                    <td><strong>{sheet.code}</strong></td>
                    <td>{sheet.product_id}</td>
                    <td>{numberText(sheet.width_m)} m</td>
                    <td>{numberText(sheet.length_m)} m</td>
                    <td>{numberText(sheet.area_m2)} m²</td>
                    <td><StatusChip tone={sheet.status === 'discarded' || sheet.status === 'used' ? 'neutral' : 'success'}>{sheet.status}</StatusChip></td>
                    <td>{sheet.note ?? ''}</td>
                  </tr>
                ))}
                {rolls.length === 0 && sheets.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Chưa có tồn theo cuộn/tấm.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ManagementTableViewport>
        </ManagementListSurface>
      ) : (
        <ManagementListSurface ariaLabel="Danh sách hàng hóa">
        {error ? <p role="alert">{error}</p> : null}
        {products === null ? <p>Đang tải hàng hóa...</p> : null}
        {products !== null && products.length === 0 ? <EmptyState>Chưa có hàng hóa theo bộ lọc.</EmptyState> : null}
        {products !== null && products.length > 0 ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Danh sách hàng hóa" className="management-table">
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng</th>
                    <th>Loại hàng</th>
                    <th>Tồn kho</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.product_id}>
                      <td><strong>{product.code}</strong></td>
                      <td>{product.name}</td>
                      <td>{shapeText(product.inventory_shape)}</td>
                      <td>{numberText(product.available_qty)} {product.stock_unit}</td>
                      <td>
                        {product.is_negative ? <StatusChip tone="danger">Âm kho</StatusChip> : <StatusChip tone="success">Ổn</StatusChip>}
                      </td>
                      <td>
                        <ManagementRowActionButton
                          ariaLabel={`Xem hàng hóa ${product.code}`}
                          onClick={() => void openProduct(product)}
                        >
                          Xem {product.code}
                        </ManagementRowActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang hàng hóa"
              entityLabel="mặt hàng"
              page={page}
              pageSize={pageSize}
              total={total}
              canGoPrevious={page > 1}
              canGoNext={page * pageSize < total}
              onPageSizeChange={(nextPageSize) => void loadProducts({ page: 1, page_size: nextPageSize })}
              onFirst={() => void loadProducts({ page: 1 })}
              onPrevious={() => void loadProducts({ page: Math.max(1, page - 1) })}
              onNext={() => void loadProducts({ page: page + 1 })}
              onLast={() => void loadProducts({ page: Math.max(1, Math.ceil(total / pageSize)) })}
            />
          </>
        ) : null}
        </ManagementListSurface>
      )}

      {detail ? (
        <section aria-label={`Chi tiết hàng hóa ${detail.code}`} className="management-inline-detail">
          <header>
            <div>
              <h2>{detail.name}</h2>
              <p>{detail.code} · {shapeText(detail.inventory_shape)}</p>
            </div>
            <button aria-label="Đóng chi tiết hàng hóa" className="button button-secondary" type="button" onClick={() => setDetail(null)}>
              <ChevronRight aria-hidden="true" size={16} />
              Đóng
            </button>
          </header>
          <dl className="management-detail-list">
            <div>
              <dt>Tồn kho</dt>
              <dd>{numberText(detail.available_qty)} {detail.stock_unit}</dd>
            </div>
            <div>
              <dt>Trạng thái hàng</dt>
              <dd>{statusText(detail.status)}</dd>
            </div>
          </dl>

          {detail.inventory_shape === 'normal' ? (
            <form aria-label="Cân bằng kho" className="management-detail-form" onSubmit={adjustStock}>
              <label>
                Tồn thực tế
                <input
                  aria-label="Tồn thực tế"
                  min="0"
                  step="0.001"
                  type="number"
                  value={actualQty}
                  onChange={(event) => setActualQty(event.target.value)}
                />
              </label>
              <label>
                Lý do điều chỉnh
                <input
                  aria-label="Lý do điều chỉnh"
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <button className="button button-primary" disabled={adjusting} type="submit">
                Cân bằng kho
              </button>
            </form>
          ) : (
            <p>Điều chỉnh nhanh chỉ áp dụng cho hàng thường.</p>
          )}

          <section aria-label="Lịch sử xuất nhập tồn">
            <h3>Lịch sử xuất nhập tồn</h3>
            {movements.length === 0 ? <p>Chưa có biến động kho.</p> : (
              <ul>
                {sortManagementItemsByDateDesc(movements, (movement) => movement.created_at).map((movement) => (
                  <li key={movement.id}>
                    <span>{movement.movement_type}</span>
                    <strong>{numberText(movement.quantity_delta)}</strong>
                    <small>{dateText(movement.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Phiếu kiểm kho gần đây">
            <h3>Phiếu kiểm kho gần đây</h3>
            {stocktakes.length === 0 ? <p>Chưa có phiếu kiểm kho.</p> : (
              <ul>
                {sortManagementItemsByDateDesc(stocktakes, (item) => item.created_at).map((item) => (
                  <li key={item.id}>
                    <span>{item.code}</span>
                    <StatusChip tone={item.status === 'balanced' ? 'success' : 'neutral'}>{stocktakeStatusText(item.status)}</StatusChip>
                    <small>{stocktakeDateTimeText(item.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      ) : null}
      {materialOpeningOpen ? (
        <div className="management-modal-backdrop">
          <section aria-label="Khui vật tư" aria-modal="true" className="management-modal-dialog" role="dialog">
            <form className="management-detail-form" onSubmit={(event) => void submitMaterialOpening(event)}>
              <header className="management-modal-header">
                <h2>Khui vật tư</h2>
                <button aria-label="Đóng khui vật tư" className="management-icon-button" type="button" onClick={closeMaterialOpening}>
                  ×
                </button>
              </header>
              {materialOpeningNotice ? <p role="status">{materialOpeningNotice}</p> : null}
              <label>
                Vật tư
                <select
                  aria-label="Vật tư khui"
                  value={materialOpeningProductId}
                  onChange={(event) => void selectMaterialOpeningProduct(event.target.value)}
                >
                  <option value="">Chọn vật tư</option>
                  {(products ?? []).map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.code} · {product.name} · {shapeText(product.inventory_shape)}
                    </option>
                  ))}
                </select>
              </label>
              {(materialOpeningOptions?.product.inventory_shape ?? 'normal') === 'normal' ? (
                <>
                  <label>
                    Đơn vị khui
                    <select
                      aria-label="Đơn vị khui"
                      value={materialOpeningUnitId}
                      onChange={(event) => setMaterialOpeningUnitId(event.target.value)}
                    >
                      <option value="">Chọn đơn vị</option>
                      {(materialOpeningOptions?.conversions ?? []).map((conversion) => (
                        <option key={conversion.unit_id} value={conversion.unit_id}>
                          {conversion.name} ({numberText(conversion.stock_qty_per_unit)} {materialOpeningOptions?.product.stock_unit.name})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Số lượng khui mới
                    <input
                      aria-label="Số lượng khui mới"
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={materialOpeningQty}
                      onChange={(event) => setMaterialOpeningQty(event.target.value)}
                    />
                  </label>
                  <label>
                    Phần cũ còn lại
                    <input
                      aria-label="Phần cũ còn lại"
                      min="0"
                      step="0.001"
                      type="number"
                      value={materialOpeningOldRemaining}
                      onChange={(event) => setMaterialOpeningOldRemaining(event.target.value)}
                    />
                  </label>
                </>
              ) : materialOpeningOptions?.product.inventory_shape === 'roll' ? (
                <>
                  <label>
                    Cuộn cũ
                    <input
                      aria-label="Cuộn cũ"
                      placeholder="ID cuộn cũ"
                      value={materialOpeningOldRollId}
                      onChange={(event) => setMaterialOpeningOldRollId(event.target.value)}
                    />
                  </label>
                  <label>
                    Dài cũ còn lại
                    <input
                      aria-label="Dài cũ còn lại"
                      min="0"
                      step="0.001"
                      type="number"
                      value={materialOpeningOldRollLength}
                      onChange={(event) => setMaterialOpeningOldRollLength(event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Tấm cũ
                    <input
                      aria-label="Tấm cũ"
                      placeholder="ID tấm cũ"
                      value={materialOpeningOldSheetId}
                      onChange={(event) => setMaterialOpeningOldSheetId(event.target.value)}
                    />
                  </label>
                  <label className="management-modal-checkbox-row">
                    <input
                      aria-label="Bỏ phần tấm cũ"
                      checked={materialOpeningDiscardSheet}
                      type="checkbox"
                      onChange={(event) => setMaterialOpeningDiscardSheet(event.target.checked)}
                    />
                    Bỏ phần tấm cũ
                  </label>
                  {!materialOpeningDiscardSheet ? (
                    <>
                      <label>
                        Rộng cũ còn lại
                        <input
                          aria-label="Rộng cũ còn lại"
                          min="0.001"
                          step="0.001"
                          type="number"
                          value={materialOpeningOldSheetWidth}
                          onChange={(event) => setMaterialOpeningOldSheetWidth(event.target.value)}
                        />
                      </label>
                      <label>
                        Dài cũ còn lại
                        <input
                          aria-label="Dài tấm cũ còn lại"
                          min="0.001"
                          step="0.001"
                          type="number"
                          value={materialOpeningOldSheetLength}
                          onChange={(event) => setMaterialOpeningOldSheetLength(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                </>
              )}
              <label>
                Ghi chú
                <input
                  aria-label="Ghi chú khui"
                  value={materialOpeningNote}
                  onChange={(event) => setMaterialOpeningNote(event.target.value)}
                />
              </label>
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={closeMaterialOpening}>Bỏ qua</button>
                <button className="button button-primary" disabled={materialOpeningSaving} type="submit">Xác nhận khui</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      <StocktakeImportDialog
        open={stocktakeImportOpen}
        service={service}
        onClose={() => setStocktakeImportOpen(false)}
        onOldDataDeleted={() => void loadStocktakeList({ page: 1 })}
        onImported={() => void loadStocktakeList({ page: 1 })}
      />
      <ManagementConfirmDialog
        open={stocktakeCancelOpen && Boolean(stocktakeDetail)}
        title="Hủy phiếu kiểm kho"
        message={(
          <>
            Bạn có chắc chắn muốn hủy phiếu kiểm kho <strong>{stocktakeDetail?.code}</strong> không?
          </>
        )}
        loading={stocktakeCancelling}
        onCancel={() => setStocktakeCancelOpen(false)}
        onConfirm={() => void cancelStocktakeDetail()}
      />
    </ManagementPage>
  )
}

function StocktakeInlineDetail({
  detail,
  onCancel,
  onSaveNote,
}: {
  detail: StocktakeDetail
  onCancel: () => void
  onSaveNote: (note: string) => Promise<void>
}) {
  const [note, setNote] = useState(detail.note ?? '')
  const [saving, setSaving] = useState(false)

  async function saveNote() {
    setSaving(true)
    try {
      await onSaveNote(note)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="management-detail-panel">
      <div className="inline-detail-tabbar">
        <div aria-label={`Chi tiết phiếu kiểm kho ${detail.code}`} className="inline-detail-tabs" role="tablist">
          <button aria-selected="true" role="tab" type="button">Thông tin</button>
        </div>
      </div>
      <section aria-label={`Thông tin phiếu kiểm kho ${detail.code}`} role="tabpanel">
        <header className="management-detail-header">
          <h2>{detail.code}</h2>
          <StatusChip tone={detail.status === 'balanced' ? 'success' : 'neutral'}>{stocktakeStatusText(detail.status)}</StatusChip>
        </header>
        <dl className="management-detail-meta-grid">
          <div>
            <dt>Người tạo:</dt>
            <dd>{stocktakeCreatorText(detail)}</dd>
          </div>
          <div>
            <dt>Ngày tạo:</dt>
            <dd>{stocktakeDateTimeText(detail.created_at)}</dd>
          </div>
        </dl>

        <table aria-label={`Dòng kiểm kho ${detail.code}`} className="management-detail-table management-detail-lines-table">
            <thead>
              <tr>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>Tồn kho</th>
                <th>Thực tế</th>
                <th>SL lệch</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.product_code || ''}</strong></td>
                  <td>{stocktakeProductNameText(item.product_name, item.unit_name)}</td>
                  <td>{stocktakeQuantityText(item.system_qty)}</td>
                  <td>{stocktakeQuantityText(item.actual_qty)}</td>
                  <td>{stocktakeQuantityText(item.difference_qty)}</td>
                </tr>
              ))}
              {detail.items.length === 0 ? (
                <tr>
                  <td colSpan={5}>Chưa có dòng kiểm kho.</td>
                </tr>
              ) : null}
            </tbody>
        </table>

        <div className="management-detail-lower management-detail-lower-right">
          <ManagementDetailNoteInput
            ariaLabel="Ghi chú phiếu kiểm kho"
            placeholder="Chưa có ghi chú"
            value={note}
            onChange={setNote}
          />
          <dl className="management-detail-summary-box management-detail-summary-box-right">
            <div>
              <dt>Số lượng thực tế</dt>
              <dd>{stocktakeQuantityText(detail.total_actual_qty)}</dd>
            </div>
            <div>
              <dt>Số lượng lệch tăng</dt>
              <dd>{stocktakeQuantityText(detail.increased_qty)}</dd>
            </div>
            <div>
              <dt>Số lượng lệch giảm</dt>
              <dd>{stocktakeQuantityText(detail.decreased_qty)}</dd>
            </div>
            <div>
              <dt>Số lượng chênh lệch</dt>
              <dd>{stocktakeQuantityText(stocktakeDifferenceSummaryQty(detail))}</dd>
            </div>
          </dl>
        </div>
      </section>

      <ManagementDetailActionFooter
        leftActions={[
          { label: 'Hủy', danger: true, disabled: detail.status === 'cancelled', icon: <Trash2 aria-hidden="true" size={15} />, onClick: onCancel },
          { label: 'Sao chép', disabled: true, icon: <Copy aria-hidden="true" size={15} /> },
          { label: 'Xuất file', disabled: true, icon: <FileOutput aria-hidden="true" size={15} /> },
        ]}
        rightActions={[
          { label: saving ? 'Đang lưu' : 'Lưu', icon: <Save aria-hidden="true" size={15} />, onClick: () => void saveNote() },
          { label: 'In', disabled: true, icon: <Printer aria-hidden="true" size={15} /> },
        ]}
      />
    </div>
  )
}

function stocktakeProductNameText(productName: string, unitName: string | null) {
  return unitName ? `${productName} (${unitName})` : productName || ''
}

function stocktakeDifferenceSummaryQty(stocktake: Stocktake) {
  return stocktake.decreased_qty < 0
    ? stocktake.increased_qty + stocktake.decreased_qty
    : stocktake.increased_qty - stocktake.decreased_qty
}

function stocktakeStatusQuery(selection: Array<Stocktake['status']>) {
  return selection.length === 0 ? '__none__' : selection.join(',')
}

function stocktakeCreatorOptions(stocktakes: Stocktake[]) {
  const creators = new Map<string, string>()
  for (const stocktake of stocktakes) {
    const creator = stocktake.created_by
    if (!creator) continue
    creators.set(creator.id, creator.name)
  }
  return [...creators.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
}

function stocktakeCreatorText(stocktake: Stocktake) {
  if (stocktake.created_by?.name) return stocktake.created_by.name
  return stocktake.source_creator_name ? '' : ''
}

function stocktakeDisplayDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
