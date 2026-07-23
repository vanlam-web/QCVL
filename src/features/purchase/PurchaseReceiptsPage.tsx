import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, FileOutput, FilePlus2, PackageCheck, Plus, Search } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { dateTimeLocalInputValue, formatQcvDateTime, parseQcvDateTimeInputToStoredIso } from '../../lib/date-format'
import { parseMoneyInput } from '../../lib/number-format'
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
import type { SupplierInput } from './supplier-service'
import type { Supplier } from './types'
import {
  defaultPhysicalPayload,
  physicalSummary,
  purchaseReceiptListSummary,
  purchaseReceiptTotals,
  purchaseUnitForProduct,
  receiptTotalQuantity,
  receiptOutstandingAfterPost,
  rollPayload,
  sheetGroupQuantity,
  sheetPayload,
} from './purchase-receipt-calculations'
import { purchaseReceiptTimeQuickOptions } from './purchase-receipt-filters'
import { isExactPurchaseReceiptCode, money, quantityText, statusText } from './purchase-receipt-presenter'
import { ManagementRecordLink, MetricCard, MetricGrid, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementConfirmDialog,
  ManagementDateRangeInputs,
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
  ManagementPage,
} from '../../components/ui-shell/management-layout'
import { normalizeManagementSearchText, preventManagementSearchSubmit } from '../../components/ui-shell/management-search'
import { managementSortStatesEqual, sortManagementItemsByDateDesc, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { downloadManagementCsv } from '../../components/ui-shell/management-export'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { quickPickDefaultPage, quickPickDefaultPageSize, quickPickSearchContext } from '../../lib/search-contract'
import { useManagementSearch } from '../../lib/use-management-search'
import { useQuickPickSearch } from '../../lib/use-quick-pick-search'
import { PurchaseReceiptImportDialog } from './PurchaseReceiptImportDialog'
import { PurchaseReceiptPaymentHistory } from './PurchaseReceiptPaymentHistory'
import { PurchaseReceiptList, type PurchaseReceiptSortKey } from './PurchaseReceiptList'
import { PurchaseReceiptForm } from './PurchaseReceiptForm'
import { PurchaseReceiptCreateWorkspace } from './PurchaseReceiptCreateWorkspace'
import type { PurchaseReceiptUnitChoice } from './purchase-receipt-unit-choices'
import { PurchaseReceiptSupplierPaymentForm } from './PurchaseReceiptSupplierPaymentForm'
import { PurchaseReceiptActionFooter } from './PurchaseReceiptActionFooter'
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
  return formatQcvDateTime(value, '')
}

function parseReceiptDateTimeInput(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return parseQcvDateTimeInputToStoredIso(trimmed)
}

function supplierDocumentNoText(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  return text.toUpperCase().startsWith('CODEX-') ? '' : text
}

const receiptProductSearchPageSize = quickPickDefaultPageSize
const receiptSupplierSearchPageSize = quickPickDefaultPageSize
const receiptCreateDraftStorageKey = 'qc-oms.purchase-receipt-create-draft.v1'
const receiptCreateDraftWindowNamePrefix = 'qc-oms.purchase-receipt-create-draft='
const receiptCreateDraftHistoryStateKey = 'qc_oms_purchase_receipt_create_draft_v1'

function formatReceiptProductSearchError(cause: unknown) {
  return formatApiError(cause, 'Không tìm được hàng hóa.')
}

function formatReceiptSupplierSearchError(cause: unknown) {
  return formatApiError(cause, 'Không tìm được nhà cung cấp.')
}

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

function blankSupplierForm(): SupplierInput {
  return {
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    tax_code: '',
    linked_customer_id: null,
    notes: '',
    status: 'active',
  }
}

function matchingReceiptUnitProduct(
  lineProduct: PurchaseReceiptProduct | undefined,
  unitName: string,
  products: PurchaseReceiptProduct[],
) {
  if (!lineProduct) return undefined
  const productFamilyName = normalizeManagementSearchText(lineProduct.name)
  return products.find((candidate) => (
    candidate.status === 'active'
    && candidate.sell_method !== 'combo'
    && candidate.inventory_shape === lineProduct.inventory_shape
    && normalizeManagementSearchText(candidate.name) === productFamilyName
    && candidate.unit_name.trim() === unitName.trim()
  ))
}

function receiptProductMatchesSearch(product: PurchaseReceiptProduct, query: string) {
  const conversionText = (product.unit_conversions ?? [])
    .map((conversion) => `${conversion.source_code ?? ''} ${conversion.unit_name}`)
    .join(' ')
  const normalizedText = normalizeManagementSearchText(`${product.code} ${product.name} ${conversionText}`)
  if (normalizedText.includes(query)) return true
  return normalizedText.split(/\s+/).some((part) => part.includes(query))
}

