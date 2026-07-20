import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Banknote, ChevronLeft, ChevronRight, FilePlus2, PackageCheck, Plus, Printer, Save, Search, Trash2, WalletCards } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { dateTimeLocalInputValue, formatKvDateTime } from '../../lib/date-format'
import { currentSystemDate } from '../../lib/system-clock'
import type {
  PurchaseReceipt,
  PurchaseReceiptFinanceAccount,
  PurchaseReceiptInput,
  PurchaseReceiptProduct,
  PurchaseReceiptSupplierPayment,
  PurchaseReceiptStatus,
  RollPhysicalPayload,
  SheetPhysicalPayload,
} from './purchase-receipt-types'
import type { PurchaseReceiptService } from './purchase-receipt-service'
import type { Supplier } from './types'
import {
  defaultPhysicalPayload,
  lineAmount,
  physicalSummary,
  purchaseReceiptListSummary,
  purchaseReceiptTotals,
  purchaseUnitForProduct,
  receiptOutstandingAfterPost,
  rollPayload,
  sheetGroupQuantity,
  sheetPayload,
} from './purchase-receipt-calculations'
import { purchaseReceiptTimeQuickOptions } from './purchase-receipt-filters'
import { isExactPurchaseReceiptCode, money, statusText } from './purchase-receipt-presenter'
import { EmptyState, ManagementLoadingOverlay, ManagementRecordLink, MetricCard, MetricGrid, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDataTable,
  ManagementDateRangeInputs,
  ManagementDetailActionFooter,
  ManagementDetailHeader,
  ManagementDetailInfoList,
  ManagementDetailInlineNote,
  ManagementDetailNoteInput,
  ManagementDetailPanel,
  ManagementDetailSection,
  ManagementDetailSummary,
  ManagementInlineDetailTabs,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementImportButton,
  ManagementListSurface,
  ManagementPage,
  ManagementTableCheckboxControl,
  ManagementTableFavoriteButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { normalizeManagementSearchText, preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, sortManagementItemsByDateDesc, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { PurchaseReceiptImportDialog } from './PurchaseReceiptImportDialog'
import { dateRangeFromItems, displayDateRangeForData, toDisplayDateInput } from '../../lib/date-ranges'
import type { CurrentUserData } from '../../lib/api/types'

const blankLine = {
  product_id: '',
  inventory_shape: 'normal' as const,
  unit_name: '',
  quantity: 1,
  unit_cost: 0,
  discount_amount: 0,
  physical_payload: null,
}

function blankForm(): PurchaseReceiptInput {
  return {
    code: '',
    supplier_id: '',
    received_at: dateTimeLocalInputValue(currentSystemDate()),
    supplier_document_no: '',
    notes: '',
    discount_amount: 0,
    paid_amount: 0,
    items: [],
  }
}

function formatReceiptDateTimeInput(value: string) {
  return formatKvDateTime(value, '')
}

function parseReceiptDateTimeInput(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  const kvMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  const year = kvMatch?.[3] ?? isoMatch?.[1]
  const month = kvMatch?.[2] ?? isoMatch?.[2]
  const day = kvMatch?.[1] ?? isoMatch?.[3]
  const hour = kvMatch?.[4] ?? isoMatch?.[4]
  const minute = kvMatch?.[5] ?? isoMatch?.[5]
  if (!year || !month || !day || !hour || !minute) return null
  const localDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  if (
    localDate.getFullYear() !== Number(year)
    || localDate.getMonth() !== Number(month) - 1
    || localDate.getDate() !== Number(day)
    || localDate.getHours() !== Number(hour)
    || localDate.getMinutes() !== Number(minute)
  ) {
    return null
  }
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const receiptProductSearchPageSize = 20
const receiptCreateDraftStorageKey = 'qc-oms.purchase-receipt-create-draft.v1'
const receiptCreateDraftWindowNamePrefix = 'qc-oms.purchase-receipt-create-draft='
const receiptCreateDraftHistoryStateKey = 'qc_oms_purchase_receipt_create_draft_v1'

interface PurchaseReceiptCreateDraft {
  form: PurchaseReceiptInput
  paymentMethod: 'cash' | 'bank_transfer'
  financeAccountId: string
  rollLengthTexts: Record<number, string>
  receiptWorkspaceSideCollapsed: boolean
}

function createPurchaseReceiptLine(product: PurchaseReceiptProduct): PurchaseReceiptInput['items'][number] {
  const inventoryShape = product.inventory_shape ?? 'normal'
  return {
    product_id: product.id,
    inventory_shape: inventoryShape,
    unit_name: purchaseUnitForProduct(product),
    quantity: 1,
    unit_cost: product.latest_purchase_cost ?? 0,
    discount_amount: 0,
    physical_payload: defaultPhysicalPayload(inventoryShape),
  }
}

function receiptProductMatchesSearch(product: PurchaseReceiptProduct, query: string) {
  const normalizedText = normalizeManagementSearchText(`${product.code} ${product.name}`)
  if (normalizedText.includes(query)) return true
  return normalizedText.split(/\s+/).some((part) => part.includes(query))
}

function receiptProductSearchRank(product: PurchaseReceiptProduct, query: string) {
  const code = normalizeManagementSearchText(product.code)
  const name = normalizeManagementSearchText(product.name)
  const combined = normalizeManagementSearchText(`${product.code} ${product.name}`)
  if (code === query || name === query) return 0
  if (code.startsWith(query) || name.startsWith(query)) return 1
  if (name.split(/\s+/).some((part) => part.startsWith(query))) return 2
  if (combined.split(/\s+/).some((part) => part.startsWith(query))) return 3
  if (name.includes(query)) return 4
  if (combined.includes(query)) return 5
  return 6
}

function isReceiptPurchaseSearchableProduct(product: PurchaseReceiptProduct) {
  return product.sell_method !== 'combo'
}

function uniqueReceiptProductsById(products: PurchaseReceiptProduct[]) {
  const seen = new Set<string>()
  return products.filter((product) => {
    if (seen.has(product.id)) return false
    seen.add(product.id)
    return true
  })
}

function defaultReceiptSupplierId(suppliers: Supplier[]) {
  const defaultSupplier = suppliers.find((supplier) => {
    const text = normalizeManagementSearchText(`${supplier.code} ${supplier.name}`)
    return text.includes('ncc le') || text.includes('nha cung cap le')
  })
  return (defaultSupplier ?? suppliers[0])?.id ?? ''
}

function accountDisplayName(currentUser?: CurrentUserData) {
  if (!currentUser) return ''
  return currentUser.user.display_name.trim() || currentUser.user.email
}

function readReceiptCreateDraft() {
  if (typeof window === 'undefined') return null
  const historyDraft = window.history.state?.[receiptCreateDraftHistoryStateKey]
  if (historyDraft && typeof historyDraft === 'object') {
    try {
      const parsed = historyDraft as Partial<PurchaseReceiptCreateDraft>
      if (!parsed.form || !Array.isArray(parsed.form.items)) return null
      return {
        form: { ...blankForm(), ...parsed.form },
        paymentMethod: parsed.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
        financeAccountId: typeof parsed.financeAccountId === 'string' ? parsed.financeAccountId : '',
        rollLengthTexts: parsed.rollLengthTexts ?? {},
        receiptWorkspaceSideCollapsed: Boolean(parsed.receiptWorkspaceSideCollapsed),
      } satisfies PurchaseReceiptCreateDraft
    } catch {
      // fall through to storage fallback
    }
  }
  const rawSession = window.sessionStorage.getItem(receiptCreateDraftStorageKey)
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession) as Partial<PurchaseReceiptCreateDraft>
      if (!parsed.form || !Array.isArray(parsed.form.items)) return null
      return {
        form: { ...blankForm(), ...parsed.form },
        paymentMethod: parsed.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
        financeAccountId: typeof parsed.financeAccountId === 'string' ? parsed.financeAccountId : '',
        rollLengthTexts: parsed.rollLengthTexts ?? {},
        receiptWorkspaceSideCollapsed: Boolean(parsed.receiptWorkspaceSideCollapsed),
      } satisfies PurchaseReceiptCreateDraft
    } catch {
      // fall through to window.name/localStorage fallback
    }
  }
  if (window.name.startsWith(receiptCreateDraftWindowNamePrefix)) {
    try {
      const raw = decodeURIComponent(window.name.slice(receiptCreateDraftWindowNamePrefix.length))
      const parsed = JSON.parse(raw) as Partial<PurchaseReceiptCreateDraft>
      if (!parsed.form || !Array.isArray(parsed.form.items)) return null
      return {
        form: { ...blankForm(), ...parsed.form },
        paymentMethod: parsed.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
        financeAccountId: typeof parsed.financeAccountId === 'string' ? parsed.financeAccountId : '',
        rollLengthTexts: parsed.rollLengthTexts ?? {},
        receiptWorkspaceSideCollapsed: Boolean(parsed.receiptWorkspaceSideCollapsed),
      } satisfies PurchaseReceiptCreateDraft
    } catch {
      // fall through to storage fallback
    }
  }
  const raw = window.localStorage.getItem(receiptCreateDraftStorageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PurchaseReceiptCreateDraft>
    if (!parsed.form || !Array.isArray(parsed.form.items)) return null
    return {
      form: { ...blankForm(), ...parsed.form },
      paymentMethod: parsed.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
      financeAccountId: typeof parsed.financeAccountId === 'string' ? parsed.financeAccountId : '',
      rollLengthTexts: parsed.rollLengthTexts ?? {},
      receiptWorkspaceSideCollapsed: Boolean(parsed.receiptWorkspaceSideCollapsed),
    } satisfies PurchaseReceiptCreateDraft
  } catch {
    return null
  }
}

function writeReceiptCreateDraft(draft: PurchaseReceiptCreateDraft) {
  if (typeof window === 'undefined') return
  window.history.replaceState(
    {
      ...(window.history.state ?? {}),
      [receiptCreateDraftHistoryStateKey]: draft,
    },
    '',
  )
  window.sessionStorage.setItem(receiptCreateDraftStorageKey, JSON.stringify(draft))
  window.name = `${receiptCreateDraftWindowNamePrefix}${encodeURIComponent(JSON.stringify(draft))}`
  window.localStorage.setItem(receiptCreateDraftStorageKey, JSON.stringify(draft))
}

type ReceiptDetailTab = 'info' | 'payments'

type PurchaseReceiptSortKey = 'code' | 'received_at' | 'supplier_name' | 'total_quantity' | 'subtotal_amount' | 'payable_amount' | 'paid_amount'
const defaultPurchaseReceiptSortState: NonNullable<ManagementSortState<PurchaseReceiptSortKey>> = { key: 'received_at', direction: 'desc' }

function receiptTotalQuantity(receipt: PurchaseReceipt) {
  return receipt.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
}

