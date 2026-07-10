import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, Edit3, Info, Pin, WalletCards, X } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementDateRangeInputs,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import type {
  CashbookBusinessAccountedFilter,
  CashbookColumnKey,
  CashbookDirection,
  CashbookEntry,
  CashbookEntryDetail,
  CashbookSearchScope,
  CashbookStatus,
  CashbookVoucher,
  CreateCashbookVoucherInput,
  CustomerDebtDetail,
  CustomerDebtSummary,
  FinanceAccount,
  CashbookBalance,
  PartnerDebtMode,
} from './types'
import type { FinanceService } from './finance-service'
import { buildCashbookCsv } from './finance-service'
import { currentMonthRange } from '../../lib/date-ranges'
import {
  accountTypeText,
  bankAccountDisplayText,
  businessAccountedText,
  cashbookCounterpartyDisplayName,
  cashbookCounterpartyLabel,
  cashbookEntryNeedsCounterpartyHydration,
  cashFirstAccountSort,
  cashbookLinkedDocumentCode,
  financeAccountChoiceLabel,
  financeDateText as dateText,
  sourceTypeText,
  statusText,
  voucherTypeOptions,
} from './finance-presenter'
import {
  cashbookEntryMatchesFundMode,
  cashbookEntryMatchesSearch,
  cashbookQuickTimeGroups,
  cashbookQuickTimeLabels,
  cashbookQuickTimeRange,
  dateTimeInputText,
  directionFilterFromSelection,
  displayDate,
  formatVoucherAmountInput,
  nextDirectionSelection,
  nextStatusSelection,
  parseVoucherAmountInput,
  statusFilterFromSelection,
  type CashbookFundMode,
  type CashbookTimeFilter,
} from './finance-filters'
import {
  readCashbookFavoriteIds,
  readPinnedBankAccountIds,
  writeCashbookFavoriteIds,
  writePinnedBankAccountIds,
} from './finance-storage'
import { FinanceFiltersPanel, type FinanceSearchSuggestion } from './FinanceFiltersPanel'
import { FinanceDetailPanel } from './FinanceDetailPanel'

const pageSizeDefault = 15
const showAuxiliaryFinanceSections = false
const defaultCashbookColumns: CashbookColumnKey[] = [
  'code',
  'created_at',
  'source_type',
  'counterparty',
  'finance_account',
  'amount_delta',
]
const cashbookColumnDefinitions: Array<{ key: CashbookColumnKey; label: string }> = [
  { key: 'code', label: 'Mã phiếu' },
  { key: 'created_at', label: 'Thời gian' },
  { key: 'source_type', label: 'Loại thu chi' },
  { key: 'counterparty', label: 'Người nộp/nhận' },
  { key: 'finance_account', label: 'Loại sổ quỹ' },
  { key: 'amount_delta', label: 'Giá trị' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'is_business_accounted', label: 'Hạch toán KQKD' },
]


