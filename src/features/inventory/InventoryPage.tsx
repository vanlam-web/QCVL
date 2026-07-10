import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, Search } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { EmptyState, MetricCard, MetricGrid, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDateRangeInputs,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import type { InventoryProduct, InventoryProductStatus, InventoryRoll, InventoryShape, InventorySheet, StockMovement, Stocktake } from './types'
import type { InventoryService } from './inventory-service'
import {
  dateText,
  inventoryListSummary,
  numberText,
  shapeText,
  statusText,
  stocktakeDateTimeText,
  stocktakeMoneyText,
  stocktakeQuantityText,
  stocktakeStatusText,
} from './inventory-presenter'
import { StocktakeImportDialog } from './StocktakeImportDialog'
import { currentMonthRange, quickDateRange, type QuickDateRangePreset } from '../../lib/date-ranges'

const pageSizeDefault = 15
type InventoryView = 'products' | 'stocktakes' | 'objects'
type StocktakeDateFilter = QuickDateRangePreset | 'custom'
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

export function InventoryPage({ service }: { service: InventoryService }) {
  const [view] = useState<InventoryView>('stocktakes')
  const [products, setProducts] = useState<InventoryProduct[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeDefault)
  const [search, setSearch] = useState('')
  const [productSearchSuggestions, setProductSearchSuggestions] = useState<InventoryProduct[]>([])
  const [productSearchSuggestionsOpen, setProductSearchSuggestionsOpen] = useState(false)
  const [lastSearch, setLastSearch] = useState('')
  const [status, setStatus] = useState<InventoryProductStatus | 'all'>('active')
  const [shape, setShape] = useState<InventoryShape | 'all'>('all')
  const [detail, setDetail] = useState<InventoryProduct | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([])
  const [stocktakeTotal, setStocktakeTotal] = useState(0)
  const [stocktakePage, setStocktakePage] = useState(1)
  const [stocktakePageSize, setStocktakePageSize] = useState(pageSizeDefault)
  const [stocktakeSearch, setStocktakeSearch] = useState('')
  const [stocktakeLastSearch, setStocktakeLastSearch] = useState('')
  const [stocktakeDateFilter, setStocktakeDateFilter] = useState<StocktakeDateFilter>('month')
  const [stocktakeDateFrom, setStocktakeDateFrom] = useState(() => currentMonthRange().from)
  const [stocktakeDateTo, setStocktakeDateTo] = useState(() => currentMonthRange().to)
  const [stocktakeQuickTimeOpen, setStocktakeQuickTimeOpen] = useState(false)
  const [stocktakeStatusSelection, setStocktakeStatusSelection] = useState<Array<Stocktake['status']>>(defaultStocktakeStatuses)
  const [stocktakeImportOpen, setStocktakeImportOpen] = useState(false)
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
  const productSearchRequestId = useRef(0)
  const stocktakeListRequestId = useRef(0)

  const { negativeCount, totalQty } = inventoryListSummary(products)

  async function loadProducts(input: {
    search?: string
    status?: InventoryProductStatus | 'all'
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
    page?: number
    page_size?: number
  } = {}) {
    const nextSearch = input.search ?? stocktakeLastSearch
    const nextStatusSelection = input.statusSelection ?? stocktakeStatusSelection
    const nextDateFilter = input.dateFilter ?? stocktakeDateFilter
    const nextFrom = input.from ?? stocktakeDateFrom
    const nextTo = input.to ?? stocktakeDateTo
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
        page: nextPage,
        page_size: nextPageSize,
      })
      if (stocktakeListRequestId.current !== requestId) return
      setStocktakes(result.items)
      setStocktakeTotal(result.total)
      setStocktakePage(result.page)
      setStocktakePageSize(result.page_size)
      setStocktakeLastSearch(nextSearch.trim())
    } catch (cause) {
      if (stocktakeListRequestId.current !== requestId) return
      setError(formatApiError(cause, 'Không tải được phiếu kiểm kho.'))
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
          const range = currentMonthRange()
          const result = await service.listStocktakes({
            status: stocktakeStatusQuery(defaultStocktakeStatuses),
            from: range.from,
            to: range.to,
            page: 1,
            page_size: pageSizeDefault,
          })
          if (!active) return
          setStocktakes(result.items)
          setStocktakeTotal(result.total)
          setStocktakePage(result.page)
          setStocktakePageSize(result.page_size)
          return
        }
        if (view === 'objects') {
          const [rollResult, sheetResult] = await Promise.all([
            service.listInventoryRolls({ page: 1, page_size: pageSizeDefault }),
            service.listInventorySheets({ page: 1, page_size: pageSizeDefault }),
          ])
          if (!active) return
          setRolls(rollResult.items)
          setSheets(sheetResult.items)
          return
        }
        const productResult = await service.listInventoryProducts({ status: 'active', page: 1, page_size: pageSizeDefault })
        if (!active) return
        setProducts(productResult.items)
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
  }, [service, view])

  async function filterProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProductSearchSuggestionsOpen(false)
    await applyFilters()
  }

  async function filterStocktakes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStocktakePage(1)
    await loadStocktakeList({ search: stocktakeSearch, page: 1, page_size: stocktakePageSize })
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

  async function applyFilters() {
    setPage(1)
    await loadProducts({ search, status, shape, page: 1 })
  }

  async function suggestProducts(nextSearch: string) {
    setSearch(nextSearch)
    const query = nextSearch.trim()
    const requestId = productSearchRequestId.current + 1
    productSearchRequestId.current = requestId
    if (query.length === 0) {
      setProductSearchSuggestions([])
      setProductSearchSuggestionsOpen(false)
      return
    }
    try {
      const result = await service.listInventoryProducts({
        search: query,
        status,
        inventory_shape: shape === 'all' ? undefined : shape,
        page: 1,
        page_size: 8,
      })
      if (productSearchRequestId.current !== requestId) return
      setProductSearchSuggestions(result.items)
      setProductSearchSuggestionsOpen(true)
    } catch {
      if (productSearchRequestId.current !== requestId) return
      setProductSearchSuggestions([])
      setProductSearchSuggestionsOpen(false)
    }
  }

  async function selectProductSuggestion(product: InventoryProduct) {
    setSearch(product.code)
    setProductSearchSuggestionsOpen(false)
    setPage(1)
    await loadProducts({ search: product.code, status, shape, page: 1 })
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
                suggestions={
                  productSearchSuggestionsOpen
                    ? productSearchSuggestions.map((product) => ({
                        id: product.product_id,
                        primary: `${product.code} ${product.name}`,
                        secondary: shapeText(product.inventory_shape),
                        meta: `${numberText(product.available_qty)} ${product.stock_unit}`,
                        ariaLabel: `${product.code} ${product.name}`,
                      }))
                    : undefined
                }
                suggestionsLabel="Gợi ý hàng hóa"
                emptySuggestion="Không có kết quả phù hợp"
                onChange={(nextSearch) => void suggestProducts(nextSearch)}
                onSuggestionSelect={(suggestion) => {
                  const product = productSearchSuggestions.find((candidate) => candidate.product_id === suggestion.id)
                  if (product) void selectProductSuggestion(product)
                }}
              />
            </ManagementCompactToolbar>
          ) : view === 'stocktakes' ? (
            <ManagementCompactToolbar ariaLabel="Lọc phiếu kiểm kho" onSubmit={filterStocktakes}>
              <ManagementCompactSearch
                label="Tìm phiếu kiểm kho"
                placeholder="Theo mã phiếu kiểm"
                value={stocktakeSearch}
                leadingIcon={<Search aria-hidden="true" size={16} />}
                onChange={setStocktakeSearch}
              />
              <button className="button button-secondary" type="button">+ Kiểm kho</button>
              <button className="button button-secondary" type="button" onClick={() => setStocktakeImportOpen(true)}>Import KV</button>
              <button className="button button-secondary" type="button">Xuất file</button>
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
          <MetricCard label="Tồn kho" value={numberText(totalQty)} hint="Cộng các dòng đang xem" tone="neutral" />
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
                onChange={(event) => setStatus(event.target.value as InventoryProductStatus | 'all')}
              >
                <option value="active">{statusText('active')}</option>
                <option value="inactive">{statusText('inactive')}</option>
                <option value="all">{statusText('all')}</option>
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
                <div
                  aria-expanded={stocktakeQuickTimeOpen}
                  className={`management-filter-choice${stocktakeDateFilter !== 'custom' ? ' management-filter-choice-active' : ''}`}
                  onClick={() => {
                    if (stocktakeDateFilter === 'custom') applyStocktakeQuickDateFilter('month')
                    else setStocktakeQuickTimeOpen((current) => !current)
                  }}
                >
                  <input
                    aria-label={stocktakeDateFilter === 'custom' ? stocktakeDateLabels.month : stocktakeDateLabels[stocktakeDateFilter]}
                    checked={stocktakeDateFilter !== 'custom'}
                    name="stocktake-date-filter"
                    readOnly
                    type="radio"
                    onChange={() => undefined}
                  />
                  <span>{stocktakeDateFilter === 'custom' ? stocktakeDateLabels.month : stocktakeDateLabels[stocktakeDateFilter]}</span>
                  <span className="management-filter-choice-trailing">
                    <ChevronRight aria-hidden="true" size={17} />
                  </span>
                </div>
                <label className={`management-filter-choice${stocktakeDateFilter === 'custom' ? ' management-filter-choice-active' : ''}`}>
                  <input
                    aria-label="Tùy chỉnh"
                    checked={stocktakeDateFilter === 'custom'}
                    name="stocktake-date-filter"
                    type="radio"
                    onChange={() => applyStocktakeCustomDateFilter()}
                  />
                  <span>{stocktakeDateFilter === 'custom' ? `${stocktakeDisplayDate(stocktakeDateFrom)} - ${stocktakeDisplayDate(stocktakeDateTo)}` : 'Tùy chỉnh'}</span>
                  <CalendarDays aria-hidden="true" size={17} />
                </label>
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
                {stocktakeDateFilter === 'custom' ? (
                  <ManagementDateRangeInputs
                    from={stocktakeDateFrom}
                    to={stocktakeDateTo}
                    onFromChange={(value) => applyStocktakeCustomDateFilter({ from: value })}
                    onToChange={(value) => applyStocktakeCustomDateFilter({ to: value })}
                  />
                ) : null}
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
                  <th>Mã kiểm kho</th>
                  <th>Thời gian</th>
                  <th>Ngày cân bằng</th>
                  <th>SL thực tế</th>
                  <th>Tổng thực tế</th>
                  <th>Tổng chênh lệch</th>
                  <th>SL lệch tăng</th>
                  <th>SL lệch giảm</th>
                  <th>Ghi chú</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {stocktakes.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong></td>
                    <td>{stocktakeDateTimeText(item.created_at)}</td>
                    <td>{stocktakeDateTimeText(item.balanced_at)}</td>
                    <td>{stocktakeQuantityText(item.total_actual_qty)}</td>
                    <td>{stocktakeMoneyText(item.total_actual_value)}</td>
                    <td>{stocktakeMoneyText(item.total_difference_value)}</td>
                    <td>{stocktakeQuantityText(item.increased_qty)}</td>
                    <td>{stocktakeQuantityText(item.decreased_qty)}</td>
                    <td>{item.note ?? 'Chưa có'}</td>
                    <td><StatusChip tone={item.status === 'balanced' ? 'success' : 'neutral'}>{stocktakeStatusText(item.status)}</StatusChip></td>
                  </tr>
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
                    <td>{roll.note ?? 'Chưa có'}</td>
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
                    <td>{sheet.note ?? 'Chưa có'}</td>
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
                {movements.map((movement) => (
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
                {stocktakes.map((item) => (
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
    </ManagementPage>
  )
}

function stocktakeStatusQuery(selection: Array<Stocktake['status']>) {
  return selection.length === 0 ? '__none__' : selection.join(',')
}

function stocktakeDisplayDate(value: string) {
  if (!value) return '--/--/----'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
