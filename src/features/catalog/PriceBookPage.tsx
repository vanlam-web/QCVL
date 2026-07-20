import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import { displayPriceListName } from '../../lib/price-list-display'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDataTable,
  type ManagementDataTableColumn,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementImportButton,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { ManagementChipPicker } from '../../components/ui-shell/ManagementChipPicker'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { useChipSelection } from '../../components/ui-shell/use-chip-selection'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import type { CatalogService, ProductListSortKey } from './catalog-service'
import { ProductImportDialog } from './ProductImportDialog'
import { ProductGroupFilterPicker } from './ProductGroupFilterPicker'
import type {
  PriceFormulaInput,
  PriceFormulaPreview,
  PriceFormulaPreviewItem,
  PriceFormulaPreviewPrice,
  PriceList,
  Product,
  ProductStatusFilter,
  SellMethod,
} from './types'
import type { ProductGroup } from './types'

interface PriceBookState {
  products: Product[]
  productGroups: ProductGroup[]
  priceLists: PriceList[]
  page: number
  pageSize: number
  total: number
}

const sellMethodLabels: Record<SellMethod, string> = {
  quantity: 'Số lượng',
  area_m2: 'm²',
  linear_m: 'm tới',
  sheet: 'Tấm',
  combo: 'Combo',
}

type AdjustmentMode = 'none' | 'amount' | 'percent'
const emptyPriceLists: PriceList[] = []

function defaultPriceBookProductOrder(products: readonly Product[]) {
  return [...products].sort((left, right) => {
    const codeCompared = left.code.localeCompare(right.code, 'vi', { numeric: true, sensitivity: 'base' })
    if (codeCompared !== 0) return codeCompared
    return left.name.localeCompare(right.name, 'vi', { numeric: true, sensitivity: 'base' })
  })
}

function isPriceBookServerSortKey(key: string): key is ProductListSortKey {
  return key === 'code' || key === 'name' || key === 'latest_purchase_cost' || key === 'sell_method'
}

