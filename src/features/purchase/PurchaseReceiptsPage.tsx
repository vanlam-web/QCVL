import { useEffect, useMemo, useState } from 'react'
import { Banknote, ChevronLeft, ChevronRight, FilePlus2, PackageCheck, Plus, Save, Search, Trash2, WalletCards } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { formatKvDateTime } from '../../lib/date-format'
import type {
  PurchaseReceipt,
  PurchaseReceiptFinanceAccount,
  PurchaseReceiptInput,
  PurchaseReceiptProduct,
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
import { EmptyState, MetricCard, MetricGrid, MoneyText } from '../../components/ui-shell/primitives'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDataTable,
  ManagementDateRangeInputs,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableCheckboxControl,
  ManagementTableFavoriteButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { PurchaseReceiptImportDialog } from './PurchaseReceiptImportDialog'

const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const blankLine = {
  product_id: '',
  inventory_shape: 'normal' as const,
  unit_name: '',
  quantity: 1,
  unit_cost: 0,
  discount_amount: 0,
  physical_payload: null,
}

const blankForm: PurchaseReceiptInput = {
  code: '',
  supplier_id: '',
  received_at: nowLocal,
  supplier_document_no: '',
  notes: '',
  discount_amount: 0,
  paid_amount: 0,
  items: [blankLine],
}

const purchaseReceiptPageSize = 15
type PurchaseReceiptSortKey = 'code' | 'supplier_name' | 'total_quantity' | 'subtotal_amount' | 'payable_amount' | 'paid_amount'

function receiptTotalQuantity(receipt: PurchaseReceipt) {
  return receipt.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
}

function quantityText(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function PurchaseReceiptsPage({
  service,
}: {
  service: PurchaseReceiptService
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(purchaseReceiptPageSize)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PurchaseReceiptStatus | 'all'>('posted')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [createdBy, setCreatedBy] = useState('all')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<PurchaseReceiptStatus | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null)
  const [form, setForm] = useState<PurchaseReceiptInput>(blankForm)
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
  const [error, setError] = useState<string | null>(null)
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
    supplier_name: { kind: 'text', value: (receipt) => receipt.supplier.name },
    total_quantity: { kind: 'number', value: (receipt) => receiptTotalQuantity(receipt) },
    subtotal_amount: { kind: 'number', value: (receipt) => receipt.subtotal_amount },
    payable_amount: { kind: 'number', value: (receipt) => receipt.payable_amount },
    paid_amount: { kind: 'number', value: (receipt) => receipt.paid_amount },
  })
  const visibleReceipts = useMemo(() => {
    if (!showFavoriteReceiptsOnly) return sortedReceipts
    return sortedReceipts.filter((receipt) => favoriteReceiptIds.includes(receipt.id))
  }, [favoriteReceiptIds, showFavoriteReceiptsOnly, sortedReceipts])

  async function loadReceipts(
    input: {
      search?: string
      status?: PurchaseReceiptStatus | 'all'
      date_from?: string
      date_to?: string
      created_by?: string
      page?: number
      page_size?: number
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
    setError(null)
    try {
      const result = await service.listReceipts({
        ...input,
        page: nextPage,
        page_size: nextPageSize,
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
    let active = true

    async function loadInitialData() {
      setError(null)
      try {
        const receiptResult = await service.listReceipts({ status: 'posted', page: 1, page_size: purchaseReceiptPageSize })
        if (!active) return
        setReceipts(receiptResult.items)
        setTotal(receiptResult.total)
        setReceiptListSummary(receiptResult.summary ?? null)
        setPage(receiptResult.page)
        setPageSize(receiptResult.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được phiếu nhập.'))
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [service])

  async function ensureReceiptLookupsLoaded() {
    const requests: Promise<void>[] = []
    if (!suppliersLoaded) {
      requests.push(service.listSuppliers().then((result) => {
        setSuppliers(result.items)
        setSuppliersLoaded(true)
      }))
    }
    if (!productsLoaded) {
      requests.push(service.listProducts().then((result) => {
        setProducts(result.items.filter((product) => product.status === 'active'))
        setProductsLoaded(true)
      }))
    }
    await Promise.all(requests)
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
    setSupplierPaymentOpen(false)
    try {
      const [detail] = await Promise.all([service.getReceipt(receipt.id), ensureReceiptLookupsLoaded()])
      setDetailOpen(true)
      setEditingId(detail.id)
      setEditingStatus(detail.status)
      setSelectedReceipt(detail)
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
    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await service.createReceipt(form)
      } else {
        await service.updateReceipt(editingId, form)
      }
      setEditingId(null)
      setEditingStatus(null)
      setSelectedReceipt(null)
      setDetailOpen(false)
      setForm(blankForm)
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
      setDetailOpen(false)
      setForm(blankForm)
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

  function addLine() {
    setForm((current) => ({ ...current, items: [...current.items, { ...blankLine }] }))
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, lineIndex) => lineIndex !== index),
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
    setDetailOpen(true)
    setForm(blankForm)
    setPaymentMethod('cash')
    setFinanceAccountId('')
    setSupplierPaymentOpen(false)
    setSupplierPaymentAmount(0)
    setSupplierPaymentMethod('cash')
    setSupplierPaymentFinanceAccountId('')
    setRollLengthTexts({})
  }

  async function openCreateReceipt() {
    setError(null)
    setDetailOpen(false)
    setLoadingReceiptId(null)
    try {
      await ensureReceiptLookupsLoaded()
      resetForm()
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được dữ liệu tạo phiếu nhập.'))
    }
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
      <MetricCard hint="Từ danh sách đang xem" label="Cần trả" tone="warning" value={<MoneyText value={receiptSummary.payable} />} />
      <MetricCard
        hint="Sau trả ngay và thanh toán NCC"
        label="Còn phải trả"
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
    return (
      <section aria-label={ariaLabel} className="management-detail-panel" role="region">
        <div className="panel-heading">
          <div>
            <h2>Chi tiết phiếu</h2>
            <p>Nhập hàng thường, cuộn/tấm vật lý và thanh toán NCC.</p>
          </div>
        </div>
        <form aria-label="Thông tin phiếu nhập" className="purchase-receipt-form" onSubmit={saveReceipt}>
          <header>
            <h2>{isReadOnly ? 'Xem phiếu nhập' : editingId ? 'Sửa draft phiếu nhập' : 'Tạo draft phiếu nhập'}</h2>
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
          </header>
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
              type="datetime-local"
              value={form.received_at}
              onChange={(event) => setForm((current) => ({ ...current, received_at: event.target.value }))}
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
          {isReadOnly && selectedReceipt ? (
            <section className="receipt-payment-history" aria-label="Lịch sử thanh toán NCC">
              <h3>Lịch sử thanh toán NCC</h3>
              {selectedReceipt.supplier_payments.length === 0 ? (
                <p>Chưa có thanh toán NCC sau nhập.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Mã phiếu</th>
                      <th>Thời gian</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                      <th>Tiền chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.supplier_payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.code}</td>
                        <td>{formatKvDateTime(payment.paid_at)}</td>
                        <td>{payment.payment_method === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</td>
                        <td>{payment.status === 'posted' ? 'Đã ghi' : 'Đã hủy'}</td>
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
            </section>
          ) : null}
          {supplierPaymentOpen && selectedReceipt ? (
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
      </section>
    )
  }

  function receiptDetailLoading(ariaLabel: string) {
    return (
      <section aria-label={ariaLabel} className="management-detail-panel" role="region">
        <p>Đang tải chi tiết phiếu nhập...</p>
      </section>
    )
  }

  return (
    <ManagementPage
      title="Phiếu nhập"
      actions={
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
          <button className="button button-secondary" type="button" onClick={() => setImportOpen(true)}>
            <FilePlus2 aria-hidden="true" size={16} />
            Import KV
          </button>
        </ManagementCompactToolbar>
      }
      kpis={receiptKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary || undefined}
          ariaLabel="Bộ lọc phiếu nhập"
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
            <select
              aria-label="Thời gian nhanh"
              className="management-filter-select"
              value={selectedTimeQuickOption}
              onChange={(event) => {
                const option = receiptTimeQuickOptions.find((candidate) => candidate.id === event.target.value)
                if (option) void applyReceiptFilters({ dateFrom: option.from, dateTo: option.to, preset: null })
              }}
            >
              {receiptTimeQuickOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Tùy chỉnh</option>
            </select>
            <ManagementDateRangeInputs
              from={dateFrom}
              to={dateTo}
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
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc phiếu nhập"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      <ManagementListSurface ariaLabel="Danh sách phiếu nhập">
        {error ? <p role="alert">{error}</p> : null}
        {receipts === null && error === null ? <p>Đang tải phiếu nhập...</p> : null}
        {isCreatingReceipt ? receiptDetailContent('Tạo phiếu nhập') : null}
        {receipts ? (
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
                        header: <ManagementSortableHeader kind="number" sortKey="total_quantity" sortState={receiptSortState} onSort={requestReceiptSort}>Tổng số lượng</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => quantityText(receiptTotalQuantity(receipt)),
                      },
                      {
                        key: 'subtotal',
                        header: <ManagementSortableHeader kind="number" sortKey="subtotal_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Tổng tiền hàng</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.subtotal_amount} />,
                      },
                      {
                        key: 'payable',
                        header: <ManagementSortableHeader kind="number" sortKey="payable_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Cần trả NCC</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.payable_amount} />,
                      },
                      {
                        key: 'paid',
                        header: <ManagementSortableHeader kind="number" sortKey="paid_amount" sortState={receiptSortState} onSort={requestReceiptSort}>Tiền đã trả NCC</ManagementSortableHeader>,
                        headerIsCell: true,
                        cell: (receipt) => <MoneyText value={receipt.paid_amount} />,
                      },
                    ]}
                    detailClassName="management-detail-panel"
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
          ) : null}
      </ManagementListSurface>
      <PurchaseReceiptImportDialog
        open={importOpen}
        service={service}
        onClose={() => setImportOpen(false)}
        onImported={() => void loadReceipts({ page: 1, page_size: pageSize })}
        onOldDataDeleted={() => void loadReceipts({ page: 1, page_size: pageSize })}
      />
    </ManagementPage>
  )
}