function quantityText(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function supplierPaymentStatusText(status: 'posted' | 'cancelled') {
  return status === 'posted' ? 'Đã thanh toán' : 'Đã hủy'
}

function supplierPaymentMethodText(method: 'cash' | 'bank_transfer') {
  return method === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'
}

function purchaseReceiptPaymentRows(receipt: PurchaseReceipt): PurchaseReceiptSupplierPayment[] {
  if (receipt.status !== 'posted') return sortManagementItemsByDateDesc(receipt.supplier_payments, (payment) => payment.paid_at)

  const afterPostPaymentsTotal = receipt.supplier_payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const importPaidAmount = Math.max(Number(receipt.paid_amount || 0) - afterPostPaymentsTotal, 0)

  if (importPaidAmount <= 0) return sortManagementItemsByDateDesc(receipt.supplier_payments, (payment) => payment.paid_at)

  return sortManagementItemsByDateDesc([
    {
      id: `${receipt.id}-import-payment`,
      code: `PC${receipt.code}`,
      paid_at: receipt.received_at,
      created_by: receipt.created_by.name,
      payment_method: 'bank_transfer',
      status: 'posted',
      amount: importPaidAmount,
    },
    ...receipt.supplier_payments,
  ], (payment) => payment.paid_at)
}

function initialPurchaseReceiptRouteFilters() {
  const params = new URLSearchParams(window.location.search)
  const search = (params.get('search') ?? params.get('q') ?? '').trim()
  const open = (params.get('open') ?? '').trim()
  const hasSearch = search.length > 0
  const hasOpen = open.length > 0

  return {
    search,
    open,
    status: (hasSearch || hasOpen ? 'all' : 'posted') as PurchaseReceiptStatus | 'all',
    shouldOpenSingleResult: hasSearch || hasOpen,
  }
}

export function PurchaseReceiptsPage({
  currentUser,
  service,
  createMode = false,
  onCloseCreateReceipt,
  onOpenCreateReceipt,
}: {
  currentUser?: CurrentUserData
  service: PurchaseReceiptService
  createMode?: boolean
  onCloseCreateReceipt?: () => void
  onOpenCreateReceipt?: () => void
  onOpenDashboard: () => void
}) {
  const [receipts, setReceipts] = useState<PurchaseReceipt[] | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<PurchaseReceiptProduct[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<PurchaseReceiptFinanceAccount[]>([])
  const [suppliersLoaded, setSuppliersLoaded] = useState(false)
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [financeAccountsLoaded, setFinanceAccountsLoaded] = useState(false)
  const [total, setTotal] = useState(0)
  const [receiptListSummary, setReceiptListSummary] = useState<{ payable_amount: number; remaining_amount: number } | null>(null)
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [routeFilters] = useState(initialPurchaseReceiptRouteFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState(routeFilters.search)
  const [status, setStatus] = useState<PurchaseReceiptStatus | 'all'>(routeFilters.status)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [createdBy, setCreatedBy] = useState('all')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [receiptQuickTimeOpen, setReceiptQuickTimeOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [detailOpen, setDetailOpen] = useState(createMode)
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<PurchaseReceiptStatus | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null)
  const [receiptDetailTab, setReceiptDetailTab] = useState<ReceiptDetailTab>('info')
  const [form, setForm] = useState<PurchaseReceiptInput>(() => blankForm())
  const [receiptReceivedAtText, setReceiptReceivedAtText] = useState(() => formatReceiptDateTimeInput(blankForm().received_at))
  const [receiptProductSearch, setReceiptProductSearch] = useState('')
  const [receiptWorkspaceSideCollapsed, setReceiptWorkspaceSideCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [financeAccountId, setFinanceAccountId] = useState('')
  const [favoriteReceiptIds, setFavoriteReceiptIds] = useState<string[]>([])
  const [showFavoriteReceiptsOnly, setShowFavoriteReceiptsOnly] = useState(false)
  const [supplierPaymentOpen, setSupplierPaymentOpen] = useState(false)
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState(0)
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [supplierPaymentFinanceAccountId, setSupplierPaymentFinanceAccountId] = useState('')
  const [rollLengthTexts, setRollLengthTexts] = useState<Record<number, string>>({})
  const [importOpen, setImportOpen] = useState(false)
  const [productCreateOpen, setProductCreateOpen] = useState(false)
  const [productCreateSaving, setProductCreateSaving] = useState(false)
  const [productCreateError, setProductCreateError] = useState<string | null>(null)
  const [productCreateForm, setProductCreateForm] = useState({
    code: '',
    name: '',
    unitName: '',
    sellMethod: 'quantity' as PurchaseReceiptProduct['sell_method'],
  })
  const [receiptProductCatalogSearchResult, setReceiptProductCatalogSearchResult] = useState<{
    search: string
    products: PurchaseReceiptProduct[]
  }>({
    search: '',
    products: [],
  })
  const [error, setError] = useState<string | null>(null)
  const receiptProductSearchRef = useRef<HTMLInputElement | null>(null)
  const receiptProductSearchToolbarRef = useRef<HTMLDivElement | null>(null)
  const receiptCreateDraftRestoredRef = useRef(false)
  const skipReceiptCreateDraftPersistRef = useRef(false)
  const receiptSortInitialRender = useRef(true)
  const totals = useMemo(() => {
    return purchaseReceiptTotals(form)
  }, [form])

  const lowCostWarnings = useMemo(() => {
    return form.items.flatMap((line, index) => {
      const product = products.find((candidate) => candidate.id === line.product_id)
      if (product?.latest_purchase_cost === null || product?.latest_purchase_cost === undefined) return []
      if (Number(line.unit_cost || 0) >= product.latest_purchase_cost) return []
      return [
        `Dòng ${index + 1}: giá nhập ${money(Number(line.unit_cost || 0))} thấp hơn giá nhập cuối ${money(
          product.latest_purchase_cost,
        )} của ${product.code}.`,
      ]
    })
  }, [form.items, products])

  const bankAccounts = useMemo(
    () => financeAccounts.filter((account) => account.is_active && account.account_type === 'bank'),
    [financeAccounts],
  )
  const isReadOnly = editingStatus !== null && editingStatus !== 'draft'
  const selectedReceiptOutstanding = selectedReceipt ? receiptOutstandingAfterPost(selectedReceipt) : 0
  const isCreatingReceipt = detailOpen && editingId === null
  const receiptProductSearchResults = useMemo(() => {
    const search = receiptProductSearch.trim()
    const query = normalizeManagementSearchText(receiptProductSearch)
    if (!isCreatingReceipt || query.length === 0) return []
    const searchProducts = receiptProductCatalogSearchResult.search === search ? receiptProductCatalogSearchResult.products : []
    return uniqueReceiptProductsById([...searchProducts, ...products])
      .filter(isReceiptPurchaseSearchableProduct)
      .filter((product) => receiptProductMatchesSearch(product, query))
      .sort((left, right) => {
        const rankDelta = receiptProductSearchRank(left, query) - receiptProductSearchRank(right, query)
        if (rankDelta !== 0) return rankDelta
        return left.name.localeCompare(right.name, 'vi')
      })
  }, [isCreatingReceipt, products, receiptProductCatalogSearchResult, receiptProductSearch])
  const receiptProductSuggestions = useMemo(() => {
    return receiptProductSearchResults.slice(0, 8).map((product) => ({
      id: product.id,
      primary: `${product.code} - ${product.name}`,
      secondary: `ĐVT: ${purchaseUnitForProduct(product)}`,
      meta: product.latest_purchase_cost !== null && product.latest_purchase_cost !== undefined ? `Giá nhập: ${money(product.latest_purchase_cost)}` : undefined,
      ariaLabel: `Chọn hàng ${product.code} ${product.name}`,
    }))
  }, [receiptProductSearchResults])
  const receiptSummary = useMemo(() => {
    const fallback = purchaseReceiptListSummary(receipts ?? [])
    return {
      payable: receiptListSummary?.payable_amount ?? fallback.payable,
      remaining: receiptListSummary?.remaining_amount ?? fallback.remaining,
    }
  }, [receiptListSummary, receipts])
  const {
    sortedItems: sortedReceipts,
    sortState: receiptSortState,
    requestSort: requestReceiptSort,
  } = useManagementTableSort<PurchaseReceipt, PurchaseReceiptSortKey>(receipts ?? [], {
    code: { kind: 'text', value: (receipt) => receipt.code },
    received_at: { kind: 'date', value: (receipt) => receipt.received_at },
    supplier_name: { kind: 'text', value: (receipt) => receipt.supplier.name },
    total_quantity: { kind: 'number', value: (receipt) => receiptTotalQuantity(receipt) },
    subtotal_amount: { kind: 'number', value: (receipt) => receipt.subtotal_amount },
    payable_amount: { kind: 'number', value: (receipt) => receipt.payable_amount },
    paid_amount: { kind: 'number', value: (receipt) => receipt.paid_amount },
  }, defaultPurchaseReceiptSortState)
  const visibleReceipts = useMemo(() => {
    if (!showFavoriteReceiptsOnly) return sortedReceipts
    return sortedReceipts.filter((receipt) => favoriteReceiptIds.includes(receipt.id))
  }, [favoriteReceiptIds, showFavoriteReceiptsOnly, sortedReceipts])
  const receiptWorkspaceLookupLoading = isCreatingReceipt && (!suppliersLoaded || !productsLoaded)

  useEffect(() => {
    setReceiptReceivedAtText(formatReceiptDateTimeInput(form.received_at))
  }, [form.received_at])

  function updateReceiptReceivedAtText(value: string) {
    setReceiptReceivedAtText(value)
    const normalized = parseReceiptDateTimeInput(value)
    if (normalized && normalized !== form.received_at) {
      setForm((current) => ({ ...current, received_at: normalized }))
    }
  }

  useEffect(() => {
    if (!isCreatingReceipt) return undefined

    function focusProductSearch(event: KeyboardEvent) {
      if (event.key !== 'F8' && event.key !== 'F3') return
      event.preventDefault()
      receiptProductSearchRef.current?.focus()
      receiptProductSearchRef.current?.select()
    }

    window.addEventListener('keydown', focusProductSearch)
    return () => window.removeEventListener('keydown', focusProductSearch)
  }, [isCreatingReceipt])

  useEffect(() => {
    if (!isCreatingReceipt) return undefined

    function closeReceiptProductSearchOnOutsidePointer(event: PointerEvent) {
      if (receiptProductSearch.trim().length === 0) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (receiptProductSearchToolbarRef.current?.contains(target)) return
      setReceiptProductSearch('')
      setReceiptProductCatalogSearchResult({ search: '', products: [] })
    }

    document.addEventListener('pointerdown', closeReceiptProductSearchOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeReceiptProductSearchOnOutsidePointer, true)
  }, [isCreatingReceipt, receiptProductSearch])

  useEffect(() => {
    if (!isCreatingReceipt) return undefined

    const search = receiptProductSearch.trim()
    if (search.length === 0) {
      return undefined
    }

    let active = true

    async function searchProducts() {
      try {
        const productResult = await service.listProducts({
          status: 'active',
          search,
          page: 1,
          page_size: receiptProductSearchPageSize,
        })
        if (!active) return
        setReceiptProductCatalogSearchResult({
          search,
          products: productResult.items.filter((product) => product.status === 'active' && isReceiptPurchaseSearchableProduct(product)),
        })
      } catch (cause) {
        if (!active) return
        setReceiptProductCatalogSearchResult({ search, products: [] })
        setError(formatApiError(cause, 'Không tìm được hàng hóa.'))
      }
    }

    void searchProducts()

    return () => {
      active = false
    }
  }, [isCreatingReceipt, receiptProductSearch, service])

  async function loadReceipts(
    input: {
      search?: string
      status?: PurchaseReceiptStatus | 'all'
      date_from?: string
      date_to?: string
      created_by?: string
      page?: number
    page_size?: number
      sortStateValue?: ManagementSortState<PurchaseReceiptSortKey>
    } = {
      search: search.trim() || undefined,
      status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      created_by: createdBy === 'all' ? undefined : createdBy,
      page,
      page_size: pageSize,
    },
  ) {
    const nextPage = input.page ?? page
    const nextPageSize = input.page_size ?? pageSize
    const nextSortState = input.sortStateValue ?? receiptSortState
    setError(null)
    try {
      const result = await service.listReceipts({
        ...input,
        page: nextPage,
        page_size: nextPageSize,
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultPurchaseReceiptSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
      })
      setReceipts(result.items)
      setTotal(result.total)
      setReceiptListSummary(result.summary ?? null)
      setPage(result.page)
      setPageSize(result.page_size)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được phiếu nhập.'))
    }
  }

  useEffect(() => {
    if (receiptSortInitialRender.current) {
      receiptSortInitialRender.current = false
      return
    }
    queueMicrotask(() => void loadReceipts({ page: 1, sortStateValue: receiptSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptSortState?.key, receiptSortState?.direction])

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      setError(null)
      try {
        const receiptResult = await service.listReceipts({
          search: routeFilters.search || routeFilters.open || undefined,
          status: routeFilters.status,
          page: 1,
          page_size: defaultPageSize,
        })
        if (!active) return
        setReceipts(receiptResult.items)
        setTotal(receiptResult.total)
        setReceiptListSummary(receiptResult.summary ?? null)
        setPage(receiptResult.page)
        setPageSize(receiptResult.page_size)
        if (routeFilters.shouldOpenSingleResult && receiptResult.items.length === 1) {
          const [singleReceipt] = receiptResult.items
          setLoadingReceiptId(singleReceipt.id)
          try {
            const detail = await service.getReceipt(singleReceipt.id)
            if (!active) return
            setDetailOpen(true)
            setEditingId(detail.id)
            setEditingStatus(detail.status)
            setSelectedReceipt(detail)
            setReceiptDetailTab('info')
            setForm({
              code: detail.code,
              supplier_id: detail.supplier_id,
              received_at: detail.received_at.slice(0, 16),
              supplier_document_no: detail.supplier_document_no ?? '',
              notes: detail.notes ?? '',
              discount_amount: detail.discount_amount,
              paid_amount: detail.paid_amount,
              items: detail.items.map((item) => ({
                product_id: item.product_id,
                inventory_shape: item.inventory_shape,
                unit_name: item.unit_name_snapshot,
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                discount_amount: item.discount_amount,
                physical_payload: item.physical_payload,
              })),
            })
          } catch (cause) {
            if (active) setError(formatApiError(cause, 'Không tải được chi tiết phiếu nhập.'))
          } finally {
            if (active) setLoadingReceiptId(null)
          }
        }
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được phiếu nhập.'))
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [defaultPageSize, routeFilters, service])

  const ensureReceiptLookupsLoaded = useCallback(async () => {
    const requests: Promise<void>[] = []
    let nextSuppliers = suppliers
    let nextProducts = products
    if (!suppliersLoaded) {
      requests.push(service.listSuppliers().then((result) => {
        nextSuppliers = result.items
        setSuppliers(result.items)
        setSuppliersLoaded(true)
      }))
    }
    if (!productsLoaded) {
      requests.push(service.listProducts().then((result) => {
        nextProducts = result.items.filter((product) => product.status === 'active')
        setProducts(nextProducts)
        setProductsLoaded(true)
      }))
    }
    await Promise.all(requests)
    return { suppliers: nextSuppliers, products: nextProducts }
  }, [products, productsLoaded, service, suppliers, suppliersLoaded])

  useEffect(() => {
    if (!createMode) return
    if (receiptCreateDraftRestoredRef.current) return
    receiptCreateDraftRestoredRef.current = true
    const draft = readReceiptCreateDraft()
    if (!draft) {
      void openCreateReceipt()
      return
    }
    const receiptCreateDraft = draft

    let active = true
    async function restoreCreateDraft() {
      try {
        const lookups = await ensureReceiptLookupsLoaded()
        if (!active) return
        setEditingId(null)
        setEditingStatus(null)
        setSelectedReceipt(null)
        setReceiptDetailTab('info')
        setSupplierPaymentOpen(false)
        setDetailOpen(true)
        setForm({
          ...receiptCreateDraft.form,
          supplier_id: receiptCreateDraft.form.supplier_id || defaultReceiptSupplierId(lookups.suppliers),
        })
        setReceiptReceivedAtText(formatReceiptDateTimeInput(receiptCreateDraft.form.received_at))
        setPaymentMethod(receiptCreateDraft.paymentMethod)
        setFinanceAccountId(receiptCreateDraft.financeAccountId)
        setRollLengthTexts(receiptCreateDraft.rollLengthTexts)
        setReceiptWorkspaceSideCollapsed(receiptCreateDraft.receiptWorkspaceSideCollapsed)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không khôi phục được phiếu nhập đang tạo.'))
      }
    }

    void restoreCreateDraft()
    return () => {
      active = false
    }
  }, [createMode, ensureReceiptLookupsLoaded])

  useEffect(() => {
    if (!isCreatingReceipt) return
    const draft: PurchaseReceiptCreateDraft = {
      form,
      paymentMethod,
      financeAccountId,
      rollLengthTexts,
      receiptWorkspaceSideCollapsed,
    }
    writeReceiptCreateDraft(draft)

    function persistDraft() {
      writeReceiptCreateDraft(draft)
    }

    window.addEventListener('pagehide', persistDraft)
    window.addEventListener('beforeunload', persistDraft)
    return () => {
      window.removeEventListener('pagehide', persistDraft)
      window.removeEventListener('beforeunload', persistDraft)
      if (skipReceiptCreateDraftPersistRef.current) {
        skipReceiptCreateDraftPersistRef.current = false
        return
      }
      persistDraft()
    }
  }, [financeAccountId, form, isCreatingReceipt, paymentMethod, receiptWorkspaceSideCollapsed, rollLengthTexts])

function clearReceiptCreateDraft() {
    skipReceiptCreateDraftPersistRef.current = true
    if (typeof window === 'undefined') return
    const nextHistoryState = { ...(window.history.state ?? {}) }
    delete nextHistoryState[receiptCreateDraftHistoryStateKey]
    window.history.replaceState(nextHistoryState, '')
    if (window.name.startsWith(receiptCreateDraftWindowNamePrefix)) {
      window.name = ''
    }
    window.sessionStorage.removeItem(receiptCreateDraftStorageKey)
    window.localStorage.removeItem(receiptCreateDraftStorageKey)
  }

  async function ensureFinanceAccountsLoaded() {
    if (financeAccountsLoaded) return
    const result = await service.listFinanceAccounts()
    setFinanceAccounts(result.items)
    setFinanceAccountsLoaded(true)
  }

  async function filterReceipts(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyReceiptSearch(search, { exactCodePriority: true }))
  }

  function applyReceiptSearch(nextSearch: string, options: { exactCodePriority?: boolean } = {}) {
    setPage(1)
    if (options.exactCodePriority && isExactPurchaseReceiptCode(nextSearch)) {
      setStatus('all')
      setDateFrom('')
      setDateTo('')
      setCreatedBy('all')
      setActivePreset(null)
      return loadReceipts({ search: nextSearch.trim(), status: 'all', page: 1, page_size: pageSize })
    }
    return loadReceipts({
      search: nextSearch.trim() || undefined,
      status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      created_by: createdBy === 'all' ? undefined : createdBy,
      page: 1,
      page_size: pageSize,
    })
  }

  function changeReceiptSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch,
      resetSelection: () => {
        setSelectedReceipt(null)
        setDetailOpen(false)
        setEditingId(null)
        setReceiptDetailTab('info')
      },
      load: (query) => applyReceiptSearch(query),
    })
  }

  async function applyReceiptFilters(next: {
    search?: string
    status?: PurchaseReceiptStatus | 'all'
    dateFrom?: string
    dateTo?: string
    createdBy?: string
    preset?: string | null
  }) {
    const nextSearch = next.search ?? search
    const nextStatus = next.status ?? status
    const nextDateFrom = next.dateFrom ?? dateFrom
    const nextDateTo = next.dateTo ?? dateTo
    const nextCreatedBy = next.createdBy ?? createdBy
    setSearch(nextSearch)
    setStatus(nextStatus)
    setDateFrom(nextDateFrom)
    setDateTo(nextDateTo)
    setCreatedBy(nextCreatedBy)
    setActivePreset(next.preset ?? null)
    setPage(1)
    await loadReceipts({
      search: nextSearch.trim() || undefined,
      status: nextStatus,
      date_from: nextDateFrom || undefined,
      date_to: nextDateTo || undefined,
      created_by: nextCreatedBy === 'all' ? undefined : nextCreatedBy,
      page: 1,
      page_size: pageSize,
    })
  }

  async function goToPage(nextPage: number) {
    await loadReceipts({
      search: search.trim() || undefined,
      status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      created_by: createdBy === 'all' ? undefined : createdBy,
      page: nextPage,
      page_size: pageSize,
    })
  }

  async function openReceipt(receipt: PurchaseReceipt) {
    if (editingId === receipt.id) {
      setEditingId(null)
      setEditingStatus(null)
      setSelectedReceipt(null)
      setReceiptDetailTab('info')
      setDetailOpen(false)
      setSupplierPaymentOpen(false)
      setLoadingReceiptId(null)
      return
    }
    setError(null)
    setDetailOpen(false)
    setLoadingReceiptId(receipt.id)
    setEditingId(null)
    setEditingStatus(null)
    setSelectedReceipt(null)
    setReceiptDetailTab('info')
    setSupplierPaymentOpen(false)
    try {
      const [detail] = await Promise.all([service.getReceipt(receipt.id), ensureReceiptLookupsLoaded()])
      setDetailOpen(true)
      setEditingId(detail.id)
      setEditingStatus(detail.status)
      setSelectedReceipt(detail)
      setReceiptDetailTab('info')
      setForm({
        code: detail.code,
        supplier_id: detail.supplier_id,
        received_at: detail.received_at.slice(0, 16),
        supplier_document_no: detail.supplier_document_no ?? '',
        notes: detail.notes ?? '',
        discount_amount: detail.discount_amount,
        paid_amount: detail.paid_amount,
        items: detail.items.map((item) => ({
          product_id: item.product_id,
          inventory_shape: item.inventory_shape,
          unit_name: item.unit_name_snapshot,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          discount_amount: item.discount_amount,
          physical_payload: item.physical_payload,
        })),
      })
      setPaymentMethod('cash')
      setFinanceAccountId('')
      setSupplierPaymentOpen(false)
      setSupplierPaymentAmount(0)
      setSupplierPaymentMethod('cash')
      setSupplierPaymentFinanceAccountId('')
      setRollLengthTexts({})
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết phiếu nhập.'))
    } finally {
      setLoadingReceiptId(null)
    }
  }

  function toggleReceiptFavorite(receipt: PurchaseReceipt) {
    setFavoriteReceiptIds((current) =>
      current.includes(receipt.id)
        ? current.filter((receiptId) => receiptId !== receipt.id)
        : [...current, receipt.id],
    )
  }

  async function saveReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isReadOnly) return
    if (form.items.length === 0) {
      setError('Chọn ít nhất 1 hàng hóa trước khi lưu phiếu nhập.')
      return
    }
    const normalizedReceivedAt = parseReceiptDateTimeInput(receiptReceivedAtText)
    if (normalizedReceivedAt === null) {
      setError('Nhập ngày giờ dạng DD/MM/YYYY HH:mm.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const nextForm = { ...form, received_at: normalizedReceivedAt || form.received_at }
      if (editingId === null) {
        await service.createReceipt(nextForm)
      } else {
        await service.updateReceipt(editingId, nextForm)
      }
      if (editingId === null) clearReceiptCreateDraft()
      if (editingId === null && createMode && onCloseCreateReceipt) {
        onCloseCreateReceipt()
        return
      }
      setEditingId(null)
      setEditingStatus(null)
      setSelectedReceipt(null)
      setReceiptDetailTab('info')
      setDetailOpen(false)
      setForm(blankForm())
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được phiếu nhập.'))
    } finally {
      setSaving(false)
    }
  }

  async function postReceipt() {
    if (editingId === null || editingStatus !== 'draft') return
    if (Number(form.paid_amount || 0) > 0 && paymentMethod === 'bank_transfer' && financeAccountId === '') {
      setError('Chọn tài khoản chuyển khoản trước khi hoàn thành phiếu nhập.')
      return
    }

    setPosting(true)
    setError(null)
    try {
      await service.postReceipt(editingId, {
        ...(Number(form.paid_amount || 0) > 0 ? { payment_method: paymentMethod } : {}),
        ...(Number(form.paid_amount || 0) > 0 && paymentMethod === 'bank_transfer'
          ? { finance_account_id: financeAccountId }
          : {}),
      })
      setEditingId(null)
      setEditingStatus(null)
      setSelectedReceipt(null)
      setReceiptDetailTab('info')
      setDetailOpen(false)
      setForm(blankForm())
      clearReceiptCreateDraft()
      if (createMode && onCloseCreateReceipt) {
        onCloseCreateReceipt()
        return
      }
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không hoàn thành được phiếu nhập.'))
    } finally {
      setPosting(false)
    }
  }

  function updateLine(index: number, patch: Partial<PurchaseReceiptInput['items'][number]>) {
    setForm((current) => {
      const items = current.items.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
      return { ...current, items }
    })
  }

  function chooseProduct(index: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId)
    const inventoryShape = product?.inventory_shape ?? 'normal'
    updateLine(index, {
      product_id: productId,
      inventory_shape: inventoryShape,
      unit_name: purchaseUnitForProduct(product),
      quantity: 1,
      unit_cost: product?.latest_purchase_cost ?? 0,
      physical_payload: defaultPhysicalPayload(inventoryShape),
    })
    setRollLengthTexts((current) => {
      const next = { ...current }
      if (inventoryShape === 'roll') next[index] = '1'
      else delete next[index]
      return next
    })
  }

  function selectReceiptProduct(productId: string) {
    const product = receiptProductSearchResults.find((candidate) => candidate.id === productId)
    if (!product) return

    setProducts((current) => uniqueReceiptProductsById([product, ...current]))
    const nextLine = createPurchaseReceiptLine(product)
    const lineIndex = form.items.length
    setForm((current) => {
      return { ...current, items: [...current.items, nextLine] }
    })
    setRollLengthTexts((current) => {
      const next = { ...current }
      if (nextLine.inventory_shape === 'roll') next[lineIndex] = '1'
      else delete next[lineIndex]
      return next
    })
    setReceiptProductSearch('')
    setReceiptProductCatalogSearchResult({ search: '', products: [] })
  }

  function submitReceiptProductSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const firstSuggestion = receiptProductSuggestions[0]
    if (firstSuggestion) selectReceiptProduct(firstSuggestion.id)
  }

  async function createReceiptProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProductCreateSaving(true)
    setProductCreateError(null)
    try {
      const created = await service.createProduct({
        code: productCreateForm.code.trim(),
        name: productCreateForm.name.trim(),
        status: 'active',
        unit_name: productCreateForm.unitName.trim(),
        sell_method: productCreateForm.sellMethod,
        inventory_shape: 'normal',
        track_inventory: true,
      })
      setProducts((current) => [created, ...current].slice(0, 12))
      setReceiptProductSearch(created.code)
      setProductCreateForm({ code: '', name: '', unitName: '', sellMethod: 'quantity' })
      setProductCreateOpen(false)
    } catch (cause) {
      setProductCreateError(formatApiError(cause, 'Không tạo được hàng hóa.'))
    } finally {
      setProductCreateSaving(false)
    }
  }

  function addLine() {
    setForm((current) => ({ ...current, items: [...current.items, { ...blankLine }] }))
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  function updateRollPayload(index: number, patch: { width_m?: number; lengths_m?: number[] }) {
    const currentPayload = rollPayload(form.items[index]?.physical_payload ?? null)
    const nextPayload: RollPhysicalPayload = {
      rolls: {
        width_m: patch.width_m ?? currentPayload.rolls.width_m,
        lengths_m: patch.lengths_m ?? currentPayload.rolls.lengths_m,
      },
    }
    updateLine(index, {
      quantity: nextPayload.rolls.lengths_m.length,
      physical_payload: nextPayload,
    })
  }

  function updateSheetPayload(index: number, groupIndex: number, patch: Partial<SheetPhysicalPayload['sheet_groups'][number]>) {
    const currentPayload = sheetPayload(form.items[index]?.physical_payload ?? null)
    const sheetGroups = currentPayload.sheet_groups.map((group, currentGroupIndex) =>
      currentGroupIndex === groupIndex ? { ...group, ...patch } : group,
    )
    const nextPayload: SheetPhysicalPayload = { sheet_groups: sheetGroups }
    updateLine(index, {
      quantity: sheetGroupQuantity(sheetGroups),
      physical_payload: nextPayload,
    })
  }

  function addSheetGroup(index: number) {
    const currentPayload = sheetPayload(form.items[index]?.physical_payload ?? null)
    const nextPayload: SheetPhysicalPayload = {
      sheet_groups: [...currentPayload.sheet_groups, { width_m: 1, length_m: 1, quantity: 1 }],
    }
    updateLine(index, {
      quantity: sheetGroupQuantity(nextPayload.sheet_groups),
      physical_payload: nextPayload,
    })
  }

  function removeSheetGroup(index: number, groupIndex: number) {
    const currentPayload = sheetPayload(form.items[index]?.physical_payload ?? null)
    const sheetGroups = currentPayload.sheet_groups.filter((_, currentGroupIndex) => currentGroupIndex !== groupIndex)
    const nextGroups = sheetGroups.length === 0 ? [{ width_m: 1, length_m: 1, quantity: 1 }] : sheetGroups
    updateLine(index, {
      quantity: sheetGroupQuantity(nextGroups),
      physical_payload: { sheet_groups: nextGroups },
    })
  }

  function resetForm() {
    setEditingId(null)
    setEditingStatus(null)
    setSelectedReceipt(null)
    setReceiptDetailTab('info')
    setDetailOpen(true)
    const nextBlankForm = blankForm()
    setForm(nextBlankForm)
    setPaymentMethod('cash')
    setFinanceAccountId('')
    setReceiptReceivedAtText(formatReceiptDateTimeInput(nextBlankForm.received_at))
    setSupplierPaymentOpen(false)
    setSupplierPaymentAmount(0)
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
    setRollLengthTexts({})
    setReceiptProductSearch('')
    setReceiptProductCatalogSearchResult({ search: '', products: [] })
  }

  async function openCreateReceipt() {
    if (!createMode && onOpenCreateReceipt) {
      onOpenCreateReceipt()
      return
    }
    setError(null)
    setLoadingReceiptId(null)
    resetForm()
    try {
      const lookups = await ensureReceiptLookupsLoaded()
      setForm((current) => ({ ...current, supplier_id: current.supplier_id || defaultReceiptSupplierId(lookups.suppliers) }))
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được dữ liệu tạo phiếu nhập.'))
    }
  }

  function closeCreateReceipt() {
    if (createMode && onCloseCreateReceipt) {
      onCloseCreateReceipt()
      return
    }
    setEditingId(null)
    setEditingStatus(null)
    setSelectedReceipt(null)
    setReceiptDetailTab('info')
    setDetailOpen(false)
    setForm(blankForm())
    setPaymentMethod('cash')
    setFinanceAccountId('')
    setSupplierPaymentOpen(false)
    setSupplierPaymentAmount(0)
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
    setRollLengthTexts({})
    setReceiptProductSearch('')
    setReceiptProductCatalogSearchResult({ search: '', products: [] })
  }

  function openSupplierPaymentForReceipt() {
    if (selectedReceipt === null) return
    setSupplierPaymentOpen(true)
    setSupplierPaymentAmount(Math.max(selectedReceiptOutstanding, 0))
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
  }

  async function changeImmediatePaymentMethod(nextMethod: 'cash' | 'bank_transfer') {
    setPaymentMethod(nextMethod)
    if (nextMethod !== 'bank_transfer') return
    try {
      await ensureFinanceAccountsLoaded()
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được tài khoản chuyển khoản.'))
    }
  }

  async function changeSupplierPaymentMethod(nextMethod: 'cash' | 'bank_transfer') {
    setSupplierPaymentMethod(nextMethod)
    if (nextMethod !== 'bank_transfer') return
    try {
      await ensureFinanceAccountsLoaded()
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được tài khoản chuyển khoản.'))
    }
  }

  const creatorOptions = useMemo(() => {
    const creators = new Map<string, string>()
    for (const receipt of receipts ?? []) {
      creators.set(receipt.created_by.id, receipt.created_by.name)
    }
    return Array.from(creators, ([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name))
  }, [receipts])
  const selectedCreatorName = creatorOptions.find((creator) => creator.id === createdBy)?.name ?? createdBy
  const receiptTimeQuickOptions = purchaseReceiptTimeQuickOptions()
  const selectedTimeQuickOption = receiptTimeQuickOptions.find((option) => option.from === dateFrom && option.to === dateTo)?.id ?? 'custom'
  const selectedReceiptTimeLabel = receiptTimeQuickOptions.find((option) => option.id === selectedTimeQuickOption)?.label
    ?? `${toDisplayDateInput(dateFrom)} - ${toDisplayDateInput(dateTo)}`
  const receiptVisibleDateRange = selectedTimeQuickOption === 'custom'
    ? { from: dateFrom, to: dateTo }
    : displayDateRangeForData(
        { from: dateFrom, to: dateTo },
        dateRangeFromItems(receipts ?? [], (receipt) => receipt.received_at),
      )

  const receiptFilterChips = [
    ...(activePreset
      ? [
          {
            id: 'preset',
            label: `Preset: ${activePreset}`,
            onClear: () => void applyReceiptFilters({ status: 'draft', dateFrom: '', dateTo: '', preset: null }),
          },
        ]
      : []),
    ...(!activePreset && status !== 'posted'
      ? [
          {
            id: 'status',
            label: `Trạng thái: ${status === 'all' ? 'Tất cả' : statusText(status)}`,
            onClear: () => void applyReceiptFilters({ status: 'posted' }),
          },
        ]
      : []),
    ...(!activePreset && createdBy !== 'all'
      ? [
          {
            id: 'created-by',
            label: `Người tạo: ${selectedCreatorName}`,
            onClear: () => void applyReceiptFilters({ createdBy: 'all' }),
          },
        ]
      : []),
    ...(!activePreset && dateFrom
      ? [
          {
            id: 'date-from',
            label: `Từ ngày: ${dateFrom}`,
            onClear: () => void applyReceiptFilters({ dateFrom: '' }),
          },
        ]
      : []),
    ...(!activePreset && dateTo
      ? [
          {
            id: 'date-to',
            label: `Đến ngày: ${dateTo}`,
            onClear: () => void applyReceiptFilters({ dateTo: '' }),
          },
        ]
      : []),
  ]

  async function saveSupplierPayment() {
    if (selectedReceipt === null || selectedReceiptOutstanding <= 0) return
    if (supplierPaymentAmount <= 0) {
      setError('Nhập số tiền thanh toán NCC.')
      return
    }
    if (supplierPaymentAmount > selectedReceiptOutstanding) {
      setError('Không được trả vượt số còn nợ của phiếu nhập.')
      return
    }
    if (supplierPaymentMethod === 'bank_transfer' && supplierPaymentFinanceAccountId === '') {
      setError('Chọn tài khoản chuyển khoản trước khi lưu thanh toán NCC.')
      return
    }

    setPosting(true)
    setError(null)
    try {
      await service.paySupplier(selectedReceipt.supplier_id, {
        payment_method: supplierPaymentMethod,
        ...(supplierPaymentMethod === 'bank_transfer' ? { finance_account_id: supplierPaymentFinanceAccountId } : {}),
        allocations: [{ purchase_receipt_id: selectedReceipt.id, amount: supplierPaymentAmount }],
      })
      const detail = await service.getReceipt(selectedReceipt.id)
      setSelectedReceipt(detail)
      setSupplierPaymentOpen(false)
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được thanh toán NCC.'))
    } finally {
      setPosting(false)
    }
  }

  const receiptKpis = (
    <MetricGrid ariaLabel="Tổng quan phiếu nhập">
      <MetricCard hint="Theo bộ lọc hiện tại" label="Tổng tiền hàng" tone="warning" value={<MoneyText value={receiptSummary.payable} />} />
      <MetricCard
        hint="Theo bộ lọc hiện tại"
        label="Tổng nợ"
        tone={receiptSummary.remaining > 0 ? 'warning' : 'neutral'}
        value={<MoneyText value={receiptSummary.remaining} />}
      />
    </MetricGrid>
  )
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = receiptFilterChips.map((chip) => chip.label).join(' • ')

  function receiptDetailContent(ariaLabel: string) {
    const detailTitle = isReadOnly ? 'Xem phiếu nhập' : editingId ? 'Sửa draft phiếu nhập' : 'Tạo draft phiếu nhập'
    const detailStatus = editingStatus ? statusText(editingStatus) : 'Phiếu tạm'
    const selectedReceiptPayments = selectedReceipt ? purchaseReceiptPaymentRows(selectedReceipt) : []
    const hasPaymentHistory = selectedReceiptPayments.length > 0
    const activeReceiptDetailTab = hasPaymentHistory ? receiptDetailTab : 'info'
    const showInfoTab = activeReceiptDetailTab === 'info'

    if (isReadOnly && selectedReceipt) {
      return (
        <ManagementDetailPanel>
          <ManagementInlineDetailTabs
            activeKey={activeReceiptDetailTab}
            ariaLabel="Chi tiết phiếu nhập"
            tabs={[
              { key: 'info', label: 'Thông tin' },
              ...(hasPaymentHistory ? [{ key: 'payments', label: 'Lịch sử thanh toán' }] : []),
            ]}
            onSelect={(key) => {
              setReceiptDetailTab(key === 'payments' ? 'payments' : 'info')
              setSupplierPaymentOpen(false)
            }}
          />
          {showInfoTab ? (
            <>
              <ManagementDetailSummary
                ariaLabel="Tóm tắt phiếu nhập"
                code={selectedReceipt.code}
                metaAriaLabel="Thông tin tạo phiếu nhập"
                metaItems={[
                  { label: 'Người tạo:', value: selectedReceipt.created_by.name },
                  { label: 'Ngày nhập:', value: formatKvDateTime(selectedReceipt.received_at) },
                  { label: 'Trạng thái:', value: detailStatus },
                ]}
                title={(
                  <ManagementRecordLink href={managementRecordOpenHref('/suppliers', selectedReceipt.supplier.code ?? selectedReceipt.supplier.name)}>
                    {selectedReceipt.supplier.name}
                  </ManagementRecordLink>
                )}
              />
              <ManagementDetailSection ariaLabel="Thông tin nhanh phiếu nhập">
                <ManagementDetailInfoList
                  columns="three"
                  items={[
                    { label: 'Nhà cung cấp', value: (
                      <ManagementRecordLink href={managementRecordOpenHref('/suppliers', selectedReceipt.supplier.code ?? selectedReceipt.supplier.name)}>
                        {selectedReceipt.supplier.name}
                      </ManagementRecordLink>
                    ) },
                    { label: 'Số chứng từ NCC', value: selectedReceipt.supplier_document_no ?? '' },
                    { label: 'Còn phải trả', value: money(selectedReceipt.remaining_amount) },
                  ]}
                />
              </ManagementDetailSection>
              <ManagementDetailSection ariaLabel={ariaLabel}>
                <table aria-label="Dòng hàng phiếu nhập" className="management-detail-table management-detail-lines-table">
                  <thead>
                    <tr>
                      <th>Mã hàng</th>
                      <th>Tên hàng</th>
                      <th>Số lượng</th>
                      <th>Đơn vị</th>
                      <th>Đơn giá</th>
                      <th>Giảm giá</th>
                      <th>Giá nhập</th>
                      <th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <ManagementRecordLink href={managementRecordOpenHref('/products', item.product.code)}>
                            {item.product.code}
                          </ManagementRecordLink>
                        </td>
                        <td>
                          <span>{item.product.name}</span>
                          {item.physical_payload ? <small>{physicalSummary(item)}</small> : null}
                        </td>
                        <td>{quantityText(item.quantity)}</td>
                        <td>{item.unit_name_snapshot}</td>
                        <td><MoneyText value={item.unit_cost} /></td>
                        <td><MoneyText value={item.discount_amount} /></td>
                        <td><MoneyText value={item.unit_cost} /></td>
                        <td><MoneyText value={item.line_amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="management-detail-lower management-detail-lower-right">
                  <ManagementDetailNoteInput
                    ariaLabel="Ghi chú phiếu nhập"
                    readOnly
                    value={selectedReceipt.notes?.trim() || ''}
                  />
                  <dl className="management-detail-summary-box management-detail-summary-box-right">
                    <div>
                      <dt>{`Tổng tiền hàng (${selectedReceipt.items.length})`}</dt>
                      <dd><MoneyText value={selectedReceipt.subtotal_amount} /></dd>
                    </div>
                    <div>
                      <dt>Giảm giá phiếu</dt>
                      <dd><MoneyText value={selectedReceipt.discount_amount} /></dd>
                    </div>
                    <div>
                      <dt>Cần trả NCC</dt>
                      <dd><MoneyText value={selectedReceipt.payable_amount} /></dd>
                    </div>
                    <div>
                      <dt>Đã trả NCC</dt>
                      <dd><MoneyText value={selectedReceipt.paid_amount} /></dd>
                    </div>
                    {selectedReceipt.remaining_amount > 0 ? (
                      <div>
                        <dt>Còn phải trả</dt>
                        <dd><MoneyText value={selectedReceipt.remaining_amount} /></dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </ManagementDetailSection>
              <ManagementDetailActionFooter
                leftActions={[
                  ...(selectedReceiptOutstanding > 0
                    ? [{
                        label: 'Thanh toán NCC',
                        icon: <WalletCards aria-hidden="true" size={15} />,
                        variant: 'primary' as const,
                        onClick: openSupplierPaymentForReceipt,
                      }]
                    : []),
                ]}
                rightActions={[
                  { label: 'In', icon: <Printer aria-hidden="true" size={15} />, onClick: () => window.print() },
                ]}
              />
            </>
          ) : null}
          {activeReceiptDetailTab === 'payments' ? (
            <ManagementDetailSection ariaLabel="Lịch sử thanh toán NCC">
              {selectedReceiptPayments.length === 0 ? (
                <ManagementDetailInlineNote>Chưa có thanh toán NCC sau nhập.</ManagementDetailInlineNote>
              ) : (
                <table className="management-detail-table management-detail-linked-table">
                  <thead>
                    <tr>
                      <th>Mã phiếu</th>
                      <th>Thời gian</th>
                      <th>Người tạo</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                      <th>Tiền chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceiptPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <ManagementRecordLink href={managementRecordOpenHref('/finance', payment.code)}>
                            {payment.code}
                          </ManagementRecordLink>
                        </td>
                        <td>{formatKvDateTime(payment.paid_at)}</td>
                        <td>{payment.created_by}</td>
                        <td>{supplierPaymentMethodText(payment.payment_method)}</td>
                        <td>
                          <StatusChip tone={payment.status === 'posted' ? 'success' : 'neutral'}>
                            {supplierPaymentStatusText(payment.status)}
                          </StatusChip>
                        </td>
                        <td><MoneyText value={payment.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {selectedReceiptOutstanding > 0 ? (
                <button className="button button-primary" type="button" onClick={openSupplierPaymentForReceipt}>
                  <WalletCards aria-hidden="true" size={16} />
                  Thanh toán NCC
                </button>
              ) : null}
            </ManagementDetailSection>
          ) : null}
          {supplierPaymentOpen ? (
            <ManagementDetailSection ariaLabel="Thanh toán nhà cung cấp">
              <section role="form" aria-label="Thanh toán nhà cung cấp" className="receipt-payment-box">
                <h3>Thanh toán NCC</h3>
                <p>{selectedReceipt.code}</p>
                <p>Còn nợ: {money(selectedReceiptOutstanding)}</p>
                <label>
                  Số tiền trả cho {selectedReceipt.code}
                  <input
                    min="0"
                    max={selectedReceiptOutstanding}
                    step="1000"
                    type="number"
                    value={supplierPaymentAmount}
                    onChange={(event) => setSupplierPaymentAmount(Number(event.target.value))}
                  />
                </label>
                <label>
                  Phương thức trả NCC
                  <select
                    value={supplierPaymentMethod}
                    onChange={(event) => void changeSupplierPaymentMethod(event.target.value as 'cash' | 'bank_transfer')}
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                  </select>
                </label>
                {supplierPaymentMethod === 'bank_transfer' ? (
                  <label>
                    Tài khoản chuyển khoản NCC
                    <select
                      value={supplierPaymentFinanceAccountId}
                      onChange={(event) => setSupplierPaymentFinanceAccountId(event.target.value)}
                    >
                      <option value="">Chọn tài khoản</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button className="button button-primary" disabled={posting} type="button" onClick={() => void saveSupplierPayment()}>
                  <Banknote aria-hidden="true" size={16} />
                  Lưu thanh toán NCC
                </button>
              </section>
            </ManagementDetailSection>
          ) : null}
        </ManagementDetailPanel>
      )
    }

    return (
      <ManagementDetailPanel>
        {editingId ? (
          <ManagementInlineDetailTabs
            activeKey={activeReceiptDetailTab}
            ariaLabel="Chi tiết phiếu nhập"
            tabs={[
              { key: 'info', label: 'Thông tin' },
              ...(hasPaymentHistory ? [{ key: 'payments', label: 'Lịch sử thanh toán' }] : []),
            ]}
            onSelect={(key) => {
              setReceiptDetailTab(key === 'payments' ? 'payments' : 'info')
              setSupplierPaymentOpen(false)
            }}
          />
        ) : null}
        {showInfoTab ? (
          <>
            <ManagementDetailHeader
              title={detailTitle}
              endAction={(
                <div className="row-actions">
                  {editingId !== null && editingStatus === 'draft' ? (
                    <button className="button button-primary" disabled={posting} type="button" onClick={() => void postReceipt()}>
                      <PackageCheck aria-hidden="true" size={16} />
                      Hoàn thành nhập hàng
                    </button>
                  ) : null}
                  {editingId ? (
                    <button className="button button-secondary" type="button" onClick={resetForm}>
                      <FilePlus2 aria-hidden="true" size={15} />
                      Tạo mới
                    </button>
                  ) : null}
                </div>
              )}
            />
            {selectedReceipt ? (
              <ManagementDetailSummary
                ariaLabel="Tóm tắt phiếu nhập"
                code={selectedReceipt.code}
                metaAriaLabel="Thông tin tạo phiếu nhập"
                metaItems={[
                  { label: 'Người tạo:', value: selectedReceipt.created_by.name },
                  { label: 'Ngày nhập:', value: formatKvDateTime(selectedReceipt.received_at) },
                  { label: 'Trạng thái:', value: detailStatus },
                ]}
                title={(
                  <ManagementRecordLink href={managementRecordOpenHref('/suppliers', selectedReceipt.supplier.code ?? selectedReceipt.supplier.name)}>
                    {selectedReceipt.supplier.name}
                  </ManagementRecordLink>
                )}
              />
            ) : null}
            {selectedReceipt ? (
              <ManagementDetailSection ariaLabel="Thông tin nhanh phiếu nhập">
                <ManagementDetailInfoList
                  columns="four"
                  items={[
                    { label: 'Nhà cung cấp', value: (
                      <ManagementRecordLink href={managementRecordOpenHref('/suppliers', selectedReceipt.supplier.code ?? selectedReceipt.supplier.name)}>
                        {selectedReceipt.supplier.name}
                      </ManagementRecordLink>
                    ) },
                    { label: 'Số chứng từ NCC', value: selectedReceipt.supplier_document_no ?? '' },
                    { label: 'Cần trả NCC', value: money(selectedReceipt.payable_amount) },
                    { label: 'Còn phải trả', value: money(selectedReceipt.remaining_amount) },
                  ]}
                />
                <ManagementDetailInlineNote>{selectedReceipt.notes?.trim() || 'Chưa có ghi chú'}</ManagementDetailInlineNote>
              </ManagementDetailSection>
            ) : null}
            <ManagementDetailSection ariaLabel={ariaLabel}>
              <form aria-label="Thông tin phiếu nhập" className="purchase-receipt-form" onSubmit={saveReceipt}>
                <label>
            Nhà cung cấp
            <select
              required
              disabled={isReadOnly}
              value={form.supplier_id}
              onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}
            >
              <option value="">Chọn NCC</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} - {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thời gian nhập
            <input
              required
              disabled={isReadOnly}
              type="text"
              value={receiptReceivedAtText}
              onChange={(event) => updateReceiptReceivedAtText(event.target.value)}
            />
          </label>
          <label>
            Số chứng từ NCC
            <input
              readOnly={isReadOnly}
              value={form.supplier_document_no}
              onChange={(event) => setForm((current) => ({ ...current, supplier_document_no: event.target.value }))}
            />
          </label>

          <div className="receipt-lines">
            {form.items.map((line, index) => (
              <fieldset key={index}>
                <legend>Dòng {index + 1}</legend>
                <label>
                  Sản phẩm dòng {index + 1}
                  <select
                    required
                    disabled={isReadOnly}
                    value={line.product_id}
                    onChange={(event) => chooseProduct(index, event.target.value)}
                  >
                    <option value="">Chọn hàng</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.code} - {product.name} ({product.inventory_shape === 'roll' ? 'cuộn' : product.inventory_shape === 'sheet' ? 'tấm' : 'thường'})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Đơn vị dòng {index + 1}
                  <input readOnly disabled={isReadOnly} value={line.unit_name} />
                </label>
                <label>
                  Số lượng dòng {index + 1}
                  <input
                    min="0.000001"
                    step="0.000001"
                    type="number"
                    readOnly={isReadOnly || line.inventory_shape !== 'normal'}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                  />
                </label>
                {line.inventory_shape === 'roll' ? (
                  <div className="receipt-physical-box" aria-label={`Thông tin cuộn dòng ${index + 1}`}>
                    {(() => {
                      const payload = rollPayload(line.physical_payload)
                      const firstLength = payload.rolls.lengths_m[0] ?? 1
                      return (
                        <>
                          <label>
                            Khổ rộng cuộn dòng {index + 1}
                            <input
                              min="0.001"
                              step="0.001"
                              type="number"
                              readOnly={isReadOnly}
                              value={payload.rolls.width_m}
                              onChange={(event) => updateRollPayload(index, { width_m: Number(event.target.value) })}
                            />
                          </label>
                          <label>
                            Số cuộn cùng quy cách dòng {index + 1}
                            <input
                              min="1"
                              step="1"
                              type="number"
                              readOnly={isReadOnly}
                              value={payload.rolls.lengths_m.length}
                              onChange={(event) => {
                                const count = Math.max(Math.floor(Number(event.target.value) || 0), 0)
                                const lengths = Array.from({ length: count }, () => firstLength || 1)
                                setRollLengthTexts((current) => ({ ...current, [index]: lengths.join(', ') }))
                                updateRollPayload(index, { lengths_m: lengths })
                              }}
                            />
                          </label>
                          <label>
                            Chiều dài mỗi cuộn dòng {index + 1}
                            <input
                              min="0.001"
                              step="0.001"
                              type="number"
                              readOnly={isReadOnly}
                              value={firstLength}
                              onChange={(event) => {
                                const length = Number(event.target.value)
                                const lengths = payload.rolls.lengths_m.map(() => length)
                                setRollLengthTexts((current) => ({ ...current, [index]: lengths.join(', ') }))
                                updateRollPayload(index, { lengths_m: lengths })
                              }}
                            />
                          </label>
                          <label>
                            Chiều dài từng cuộn dòng {index + 1}
                            <textarea
                              readOnly={isReadOnly}
                              value={rollLengthTexts[index] ?? payload.rolls.lengths_m.join(', ')}
                              onChange={(event) => {
                                const text = event.target.value
                                setRollLengthTexts((current) => ({ ...current, [index]: text }))
                                const lengths = text
                                  .split(',')
                                  .map((value) => Number(value.trim()))
                                  .filter((value) => Number.isFinite(value) && value > 0)
                                updateRollPayload(index, { lengths_m: lengths })
                              }}
                            />
                          </label>
                          <p className="physical-summary">{physicalSummary(line)}</p>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                {line.inventory_shape === 'sheet' ? (
                  <div className="receipt-physical-box" aria-label={`Thông tin tấm dòng ${index + 1}`}>
                    {sheetPayload(line.physical_payload).sheet_groups.map((group, groupIndex) => (
                      <fieldset key={groupIndex}>
                        <legend>Nhóm tấm {groupIndex + 1}</legend>
                        <label>
                          Rộng nhóm {groupIndex + 1} dòng {index + 1}
                          <input
                            min="0.001"
                            step="0.001"
                            type="number"
                            readOnly={isReadOnly}
                            value={group.width_m}
                            onChange={(event) => updateSheetPayload(index, groupIndex, { width_m: Number(event.target.value) })}
                          />
                        </label>
                        <label>
                          Dài nhóm {groupIndex + 1} dòng {index + 1}
                          <input
                            min="0.001"
                            step="0.001"
                            type="number"
                            readOnly={isReadOnly}
                            value={group.length_m}
                            onChange={(event) => updateSheetPayload(index, groupIndex, { length_m: Number(event.target.value) })}
                          />
                        </label>
                        <label>
                          Số tấm nhóm {groupIndex + 1} dòng {index + 1}
                          <input
                            min="1"
                            step="1"
                            type="number"
                            readOnly={isReadOnly}
                            value={group.quantity}
                            onChange={(event) => updateSheetPayload(index, groupIndex, { quantity: Math.max(Math.floor(Number(event.target.value) || 0), 0) })}
                          />
                        </label>
                        {isReadOnly ? null : (
                          <button className="button button-danger" type="button" onClick={() => removeSheetGroup(index, groupIndex)}>
                            <Trash2 aria-hidden="true" size={15} />
                            Xóa nhóm tấm {groupIndex + 1}
                          </button>
                        )}
                      </fieldset>
                    ))}
                    <p className="physical-summary">{physicalSummary(line)}</p>
                    {isReadOnly ? null : (
                      <button className="button button-secondary" type="button" onClick={() => addSheetGroup(index)}>
                        <Plus aria-hidden="true" size={15} />
                        Thêm nhóm kích thước
                      </button>
                    )}
                  </div>
                ) : null}
                <label>
                  Đơn giá dòng {index + 1}
                  <input
                    min="0"
                    step="1000"
                    type="number"
                    readOnly={isReadOnly}
                    value={line.unit_cost}
                    onChange={(event) => updateLine(index, { unit_cost: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Giảm giá dòng {index + 1}
                  <input
                    min="0"
                    step="1000"
                    type="number"
                    readOnly={isReadOnly}
                    value={line.discount_amount}
                    onChange={(event) => updateLine(index, { discount_amount: Number(event.target.value) })}
                  />
                </label>
                <p>Thành tiền: {money(lineAmount(line))}</p>
                {isReadOnly ? null : (
                  <button className="button button-danger" type="button" onClick={() => removeLine(index)}>
                    <Trash2 aria-hidden="true" size={15} />
                    Xóa dòng
                  </button>
                )}
              </fieldset>
            ))}
            {isReadOnly ? null : (
              <button className="button button-secondary" type="button" onClick={addLine}>
                <Plus aria-hidden="true" size={15} />
                Thêm dòng
              </button>
            )}
          </div>

          <label>
            Giảm giá phiếu
            <input
              min="0"
              step="1000"
              type="number"
              readOnly={isReadOnly}
              value={form.discount_amount}
              onChange={(event) => setForm((current) => ({ ...current, discount_amount: Number(event.target.value) }))}
            />
          </label>
          <label>
            Đã trả tạm
            <input
              min="0"
              step="1000"
              type="number"
              readOnly={isReadOnly}
              value={form.paid_amount}
              onChange={(event) => setForm((current) => ({ ...current, paid_amount: Number(event.target.value) }))}
            />
          </label>
          <label>
            Ghi chú
            <textarea
              readOnly={isReadOnly}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <div className="receipt-total-box">
            <p>Tổng tiền hàng: {money(totals.subtotal)}</p>
            <p>Cần trả NCC: {money(totals.payable)}</p>
            <p>Còn phải trả: {money(totals.remaining)}</p>
          </div>
          {lowCostWarnings.length > 0 ? (
            <div role="alert" className="receipt-warning-box">
              {lowCostWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {editingId !== null && editingStatus === 'draft' && Number(form.paid_amount || 0) > 0 ? (
            <div className="receipt-payment-box">
              <label>
                Phương thức trả ngay
                <select
                  value={paymentMethod}
                  onChange={(event) => void changeImmediatePaymentMethod(event.target.value as 'cash' | 'bank_transfer')}
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                </select>
              </label>
              {paymentMethod === 'bank_transfer' ? (
                <label>
                  Tài khoản chuyển khoản
                  <select value={financeAccountId} onChange={(event) => setFinanceAccountId(event.target.value)}>
                    <option value="">Chọn tài khoản</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {isReadOnly ? null : (
            <button className="button button-secondary" disabled={saving} type="submit">
              <Save aria-hidden="true" size={16} />
              Lưu draft phiếu nhập
            </button>
          )}
              </form>
            </ManagementDetailSection>
          </>
        ) : null}
        {activeReceiptDetailTab === 'payments' && selectedReceipt ? (
          <ManagementDetailSection ariaLabel="Lịch sử thanh toán NCC">
            {selectedReceiptPayments.length === 0 ? (
              <ManagementDetailInlineNote>Chưa có thanh toán NCC sau nhập.</ManagementDetailInlineNote>
            ) : (
              <table className="management-detail-table management-detail-linked-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Thời gian</th>
                    <th>Người tạo</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                    <th>Tiền chi</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceiptPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <ManagementRecordLink href={managementRecordOpenHref('/finance', payment.code)}>
                          {payment.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{formatKvDateTime(payment.paid_at)}</td>
                      <td>{payment.created_by}</td>
                      <td>{supplierPaymentMethodText(payment.payment_method)}</td>
                      <td>
                        <StatusChip tone={payment.status === 'posted' ? 'success' : 'neutral'}>
                          {supplierPaymentStatusText(payment.status)}
                        </StatusChip>
                      </td>
                      <td><MoneyText value={payment.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {selectedReceiptOutstanding > 0 ? (
              <button className="button button-primary" type="button" onClick={openSupplierPaymentForReceipt}>
                <WalletCards aria-hidden="true" size={16} />
                Thanh toán NCC
              </button>
            ) : null}
          </ManagementDetailSection>
        ) : null}
        {supplierPaymentOpen && selectedReceipt ? (
          <ManagementDetailSection ariaLabel="Thanh toán nhà cung cấp">
            <section role="form" aria-label="Thanh toán nhà cung cấp" className="receipt-payment-box">
              <h3>Thanh toán NCC</h3>
              <p>{selectedReceipt.code}</p>
              <p>Còn nợ: {money(selectedReceiptOutstanding)}</p>
              <label>
                Số tiền trả cho {selectedReceipt.code}
                <input
                  min="0"
                  max={selectedReceiptOutstanding}
                  step="1000"
                  type="number"
                  value={supplierPaymentAmount}
                  onChange={(event) => setSupplierPaymentAmount(Number(event.target.value))}
                />
              </label>
              <label>
                Phương thức trả NCC
                <select
                  value={supplierPaymentMethod}
                  onChange={(event) => void changeSupplierPaymentMethod(event.target.value as 'cash' | 'bank_transfer')}
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                </select>
              </label>
              {supplierPaymentMethod === 'bank_transfer' ? (
                <label>
                  Tài khoản chuyển khoản NCC
                  <select
                    value={supplierPaymentFinanceAccountId}
                    onChange={(event) => setSupplierPaymentFinanceAccountId(event.target.value)}
                  >
                    <option value="">Chọn tài khoản</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="button button-primary" disabled={posting} type="button" onClick={() => void saveSupplierPayment()}>
                <Banknote aria-hidden="true" size={16} />
                Lưu thanh toán NCC
              </button>
            </section>
          </ManagementDetailSection>
        ) : null}
      </ManagementDetailPanel>
    )
  }

  function renderCreateReceiptWorkspace() {
    return (
      <section aria-label="Tạo phiếu nhập" className="purchase-receipt-workspace" role="region">
        <form
          aria-label="Thông tin phiếu nhập"
          className={`purchase-receipt-workspace-form${receiptWorkspaceSideCollapsed ? ' purchase-receipt-workspace-form-side-collapsed' : ''}`}
          onSubmit={saveReceipt}
        >
          <div className="purchase-receipt-workspace-main">
            {receiptWorkspaceLookupLoading ? <ManagementLoadingOverlay label="Đang tải dữ liệu phiếu nhập..." /> : null}
            <div className="management-table-viewport purchase-receipt-workspace-table-wrap">
              {form.items.length === 0 ? (
                null
              ) : (
                <ul aria-label="Dòng hàng phiếu nhập mới" className="pos-cart-lines purchase-receipt-line-cards">
                  <li aria-label="Cột dòng hàng nhập" className="pos-cart-line-heading purchase-receipt-line-heading">
                    <div className="pos-cart-line-header pos-cart-line-header-static purchase-receipt-line-card-header">
                      <span>STT</span>
                      <span>Mã hàng</span>
                      <span>Tên hàng</span>
                      <span>ĐVT</span>
                      <span>Số lượng</span>
                      <span>Đơn giá</span>
                      <span>Giảm giá</span>
                      <span>Thành tiền</span>
                    </div>
                  </li>
                  {form.items.map((line, index) => {
                    const selectedProduct = products.find((product) => product.id === line.product_id)
                    return (
                      <li
                        key={`${line.product_id || 'line'}-${index}`}
                        aria-label={`Dòng hàng nhập ${index + 1}`}
                        className="pos-cart-line-shell purchase-receipt-line-card"
                      >
                        <div className="pos-cart-line purchase-receipt-line-card-row">
                          <span className="pos-cart-line-index">{index + 1}</span>
                          <span className="purchase-receipt-line-code">{selectedProduct?.code ?? line.product_id}</span>
                          <div className="pos-cart-line-name">
                            <strong>{selectedProduct?.name ?? 'Hàng hóa'}</strong>
                          </div>
                          <input aria-label={`Đơn vị dòng ${index + 1}`} className="pos-cart-line-unit-select" readOnly value={line.unit_name} />
                          <div className="pos-cart-line-quantity">
                            <input
                              aria-label={`Số lượng dòng ${index + 1}`}
                              min="0.000001"
                              readOnly={line.inventory_shape !== 'normal'}
                              step="0.000001"
                              type="number"
                              value={line.quantity}
                              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                            />
                          </div>
                          <div className="pos-cart-line-price">
                            <input
                              aria-label={`Đơn giá dòng ${index + 1}`}
                              min="0"
                              step="1000"
                              type="number"
                              value={line.unit_cost}
                              onChange={(event) => updateLine(index, { unit_cost: Number(event.target.value) })}
                            />
                          </div>
                          <div className="pos-cart-line-price purchase-receipt-line-discount">
                            <input
                              aria-label={`Giảm giá dòng ${index + 1}`}
                              min="0"
                              step="1000"
                              type="number"
                              value={line.discount_amount}
                              onChange={(event) => updateLine(index, { discount_amount: Number(event.target.value) })}
                            />
                          </div>
                          <strong className="pos-cart-line-total">{money(lineAmount(line))}</strong>
                        </div>
                        <button
                          aria-label={`Xóa dòng ${index + 1}`}
                          className="pos-cart-line-remove"
                          type="button"
                          onClick={() => removeLine(index)}
                        >
                          ×
                        </button>
                        {line.inventory_shape === 'roll' ? (() => {
                          const payload = rollPayload(line.physical_payload)
                          const firstLength = payload.rolls.lengths_m[0] ?? 1
                          return (
                            <div className="receipt-physical-box purchase-receipt-line-physical" aria-label={`Thông tin cuộn dòng ${index + 1}`}>
                              <label>
                                Khổ rộng cuộn dòng {index + 1}
                                <input
                                  min="0.001"
                                  step="0.001"
                                  type="number"
                                  value={payload.rolls.width_m}
                                  onChange={(event) => updateRollPayload(index, { width_m: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Số cuộn cùng quy cách dòng {index + 1}
                                <input
                                  min="1"
                                  step="1"
                                  type="number"
                                  value={payload.rolls.lengths_m.length}
                                  onChange={(event) => {
                                    const count = Math.max(Math.floor(Number(event.target.value) || 0), 0)
                                    const lengths = Array.from({ length: count }, () => firstLength || 1)
                                    setRollLengthTexts((current) => ({ ...current, [index]: lengths.join(', ') }))
                                    updateRollPayload(index, { lengths_m: lengths })
                                  }}
                                />
                              </label>
                              <label>
                                Chiều dài mỗi cuộn dòng {index + 1}
                                <input
                                  min="0.001"
                                  step="0.001"
                                  type="number"
                                  value={firstLength}
                                  onChange={(event) => {
                                    const length = Number(event.target.value)
                                    const lengths = payload.rolls.lengths_m.map(() => length)
                                    setRollLengthTexts((current) => ({ ...current, [index]: lengths.join(', ') }))
                                    updateRollPayload(index, { lengths_m: lengths })
                                  }}
                                />
                              </label>
                              <label>
                                Chiều dài từng cuộn dòng {index + 1}
                                <textarea
                                  value={rollLengthTexts[index] ?? payload.rolls.lengths_m.join(', ')}
                                  onChange={(event) => {
                                    const text = event.target.value
                                    setRollLengthTexts((current) => ({ ...current, [index]: text }))
                                    const lengths = text
                                      .split(',')
                                      .map((value) => Number(value.trim()))
                                      .filter((value) => Number.isFinite(value) && value > 0)
                                    updateRollPayload(index, { lengths_m: lengths })
                                  }}
                                />
                              </label>
                              <p className="physical-summary">{physicalSummary(line)}</p>
                            </div>
                          )
                        })() : null}
                        {line.inventory_shape === 'sheet' ? (
                          <div className="receipt-physical-box purchase-receipt-line-physical" aria-label={`Thông tin tấm dòng ${index + 1}`}>
                            {sheetPayload(line.physical_payload).sheet_groups.map((group, groupIndex) => (
                              <fieldset key={groupIndex}>
                                <legend>Nhóm tấm {groupIndex + 1}</legend>
                                <label>
                                  Rộng nhóm {groupIndex + 1} dòng {index + 1}
                                  <input
                                    min="0.001"
                                    step="0.001"
                                    type="number"
                                    value={group.width_m}
                                    onChange={(event) => updateSheetPayload(index, groupIndex, { width_m: Number(event.target.value) })}
                                  />
                                </label>
                                <label>
                                  Dài nhóm {groupIndex + 1} dòng {index + 1}
                                  <input
                                    min="0.001"
                                    step="0.001"
                                    type="number"
                                    value={group.length_m}
                                    onChange={(event) => updateSheetPayload(index, groupIndex, { length_m: Number(event.target.value) })}
                                  />
                                </label>
                                <label>
                                  Số tấm nhóm {groupIndex + 1} dòng {index + 1}
                                  <input
                                    min="1"
                                    step="1"
                                    type="number"
                                    value={group.quantity}
                                    onChange={(event) => updateSheetPayload(index, groupIndex, { quantity: Math.max(Math.floor(Number(event.target.value) || 0), 0) })}
                                  />
                                </label>
                                <button className="button button-danger" type="button" onClick={() => removeSheetGroup(index, groupIndex)}>
                                  <Trash2 aria-hidden="true" size={15} />
                                  Xóa nhóm tấm {groupIndex + 1}
                                </button>
                              </fieldset>
                            ))}
                            <p className="physical-summary">{physicalSummary(line)}</p>
                            <button className="button button-secondary" type="button" onClick={() => addSheetGroup(index)}>
                              <Plus aria-hidden="true" size={15} />
                              Thêm nhóm kích thước
                            </button>
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {receiptWorkspaceSideCollapsed ? (
            <div className="management-filter-rail purchase-receipt-workspace-side-rail">
              <button
                aria-label="Mở thông tin phiếu nhập"
                className="management-filter-expand-button"
                type="button"
                onClick={() => setReceiptWorkspaceSideCollapsed(false)}
              >
                <ChevronLeft aria-hidden="true" size={18} />
              </button>
            </div>
          ) : (
            <aside className="management-filter-sidebar purchase-receipt-workspace-side" aria-label="Thông tin phiếu nhập bên phải">
              <button
                aria-label="Ẩn thông tin phiếu nhập"
                className="management-filter-collapse-button"
                type="button"
                onClick={() => setReceiptWorkspaceSideCollapsed(true)}
              >
                <ChevronRight aria-hidden="true" size={18} />
              </button>
              <div className="purchase-receipt-workspace-side-body">
                <div className="purchase-receipt-workspace-side-top-row">
                  <div className="purchase-receipt-workspace-account-field" aria-label="Tài khoản">
                    <div className="purchase-receipt-workspace-account-display">{accountDisplayName(currentUser)}</div>
                  </div>
                  <div className="purchase-receipt-workspace-time-field">
                    <input
                      aria-label="Thời gian nhập"
                      required
                      type="text"
                      value={receiptReceivedAtText}
                      onChange={(event) => updateReceiptReceivedAtText(event.target.value)}
                    />
                  </div>
                </div>
                <label>
                  Mã phiếu nhập
                  <input
                    placeholder="Mã phiếu tự động"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  />
                </label>
                <label>
                  Số hóa đơn đầu vào
                  <input
                    value={form.supplier_document_no}
                    onChange={(event) => setForm((current) => ({ ...current, supplier_document_no: event.target.value }))}
                  />
                </label>
                <label>
                  Giảm giá phiếu
                  <input
                    min="0"
                    step="1000"
                    type="number"
                    value={form.discount_amount}
                    onChange={(event) => setForm((current) => ({ ...current, discount_amount: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Đã trả tạm
                  <input
                    min="0"
                    step="1000"
                    type="number"
                    value={form.paid_amount}
                    onChange={(event) => setForm((current) => ({ ...current, paid_amount: Number(event.target.value) }))}
                  />
                </label>
                <dl className="purchase-receipt-workspace-totals">
                  <div>
                    <dt>Tổng tiền hàng</dt>
                    <dd>{money(totals.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Giảm giá</dt>
                    <dd>{money(form.discount_amount)}</dd>
                  </div>
                  <div>
                    <dt>Tổng nợ</dt>
                    <dd>{money(totals.remaining)}</dd>
                  </div>
                </dl>
                <label>
                  Ghi chú
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
                {lowCostWarnings.length > 0 ? (
                  <div role="alert" className="receipt-warning-box">
                    {lowCostWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
              </div>
              <footer className="management-filter-actions purchase-receipt-workspace-actions">
                <button className="button button-secondary" disabled={saving} type="submit">
                  <Save aria-hidden="true" size={16} />
                  Lưu tạm
                </button>
                <button className="button button-primary" disabled={saving || posting} type="submit">
                  <PackageCheck aria-hidden="true" size={16} />
                  Hoàn thành
                </button>
              </footer>
            </aside>
          )}
        </form>
      </section>
    )
  }

  function receiptDetailLoading(ariaLabel: string) {
    return (
      <ManagementDetailPanel>
        <ManagementDetailSection ariaLabel={ariaLabel}>
          <ManagementDetailInlineNote>Đang tải chi tiết phiếu nhập...</ManagementDetailInlineNote>
        </ManagementDetailSection>
      </ManagementDetailPanel>
    )
  }

  return (
    <ManagementPage
      className={`purchase-receipts-page${isCreatingReceipt ? ' purchase-receipts-page-create' : ''}`}
      title={isCreatingReceipt ? 'Nhập hàng' : 'Phiếu nhập'}
      titlePrefix={isCreatingReceipt ? (
        <button
          aria-label="Quay lại danh sách phiếu nhập"
          className="management-page-title-back"
          type="button"
          onClick={closeCreateReceipt}
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
      ) : undefined}
      actions={isCreatingReceipt ? (
        <div ref={receiptProductSearchToolbarRef}>
          <ManagementCompactToolbar
          ariaLabel="Tìm hàng nhập"
          className="purchase-receipt-product-search-toolbar"
          onSubmit={submitReceiptProductSearch}
        >
          <label className="management-compact-search pos-topbar-search-control">
            <span className="pos-topbar-search-label">Tìm hàng (F3)</span>
            <span className="management-compact-search-leading">
              <Search aria-hidden="true" size={16} />
            </span>
            <input
              ref={receiptProductSearchRef}
              value={receiptProductSearch}
              placeholder="Tìm hàng hóa theo mã hoặc tên"
              onChange={(event) => setReceiptProductSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setReceiptProductSearch('')
                  return
                }
                if (event.key !== 'Enter') return
                const firstSuggestion = receiptProductSuggestions[0]
                if (firstSuggestion === undefined) return
                event.preventDefault()
                selectReceiptProduct(firstSuggestion.id)
              }}
            />
            <span className="management-compact-search-trailing">
              <button
                aria-label={receiptProductSearch.trim().length > 0 ? 'Xóa tìm kiếm' : 'Tạo hàng hóa'}
                className={`management-compact-create-action pos-search-add-button${receiptProductSearch.trim().length > 0 ? ' management-compact-create-action-clear' : ''}`}
                title={receiptProductSearch.trim().length > 0 ? 'Xóa tìm kiếm' : 'Tạo hàng hóa'}
                type="button"
                onClick={() => {
                  if (receiptProductSearch.trim().length > 0) {
                    setReceiptProductSearch('')
                    return
                  }
                  setProductCreateOpen(true)
                }}
              >
                <Plus aria-hidden="true" size={18} />
              </button>
            </span>
          </label>
          {receiptProductSearch.trim().length > 0 ? (
            <ul aria-label="Kết quả tìm hàng" className="pos-search-results purchase-receipt-product-search-results" role="listbox">
              {receiptProductSuggestions.length > 0 ? (
                receiptProductSuggestions.map((suggestion) => {
                  const product = products.find((candidate) => candidate.id === suggestion.id)
                  const price = product?.latest_purchase_cost ?? 0
                  return (
                    <li key={suggestion.id}>
                      <button
                        role="option"
                        aria-selected="false"
                        type="button"
                        onClick={() => selectReceiptProduct(suggestion.id)}
                      >
                        <strong>{suggestion.primary}</strong>
                        <span>{suggestion.secondary}</span>
                        <span>{suggestion.meta ?? money(price)}</span>
                      </button>
                    </li>
                  )
                })
              ) : (
                <li role="option" aria-selected="false">
                  Không tìm thấy hàng hóa phù hợp
                </li>
              )}
            </ul>
          ) : null}
          </ManagementCompactToolbar>
        </div>
      ) : (
        <ManagementCompactToolbar ariaLabel="Lọc phiếu nhập" onSubmit={filterReceipts}>
          <ManagementCompactSearch
            label="Tìm phiếu/NCC"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Tìm mã phiếu, NCC"
            trailingAction={
              <ManagementCompactCreateAction ariaLabel="Tạo phiếu nhập" onClick={() => void openCreateReceipt()} />
            }
            value={search}
            onChange={changeReceiptSearch}
          />
          <ManagementImportButton onClick={() => setImportOpen(true)}>Import</ManagementImportButton>
        </ManagementCompactToolbar>
      )}
      kpis={receiptKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary || undefined}
          ariaLabel="Bộ lọc phiếu nhập"
          onPopoverClose={() => setReceiptQuickTimeOpen(false)}
          popoverOpen={receiptQuickTimeOpen}
          title="Bộ lọc"
        >
          <button
            aria-label="Ẩn bộ lọc phiếu nhập"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <ManagementFilterGroup title="Trạng thái">
            <select
              aria-label="Trạng thái"
              className="management-filter-select"
              value={status}
              onChange={(event) =>
                void applyReceiptFilters({ status: event.target.value as PurchaseReceiptStatus | 'all', preset: null })
              }
            >
              <option value="posted">Đã nhập hàng</option>
              <option value="draft">Phiếu tạm</option>
              <option value="cancelled">Đã hủy</option>
              <option value="all">Tất cả</option>
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Thời gian">
            <div className="management-filter-time-options">
              <button
                aria-expanded={receiptQuickTimeOpen}
                className="management-filter-choice management-filter-time-trigger"
                type="button"
                onClick={() => setReceiptQuickTimeOpen((current) => !current)}
              >
                <span>{selectedReceiptTimeLabel}</span>
                <span className="management-filter-choice-trailing">
                  <ChevronRight aria-hidden="true" size={17} />
                </span>
              </button>
            </div>
            {receiptQuickTimeOpen ? (
              <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                <section>
                  <h3>Chọn nhanh</h3>
                  <div>
                    {receiptTimeQuickOptions.map((option) => (
                      <button
                        className={selectedTimeQuickOption === option.id ? 'management-filter-quick-time-active' : undefined}
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setReceiptQuickTimeOpen(false)
                          void applyReceiptFilters({ dateFrom: option.from, dateTo: option.to, preset: null })
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
            <ManagementDateRangeInputs
              displayFrom={receiptVisibleDateRange.from}
              displayTo={receiptVisibleDateRange.to}
              from={dateFrom}
              to={dateTo}
              onCalendarOpen={() => setReceiptQuickTimeOpen(false)}
              onFromChange={(value) => void applyReceiptFilters({ dateFrom: value, preset: null })}
              onToChange={(value) => void applyReceiptFilters({ dateTo: value, preset: null })}
            />
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Người tạo">
            <select
              aria-label="Người tạo"
              className="management-filter-select"
              value={createdBy}
              onChange={(event) => void applyReceiptFilters({ createdBy: event.target.value, preset: null })}
            >
              <option value="all">Tất cả người tạo</option>
              {creatorOptions.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Số hóa đơn đầu vào">
            <input
              aria-label="Số hóa đơn đầu vào"
              className="management-filter-select"
              placeholder="Theo số hóa đơn đầu vào"
              type="search"
              value={search}
              onChange={(event) => void applyReceiptFilters({ search: event.target.value, preset: null })}
            />
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters && !isCreatingReceipt}
      filterCollapsedControl={!isCreatingReceipt ? (
        <button
          aria-label="Mở bộ lọc phiếu nhập"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      ) : undefined}
    >
      {error ? <p role="alert">{error}</p> : null}
      {receipts === null && error === null && !isCreatingReceipt ? <p>Đang tải phiếu nhập...</p> : null}
      {isCreatingReceipt ? renderCreateReceiptWorkspace() : null}
      {!isCreatingReceipt && receipts ? (
        <ManagementListSurface ariaLabel="Danh sách phiếu nhập">
            <>
              {receipts.length === 0 ? (
                <EmptyState>
                  <p>Không có phiếu nhập phù hợp. Thử mở rộng ngày hoặc trạng thái.</p>
                </EmptyState>
              ) : (
                <ManagementTableViewport>
                  <ManagementDataTable
                    ariaLabel="Danh sách phiếu nhập"
                    columns={[
                      {
                        key: 'select',
                        className: 'finance-cashbook-select-column',
                        header: <ManagementTableCheckboxControl ariaLabel="Chọn tất cả phiếu nhập" />,
                        cell: (receipt) => (
                          <ManagementTableCheckboxControl
                            ariaLabel={`Chọn phiếu nhập ${receipt.code}`}
                            onClick={(event) => event.stopPropagation()}
                          />
                        ),
                      },
                      {
                        key: 'favorite',
                        className: 'finance-cashbook-star-column',
                        header: (
                          <ManagementTableFavoriteButton
                            active={showFavoriteReceiptsOnly}
                            ariaLabel={showFavoriteReceiptsOnly ? 'Hiện tất cả phiếu nhập' : 'Chỉ hiện phiếu nhập ưu tiên'}
                            onClick={() => setShowFavoriteReceiptsOnly(!showFavoriteReceiptsOnly)}
                          />
                        ),
                        cell: (receipt) => (
                          <ManagementTableFavoriteButton
                            active={favoriteReceiptIds.includes(receipt.id)}
                            ariaLabel={favoriteReceiptIds.includes(receipt.id) ? `Bỏ ưu tiên ${receipt.code}` : `Đánh dấu ưu tiên ${receipt.code}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleReceiptFavorite(receipt)
                            }}
                          />
                        ),
                      },
                      {
                        key: 'code',
                        header: <ManagementSortableHeader kind="text" sortKey="code" sortState={receiptSortState} onSort={requestReceiptSort}>Mã nhập hàng</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => (
                          <button
                            className="management-link-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void openReceipt(receipt)
                            }}
                          >
                            <strong>{receipt.code}</strong>
                          </button>
                        ),
                      },
                      {
                        key: 'supplier-name',
                        header: <ManagementSortableHeader kind="text" sortKey="supplier_name" sortState={receiptSortState} onSort={requestReceiptSort}>Nhà cung cấp</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => receipt.supplier.name,
                      },
                      {
                        key: 'total-quantity',
                        header: <ManagementSortableHeader kind="number" sortKey="total_quantity" sortState={receiptSortState} onSort={requestReceiptSort}>Số lượng</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => quantityText(receiptTotalQuantity(receipt)),
                      },
                      {
                        key: 'subtotal',
                        header: <ManagementSortableHeader kind="number" sortKey="subtotal_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Thành tiền</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.subtotal_amount} />,
                      },
                      {
                        key: 'payable',
                        header: <ManagementSortableHeader kind="number" sortKey="payable_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Cần trả</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.payable_amount} />,
                      },
                      {
                        key: 'paid',
                        header: <ManagementSortableHeader kind="number" sortKey="paid_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Đã trả</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.paid_amount} />,
                      },
                    ]}
                    getDetailLabel={(receipt) => `Chi tiết phiếu nhập ${receipt.code}`}
                    getRowKey={(receipt) => receipt.id}
                    items={visibleReceipts}
                    renderDetail={(receipt) => (
                      loadingReceiptId === receipt.id
                        ? receiptDetailLoading(`Đang tải chi tiết ${receipt.code}`)
                        : receiptDetailContent(`Nội dung chi tiết ${receipt.code}`)
                    )}
                    selectedRowKey={loadingReceiptId ?? editingId}
                    onRowClick={(receipt) => void openReceipt(receipt)}
                    onRowKeyDown={(receipt, event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void openReceipt(receipt)
                      }
                    }}
                  />
                </ManagementTableViewport>
              )}
              <ManagementTableFooter
                ariaLabel="Phân trang phiếu nhập"
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                entityLabel="phiếu nhập"
                page={page}
                pageSize={pageSize}
                total={total}
                onFirst={() => void goToPage(1)}
                onLast={() => void goToPage(totalPages)}
                onNext={() => void goToPage(page + 1)}
                onPageSizeChange={(nextPageSize) => void loadReceipts({ page: 1, page_size: nextPageSize })}
                onPrevious={() => void goToPage(page - 1)}
              />
            </>
        </ManagementListSurface>
      ) : null}
      <PurchaseReceiptImportDialog
        open={importOpen}
        service={service}
        onClose={() => setImportOpen(false)}
        onImported={() => void loadReceipts({ page: 1, page_size: pageSize })}
        onOldDataDeleted={() => void loadReceipts({ page: 1, page_size: pageSize })}
      />
      {productCreateOpen ? (
        <aside aria-label="Tạo hàng hóa" className="pos-product-create-popover">
          <form onSubmit={createReceiptProduct}>
            <header>
              <h2>Tạo hàng hóa</h2>
              <button
                aria-label="Đóng tạo hàng hóa"
                type="button"
                onClick={() => {
                  setProductCreateOpen(false)
                  setProductCreateError(null)
                }}
              >
                ×
              </button>
            </header>
            {productCreateError ? <p role="alert">{productCreateError}</p> : null}
            <label>
              Mã hàng
              <input
                value={productCreateForm.code}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, code: event.target.value }))}
              />
            </label>
            <label>
              Tên hàng
              <input
                required
                value={productCreateForm.name}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Đơn vị
              <input
                required
                value={productCreateForm.unitName}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, unitName: event.target.value }))}
              />
            </label>
            <label>
              Loại bán
              <select
                value={productCreateForm.sellMethod}
                onChange={(event) => setProductCreateForm((current) => ({
                  ...current,
                  sellMethod: event.target.value as PurchaseReceiptProduct['sell_method'],
                }))}
              >
                <option value="quantity">Theo số lượng</option>
                <option value="area_m2">Theo m2</option>
                <option value="linear_m">Theo mét dài</option>
                <option value="sheet">Theo tấm</option>
              </select>
            </label>
            <button className="button button-primary" disabled={productCreateSaving} type="submit">
              Thêm hàng hóa
            </button>
          </form>
        </aside>
      ) : null}
    </ManagementPage>
  )
}