export function FinancePage({ service }: { service: FinanceService }) {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [balances, setBalances] = useState<CashbookBalance[]>([])
  const [debts, setDebts] = useState<CustomerDebtSummary[] | null>(null)
  const [debtTotal, setDebtTotal] = useState(0)
  const [debtPage, setDebtPage] = useState(1)
  const [debtPageSize, setDebtPageSize] = useState(pageSizeDefault)
  const [lastDebtSearch, setLastDebtSearch] = useState('')
  const [selectedDebt, setSelectedDebt] = useState<CustomerDebtSummary | null>(null)
  const [debtDetail, setDebtDetail] = useState<CustomerDebtDetail | null>(null)
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[] | null>(null)
  const [cashbookTotal, setCashbookTotal] = useState(0)
  const [cashbookPage, setCashbookPage] = useState(1)
  const [cashbookPageSize, setCashbookPageSize] = useState(pageSizeDefault)
  const [cashbookSearch, setCashbookSearch] = useState('')
  const [cashbookSearchSuggestions, setCashbookSearchSuggestions] = useState<CashbookEntry[]>([])
  const [cashbookSearchSuggestionsOpen, setCashbookSearchSuggestionsOpen] = useState(false)
  const [lastCashbookSearch, setLastCashbookSearch] = useState('')
  const [cashbookSearchScope] = useState<CashbookSearchScope>('all')
  const [lastCashbookSearchScope, setLastCashbookSearchScope] = useState<CashbookSearchScope>('all')
  const [cashbookTimeFilter, setCashbookTimeFilter] = useState<CashbookTimeFilter>('month')
  const [cashbookFrom, setCashbookFrom] = useState(() => currentMonthRange().from)
  const [lastCashbookFrom, setLastCashbookFrom] = useState(() => currentMonthRange().from)
  const [cashbookTo, setCashbookTo] = useState(() => currentMonthRange().to)
  const [lastCashbookTo, setLastCashbookTo] = useState(() => currentMonthRange().to)
  const [cashbookQuickTimeOpen, setCashbookQuickTimeOpen] = useState(false)
  const [cashbookFundMode, setCashbookFundMode] = useState<CashbookFundMode>('all')
  const [cashbookAccountId, setCashbookAccountId] = useState('')
  const [lastCashbookAccountId, setLastCashbookAccountId] = useState('')
  const [bankAccountMenuOpen, setBankAccountMenuOpen] = useState(false)
  const [bankAccountModalOpen, setBankAccountModalOpen] = useState(false)
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null)
  const [pinnedBankAccountIds, setPinnedBankAccountIds] = useState<string[]>(() => readPinnedBankAccountIds())
  const [newBankCode, setNewBankCode] = useState('MB')
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('')
  const [newBankAccountHolder, setNewBankAccountHolder] = useState('')
  const [newBankOpeningBalance, setNewBankOpeningBalance] = useState('0')
  const [newBankNote, setNewBankNote] = useState('')
  const [newBankNotify, setNewBankNotify] = useState(true)
  const [cashbookDirectionSelection, setCashbookDirectionSelection] = useState<CashbookDirection[]>([])
  const cashbookDirection = directionFilterFromSelection(cashbookDirectionSelection)
  const [lastCashbookDirection, setLastCashbookDirection] = useState<CashbookDirection | 'all'>('all')
  const [cashbookStatusSelection, setCashbookStatusSelection] = useState<CashbookStatus[]>(['posted'])
  const cashbookStatus = statusFilterFromSelection(cashbookStatusSelection)
  const [lastCashbookStatus, setLastCashbookStatus] = useState<CashbookStatus | 'all'>('posted')
  const [cashbookBusinessAccounted, setCashbookBusinessAccounted] = useState<CashbookBusinessAccountedFilter>('all')
  const [lastCashbookBusinessAccounted, setLastCashbookBusinessAccounted] = useState<CashbookBusinessAccountedFilter>('all')
  const [cashbookSummary, setCashbookSummary] = useState({ opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 })
  const [selectedCashbookEntry, setSelectedCashbookEntry] = useState<CashbookEntry | null>(null)
  const [cashbookDetail, setCashbookDetail] = useState<CashbookEntryDetail | null>(null)
  const [cashbookFavoriteIds, setCashbookFavoriteIds] = useState<string[]>(() => readCashbookFavoriteIds())
  const [showCashbookFavoritesOnly, setShowCashbookFavoritesOnly] = useState(false)
  const visibleCashbookColumns = defaultCashbookColumns
  const [vouchers, setVouchers] = useState<CashbookVoucher[]>([])
  const [voucherMode, setVoucherMode] = useState<CashbookDirection | null>(null)
  const [editingVoucher, setEditingVoucher] = useState<CashbookVoucher | null>(null)
  const [voucherAccountId, setVoucherAccountId] = useState('')
  const [voucherType, setVoucherType] = useState<CreateCashbookVoucherInput['voucher_type']>('other_income')
  const [voucherAmount, setVoucherAmount] = useState('')
  const [voucherIssuedAt, setVoucherIssuedAt] = useState(() => dateTimeInputText(new Date()))
  const [voucherPaymentMethod, setVoucherPaymentMethod] = useState<CashbookEntryDetail['payment_method']>('cash')
  const [voucherPartnerDebtMode, setVoucherPartnerDebtMode] = useState<PartnerDebtMode>('no_partner_debt')
  const [voucherBusinessAccounted, setVoucherBusinessAccounted] = useState(true)
  const [voucherCounterpartyType, setVoucherCounterpartyType] = useState<CreateCashbookVoucherInput['counterparty_type']>('none')
  const [voucherCounterpartyName, setVoucherCounterpartyName] = useState('')
  const [voucherCounterpartyPhone, setVoucherCounterpartyPhone] = useState('')
  const [voucherReason, setVoucherReason] = useState('')
  const [savingVoucher, setSavingVoucher] = useState(false)
  const [collectAmount, setCollectAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [bankAmount, setBankAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [note, setNote] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cashbookSearchRequestId = useRef(0)

  const activeAccounts = accounts.filter((account) => account.is_active)
  const sortedActiveAccounts = [...activeAccounts].sort(cashFirstAccountSort)
  const defaultCashAccountId = sortedActiveAccounts.find((account) => account.account_type === 'cash' && account.is_default_cash)?.id
    ?? sortedActiveAccounts.find((account) => account.account_type === 'cash')?.id
    ?? ''
  const sortedBankAccounts = sortedActiveAccounts
    .filter((account) => account.account_type === 'bank')
    .sort((left, right) => {
      const leftPinned = pinnedBankAccountIds.includes(left.id)
      const rightPinned = pinnedBankAccountIds.includes(right.id)
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
      return bankAccountDisplayText(left).localeCompare(bankAccountDisplayText(right), 'vi')
    })
  const pinnedBankAccount = sortedBankAccounts.find((account) => pinnedBankAccountIds.includes(account.id))
  const activeBankAccounts = sortedBankAccounts
  const selectedBankAccount = sortedBankAccounts.find((account) => account.id === cashbookAccountId)
  const fundFilteredCashbookEntries = (cashbookEntries ?? []).filter((entry) => (
    cashbookEntryMatchesFundMode(entry, cashbookFundMode, cashbookAccountId)
    && cashbookEntryMatchesSearch(entry, cashbookSearch)
  ))
  const visibleCashbookEntries = showCashbookFavoritesOnly
    ? fundFilteredCashbookEntries.filter((entry) => cashbookFavoriteIds.includes(entry.id))
    : fundFilteredCashbookEntries
  const pagedVisibleCashbookEntries = visibleCashbookEntries.length > cashbookPageSize
    ? visibleCashbookEntries.slice((cashbookPage - 1) * cashbookPageSize, cashbookPage * cashbookPageSize)
    : visibleCashbookEntries

  function openVoucherForm(direction: CashbookDirection) {
    const options = voucherTypeOptions(direction)
    const defaultAccount = pinnedBankAccount ?? sortedActiveAccounts[0]
    setEditingVoucher(null)
    setVoucherMode(direction)
    setVoucherAccountId(defaultAccount?.id ?? '')
    setVoucherType(options[0].value)
    setVoucherAmount('')
    setVoucherIssuedAt(dateTimeInputText(new Date()))
    setVoucherPaymentMethod(defaultAccount?.account_type === 'bank' ? 'bank_transfer' : 'cash')
    setVoucherPartnerDebtMode('no_partner_debt')
    setVoucherBusinessAccounted(direction === 'out')
    setVoucherCounterpartyType('none')
    setVoucherCounterpartyName('')
    setVoucherCounterpartyPhone('')
    setVoucherReason('')
    setError(null)
    setMessage(null)
  }

  function openVoucherRevision(voucher: CashbookVoucher) {
    const direction: CashbookDirection = voucher.code.startsWith('PT') ? 'in' : 'out'
    const defaultAccount = pinnedBankAccount ?? sortedActiveAccounts[0]
    setEditingVoucher(voucher)
    setVoucherMode(direction)
    setVoucherAccountId(defaultAccount?.id ?? '')
    setVoucherType(direction === 'in' ? 'other_income' : 'operating_expense')
    setVoucherAmount(formatVoucherAmountInput(String(voucher.amount)))
    setVoucherIssuedAt(dateTimeInputText(new Date()))
    setVoucherPaymentMethod(defaultAccount?.account_type === 'bank' ? 'bank_transfer' : 'cash')
    setVoucherPartnerDebtMode('no_partner_debt')
    setVoucherBusinessAccounted(true)
    setVoucherCounterpartyType('none')
    setVoucherCounterpartyName('')
    setVoucherCounterpartyPhone('')
    setVoucherReason('')
    setError(null)
    setMessage(null)
  }

  function closeVoucherForm() {
    setVoucherMode(null)
    setEditingVoucher(null)
  }

  function chooseVoucherAccount(accountId: string) {
    setVoucherAccountId(accountId)
    const account = sortedActiveAccounts.find((item) => item.id === accountId)
    if (account) setVoucherPaymentMethod(account.account_type === 'bank' ? 'bank_transfer' : 'cash')
  }

  function chooseVoucherPaymentMethod(paymentMethod: CashbookEntryDetail['payment_method']) {
    setVoucherPaymentMethod(paymentMethod)
    const nextAccountType = paymentMethod === 'bank_transfer' ? 'bank' : 'cash'
    const nextAccount = paymentMethod === 'bank_transfer'
      ? (pinnedBankAccount ?? sortedBankAccounts[0])
      : sortedActiveAccounts.find((account) => account.account_type === nextAccountType)
    if (nextAccount) setVoucherAccountId(nextAccount.id)
  }

  function changeDebtBankAmount(value: string) {
    setBankAmount(value)
    if (Number(value || 0) > 0 && bankAccountId === '') {
      const defaultBankAccount = pinnedBankAccount ?? sortedBankAccounts[0]
      if (defaultBankAccount) setBankAccountId(defaultBankAccount.id)
    }
  }

  async function loadDebts(input: { search?: string; page?: number; page_size?: number } = {}) {
    const nextSearch = input.search ?? lastDebtSearch
    const nextPage = input.page ?? debtPage
    const nextPageSize = input.page_size ?? debtPageSize
    setError(null)
    try {
      const result = await service.listCustomerDebts({
        search: nextSearch.trim() || undefined,
        page: nextPage,
        page_size: nextPageSize,
      })
      setDebts(result.items)
      setDebtTotal(result.total)
      setDebtPage(result.page)
      setDebtPageSize(result.page_size)
      setLastDebtSearch(nextSearch.trim())
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được công nợ khách hàng.'))
    }
  }

  const hydrateCashbookCounterparties = useCallback(async (entries: CashbookEntry[]) => {
    const targets = entries.filter(cashbookEntryNeedsCounterpartyHydration)
    if (targets.length === 0) return
    const details = await Promise.all(targets.map(async (entry) => {
      try {
        return await service.getCashbookEntry(entry.id)
      } catch {
        return null
      }
    }))
    const detailById = new Map(details
      .filter((detail): detail is CashbookEntryDetail => detail?.counterparty.name != null)
      .map((detail) => [detail.id, detail]))
    if (detailById.size === 0) return
    setCashbookEntries((current) => current?.map((item) => {
      const detail = detailById.get(item.id)
      if (detail === undefined || item.counterparty?.name != null) return item
      return { ...item, counterparty: detail.counterparty }
    }) ?? current)
  }, [service])

  async function loadCashbook(input: {
    search?: string
    search_scope?: CashbookSearchScope
    from?: string
    to?: string
    finance_account_id?: string
    finance_account_type?: 'cash' | 'bank'
    direction?: CashbookDirection | 'all'
    status?: CashbookStatus | 'all'
    business_accounted_filter?: CashbookBusinessAccountedFilter
    page?: number
    page_size?: number
  } = {}) {
    const nextSearch = input.search ?? lastCashbookSearch
    const nextSearchScope = input.search_scope ?? lastCashbookSearchScope
    const nextFrom = input.from ?? lastCashbookFrom
    const nextTo = input.to ?? lastCashbookTo
    const nextAccountId = input.finance_account_id ?? lastCashbookAccountId
    const nextDirection = input.direction ?? lastCashbookDirection
    const nextStatus = input.status ?? lastCashbookStatus
    const nextBusinessAccounted = input.business_accounted_filter ?? lastCashbookBusinessAccounted
    const nextPage = input.page ?? cashbookPage
    const nextPageSize = input.page_size ?? cashbookPageSize
    setError(null)
    try {
      const result = await service.listCashbookEntries({
        search: nextSearch.trim() || undefined,
        search_scope: nextSearchScope,
        from: nextFrom.trim() || undefined,
        to: nextTo.trim() || undefined,
        finance_account_id: nextAccountId === 'all' || nextAccountId === '' ? undefined : nextAccountId,
        finance_account_type: input.finance_account_type,
        direction: nextDirection,
        status: nextStatus,
        is_business_accounted: nextBusinessAccounted === 'all' ? undefined : nextBusinessAccounted === 'true',
        page: nextPage,
        page_size: nextPageSize,
      })
      setCashbookEntries(result.items)
      void hydrateCashbookCounterparties(result.items)
      setCashbookSummary(result.summary)
      setCashbookTotal(result.total)
      setCashbookPage(result.page)
      setCashbookPageSize(result.page_size)
      setLastCashbookSearch(nextSearch.trim())
      setLastCashbookSearchScope(nextSearchScope)
      setLastCashbookFrom(nextFrom.trim())
      setLastCashbookTo(nextTo.trim())
      setLastCashbookAccountId(nextAccountId)
      setLastCashbookDirection(nextDirection)
      setLastCashbookStatus(nextStatus)
      setLastCashbookBusinessAccounted(nextBusinessAccounted)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được sổ quỹ.'))
    }
  }

  async function applyCashbookQuickTimeFilter(preset: Exclude<CashbookTimeFilter, 'custom'>) {
    const range = cashbookQuickTimeRange(preset)
    setCashbookTimeFilter(preset)
    setCashbookQuickTimeOpen(false)
    setCashbookFrom(range.from)
    setCashbookTo(range.to)
    await applyCashbookFilters({ from: range.from, to: range.to })
  }

  async function applyCashbookCustomDateFilter(input: { from?: string; to?: string } = {}) {
    const nextFrom = input.from ?? cashbookFrom
    const nextTo = input.to ?? cashbookTo
    setCashbookTimeFilter('custom')
    setCashbookQuickTimeOpen(false)
    setCashbookFrom(nextFrom)
    setCashbookTo(nextTo)
    await applyCashbookFilters({ from: nextFrom, to: nextTo })
  }

  async function loadReferenceData() {
    setError(null)
    try {
      const [accountResult, balanceResult, voucherResult] = await Promise.all([
        service.listAccounts({ is_active: true }),
        service.listCashbookBalances(),
        service.listCashbookVouchers(),
      ])
      setAccounts(accountResult.items)
      setBalances(balanceResult.items)
      setVouchers(voucherResult.items)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được dữ liệu tài chính.'))
    }
  }

  useEffect(() => {
    let active = true
    async function loadInitial() {
      setError(null)
      try {
        const accountResult = await service.listAccounts({ is_active: true })
        const [balanceResult, voucherResult, debtResult, cashbookResult] = await Promise.all([
          service.listCashbookBalances(),
          service.listCashbookVouchers(),
          service.listCustomerDebts({ page: 1, page_size: pageSizeDefault }),
          service.listCashbookEntries({
            from: currentMonthRange().from,
            to: currentMonthRange().to,
            direction: 'all',
            status: 'posted',
            page: 1,
            page_size: pageSizeDefault,
          }),
        ])
        if (!active) return
        setAccounts(accountResult.items)
        setCashbookFundMode('all')
        setCashbookAccountId('all')
        setLastCashbookAccountId('all')
        setLastCashbookStatus('posted')
        setBalances(balanceResult.items)
        setVouchers(voucherResult.items)
        setDebts(debtResult.items)
        setDebtTotal(debtResult.total)
        setDebtPage(debtResult.page)
        setDebtPageSize(debtResult.page_size)
        setCashbookEntries(cashbookResult.items)
        void hydrateCashbookCounterparties(cashbookResult.items)
        setCashbookSummary(cashbookResult.summary)
        setCashbookTotal(cashbookResult.total)
        setCashbookPage(cashbookResult.page)
        setCashbookPageSize(cashbookResult.page_size)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được dữ liệu tài chính.'))
      }
    }
    void loadInitial()
    return () => {
      active = false
    }
  }, [hydrateCashbookCounterparties, service])

  async function filterCashbook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCashbookSearchSuggestionsOpen(false)
    await applyCashbookFilters()
  }

  async function suggestCashbook(nextSearch: string) {
    setCashbookSearch(nextSearch)
    const query = nextSearch.trim()
    const requestId = cashbookSearchRequestId.current + 1
    cashbookSearchRequestId.current = requestId
    if (query.length === 0) {
      setCashbookSearchSuggestions([])
      setCashbookSearchSuggestionsOpen(false)
      return
    }
    try {
      const result = await service.listCashbookEntries({
        search: query,
        search_scope: cashbookSearchScope,
        from: cashbookFrom.trim() || undefined,
        to: cashbookTo.trim() || undefined,
        finance_account_id: cashbookAccountId === 'all' || cashbookAccountId === '' ? undefined : cashbookAccountId,
        finance_account_type: cashbookFundMode === 'bank' && cashbookAccountId === '' ? 'bank' : undefined,
        direction: cashbookDirection,
        status: cashbookStatus,
        is_business_accounted: cashbookBusinessAccounted === 'all' ? undefined : cashbookBusinessAccounted === 'true',
        page: 1,
        page_size: 8,
      })
      if (cashbookSearchRequestId.current !== requestId) return
      setCashbookSearchSuggestions(result.items.filter((entry) => cashbookEntryMatchesSearch(entry, query)))
      setCashbookSearchSuggestionsOpen(true)
    } catch {
      if (cashbookSearchRequestId.current !== requestId) return
      setCashbookSearchSuggestions([])
      setCashbookSearchSuggestionsOpen(false)
    }
  }

  async function selectCashbookSuggestion(entry: CashbookEntry) {
    setCashbookSearch(entry.code)
    setCashbookSearchSuggestionsOpen(false)
    setCashbookPage(1)
    await loadCashbook({
      search: entry.code,
      search_scope: cashbookSearchScope,
      from: cashbookFrom,
      to: cashbookTo,
      finance_account_id: cashbookAccountId,
      finance_account_type: cashbookFundMode === 'bank' && cashbookAccountId === '' ? 'bank' : undefined,
      direction: cashbookDirection,
      status: cashbookStatus,
      business_accounted_filter: cashbookBusinessAccounted,
      page: 1,
    })
  }

  async function applyCashbookFilters(input: {
    search?: string
    from?: string
    to?: string
    finance_account_id?: string
    finance_account_type?: 'cash' | 'bank'
    direction?: CashbookDirection | 'all'
    status?: CashbookStatus | 'all'
    business_accounted_filter?: CashbookBusinessAccountedFilter
  } = {}) {
    setCashbookPage(1)
    const nextFinanceAccountId = input.finance_account_id ?? cashbookAccountId
    await loadCashbook({
      search: input.search ?? cashbookSearch,
      search_scope: cashbookSearchScope,
      from: input.from ?? cashbookFrom,
      to: input.to ?? cashbookTo,
      finance_account_id: nextFinanceAccountId,
      finance_account_type: input.finance_account_type ?? (cashbookFundMode === 'bank' && nextFinanceAccountId === '' ? 'bank' : undefined),
      direction: input.direction ?? cashbookDirection,
      status: input.status ?? cashbookStatus,
      business_accounted_filter: input.business_accounted_filter ?? cashbookBusinessAccounted,
      page: 1,
    })
  }

  async function chooseCashbookFund(nextMode: CashbookFundMode) {
    setCashbookFundMode(nextMode)
    setBankAccountMenuOpen(false)
    if (nextMode === 'cash') {
      setCashbookAccountId(defaultCashAccountId)
      await applyCashbookFilters({ finance_account_id: defaultCashAccountId })
      return
    }
    if (nextMode === 'all') {
      setCashbookAccountId('all')
      await applyCashbookFilters({ finance_account_id: 'all' })
      return
    }
    setCashbookAccountId('')
    await applyCashbookFilters({ finance_account_id: '', finance_account_type: 'bank' })
  }

  async function chooseCashbookBankAccount(accountId: string) {
    setCashbookFundMode('bank')
    setCashbookAccountId(accountId)
    setBankAccountMenuOpen(false)
    await applyCashbookFilters({ finance_account_id: accountId })
  }

  function openBankAccountModal() {
    setEditingBankAccountId(null)
    setBankAccountModalOpen(true)
    setNewBankCode('MB')
    setNewBankAccountNumber('')
    setNewBankAccountHolder('')
    setNewBankOpeningBalance('0')
    setNewBankNote('')
    setNewBankNotify(true)
  }

  function openEditBankAccountModal(account: FinanceAccount) {
    setEditingBankAccountId(account.id)
    setBankAccountModalOpen(true)
    setNewBankCode(account.code)
    setNewBankAccountNumber(account.account_number ?? '')
    setNewBankAccountHolder(account.account_holder ?? '')
    setNewBankOpeningBalance(formatVoucherAmountInput(String(account.opening_balance ?? 0)))
    setNewBankNote(account.note ?? '')
    setNewBankNotify(account.notify_on_transaction ?? true)
  }

  async function saveBankAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newBankAccountNumber.trim() === '' || newBankAccountHolder.trim() === '') {
      setError('Nhập số tài khoản và chủ tài khoản.')
      return
    }
    const accountNumber = newBankAccountNumber.trim()
    const nextAccount: FinanceAccount = {
      id: `local-bank-${accountNumber.replace(/\W/g, '')}`,
      code: newBankCode,
      name: newBankCode,
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: accountNumber,
      account_holder: newBankAccountHolder.trim().toLocaleUpperCase('vi'),
      opening_balance: parseVoucherAmountInput(newBankOpeningBalance),
      note: newBankNote.trim() || undefined,
      notify_on_transaction: newBankNotify,
    }
    if (editingBankAccountId !== null) {
      setAccounts((current) => current.map((account) => account.id === editingBankAccountId ? { ...account, ...nextAccount, id: account.id } : account))
      setBankAccountModalOpen(false)
      setMessage('Đã cập nhật tài khoản ngân hàng.')
      return
    }
    setAccounts((current) => [...current, nextAccount])
    setCashbookFundMode('bank')
    setCashbookAccountId(nextAccount.id)
    setBankAccountModalOpen(false)
    setMessage('Đã thêm tài khoản ngân hàng.')
    await applyCashbookFilters({ finance_account_id: nextAccount.id })
  }

  function togglePinnedBankAccount(accountId: string) {
    setPinnedBankAccountIds((current) => {
      const nextIds = current.includes(accountId) ? current.filter((id) => id !== accountId) : [accountId, ...current]
      writePinnedBankAccountIds(nextIds)
      return nextIds
    })
  }

  async function toggleCashbookDirection(nextValue: CashbookDirection) {
    const nextSelection = nextDirectionSelection(cashbookDirectionSelection, nextValue)
    const nextFilter = directionFilterFromSelection(nextSelection)
    setCashbookDirectionSelection(nextSelection)
    await applyCashbookFilters({ direction: nextFilter })
  }

  async function toggleCashbookStatus(nextValue: CashbookStatus) {
    const nextSelection = nextStatusSelection(cashbookStatusSelection, nextValue)
    const nextFilter = statusFilterFromSelection(nextSelection)
    setCashbookStatusSelection(nextSelection)
    await applyCashbookFilters({ status: nextFilter })
  }

  async function chooseCashbookBusinessAccounted(nextValue: CashbookBusinessAccountedFilter) {
    setCashbookBusinessAccounted(nextValue)
    await applyCashbookFilters({ business_accounted_filter: nextValue })
  }

  async function openCashbookEntry(entry: CashbookEntry) {
    if (selectedCashbookEntry?.id === entry.id) {
      setSelectedCashbookEntry(null)
      setCashbookDetail(null)
      return
    }
    setSelectedCashbookEntry(entry)
    setCashbookDetail(null)
    setError(null)
    try {
      const detail = await hydrateCashbookDetailAllocations(await service.getCashbookEntry(entry.id))
      setCashbookDetail(detail)
      setCashbookEntries((current) => current?.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)) ?? current)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết sổ quỹ.'))
    }
  }

  async function hydrateCashbookDetailAllocations(detail: CashbookEntryDetail): Promise<CashbookEntryDetail> {
    if (detail.allocations.length > 0 || detail.direction !== 'in') return detail
    const documentCode = cashbookLinkedDocumentCode(detail)
    if (documentCode === null || !documentCode.startsWith('HD')) return detail
    const salesDocument = await service.getSalesDocumentByCode(documentCode)
    if (salesDocument === null) return detail
    const allocatedAmount = Math.abs(detail.amount_delta)
    return {
      ...detail,
      source: { ...detail.source, order_code: salesDocument.code },
      allocations: [{
        order_id: salesDocument.id,
        order_code: salesDocument.code,
        order_total_amount: salesDocument.total_amount,
        collected_before: Math.max(salesDocument.paid_amount - allocatedAmount, 0),
        allocated_amount: allocatedAmount,
        remaining_after: Math.max(salesDocument.debt_amount, 0),
      }],
    }
  }

  function toggleCashbookFavorite(entry: CashbookEntry) {
    const nextIds = cashbookFavoriteIds.includes(entry.id)
      ? cashbookFavoriteIds.filter((id) => id !== entry.id)
      : [...cashbookFavoriteIds, entry.id]
    setCashbookFavoriteIds(nextIds)
    writeCashbookFavoriteIds(nextIds)
  }

  function stopCashbookRowAction(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  function exportCashbook() {
    const csv = buildCashbookCsv(visibleCashbookEntries)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'so-quy.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('Đã tạo file sổ quỹ.')
  }

  function cashbookCell(entry: CashbookEntry, column: CashbookColumnKey) {
    if (column === 'code') {
      return (
        <button
          aria-label={`Mở chi tiết ${entry.code}`}
          className="management-link-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void openCashbookEntry(entry)
          }}
        >
          <strong>{entry.code}</strong>
        </button>
      )
    }
    if (column === 'created_at') return dateText(entry.created_at)
    if (column === 'finance_account') return accountTypeText(entry.finance_account.account_type)
    if (column === 'source_type') return sourceTypeText(entry.source_type)
    if (column === 'counterparty') {
      if (entry.counterparty?.name == null) return '-'
      const label = cashbookCounterpartyLabel(entry)
      const displayName = cashbookCounterpartyDisplayName(entry.counterparty.name)
      return (
        <button
          aria-label={`Mở chi tiết ${entry.code} từ ${label} ${displayName}`}
          className="management-link-button finance-cashbook-counterparty-link"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void openCashbookEntry(entry)
          }}
        >
          {displayName}
        </button>
      )
    }
    if (column === 'amount_delta') return <MoneyText value={entry.amount_delta} />
    if (column === 'status') return <StatusChip tone={entry.status === 'posted' ? 'success' : 'neutral'}>{statusText(entry.status)}</StatusChip>
    if (column === 'note') return entry.note ?? '-'
    return entry.is_business_accounted ? 'Có' : 'Không'
  }

  async function openDebt(debt: CustomerDebtSummary) {
    if (debt.customer_id === null) return
    setError(null)
    setSelectedDebt(debt)
    setCollectAmount(String(debt.total_debt))
    setCashAmount(String(debt.total_debt))
    setBankAmount('0')
    setBankAccountId('')
    setBankRef('')
    setNote('')
    try {
      setDebtDetail(await service.getCustomerDebt(debt.customer_id))
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết công nợ.'))
    }
  }

  async function collectDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedDebt?.customer_id === null || selectedDebt === null) return
    const amount = Number(collectAmount || 0)
    const cash = Number(cashAmount || 0)
    const bank = Number(bankAmount || 0)
    if (amount <= 0 || amount !== cash + bank) {
      setError('Số tiền thu phải lớn hơn 0 và bằng tiền mặt cộng chuyển khoản.')
      return
    }
    if (bank > 0 && bankAccountId === '') {
      setError('Chọn tài khoản ngân hàng khi có tiền chuyển khoản.')
      return
    }
    setCollecting(true)
    setError(null)
    setMessage(null)
    try {
      const result = await service.collectCustomerDebt({
        customer_id: selectedDebt.customer_id,
        amount,
        payment_method: {
          cash_amount: cash,
          bank_amount: bank,
          ...(bank > 0 ? { bank_account_id: bankAccountId } : {}),
          ...(bankRef.trim() ? { bank_transaction_ref: bankRef.trim() } : {}),
        },
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setMessage(`Đã thu nợ ${result.allocated_amount.toLocaleString('vi-VN')} qua phiếu ${result.payment_receipt_id}.`)
      await Promise.all([loadDebts(), loadCashbook(), loadReferenceData(), openDebt(selectedDebt)])
    } catch (cause) {
      setError(formatApiError(cause, 'Không thu được nợ khách hàng.'))
    } finally {
      setCollecting(false)
    }
  }

  async function createManualVoucher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (voucherMode === null) return
    const amount = parseVoucherAmountInput(voucherAmount)
    if (voucherAccountId === '') {
      setError('Chọn quỹ/tài khoản cho phiếu thu chi.')
      return
    }
    if (amount <= 0) {
      setError('Số tiền phiếu phải lớn hơn 0.')
      return
    }
    if (voucherReason.trim() === '') {
      setError('Nhập lý do cho phiếu thu chi.')
      return
    }
    setSavingVoucher(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        voucher_direction: voucherMode,
        voucher_type: voucherType,
        finance_account_id: voucherAccountId,
        amount,
        partner_debt_mode: voucherPartnerDebtMode,
        is_business_accounted: voucherBusinessAccounted,
        counterparty_type: voucherCounterpartyType,
        ...(voucherCounterpartyName.trim() ? { counterparty_name: voucherCounterpartyName.trim() } : {}),
        ...(voucherCounterpartyPhone.trim() ? { counterparty_phone: voucherCounterpartyPhone.trim() } : {}),
        reason: voucherReason.trim(),
      }
      const result = editingVoucher === null
        ? await service.createCashbookVoucher(payload)
        : await service.reviseCashbookVoucher(editingVoucher.id, payload)
      setMessage(editingVoucher === null ? `Đã tạo phiếu ${result.code}.` : `Đã sửa phiếu ${result.code}.`)
      setVoucherMode(null)
      setEditingVoucher(null)
      await Promise.all([loadCashbook({ page: 1 }), loadReferenceData()])
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được phiếu thu chi.'))
    } finally {
      setSavingVoucher(false)
    }
  }

  async function cancelManualVoucher(voucher: CashbookVoucher) {
    setError(null)
    setMessage(null)
    try {
      const result = await service.cancelCashbookVoucher(voucher.id)
      setMessage(`Đã hủy phiếu ${result.code}.`)
      await Promise.all([loadCashbook({ page: 1 }), loadReferenceData()])
    } catch (cause) {
      setError(formatApiError(cause, 'Không hủy được phiếu thu chi.'))
    }
  }

  const voucherDialogLabel = voucherMode === null
    ? ''
    : editingVoucher === null
      ? `Tạo phiếu ${voucherMode === 'in' ? 'thu' : 'chi'}`
      : `Sửa phiếu ${editingVoucher.code}`
  const selectedVoucherAccount = sortedActiveAccounts.find((account) => account.id === voucherAccountId)
  const voucherAccountKindText = selectedVoucherAccount?.account_type === 'bank' ? 'ngân hàng' : 'tiền mặt'
  const voucherDialogTitle = voucherMode === null
    ? ''
    : editingVoucher === null
      ? `Tạo phiếu ${voucherMode === 'in' ? 'thu' : 'chi'} ${voucherAccountKindText}`
      : `Sửa phiếu ${editingVoucher.code}`
  const voucherCounterpartyRole = voucherMode === 'in' ? 'nộp' : 'nhận'
  const voucherActorRole = voucherMode === 'in' ? 'thu' : 'chi'
  const voucherTypeLabel = voucherMode === 'in' ? 'Loại thu' : 'Loại chi'
  const voucherAccountLabel = voucherMode === 'in' ? 'Tài khoản nhận' : 'Tài khoản chi'
  const voucherCounterpartyTypeLabel = voucherMode === 'in' ? 'Đối tượng nộp' : 'Đối tượng nhận'
  const voucherCounterpartyNameLabel = voucherMode === 'in' ? 'Tên người nộp' : 'Tên người nhận'
  const bankAccountModalTitle = editingBankAccountId === null ? 'Thêm tài khoản ngân hàng' : 'Sửa tài khoản ngân hàng'
  const cashbookSuggestionItems: FinanceSearchSuggestion[] | undefined = cashbookSearchSuggestionsOpen
    ? cashbookSearchSuggestions.map((entry) => ({
        id: entry.id,
        primary: `${entry.code} ${cashbookCounterpartyLabel(entry)}`.trim(),
        secondary: entry.note,
        meta: <MoneyText value={entry.amount_delta} />,
        ariaLabel: `${entry.code} ${cashbookCounterpartyLabel(entry)} ${entry.note ?? ''}`.trim(),
      }))
    : undefined

  return (
    <ManagementPage
      title="Sổ quỹ"
      actions={
        <FinanceFiltersPanel
          search={cashbookSearch}
          suggestions={cashbookSuggestionItems}
          onCreateVoucher={() => openVoucherForm('in')}
          onExportCashbook={exportCashbook}
          onSearchChange={(nextSearch) => void suggestCashbook(nextSearch)}
          onSubmit={filterCashbook}
          onSuggestionSelect={(suggestion) => {
            const entry = cashbookSearchSuggestions.find((candidate) => candidate.id === suggestion.id)
            if (entry) void selectCashbookSuggestion(entry)
          }}
        />
      }
      kpis={
        <MetricGrid ariaLabel="Tổng quan sổ quỹ">
          <MetricCard label="Quỹ đầu kỳ" value={<MoneyText value={cashbookSummary.opening_balance} />} hint="Theo bộ lọc" tone="neutral" />
          <MetricCard label="Tổng thu" value={<MoneyText value={cashbookSummary.total_in} />} hint="Theo bộ lọc sổ quỹ" tone="info" />
          <MetricCard label="Tổng chi" value={<MoneyText value={cashbookSummary.total_out} />} hint="Theo bộ lọc" tone="warning" />
          <MetricCard label="Tồn quỹ" value={<MoneyText value={cashbookSummary.ending_balance} />} hint="Theo bộ lọc" tone="success" />
        </MetricGrid>
      }
      filter={
        <ManagementFilterSidebar
          ariaLabel="Bộ lọc tài chính"
          onPopoverClose={() => setCashbookQuickTimeOpen(false)}
          popoverOpen={cashbookQuickTimeOpen}
        >
          <form id="cashbook-filter-form" aria-label="Bộ lọc sổ quỹ" className="management-filter-sidebar-form" onSubmit={filterCashbook}>
            <ManagementFilterGroup title="Thời gian">
              <div className="management-filter-time-options">
                <div
                  aria-expanded={cashbookQuickTimeOpen}
                  className={`management-filter-choice${cashbookTimeFilter !== 'custom' ? ' management-filter-choice-active' : ''}`}
                  onClick={() => {
                    if (cashbookTimeFilter === 'custom') void applyCashbookQuickTimeFilter('month')
                    else setCashbookQuickTimeOpen((current) => !current)
                  }}
                >
                  <input
                    aria-label={cashbookTimeFilter === 'custom' ? cashbookQuickTimeLabels.month : cashbookQuickTimeLabels[cashbookTimeFilter]}
                    checked={cashbookTimeFilter !== 'custom'}
                    name="cashbook-time"
                    readOnly
                    type="radio"
                    onChange={() => undefined}
                  />
                  <span>{cashbookTimeFilter === 'custom' ? cashbookQuickTimeLabels.month : cashbookQuickTimeLabels[cashbookTimeFilter]}</span>
                  <span className="management-filter-choice-trailing">
                    <ChevronRight aria-hidden="true" size={17} />
                  </span>
                </div>
                <label className={`management-filter-choice${cashbookTimeFilter === 'custom' ? ' management-filter-choice-active' : ''}`}>
                  <input
                    aria-label="Tùy chỉnh"
                    checked={cashbookTimeFilter === 'custom'}
                    name="cashbook-time"
                    type="radio"
                    onChange={() => void applyCashbookCustomDateFilter()}
                  />
                  <span>{cashbookTimeFilter === 'custom' ? `${displayDate(cashbookFrom)} - ${displayDate(cashbookTo)}` : 'Tùy chỉnh'}</span>
                  <CalendarDays aria-hidden="true" size={17} />
                </label>
              </div>
              {cashbookQuickTimeOpen ? (
                <div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">
                  {cashbookQuickTimeGroups.map((group) => (
                    <section key={group.title}>
                      <h3>{group.title}</h3>
                      <div>
                        {group.presets.map((preset) => (
                          <button
                            className={cashbookTimeFilter === preset ? 'management-filter-quick-time-active' : undefined}
                            key={preset}
                            type="button"
                            onClick={() => void applyCashbookQuickTimeFilter(preset)}
                          >
                            {cashbookQuickTimeLabels[preset]}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
                {cashbookTimeFilter === 'custom' ? (
                  <ManagementDateRangeInputs
                    from={cashbookFrom}
                    to={cashbookTo}
                    onFromChange={(value) => void applyCashbookCustomDateFilter({ from: value })}
                    onToChange={(value) => void applyCashbookCustomDateFilter({ to: value })}
                  />
                ) : null}
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Quỹ tiền">
              <label className={`management-filter-choice${cashbookFundMode === 'all' ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookFundMode === 'all'}
                  name="cashbook-fund"
                  type="radio"
                  onChange={() => void chooseCashbookFund('all')}
                />
                <span>Tổng quỹ</span>
              </label>
              <label className={`management-filter-choice${cashbookFundMode === 'cash' ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookFundMode === 'cash'}
                  name="cashbook-fund"
                  type="radio"
                  onChange={() => void chooseCashbookFund('cash')}
                />
                <span>Tiền mặt</span>
              </label>
              <label className={`management-filter-choice${cashbookFundMode === 'bank' ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookFundMode === 'bank'}
                  name="cashbook-fund"
                  type="radio"
                  onChange={() => void chooseCashbookFund('bank')}
                />
                <span>Ngân hàng</span>
              </label>
              {cashbookFundMode === 'bank' ? (
                <div className="management-filter-account-picker">
                  <div className="management-filter-subheading">
                    <span>Tài khoản</span>
                    <button type="button" onClick={openBankAccountModal}>Thêm</button>
                  </div>
                  <button
                    aria-expanded={bankAccountMenuOpen}
                    aria-label="Chọn tài khoản"
                    className="management-filter-account-trigger"
                    type="button"
                    onClick={() => setBankAccountMenuOpen((current) => !current)}
                  >
                    <span>{selectedBankAccount ? bankAccountDisplayText(selectedBankAccount) : 'Chọn tài khoản'}</span>
                    <ChevronDown aria-hidden="true" size={16} />
                  </button>
                  {bankAccountMenuOpen ? (
                    <div className="management-filter-account-menu" role="listbox" aria-label="Danh sách tài khoản ngân hàng">
                      <div className="management-filter-account-list">
                        {sortedBankAccounts.length > 0 ? sortedBankAccounts.map((account) => (
                          <div
                            aria-selected={cashbookAccountId === account.id}
                            className="management-filter-account-option"
                            key={account.id}
                            role="option"
                            tabIndex={0}
                            onClick={() => void chooseCashbookBankAccount(account.id)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return
                              event.preventDefault()
                              void chooseCashbookBankAccount(account.id)
                            }}
                          >
                            <span className="management-filter-account-option-label">{bankAccountDisplayText(account)}</span>
                            <span className="management-filter-account-actions">
                              <button
                                aria-label={`Sửa tài khoản ${bankAccountDisplayText(account)}`}
                                className="management-icon-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEditBankAccountModal(account)
                                }}
                              >
                                <Edit3 aria-hidden="true" size={15} />
                              </button>
                              <button
                                aria-label={`Ghim tài khoản ${bankAccountDisplayText(account)}`}
                                aria-pressed={pinnedBankAccountIds.includes(account.id)}
                                className={pinnedBankAccountIds.includes(account.id) ? 'management-icon-button management-filter-account-action-pinned' : 'management-icon-button'}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  togglePinnedBankAccount(account.id)
                                }}
                              >
                                <Pin aria-hidden="true" size={15} />
                              </button>
                            </span>
                          </div>
                        )) : <span className="management-filter-account-empty">Không có tài khoản phù hợp</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Loại chứng từ">
              <label className={`management-filter-choice${cashbookDirectionSelection.includes('in') ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookDirectionSelection.includes('in')}
                  type="checkbox"
                  onChange={() => void toggleCashbookDirection('in')}
                />
                <span>Phiếu thu</span>
              </label>
              <label className={`management-filter-choice${cashbookDirectionSelection.includes('out') ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookDirectionSelection.includes('out')}
                  type="checkbox"
                  onChange={() => void toggleCashbookDirection('out')}
                />
                <span>Phiếu chi</span>
              </label>
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Trạng thái sổ quỹ">
              <label className={`management-filter-choice${cashbookStatusSelection.includes('posted') ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookStatusSelection.includes('posted')}
                  type="checkbox"
                  onChange={() => void toggleCashbookStatus('posted')}
                />
                <span>Đã thanh toán</span>
              </label>
              <label className={`management-filter-choice${cashbookStatusSelection.includes('cancelled') ? ' management-filter-choice-active' : ''}`}>
                <input
                  checked={cashbookStatusSelection.includes('cancelled')}
                  type="checkbox"
                  onChange={() => void toggleCashbookStatus('cancelled')}
                />
                <span>Đã hủy</span>
              </label>
            </ManagementFilterGroup>
            <ManagementFilterGroup title="Hạch toán KQKD">
              <div className="management-filter-segmented" role="radiogroup" aria-label="Hạch toán KQKD">
                {(['all', 'true', 'false'] as CashbookBusinessAccountedFilter[]).map((option) => (
                  <label
                    className={cashbookBusinessAccounted === option ? 'management-filter-segmented-active' : undefined}
                    key={option}
                  >
                    <input
                      checked={cashbookBusinessAccounted === option}
                      name="cashbook-business-accounted"
                      type="radio"
                      onChange={() => void chooseCashbookBusinessAccounted(option)}
                    />
                    <span>{option === 'false' ? 'Không' : option === 'true' ? 'Có' : businessAccountedText(option)}</span>
                  </label>
                ))}
              </div>
            </ManagementFilterGroup>
          </form>
        </ManagementFilterSidebar>
      }
    >
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      {voucherMode !== null ? (
        <div className="management-modal-backdrop">
          <section
            aria-label={voucherDialogLabel}
            aria-modal="true"
            className="management-modal-dialog finance-voucher-panel"
            role="dialog"
          >
            <header className="management-modal-header">
              <h2>{voucherDialogTitle}</h2>
              <button aria-label="Đóng popup phiếu thu chi" className="management-icon-button" type="button" onClick={closeVoucherForm}>
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="inline-detail-tabbar">
              <div className="inline-detail-tabs" role="tablist" aria-label="Loại phiếu">
                <button
                  aria-selected={voucherMode === 'in'}
                  role="tab"
                  type="button"
                  onClick={() => openVoucherForm('in')}
                >
                  Phiếu thu
                </button>
                <button
                  aria-selected={voucherMode === 'out'}
                  role="tab"
                  type="button"
                  onClick={() => openVoucherForm('out')}
                >
                  Phiếu chi
                </button>
              </div>
            </div>
            <form aria-label={voucherDialogLabel} className="management-modal-form" onSubmit={createManualVoucher}>
              <div className="management-modal-form-grid">
                <label>
                  Mã phiếu
                  <input placeholder="Tự động" readOnly value="" />
                </label>
                <label className="management-input-with-icon">
                  Thời gian
                  <input value={voucherIssuedAt} onChange={(event) => setVoucherIssuedAt(event.target.value)} />
                  <CalendarDays aria-hidden="true" size={16} />
                </label>
                <label>
                  {voucherTypeLabel}
                  <select
                    value={voucherType}
                    onChange={(event) => setVoucherType(event.target.value as CreateCashbookVoucherInput['voucher_type'])}
                  >
                    {voucherTypeOptions(voucherMode).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Người {voucherActorRole}
                  <select disabled value="Cloud Admin">
                    <option value="Cloud Admin">Cloud Admin</option>
                  </select>
                </label>
                <label>
                  {voucherCounterpartyTypeLabel}
                  <select
                    value={voucherCounterpartyType}
                    onChange={(event) => setVoucherCounterpartyType(event.target.value as CreateCashbookVoucherInput['counterparty_type'])}
                  >
                    <option value="none">Khác</option>
                    <option value="customer">Khách hàng</option>
                    <option value="supplier">Nhà cung cấp</option>
                    <option value="employee">Nhân viên</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <label>
                  <span className="management-field-heading">
                    {voucherCounterpartyNameLabel}
                    <span className="management-field-link-action">Tạo mới</span>
                  </span>
                  <input
                    aria-label={voucherCounterpartyNameLabel}
                    placeholder={`Tìm người ${voucherCounterpartyRole}`}
                    value={voucherCounterpartyName}
                    onChange={(event) => setVoucherCounterpartyName(event.target.value)}
                  />
                </label>
                <label>
                  Phương thức thanh toán
                  <select
                    value={voucherPaymentMethod}
                    onChange={(event) => chooseVoucherPaymentMethod(event.target.value as CashbookEntryDetail['payment_method'])}
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                  </select>
                </label>
                <label>
                  {voucherAccountLabel}
                  <select value={voucherAccountId} onChange={(event) => chooseVoucherAccount(event.target.value)}>
                    <option value="">Chọn tài khoản</option>
                    {sortedActiveAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{financeAccountChoiceLabel(account)}</option>
                    ))}
                  </select>
                </label>
                <label className="management-modal-field-wide">
                  Số tiền
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={voucherAmount}
                    onChange={(event) => setVoucherAmount(formatVoucherAmountInput(event.target.value))}
                  />
                </label>
                <label className="management-modal-field-wide">
                  Ghi chú
                  <textarea placeholder="Nhập ghi chú" rows={3} value={voucherReason} onChange={(event) => setVoucherReason(event.target.value)} />
                </label>
                <label className="management-modal-checkbox-row management-modal-field-wide">
                  <input
                    checked={voucherBusinessAccounted}
                    type="checkbox"
                    onChange={(event) => setVoucherBusinessAccounted(event.target.checked)}
                  />
                  <span>Hạch toán kết quả kinh doanh</span>
                  <Info aria-hidden="true" size={15} />
                </label>
              </div>
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={closeVoucherForm}>Bỏ qua</button>
                <button className="button button-secondary" disabled={savingVoucher} type="submit">Lưu & In</button>
                <button className="button button-primary" disabled={savingVoucher} type="submit">Lưu</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {bankAccountModalOpen ? (
        <div className="management-modal-backdrop">
          <section aria-label={bankAccountModalTitle} aria-modal="true" className="management-modal-dialog management-modal-dialog-compact" role="dialog">
            <header className="management-modal-header">
              <h2>{bankAccountModalTitle}</h2>
              <button aria-label={`Đóng popup ${bankAccountModalTitle.toLocaleLowerCase('vi')}`} className="management-icon-button" type="button" onClick={() => setBankAccountModalOpen(false)}>
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="inline-detail-tabbar">
              <div className="inline-detail-tabs" role="tablist" aria-label="Tài khoản ngân hàng">
                <button aria-selected="true" role="tab" type="button">Thông tin</button>
              </div>
            </div>
            <form aria-label={bankAccountModalTitle} className="management-modal-form" onSubmit={saveBankAccount}>
              <div className="management-modal-form-stack">
                <label>
                  Số tài khoản
                  <input placeholder="Nhập số tài khoản" value={newBankAccountNumber} onChange={(event) => setNewBankAccountNumber(event.target.value)} />
                </label>
                <label>
                  Ngân hàng
                  <select value={newBankCode} onChange={(event) => setNewBankCode(event.target.value)}>
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="MB">MB</option>
                    <option value="ACB">ACB</option>
                    <option value="BIDV">BIDV</option>
                    <option value="VietinBank">VietinBank</option>
                  </select>
                </label>
                <label>
                  Chủ tài khoản
                  <input
                    placeholder="Nhập tên chủ tài khoản"
                    value={newBankAccountHolder}
                    onChange={(event) => setNewBankAccountHolder(event.target.value.toLocaleUpperCase('vi'))}
                  />
                </label>
                <label>
                  Số dư ban đầu
                  <input
                    inputMode="numeric"
                    value={newBankOpeningBalance}
                    onChange={(event) => setNewBankOpeningBalance(formatVoucherAmountInput(event.target.value))}
                  />
                </label>
                <label>
                  Ghi chú
                  <textarea placeholder="Nhập ghi chú" rows={3} value={newBankNote} onChange={(event) => setNewBankNote(event.target.value)} />
                </label>
                <label className="management-modal-checkbox-row">
                  <input checked={newBankNotify} type="checkbox" onChange={(event) => setNewBankNotify(event.target.checked)} />
                  <span>Bật thông báo tiền về</span>
                  <Info aria-hidden="true" size={15} />
                </label>
                <p className="management-modal-helper-text">Xác nhận nhanh giao dịch, giảm thiểu thất thoát.</p>
              </div>
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={() => setBankAccountModalOpen(false)}>Bỏ qua</button>
                <button className="button button-primary" type="submit">Lưu</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {showAuxiliaryFinanceSections ? (
      <ManagementListSurface ariaLabel="Tài khoản quỹ">
        <h2>Tài khoản quỹ</h2>
        {balances.length === 0 ? <EmptyState>Chưa có số dư quỹ.</EmptyState> : (
          <ManagementTableViewport>
            <table aria-label="Tài khoản quỹ" className="management-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Số dư</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr key={balance.finance_account_id}>
                    <td><strong>{balance.code}</strong></td>
                    <td>{balance.name}</td>
                    <td>{accountTypeText(balance.account_type)}</td>
                    <td><MoneyText value={balance.balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        )}
      </ManagementListSurface>
      ) : null}

      {showAuxiliaryFinanceSections ? (
      <ManagementListSurface ariaLabel="Công nợ khách hàng">
        <h2>Công nợ khách hàng</h2>
        {debts === null ? <p>Đang tải công nợ...</p> : null}
        {debts !== null && debts.length === 0 ? <EmptyState>Chưa có công nợ khách hàng.</EmptyState> : null}
        {debts !== null && debts.length > 0 ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Công nợ khách hàng" className="management-table">
                <thead>
                  <tr>
                    <th>Mã khách</th>
                    <th>Tên khách</th>
                    <th>Hóa đơn nợ</th>
                    <th>Hóa đơn cũ nhất</th>
                    <th>Tổng nợ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((debt) => (
                    <tr key={debt.customer_id ?? debt.customer_name}>
                      <td>{debt.customer_code ?? 'Khách lẻ'}</td>
                      <td>{debt.customer_name}</td>
                      <td>{debt.open_invoice_count}</td>
                      <td>{debt.oldest_order_code ?? '-'}</td>
                      <td><MoneyText value={debt.total_debt} /></td>
                      <td>
                        <ManagementRowActionButton
                          ariaLabel={`Thu nợ ${debt.customer_name}`}
                          disabled={debt.customer_id === null}
                          onClick={() => void openDebt(debt)}
                        >
                          Thu nợ
                        </ManagementRowActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang công nợ"
              entityLabel="khách nợ"
              page={debtPage}
              pageSize={debtPageSize}
              total={debtTotal}
              canGoPrevious={debtPage > 1}
              canGoNext={debtPage * debtPageSize < debtTotal}
              onPageSizeChange={(nextPageSize) => void loadDebts({ page: 1, page_size: nextPageSize })}
              onFirst={() => void loadDebts({ page: 1 })}
              onPrevious={() => void loadDebts({ page: Math.max(1, debtPage - 1) })}
              onNext={() => void loadDebts({ page: debtPage + 1 })}
              onLast={() => void loadDebts({ page: Math.max(1, Math.ceil(debtTotal / debtPageSize)) })}
            />
          </>
        ) : null}
      </ManagementListSurface>
      ) : null}

      {selectedDebt && debtDetail ? (
        <section aria-label={`Thu nợ ${selectedDebt.customer_name}`} className="management-inline-detail finance-collection-panel">
          <header>
            <div>
              <h2>{selectedDebt.customer_name}</h2>
              <p>{selectedDebt.customer_code ?? 'Khách hàng'} · còn nợ <MoneyText value={debtDetail.total_debt} /></p>
            </div>
            <button className="button button-secondary" type="button" onClick={() => setSelectedDebt(null)}>
              Đóng
            </button>
          </header>
          <form aria-label="Thu nợ khách hàng" className="management-detail-form" onSubmit={collectDebt}>
            <label>
              Tổng tiền thu
              <input min="1" type="number" value={collectAmount} onChange={(event) => setCollectAmount(event.target.value)} />
            </label>
            <label>
              Tiền mặt
              <input min="0" type="number" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} />
            </label>
            <label>
              Chuyển khoản
              <input min="0" type="number" value={bankAmount} onChange={(event) => changeDebtBankAmount(event.target.value)} />
            </label>
            <label>
              Tài khoản ngân hàng
              <select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                <option value="">Không dùng</option>
                {activeBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                ))}
              </select>
            </label>
            <label>
              Mã giao dịch
              <input value={bankRef} onChange={(event) => setBankRef(event.target.value)} />
            </label>
            <label>
              Ghi chú
              <input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <button className="button button-primary" disabled={collecting} type="submit">
              <WalletCards aria-hidden="true" size={16} />
              Lưu thu nợ
            </button>
          </form>
          <section aria-label="Hóa đơn còn nợ">
            <h3>Hóa đơn còn nợ</h3>
            <ManagementTableViewport>
              <table aria-label="Hóa đơn còn nợ" className="management-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Ngày tạo</th>
                    <th>Tổng tiền</th>
                    <th>Đã thu</th>
                    <th>Còn nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {debtDetail.invoices.map((invoice) => (
                    <tr key={invoice.order_id}>
                      <td>{invoice.order_code}</td>
                      <td>{dateText(invoice.created_at)}</td>
                      <td><MoneyText value={invoice.total_amount} /></td>
                      <td><MoneyText value={invoice.paid_amount} /></td>
                      <td><MoneyText value={invoice.remaining_debt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
          </section>
        </section>
      ) : null}

      <ManagementListSurface ariaLabel="Sổ quỹ">
        {cashbookEntries === null ? <p>Đang tải sổ quỹ...</p> : null}
        {cashbookEntries !== null && pagedVisibleCashbookEntries.length === 0 ? <EmptyState>Chưa có dòng sổ quỹ.</EmptyState> : null}
        {cashbookEntries !== null && cashbookEntries.length > 0 ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Sổ quỹ" className="management-table finance-cashbook-data-table">
                <thead>
                  <tr>
                    <th className="finance-cashbook-select-column">
                      <span className="finance-cashbook-checkbox-control">
                        <input aria-label="Chọn tất cả dòng sổ quỹ" type="checkbox" />
                      </span>
                    </th>
                    <th aria-label="Đánh dấu" className="finance-cashbook-star-column">
                      <button
                        aria-label={showCashbookFavoritesOnly ? 'Hiện tất cả dòng sổ quỹ' : 'Chỉ hiện mục ưu tiên'}
                        aria-pressed={showCashbookFavoritesOnly}
                        className={`finance-cashbook-star-button${showCashbookFavoritesOnly ? ' finance-cashbook-star-button-active' : ''}`}
                        type="button"
                        onClick={() => setShowCashbookFavoritesOnly(!showCashbookFavoritesOnly)}
                      >
                        ☆
                      </button>
                    </th>
                    {visibleCashbookColumns.map((column) => (
                      <th key={column}>{cashbookColumnDefinitions.find((definition) => definition.key === column)?.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedVisibleCashbookEntries.map((entry) => (
                    <Fragment key={entry.id}>
                      <tr
                        aria-expanded={selectedCashbookEntry?.id === entry.id}
                        className={`management-data-row${selectedCashbookEntry?.id === entry.id ? ' management-data-row-selected' : ''}`}
                        tabIndex={0}
                        onClick={() => void openCashbookEntry(entry)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void openCashbookEntry(entry)
                          }
                        }}
                      >
                        <td className="finance-cashbook-select-column">
                          <span className="finance-cashbook-checkbox-control">
                            <input aria-label={`Chọn dòng ${entry.code}`} type="checkbox" onClick={stopCashbookRowAction} />
                          </span>
                        </td>
                        <td className="finance-cashbook-star-column">
                          <button
                            aria-label={cashbookFavoriteIds.includes(entry.id) ? `Bỏ ưu tiên ${entry.code}` : `Đánh dấu ưu tiên ${entry.code}`}
                            aria-pressed={cashbookFavoriteIds.includes(entry.id)}
                            className={`finance-cashbook-star-button${cashbookFavoriteIds.includes(entry.id) ? ' finance-cashbook-star-button-active' : ''}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleCashbookFavorite(entry)
                            }}
                          >
                            ☆
                          </button>
                        </td>
                        {visibleCashbookColumns.map((column) => (
                          <td className={column === 'amount_delta' ? 'finance-cashbook-money-column' : undefined} key={column}>{cashbookCell(entry, column)}</td>
                        ))}
                      </tr>
                      {selectedCashbookEntry?.id === entry.id ? (
                        <ManagementDetailRow colSpan={visibleCashbookColumns.length + 2} label={`Chi tiết sổ quỹ ${entry.code}`}>
                          <FinanceDetailPanel detail={cashbookDetail} />
                        </ManagementDetailRow>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang sổ quỹ"
              entityLabel="dòng sổ"
              page={cashbookPage}
              pageSize={cashbookPageSize}
              total={cashbookTotal}
              canGoPrevious={cashbookPage > 1}
              canGoNext={cashbookPage * cashbookPageSize < cashbookTotal}
              onPageSizeChange={(nextPageSize) => void loadCashbook({ page: 1, page_size: nextPageSize })}
              onFirst={() => void loadCashbook({ page: 1 })}
              onPrevious={() => void loadCashbook({ page: Math.max(1, cashbookPage - 1) })}
              onNext={() => void loadCashbook({ page: cashbookPage + 1 })}
              onLast={() => void loadCashbook({ page: Math.max(1, Math.ceil(cashbookTotal / cashbookPageSize)) })}
            />
          </>
        ) : null}
      </ManagementListSurface>

      {showAuxiliaryFinanceSections ? (
      <ManagementListSurface ariaLabel="Phiếu thu/chi">
        <h2>Phiếu thu/chi</h2>
        {vouchers.length === 0 ? <EmptyState>Chưa có phiếu thu/chi.</EmptyState> : (
          <ManagementTableViewport>
            <table aria-label="Phiếu thu/chi" className="management-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>Số tiền</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td><strong>{voucher.code}</strong></td>
                    <td>{voucher.source_type === 'payment_receipt' ? 'Phiếu thu' : 'Phiếu thủ công'}</td>
                    <td><StatusChip tone={voucher.status === 'posted' ? 'success' : 'neutral'}>{statusText(voucher.status)}</StatusChip></td>
                    <td><MoneyText value={voucher.amount} /></td>
                    <td>
                      {voucher.source_type === 'manual_voucher' && voucher.status === 'posted' ? (
                        <>
                          <ManagementRowActionButton
                            ariaLabel={`Sửa phiếu ${voucher.code}`}
                            onClick={() => openVoucherRevision(voucher)}
                          >
                            Sửa
                          </ManagementRowActionButton>
                          <ManagementRowActionButton
                            ariaLabel={`Hủy phiếu ${voucher.code}`}
                            onClick={() => void cancelManualVoucher(voucher)}
                          >
                            Hủy
                          </ManagementRowActionButton>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        )}
      </ManagementListSurface>
      ) : null}
    </ManagementPage>
  )
}