function receiptProductSearchRank(product: PurchaseReceiptProduct, query: string) {
  const code = normalizeManagementSearchText(product.code)
  const name = normalizeManagementSearchText(product.name)
  const conversionCodes = (product.unit_conversions ?? []).map((conversion) => normalizeManagementSearchText(conversion.source_code ?? ''))
  const combined = normalizeManagementSearchText(`${product.code} ${product.name} ${(product.unit_conversions ?? []).map((conversion) => `${conversion.source_code ?? ''} ${conversion.unit_name}`).join(' ')}`)
  if (code === query || name === query) return 0
  if (conversionCodes.some((conversionCode) => conversionCode === query)) return 1
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

function uniqueReceiptSuppliersById(suppliers: Supplier[]) {
  const seen = new Set<string>()
  return suppliers.filter((supplier) => {
    if (seen.has(supplier.id)) return false
    seen.add(supplier.id)
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

function supplierSearchText(supplier: Supplier) {
  return `${supplier.code} - ${supplier.name}`
}

function supplierMatchesReceiptSearch(supplier: Supplier, query: string) {
  if (query.length === 0) return true
  return normalizeManagementSearchText([
    supplier.code,
    supplier.name,
    supplier.phone ?? '',
    supplier.tax_code ?? '',
  ].join(' ')).includes(query)
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

const defaultPurchaseReceiptSortState: NonNullable<ManagementSortState<PurchaseReceiptSortKey>> = { key: 'received_at', direction: 'desc' }

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
  const receiptManagementSearch = useManagementSearch({ initialSearch: routeFilters.search })
  const search = receiptManagementSearch.draftSearch
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
  const [receiptSupplierSearchActive, setReceiptSupplierSearchActive] = useState(false)
  const [receiptSupplierCreateOpen, setReceiptSupplierCreateOpen] = useState(false)
  const [receiptSupplierCreateSaving, setReceiptSupplierCreateSaving] = useState(false)
  const [receiptSupplierCreateForm, setReceiptSupplierCreateForm] = useState<SupplierInput>(() => blankSupplierForm())
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
  const [supplierPaymentOperationId, setSupplierPaymentOperationId] = useState<string | null>(null)
  const [cancelReceiptOpen, setCancelReceiptOpen] = useState(false)
  const [cancelingReceipt, setCancelingReceipt] = useState(false)
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
  const [error, setError] = useState<string | null>(null)
  const receiptProductSearchRef = useRef<HTMLInputElement | null>(null)
  const receiptProductSearchToolbarRef = useRef<HTMLDivElement | null>(null)
  const receiptSupplierSearchRef = useRef<HTMLDivElement | null>(null)
  const receiptSupplierSearchInputRef = useRef<HTMLInputElement | null>(null)
  const receiptPaidAmountInputRef = useRef<HTMLInputElement | null>(null)
  const receiptCreateDraftRestoredRef = useRef(false)
  const skipReceiptCreateDraftPersistRef = useRef(false)
  const receiptSortInitialRender = useRef(true)
  const supplierPaymentSubmittingRef = useRef(false)
  const searchReceiptProducts = useCallback(async (query: string) => {
    const productResult = await service.listProducts({
      status: 'active',
      search: query,
      page: quickPickDefaultPage,
      page_size: receiptProductSearchPageSize,
      search_context: quickPickSearchContext,
    })
    return {
      items: productResult.items.filter((product) => product.status === 'active' && isReceiptPurchaseSearchableProduct(product)),
    }
  }, [service])
  const searchReceiptSuppliers = useCallback(async (query: string) => {
    const supplierResult = await service.listSuppliers({
      status: 'active',
      search: query,
      page: quickPickDefaultPage,
      page_size: receiptSupplierSearchPageSize,
      search_context: quickPickSearchContext,
    })
    return {
      items: supplierResult.items.filter((supplier) => supplier.status === 'active'),
    }
  }, [service])
  const receiptProductQuickPick = useQuickPickSearch<PurchaseReceiptProduct>({
    search: searchReceiptProducts,
    formatError: formatReceiptProductSearchError,
  })
  const receiptSupplierQuickPick = useQuickPickSearch<Supplier>({
    search: searchReceiptSuppliers,
    formatError: formatReceiptSupplierSearchError,
  })
  const receiptProductSearch = receiptProductQuickPick.query
  const receiptSupplierSearch = receiptSupplierQuickPick.query
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
  const selectedFormSupplier = useMemo(() => {
    return suppliers.find((supplier) => supplier.id === form.supplier_id) ?? null
  }, [form.supplier_id, suppliers])
  const receiptSupplierSearchQuery = normalizeManagementSearchText(receiptSupplierSearch)
  const receiptSupplierSearchResults = useMemo(() => {
    if (receiptSupplierSearchQuery.length === 0) return []
    return uniqueReceiptSuppliersById([...receiptSupplierQuickPick.results, ...suppliers])
      .filter((supplier) => supplier.status === 'active')
      .filter((supplier) => supplierMatchesReceiptSearch(supplier, receiptSupplierSearchQuery))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [receiptSupplierQuickPick.results, receiptSupplierSearchQuery, suppliers])
  const receiptSupplierSuggestions = useMemo(() => {
    if (!isCreatingReceipt || !receiptSupplierSearchActive || !receiptSupplierQuickPick.suggestionsOpen) return undefined
    return receiptSupplierSearchResults
      .slice(0, 8)
      .map((supplier) => ({
        id: supplier.id,
        primary: supplier.name,
        secondary: `Mã: ${supplier.code}`,
        meta: supplier.phone ? `ĐT: ${supplier.phone}` : undefined,
        ariaLabel: `Chọn nhà cung cấp ${supplier.code} ${supplier.name}`,
      }))
  }, [isCreatingReceipt, receiptSupplierQuickPick.suggestionsOpen, receiptSupplierSearchActive, receiptSupplierSearchResults])
  const receiptProductSearchResults = useMemo(() => {
    const query = normalizeManagementSearchText(receiptProductSearch)
    if (!isCreatingReceipt || query.length === 0) return []
    return uniqueReceiptProductsById([...receiptProductQuickPick.results, ...products])
      .filter(isReceiptPurchaseSearchableProduct)
      .filter((product) => receiptProductMatchesSearch(product, query))
      .sort((left, right) => {
        const rankDelta = receiptProductSearchRank(left, query) - receiptProductSearchRank(right, query)
        if (rankDelta !== 0) return rankDelta
        return left.name.localeCompare(right.name, 'vi')
      })
  }, [isCreatingReceipt, products, receiptProductQuickPick.results, receiptProductSearch])
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
  const receiptDebtEffect = Number(form.paid_amount || 0) - totals.payable

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
      if (event.key === 'F4') {
        event.preventDefault()
        setReceiptSupplierSearchActive(true)
        receiptSupplierQuickPick.setSuggestionsOpen(true)
        queueMicrotask(() => {
          receiptSupplierSearchInputRef.current?.focus()
          receiptSupplierSearchInputRef.current?.select()
        })
        return
      }
      if (event.key === 'F8') {
        event.preventDefault()
        receiptPaidAmountInputRef.current?.focus()
        receiptPaidAmountInputRef.current?.select()
        return
      }
      if (event.key !== 'F3') return
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
      receiptProductQuickPick.clear()
    }

    document.addEventListener('pointerdown', closeReceiptProductSearchOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeReceiptProductSearchOnOutsidePointer, true)
  }, [isCreatingReceipt, receiptProductSearch])

  useEffect(() => {
    if (!receiptProductQuickPick.error) return undefined
    const id = window.setTimeout(() => setError(receiptProductQuickPick.error), 0)
    return () => window.clearTimeout(id)
  }, [receiptProductQuickPick.error])

  useEffect(() => {
    if (!receiptSupplierQuickPick.error) return undefined
    const id = window.setTimeout(() => setError(receiptSupplierQuickPick.error), 0)
    return () => window.clearTimeout(id)
  }, [receiptSupplierQuickPick.error])

  useEffect(() => {
    if (!isCreatingReceipt || receiptSupplierQuickPick.results.length === 0) return undefined
    const id = window.setTimeout(() => {
      setSuppliers((current) => uniqueReceiptSuppliersById([...receiptSupplierQuickPick.results, ...current]))
      setSuppliersLoaded(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [isCreatingReceipt, receiptSupplierQuickPick.results])

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
    const hasInput = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key)
    const nextSearch = hasInput('search') ? input.search : search.trim() || undefined
    const nextStatus = hasInput('status') ? input.status : status
    const nextDateFrom = hasInput('date_from') ? input.date_from : dateFrom || undefined
    const nextDateTo = hasInput('date_to') ? input.date_to : dateTo || undefined
    const nextCreatedBy = hasInput('created_by') ? input.created_by : createdBy === 'all' ? undefined : createdBy
    const nextPage = input.page ?? page
    const nextPageSize = input.page_size ?? pageSize
    const nextSortState = input.sortStateValue ?? receiptSortState
    setError(null)
    try {
      const result = await service.listReceipts({
        ...input,
        search: nextSearch,
        status: nextStatus,
        date_from: nextDateFrom,
        date_to: nextDateTo,
        created_by: nextCreatedBy,
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

  async function exportReceipts() {
    setError(null)
    try {
      const exportPageSize = Math.max(total, receipts?.length ?? 0, 1)
      const exportSortState = receiptSortState ?? defaultPurchaseReceiptSortState
      const result = await service.listReceipts({
        search: search.trim() || undefined,
        status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        created_by: createdBy === 'all' ? undefined : createdBy,
        page: 1,
        page_size: exportPageSize,
        sort_key: exportSortState.key,
        sort_direction: exportSortState.direction,
      })
      downloadManagementCsv({
        filename: 'nhap-hang.csv',
        rows: [
          ['Mã nhập hàng', 'Thời gian', 'Nhà cung cấp', 'Số lượng', 'Thành tiền', 'Cần trả', 'Đã trả', 'Còn phải trả', 'Người tạo', 'Ghi chú'],
          ...result.items.map((receipt) => [
            receipt.code,
            formatQcvDateTime(receipt.received_at),
            receipt.supplier.name,
            receiptTotalQuantity(receipt),
            receipt.subtotal_amount,
            receipt.payable_amount,
            receipt.paid_amount,
            receipt.remaining_amount,
            receipt.created_by.name,
            receipt.notes?.trim() ?? '',
          ]),
        ],
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không xuất được phiếu nhập.'))
    }
  }

  function exportSelectedReceipt(receipt: PurchaseReceipt) {
    downloadManagementCsv({
      filename: `${receipt.code}.csv`,
      rows: [
        ['Mã phiếu', receipt.code],
        ['Ngày nhập', formatQcvDateTime(receipt.received_at)],
        ['Nhà cung cấp', receipt.supplier.name],
        ['Số chứng từ NCC', supplierDocumentNoText(receipt.supplier_document_no)],
        ['Người tạo', receipt.created_by.name],
        [''],
        ['Mã hàng', 'Tên hàng', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Giảm giá', 'Giá nhập', 'Thành tiền'],
        ...receipt.items.map((item) => [
          item.product.code,
          item.product.name,
          item.quantity,
          item.unit_name_snapshot,
          item.unit_cost,
          item.discount_amount,
          item.unit_cost,
          item.line_amount,
        ]),
        [''],
        ['Số lượng mặt hàng', receipt.items.length],
        ['Tổng tiền hàng', receipt.subtotal_amount],
        ['Giảm giá phiếu', receipt.discount_amount],
        ['Cần trả NCC', receipt.payable_amount],
        ['Đã trả NCC', receipt.paid_amount],
        ['Còn phải trả', receiptOutstandingAfterPost(receipt)],
        ['Ghi chú', receipt.notes?.trim() ?? ''],
      ],
    })
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
              supplier_document_no: supplierDocumentNoText(detail.supplier_document_no),
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
            setReceiptReceivedAtText(formatReceiptDateTimeInput(detail.received_at.slice(0, 16)))
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
      requests.push(service.listSuppliers({ status: 'active', page: 1, page_size: 100 }).then((result) => {
        nextSuppliers = result.items
        setSuppliers(result.items)
        setSuppliersLoaded(true)
      }))
    }
    if (!productsLoaded) {
      requests.push(service.listProducts({ status: 'active' }).then((result) => {
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

  useEffect(() => {
    if (!isCreatingReceipt || form.supplier_id || suppliers.length === 0) return
    const nextSupplierId = defaultReceiptSupplierId(suppliers)
    const frame = window.setTimeout(() => {
      setForm((current) => current.supplier_id ? current : { ...current, supplier_id: nextSupplierId })
    }, 0)
    return () => window.clearTimeout(frame)
  }, [form.supplier_id, isCreatingReceipt, suppliers])

  useEffect(() => {
    if (!isCreatingReceipt) return
    if (receiptSupplierSearchActive) return
    const supplier = suppliers.find((candidate) => candidate.id === form.supplier_id)
    const nextSearch = supplier ? supplierSearchText(supplier) : ''
    const frame = window.setTimeout(() => {
      receiptSupplierQuickPick.setQuery(nextSearch)
    }, 0)
    return () => window.clearTimeout(frame)
  }, [form.supplier_id, isCreatingReceipt, receiptSupplierSearchActive, suppliers])

  useEffect(() => {
    if (!receiptSupplierQuickPick.suggestionsOpen) return undefined

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && receiptSupplierSearchRef.current?.contains(target)) return
      receiptSupplierQuickPick.setSuggestionsOpen(false)
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [receiptSupplierQuickPick.suggestionsOpen])

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
    preventManagementSearchSubmit(event, () => {
      const nextSearch = search.trim()
      receiptManagementSearch.applySearch(nextSearch)
      return applyReceiptSearch(nextSearch, { exactCodePriority: true })
    })
  }

  function applyReceiptSearch(nextSearch: string, options: { exactCodePriority?: boolean } = {}) {
    setPage(1)
    if (options.exactCodePriority && isExactPurchaseReceiptCode(nextSearch)) {
      setStatus('all')
      setDateFrom('')
      setDateTo('')
      setCreatedBy('all')
      setActivePreset(null)
      return loadReceipts({
        search: nextSearch.trim(),
        status: 'all',
        date_from: undefined,
        date_to: undefined,
        created_by: undefined,
        page: 1,
        page_size: pageSize,
      })
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
    receiptManagementSearch.changeSearch(nextSearch)
    setSelectedReceipt(null)
    setDetailOpen(false)
    setEditingId(null)
    setReceiptDetailTab('info')
    if (nextSearch.trim().length === 0) {
      receiptManagementSearch.applySearch('')
      void applyReceiptSearch('')
    }
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
    receiptManagementSearch.applySearch(nextSearch)
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
      setCancelReceiptOpen(false)
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
    setCancelReceiptOpen(false)
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
        supplier_document_no: supplierDocumentNoText(detail.supplier_document_no),
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
      setReceiptReceivedAtText(formatReceiptDateTimeInput(detail.received_at.slice(0, 16)))
      setPaymentMethod('cash')
      setFinanceAccountId('')
      setSupplierPaymentOpen(false)
      setCancelReceiptOpen(false)
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
    const nextForm = buildValidatedReceiptForm()
    if (!nextForm) return
    setSaving(true)
    setError(null)
    try {
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
      const nextBlankForm = blankForm()
      setForm(nextBlankForm)
      setReceiptReceivedAtText(formatReceiptDateTimeInput(nextBlankForm.received_at))
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được phiếu nhập.'))
    } finally {
      setSaving(false)
    }
  }

  async function postReceipt() {
    if (editingId === null || editingStatus !== 'draft') return
    const nextForm = buildValidatedReceiptForm('Chọn ít nhất 1 hàng hóa trước khi hoàn thành phiếu nhập.')
    if (!nextForm) return
    if (Number(form.paid_amount || 0) > 0 && paymentMethod === 'bank_transfer' && financeAccountId === '') {
      setError('Chọn tài khoản chuyển khoản trước khi hoàn thành phiếu nhập.')
      return
    }

    setPosting(true)
    setError(null)
    try {
      await service.updateReceipt(editingId, nextForm)
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
      const nextBlankForm = blankForm()
      setForm(nextBlankForm)
      setReceiptReceivedAtText(formatReceiptDateTimeInput(nextBlankForm.received_at))
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

  function buildValidatedReceiptForm(emptyItemsError = 'Chọn ít nhất 1 hàng hóa trước khi lưu phiếu nhập.') {
    if (form.items.length === 0) {
      setError(emptyItemsError)
      return null
    }
    if (!form.supplier_id) {
      setError('Chọn nhà cung cấp trước khi lưu phiếu nhập.')
      return null
    }
    if (isCreatingReceipt && (!selectedFormSupplier || receiptSupplierSearch.trim() !== supplierSearchText(selectedFormSupplier))) {
      setError('Chọn nhà cung cấp trong danh sách gợi ý.')
      return null
    }
    const normalizedReceivedAt = parseReceiptDateTimeInput(receiptReceivedAtText)
    if (normalizedReceivedAt === null) {
      setError('Nhập ngày giờ dạng DD/MM/YYYY HH:mm.')
      return null
    }
    return {
      ...form,
      received_at: normalizedReceivedAt || form.received_at,
      supplier_document_no: supplierDocumentNoText(form.supplier_document_no),
    }
  }

  function updateMoneyLine(index: number, key: 'unit_cost' | 'discount_amount', value: string) {
    updateLine(index, { [key]: parseMoneyInput(value) } as Partial<PurchaseReceiptInput['items'][number]>)
  }

  async function completeNewReceipt() {
    if (!isCreatingReceipt || editingId !== null) return
    const nextForm = buildValidatedReceiptForm('Chọn ít nhất 1 hàng hóa trước khi hoàn thành phiếu nhập.')
    if (!nextForm) return
    if (Number(form.paid_amount || 0) > 0 && paymentMethod === 'bank_transfer' && financeAccountId === '') {
      setError('Chọn tài khoản chuyển khoản trước khi hoàn thành phiếu nhập.')
      return
    }
    setSaving(true)
    setPosting(true)
    setError(null)
    try {
      const created = await service.createReceipt(nextForm)
      await service.postReceipt(created.id, {
        ...(Number(form.paid_amount || 0) > 0 ? { payment_method: paymentMethod } : {}),
        ...(Number(form.paid_amount || 0) > 0 && paymentMethod === 'bank_transfer'
          ? { finance_account_id: financeAccountId }
          : {}),
      })
      clearReceiptCreateDraft()
      setEditingId(null)
      setEditingStatus(null)
      setSelectedReceipt(null)
      setReceiptDetailTab('info')
      setDetailOpen(false)
      const nextBlankForm = blankForm()
      setForm(nextBlankForm)
      setReceiptReceivedAtText(formatReceiptDateTimeInput(nextBlankForm.received_at))
      if (createMode && onCloseCreateReceipt) {
        onCloseCreateReceipt()
        return
      }
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không hoàn thành được phiếu nhập.'))
    } finally {
      setSaving(false)
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
    void Promise.resolve(service.recordSearchSelection({ entity_type: 'product', entity_id: product.id })).catch(() => undefined)

    const relatedProducts = receiptProductQuickPick.results.filter((candidate) => (
      candidate.status === 'active'
      && isReceiptPurchaseSearchableProduct(candidate)
      && normalizeManagementSearchText(candidate.name) === normalizeManagementSearchText(product.name)
      && candidate.inventory_shape === product.inventory_shape
    ))
    setProducts((current) => uniqueReceiptProductsById([product, ...relatedProducts, ...receiptProductSearchResults, ...current]))
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
    receiptProductQuickPick.clear()
    void loadReceiptProductFamily(product)
  }

  async function loadReceiptProductFamily(product: PurchaseReceiptProduct) {
    try {
      const result = await service.listProducts({
        status: 'active',
        search: product.name,
        page: 1,
        page_size: 50,
      })
      const productFamilyName = normalizeManagementSearchText(product.name)
      const relatedProducts = result.items.filter((candidate) => (
        candidate.status === 'active'
        && isReceiptPurchaseSearchableProduct(candidate)
        && normalizeManagementSearchText(candidate.name) === productFamilyName
        && candidate.inventory_shape === product.inventory_shape
      ))
      if (relatedProducts.length > 0) {
        setProducts((current) => uniqueReceiptProductsById([product, ...relatedProducts, ...current]))
      }
    } catch {
      // Unit switching still works for products already present in cache.
    }
  }

  function updateLineUnit(index: number, unitName: string, unitChoices: PurchaseReceiptUnitChoice[]) {
    const choiceProduct = unitChoices.find((choice) => choice.unitName === unitName)?.product
    const currentLine = form.items[index]
    const selectedProduct = currentLine ? products.find((candidate) => candidate.id === currentLine.product_id) : undefined
    const linkedProduct = choiceProduct ?? matchingReceiptUnitProduct(selectedProduct, unitName, products)
    setForm((current) => {
      const line = current.items[index]
      if (!line) return current
      const items = [...current.items]
      if (linkedProduct && linkedProduct.id !== line.product_id) {
        const inventoryShape = linkedProduct.inventory_shape ?? 'normal'
        items[index] = {
          ...line,
          product_id: linkedProduct.id,
          inventory_shape: inventoryShape,
          unit_name: unitName,
          unit_cost: linkedProduct.latest_purchase_cost ?? line.unit_cost,
          physical_payload: defaultPhysicalPayload(inventoryShape),
        }
      } else {
        items[index] = { ...line, unit_name: unitName }
      }
      return { ...current, items }
    })
    setRollLengthTexts((current) => {
      const next = { ...current }
      const nextShape = linkedProduct?.inventory_shape
      if (nextShape === 'roll') next[index] = next[index] ?? '1'
      if (nextShape !== 'roll') delete next[index]
      return next
    })
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
      receiptProductQuickPick.changeQuery(created.code)
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
    receiptProductQuickPick.clear()
    receiptSupplierQuickPick.clear()
    setReceiptSupplierSearchActive(false)
    setReceiptSupplierCreateOpen(false)
    setReceiptSupplierCreateSaving(false)
    setReceiptSupplierCreateForm(blankSupplierForm())
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
    const nextBlankForm = blankForm()
    setForm(nextBlankForm)
    setReceiptReceivedAtText(formatReceiptDateTimeInput(nextBlankForm.received_at))
    setPaymentMethod('cash')
    setFinanceAccountId('')
    setSupplierPaymentOpen(false)
    setSupplierPaymentAmount(0)
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
    setRollLengthTexts({})
    receiptProductQuickPick.clear()
    receiptSupplierQuickPick.clear()
    setReceiptSupplierSearchActive(false)
    setReceiptSupplierCreateOpen(false)
    setReceiptSupplierCreateSaving(false)
    setReceiptSupplierCreateForm(blankSupplierForm())
  }

  function openSupplierPaymentForReceipt() {
    if (selectedReceipt === null) return
    setSupplierPaymentOpen(true)
    setSupplierPaymentAmount(Math.max(selectedReceiptOutstanding, 0))
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
    setSupplierPaymentOperationId(crypto.randomUUID())
  }

  async function changeImmediatePaymentMethod(nextMethod: 'cash' | 'bank_transfer') {
    setPaymentMethod(nextMethod)
    if (nextMethod !== 'bank_transfer') {
      setFinanceAccountId('')
      return
    }
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

  function chooseReceiptSupplier(supplier: Supplier) {
    void Promise.resolve(service.recordSearchSelection({ entity_type: 'supplier', entity_id: supplier.id })).catch(() => undefined)
    setForm((current) => ({ ...current, supplier_id: supplier.id }))
    receiptSupplierQuickPick.setQuery(supplierSearchText(supplier))
    receiptSupplierQuickPick.setSuggestionsOpen(false)
    setReceiptSupplierSearchActive(false)
  }

  function changeReceiptSupplierSearch(nextSearch: string) {
    receiptSupplierQuickPick.changeQuery(nextSearch)
    setReceiptSupplierSearchActive(true)
    if (form.supplier_id) {
      setForm((current) => ({ ...current, supplier_id: '' }))
    }
  }

  function clearReceiptSupplier() {
    setForm((current) => ({ ...current, supplier_id: '' }))
    receiptSupplierQuickPick.clear()
    setReceiptSupplierSearchActive(true)
    queueMicrotask(() => receiptSupplierSearchInputRef.current?.focus())
  }

  function openReceiptSupplierCreate() {
    setReceiptSupplierCreateForm((current) => ({
      ...blankSupplierForm(),
      name: receiptSupplierSearch.trim() || current.name,
    }))
    setReceiptSupplierCreateOpen(true)
    receiptSupplierQuickPick.setSuggestionsOpen(false)
  }

  async function createReceiptSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = receiptSupplierCreateForm.name.trim()
    if (name.length === 0) {
      setError('Nhập tên nhà cung cấp trước khi lưu.')
      return
    }
    setReceiptSupplierCreateSaving(true)
    setError(null)
    try {
      const created = await service.createSupplier({
        ...receiptSupplierCreateForm,
        code: receiptSupplierCreateForm.code.trim(),
        name,
        phone: receiptSupplierCreateForm.phone.trim(),
        email: receiptSupplierCreateForm.email.trim(),
        address: receiptSupplierCreateForm.address.trim(),
        tax_code: receiptSupplierCreateForm.tax_code.trim(),
        notes: receiptSupplierCreateForm.notes.trim(),
        linked_customer_id: null,
        status: 'active',
      })
      setSuppliers((current) => [...current.filter((supplier) => supplier.id !== created.id), created])
      setSuppliersLoaded(true)
      chooseReceiptSupplier(created)
      setReceiptSupplierCreateOpen(false)
      setReceiptSupplierCreateForm(blankSupplierForm())
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được nhà cung cấp.'))
    } finally {
      setReceiptSupplierCreateSaving(false)
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
    if (supplierPaymentSubmittingRef.current) return
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

    supplierPaymentSubmittingRef.current = true
    const operationId = supplierPaymentOperationId ?? crypto.randomUUID()
    if (supplierPaymentOperationId === null) setSupplierPaymentOperationId(operationId)
    setPosting(true)
    setError(null)
    try {
      await service.paySupplier(selectedReceipt.supplier_id, {
        operation_id: operationId,
        payment_method: supplierPaymentMethod,
        ...(supplierPaymentMethod === 'bank_transfer' ? { finance_account_id: supplierPaymentFinanceAccountId } : {}),
        allocations: [{ purchase_receipt_id: selectedReceipt.id, amount: supplierPaymentAmount }],
      })
      const detail = await service.getReceipt(selectedReceipt.id)
      setSelectedReceipt(detail)
      setSupplierPaymentOpen(false)
      setSupplierPaymentOperationId(null)
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được thanh toán NCC.'))
    } finally {
      supplierPaymentSubmittingRef.current = false
      setPosting(false)
    }
  }

  async function cancelSelectedReceipt() {
    if (!selectedReceipt || selectedReceipt.status === 'cancelled') return

    setCancelingReceipt(true)
    setError(null)
    try {
      const cancelled = await service.cancelReceipt(selectedReceipt.id)
      setSelectedReceipt(cancelled)
      setEditingStatus(cancelled.status)
      setForm((current) => ({
        ...current,
        paid_amount: cancelled.paid_amount,
      }))
      setCancelReceiptOpen(false)
      setSupplierPaymentOpen(false)
      await loadReceipts()
    } catch (cause) {
      setError(formatApiError(cause, 'Không hủy được phiếu nhập.'))
    } finally {
      setCancelingReceipt(false)
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
    const selectedReceiptHasSupplierPayments = selectedReceipt
      ? selectedReceipt.paid_amount > 0 || selectedReceipt.supplier_payments.some((payment) => payment.status === 'posted')
      : false

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
                metaAriaLabel="Thông tin tạo phiếu nhập"
                metaItems={[
                  { label: 'Người tạo:', value: selectedReceipt.created_by.name },
                  { label: 'Ngày nhập:', value: formatQcvDateTime(selectedReceipt.received_at) },
                ]}
                title={(
                  <>
                    {selectedReceipt.code}
                    {' '}
                    <StatusChip tone={selectedReceipt.status === 'posted' ? 'success' : selectedReceipt.status === 'cancelled' ? 'danger' : 'neutral'}>
                      {detailStatus}
                    </StatusChip>
                  </>
                )}
              />
              <ManagementDetailSection ariaLabel="Thông tin nhanh phiếu nhập">
                <ManagementDetailInfoList
                  columns="three"
                  items={[
                    { label: 'Tên NCC', value: (
                      <ManagementRecordLink href={managementRecordOpenHref('/suppliers', selectedReceipt.supplier.code ?? selectedReceipt.supplier.name)}>
                        {selectedReceipt.supplier.name}
                      </ManagementRecordLink>
                    ) },
                    { label: 'Số chứng từ NCC', value: supplierDocumentNoText(selectedReceipt.supplier_document_no) },
                    { label: 'Còn phải trả', value: money(selectedReceiptOutstanding) },
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
                      <dt>Số lượng mặt hàng</dt>
                      <dd>{selectedReceipt.items.length}</dd>
                    </div>
                    <div>
                      <dt>Tổng tiền hàng</dt>
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
                    <div>
                      <dt>Còn phải trả</dt>
                      <dd><MoneyText value={selectedReceiptOutstanding} /></dd>
                    </div>
                  </dl>
                </div>
              </ManagementDetailSection>
              <PurchaseReceiptActionFooter
                canceling={cancelingReceipt}
                hasSupplierPayments={selectedReceiptHasSupplierPayments}
                outstandingAmount={selectedReceiptOutstanding}
                receipt={selectedReceipt}
                onCancel={() => setCancelReceiptOpen(true)}
                onExport={() => exportSelectedReceipt(selectedReceipt)}
                onPay={openSupplierPaymentForReceipt}
                onPrint={() => window.print()}
              />
            </>
          ) : null}
          {activeReceiptDetailTab === 'payments' ? (
            <PurchaseReceiptPaymentHistory
              outstandingAmount={selectedReceiptOutstanding}
              payments={selectedReceiptPayments}
              onPay={openSupplierPaymentForReceipt}
            />
          ) : null}
          {supplierPaymentOpen ? (
            <PurchaseReceiptSupplierPaymentForm
              amount={supplierPaymentAmount}
              bankAccounts={bankAccounts}
              financeAccountId={supplierPaymentFinanceAccountId}
              method={supplierPaymentMethod}
              outstandingAmount={selectedReceiptOutstanding}
              receiptCode={selectedReceipt.code}
              saving={posting}
              onAmountChange={setSupplierPaymentAmount}
              onFinanceAccountChange={setSupplierPaymentFinanceAccountId}
              onMethodChange={(method) => void changeSupplierPaymentMethod(method)}
              onSave={() => void saveSupplierPayment()}
            />
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
                  { label: 'Ngày nhập:', value: formatQcvDateTime(selectedReceipt.received_at) },
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
                    { label: 'Số chứng từ NCC', value: supplierDocumentNoText(selectedReceipt.supplier_document_no) },
                    { label: 'Cần trả NCC', value: money(selectedReceipt.payable_amount) },
                    { label: 'Còn phải trả', value: money(selectedReceipt.remaining_amount) },
                  ]}
                />
                <ManagementDetailInlineNote>{selectedReceipt.notes?.trim() || 'Chưa có ghi chú'}</ManagementDetailInlineNote>
              </ManagementDetailSection>
            ) : null}
            <PurchaseReceiptForm
              ariaLabel={ariaLabel}
              bankAccounts={bankAccounts}
              editingId={editingId}
              editingStatus={editingStatus}
              financeAccountId={financeAccountId}
              form={form}
              isReadOnly={isReadOnly}
              lowCostWarnings={lowCostWarnings}
              paymentMethod={paymentMethod}
              products={products}
              receiptReceivedAtText={receiptReceivedAtText}
              rollLengthTexts={rollLengthTexts}
              saving={saving}
              suppliers={suppliers}
              totals={totals}
              onAddLine={addLine}
              onAddSheetGroup={addSheetGroup}
              onDiscountChange={(value) => setForm((current) => ({ ...current, discount_amount: parseMoneyInput(value) }))}
              onFinanceAccountChange={setFinanceAccountId}
              onMoneyLineChange={updateMoneyLine}
              onNotesChange={(value) => setForm((current) => ({ ...current, notes: value }))}
              onPaidAmountChange={(value) => setForm((current) => ({ ...current, paid_amount: parseMoneyInput(value) }))}
              onPaymentMethodChange={(method) => void changeImmediatePaymentMethod(method)}
              onProductChange={chooseProduct}
              onQuantityChange={(index, quantity) => updateLine(index, { quantity })}
              onReceiptReceivedAtTextChange={updateReceiptReceivedAtText}
              onRemoveLine={removeLine}
              onRemoveSheetGroup={removeSheetGroup}
              onRollLengthTextsChange={(index, text) => setRollLengthTexts((current) => ({ ...current, [index]: text }))}
              onSave={saveReceipt}
              onSupplierChange={(supplierId) => setForm((current) => ({ ...current, supplier_id: supplierId }))}
              onSupplierDocumentNoChange={(value) => setForm((current) => ({ ...current, supplier_document_no: value }))}
              onUpdateRollPayload={updateRollPayload}
              onUpdateSheetPayload={updateSheetPayload}
            />
          </>
        ) : null}
        {activeReceiptDetailTab === 'payments' && selectedReceipt ? (
          <PurchaseReceiptPaymentHistory
            outstandingAmount={selectedReceiptOutstanding}
            payments={selectedReceiptPayments}
            onPay={openSupplierPaymentForReceipt}
          />
        ) : null}
        {supplierPaymentOpen && selectedReceipt ? (
          <PurchaseReceiptSupplierPaymentForm
            amount={supplierPaymentAmount}
            bankAccounts={bankAccounts}
            financeAccountId={supplierPaymentFinanceAccountId}
            method={supplierPaymentMethod}
            outstandingAmount={selectedReceiptOutstanding}
            receiptCode={selectedReceipt.code}
            saving={posting}
            onAmountChange={setSupplierPaymentAmount}
            onFinanceAccountChange={setSupplierPaymentFinanceAccountId}
            onMethodChange={(method) => void changeSupplierPaymentMethod(method)}
            onSave={() => void saveSupplierPayment()}
          />
        ) : null}
      </ManagementDetailPanel>
    )
  }

  function renderCreateReceiptWorkspace() {
    return (
      <PurchaseReceiptCreateWorkspace
        bankAccounts={bankAccounts}
        currentUser={currentUser}
        financeAccountId={financeAccountId}
        form={form}
        lowCostWarnings={lowCostWarnings}
        paymentMethod={paymentMethod}
        posting={posting}
        products={products}
        receiptDebtEffect={receiptDebtEffect}
        receiptPaidAmountInputRef={receiptPaidAmountInputRef}
        receiptReceivedAtText={receiptReceivedAtText}
        receiptSupplierCreateForm={receiptSupplierCreateForm}
        receiptSupplierCreateOpen={receiptSupplierCreateOpen}
        receiptSupplierCreateSaving={receiptSupplierCreateSaving}
        receiptSupplierSearch={receiptSupplierSearch}
        receiptSupplierSearchActive={receiptSupplierSearchActive}
        receiptSupplierSearchInputRef={receiptSupplierSearchInputRef}
        receiptSupplierSearchRef={receiptSupplierSearchRef}
        receiptSupplierSearchResults={receiptSupplierSearchResults}
        receiptSupplierSuggestions={receiptSupplierSuggestions}
        receiptWorkspaceLookupLoading={receiptWorkspaceLookupLoading}
        receiptWorkspaceSideCollapsed={receiptWorkspaceSideCollapsed}
        rollLengthTexts={rollLengthTexts}
        saving={saving}
        selectedFormSupplier={selectedFormSupplier}
        totals={totals}
        onAddSheetGroup={addSheetGroup}
        onChangeImmediatePaymentMethod={(method) => void changeImmediatePaymentMethod(method)}
        onChangeReceiptSupplierSearch={changeReceiptSupplierSearch}
        onChooseReceiptSupplier={chooseReceiptSupplier}
        onClearReceiptSupplier={clearReceiptSupplier}
        onCloseReceiptSupplierCreate={() => setReceiptSupplierCreateOpen(false)}
        onCompleteNewReceipt={() => void completeNewReceipt()}
        onCreateReceiptSupplier={createReceiptSupplier}
        onDiscountAmountChange={(value) => setForm((current) => ({ ...current, discount_amount: value }))}
        onFinanceAccountChange={setFinanceAccountId}
        onNotesChange={(notes) => setForm((current) => ({ ...current, notes }))}
        onOpenReceiptSupplierCreate={openReceiptSupplierCreate}
        onPaidAmountChange={(value) => setForm((current) => ({ ...current, paid_amount: value }))}
        onReceiptCodeChange={(code) => setForm((current) => ({ ...current, code }))}
        onReceiptReceivedAtTextChange={updateReceiptReceivedAtText}
        onReceiptSupplierCreateFormChange={(patch) => setReceiptSupplierCreateForm((current) => ({ ...current, ...patch }))}
        onRemoveLine={removeLine}
        onRemoveSheetGroup={removeSheetGroup}
        onRollLengthTextsChange={(index, text) => setRollLengthTexts((current) => ({ ...current, [index]: text }))}
        onSaveReceipt={saveReceipt}
        onSetReceiptSupplierSuggestionsOpen={(open) => {
          setReceiptSupplierSearchActive(open)
          receiptSupplierQuickPick.setSuggestionsOpen(open)
        }}
        onSetReceiptWorkspaceSideCollapsed={setReceiptWorkspaceSideCollapsed}
        onSupplierDocumentNoChange={(value) => setForm((current) => ({ ...current, supplier_document_no: value }))}
        onUpdateLine={updateLine}
        onUpdateLineUnit={updateLineUnit}
        onUpdateMoneyLine={updateMoneyLine}
        onUpdateRollPayload={updateRollPayload}
        onUpdateSheetPayload={updateSheetPayload}
      />
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
              onChange={(event) => receiptProductQuickPick.changeQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  receiptProductQuickPick.clear()
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
                    receiptProductQuickPick.clear()
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
          <button className="button button-secondary" type="button" onClick={() => void exportReceipts()}>
            <FileOutput aria-hidden="true" size={16} />
            Xuất file
          </button>
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
        <PurchaseReceiptList
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          editingId={editingId}
          favoriteReceiptIds={favoriteReceiptIds}
          loadingReceiptId={loadingReceiptId}
          onGoToPage={(nextPage) => void goToPage(nextPage)}
          onOpenReceipt={(receipt) => void openReceipt(receipt)}
          onPageSizeChange={(nextPageSize) => void loadReceipts({ page: 1, page_size: nextPageSize })}
          onRequestSort={requestReceiptSort}
          onToggleFavoriteReceipt={toggleReceiptFavorite}
          onToggleFavoritesOnly={() => setShowFavoriteReceiptsOnly(!showFavoriteReceiptsOnly)}
          page={page}
          pageSize={pageSize}
          receipts={visibleReceipts}
          renderDetail={(receipt) => (
            loadingReceiptId === receipt.id
              ? receiptDetailLoading(`Đang tải chi tiết ${receipt.code}`)
              : receiptDetailContent(`Nội dung chi tiết ${receipt.code}`)
          )}
          receiptSortState={receiptSortState}
          showFavoriteReceiptsOnly={showFavoriteReceiptsOnly}
          total={total}
          totalPages={totalPages}
        />
      ) : null}
      <PurchaseReceiptImportDialog
        open={importOpen}
        service={service}
        onClose={() => setImportOpen(false)}
        onImported={() => void loadReceipts({ page: 1, page_size: pageSize })}
        onOldDataDeleted={() => void loadReceipts({ page: 1, page_size: pageSize })}
      />
      <ManagementConfirmDialog
        open={cancelReceiptOpen && Boolean(selectedReceipt)}
        title="Hủy phiếu nhập"
        confirmLabel="Hủy phiếu"
        message={(
          <>
            Hủy phiếu nhập <strong>{selectedReceipt?.code}</strong>? Hệ thống sẽ chuyển phiếu sang Đã hủy và đảo tồn kho/công nợ NCC.
            {selectedReceipt && (selectedReceipt.paid_amount > 0 || selectedReceipt.supplier_payments.some((payment) => payment.status === 'posted'))
              ? ' Các phiếu trả NCC và sổ quỹ liên quan cũng sẽ chuyển sang Đã hủy, lịch sử vẫn được giữ.'
              : null}
          </>
        )}
        loading={cancelingReceipt}
        onCancel={() => setCancelReceiptOpen(false)}
        onConfirm={() => void cancelSelectedReceipt()}
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
