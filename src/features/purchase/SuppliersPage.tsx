import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Network, Pencil, Save, Search, StickyNote, WalletCards, X } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { formatKvDateTime } from '../../lib/date-format'
import type { Supplier, SupplierCustomerOption, SupplierFinanceAccount, SupplierPayableReceipt, SupplierStatus } from './types'
import type { SupplierInput, SupplierListFilters, SupplierService } from './supplier-service'
import { EmptyState, ManagementRecordLink, MetricCard, MetricGrid, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { appRoutes } from '../../app/routes'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDataTable,
  ManagementDetailActionFooter,
  ManagementDetailCard,
  ManagementDetailHeader,
  ManagementDetailInfoList,
  ManagementDetailInlineNote,
  ManagementDetailNote,
  ManagementDetailPanel,
  ManagementDetailSection,
  ManagementDetailSummary,
  ManagementInlineDetailTabs,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementImportButton,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, sortManagementItemsByDateDesc, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { useManagementSearch } from '../../lib/use-management-search'
import { formatPhoneDisplay } from '../../lib/phone-format'
import { supplierNumberFilterValue } from './supplier-filters'
import { supplierCreatedDateText, supplierCreatorLabel, supplierGroupLabel, supplierListSummary, supplierMoneyText } from './supplier-presenter'
import { SupplierImportDialog } from './SupplierImportDialog'
import type { PurchaseReceipt, PurchaseReceiptStatus } from './purchase-receipt-types'

const blankForm: SupplierInput = {
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

type SupplierSortKey = 'code' | 'created_at' | 'name' | 'phone' | 'current_payable_amount' | 'total_purchase_amount' | 'status'
const defaultSupplierSortState: NonNullable<ManagementSortState<SupplierSortKey>> = { key: 'created_at', direction: 'desc' }
type SupplierDetailTab = 'info' | 'history' | 'debt'

function SupplierCustomerLinkIcon() {
  return (
    <span aria-label="Có liên kết khách hàng" className="management-linked-partner-icon" title="Có liên kết khách hàng">
      <Network aria-hidden="true" size={16} />
    </span>
  )
}

function supplierToForm(supplier: Supplier): SupplierInput {
  return {
    code: supplier.code,
    name: supplier.name,
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    tax_code: supplier.tax_code ?? '',
    linked_customer_id: supplier.linked_customer_id,
    notes: supplier.notes ?? '',
    status: supplier.status,
  }
}

function supplierReceiptOutstanding(receipt: Pick<PurchaseReceipt, 'remaining_amount'>) {
  return Math.max(Number(receipt.remaining_amount || 0), 0)
}

function supplierReceiptBelongsToSupplier(receipt: PurchaseReceipt, supplier: Supplier) {
  return receipt.supplier_id === supplier.id
    || receipt.supplier.id === supplier.id
    || receipt.supplier.code === supplier.code
}

function supplierDebtLedgerHref(code: string) {
  if (/^PN\d/i.test(code)) return managementRecordOpenHref(appRoutes.purchaseReceipts, code)
  return managementRecordOpenHref('/finance', code)
}

function supplierReceiptStatusText(status: PurchaseReceiptStatus) {
  switch (status) {
    case 'posted':
      return 'Đã nhập'
    case 'cancelled':
      return 'Đã hủy'
    default:
      return 'Draft'
  }
}

export function SuppliersPage({
  service,
}: {
  service: SupplierService
  onOpenDashboard: () => void
}) {
  const [routeSearch] = useState(() => (new URLSearchParams(window.location.search).get('search') ?? '').trim())
  const [routeOpen] = useState(() => (new URLSearchParams(window.location.search).get('open') ?? '').trim())
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [customers, setCustomers] = useState<SupplierCustomerOption[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<SupplierFinanceAccount[]>([])
  const [customersLoaded, setCustomersLoaded] = useState(false)
  const [financeAccountsLoaded, setFinanceAccountsLoaded] = useState(false)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<{ current_payable_amount: number; total_purchase_amount: number } | null>(null)
  const supplierManagementSearch = useManagementSearch({ initialSearch: routeSearch })
  const search = supplierManagementSearch.draftSearch
  const [lastSearch, setLastSearch] = useState(routeSearch)
  const [status, setStatus] = useState<SupplierStatus | 'all'>('active')
  const [lastStatus, setLastStatus] = useState<SupplierStatus | 'all'>('active')
  const [totalPurchaseMin, setTotalPurchaseMin] = useState('')
  const [totalPurchaseMax, setTotalPurchaseMax] = useState('')
  const [currentPayableMin, setCurrentPayableMin] = useState('')
  const [currentPayableMax, setCurrentPayableMax] = useState('')
  const [lastTotalPurchaseMin, setLastTotalPurchaseMin] = useState('')
  const [lastTotalPurchaseMax, setLastTotalPurchaseMax] = useState('')
  const [lastCurrentPayableMin, setLastCurrentPayableMin] = useState('')
  const [lastCurrentPayableMax, setLastCurrentPayableMax] = useState('')
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [showFilters, setShowFilters] = useState(true)
  const [supplierImportOpen, setSupplierImportOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingSupplierId, setLoadingSupplierId] = useState<string | null>(null)
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [supplierDetailTab, setSupplierDetailTab] = useState<SupplierDetailTab>('info')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierInput>(blankForm)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null)
  const [payableReceipts, setPayableReceipts] = useState<SupplierPayableReceipt[]>([])
  const [supplierReceipts, setSupplierReceipts] = useState<PurchaseReceipt[]>([])
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [paymentFinanceAccountId, setPaymentFinanceAccountId] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const supplierSortInitialRender = useRef(true)
  const bankAccounts = financeAccounts.filter((account) => account.is_active && account.account_type === 'bank')
  const fallbackSupplierSummary = supplierListSummary(suppliers)
  const payableTotal = summary?.current_payable_amount ?? fallbackSupplierSummary.payableTotal
  const purchaseTotal = summary?.total_purchase_amount ?? fallbackSupplierSummary.purchaseTotal
  const {
    sortedItems: sortedSuppliers,
    sortState: supplierSortState,
    requestSort: requestSupplierSort,
  } = useManagementTableSort<Supplier, SupplierSortKey>(suppliers ?? [], {
    code: { kind: 'text', value: (supplier) => supplier.code },
    created_at: { kind: 'date', value: (supplier) => supplier.created_at ?? supplier.source_created_at },
    name: { kind: 'text', value: (supplier) => supplier.name },
    phone: { kind: 'text', value: (supplier) => supplier.phone },
    current_payable_amount: { kind: 'number', value: (supplier) => supplier.current_payable_amount },
    total_purchase_amount: { kind: 'number', value: (supplier) => supplier.total_purchase_amount },
    status: { kind: 'text', value: (supplier) => supplier.status },
  }, defaultSupplierSortState)
  const editingSupplier = editingId ? viewingSupplier ?? suppliers?.find((supplier) => supplier.id === editingId) ?? null : null
  const isCreatingSupplier = detailOpen && viewingSupplier === null && editingId === null && paymentSupplier === null

  async function loadSuppliers(
    input: SupplierListFilters & {
      totalPurchaseMinValue?: string
      totalPurchaseMaxValue?: string
      currentPayableMinValue?: string
      currentPayableMaxValue?: string
      sortStateValue?: ManagementSortState<SupplierSortKey>
    } = {
      search: lastSearch,
      status: lastStatus,
      totalPurchaseMinValue: lastTotalPurchaseMin,
      totalPurchaseMaxValue: lastTotalPurchaseMax,
      currentPayableMinValue: lastCurrentPayableMin,
      currentPayableMaxValue: lastCurrentPayableMax,
      page,
      page_size: pageSize,
    },
  ) {
    const nextSearch = input.search ?? lastSearch
    const nextStatus = input.status ?? lastStatus
    const nextTotalPurchaseMin = input.totalPurchaseMinValue ?? lastTotalPurchaseMin
    const nextTotalPurchaseMax = input.totalPurchaseMaxValue ?? lastTotalPurchaseMax
    const nextCurrentPayableMin = input.currentPayableMinValue ?? lastCurrentPayableMin
    const nextCurrentPayableMax = input.currentPayableMaxValue ?? lastCurrentPayableMax
    const nextSortState = input.sortStateValue ?? supplierSortState
    const nextPage = input.page ?? page
    const nextPageSize = input.page_size ?? pageSize
    setError(null)
    try {
      const totalPurchaseMinFilter = supplierNumberFilterValue(nextTotalPurchaseMin)
      const totalPurchaseMaxFilter = supplierNumberFilterValue(nextTotalPurchaseMax)
      const currentPayableMinFilter = supplierNumberFilterValue(nextCurrentPayableMin)
      const currentPayableMaxFilter = supplierNumberFilterValue(nextCurrentPayableMax)
      const result = await service.listSuppliers({
        page: nextPage,
        page_size: nextPageSize,
        search: nextSearch?.trim() || undefined,
        status: nextStatus,
        ...(totalPurchaseMinFilter === undefined ? {} : { total_purchase_min: totalPurchaseMinFilter }),
        ...(totalPurchaseMaxFilter === undefined ? {} : { total_purchase_max: totalPurchaseMaxFilter }),
        ...(currentPayableMinFilter === undefined ? {} : { current_payable_min: currentPayableMinFilter }),
        ...(currentPayableMaxFilter === undefined ? {} : { current_payable_max: currentPayableMaxFilter }),
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultSupplierSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
      })
      setSuppliers(result.items)
      setTotal(result.total)
      setSummary(result.summary ?? null)
      setLastSearch(nextSearch?.trim() ?? '')
      setLastStatus(nextStatus)
      setLastTotalPurchaseMin(nextTotalPurchaseMin)
      setLastTotalPurchaseMax(nextTotalPurchaseMax)
      setLastCurrentPayableMin(nextCurrentPayableMin)
      setLastCurrentPayableMax(nextCurrentPayableMax)
      setPage(result.page)
      setPageSize(result.page_size)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được nhà cung cấp.'))
    }
  }

  useEffect(() => {
    if (supplierSortInitialRender.current) {
      supplierSortInitialRender.current = false
      return
    }
    queueMicrotask(() => void loadSuppliers({ page: 1, sortStateValue: supplierSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierSortState?.key, supplierSortState?.direction])

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      setError(null)
      try {
        const supplierResult = await service.listSuppliers({
          search: routeSearch || routeOpen || undefined,
          status: 'active',
          page: 1,
          page_size: defaultPageSize,
        })
        if (!active) return
        setSuppliers(supplierResult.items)
        setTotal(supplierResult.total)
        setSummary(supplierResult.summary ?? null)
        setPage(supplierResult.page)
        setPageSize(supplierResult.page_size)
        if (routeOpen) {
          const openSupplierItem = supplierResult.items.find((supplier) => supplier.code === routeOpen || supplier.name === routeOpen)
          if (openSupplierItem) {
            await openSupplier(openSupplierItem)
          }
        }
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được nhà cung cấp.'))
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [defaultPageSize, routeOpen, routeSearch, service])

  async function ensureCustomersLoaded() {
    if (customersLoaded) return
    const result = await service.listCustomers()
    setCustomers(result.items)
    setCustomersLoaded(true)
  }

  async function ensureFinanceAccountsLoaded() {
    if (financeAccountsLoaded) return
    const result = await service.listFinanceAccounts()
    setFinanceAccounts(result.items)
    setFinanceAccountsLoaded(true)
  }

  async function filterSuppliers(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => {
      const nextSearch = search.trim()
      supplierManagementSearch.applySearch(nextSearch)
      return applySupplierSearch(nextSearch)
    })
  }

  function applySupplierSearch(nextSearch: string) {
    setPage(1)
    return loadSuppliers({
      search: nextSearch,
      status,
      totalPurchaseMinValue: totalPurchaseMin,
      totalPurchaseMaxValue: totalPurchaseMax,
      currentPayableMinValue: currentPayableMin,
      currentPayableMaxValue: currentPayableMax,
      page: 1,
    })
  }

  function changeSupplierSearch(nextSearch: string) {
    supplierManagementSearch.changeSearch(nextSearch)
    if (nextSearch.trim().length === 0) {
      supplierManagementSearch.applySearch('')
      void applySupplierSearch('')
    }
  }

  async function applySidebarFilters(
    nextFilters: Partial<{
      status: SupplierStatus | 'all'
      totalPurchaseMin: string
      totalPurchaseMax: string
      currentPayableMin: string
      currentPayableMax: string
    }>,
  ) {
    const nextStatus = nextFilters.status ?? status
    const nextTotalPurchaseMin = nextFilters.totalPurchaseMin ?? totalPurchaseMin
    const nextTotalPurchaseMax = nextFilters.totalPurchaseMax ?? totalPurchaseMax
    const nextCurrentPayableMin = nextFilters.currentPayableMin ?? currentPayableMin
    const nextCurrentPayableMax = nextFilters.currentPayableMax ?? currentPayableMax
    setStatus(nextStatus)
    setTotalPurchaseMin(nextTotalPurchaseMin)
    setTotalPurchaseMax(nextTotalPurchaseMax)
    setCurrentPayableMin(nextCurrentPayableMin)
    setCurrentPayableMax(nextCurrentPayableMax)
    setPage(1)
    await loadSuppliers({
      search: search.trim(),
      status: nextStatus,
      totalPurchaseMinValue: nextTotalPurchaseMin,
      totalPurchaseMaxValue: nextTotalPurchaseMax,
      currentPayableMinValue: nextCurrentPayableMin,
      currentPayableMaxValue: nextCurrentPayableMax,
      page: 1,
    })
  }

  async function goToPage(nextPage: number) {
    await loadSuppliers({ page: nextPage })
  }

  function closeSupplierDetail() {
    setDetailOpen(false)
    setViewingSupplier(null)
    setSupplierDetailTab('info')
    setPaymentSupplier(null)
    setSupplierReceipts([])
    setPayableReceipts([])
    setPaymentAmounts({})
    setEditingId(null)
    setForm(blankForm)
  }

  async function openSupplier(supplier: Supplier) {
    const isCurrentSupplierOpen =
      detailOpen &&
      (viewingSupplier?.id === supplier.id || editingId === supplier.id || paymentSupplier?.id === supplier.id)
    if (loadingSupplierId === supplier.id) return
    if (isCurrentSupplierOpen) {
      closeSupplierDetail()
      return
    }

    setError(null)
    setDetailOpen(false)
    setLoadingSupplierId(supplier.id)
    setViewingSupplier(null)
    setSupplierDetailTab('info')
    setPaymentSupplier(null)
    setSupplierReceipts([])
    setEditingId(null)
    setForm(blankForm)
    try {
      const [detail, receiptResult] = await Promise.all([
        service.getSupplier(supplier.id),
        service.listPurchaseReceipts(supplier),
      ])
      setDetailOpen(true)
      setViewingSupplier(detail)
      setSupplierReceipts(receiptResult.items)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết nhà cung cấp.'))
    } finally {
      setLoadingSupplierId(null)
    }
  }

  async function editSupplier(supplier: Supplier) {
    setError(null)
    try {
      await ensureCustomersLoaded()
      setPaymentSupplier(null)
      setViewingSupplier(supplier)
      setSupplierDetailTab('info')
      setEditingId(supplier.id)
      setDetailOpen(true)
      setForm(supplierToForm(supplier))
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được danh sách khách hàng.'))
    }
  }

  function closeSupplierEdit() {
    setEditingId(null)
    setForm(blankForm)
  }

  async function changePaymentMethod(nextMethod: 'cash' | 'bank_transfer') {
    setPaymentMethod(nextMethod)
    if (nextMethod !== 'bank_transfer') return
    try {
      await ensureFinanceAccountsLoaded()
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được tài khoản chuyển khoản.'))
    }
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editingId === null) {
        await service.createSupplier(form)
      } else {
        await service.updateSupplier(editingId, form)
      }
      setEditingId(null)
      setDetailOpen(false)
      setViewingSupplier(null)
      setSupplierReceipts([])
      setSupplierDetailTab('info')
      setForm(blankForm)
      await loadSuppliers()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được nhà cung cấp.'))
    } finally {
      setSaving(false)
    }
  }

  async function openSupplierPayment(supplier: Supplier) {
    setError(null)
    setPaymentSupplier(null)
    setDetailOpen(false)
    setLoadingSupplierId(supplier.id)
    setViewingSupplier(null)
    setSupplierReceipts([])
    setSupplierDetailTab('info')
    setEditingId(null)
    setForm(blankForm)
    setPayableReceipts([])
    setPaymentAmounts({})
    try {
      const result = await service.listPayableReceipts(supplier.id)
      setPaymentSupplier(supplier)
      setPayableReceipts(result.items)
      setPaymentAmounts(Object.fromEntries(result.items.map((receipt) => [receipt.id, receipt.outstanding_amount])))
      setPaymentMethod('cash')
      setPaymentFinanceAccountId('')
      setPaymentNote('')
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được phiếu nhập còn nợ.'))
    } finally {
      setLoadingSupplierId(null)
    }
  }

  async function saveSupplierPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (paymentSupplier === null) return

    const allocations = payableReceipts
      .map((receipt) => ({ receipt, amount: Number(paymentAmounts[receipt.id] || 0) }))
      .filter((item) => item.amount > 0)

    if (allocations.length === 0) {
      setError('Chọn ít nhất một phiếu nhập để thanh toán.')
      return
    }
    if (allocations.some((item) => item.amount > item.receipt.outstanding_amount)) {
      setError('Không được trả vượt số còn nợ của phiếu nhập.')
      return
    }
    if (paymentMethod === 'bank_transfer' && paymentFinanceAccountId === '') {
      setError('Chọn tài khoản chuyển khoản trước khi lưu thanh toán NCC.')
      return
    }

    setPaying(true)
    setError(null)
    try {
      await service.paySupplier(paymentSupplier.id, {
        payment_method: paymentMethod,
        ...(paymentMethod === 'bank_transfer' ? { finance_account_id: paymentFinanceAccountId } : {}),
        ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
        allocations: allocations.map((item) => ({
          purchase_receipt_id: item.receipt.id,
          amount: item.amount,
        })),
      })
      setPaymentSupplier(null)
      setPayableReceipts([])
      setPaymentAmounts({})
      await loadSuppliers()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được thanh toán NCC.'))
    } finally {
      setPaying(false)
    }
  }

  async function openCreateSupplier() {
    setEditingId(null)
    setPaymentSupplier(null)
    setViewingSupplier(null)
    setSupplierDetailTab('info')
    setDetailOpen(false)
    setLoadingSupplierId(null)
    setForm(blankForm)
    setError(null)
    try {
      await ensureCustomersLoaded()
      setDetailOpen(true)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được danh sách khách hàng.'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canGoPrevious = page > 1
  const canGoNext = page < totalPages
  const activeFilterSummary = lastStatus === 'active' &&
        lastTotalPurchaseMin === '' &&
        lastTotalPurchaseMax === '' &&
        lastCurrentPayableMin === '' &&
        lastCurrentPayableMax === ''
      ? 'Đang hoạt động'
      : 'Bộ lọc nhà cung cấp'

  const supplierKpis = (
    <MetricGrid ariaLabel="Tổng quan nhà cung cấp">
        <MetricCard hint="Theo bộ lọc hiện tại" label="Nợ cần trả" tone={payableTotal > 0 ? 'warning' : 'neutral'} value={<MoneyText value={payableTotal} />} />
        <MetricCard hint="Theo bộ lọc hiện tại" label="Tổng mua" tone="success" value={<MoneyText value={purchaseTotal} />} />
      </MetricGrid>
  )

  function supplierForm() {
    const detailSupplier = editingSupplier ?? viewingSupplier
    const isEditingSupplier = editingId !== null
    const detailTitle = isEditingSupplier
      ? 'Sửa nhà cung cấp'
      : detailSupplier
        ? 'Thông tin nhà cung cấp'
        : 'Thêm nhà cung cấp'
    const supplierStatus = isEditingSupplier ? (form.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động') : detailSupplier?.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'
    const currentSupplierReceipts = detailSupplier
      ? sortManagementItemsByDateDesc(
          supplierReceipts.filter((receipt) => supplierReceiptBelongsToSupplier(receipt, detailSupplier)),
          (receipt) => receipt.received_at,
        )
      : []
    const currentSupplierDebtReceipts = currentSupplierReceipts.filter((receipt) => supplierReceiptOutstanding(receipt) > 0)
    const supplierDebtLedgerRows = detailSupplier?.debt_ledger_rows?.length
      ? [...detailSupplier.debt_ledger_rows].reverse()
      : []

    return (
      <ManagementDetailPanel>
        {detailSupplier && !isEditingSupplier ? (
          <ManagementInlineDetailTabs
            activeKey={supplierDetailTab}
            ariaLabel="Chi tiết nhà cung cấp"
            tabs={[
              { key: 'info', label: 'Thông tin' },
              { key: 'history', label: 'Lịch sử' },
              { key: 'debt', label: 'Nợ' },
            ]}
            onSelect={(key) => setSupplierDetailTab(key as SupplierDetailTab)}
          />
        ) : null}
        {!detailSupplier || isEditingSupplier ? <ManagementDetailHeader title={detailTitle} /> : null}
        {detailSupplier ? (
          <ManagementDetailSummary
            ariaLabel="Tóm tắt nhà cung cấp"
            code={detailSupplier.code}
            metaAriaLabel="Thông tin tạo nhà cung cấp"
            metaItems={[
              { label: 'Người tạo:', value: supplierCreatorLabel(detailSupplier) },
              { label: 'Ngày tạo:', value: supplierCreatedDateText(detailSupplier) },
              { label: 'Nhóm nhà cung cấp:', value: supplierGroupLabel(detailSupplier) },
            ]}
              title={detailSupplier.name}
          />
        ) : null}
        {detailSupplier && !isEditingSupplier && supplierDetailTab === 'info' ? (
          <ManagementDetailSection ariaLabel="Thông tin nhanh nhà cung cấp" role="tabpanel">
            <ManagementDetailInfoList
              columns="three"
              items={[
                { label: 'Điện thoại', value: formatPhoneDisplay(detailSupplier.phone) },
                { label: 'Email', value: detailSupplier.email ?? '' },
                { label: 'MST', value: detailSupplier.tax_code ?? '' },
                { label: 'Địa chỉ', value: detailSupplier.address ?? '', span: 3 },
              ]}
            />
            {detailSupplier.linked_customer ? (
              <ManagementDetailCard
                ariaLabel="Khách hàng đồng thời là Nhà cung cấp"
                title="Khách hàng đồng thời là Nhà cung cấp"
              >
                <p>
                  <span className="management-detail-meta-label">Khách hàng liên kết:</span>{' '}
                  <ManagementRecordLink href={managementRecordOpenHref('/customers', detailSupplier.linked_customer.code)}>
                    {detailSupplier.linked_customer.code} - {detailSupplier.linked_customer.name}
                  </ManagementRecordLink>
                </p>
                <p>
                  Gộp khách hàng {detailSupplier.linked_customer.code} - {detailSupplier.linked_customer.name} và nhà cung cấp {detailSupplier.code} - {detailSupplier.name}
                  {detailSupplier.created_at ? ` vào ${formatKvDateTime(detailSupplier.created_at)}` : ''}
                </p>
              </ManagementDetailCard>
            ) : null}
            <ManagementDetailNote icon={<StickyNote aria-hidden="true" size={16} />} value={detailSupplier.notes} />
          </ManagementDetailSection>
        ) : null}
        {detailSupplier && !isEditingSupplier && supplierDetailTab === 'history' ? (
          <ManagementDetailSection ariaLabel="Lịch sử nhập/trả hàng của NCC này" role="tabpanel">
            {currentSupplierReceipts.length === 0 ? (
              <ManagementDetailInlineNote>Chưa có phiếu nhập đã hoàn thành cho nhà cung cấp này.</ManagementDetailInlineNote>
            ) : (
              <table aria-label="Lịch sử nhập hàng của NCC này" className="management-detail-table management-detail-linked-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Thời gian</th>
                    <th>Người tạo</th>
                    <th>Tổng cộng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSupplierReceipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td>
                        <ManagementRecordLink href={managementRecordOpenHref(appRoutes.purchaseReceipts, receipt.code)}>
                          {receipt.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{formatKvDateTime(receipt.received_at)}</td>
                      <td>{receipt.created_by.name}</td>
                      <td><MoneyText value={receipt.payable_amount} /></td>
                      <td>
                        <StatusChip tone={receipt.status === 'posted' ? 'success' : receipt.status === 'cancelled' ? 'danger' : 'neutral'}>
                          {supplierReceiptStatusText(receipt.status)}
                        </StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ManagementDetailSection>
        ) : null}
        {detailSupplier && !isEditingSupplier && supplierDetailTab === 'debt' ? (
          <ManagementDetailSection ariaLabel="Nợ cần trả của NCC này" role="tabpanel">
            <ManagementDetailInfoList
              columns="three"
              items={[
                { label: 'Nợ cần trả hiện tại', value: supplierMoneyText(detailSupplier.current_payable_amount) },
                { label: 'Tổng mua', value: supplierMoneyText(detailSupplier.total_purchase_amount) },
                { label: 'Trạng thái', value: supplierStatus },
              ]}
            />
            {supplierDebtLedgerRows.length > 0 ? (
              <table aria-label="Lịch sử công nợ NCC" className="management-detail-table management-detail-linked-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Thời gian</th>
                    <th>Giá trị</th>
                    <th>Công nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierDebtLedgerRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <ManagementRecordLink href={supplierDebtLedgerHref(row.code)}>
                          {row.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{formatKvDateTime(row.created_at)}</td>
                      <td><MoneyText value={row.amount_delta} /></td>
                      <td><MoneyText value={row.balance_after} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : currentSupplierDebtReceipts.length === 0 ? (
              <ManagementDetailInlineNote>Không còn phiếu nhập đang nợ cho nhà cung cấp này.</ManagementDetailInlineNote>
            ) : (
              <table aria-label="Danh sách phiếu nợ của NCC này" className="management-detail-table management-detail-linked-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Thời gian</th>
                    <th>Người tạo</th>
                    <th>Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSupplierDebtReceipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td>
                        <ManagementRecordLink href={managementRecordOpenHref(appRoutes.purchaseReceipts, receipt.code)}>
                          {receipt.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{formatKvDateTime(receipt.received_at)}</td>
                      <td>{receipt.created_by.name}</td>
                      <td><MoneyText value={receipt.payable_amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ManagementDetailSection>
        ) : null}
        {detailSupplier && !isEditingSupplier ? (
          <ManagementDetailActionFooter
            leftActions={[
              ...(detailSupplier.current_payable_amount > 0
                ? [{
                    label: 'Thanh toán NCC',
                    icon: <WalletCards aria-hidden="true" size={15} />,
                    variant: 'secondary' as const,
                    onClick: () => void openSupplierPayment(detailSupplier),
                  }]
                : []),
            ]}
            rightActions={[
              {
                label: 'Chỉnh sửa',
                icon: <Pencil aria-hidden="true" size={15} />,
                variant: 'secondary',
                onClick: () => void editSupplier(detailSupplier),
              },
            ]}
          />
        ) : null}
        {(isEditingSupplier || detailSupplier === null) ? (
          <ManagementDetailSection ariaLabel="Biểu mẫu nhà cung cấp">
            <form aria-label="Thông tin nhà cung cấp" className="supplier-form" onSubmit={saveSupplier}>
              <label>
                Mã NCC
                <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
              </label>
              <label>
                Tên NCC
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Điện thoại
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label>
                Email
                <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label>
                Địa chỉ
                <input
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <label>
                Mã số thuế
                <input
                  value={form.tax_code}
                  onChange={(event) => setForm((current) => ({ ...current, tax_code: event.target.value }))}
                />
              </label>
              <label>
                Ghi chú
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <label>
                Khách hàng liên kết
                <select
                  value={form.linked_customer_id ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, linked_customer_id: event.target.value || null }))
                  }
                >
                  <option value="">Không liên kết</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.code} - {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trạng thái NCC
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SupplierStatus }))}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </label>
              <div className="row-actions">
                {isEditingSupplier ? (
                  <button className="button button-secondary" type="button" onClick={closeSupplierEdit}>
                    <X aria-hidden="true" size={15} />
                    Hủy chỉnh sửa
                  </button>
                ) : null}
                <button className="button button-primary" disabled={saving} type="submit">
                  <Save aria-hidden="true" size={16} />
                  Lưu nhà cung cấp
                </button>
              </div>
            </form>
          </ManagementDetailSection>
        ) : null}
      </ManagementDetailPanel>
    )
  }

  function supplierPaymentForm() {
    if (!paymentSupplier) return null
    return (
      <ManagementDetailPanel>
        <ManagementDetailHeader
          title={`Thanh toán ${paymentSupplier.code}`}
          endAction={(
            <button className="button button-secondary" type="button" onClick={() => setPaymentSupplier(null)}>
              <X aria-hidden="true" size={15} />
              Đóng
            </button>
          )}
        />
        <ManagementDetailSummary
          ariaLabel="Tóm tắt thanh toán nhà cung cấp"
          code={paymentSupplier.code}
          title={paymentSupplier.name}
        />
        <ManagementDetailSection ariaLabel="Biểu mẫu thanh toán nhà cung cấp">
          <form noValidate aria-label="Thanh toán nhà cung cấp" className="supplier-form" onSubmit={saveSupplierPayment}>
        {payableReceipts.length === 0 ? (
          <p>Không còn phiếu nhập posted cần trả cho NCC này.</p>
        ) : (
          <div className="receipt-lines">
            {sortManagementItemsByDateDesc(payableReceipts, (receipt) => receipt.received_at).map((receipt) => (
              <fieldset key={receipt.id}>
                <legend>{receipt.code}</legend>
                <p>Còn nợ: {supplierMoneyText(receipt.outstanding_amount)}</p>
                <label>
                  Số tiền trả cho {receipt.code}
                  <input
                    min="0"
                    max={receipt.outstanding_amount}
                    step="1000"
                    type="number"
                    value={paymentAmounts[receipt.id] ?? 0}
                    onChange={(event) =>
                      setPaymentAmounts((current) => ({ ...current, [receipt.id]: Number(event.target.value) }))
                    }
                  />
                </label>
              </fieldset>
            ))}
          </div>
        )}
        <label>
          Phương thức trả NCC
          <select value={paymentMethod} onChange={(event) => void changePaymentMethod(event.target.value as 'cash' | 'bank_transfer')}>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
          </select>
        </label>
        {paymentMethod === 'bank_transfer' ? (
          <label>
            Tài khoản chuyển khoản NCC
            <select value={paymentFinanceAccountId} onChange={(event) => setPaymentFinanceAccountId(event.target.value)}>
              <option value="">Chọn tài khoản</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Ghi chú thanh toán
          <textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
        </label>
        <button className="button button-primary" disabled={paying || payableReceipts.length === 0} type="submit">
          <WalletCards aria-hidden="true" size={16} />
          Lưu thanh toán NCC
        </button>
          </form>
        </ManagementDetailSection>
      </ManagementDetailPanel>
    )
  }

  function supplierDetailLoading() {
    return (
      <ManagementDetailPanel>
        <ManagementDetailInlineNote>Đang tải chi tiết nhà cung cấp...</ManagementDetailInlineNote>
      </ManagementDetailPanel>
    )
  }

  return (
    <ManagementPage
      title="Nhà cung cấp"
      actions={
        <ManagementCompactToolbar ariaLabel="Lọc nhà cung cấp" onSubmit={filterSuppliers}>
          <ManagementCompactSearch
            label="Tìm NCC"
            leadingIcon={<Search aria-hidden="true" size={16} />}
            placeholder="Tìm mã, tên, điện thoại"
            trailingAction={
              <ManagementCompactCreateAction ariaLabel="Tạo nhà cung cấp" onClick={() => void openCreateSupplier()} />
            }
            value={search}
            onChange={changeSupplierSearch}
          />
          <ManagementImportButton onClick={() => setSupplierImportOpen(true)}>Import</ManagementImportButton>
        </ManagementCompactToolbar>
      }
      kpis={supplierKpis}
      filter={
        <ManagementFilterSidebar
          activeSummary={activeFilterSummary}
          ariaLabel="Bộ lọc nhà cung cấp"
          title="Bộ lọc"
        >
          <button
            aria-label="Ẩn bộ lọc nhà cung cấp"
            className="management-filter-collapse-button"
            title="Ẩn bộ lọc"
            type="button"
            onClick={() => setShowFilters(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <ManagementFilterGroup title="Tổng mua">
            <label>
              <span className="sr-only">Tổng mua từ</span>
              <input
                aria-label="Tổng mua từ"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Từ"
                type="number"
                value={totalPurchaseMin}
                onChange={(event) => void applySidebarFilters({ totalPurchaseMin: event.target.value })}
              />
            </label>
            <label>
              <span className="sr-only">Tổng mua tới</span>
              <input
                aria-label="Tổng mua tới"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Tới"
                type="number"
                value={totalPurchaseMax}
                onChange={(event) => void applySidebarFilters({ totalPurchaseMax: event.target.value })}
              />
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Nợ hiện tại">
            <label>
              <span className="sr-only">Nợ hiện tại từ</span>
              <input
                aria-label="Nợ hiện tại từ"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Từ"
                type="number"
                value={currentPayableMin}
                onChange={(event) => void applySidebarFilters({ currentPayableMin: event.target.value })}
              />
            </label>
            <label>
              <span className="sr-only">Nợ hiện tại tới</span>
              <input
                aria-label="Nợ hiện tại tới"
                className="management-filter-number-input"
                inputMode="numeric"
                min="0"
                placeholder="Tới"
                type="number"
                value={currentPayableMax}
                onChange={(event) => void applySidebarFilters({ currentPayableMax: event.target.value })}
              />
            </label>
          </ManagementFilterGroup>
          <ManagementFilterGroup title="Trạng thái">
            <label>
              <span className="sr-only">Trạng thái</span>
              <select
                aria-label="Trạng thái"
                className="management-filter-select"
                value={status}
                onChange={(event) => void applySidebarFilters({ status: event.target.value as SupplierStatus | 'all' })}
              >
                <option value="all">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </label>
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
      }
      filterVisible={showFilters}
      filterCollapsedControl={
        <button
          aria-label="Mở bộ lọc nhà cung cấp"
          className="management-filter-expand-button"
          title="Mở bộ lọc"
          type="button"
          onClick={() => setShowFilters(true)}
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      }
    >
      <ManagementListSurface ariaLabel="Danh sách nhà cung cấp">
        {error ? <p role="alert">{error}</p> : null}
        {suppliers === null && error === null ? <p>Đang tải nhà cung cấp...</p> : null}
        {isCreatingSupplier ? supplierForm() : null}
        {suppliers ? (
          suppliers.length === 0 ? (
            <EmptyState>
              <p>Chưa có nhà cung cấp phù hợp bộ lọc.</p>
            </EmptyState>
          ) : (
            <>
              <ManagementTableViewport>
                <ManagementDataTable
                  ariaLabel="Danh sách nhà cung cấp"
                  columns={[
                    {
                      key: 'code',
                      header: <ManagementSortableHeader kind="text" sortKey="code" sortState={supplierSortState} onSort={requestSupplierSort}>Mã NCC</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => (
                        <button
                          aria-label={supplier.code}
                          className="management-link-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void openSupplier(supplier)
                          }}
                        >
                          {supplier.linked_customer ? <SupplierCustomerLinkIcon /> : null}
                          <strong>{supplier.code}</strong>
                        </button>
                      ),
                    },
                    {
                      key: 'name',
                      header: <ManagementSortableHeader kind="text" sortKey="name" sortState={supplierSortState} onSort={requestSupplierSort}>Tên NCC</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => supplier.name,
                    },
                    {
                      key: 'phone',
                      header: <ManagementSortableHeader kind="text" sortKey="phone" sortState={supplierSortState} onSort={requestSupplierSort}>Điện thoại</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => formatPhoneDisplay(supplier.phone),
                    },
                    {
                      key: 'payable',
                      header: <ManagementSortableHeader kind="number" sortKey="current_payable_amount" sortState={supplierSortState} onSort={requestSupplierSort}>Nợ hiện tại</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => <MoneyText value={supplier.current_payable_amount} />,
                    },
                    {
                      key: 'purchase',
                      header: <ManagementSortableHeader kind="number" sortKey="total_purchase_amount" sortState={supplierSortState} onSort={requestSupplierSort}>Tổng mua</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => <MoneyText value={supplier.total_purchase_amount} />,
                    },
                    {
                      key: 'status',
                      header: <ManagementSortableHeader kind="text" sortKey="status" sortState={supplierSortState} onSort={requestSupplierSort}>Trạng thái</ManagementSortableHeader>,
                      headerIsCell: true,
                      cell: (supplier) => (
                        <StatusChip tone={supplier.status === 'active' ? 'success' : 'neutral'}>
                          {supplier.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </StatusChip>
                      ),
                    },
                  ]}
                  getDetailLabel={() => 'Hồ sơ và thanh toán nhà cung cấp'}
                  getRowKey={(supplier) => supplier.id}
                  items={sortedSuppliers}
                  selectedRowKey={loadingSupplierId ?? editingId ?? paymentSupplier?.id ?? viewingSupplier?.id}
                  renderDetail={(supplier) => {
                    const detailForRow = editingId === supplier.id || paymentSupplier?.id === supplier.id || viewingSupplier?.id === supplier.id
                    const loadingForRow = loadingSupplierId === supplier.id
                    if (!detailForRow && !loadingForRow) return null
                    return loadingForRow
                      ? supplierDetailLoading()
                      : paymentSupplier?.id === supplier.id
                        ? supplierPaymentForm()
                        : supplierForm()
                  }}
                  onRowClick={(supplier) => void openSupplier(supplier)}
                  onRowKeyDown={(supplier, event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void openSupplier(supplier)
                    }
                  }}
                />
              </ManagementTableViewport>
              <ManagementTableFooter
                ariaLabel="Phân trang nhà cung cấp"
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                entityLabel="nhà cung cấp"
                page={page}
                pageSize={pageSize}
                total={total}
                onFirst={() => void goToPage(1)}
                onLast={() => void goToPage(totalPages)}
                onNext={() => void goToPage(page + 1)}
                onPageChange={(nextPage) => void goToPage(nextPage)}
                onPageSizeChange={(nextPageSize) => void loadSuppliers({ page: 1, page_size: nextPageSize })}
                onPrevious={() => void goToPage(page - 1)}
              />
            </>
          )
        ) : null}
      </ManagementListSurface>
      <SupplierImportDialog
        open={supplierImportOpen}
        service={service}
        onClose={() => setSupplierImportOpen(false)}
        onOldDataDeleted={() => void loadSuppliers({ page: 1 })}
        onImported={() => {
          setSupplierImportOpen(false)
          void loadSuppliers({ page: 1 })
        }}
      />
    </ManagementPage>
  )
}