export function PriceBookPage({
  service,
}: {
  service: CatalogService
  onOpenDashboard: () => void
}) {
  const [state, setState] = useState<PriceBookState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [priceImportOpen, setPriceImportOpen] = useState(false)
  const [previewingFormula, setPreviewingFormula] = useState(false)
  const [applyingFormula, setApplyingFormula] = useState(false)
  const [formulaPreview, setFormulaPreview] = useState<PriceFormulaPreview | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [search, setSearch] = useState('')
  const [lastSearch, setLastSearch] = useState('')
  const [status, setStatus] = useState<ProductStatusFilter>('active')
  const [lastStatus, setLastStatus] = useState<ProductStatusFilter>('active')
  const [productGroup, setProductGroup] = useState<string[]>([])
  const [lastProductGroup, setLastProductGroup] = useState<string[]>([])
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const priceBookSortInitialRender = useRef(true)
  const [formulaForm, setFormulaForm] = useState({
    name: '',
    codeContains: '',
    nameContains: '',
    sellMethod: '',
    costMode: 'fixed' as 'fixed' | 'amount_plus_percent',
    costAmount: '',
    costPercent: '',
    profitMode: 'fixed' as 'fixed' | 'tiers',
    fixedProfit: '',
    tierOperator: '>' as '<' | '<=' | '>' | '>=' | '=',
    tierValue: '',
    tierAmount: '',
    adjustments: {} as Record<string, { mode: AdjustmentMode; value: string }>,
  })
  async function load(filters: { search?: string; status?: ProductStatusFilter; product_group_id?: string[]; page?: number; page_size?: number; sortStateValue?: ManagementSortState<string> } = {}) {
    const nextSearch = filters.search ?? lastSearch
    const nextStatus = filters.status ?? lastStatus
    const nextProductGroup = filters.product_group_id ?? lastProductGroup
    const nextSortState = filters.sortStateValue ?? priceBookSortState
    const nextPage = filters.page ?? page
    const nextPageSize = filters.page_size ?? pageSize
    setError(null)
    try {
      const result = await service.listProducts({
        page: nextPage,
        page_size: nextPageSize,
        ...(nextProductGroup.length > 0 ? { product_group_id: nextProductGroup } : {}),
        search: nextSearch || undefined,
        status: nextStatus,
        ...(nextSortState !== null && isPriceBookServerSortKey(nextSortState.key) ? { sort_key: nextSortState.key, sort_direction: nextSortState.direction } : {}),
      })
      setState((current) => ({
        products: result.items,
        productGroups: current?.productGroups ?? [],
        priceLists: current?.priceLists ?? [],
        page: result.page,
        pageSize: result.page_size,
        total: result.total,
      }))
      setLastSearch(nextSearch)
      setLastStatus(nextStatus)
      setLastProductGroup(nextProductGroup)
      setPage(result.page)
      setPageSize(result.page_size)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được bảng giá.'))
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialPriceBook() {
        setError(null)
        try {
        const [result, priceListResult, productGroupResult] = await Promise.all([
          service.listProducts({ page: 1, page_size: defaultPageSize, status: 'active' }),
          service.listPriceLists(),
          service.listProductGroups(),
        ])
        if (!active) return
        setState({
          products: result.items,
          productGroups: productGroupResult.items,
          priceLists: priceListResult.items,
          page: result.page,
          pageSize: result.page_size,
          total: result.total,
        })
        setPage(result.page)
        setPageSize(result.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được bảng giá.'))
      }
    }

    void loadInitialPriceBook()

    return () => {
      active = false
    }
  }, [defaultPageSize, service])

  async function filterProducts(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyProductSearch(search))
  }

  function applyProductSearch(nextSearch: string) {
    setPage(1)
    return load({ search: nextSearch, status, page: 1 })
  }

  function applyProductGroupFilter(nextProductGroup: string[]) {
    setProductGroup(nextProductGroup)
    setPage(1)
    return load({ product_group_id: nextProductGroup, status, page: 1 })
  }

  function changeProductSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch,
      load: applyProductSearch,
    })
  }

  async function goToPage(nextPage: number) {
    await load({ page: nextPage })
  }

  function buildFormulaInput(): PriceFormulaInput {
    const priceListAdjustments: PriceFormulaInput['price_list_adjustments'] = {}
    for (const [priceListId, adjustment] of Object.entries(formulaForm.adjustments)) {
      const value = Number(adjustment.value || 0)
      if (adjustment.mode === 'amount') priceListAdjustments[priceListId] = { type: 'amount', amount: value }
      if (adjustment.mode === 'percent') priceListAdjustments[priceListId] = { type: 'percent', percent: value }
    }

    return {
      name: formulaForm.name,
      product_filter: {
        status: 'active',
        ...(formulaForm.codeContains.trim() ? { code_contains: formulaForm.codeContains.trim() } : {}),
        ...(formulaForm.nameContains.trim() ? { name_contains: formulaForm.nameContains.trim() } : {}),
        ...(formulaForm.sellMethod ? { sell_method: formulaForm.sellMethod as SellMethod } : {}),
      },
      cost_formula:
        formulaForm.costMode === 'fixed'
          ? { type: 'fixed', amount: Number(formulaForm.costAmount || 0) }
          : {
              type: 'amount_plus_percent',
              amount: Number(formulaForm.costAmount || 0),
              percent_of_latest_purchase_cost: Number(formulaForm.costPercent || 0),
            },
      profit_formula:
        formulaForm.profitMode === 'fixed'
          ? { type: 'fixed', amount: Number(formulaForm.fixedProfit || 0) }
          : {
              type: 'tiers',
              tiers: [
                {
                  operator: formulaForm.tierOperator,
                  value: Number(formulaForm.tierValue || 0),
                  amount: Number(formulaForm.tierAmount || 0),
                },
              ],
            },
      price_list_adjustments: priceListAdjustments,
    }
  }

  async function previewFormula(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPreviewingFormula(true)
    setError(null)
    try {
      setFormulaPreview(await service.previewPriceFormula(buildFormulaInput()))
    } catch (cause) {
      setError(formatApiError(cause, 'Không xem trước được công thức.'))
    } finally {
      setPreviewingFormula(false)
    }
  }

  async function applyFormula() {
    if (formulaPreview === null) return
    setApplyingFormula(true)
    setError(null)
    try {
      await service.applyPriceFormula({
        formula: buildFormulaInput(),
        selected_items: formulaPreview.items.flatMap((item) =>
          item.computed_prices.map((price) => ({
            product_id: item.product_id,
            price_list_id: price.price_list_id,
          })),
        ),
      })
      setFormulaPreview(null)
      await load()
    } catch (cause) {
      setError(formatApiError(cause, 'Không áp dụng được công thức.'))
    } finally {
      setApplyingFormula(false)
    }
  }

  function findPreviewItem(productId: string): PriceFormulaPreviewItem | null {
    return formulaPreview?.items.find((item) => item.product_id === productId) ?? null
  }

  function findPreviewPrice(item: PriceFormulaPreviewItem | null, priceListId: string): PriceFormulaPreviewPrice | null {
    return item?.computed_prices.find((price) => price.price_list_id === priceListId) ?? null
  }

  function renderPriceListCell(product: Product, priceList: PriceList): string {
    if (formulaPreview === null) {
      const unitPrice = priceList.is_default
        ? product.default_sale_price
        : product.price_list_prices?.[priceList.id]
      return formatMoney(unitPrice ?? 0)
    }

    const previewItem = findPreviewItem(product.id)
    const previewPrice = findPreviewPrice(previewItem, priceList.id)
    if (previewPrice === null) return 'Không khớp'

    const computed = formatMoney(previewPrice.computed_unit_price)
    if (previewPrice.current_unit_price === null) return `Mới ${computed}`

    const current = formatMoney(previewPrice.current_unit_price)
    return `Hiện tại ${current} → ${computed}`
  }

  function buildPriceBookColumns(priceLists: PriceList[]): Array<ManagementDataTableColumn<Product>> {
    return [
      {
        key: 'code',
        header: <ManagementSortableHeader kind="text" sortKey="code" sortState={priceBookSortState} onSort={requestPriceBookSort}>Mã hàng</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => product.code,
      },
      {
        key: 'name',
        header: <ManagementSortableHeader kind="text" sortKey="name" sortState={priceBookSortState} onSort={requestPriceBookSort}>Tên hàng</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => product.name,
      },
      {
        key: 'latest-purchase-cost',
        header: <ManagementSortableHeader kind="number" sortKey="latest_purchase_cost" sortState={priceBookSortState} onSort={requestPriceBookSort}>Giá nhập cuối</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => formatMoney(product.latest_purchase_cost ?? 0),
      },
      ...priceLists.map((priceList) => ({
        key: `price-list-${priceList.id}`,
        header: <ManagementSortableHeader kind="text" sortKey={`price-list-${priceList.id}`} sortState={priceBookSortState} onSort={requestPriceBookSort}>{displayPriceListName(priceList)}</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product: Product) => renderPriceListCell(product, priceList),
      })),
      {
        key: 'sell-method',
        header: <ManagementSortableHeader kind="text" sortKey="sell_method" sortState={priceBookSortState} onSort={requestPriceBookSort}>Cách bán</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => sellMethodLabels[product.sell_method],
      },
    ]
  }

  const totalPages = Math.max(1, Math.ceil((state?.total ?? 0) / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const statusSummary = status === 'active'
    ? '\u0110ang b\u00e1n'
    : status === 'inactive'
      ? 'Tr\u1ea1ng th\u00e1i: Ng\u01b0ng b\u00e1n'
      : status === 'deleted'
        ? 'Tr\u1ea1ng th\u00e1i: \u0110\u00e3 xo\u00e1 KV'
        : 'Tr\u1ea1ng th\u00e1i: T\u1ea5t c\u1ea3'
  const selectedProductGroupNames = productGroup
    .map((groupId) => state?.productGroups.find((group) => group.id === groupId)?.name)
    .filter((name): name is string => Boolean(name))
  const activeFilterSummary = selectedProductGroupNames.length > 0 ? `${statusSummary} - ${selectedProductGroupNames.join(', ')}` : statusSummary
  const availablePriceLists = state?.priceLists ?? emptyPriceLists
  const priceListOptions = useMemo(() => availablePriceLists.map((priceList) => ({
    id: priceList.id,
    label: displayPriceListName(priceList),
  })), [availablePriceLists])
  const defaultPriceListIds = useMemo(() => {
    const defaultIds = availablePriceLists.filter((priceList) => priceList.is_default).map((priceList) => priceList.id)
    return defaultIds.length > 0 ? defaultIds : (availablePriceLists[0]?.id ? [availablePriceLists[0].id] : [])
  }, [availablePriceLists])
  const {
    selectedOptions: selectedPriceListOptions,
    unselectedOptions: unselectedPriceListOptions,
    addChip: addPriceListColumn,
    removeChip: removePriceListColumn,
  } = useChipSelection({
    options: priceListOptions,
    initialSelectedIds: defaultPriceListIds,
  })
  const selectedPriceLists = useMemo(() => {
    const priceListById = new Map(availablePriceLists.map((priceList) => [priceList.id, priceList]))
    return selectedPriceListOptions.flatMap((option) => {
      const priceList = priceListById.get(option.id)
      return priceList ? [priceList] : []
    })
  }, [availablePriceLists, selectedPriceListOptions])
  const {
    sortedItems: sortedPriceBookProducts,
    sortState: priceBookSortState,
    requestSort: requestPriceBookSort,
  } = useManagementTableSort<Product, string>(defaultPriceBookProductOrder(state?.products ?? []), {
    code: { kind: 'text', value: (product) => product.code },
    name: { kind: 'text', value: (product) => product.name },
    latest_purchase_cost: { kind: 'number', value: (product) => product.latest_purchase_cost ?? 0 },
    ...selectedPriceLists.reduce<Record<string, { kind: 'text'; value: (product: Product) => string }>>((columns, priceList) => {
      columns[`price-list-${priceList.id}`] = { kind: 'text', value: (product) => renderPriceListCell(product, priceList) }
      return columns
    }, {}),
    sell_method: { kind: 'text', value: (product) => sellMethodLabels[product.sell_method] },
  })
  useEffect(() => {
    if (priceBookSortInitialRender.current) {
      priceBookSortInitialRender.current = false
      return
    }
    if (priceBookSortState !== null && !isPriceBookServerSortKey(priceBookSortState.key)) return
    queueMicrotask(() => void load({ page: 1, sortStateValue: priceBookSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceBookSortState?.key, priceBookSortState?.direction])

  return (
    <ManagementPage
      title="Bảng giá"
      actions={
        <ManagementCompactToolbar ariaLabel="Tìm bảng giá" onSubmit={filterProducts}>
          <ManagementCompactSearch
            label="Tìm bảng giá"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Tìm mã, tên hàng"
            trailingAction={
              <ManagementCompactCreateAction
                ariaLabel={formulaOpen ? 'Đóng công thức bảng giá' : 'Tạo công thức cho bộ lọc này'}
                onClick={() => setFormulaOpen((current) => !current)}
              />
            }
            value={search}
            onChange={changeProductSearch}
          />
          <ManagementImportButton onClick={() => setPriceImportOpen(true)} />
        </ManagementCompactToolbar>
      }
      filter={
        <ManagementFilterSidebar activeSummary={activeFilterSummary} ariaLabel="Bộ lọc bảng giá" title="Bộ lọc">
          <button
            aria-label="Ẩn bộ lọc bảng giá"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <form id="price-book-filter-form" aria-label="Lọc bảng giá" className="management-filter-sidebar-form" onSubmit={filterProducts}>
            <ManagementFilterGroup title="Trạng thái">
              <label>
                <input
                  checked={status === 'active'}
                  name="price-book-status"
                  type="radio"
                  onChange={() => {
                    setStatus('active')
                    void load({ status: 'active', page: 1 })
                  }}
                />
                Đang bán
              </label>
              <label>
                <input
                  checked={status === 'inactive'}
                  name="price-book-status"
                  type="radio"
                  onChange={() => {
                    setStatus('inactive')
                    void load({ status: 'inactive', page: 1 })
                  }}
                />
                Ngưng bán
              </label>
              <label>
                <input
                  checked={status === 'all'}
                  name="price-book-status"
                  type="radio"
                  onChange={() => {
                    setStatus('all')
                    void load({ status: 'all', page: 1 })
                  }}
                />
                Tất cả
              </label>
              <label>
                <input
                  checked={status === 'deleted'}
                  name="price-book-status"
                  type="radio"
                  onChange={() => {
                    setStatus('deleted')
                    void load({ status: 'deleted', page: 1 })
                  }}
                />
                Đã xoá KV
              </label>
            </ManagementFilterGroup>
            <ManagementFilterGroup title={'Nh\u00f3m h\u00e0ng'}>
              <ProductGroupFilterPicker
                collapsedLabel="Tất cả nhóm hàng"
                groups={state?.productGroups ?? []}
                value={productGroup}
                onChange={(value) => void applyProductGroupFilter(value)}
              />
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Bảng giá">
              <ManagementChipPicker
                addLabel="Chọn bảng giá"
                ariaLabel="Chọn cột bảng giá"
                options={priceListOptions}
                selectedOptions={selectedPriceListOptions}
                unselectedOptions={unselectedPriceListOptions}
                onAdd={addPriceListColumn}
                onRemove={removePriceListColumn}
              />
            </ManagementFilterGroup>
          </form>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc bảng giá"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      <ManagementListSurface ariaLabel="Quản lý bảng giá">
        {error ? <p role="alert">{error}</p> : null}
        {state === null && error === null ? <p>Đang tải bảng giá...</p> : null}

        {formulaOpen ? (
          <form aria-label="Công thức bảng giá" className="catalog-formula-panel" onSubmit={previewFormula}>
            <label>
              Tên công thức
              <input
                value={formulaForm.name}
                onChange={(event) => setFormulaForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Mã hàng chứa
              <input
                value={formulaForm.codeContains}
                onChange={(event) => setFormulaForm((current) => ({ ...current, codeContains: event.target.value }))}
              />
            </label>
            <label>
              Tên hàng chứa
              <input
                value={formulaForm.nameContains}
                onChange={(event) => setFormulaForm((current) => ({ ...current, nameContains: event.target.value }))}
              />
            </label>
            <label>
              Cách bán áp dụng
              <select
                value={formulaForm.sellMethod}
                onChange={(event) => setFormulaForm((current) => ({ ...current, sellMethod: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {Object.entries(sellMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kiểu chi phí
              <select
                value={formulaForm.costMode}
                onChange={(event) =>
                  setFormulaForm((current) => ({
                    ...current,
                    costMode: event.target.value as 'fixed' | 'amount_plus_percent',
                  }))
                }
              >
                <option value="fixed">Cố định</option>
                <option value="amount_plus_percent">Cộng tiền + % giá nhập</option>
              </select>
            </label>
            <label>
              Chi phí cộng thêm
              <input
                inputMode="numeric"
                value={formulaForm.costAmount}
                onChange={(event) => setFormulaForm((current) => ({ ...current, costAmount: event.target.value }))}
              />
            </label>
            <label>
              % theo giá nhập cuối
              <input
                inputMode="decimal"
                value={formulaForm.costPercent}
                onChange={(event) => setFormulaForm((current) => ({ ...current, costPercent: event.target.value }))}
                disabled={formulaForm.costMode === 'fixed'}
              />
            </label>
            <label>
              Kiểu lợi nhuận
              <select
                value={formulaForm.profitMode}
                onChange={(event) =>
                  setFormulaForm((current) => ({ ...current, profitMode: event.target.value as 'fixed' | 'tiers' }))
                }
              >
                <option value="fixed">Cố định</option>
                <option value="tiers">Theo điều kiện giá nhập</option>
              </select>
            </label>
            {formulaForm.profitMode === 'fixed' ? (
              <label>
                Lợi nhuận cố định
                <input
                  inputMode="numeric"
                  value={formulaForm.fixedProfit}
                  onChange={(event) => setFormulaForm((current) => ({ ...current, fixedProfit: event.target.value }))}
                />
              </label>
            ) : (
              <>
                <label>
                  Điều kiện lợi nhuận
                  <select
                    value={formulaForm.tierOperator}
                    onChange={(event) =>
                      setFormulaForm((current) => ({
                        ...current,
                        tierOperator: event.target.value as '<' | '<=' | '>' | '>=' | '=',
                      }))
                    }
                  >
                    <option value=">">&gt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&lt;=</option>
                    <option value="=">=</option>
                  </select>
                </label>
                <label>
                  Mốc giá nhập
                  <input
                    inputMode="numeric"
                    value={formulaForm.tierValue}
                    onChange={(event) => setFormulaForm((current) => ({ ...current, tierValue: event.target.value }))}
                  />
                </label>
                <label>
                  Lợi nhuận tier
                  <input
                    inputMode="numeric"
                    value={formulaForm.tierAmount}
                    onChange={(event) => setFormulaForm((current) => ({ ...current, tierAmount: event.target.value }))}
                  />
                </label>
              </>
            )}
            {state?.priceLists.map((priceList) => (
              <div className="catalog-adjustment" key={priceList.id}>
                <label>
                  Điều chỉnh {displayPriceListName(priceList)}
                  <select
                    value={formulaForm.adjustments[priceList.id]?.mode ?? 'none'}
                    onChange={(event) =>
                      setFormulaForm((current) => ({
                        ...current,
                        adjustments: {
                          ...current.adjustments,
                          [priceList.id]: {
                            mode: event.target.value as AdjustmentMode,
                            value: current.adjustments[priceList.id]?.value ?? '',
                          },
                        },
                      }))
                    }
                  >
                    <option value="none">Không</option>
                    <option value="amount">Cộng/trừ tiền</option>
                    <option value="percent">Cộng/trừ %</option>
                  </select>
                </label>
                <label>
                  Giá trị điều chỉnh {displayPriceListName(priceList)}
                  <input
                    inputMode="decimal"
                    value={formulaForm.adjustments[priceList.id]?.value ?? ''}
                    onChange={(event) =>
                      setFormulaForm((current) => ({
                        ...current,
                        adjustments: {
                          ...current.adjustments,
                          [priceList.id]: {
                            mode: current.adjustments[priceList.id]?.mode ?? 'none',
                            value: event.target.value,
                          },
                        },
                      }))
                    }
                    disabled={(formulaForm.adjustments[priceList.id]?.mode ?? 'none') === 'none'}
                  />
                </label>
              </div>
            ))}
            <div className="catalog-formula-actions">
              <button className="button button-secondary" disabled={previewingFormula} type="submit">
                Xem trước
              </button>
              <button className="button button-primary" disabled={formulaPreview === null || applyingFormula} type="button" onClick={() => void applyFormula()}>
                Áp dụng công thức
              </button>
            </div>
          </form>
        ) : null}

        {formulaPreview ? (
          <section className="catalog-preview" aria-label="Xem trước công thức">
            <p>{formulaPreview.affected_count} hàng hóa khớp bộ lọc</p>
            <table>
              <thead>
                <tr>
                  <th>Mã hàng</th>
                  <th>Tên hàng</th>
                  <th>Bảng giá</th>
                  <th>Giá đề xuất</th>
                  <th>Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {formulaPreview.items.flatMap((item) =>
                  item.computed_prices.map((price) => (
                    <tr key={`${item.product_id}-${price.price_list_id}`}>
                      <td>{item.product_code}</td>
                      <td>{item.product_name}</td>
                      <td>{displayPriceListName({ name: price.price_list_name })}</td>
                      <td>{formatMoney(price.computed_unit_price)}</td>
                      <td>{price.delta === null ? 'Mới' : formatMoney(price.delta)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </section>
        ) : null}

        {state ? (
          <>
            <ManagementTableViewport>
              <ManagementDataTable
                ariaLabel="Lưới bảng giá"
                columns={buildPriceBookColumns(selectedPriceLists)}
                getRowKey={(product) => product.id}
                items={sortedPriceBookProducts}
              />
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang bảng giá"
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              entityLabel="hàng hóa"
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
      <ProductImportDialog
        open={priceImportOpen}
        service={service}
        title="Import bảng giá KiotViet"
        onClose={() => setPriceImportOpen(false)}
        onImported={() => {
          setPriceImportOpen(false)
          void load({ page: 1 })
          void service.listPriceLists().then((priceListResult) => {
            setState((current) => current ? { ...current, priceLists: priceListResult.items } : current)
          })
        }}
      />
    </ManagementPage>
  )
}
