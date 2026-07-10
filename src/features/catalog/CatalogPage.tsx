import { Fragment, useEffect, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search, Upload, X } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { currentMonthRange, quickDateRange, type QuickDateRangePreset } from '../../lib/date-ranges'
import { formatMoney } from '../../lib/number-format'
import type { InventoryRoll, InventorySheet } from '../inventory/types'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDateRangeInputs,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import type { CatalogService } from './catalog-service'
import type { Product, ProductBom, ProductGroup, ProductKind, ProductStatus, ProductStockMovement, SellMethod } from './types'
import {
  catalogDateTimeText,
  catalogInventoryShapeLabel,
  catalogQuantityText,
  catalogStockCardMoneyText,
  normalizeCatalogBomLines,
  type CatalogBomFormLine,
} from './catalog-presenter'
import { readProductFavoriteIds, writeProductFavoriteIds } from './catalog-storage'
import { ProductImportDialog } from './ProductImportDialog'

interface CatalogState {
  products: Product[]
  page: number
  pageSize: number
  total: number
  totalAll?: number
}

const productPageSize = 15
const stockMovementPageSize = 15
type ProductKindFilter = ProductKind | 'all'
type ProductGroupFilter = string | 'all'
type ProductInventoryShapeFilter = NonNullable<Product['inventory_shape']> | 'all'
type ProductCreatedDateFilter = QuickDateRangePreset | 'custom'
type ProductCreateKind = ProductKind
type BomFormLine = CatalogBomFormLine
type StockAdjustForm = { actualQty: string; reason: string }
type StocktakeNotice = { id: string; code: string }
type ProductDetailTab = 'info' | 'unit-conversion' | 'bom' | 'inventory' | 'stock-card' | 'notes'

interface StockMovementState {
  items: ProductStockMovement[]
  page: number
  pageSize: number
  total: number
  loading: boolean
  error: string | null
}

interface ProductInventoryObjectState {
  rolls: InventoryRoll[]
  sheets: InventorySheet[]
  loading: boolean
  error: string | null
}

const sellMethodLabels: Record<SellMethod, string> = {
  quantity: 'Số lượng',
  area_m2: 'm²',
  linear_m: 'm tới',
  sheet: 'Tấm',
  combo: 'Combo',
}

const productKindDefaults: Record<
  ProductCreateKind,
  { unitName: string; sellMethod: SellMethod; inventoryShape: NonNullable<Product['inventory_shape']>; trackInventory: boolean }
> = {
  goods: { unitName: '', sellMethod: 'quantity', inventoryShape: 'normal', trackInventory: true },
  service: { unitName: 'lần', sellMethod: 'quantity', inventoryShape: 'normal', trackInventory: false },
  auxiliary_material: { unitName: '', sellMethod: 'quantity', inventoryShape: 'normal', trackInventory: true },
  roll: { unitName: 'm', sellMethod: 'linear_m', inventoryShape: 'roll', trackInventory: true },
  sheet: { unitName: 'tấm', sellMethod: 'sheet', inventoryShape: 'sheet', trackInventory: true },
  combo: { unitName: 'combo', sellMethod: 'combo', inventoryShape: 'normal', trackInventory: false },
}

const productKindLabels: Record<ProductKind, string> = {
  goods: 'Hàng thường',
  service: 'Dịch vụ',
  auxiliary_material: 'Vật tư phụ',
  roll: 'Cuộn',
  sheet: 'Tấm',
  combo: 'Combo',
}

const productCreatedDateGroups: Array<{ title: string; presets: Array<Exclude<ProductCreatedDateFilter, 'custom'>> }> = [
  { title: 'Theo ngày', presets: ['today', 'yesterday'] },
  { title: 'Theo tuần', presets: ['week', 'last_week', 'last_7_days'] },
  { title: 'Theo tháng', presets: ['month', 'last_month', 'last_30_days'] },
  { title: 'Theo quý', presets: ['quarter', 'last_quarter'] },
  { title: 'Theo năm', presets: ['year', 'last_year', 'all'] },
]

