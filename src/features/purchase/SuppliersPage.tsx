import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Save, Search, WalletCards, X } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { Supplier, SupplierCustomerOption, SupplierFinanceAccount, SupplierPayableReceipt, SupplierStatus } from './types'
import type { SupplierInput, SupplierListFilters, SupplierService } from './supplier-service'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'

function money(value: number) {
  return formatMoney(value)
}

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

const supplierPageSize = 15

function numberFilterValue(value: string) {
  const parsed = Number(value)
  return value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed
}

export function SuppliersPage({
  service,
}: {
  service: SupplierService
  onOpenDashboard: () => void
}) {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [customers, setCustomers] = useState<SupplierCustomerOption[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<SupplierFinanceAccount[]>([])
  const [customersLoaded, setCustomersLoaded] = useState(false)
  const [financeAccountsLoaded, setFinanceAccountsLoaded] = useState(false)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [supplierSearchSuggestions, setSupplierSearchSuggestions] = useState<Supplier[]>([])
  const [supplierSearchSuggestionsOpen, setSupplierSearchSuggestionsOpen] = useState(false)
  const [lastSearch, setLastSearch] = useState('')
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(supplierPageSize)
  const [showFilters, setShowFilters] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingSupplierId, setLoadingSupplierId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierInput>(blankForm)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null)
  const [payableReceipts, setPayableReceipts] = useState<SupplierPayableReceipt[]>([])
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [paymentFinanceAccountId, setPaymentFinanceAccountId] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const supplierSearchRequestId = useRef(0)

  const bankAccounts = financeAccounts.filter((account) => account.is_active && account.account_type === 'bank')
  const payableTotal = suppliers?.reduce((sum, supplier) => sum + supplier.current_payable_amount, 0) ?? 0
  const purchaseTotal = suppliers?.reduce((sum, supplier) => sum + supplier.total_purchase_amount, 0) ?? 0
  const isCreatingSupplier = detailOpen && editingId === null && paymentSupplier === null
  const activeDetailSupplier = suppliers?.find((supplier) => supplier.id === editingId) ?? null

  async function loadSuppliers(
    input: SupplierListFilters & {
      totalPurchaseMinValue?: string
      totalPurchaseMaxValue?: string
      currentPayableMinValue?: string
      currentPayableMaxValue?: string
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
    const nextPage = input.page ?? page
    const nextPageSize = input.page_size ?? pageSize
    setError(null)
    try {
      const totalPurchaseMinFilter = numberFilterValue(nextTotalPurchaseMin)
      const totalPurchaseMaxFilter = numberFilterValue(nextTotalPurchaseMax)
      const currentPayableMinFilter = numberFilterValue(nextCurrentPayableMin)
      const currentPayableMaxFilter = numberFilterValue(nextCurrentPayableMax)
      const result = await service.listSuppliers({
        page: nextPage,
        page_size: nextPageSize,
        search: nextSearch?.trim() || undefined,
        status: nextStatus,
        ...(totalPurchaseMinFilter === undefined ? {} : { total_purchase_min: totalPurchaseMinFilter }),
        ...(totalPurchaseMaxFilter === undefined ? {} : { total_purchase_max: totalPurchaseMaxFilter }),
        ...(currentPayableMinFilter === undefined ? {} : { current_payable_min: currentPayableMinFilter }),
        ...(currentPayableMaxFilter === undefined ? {} : { current_payable_max: currentPayableMaxFilter }),
      })
      setSuppliers(result.items)
      setTotal(result.total)
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
    let active = true

    async function loadInitialData() {
      setError(null)
      try {
        const supplierResult = await service.listSuppliers({ status: 'active', page: 1, page_size: supplierPageSize })
        if (!active) return
        setSuppliers(supplierResult.items)
        setTotal(supplierResult.total)
        setPage(supplierResult.page)
        setPageSize(supplierResult.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được nhà cung cấp.'))
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [service])

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
    event.preventDefault()
    setSupplierSearchSuggestionsOpen(false)
    setPage(1)
    await loadSuppliers({
      search: search.trim(),
      status,
      totalPurchaseMinValue: totalPurchaseMin,
      totalPurchaseMaxValue: totalPurchaseMax,
      currentPayableMinValue: currentPayableMin,
      currentPayableMaxValue: currentPayableMax,
      page: 1,
    })
  }

  async function suggestSuppliers(nextSearch: string) {
    setSearch(nextSearch)
    const query = nextSearch.trim()
    const requestId = supplierSearchRequestId.current + 1
    supplierSearchRequestId.current = requestId
    if (query.length === 0) {
      setSupplierSearchSuggestions([])
      setSupplierSearchSuggestionsOpen(false)
      return
    }
    try {
      const totalPurchaseMinFilter = numberFilterValue(totalPurchaseMin)
      const totalPurchaseMaxFilter = numberFilterValue(totalPurchaseMax)
      const currentPayableMinFilter = numberFilterValue(currentPayableMin)
      const currentPayableMaxFilter = numberFilterValue(currentPayableMax)
      const result = await service.listSuppliers({
        search: query,
        status,
        page: 1,
        page_size: 8,
        ...(totalPurchaseMinFilter === undefined ? {} : { total_purchase_min: totalPurchaseMinFilter }),
        ...(totalPurchaseMaxFilter === undefined ? {} : { total_purchase_max: totalPurchaseMaxFilter }),
        ...(currentPayableMinFilter === undefined ? {} : { current_payable_min: currentPayableMinFilter }),
        ...(currentPayableMaxFilter === undefined ? {} : { current_payable_max: currentPayableMaxFilter }),
      })
      if (supplierSearchRequestId.current !== requestId) return
      setSupplierSearchSuggestions(result.items)
      setSupplierSearchSuggestionsOpen(true)
    } catch {
      if (supplierSearchRequestId.current !== requestId) return
      setSupplierSearchSuggestions([])
      setSupplierSearchSuggestionsOpen(false)
    }
  }

  async function selectSupplierSuggestion(supplier: Supplier) {
    setSearch(supplier.code)
    setSupplierSearchSuggestionsOpen(false)
    setPage(1)
    await loadSuppliers({
      search: supplier.code,
      status,
      totalPurchaseMinValue: totalPurchaseMin,
      totalPurchaseMaxValue: totalPurchaseMax,
      currentPayableMinValue: currentPayableMin,
      currentPayableMaxValue: currentPayableMax,
      page: 1,
    })
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

  async function openSupplier(supplier: Supplier) {
    setError(null)
    setDetailOpen(false)
    setLoadingSupplierId(supplier.id)
    setPaymentSupplier(null)
    setEditingId(null)
    setForm(blankForm)
    try {
      const [detail] = await Promise.all([service.getSupplier(supplier.id), ensureCustomersLoaded()])
      setDetailOpen(true)
      setEditingId(detail.id)
      setForm({
        code: detail.code,
        name: detail.name,
        phone: detail.phone ?? '',
        email: detail.email ?? '',
        address: detail.address ?? '',
        tax_code: detail.tax_code ?? '',
        linked_customer_id: detail.linked_customer_id,
        notes: detail.notes ?? '',
        status: detail.status,
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết nhà cung cấp.'))
    } finally {
      setLoadingSupplierId(null)
    }
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

  function resetForm() {
    setEditingId(null)
    setDetailOpen(true)
    setPaymentSupplier(null)
    setForm(blankForm)
  }

  async function openCreateSupplier() {
    setEditingId(null)
    setPaymentSupplier(null)
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
  const activeFilterSummary = lastSearch
    ? `Tìm: ${lastSearch}`
    : lastStatus === 'active' &&
        lastTotalPurchaseMin === '' &&
        lastTotalPurchaseMax === '' &&
        lastCurrentPayableMin === '' &&
        lastCurrentPayableMax === ''
      ? 'Đang hoạt động'
      : 'Bộ lọc nhà cung cấp'

  const supplierKpis = (
    <MetricGrid ariaLabel="Tổng quan nhà cung cấp">
        <MetricCard hint="Từ danh sách đang xem" label="Nợ cần trả" tone={payableTotal > 0 ? 'warning' : 'neutral'} value={<MoneyText value={payableTotal} />} />
        <MetricCard hint="Phiếu nhập posted" label="Tổng mua" tone="success" value={<MoneyText value={purchaseTotal} />} />
      </MetricGrid>
  )

  function supplierForm() {
    return (
      <form aria-label="Thông tin nhà cung cấp" className="supplier-form" onSubmit={saveSupplier}>
        <header>
          <h2>{editingId ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2>
          <div className="row-actions">
            {activeDetailSupplier && activeDetailSupplier.current_payable_amount > 0 ? (
              <button className="button button-secondary" type="button" onClick={() => void openSupplierPayment(activeDetailSupplier)}>
                <WalletCards aria-hidden="true" size={15} />
                Thanh toán NCC
              </button>
            ) : null}
            {editingId ? (
              <button className="button button-secondary" type="button" onClick={resetForm}>
                <Plus aria-hidden="true" size={15} />
                Tạo mới
              </button>
            ) : null}
          </div>
        </header>
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
          Ghi chú
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
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
        <button className="button button-primary" disabled={saving} type="submit">
          <Save aria-hidden="true" size={16} />
          Lưu nhà cung cấp
        </button>
      </form>
    )
  }

  function supplierPaymentForm() {
    if (!paymentSupplier) return null
    return (
      <form noValidate aria-label="Thanh toán nhà cung cấp" className="supplier-form" onSubmit={saveSupplierPayment}>
        <header>
          <h2>Thanh toán {paymentSupplier.code}</h2>
          <button className="button button-secondary" type="button" onClick={() => setPaymentSupplier(null)}>
            <X aria-hidden="true" size={15} />
            Đóng
          </button>
        </header>
        {payableReceipts.length === 0 ? (
          <p>Không còn phiếu nhập posted cần trả cho NCC này.</p>
        ) : (
          <div className="receipt-lines">
            {payableReceipts.map((receipt) => (
              <fieldset key={receipt.id}>
                <legend>{receipt.code}</legend>
                <p>Còn nợ: {money(receipt.outstanding_amount)}</p>
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
    )
  }

  function supplierDetailLoading(supplier: Supplier) {
    return (
      <section aria-label={`Đang tải ${supplier.code}`} className="management-detail-panel" role="region">
        <p>Đang tải chi tiết nhà cung cấp...</p>
      </section>
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
            suggestions={
              supplierSearchSuggestionsOpen
                ? supplierSearchSuggestions.map((supplier) => ({
                    id: supplier.id,
                    primary: `${supplier.code} ${supplier.name}`,
                    secondary: supplier.phone ?? supplier.email ?? '',
                    meta: <MoneyText value={supplier.current_payable_amount} />,
                    ariaLabel: `${supplier.code} ${supplier.name} ${supplier.phone ?? ''}`.trim(),
                  }))
                : undefined
            }
            suggestionsLabel="Gợi ý nhà cung cấp"
            emptySuggestion="Không có kết quả phù hợp"
            onChange={(nextSearch) => void suggestSuppliers(nextSearch)}
            onSuggestionSelect={(suggestion) => {
              const supplier = supplierSearchSuggestions.find((candidate) => candidate.id === suggestion.id)
              if (supplier) void selectSupplierSuggestion(supplier)
            }}
          />
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
                <table>
                  <thead>
                    <tr>
                      <th>Mã NCC</th>
                      <th>Tên NCC</th>
                      <th>Điện thoại</th>
                      <th>Email</th>
                      <th>Nợ hiện tại</th>
                      <th>Tổng mua</th>
                      <th>Khách hàng liên kết</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => {
                      const detailForRow = editingId === supplier.id || paymentSupplier?.id === supplier.id
                      const loadingForRow = loadingSupplierId === supplier.id
                      return (
                        <Fragment key={supplier.id}>
                          <tr
                            aria-expanded={detailForRow || loadingForRow}
                            className={`management-data-row${detailForRow || loadingForRow ? ' management-data-row-selected' : ''}`}
                            tabIndex={0}
                            onClick={() => void openSupplier(supplier)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                void openSupplier(supplier)
                              }
                            }}
                          >
                            <td>
                              <button
                                className="management-link-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void openSupplier(supplier)
                                }}
                              >
                                <strong>{supplier.code}</strong>
                              </button>
                            </td>
                            <td>{supplier.name}</td>
                            <td>{supplier.phone ?? '-'}</td>
                            <td>{supplier.email ?? '-'}</td>
                            <td><MoneyText value={supplier.current_payable_amount} /></td>
                            <td><MoneyText value={supplier.total_purchase_amount} /></td>
                            <td>
                              {supplier.linked_customer
                                ? `${supplier.linked_customer.code} - ${supplier.linked_customer.name}`
                                : '-'}
                            </td>
                            <td>
                              <StatusChip tone={supplier.status === 'active' ? 'success' : 'neutral'}>
                                  {supplier.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                                </StatusChip>
                              </td>
                          </tr>
                          {detailForRow || loadingForRow ? (
                            <ManagementDetailRow
                              colSpan={8}
                              detailClassName="management-detail-panel"
                              label="Hồ sơ và thanh toán nhà cung cấp"
                            >
                              {loadingForRow
                                ? supplierDetailLoading(supplier)
                                : paymentSupplier?.id === supplier.id
                                  ? supplierPaymentForm()
                                  : supplierForm()}
                            </ManagementDetailRow>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
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
                onPageSizeChange={(nextPageSize) => void loadSuppliers({ page: 1, page_size: nextPageSize })}
                onPrevious={() => void goToPage(page - 1)}
              />
            </>
          )
        ) : null}
      </ManagementListSurface>
    </ManagementPage>
  )
}
