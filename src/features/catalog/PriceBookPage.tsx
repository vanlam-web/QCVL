import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDataTable,
  type ManagementDataTableColumn,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import type { CatalogService } from './catalog-service'
import type {
  PriceFormulaInput,
  PriceFormulaPreview,
  PriceFormulaPreviewItem,
  PriceFormulaPreviewPrice,
  PriceList,
  Product,
  ProductStatus,
  SellMethod,
} from './types'

interface PriceBookState {
  products: Product[]
  priceLists: PriceList[]
  page: number
  pageSize: number
  total: number
}

const priceBookPageSize = 15

const sellMethodLabels: Record<SellMethod, string> = {
  quantity: 'Số lượng',
  area_m2: 'm²',
  linear_m: 'm tới',
  sheet: 'Tấm',
  combo: 'Combo',
}

type AdjustmentMode = 'none' | 'amount' | 'percent'

export function PriceBookPage({
  service,
}: {
  service: CatalogService
  onOpenDashboard: () => void
}) {
  const [state, setState] = useState<PriceBookState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [previewingFormula, setPreviewingFormula] = useState(false)
  const [applyingFormula, setApplyingFormula] = useState(false)
  const [formulaPreview, setFormulaPreview] = useState<PriceFormulaPreview | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [search, setSearch] = useState('')
  const [lastSearch, setLastSearch] = useState('')
  const [status, setStatus] = useState<ProductStatus | 'all'>('active')
  const [lastStatus, setLastStatus] = useState<ProductStatus | 'all'>('active')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(priceBookPageSize)
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
  async function load(filters: { search?: string; status?: ProductStatus | 'all'; page?: number; page_size?: number } = {}) {
    const nextSearch = filters.search ?? lastSearch
    const nextStatus = filters.status ?? lastStatus
    const nextPage = filters.page ?? page
    const nextPageSize = filters.page_size ?? pageSize
    setError(null)
    try {
      const result = await service.listProducts({
        page: nextPage,
        page_size: nextPageSize,
        search: nextSearch || undefined,
        status: nextStatus,
      })
      setState((current) => ({
        products: result.items,
        priceLists: current?.priceLists ?? [],
        page: result.page,
        pageSize: result.page_size,
        total: result.total,
      }))
      setLastSearch(nextSearch)
      setLastStatus(nextStatus)
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
        const [result, priceListResult] = await Promise.all([
          service.listProducts({ page: 1, page_size: priceBookPageSize, status: 'active' }),
          service.listPriceLists(),
        ])
        if (!active) return
        setState({
          products: result.items,
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
  }, [service])

  async function filterProducts(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyProductSearch(search))
  }

  function applyProductSearch(nextSearch: string) {
    setPage(1)
    return load({ search: nextSearch, status, page: 1 })
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
    if (formulaPreview === null) return 'Chưa xem'

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
      {
        key: 'cost',
        header: <ManagementSortableHeader kind="text" sortKey="cost" sortState={priceBookSortState} onSort={requestPriceBookSort}>Chi phí</ManagementSortableHeader>,
        headerIsCell: true,
        cell: () => 'Chưa cấu hình',
      },
      {
        key: 'profit',
        header: <ManagementSortableHeader kind="text" sortKey="profit" sortState={priceBookSortState} onSort={requestPriceBookSort}>Lợi nhuận</ManagementSortableHeader>,
        headerIsCell: true,
        cell: () => 'Chưa cấu hình',
      },
      ...priceLists.map((priceList) => ({
        key: `price-list-${priceList.id}`,
        header: <ManagementSortableHeader kind="text" sortKey={`price-list-${priceList.id}`} sortState={priceBookSortState} onSort={requestPriceBookSort}>{priceList.name}</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product: Product) => renderPriceListCell(product, priceList),
      })),
      {
        key: 'sell-method',
        header: <ManagementSortableHeader kind="text" sortKey="sell_method" sortState={priceBookSortState} onSort={requestPriceBookSort}>Cách bán</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => sellMethodLabels[product.sell_method],
      },
      {
        key: 'status',
        header: <ManagementSortableHeader kind="text" sortKey="status" sortState={priceBookSortState} onSort={requestPriceBookSort}>Trạng thái</ManagementSortableHeader>,
        headerIsCell: true,
        cell: (product) => (product.status === 'active' ? 'Đang bán' : 'Ngưng bán'),
      },
      { key: 'actions', header: 'Thao tác', cell: () => '-' },
    ]
  }

  const totalPages = Math.max(1, Math.ceil((state?.total ?? 0) / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = lastStatus === 'active'
      ? 'Đang bán'
      : lastStatus === 'inactive'
        ? 'Trạng thái: Ngưng bán'
        : 'Trạng thái: Tất cả'
  const {
    sortedItems: sortedPriceBookProducts,
    sortState: priceBookSortState,
    requestSort: requestPriceBookSort,
  } = useManagementTableSort<Product, string>(state?.products ?? [], {
    code: { kind: 'text', value: (product) => product.code },
    name: { kind: 'text', value: (product) => product.name },
    latest_purchase_cost: { kind: 'number', value: (product) => product.latest_purchase_cost ?? 0 },
    cost: { kind: 'text', value: () => null },
    profit: { kind: 'text', value: () => null },
    ...(state?.priceLists ?? []).reduce<Record<string, { kind: 'text'; value: (product: Product) => string }>>((columns, priceList) => {
      columns[`price-list-${priceList.id}`] = { kind: 'text', value: (product) => renderPriceListCell(product, priceList) }
      return columns
    }, {}),
    sell_method: { kind: 'text', value: (product) => sellMethodLabels[product.sell_method] },
    status: { kind: 'text', value: (product) => product.status },
  })

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
        </ManagementCompactToolbar>
      }
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary}
          ariaLabel="Bộ lọc bảng giá"
          title="Bộ lọc"
          actions={
            <button className="button button-primary" form="price-book-filter-form" type="submit">Áp dụng bộ lọc</button>
          }
        >
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
                <input checked={status === 'active'} name="price-book-status" type="radio" onChange={() => setStatus('active')} />
                Đang bán
              </label>
              <label>
                <input
                  checked={status === 'inactive'}
                  name="price-book-status"
                  type="radio"
                  onChange={() => setStatus('inactive')}
                />
                Ngưng bán
              </label>
              <label>
                <input checked={status === 'all'} name="price-book-status" type="radio" onChange={() => setStatus('all')} />
                Tất cả
              </label>
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
                  Điều chỉnh {priceList.name}
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
                  Giá trị điều chỉnh {priceList.name}
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
                      <td>{price.price_list_name}</td>
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
                columns={buildPriceBookColumns(state.priceLists)}
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
    </ManagementPage>
  )
}