const productCreatedDateLabels: Record<ProductCreatedDateFilter, string> = {
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

const movementTypeLabels: Record<string, string> = {
  sale_deduction: 'Bán hàng',
  purchase_receipt: 'Nhập hàng',
  stocktake_adjustment: 'Kiểm kho',
  manual_adjustment: 'Điều chỉnh',
  material_opening: 'Khui vật tư',
}

const detailTabs: Array<{ key: ProductDetailTab; label: string }> = [
  { key: 'info', label: 'Thông tin' },
  { key: 'unit-conversion', label: 'Đơn vị & quy đổi' },
  { key: 'bom', label: 'BOM/Vật tư cấu thành' },
  { key: 'inventory', label: 'Tồn kho' },
  { key: 'stock-card', label: 'Thẻ kho' },
  { key: 'notes', label: 'Ghi chú' },
]

function catalogProductInventoryText(product: Product) {
  if (product.kiotviet_provisional_stock) {
    return `${catalogQuantityText(product.kiotviet_provisional_stock.quantity)} ${product.kiotviet_provisional_stock.unit_name}`
  }
  return 'Chưa có'
}

function stocktakeQuantityText(value: number | null, unitName: string | null) {
  if (value === null) return 'Chưa có'
  return `${catalogQuantityText(value)}${unitName ? ` ${unitName}` : ''}`
}


export function CatalogPage({
  service,
}: {
  service: CatalogService
  onOpenDashboard: () => void
}) {
  const [state, setState] = useState<CatalogState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [productImportOpen, setProductImportOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedDetailTab, setSelectedDetailTab] = useState<ProductDetailTab>('info')
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>(readProductFavoriteIds)
  const [showFavoriteProductsOnly, setShowFavoriteProductsOnly] = useState(false)
  const [componentProducts, setComponentProducts] = useState<Product[]>([])
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [bomByProductId, setBomByProductId] = useState<Record<string, ProductBom | null>>({})
  const [bomForms, setBomForms] = useState<Record<string, BomFormLine[]>>({})
  const [stockMovementsByProductId, setStockMovementsByProductId] = useState<Record<string, StockMovementState>>({})
  const [inventoryObjectsByProductId, setInventoryObjectsByProductId] = useState<Record<string, ProductInventoryObjectState>>({})
  const [stockAdjustForms, setStockAdjustForms] = useState<Record<string, StockAdjustForm>>({})
  const [stocktakeNotices, setStocktakeNotices] = useState<Record<string, StocktakeNotice>>({})
  const [createBomLines, setCreateBomLines] = useState<BomFormLine[]>([{ component_product_id: '', quantity: '1', notes: '' }])
  const [search, setSearch] = useState('')
  const [productSearchSuggestions, setProductSearchSuggestions] = useState<Product[]>([])
  const [productSearchSuggestionsOpen, setProductSearchSuggestionsOpen] = useState(false)
  const [lastSearch, setLastSearch] = useState('')
  const [status, setStatus] = useState<ProductStatus | 'all'>('active')
  const [lastStatus, setLastStatus] = useState<ProductStatus | 'all'>('active')
  const [productKindFilter, setProductKindFilter] = useState<ProductKindFilter>('all')
  const [lastProductKindFilter, setLastProductKindFilter] = useState<ProductKindFilter>('all')
  const [productGroupFilter, setProductGroupFilter] = useState<ProductGroupFilter>('all')
  const [lastProductGroupFilter, setLastProductGroupFilter] = useState<ProductGroupFilter>('all')
  const [inventoryShapeFilter, setInventoryShapeFilter] = useState<ProductInventoryShapeFilter>('all')
  const [lastInventoryShapeFilter, setLastInventoryShapeFilter] = useState<ProductInventoryShapeFilter>('all')
  const [productCreatedDateFilter, setProductCreatedDateFilter] = useState<ProductCreatedDateFilter>('all')
  const [productCreatedDateFrom, setProductCreatedDateFrom] = useState('')
  const [productCreatedDateTo, setProductCreatedDateTo] = useState('')
  const [productCreatedQuickTimeOpen, setProductCreatedQuickTimeOpen] = useState(false)
  const [lastProductCreatedDateFrom, setLastProductCreatedDateFrom] = useState('')
  const [lastProductCreatedDateTo, setLastProductCreatedDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(productPageSize)
  const [form, setForm] = useState<{
    code: string
    name: string
    unitName: string
    sellMethod: SellMethod
    status: ProductStatus
    kind: ProductCreateKind
    latestPurchaseCost: string
    productGroupId: string
  }>({
    code: '',
    name: '',
    unitName: '',
    sellMethod: 'quantity',
    status: 'active',
    kind: 'goods',
    latestPurchaseCost: '0',
    productGroupId: '',
  })
  const productSearchRequestId = useRef(0)

  async function load(filters: {
    search?: string
    status?: ProductStatus | 'all'
    product_kind?: ProductKindFilter
    product_group_id?: ProductGroupFilter
    inventory_shape?: ProductInventoryShapeFilter
    created_from?: string
    created_to?: string
    page?: number
    page_size?: number
  } = {}) {
    const nextSearch = filters.search ?? lastSearch
    const nextStatus = filters.status ?? lastStatus
    const nextProductKind = filters.product_kind ?? lastProductKindFilter
    const nextProductGroup = filters.product_group_id ?? lastProductGroupFilter
    const nextInventoryShape = filters.inventory_shape ?? lastInventoryShapeFilter
    const nextCreatedFrom = filters.created_from ?? lastProductCreatedDateFrom
    const nextCreatedTo = filters.created_to ?? lastProductCreatedDateTo
    const nextPage = filters.page ?? page
    const nextPageSize = filters.page_size ?? pageSize
    setError(null)
    try {
      const result = await service.listProducts({
        page: nextPage,
        page_size: nextPageSize,
        search: nextSearch || undefined,
        status: nextStatus,
        ...(nextProductKind === 'all' ? {} : { product_kind: nextProductKind }),
        ...(nextProductGroup === 'all' ? {} : { product_group_id: nextProductGroup }),
        ...(nextInventoryShape === 'all' ? {} : { inventory_shape: nextInventoryShape }),
        ...(nextCreatedFrom ? { created_from: nextCreatedFrom } : {}),
        ...(nextCreatedTo ? { created_to: nextCreatedTo } : {}),
      })
      setState({ products: result.items, page: result.page, pageSize: result.page_size, total: result.total, totalAll: result.total_all })
      setLastSearch(nextSearch)
      setLastStatus(nextStatus)
      setLastProductKindFilter(nextProductKind)
      setLastProductGroupFilter(nextProductGroup)
      setLastInventoryShapeFilter(nextInventoryShape)
      setLastProductCreatedDateFrom(nextCreatedFrom)
      setLastProductCreatedDateTo(nextCreatedTo)
      setPage(result.page)
      setPageSize(result.page_size)
      setSelectedProductId(null)
      setSelectedDetailTab('info')
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được hàng hóa.'))
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialProducts() {
      setError(null)
      try {
        const [result, groupResult] = await Promise.all([
          service.listProducts({ page: 1, page_size: productPageSize, status: 'active' }),
          service.listProductGroups(),
        ])
        if (!active) return
        setState({ products: result.items, page: result.page, pageSize: result.page_size, total: result.total, totalAll: result.total_all })
        setProductGroups(groupResult.items)
        setPage(result.page)
        setPageSize(result.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được hàng hóa.'))
      }
    }

    void loadInitialProducts()

    return () => {
      active = false
    }
  }, [service])

  async function filterProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProductSearchSuggestionsOpen(false)
    setPage(1)
    await load({
      search: search.trim(),
      status,
      product_kind: productKindFilter,
      product_group_id: productGroupFilter,
      inventory_shape: inventoryShapeFilter,
      created_from: productCreatedDateFrom,
      created_to: productCreatedDateTo,
      page: 1,
    })
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
      const result = await service.listProducts({
        search: query,
        status,
        ...(productKindFilter === 'all' ? {} : { product_kind: productKindFilter }),
        ...(productGroupFilter === 'all' ? {} : { product_group_id: productGroupFilter }),
        ...(inventoryShapeFilter === 'all' ? {} : { inventory_shape: inventoryShapeFilter }),
        ...(productCreatedDateFrom ? { created_from: productCreatedDateFrom } : {}),
        ...(productCreatedDateTo ? { created_to: productCreatedDateTo } : {}),
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

  async function selectProductSuggestion(product: Product) {
    setSearch(product.code)
    setProductSearchSuggestionsOpen(false)
    setPage(1)
    await load({
      search: product.code,
      status,
      product_kind: productKindFilter,
      product_group_id: productGroupFilter,
      inventory_shape: inventoryShapeFilter,
      created_from: productCreatedDateFrom,
      created_to: productCreatedDateTo,
      page: 1,
    })
  }

  async function applySidebarFilters(nextFilters: Partial<{
    status: ProductStatus | 'all'
    product_kind: ProductKindFilter
    product_group_id: ProductGroupFilter
    inventory_shape: ProductInventoryShapeFilter
    created_from: string
    created_to: string
  }>) {
    const nextStatus = nextFilters.status ?? status
    const nextProductKind = nextFilters.product_kind ?? productKindFilter
    const nextProductGroup = nextFilters.product_group_id ?? productGroupFilter
    const nextInventoryShape = nextFilters.inventory_shape ?? inventoryShapeFilter
    const nextCreatedFrom = nextFilters.created_from ?? productCreatedDateFrom
    const nextCreatedTo = nextFilters.created_to ?? productCreatedDateTo
    setStatus(nextStatus)
    setProductKindFilter(nextProductKind)
    setProductGroupFilter(nextProductGroup)
    setInventoryShapeFilter(nextInventoryShape)
    setProductCreatedDateFrom(nextCreatedFrom)
    setProductCreatedDateTo(nextCreatedTo)
    setPage(1)
    await load({
      search: search.trim(),
      status: nextStatus,
      product_kind: nextProductKind,
      product_group_id: nextProductGroup,
      inventory_shape: nextInventoryShape,
      created_from: nextCreatedFrom,
      created_to: nextCreatedTo,
      page: 1,
    })
  }

  function productDisplayDate(value: string) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  async function applyProductQuickDateFilter(nextFilter: Exclude<ProductCreatedDateFilter, 'custom'>) {
    const range = quickDateRange(nextFilter)
    setProductCreatedDateFilter(nextFilter)
    setProductCreatedQuickTimeOpen(false)
    await applySidebarFilters({ created_from: range.from, created_to: range.to })
  }

  async function applyProductCustomDateFilter(input: Partial<{ from: string; to: string }> = {}) {
    const fallbackRange = productCreatedDateFrom || productCreatedDateTo ? { from: productCreatedDateFrom, to: productCreatedDateTo } : currentMonthRange()
    const nextFrom = input.from ?? fallbackRange.from
    const nextTo = input.to ?? fallbackRange.to
    setProductCreatedDateFilter('custom')
    setProductCreatedQuickTimeOpen(false)
    await applySidebarFilters({ created_from: nextFrom, created_to: nextTo })
  }

  async function goToPage(nextPage: number) {
    await load({ page: nextPage })
  }

  function toggleProductFavorite(product: Product) {
    const nextIds = favoriteProductIds.includes(product.id)
      ? favoriteProductIds.filter((id) => id !== product.id)
      : [...favoriteProductIds, product.id]
    setFavoriteProductIds(nextIds)
    writeProductFavoriteIds(nextIds)
  }

  function stopProductRowAction(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  async function createProduct(
    event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
    options: { keepOpen?: boolean } = {},
  ) {
    event.preventDefault()
    const kindDefaults = productKindDefaults[form.kind]
    const latestPurchaseCost = form.latestPurchaseCost.trim() === '' ? null : Number(form.latestPurchaseCost)
    if (latestPurchaseCost !== null && (!Number.isFinite(latestPurchaseCost) || latestPurchaseCost < 0)) {
      setError('Giá vốn phải lớn hơn hoặc bằng 0.')
      return
    }
    const createBomItems = form.kind === 'combo' ? normalizeCatalogBomLines(createBomLines) : []
    if (form.kind === 'combo' && createBomItems.length === 0) {
      setError('Combo cần ít nhất một vật tư cấu thành và định mức lớn hơn 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const createdProduct = await service.createProduct({
        code: form.code,
        name: form.name,
        status: form.status,
        product_kind: form.kind,
        unit_name: form.unitName,
        sell_method: form.sellMethod,
        inventory_shape: kindDefaults.inventoryShape,
        track_inventory: kindDefaults.trackInventory,
        ...(form.productGroupId ? { product_group_id: form.productGroupId } : {}),
        latest_purchase_cost: latestPurchaseCost,
      })
      if (form.kind === 'combo') {
        await service.saveProductBom(createdProduct.id, { items: createBomItems })
      }
      resetCreateForm()
      if (!options.keepOpen) setCreateOpen(false)
      await load()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được hàng hóa.'))
    } finally {
      setSaving(false)
    }
  }

  function resetCreateForm() {
    setForm({
      code: '',
      name: '',
      unitName: '',
      sellMethod: 'quantity',
      status: 'active',
      kind: 'goods',
      latestPurchaseCost: '0',
      productGroupId: '',
    })
    setCreateBomLines([{ component_product_id: '', quantity: '1', notes: '' }])
  }

  function closeCreateDialog() {
    resetCreateForm()
    setCreateOpen(false)
  }

  async function changeCreateKind(kind: ProductCreateKind) {
    const defaults = productKindDefaults[kind]
    setForm((current) => ({
      ...current,
      kind,
      unitName: defaults.unitName || current.unitName,
      sellMethod: defaults.sellMethod,
    }))
    if (kind === 'combo' && componentProducts.length === 0) {
      try {
        const components = await service.listProducts({ status: 'active', page: 1, page_size: 100 })
        setComponentProducts(components.items)
      } catch (cause) {
        setError(formatApiError(cause, 'Không tải được vật tư cấu thành.'))
      }
    }
  }

  async function toggleProductDetail(product: Product) {
    if (selectedProductId === product.id) {
      setSelectedProductId(null)
      setSelectedDetailTab('info')
      return
    }
    setSelectedProductId(product.id)
    setSelectedDetailTab('info')
    setError(null)
    await loadBomForProduct(product)
  }

  async function loadBomForProduct(product: Product) {
    try {
      const components = componentProducts.length === 0
        ? await service.listProducts({ status: 'active', page: 1, page_size: 100 })
        : { items: componentProducts, page: 1, page_size: componentProducts.length, total: componentProducts.length }
      const bom = await service.getProductBom(product.id).catch(() => null)
      const normalComponents = components.items.filter((item) => item.id !== product.id)
      setComponentProducts(normalComponents)
      setBomByProductId((current) => ({ ...current, [product.id]: bom }))
      setBomForms((current) => ({
        ...current,
        [product.id]: bom?.items.map((item) => ({
          component_product_id: item.component_product_id,
          quantity: String(item.quantity),
          notes: item.notes ?? '',
        })) ?? [{ component_product_id: '', quantity: '1', notes: '' }],
      }))
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được BOM hàng hóa.'))
    }
  }

  async function loadStockMovements(product: Product, nextPage = 1) {
    setStockMovementsByProductId((current) => ({
      ...current,
      [product.id]: {
        items: current[product.id]?.items ?? [],
        page: nextPage,
        pageSize: stockMovementPageSize,
        total: current[product.id]?.total ?? 0,
        loading: true,
        error: null,
      },
    }))
    try {
      const result = await service.listStockMovements({
        product_id: product.id,
        page: nextPage,
        page_size: stockMovementPageSize,
      })
      setStockMovementsByProductId((current) => ({
        ...current,
        [product.id]: {
          items: result.items,
          page: result.page,
          pageSize: result.page_size,
          total: result.total,
          loading: false,
          error: null,
        },
      }))
    } catch (cause) {
      setStockMovementsByProductId((current) => ({
        ...current,
        [product.id]: {
          items: current[product.id]?.items ?? [],
          page: nextPage,
          pageSize: stockMovementPageSize,
          total: current[product.id]?.total ?? 0,
          loading: false,
          error: formatApiError(cause, 'Không tải được thẻ kho.'),
        },
      }))
    }
  }

  async function loadInventoryObjects(product: Product) {
    setInventoryObjectsByProductId((current) => ({
      ...current,
      [product.id]: {
        rolls: current[product.id]?.rolls ?? [],
        sheets: current[product.id]?.sheets ?? [],
        loading: true,
        error: null,
      },
    }))
    try {
      const [rollResult, sheetResult] = await Promise.all([
        service.listInventoryRolls({ product_id: product.id, page: 1, page_size: 15 }),
        service.listInventorySheets({ product_id: product.id, page: 1, page_size: 15 }),
      ])
      setInventoryObjectsByProductId((current) => ({
        ...current,
        [product.id]: {
          rolls: rollResult.items,
          sheets: sheetResult.items,
          loading: false,
          error: null,
        },
      }))
    } catch (cause) {
      setInventoryObjectsByProductId((current) => ({
        ...current,
        [product.id]: {
          rolls: current[product.id]?.rolls ?? [],
          sheets: current[product.id]?.sheets ?? [],
          loading: false,
          error: formatApiError(cause, 'Không tải được tồn theo cuộn/tấm.'),
        },
      }))
    }
  }

  function selectProductDetailTab(product: Product, tab: ProductDetailTab) {
    setSelectedDetailTab(tab)
    if (tab === 'bom' && bomForms[product.id] === undefined) {
      void loadBomForProduct(product)
    }
    if (tab === 'stock-card' && stockMovementsByProductId[product.id] === undefined) {
      void loadStockMovements(product)
    }
    if (tab === 'inventory' && (product.inventory_shape === 'roll' || product.inventory_shape === 'sheet') && inventoryObjectsByProductId[product.id] === undefined) {
      void loadInventoryObjects(product)
    }
  }

  async function saveBom(product: Product) {
    const items = (bomForms[product.id] ?? [])
      .filter((line) => line.component_product_id !== '')
      .map((line) => ({
        component_product_id: line.component_product_id,
        quantity: Number(line.quantity),
        ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
      }))
    if (items.length === 0 || items.some((item) => item.quantity <= 0 || !Number.isFinite(item.quantity))) {
      setError('BOM cần ít nhất một vật tư và định mức lớn hơn 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const bom = await service.saveProductBom(product.id, { items })
      setBomByProductId((current) => ({ ...current, [product.id]: bom }))
      setBomForms((current) => ({
        ...current,
        [product.id]: bom.items.map((item) => ({
          component_product_id: item.component_product_id,
          quantity: String(item.quantity),
          notes: item.notes ?? '',
        })),
      }))
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được BOM hàng hóa.'))
    } finally {
      setSaving(false)
    }
  }

  async function adjustNormalProductStock(product: Product, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formState = stockAdjustForms[product.id] ?? { actualQty: '', reason: '' }
    const actualQty = Number(formState.actualQty)
    if (!Number.isFinite(actualQty) || actualQty < 0) {
      setError('Tồn thực tế phải lớn hơn hoặc bằng 0.')
      return
    }
    if (formState.reason.trim().length === 0) {
      setError('Lý do điều chỉnh tồn là bắt buộc.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const stocktake = await service.adjustNormalProductStock(product.id, {
        actual_qty: actualQty,
        reason: formState.reason.trim(),
      })
      setStocktakeNotices((current) => ({ ...current, [product.id]: { id: stocktake.id, code: stocktake.code } }))
      setStockAdjustForms((current) => ({ ...current, [product.id]: { actualQty: '', reason: '' } }))
      await loadStockMovements(product, 1)
    } catch (cause) {
      setError(formatApiError(cause, 'Không cập nhật được tồn kho.'))
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil((state?.total ?? 0) / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = lastSearch
    ? `Tìm: ${lastSearch}`
    : lastStatus === 'active' && lastProductKindFilter === 'all'
      ? 'Đang kinh doanh'
      : 'Bộ lọc hàng hóa'
  const visibleProducts = showFavoriteProductsOnly && state !== null
    ? state.products.filter((product) => favoriteProductIds.includes(product.id))
    : state?.products ?? []

  return (
    <ManagementPage
      title="Hàng hóa"
      actions={
        <ManagementCompactToolbar ariaLabel="Lọc hàng hóa" onSubmit={filterProducts}>
          <ManagementCompactSearch
            label="Tìm hàng hóa"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Theo mã, tên hàng"
            trailingAction={
              <ManagementCompactCreateAction ariaLabel="Tạo hàng hóa" onClick={() => setCreateOpen(true)} />
            }
            value={search}
            suggestions={
              productSearchSuggestionsOpen
                ? productSearchSuggestions.map((product) => ({
                    id: product.id,
                    primary: `${product.code} ${product.name}`,
                    secondary: product.product_group?.name ?? product.unit_name,
                    meta: product.unit_name,
                    ariaLabel: `${product.code} ${product.name}`,
                  }))
                : undefined
            }
            suggestionsLabel="Gợi ý hàng hóa"
            emptySuggestion="Không có kết quả phù hợp"
            onChange={(nextSearch) => void suggestProducts(nextSearch)}
            onSuggestionSelect={(suggestion) => {
              const product = productSearchSuggestions.find((candidate) => candidate.id === suggestion.id)
              if (product) void selectProductSuggestion(product)
            }}
          />
          <button className="button button-secondary" type="button" onClick={() => setProductImportOpen(true)}>
            <Upload aria-hidden="true" size={16} />
            Import
          </button>
        </ManagementCompactToolbar>
      }
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary}
          ariaLabel="Bộ lọc hàng hóa"
          popoverOpen={productCreatedQuickTimeOpen}
          title="Bộ lọc"
          onPopoverClose={() => setProductCreatedQuickTimeOpen(false)}
        >
          <button
            aria-label="Ẩn bộ lọc hàng hóa"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <ManagementFilterGroup title="Nhóm hàng">
            <label>
              <span className="sr-only">Nhóm hàng</span>
              <select
                aria-label="Nhóm hàng"
                className="management-filter-select"
                value={productGroupFilter}
                onChange={(event) => void applySidebarFilters({ product_group_id: event.target.value as ProductGroupFilter })}
              >
                <option value="all">Chọn nhóm hàng</option>
                {productGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Tồn kho">
            <label>
              <span className="sr-only">Tồn kho</span>
              <select
                aria-label="Tồn kho"
                className="management-filter-select"
                value={inventoryShapeFilter}
                onChange={(event) => void applySidebarFilters({ inventory_shape: event.target.value as ProductInventoryShapeFilter })}
              >
                <option value="all">Tất cả</option>
                <option value="normal">Hàng thường</option>
                <option value="roll">Cuộn</option>
                <option value="sheet">Tấm</option>
              </select>
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Thời gian tạo">
            <div className="management-filter-time-options">
              <div
                aria-expanded={productCreatedQuickTimeOpen}
                className={`management-filter-choice${productCreatedDateFilter !== 'custom' ? ' management-filter-choice-active' : ''}`}
                onClick={() => {
                  if (productCreatedDateFilter === 'custom') void applyProductQuickDateFilter('all')
                  else setProductCreatedQuickTimeOpen((current) => !current)
                }}
              >
                <input
                  aria-label={productCreatedDateFilter === 'custom' ? productCreatedDateLabels.all : productCreatedDateLabels[productCreatedDateFilter]}
                  checked={productCreatedDateFilter !== 'custom'}
                  name="product-created-date-filter"
                  readOnly
                  type="radio"
                  onChange={() => undefined}
                />
                <span>{productCreatedDateFilter === 'custom' ? productCreatedDateLabels.all : productCreatedDateLabels[productCreatedDateFilter]}</span>
                <span className="management-filter-choice-trailing">
                  <ChevronRight aria-hidden="true" size={17} />
                </span>
              </div>
              <label className={`management-filter-choice${productCreatedDateFilter === 'custom' ? ' management-filter-choice-active' : ''}`}>
                <input
                  aria-label="Tùy chỉnh"
                  checked={productCreatedDateFilter === 'custom'}
                  name="product-created-date-filter"
                  type="radio"
                  onChange={() => void applyProductCustomDateFilter()}
                />
                <span>{productCreatedDateFilter === 'custom' ? `${productDisplayDate(productCreatedDateFrom)} - ${productDisplayDate(productCreatedDateTo)}` : 'Tùy chỉnh'}</span>
                <CalendarDays aria-hidden="true" size={17} />
              </label>
            </div>
            {productCreatedQuickTimeOpen ? (
              <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                {productCreatedDateGroups.map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    <div>
                      {group.presets.map((preset) => (
                        <button
                          className={productCreatedDateFilter === preset ? 'management-filter-quick-time-active' : undefined}
                          key={preset}
                          type="button"
                          onClick={() => void applyProductQuickDateFilter(preset)}
                        >
                          {productCreatedDateLabels[preset]}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
            {productCreatedDateFilter === 'custom' ? (
              <ManagementDateRangeInputs
                from={productCreatedDateFrom}
                to={productCreatedDateTo}
                onFromChange={(value) => void applyProductCustomDateFilter({ from: value })}
                onToChange={(value) => void applyProductCustomDateFilter({ to: value })}
              />
            ) : null}
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Loại hàng">
            <label>
              <span className="sr-only">Loại hàng</span>
              <select
                aria-label="Loại hàng"
                className="management-filter-select"
                value={productKindFilter}
                onChange={(event) => void applySidebarFilters({ product_kind: event.target.value as ProductKindFilter })}
              >
                <option value="all">Tất cả</option>
                {Object.entries(productKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Trạng thái hàng hóa">
            <label>
              <span className="sr-only">Trạng thái hàng hóa</span>
              <select
                aria-label="Trạng thái hàng hóa"
                className="management-filter-select"
                value={status}
                onChange={(event) => void applySidebarFilters({ status: event.target.value as ProductStatus | 'all' })}
              >
                <option value="active">Hàng đang kinh doanh</option>
                <option value="inactive">Hàng ngừng kinh doanh</option>
                <option value="all">Tất cả</option>
              </select>
            </label>
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc hàng hóa"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      <ManagementListSurface ariaLabel="Danh sách hàng hóa">
        {error ? <p role="alert">{error}</p> : null}
        {state === null && error === null ? <p>Đang tải hàng hóa...</p> : null}

        {state ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Danh sách hàng hóa">
                <thead>
                  <tr>
                    <th className="finance-cashbook-select-column">
                      <span className="finance-cashbook-checkbox-control">
                        <input aria-label="Chọn tất cả dòng hàng hóa" type="checkbox" />
                      </span>
                    </th>
                    <th aria-label="Đánh dấu" className="finance-cashbook-star-column">
                      <button
                        aria-label={showFavoriteProductsOnly ? 'Hiện tất cả hàng hóa' : 'Chỉ hiện hàng ưu tiên'}
                        aria-pressed={showFavoriteProductsOnly}
                        className={`finance-cashbook-star-button${showFavoriteProductsOnly ? ' finance-cashbook-star-button-active' : ''}`}
                        type="button"
                        onClick={() => setShowFavoriteProductsOnly(!showFavoriteProductsOnly)}
                      >
                        ☆
                      </button>
                    </th>
                    <th>Mã hàng</th>
                    <th>Tên hàng</th>
                    <th>Giá vốn</th>
                    <th>Giá bán</th>
                    <th>Tồn kho</th>
                    <th>Đơn vị</th>
                    <th>Dự kiến hết hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <Fragment key={product.id}>
                      <tr
                        aria-expanded={selectedProductId === product.id}
                        className={`management-data-row${selectedProductId === product.id ? ' management-data-row-selected' : ''}`}
                        tabIndex={0}
                        onClick={() => void toggleProductDetail(product)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void toggleProductDetail(product)
                          }
                        }}
                      >
                        <td className="finance-cashbook-select-column">
                          <span className="finance-cashbook-checkbox-control">
                            <input aria-label={`Chọn dòng ${product.code}`} type="checkbox" onClick={stopProductRowAction} />
                          </span>
                        </td>
                        <td className="finance-cashbook-star-column">
                          <button
                            aria-label={favoriteProductIds.includes(product.id) ? `Bỏ ưu tiên ${product.code}` : `Đánh dấu ưu tiên ${product.code}`}
                            aria-pressed={favoriteProductIds.includes(product.id)}
                            className={`finance-cashbook-star-button${favoriteProductIds.includes(product.id) ? ' finance-cashbook-star-button-active' : ''}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleProductFavorite(product)
                            }}
                          >
                            ☆
                          </button>
                        </td>
                        <td>
                          <button
                            className="management-link-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void toggleProductDetail(product)
                            }}
                          >
                            <strong>{product.code}</strong>
                          </button>
                        </td>
                        <td>{product.name}</td>
                        <td>{formatMoney(product.latest_purchase_cost ?? 0)}</td>
                        <td>{product.default_sale_price === null || product.default_sale_price === undefined ? 'Chưa có' : formatMoney(product.default_sale_price)}</td>
                        <td>{catalogProductInventoryText(product)}</td>
                        <td>{product.unit_name}</td>
                        <td>Chưa có</td>
                      </tr>
                      {selectedProductId === product.id ? (
                        <ManagementDetailRow colSpan={9} label={`Chi tiết hàng hóa ${product.code}`}>
                          <div className="management-detail-panel">
                            <div className="inline-detail-tabbar">
                              <div aria-label={`Chi tiết hàng hóa ${product.code}`} className="inline-detail-tabs" role="tablist">
                                {detailTabs.map((tab) => (
                                  <button
                                    key={tab.key}
                                    aria-selected={selectedDetailTab === tab.key}
                                    role="tab"
                                    type="button"
                                    onClick={() => selectProductDetailTab(product, tab.key)}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {selectedDetailTab === 'info' ? (
                              <>
                                <header className="management-detail-header">
                                  <div className="management-detail-heading">
                                    <div className="management-detail-title-line">
                                      <h3>{product.name}</h3>
                                      <span className="status-chip">{product.status === 'active' ? 'Đang bán' : 'Ngưng bán'}</span>
                                    </div>
                                    <span>{catalogInventoryShapeLabel(product.inventory_shape ?? 'normal')} · {sellMethodLabels[product.sell_method]}</span>
                                  </div>
                                </header>
                                <dl className="management-detail-meta-grid management-detail-meta-grid-four">
                                  <div>
                                    <dt>Mã hàng</dt>
                                    <dd>{product.code}</dd>
                                  </div>
                                  <div>
                                    <dt>Đơn vị</dt>
                                    <dd>{product.unit_name}</dd>
                                  </div>
                                  <div>
                                    <dt>Cách tính bán</dt>
                                    <dd>{sellMethodLabels[product.sell_method]}</dd>
                                  </div>
                                  <div>
                                    <dt>Giá vốn</dt>
                                    <dd>{formatMoney(product.latest_purchase_cost ?? 0)}</dd>
                                  </div>
                                  <div>
                                    <dt>Giá bán</dt>
                                    <dd>{product.default_sale_price === null || product.default_sale_price === undefined ? 'Chưa có' : formatMoney(product.default_sale_price)}</dd>
                                  </div>
                                  <div>
                                    <dt>Loại tồn</dt>
                                    <dd>{catalogInventoryShapeLabel(product.inventory_shape ?? 'normal')}</dd>
                                  </div>
                                  <div>
                                    <dt>Tồn kho</dt>
                                    <dd>{catalogProductInventoryText(product)}</dd>
                                  </div>
                                  <div>
                                    <dt>Trạng thái</dt>
                                    <dd>{product.status === 'active' ? 'Đang bán' : 'Ngưng bán'}</dd>
                                  </div>
                                </dl>
                                {(bomByProductId[product.id]?.items.length ?? 0) > 0 ? (
                                  <section aria-label={`Tóm tắt vật tư cấu thành ${product.code}`} className="catalog-bom-panel">
                                    <header>
                                      <h3>Vật tư cấu thành</h3>
                                      <span>{bomByProductId[product.id]?.items.length ?? 0} vật tư</span>
                                    </header>
                                    <ManagementTableViewport>
                                      <table className="management-data-table">
                                        <thead>
                                          <tr>
                                            <th>Mã vật tư</th>
                                            <th>Tên vật tư</th>
                                            <th>Định mức</th>
                                            <th>Đơn vị</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(bomByProductId[product.id]?.items ?? []).map((item) => (
                                            <tr key={item.id}>
                                              <td>{item.component_product.code}</td>
                                              <td>{item.component_product.name}</td>
                                              <td>{catalogQuantityText(item.quantity)}</td>
                                              <td>{item.component_product.unit_name}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </ManagementTableViewport>
                                  </section>
                                ) : null}
                              </>
                            ) : null}
                            {selectedDetailTab === 'bom' ? (
                              <section aria-label={`BOM ${product.code}`} className="catalog-bom-panel">
                                <header>
                                  <h3>BOM/Vật tư cấu thành</h3>
                                  {bomByProductId[product.id] ? <span>Version {bomByProductId[product.id]?.version}</span> : <span>Chưa có BOM</span>}
                                </header>
                                {product.draft_bom ? (
                                  <dl className="management-detail-meta-grid management-detail-meta-grid-four">
                                    <div>
                                      <dt>BOM nháp KiotViet</dt>
                                      <dd>{product.draft_bom.item_count} vật tư</dd>
                                    </div>
                                    <div>
                                      <dt>Trạng thái</dt>
                                      <dd>Cần rà soát trước khi kích hoạt</dd>
                                    </div>
                                  </dl>
                                ) : null}
                                <table aria-label={`Vật tư cấu thành ${product.code}`} className="catalog-bom-table">
                                  <thead>
                                    <tr>
                                      <th>Mã vật tư</th>
                                      <th>Tên vật tư</th>
                                      <th>Định mức</th>
                                      <th>Đơn vị</th>
                                      <th>Giá vốn tạm</th>
                                      <th>Trạng thái dòng</th>
                                      <th>Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(bomForms[product.id] ?? [{ component_product_id: '', quantity: '1', notes: '' }]).map((line, index) => {
                                      const savedLine = bomByProductId[product.id]?.items.find((item) => item.component_product_id === line.component_product_id)
                                      const component = savedLine?.component_product ?? componentProducts.find((item) => item.id === line.component_product_id)
                                      return (
                                        <tr key={`${product.id}-${index}`}>
                                          <td>
                                            <label>
                                              <span className="sr-only">Vật tư</span>
                                              <select
                                                aria-label="Vật tư"
                                                value={line.component_product_id}
                                                onChange={(event) => {
                                                  const next = [...(bomForms[product.id] ?? [])]
                                                  next[index] = { ...line, component_product_id: event.target.value }
                                                  setBomForms((current) => ({ ...current, [product.id]: next }))
                                                }}
                                              >
                                                <option value="">Chọn vật tư</option>
                                                {componentProducts.map((componentOption) => (
                                                  <option key={componentOption.id} value={componentOption.id}>
                                                    {componentOption.code} · {componentOption.name}
                                                  </option>
                                                ))}
                                              </select>
                                            </label>
                                          </td>
                                          <td>{component?.name ?? 'Chưa có'}</td>
                                          <td>
                                            <label>
                                              <span className="sr-only">Định mức</span>
                                              <input
                                                aria-label="Định mức"
                                                min="0.001"
                                                step="0.001"
                                                type="number"
                                                value={line.quantity}
                                                onChange={(event) => {
                                                  const next = [...(bomForms[product.id] ?? [])]
                                                  next[index] = { ...line, quantity: event.target.value }
                                                  setBomForms((current) => ({ ...current, [product.id]: next }))
                                                }}
                                              />
                                            </label>
                                          </td>
                                          <td>{component?.unit_name ?? 'Chưa có'}</td>
                                          <td>{formatMoney(component?.latest_purchase_cost ?? 0)}</td>
                                          <td>{component?.product_kind !== undefined ? productKindLabels[component.product_kind] : 'Chưa chọn'}</td>
                                          <td>
                                            <label>
                                              <span className="sr-only">Ghi chú</span>
                                              <input
                                                aria-label="Ghi chú"
                                                value={line.notes}
                                                onChange={(event) => {
                                                  const next = [...(bomForms[product.id] ?? [])]
                                                  next[index] = { ...line, notes: event.target.value }
                                                  setBomForms((current) => ({ ...current, [product.id]: next }))
                                                }}
                                              />
                                            </label>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                                <div className="catalog-bom-actions">
                                  <button
                                    className="button button-secondary"
                                    type="button"
                                    onClick={() => {
                                      setBomForms((current) => ({
                                        ...current,
                                        [product.id]: [
                                          ...(current[product.id] ?? []),
                                          { component_product_id: '', quantity: '1', notes: '' },
                                        ],
                                      }))
                                    }}
                                  >
                                    Thêm vật tư
                                  </button>
                                  <button className="button button-primary" disabled={saving} type="button" onClick={() => void saveBom(product)}>
                                    Lưu BOM
                                  </button>
                                </div>
                              </section>
                            ) : null}
                            {selectedDetailTab === 'unit-conversion' ? (
                              <section aria-label={`Đơn vị và quy đổi ${product.code}`} className="catalog-bom-panel">
                                <header>
                                  <h3>Đơn vị & quy đổi</h3>
                                  <span>{(product.unit_conversions ?? []).length > 0 ? `${product.unit_conversions?.length ?? 0} quy đổi` : 'Chưa có'}</span>
                                </header>
                                <dl className="management-detail-meta-grid management-detail-meta-grid-four">
                                  <div>
                                    <dt>Đơn vị hiện tại</dt>
                                    <dd>{product.unit_name}</dd>
                                  </div>
                                  <div>
                                    <dt>Cách tính bán</dt>
                                    <dd>{sellMethodLabels[product.sell_method]}</dd>
                                  </div>
                                  <div>
                                    <dt>Loại tồn</dt>
                                    <dd>{catalogInventoryShapeLabel(product.inventory_shape ?? 'normal')}</dd>
                                  </div>
                                  <div>
                                    <dt>Quy đổi</dt>
                                    <dd>{(product.unit_conversions ?? []).length > 0 ? `${product.unit_conversions?.length ?? 0} đơn vị` : 'Chưa có'}</dd>
                                  </div>
                                </dl>
                                {(product.unit_conversions ?? []).length > 0 ? (
                                  <ManagementTableViewport>
                                    <table className="management-data-table">
                                      <thead>
                                        <tr>
                                          <th>Đơn vị</th>
                                          <th>Quy đổi tồn</th>
                                          <th>Mặc định mua</th>
                                          <th>Mặc định bán</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(product.unit_conversions ?? []).map((conversion) => (
                                          <tr key={conversion.unit_id}>
                                            <td>{conversion.unit_name}</td>
                                            <td>{`1 ${conversion.unit_name} = ${catalogQuantityText(conversion.stock_qty_per_unit)} ${product.unit_name}`}</td>
                                            <td>{conversion.is_default_purchase_unit ? 'Có' : 'Không'}</td>
                                            <td>{conversion.is_default_sale_unit ? 'Có' : 'Không'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </ManagementTableViewport>
                                ) : null}
                              </section>
                            ) : null}
                            {selectedDetailTab === 'inventory' ? (
                              <section aria-label={`Tồn kho ${product.code}`} className="catalog-bom-panel">
                                <header>
                                  <h3>Tồn kho</h3>
                                  <span>{catalogInventoryShapeLabel(product.inventory_shape ?? 'normal')}</span>
                                </header>
                                {product.kiotviet_provisional_stock ? (
                                  <dl className="management-detail-meta-grid management-detail-meta-grid-four">
                                    <div>
                                      <dt>Tồn tạm KiotViet</dt>
                                      <dd>{catalogQuantityText(product.kiotviet_provisional_stock.quantity)} {product.kiotviet_provisional_stock.unit_name}</dd>
                                    </div>
                                    <div>
                                      <dt>Trạng thái</dt>
                                      <dd>Chưa phải tồn kho vận hành</dd>
                                    </div>
                                  </dl>
                                ) : null}
                                {product.latest_kiotviet_stocktake ? (
                                  <dl className="management-detail-meta-grid management-detail-meta-grid-four">
                                    <div>
                                      <dt>Kiểm kho KiotViet gần nhất</dt>
                                      <dd>{product.latest_kiotviet_stocktake.code}</dd>
                                    </div>
                                    <div>
                                      <dt>Kiểm thực tế</dt>
                                      <dd>{stocktakeQuantityText(product.latest_kiotviet_stocktake.actual_qty, product.latest_kiotviet_stocktake.unit_name)}</dd>
                                    </div>
                                    <div>
                                      <dt>SL lệch</dt>
                                      <dd>{stocktakeQuantityText(product.latest_kiotviet_stocktake.difference_qty, product.latest_kiotviet_stocktake.unit_name)}</dd>
                                    </div>
                                    <div>
                                      <dt>Ghi chú</dt>
                                      <dd>Chỉ là lịch sử đối soát, không thay tồn tạm hiện tại</dd>
                                    </div>
                                  </dl>
                                ) : null}
                                {stocktakeNotices[product.id] ? (
                                  <p role="status">
                                    Đã tạo phiếu kiểm kho {stocktakeNotices[product.id].code}.{' '}
                                    <a href={`/inventory?stocktake_id=${encodeURIComponent(stocktakeNotices[product.id].id)}`}>
                                      Xem phiếu {stocktakeNotices[product.id].code}
                                    </a>
                                  </p>
                                ) : null}
                                {(product.inventory_shape ?? 'normal') === 'normal' && product.product_kind !== 'service' && product.product_kind !== 'combo' ? (
                                  <form
                                    aria-label={`Cập nhật tồn ${product.code}`}
                                    className="management-detail-form"
                                    onSubmit={(event) => void adjustNormalProductStock(product, event)}
                                  >
                                    <label>
                                      Tồn thực tế
                                      <input
                                        aria-label="Tồn thực tế"
                                        min="0"
                                        step="0.001"
                                        type="number"
                                        value={stockAdjustForms[product.id]?.actualQty ?? ''}
                                        onChange={(event) => {
                                          const nextValue = event.target.value
                                          setStockAdjustForms((current) => ({
                                            ...current,
                                            [product.id]: { actualQty: nextValue, reason: current[product.id]?.reason ?? '' },
                                          }))
                                        }}
                                      />
                                    </label>
                                    <label>
                                      Lý do điều chỉnh
                                      <input
                                        aria-label="Lý do điều chỉnh"
                                        value={stockAdjustForms[product.id]?.reason ?? ''}
                                        onChange={(event) => {
                                          const nextValue = event.target.value
                                          setStockAdjustForms((current) => ({
                                            ...current,
                                            [product.id]: { actualQty: current[product.id]?.actualQty ?? '', reason: nextValue },
                                          }))
                                        }}
                                      />
                                    </label>
                                    <button className="button button-primary" disabled={saving} type="submit">
                                      Cập nhật tồn
                                    </button>
                                  </form>
                                ) : product.inventory_shape === 'roll' || product.inventory_shape === 'sheet' ? (() => {
                                  const objectState = inventoryObjectsByProductId[product.id]
                                  return (
                                    <>
                                      <p>Sửa tồn tổng không áp dụng cho loại hàng này.</p>
                                      {objectState?.loading ? <p>Đang tải tồn theo cuộn/tấm...</p> : null}
                                      {objectState?.error ? <p role="alert">{objectState.error}</p> : null}
                                      {!objectState?.loading && !objectState?.error ? (
                                        <ManagementTableViewport>
                                          <table aria-label={`Tồn theo cuộn tấm ${product.code}`} className="management-data-table">
                                            <thead>
                                              <tr>
                                                <th>Loại</th>
                                                <th>Mã đối tượng</th>
                                                <th>Khổ rộng</th>
                                                <th>Chiều dài</th>
                                                <th>Diện tích</th>
                                                <th>Trạng thái</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(objectState?.rolls ?? []).map((roll) => (
                                                <tr key={`roll-${roll.id}`}>
                                                  <td>Cuộn</td>
                                                  <td>{roll.code}</td>
                                                  <td>{catalogQuantityText(roll.width_m)} m</td>
                                                  <td>{catalogQuantityText(roll.remaining_length_m)} m</td>
                                                  <td>{catalogQuantityText(roll.remaining_area_m2)} m²</td>
                                                  <td>{roll.status}</td>
                                                </tr>
                                              ))}
                                              {(objectState?.sheets ?? []).map((sheet) => (
                                                <tr key={`sheet-${sheet.id}`}>
                                                  <td>Tấm</td>
                                                  <td>{sheet.code}</td>
                                                  <td>{catalogQuantityText(sheet.width_m)} m</td>
                                                  <td>{catalogQuantityText(sheet.length_m)} m</td>
                                                  <td>{catalogQuantityText(sheet.area_m2)} m²</td>
                                                  <td>{sheet.status}</td>
                                                </tr>
                                              ))}
                                              {(objectState?.rolls.length ?? 0) === 0 && (objectState?.sheets.length ?? 0) === 0 ? (
                                                <tr>
                                                  <td colSpan={6}>Chưa có</td>
                                                </tr>
                                              ) : null}
                                            </tbody>
                                          </table>
                                        </ManagementTableViewport>
                                      ) : null}
                                    </>
                                  )
                                })() : (
                                  <p>Sửa tồn tổng không áp dụng cho loại hàng này.</p>
                                )}
                              </section>
                            ) : null}
                            {selectedDetailTab === 'stock-card' ? (() => {
                              const movementState = stockMovementsByProductId[product.id]
                              const movementPage = movementState?.page ?? 1
                              const movementPageSize = movementState?.pageSize ?? stockMovementPageSize
                              const movementTotal = movementState?.total ?? 0
                              const movementTotalPages = Math.max(1, Math.ceil(movementTotal / movementPageSize))
                              return (
                                <section aria-label={`Thẻ kho ${product.code}`} className="catalog-bom-panel">
                                  <ManagementTableViewport>
                                    <table aria-label={`Thẻ kho ${product.code}`}>
                                      <thead>
                                        <tr>
                                          <th>Chứng từ</th>
                                          <th>Thời gian</th>
                                          <th>Loại giao dịch</th>
                                          <th>Giá GD</th>
                                          <th>Giá vốn</th>
                                          <th>Số lượng</th>
                                          <th>Tồn cuối</th>
                                          <th>Đối tác</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {movementState?.loading ? (
                                          <tr>
                                            <td colSpan={8}>Đang tải thẻ kho...</td>
                                          </tr>
                                        ) : null}
                                        {movementState?.error ? (
                                          <tr>
                                            <td colSpan={8} role="alert">{movementState.error}</td>
                                          </tr>
                                        ) : null}
                                        {!movementState?.loading && !movementState?.error && (movementState?.items.length ?? 0) === 0 ? (
                                          <tr>
                                            <td colSpan={8}>Chưa có</td>
                                          </tr>
                                        ) : null}
                                        {movementState?.items.map((movement) => (
                                          <tr key={movement.id}>
                                            <td>
                                              {movement.document_code ? (
                                                <button className="management-link-button" type="button">
                                                  {movement.document_code}
                                                </button>
                                              ) : 'Chưa có'}
                                            </td>
                                            <td>{catalogDateTimeText(movement.created_at)}</td>
                                            <td>{movementTypeLabels[movement.movement_type] ?? movement.movement_type}</td>
                                            <td>{movement.transaction_price === null || movement.transaction_price === undefined ? 'Chưa có' : catalogStockCardMoneyText(movement.transaction_price)}</td>
                                            <td>{movement.cost_price === null || movement.cost_price === undefined ? 'Chưa có' : catalogStockCardMoneyText(movement.cost_price)}</td>
                                            <td>{catalogQuantityText(movement.quantity_delta)}</td>
                                            <td>{movement.ending_qty === null || movement.ending_qty === undefined ? 'Chưa có' : catalogQuantityText(movement.ending_qty)}</td>
                                            <td>{movement.partner_name || 'Chưa có'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </ManagementTableViewport>
                                  <ManagementTableFooter
                                    ariaLabel={`Phân trang thẻ kho ${product.code}`}
                                    canGoNext={movementPage < movementTotalPages}
                                    canGoPrevious={movementPage > 1}
                                    entityLabel="dòng"
                                    page={movementPage}
                                    pageSize={movementPageSize}
                                    pageSizeOptions={[15]}
                                    total={movementTotal}
                                    onFirst={() => void loadStockMovements(product, 1)}
                                    onLast={() => void loadStockMovements(product, movementTotalPages)}
                                    onNext={() => void loadStockMovements(product, movementPage + 1)}
                                    onPrevious={() => void loadStockMovements(product, movementPage - 1)}
                                  />
                                </section>
                              )
                            })() : null}
                            {selectedDetailTab === 'notes' ? (
                              <section aria-label={`Ghi chú ${product.code}`} className="catalog-bom-panel">
                                <header>
                                  <h3>Ghi chú</h3>
                                  <span>Chưa có</span>
                                </header>
                              </section>
                            ) : null}
                            <footer className="management-detail-footer-actions">
                              <div className="management-detail-footer-actions-left" />
                              <div className="management-detail-footer-actions-right">
                                <button className="button button-secondary" type="button">Sửa</button>
                              </div>
                            </footer>
                          </div>
                        </ManagementDetailRow>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang hàng hóa"
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              entityLabel="hàng hóa"
              page={page}
              pageSize={pageSize}
              total={state.total}
              totalDetail={state.totalAll !== undefined && state.totalAll !== state.total ? `${state.totalAll} mã hàng` : undefined}
              onFirst={() => void goToPage(1)}
              onLast={() => void goToPage(totalPages)}
              onNext={() => void goToPage(page + 1)}
              onPageSizeChange={(nextPageSize) => void load({ page: 1, page_size: nextPageSize })}
              onPrevious={() => void goToPage(page - 1)}
            />
          </>
        ) : null}
      </ManagementListSurface>

      {createOpen ? (
        <div className="management-modal-backdrop">
          <section aria-label="Tạo hàng hóa" aria-modal="true" className="management-modal-dialog catalog-create-dialog" role="dialog">
            <header className="management-modal-header">
              <h2>Tạo hàng hóa</h2>
              <button aria-label="Đóng" className="management-icon-button" type="button" onClick={closeCreateDialog}>
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <form aria-label="Tạo hàng hóa" className="catalog-create-form" onSubmit={createProduct}>
              <section aria-label="Thông tin cơ bản" className="catalog-create-section">
                <div className="catalog-create-grid">
                  <label>
                    Loại hàng
                    <select value={form.kind} onChange={(event) => void changeCreateKind(event.target.value as ProductCreateKind)}>
                      <option value="goods">Hàng thường</option>
                      <option value="service">Dịch vụ</option>
                      <option value="auxiliary_material">Vật tư phụ</option>
                      <option value="roll">Hàng cuộn</option>
                      <option value="sheet">Hàng tấm</option>
                      <option value="combo">Combo - đóng gói</option>
                    </select>
                  </label>
                  <label>
                    Mã hàng
                    <input placeholder="Tự động" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
                  </label>
                  <label>
                    Tên hàng
                    <input placeholder="Bắt buộc *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    Nhóm hàng
                    <select
                      value={form.productGroupId}
                      onChange={(event) => setForm((current) => ({ ...current, productGroupId: event.target.value }))}
                    >
                      <option value="">Giá chung</option>
                      {productGroups.filter((group) => !group.is_default).map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Đơn vị
                    <input
                      value={form.unitName}
                      onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))}
                    />
                  </label>
                  <label>
                    Cách tính bán
                    <select
                      value={form.sellMethod}
                      onChange={(event) => setForm((current) => ({ ...current, sellMethod: event.target.value as SellMethod }))}
                    >
                      {Object.entries(sellMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Trạng thái
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProductStatus }))}
                    >
                      <option value="active">Đang bán</option>
                      <option value="inactive">Ngưng bán</option>
                    </select>
                  </label>
                </div>
              </section>

              <section aria-label="Giá vốn, giá bán" className="catalog-create-section">
                <div className="catalog-create-grid catalog-create-grid-compact">
                  <label>
                    Giá vốn
                    <input
                      min="0"
                      step="1000"
                      type="number"
                      value={form.latestPurchaseCost}
                      onChange={(event) => setForm((current) => ({ ...current, latestPurchaseCost: event.target.value }))}
                    />
                  </label>
                  <label>
                    Giá bán
                    <input disabled placeholder="Thiết lập ở Bảng giá" />
                  </label>
                </div>
              </section>

              {productKindDefaults[form.kind].trackInventory ? (
                <section aria-label="Tồn kho" className="catalog-create-section">
                  <span className="catalog-create-shape-badge">{catalogInventoryShapeLabel(productKindDefaults[form.kind].inventoryShape)}</span>
                  <div className="catalog-create-grid catalog-create-grid-compact">
                    <label>
                      Loại tồn
                      <input readOnly value={catalogInventoryShapeLabel(productKindDefaults[form.kind].inventoryShape)} />
                    </label>
                    <label>
                      Tồn kho hiện tại
                      <input disabled placeholder={form.kind === 'roll' ? 'Cuộn' : form.kind === 'sheet' ? 'Tấm' : 'Nhập sau ở Kho'} />
                    </label>
                  </div>
                </section>
              ) : null}

              {form.kind === 'combo' ? (
                <section aria-label="Vật tư cấu thành" className="catalog-create-section">
                  {createBomLines.map((line, index) => (
                    <div className="catalog-bom-line" key={`create-combo-${index}`}>
                      <label>
                        Vật tư
                        <select
                          value={line.component_product_id}
                          onChange={(event) => {
                            const next = [...createBomLines]
                            next[index] = { ...line, component_product_id: event.target.value }
                            setCreateBomLines(next)
                          }}
                        >
                          <option value="">Chọn vật tư</option>
                          {(componentProducts.length > 0 ? componentProducts : state?.products ?? []).map((component) => (
                            <option key={component.id} value={component.id}>
                              {component.code} · {component.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Định mức
                        <input
                          min="0.001"
                          step="0.001"
                          type="number"
                          value={line.quantity}
                          onChange={(event) => {
                            const next = [...createBomLines]
                            next[index] = { ...line, quantity: event.target.value }
                            setCreateBomLines(next)
                          }}
                        />
                      </label>
                      <label>
                        Ghi chú
                        <input
                          value={line.notes}
                          onChange={(event) => {
                            const next = [...createBomLines]
                            next[index] = { ...line, notes: event.target.value }
                            setCreateBomLines(next)
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    className="button button-secondary catalog-create-add-component"
                    type="button"
                    onClick={() => setCreateBomLines((current) => [...current, { component_product_id: '', quantity: '1', notes: '' }])}
                  >
                    Thêm vật tư
                  </button>
                </section>
              ) : null}

              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={closeCreateDialog}>Bỏ qua</button>
                <button
                  className="button button-secondary"
                  disabled={saving}
                  type="button"
                  onClick={(event) => void createProduct(event, { keepOpen: true })}
                >
                  Lưu & tạo thêm
                </button>
                <button className="button button-primary" disabled={saving} type="submit">Lưu</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
      <ProductImportDialog
        open={productImportOpen}
        service={service}
        onClose={() => setProductImportOpen(false)}
        onOldDataDeleted={() => void load({ page: 1 })}
        onImported={() => {
          setProductImportOpen(false)
          void load({ page: 1 })
        }}
      />
    </ManagementPage>
  )
}
