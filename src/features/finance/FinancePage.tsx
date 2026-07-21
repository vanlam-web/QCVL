import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, Edit3, Info, Pin, Trash2, WalletCards, X } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { pageSizeForManagementViewport } from '../../lib/management-page-size'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementDateRangeInputs,
  ManagementConfirmDialog,
  ManagementDetailRow,
  ManagementDropdownField,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { preventManagementSearchSubmit, runManagementLiveSearch } from '../../components/ui-shell/management-search'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { managementSortStatesEqual, type ManagementSortState, useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import { ManagementDateTimeInput, parseManagementDateTimeInputText } from '../../components/ui-shell/management-date-time-input'
import { downloadManagementCsv } from '../../components/ui-shell/management-export'
import { formatMoney } from '../../lib/number-format'
import type {
  CashbookBusinessAccountedFilter,
  CashbookColumnKey,
  CashbookDirection,
  CashbookEntry,
  CashbookEntryDetail,
  CashbookSearchScope,
  CashbookStatus,
  CashbookVoucher,
  CashbookVoucherType,
  CashbookVoucherCounterpartyOption,
  CreateCashbookVoucherInput,
  CustomerDebtDetail,
  CustomerDebtSummary,
  FinanceAccount,
  CashbookBalance,
  PartnerDebtMode,
} from './types'
import type { FinanceService } from './finance-service'
import { buildCashbookCsv } from './finance-service'
import { currentMonthRange, dateRangeFromItems, displayDateRangeForData } from '../../lib/date-ranges'
import { currentSystemDate } from '../../lib/system-clock'
import { vietnamBankOptionLabel, vietnamBankOptions } from './vietnam-bank-catalog'
import {
  accountTypeText,
  bankAccountDisplayText,
  bankAccountDisplayParts,
  businessAccountedText,
  bankAccountTriggerText,
  cashbookDetailCategoryText,
  cashbookDetailCounterpartyText,
  cashbookDetailCreatorText,
  cashbookCounterpartyHasName,
  cashbookCounterpartyDisplayName,
  cashbookCounterpartyLabel,
  cashbookEntryNeedsCounterpartyHydration,
  cashFirstAccountSort,
  cashbookLinkedDocumentCode,
  financeAccountChoiceLabel,
  isDeletedFinanceAccount,
  financeDateText as dateText,
  sourceTypeText,
  statusText,
  voucherTypeText,
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
import { FinanceFiltersPanel } from './FinanceFiltersPanel'
import { FinanceDetailPanel } from './FinanceDetailPanel'
import { CashbookImportDialog } from './CashbookImportDialog'

const showAuxiliaryFinanceSections = false
const defaultCashbookColumns: CashbookColumnKey[] = [
  'code',
  'created_at',
  'created_by',
  'source_type',
  'finance_account',
  'counterparty',
  'amount_delta',
  'note',
]
const defaultCashbookSortState: NonNullable<ManagementSortState<CashbookColumnKey>> = { key: 'created_at', direction: 'desc' }
const cashbookColumnDefinitions: Array<{ key: CashbookColumnKey; label: string }> = [
  { key: 'code', label: 'Mã phiếu' },
  { key: 'created_at', label: 'Thời gian' },
  { key: 'source_type', label: 'Loại phiếu' },
  { key: 'counterparty', label: 'Người nộp/nhận' },
  { key: 'finance_account', label: 'Loại sổ quỹ' },
  { key: 'amount_delta', label: 'Giá trị' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'is_business_accounted', label: 'Hạch toán KQKD' },
]
type VoucherCounterpartyType = NonNullable<CreateCashbookVoucherInput['counterparty_type']>

const voucherCounterpartyLabels: Record<Exclude<VoucherCounterpartyType, 'none'>, string> = {
  customer: 'Khách hàng',
  supplier: 'Nhà cung cấp',
  employee: 'Nhân viên',
  delivery_partner: 'Đối tác giao hàng',
  other: 'Khác',
}

function voucherCounterpartyTypeOptions(
  voucherType: CashbookVoucherType,
  direction: CashbookDirection,
): Array<{ value: Exclude<VoucherCounterpartyType, 'none'>; label: string }> {
  const values: Array<Exclude<VoucherCounterpartyType, 'none'>> = direction === 'in'
    ? voucherType === 'capital_contribution'
      ? ['employee', 'other']
      : voucherType === 'transfer'
        ? ['other']
        : ['other', 'customer', 'supplier', 'employee', 'delivery_partner']
    : voucherType === 'shipping_expense'
      ? ['delivery_partner', 'other']
      : voucherType === 'supplier_payment' || voucherType === 'material_purchase'
        ? ['supplier', 'other']
        : voucherType === 'staff_salary'
          ? ['employee']
          : voucherType === 'customer_refund'
            ? ['customer', 'other']
            : voucherType === 'operating_expense'
              ? ['employee', 'supplier', 'other']
              : voucherType === 'tax_or_vat' || voucherType === 'transfer'
                ? ['other']
                : voucherType === 'commission'
                  ? ['employee', 'other']
                  : ['customer', 'supplier', 'employee', 'delivery_partner', 'other']

  return values.map((value) => ({ value, label: voucherCounterpartyLabels[value] }))
}

function initialFinanceRouteFilters() {
  const params = new URLSearchParams(window.location.search)
  const search = (params.get('search') ?? '').trim()
  const open = (params.get('open') ?? '').trim()
  const monthRange = currentMonthRange()
  const hasSearch = search.length > 0
  const hasOpen = open.length > 0

  return {
    search,
    open,
    from: hasSearch || hasOpen ? '' : monthRange.from,
    to: hasSearch || hasOpen ? '' : monthRange.to,
    time: (hasSearch || hasOpen ? 'all' : 'month') as CashbookTimeFilter,
  }
}

function cashbookColumnLabel(column: CashbookColumnKey) {
  if (column === 'created_by') return 'Người tạo'
  if (column === 'finance_account') return 'Phương thức TT'
  return cashbookColumnDefinitions.find((definition) => definition.key === column)?.label ?? column
}

function financeAccountPayload(account: FinanceAccount): Omit<FinanceAccount, 'id'> {
  return {
    code: account.code,
    name: account.name,
    account_type: account.account_type,
    is_default_cash: account.is_default_cash,
    is_active: account.is_active,
    account_number: account.account_number,
    account_holder: account.account_holder,
    opening_balance: account.opening_balance,
    note: account.note,
    notify_on_transaction: account.notify_on_transaction,
  }
}

type CashbookEditForm = {
  createdAt: string
  financeAccountId: string
  note: string
}

export function FinancePage({ service, currentUserName = '' }: { service: FinanceService; currentUserName?: string }) {
  const [defaultPageSize] = useState(() => pageSizeForManagementViewport())
  const [routeFilters] = useState(initialFinanceRouteFilters)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [balances, setBalances] = useState<CashbookBalance[]>([])
  const [debts, setDebts] = useState<CustomerDebtSummary[] | null>(null)
  const [debtTotal, setDebtTotal] = useState(0)
  const [debtPage, setDebtPage] = useState(1)
  const [debtPageSize, setDebtPageSize] = useState(defaultPageSize)
  const [lastDebtSearch, setLastDebtSearch] = useState('')
  const [selectedDebt, setSelectedDebt] = useState<CustomerDebtSummary | null>(null)
  const [debtDetail, setDebtDetail] = useState<CustomerDebtDetail | null>(null)
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[] | null>(null)
  const [cashbookTotal, setCashbookTotal] = useState(0)
  const [cashbookPage, setCashbookPage] = useState(1)
  const [cashbookPageSize, setCashbookPageSize] = useState(defaultPageSize)
  const [cashbookSearch, setCashbookSearch] = useState(routeFilters.search)
  const [lastCashbookSearch, setLastCashbookSearch] = useState(routeFilters.search)
  const [cashbookSearchScope] = useState<CashbookSearchScope>('all')
  const [lastCashbookSearchScope, setLastCashbookSearchScope] = useState<CashbookSearchScope>('all')
  const [cashbookTimeFilter, setCashbookTimeFilter] = useState<CashbookTimeFilter>(routeFilters.time)
  const [cashbookFrom, setCashbookFrom] = useState(routeFilters.from)
  const [lastCashbookFrom, setLastCashbookFrom] = useState(routeFilters.from)
  const [cashbookTo, setCashbookTo] = useState(routeFilters.to)
  const [lastCashbookTo, setLastCashbookTo] = useState(routeFilters.to)
  const [cashbookQuickTimeOpen, setCashbookQuickTimeOpen] = useState(false)
  const [cashbookFundMode, setCashbookFundMode] = useState<CashbookFundMode>('all')
  const [cashbookAccountId, setCashbookAccountId] = useState('')
  const [lastCashbookAccountId, setLastCashbookAccountId] = useState('')
  const [bankAccountMenuOpen, setBankAccountMenuOpen] = useState(false)
  const [deletedBankAccountsOpen, setDeletedBankAccountsOpen] = useState(false)
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
  const [cashbookDeleteTarget, setCashbookDeleteTarget] = useState<CashbookEntryDetail | null>(null)
  const [cashbookEditPreview, setCashbookEditPreview] = useState<CashbookEntryDetail | null>(null)
  const [cashbookEditForm, setCashbookEditForm] = useState<CashbookEditForm>({ createdAt: '', financeAccountId: '', note: '' })
  const [savingCashbookEdit, setSavingCashbookEdit] = useState(false)
  const [deletingCashbookEntry, setDeletingCashbookEntry] = useState(false)
  const [cashbookFavoriteIds, setCashbookFavoriteIds] = useState<string[]>(() => readCashbookFavoriteIds())
  const [showCashbookFavoritesOnly, setShowCashbookFavoritesOnly] = useState(false)
  const [cashbookImportOpen, setCashbookImportOpen] = useState(false)
  const visibleCashbookColumns = defaultCashbookColumns
  const [vouchers, setVouchers] = useState<CashbookVoucher[]>([])
  const [voucherMode, setVoucherMode] = useState<CashbookDirection | null>(null)
  const [editingVoucher, setEditingVoucher] = useState<CashbookVoucher | null>(null)
  const [voucherAccountId, setVoucherAccountId] = useState('')
  const [voucherType, setVoucherType] = useState<CreateCashbookVoucherInput['voucher_type']>('other_income')
  const [voucherAmount, setVoucherAmount] = useState('')
  const [voucherIssuedAt, setVoucherIssuedAt] = useState(() => dateTimeInputText(currentSystemDate()))
  const [voucherPaymentMethod, setVoucherPaymentMethod] = useState<CashbookEntryDetail['payment_method']>('cash')
  const [voucherPartnerDebtMode, setVoucherPartnerDebtMode] = useState<PartnerDebtMode>('no_partner_debt')
  const [voucherBusinessAccounted, setVoucherBusinessAccounted] = useState(true)
  const [voucherCounterpartyType, setVoucherCounterpartyType] = useState<CreateCashbookVoucherInput['counterparty_type']>('other')
  const [voucherCounterpartyId, setVoucherCounterpartyId] = useState('')
  const [voucherCounterpartyName, setVoucherCounterpartyName] = useState('')
  const [voucherCounterpartyOptions, setVoucherCounterpartyOptions] = useState<CashbookVoucherCounterpartyOption[]>([])
  const [voucherCounterpartyPhone, setVoucherCounterpartyPhone] = useState('')
  const [voucherCounterpartyCreateOpen, setVoucherCounterpartyCreateOpen] = useState(false)
  const [voucherCounterpartyCreateName, setVoucherCounterpartyCreateName] = useState('')
  const [voucherCounterpartyCreatePhone, setVoucherCounterpartyCreatePhone] = useState('')
  const [voucherCounterpartyCreateCode, setVoucherCounterpartyCreateCode] = useState('')
  const [creatingVoucherCounterparty, setCreatingVoucherCounterparty] = useState(false)
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
  const cashbookSortInitialRender = useRef(true)
  const activeAccounts = accounts.filter((account) => account.is_active)
  const sortedActiveAccounts = [...activeAccounts].sort(cashFirstAccountSort)
  const defaultCashAccountId = sortedActiveAccounts.find((account) => account.account_type === 'cash' && account.is_default_cash)?.id
    ?? sortedActiveAccounts.find((account) => account.account_type === 'cash')?.id
    ?? ''
  const sortedBankAccounts = sortedActiveAccounts
    .filter((account) => account.account_type === 'bank' && !isDeletedFinanceAccount(account))
    .sort((left, right) => {
      const leftPinned = pinnedBankAccountIds.includes(left.id)
      const rightPinned = pinnedBankAccountIds.includes(right.id)
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
      return bankAccountDisplayText(left).localeCompare(bankAccountDisplayText(right), 'vi')
    })
  const pinnedBankAccount = sortedBankAccounts.find((account) => pinnedBankAccountIds.includes(account.id))
  const activeBankAccounts = sortedBankAccounts
  const deletedBankAccounts = accounts
    .filter((account) => account.account_type === 'bank' && isDeletedFinanceAccount(account))
    .sort((left, right) => bankAccountDisplayText(left).localeCompare(bankAccountDisplayText(right), 'vi'))
  const selectedBankAccount = sortedBankAccounts.find((account) => account.id === cashbookAccountId)
  const selectedCashbookEditAccount = sortedActiveAccounts.find((account) => account.id === cashbookEditForm.financeAccountId)
    ?? (cashbookEditPreview?.finance_account.id === cashbookEditForm.financeAccountId ? cashbookEditPreview.finance_account : null)
  const cashbookEditPaymentMethod = selectedCashbookEditAccount?.account_type === 'bank' ? 'bank_transfer' : 'cash'
  const cashbookEditAccountOptions = cashbookEditPaymentMethod === 'bank_transfer'
    ? [
        ...(cashbookEditPreview?.finance_account.account_type === 'bank' ? [cashbookEditPreview.finance_account] : []),
        ...activeBankAccounts.filter((account) => account.id !== cashbookEditPreview?.finance_account.id),
      ]
    : sortedActiveAccounts.filter((account) => account.account_type === 'cash')
  const fundFilteredCashbookEntries = (cashbookEntries ?? []).filter((entry) => (
    cashbookEntryMatchesFundMode(entry, cashbookFundMode, cashbookAccountId)
    && cashbookEntryMatchesSearch(entry, cashbookSearch)
  ))
  const visibleCashbookEntries = showCashbookFavoritesOnly
    ? fundFilteredCashbookEntries.filter((entry) => cashbookFavoriteIds.includes(entry.id))
    : fundFilteredCashbookEntries
  const {
    sortedItems: sortedVisibleCashbookEntries,
    sortState: cashbookSortState,
    requestSort: requestCashbookSort,
  } = useManagementTableSort<CashbookEntry, CashbookColumnKey>(visibleCashbookEntries, {
    code: { kind: 'text', value: (entry) => entry.code },
    created_at: { kind: 'date', value: (entry) => entry.created_at },
    created_by: { kind: 'text', value: (entry) => entry.source?.source_creator_name ?? entry.created_by?.name },
    source_type: { kind: 'text', value: (entry) => entry.source?.category_name ? voucherTypeText(entry.source.category_name, entry.direction) : sourceTypeText(entry.source_type) },
    counterparty: { kind: 'text', value: (entry) => entry.counterparty?.name },
    finance_account: { kind: 'text', value: (entry) => entry.finance_account.account_type === 'bank' ? entry.finance_account.code : '' },
    amount_delta: { kind: 'number', value: (entry) => entry.amount_delta },
    status: { kind: 'text', value: (entry) => statusText(entry.status) },
    note: { kind: 'text', value: (entry) => entry.source?.source_note ?? entry.source?.transfer_content ?? entry.note },
    is_business_accounted: { kind: 'text', value: (entry) => (entry.is_business_accounted ? 'Có' : 'Không') },
  }, defaultCashbookSortState)
  const pagedVisibleCashbookEntries = sortedVisibleCashbookEntries.length > cashbookPageSize
    ? sortedVisibleCashbookEntries.slice((cashbookPage - 1) * cashbookPageSize, cashbookPage * cashbookPageSize)
    : sortedVisibleCashbookEntries
  const cashbookVisibleDateRange = cashbookTimeFilter === 'custom'
    ? { from: cashbookFrom, to: cashbookTo }
    : displayDateRangeForData(
        { from: cashbookFrom, to: cashbookTo },
        dateRangeFromItems(cashbookEntries ?? [], (entry) => entry.created_at),
      )

  useEffect(() => {
    if (voucherMode === null || (voucherCounterpartyType !== 'customer' && voucherCounterpartyType !== 'supplier' && voucherCounterpartyType !== 'employee')) {
      return undefined
    }
    let active = true
    const search = voucherCounterpartyName.trim()
    const timeout = window.setTimeout(() => {
      service
        .listVoucherCounterparties({ type: voucherCounterpartyType, search })
        .then((items) => {
          if (active) setVoucherCounterpartyOptions(items)
        })
        .catch(() => {
          if (active) setVoucherCounterpartyOptions([])
        })
    }, 150)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [service, voucherCounterpartyName, voucherCounterpartyType, voucherMode])

  useEffect(() => {
    if (!voucherCounterpartyName.trim() || voucherCounterpartyId) return
    const selected = voucherCounterpartyOptions.find((option) => option.name === voucherCounterpartyName || `${option.code} - ${option.name}` === voucherCounterpartyName)
    if (!selected) return
    setVoucherCounterpartyId(selected.id)
    setVoucherCounterpartyPhone(selected.phone ?? '')
  }, [voucherCounterpartyId, voucherCounterpartyName, voucherCounterpartyOptions])

  function openVoucherForm(direction: CashbookDirection) {
    const options = voucherTypeOptions(direction)
    const defaultAccount = pinnedBankAccount ?? sortedActiveAccounts[0]
    const defaultVoucherType = options[0].value
    const defaultCounterpartyType = voucherCounterpartyTypeOptions(defaultVoucherType, direction)[0]?.value ?? 'other'
    setEditingVoucher(null)
    setVoucherMode(direction)
    setVoucherAccountId(defaultAccount?.id ?? '')
    setVoucherType(defaultVoucherType)
    setVoucherAmount('')
    setVoucherIssuedAt(dateTimeInputText(currentSystemDate()))
    setVoucherPaymentMethod(defaultAccount?.account_type === 'bank' ? 'bank_transfer' : 'cash')
    setVoucherPartnerDebtMode('no_partner_debt')
    setVoucherBusinessAccounted(direction === 'out')
    setVoucherCounterpartyType(defaultCounterpartyType)
    setVoucherCounterpartyId('')
    setVoucherCounterpartyName('')
    setVoucherCounterpartyOptions([])
    setVoucherCounterpartyPhone('')
    setVoucherCounterpartyCreateOpen(false)
    setVoucherCounterpartyCreateName('')
    setVoucherCounterpartyCreatePhone('')
    setVoucherCounterpartyCreateCode('')
    setVoucherReason('')
    setError(null)
    setMessage(null)
  }

  function chooseVoucherType(nextType: CashbookVoucherType) {
    if (voucherMode === null) return
    const options = voucherCounterpartyTypeOptions(nextType, voucherMode)
    const nextCounterpartyType = options.some((option) => option.value === voucherCounterpartyType)
      ? voucherCounterpartyType
      : options[0]?.value ?? 'other'
    setVoucherType(nextType)
    if (nextCounterpartyType !== voucherCounterpartyType) {
      chooseVoucherCounterpartyType(nextCounterpartyType)
    }
  }

  function openVoucherRevision(voucher: CashbookVoucher, detail?: CashbookEntryDetail) {
    const direction: CashbookDirection = voucher.code.startsWith('PT') ? 'in' : 'out'
    const defaultAccount = pinnedBankAccount ?? sortedActiveAccounts[0]
    const voucherDetail = detail ?? null
    const revisionAccount = voucherDetail?.finance_account.id
      ? sortedActiveAccounts.find((account) => account.id === voucherDetail.finance_account.id) ?? voucherDetail.finance_account
      : defaultAccount
    const revisionPaymentMethod = voucherDetail?.payment_method ?? (revisionAccount?.account_type === 'bank' ? 'bank_transfer' : 'cash')
    setEditingVoucher(voucher)
    setVoucherMode(direction)
    setVoucherAccountId(revisionAccount?.id ?? '')
    setVoucherType((voucherDetail?.source?.category_name && voucherTypeOptions(direction).some((option) => option.value === voucherDetail.source.category_name)
      ? voucherDetail.source.category_name
      : direction === 'in' ? 'other_income' : 'operating_expense') as CashbookVoucherType)
    setVoucherAmount(formatVoucherAmountInput(String(voucher.amount)))
    setVoucherIssuedAt(dateTimeInputText(voucherDetail ? new Date(voucherDetail.created_at) : currentSystemDate()))
    setVoucherPaymentMethod(revisionPaymentMethod)
    setVoucherPartnerDebtMode(voucherDetail?.source?.transfer_content === 'affects_partner_debt'
      || voucherDetail?.source?.transfer_content === 'not_affect_partner_debt'
      || voucherDetail?.source?.transfer_content === 'no_partner_debt'
      ? voucherDetail.source.transfer_content
      : 'no_partner_debt')
    setVoucherBusinessAccounted(voucherDetail?.is_business_accounted ?? true)
    setVoucherCounterpartyType(voucherDetail?.counterparty?.type ?? 'other')
    setVoucherCounterpartyId(voucherDetail?.counterparty?.id ?? '')
    setVoucherCounterpartyName(voucherDetail?.counterparty?.name ?? '')
    setVoucherCounterpartyOptions([])
    setVoucherCounterpartyPhone(voucherDetail?.counterparty?.phone ?? '')
    setVoucherReason(voucherDetail?.note ?? voucherDetail?.source?.source_note ?? '')
    setError(null)
    setMessage(null)
  }

  function closeVoucherForm() {
    setVoucherMode(null)
    setEditingVoucher(null)
    setVoucherCounterpartyCreateOpen(false)
    setVoucherCounterpartyCreateName('')
    setVoucherCounterpartyCreatePhone('')
    setVoucherCounterpartyCreateCode('')
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

  function chooseVoucherCounterpartyType(type: CreateCashbookVoucherInput['counterparty_type']) {
    setVoucherCounterpartyType(type)
    setVoucherCounterpartyId('')
    setVoucherCounterpartyName('')
    setVoucherCounterpartyPhone('')
    setVoucherCounterpartyOptions([])
    setVoucherCounterpartyCreateOpen(false)
    setVoucherCounterpartyCreateName('')
    setVoucherCounterpartyCreatePhone('')
    setVoucherCounterpartyCreateCode('')
  }

  function chooseVoucherCounterpartyName(name: string) {
    setVoucherCounterpartyName(name)
    const selected = voucherCounterpartyOptions.find((option) => option.name === name || `${option.code} - ${option.name}` === name)
    setVoucherCounterpartyId(selected?.id ?? '')
    setVoucherCounterpartyPhone(selected?.phone ?? '')
  }

  function openVoucherCounterpartyCreate() {
    if (voucherCounterpartyType !== 'customer' && voucherCounterpartyType !== 'supplier') return
    setVoucherCounterpartyCreateName(voucherCounterpartyName.trim())
    setVoucherCounterpartyCreatePhone(voucherCounterpartyPhone.trim())
    setVoucherCounterpartyCreateCode('')
    setVoucherCounterpartyCreateOpen(true)
    setError(null)
  }

  function closeVoucherCounterpartyCreate() {
    setVoucherCounterpartyCreateOpen(false)
    setVoucherCounterpartyCreateName('')
    setVoucherCounterpartyCreatePhone('')
    setVoucherCounterpartyCreateCode('')
  }

  async function createVoucherCounterparty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (voucherCounterpartyType !== 'customer' && voucherCounterpartyType !== 'supplier') return
    const name = voucherCounterpartyCreateName.trim()
    if (!name) {
      setError(voucherCounterpartyType === 'customer' ? 'Nhập tên khách hàng.' : 'Nhập tên nhà cung cấp.')
      return
    }
    setCreatingVoucherCounterparty(true)
    setError(null)
    try {
      const created = voucherCounterpartyType === 'customer'
        ? await service.createVoucherCustomer({
            name,
            phone: voucherCounterpartyCreatePhone.trim() || null,
            code: voucherCounterpartyCreateCode.trim() || undefined,
          })
        : await service.createVoucherSupplier({
            name,
            phone: voucherCounterpartyCreatePhone.trim() || null,
            code: voucherCounterpartyCreateCode.trim() || undefined,
          })
      setVoucherCounterpartyOptions((current) => {
        if (current.some((item) => item.id === created.id)) return current
        return [created, ...current]
      })
      setVoucherCounterpartyId(created.id)
      setVoucherCounterpartyName(created.name)
      setVoucherCounterpartyPhone(created.phone ?? '')
      closeVoucherCounterpartyCreate()
    } catch (cause) {
      setError(formatApiError(cause, voucherCounterpartyType === 'customer' ? 'Không tạo được khách hàng.' : 'Không tạo được nhà cung cấp.'))
    } finally {
      setCreatingVoucherCounterparty(false)
    }
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

  const hydrateCashbookDetail = useCallback(async (detail: CashbookEntryDetail): Promise<CashbookEntryDetail> => {
    if (detail.direction !== 'in') return detail
    const documentCode = cashbookLinkedDocumentCode(detail)
    if (documentCode === null || !documentCode.startsWith('HD')) return detail
    const needsCounterpartyHydration = !cashbookCounterpartyHasName(detail.counterparty)
    if (!needsCounterpartyHydration) return detail
    const salesDocument = await service.getSalesDocumentByCode(documentCode)
    if (salesDocument === null) return detail
    const salesDocumentCustomer = salesDocument.customer?.name.trim()
      ? {
          type: 'customer' as const,
          name: salesDocument.customer.name,
          phone: salesDocument.customer.phone,
        }
      : null
    return {
      ...detail,
      counterparty: needsCounterpartyHydration && salesDocumentCustomer !== null
        ? salesDocumentCustomer
        : detail.counterparty,
      source: { ...detail.source, order_code: salesDocument.code },
    }
  }, [service])

  const hydrateCashbookCounterparties = useCallback(async (entries: CashbookEntry[]) => {
    const targets = entries.filter(cashbookEntryNeedsCounterpartyHydration)
    if (targets.length === 0) return
    const details = await Promise.all(targets.map(async (entry) => {
      try {
        return await hydrateCashbookDetail(await service.getCashbookEntry(entry.id))
      } catch {
        return null
      }
    }))
    const detailById = new Map(details
      .filter((detail): detail is CashbookEntryDetail => detail != null && cashbookCounterpartyHasName(detail.counterparty))
      .map((detail) => [detail.id, detail]))
    if (detailById.size === 0) return
    setCashbookEntries((current) => current?.map((item) => {
      const detail = detailById.get(item.id)
      if (detail === undefined || cashbookCounterpartyHasName(item.counterparty)) return item
      return { ...item, counterparty: detail.counterparty }
    }) ?? current)
  }, [hydrateCashbookDetail, service])

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
    sortStateValue?: typeof cashbookSortState
  } = {}) {
    const nextSearch = input.search ?? lastCashbookSearch
    const nextSearchScope = input.search_scope ?? lastCashbookSearchScope
    const nextFrom = input.from ?? lastCashbookFrom
    const nextTo = input.to ?? lastCashbookTo
    const nextAccountId = input.finance_account_id ?? lastCashbookAccountId
    const nextDirection = input.direction ?? lastCashbookDirection
    const nextStatus = input.status ?? lastCashbookStatus
    const nextBusinessAccounted = input.business_accounted_filter ?? lastCashbookBusinessAccounted
    const nextSortState = input.sortStateValue ?? cashbookSortState
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
        ...(nextSortState === null || managementSortStatesEqual(nextSortState, defaultCashbookSortState) ? {} : { sort_key: nextSortState.key, sort_direction: nextSortState.direction }),
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

  useEffect(() => {
    if (cashbookSortInitialRender.current) {
      cashbookSortInitialRender.current = false
      return
    }
    queueMicrotask(() => void loadCashbook({ page: 1, sortStateValue: cashbookSortState }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashbookSortState?.key, cashbookSortState?.direction])

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
        showAuxiliaryFinanceSections ? service.listCashbookBalances() : Promise.resolve({ items: [] }),
        showAuxiliaryFinanceSections ? service.listCashbookVouchers() : Promise.resolve({ items: [], total: 0 }),
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
        const [accountResult, balanceResult, voucherResult, debtResult, cashbookResult] = await Promise.all([
          service.listAccounts({ is_active: true }),
          showAuxiliaryFinanceSections ? service.listCashbookBalances() : Promise.resolve({ items: [] }),
          showAuxiliaryFinanceSections ? service.listCashbookVouchers() : Promise.resolve({ items: [], total: 0 }),
          service.listCustomerDebts({ page: 1, page_size: defaultPageSize }),
          service.listCashbookEntries({
            search: routeFilters.search || routeFilters.open || undefined,
            from: routeFilters.from || undefined,
            to: routeFilters.to || undefined,
            direction: 'all',
            status: 'posted',
            page: 1,
            page_size: defaultPageSize,
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
        if (routeFilters.open) {
          const openedEntry = cashbookResult.items.find((entry) => entry.code === routeFilters.open)
          if (openedEntry) {
            setSelectedCashbookEntry(openedEntry)
            setCashbookDetail(null)
            try {
              const detail = await hydrateCashbookDetail(await service.getCashbookEntry(openedEntry.id))
              if (!active) return
              setCashbookDetail(detail)
              setCashbookEntries((current) => current?.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)) ?? current)
            } catch (cause) {
              if (active) setError(formatApiError(cause, 'KhÃ´ng táº£i Ä‘Æ°á»£c chi tiáº¿t sá»• quá»¹.'))
            }
          }
        }
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được dữ liệu tài chính.'))
      }
    }
    void loadInitial()
    return () => {
      active = false
    }
  }, [defaultPageSize, hydrateCashbookCounterparties, hydrateCashbookDetail, routeFilters.from, routeFilters.open, routeFilters.search, routeFilters.to, service])

  async function filterCashbook(event: React.FormEvent<HTMLFormElement>) {
    preventManagementSearchSubmit(event, () => applyCashbookSearch(cashbookSearch))
  }

  function applyCashbookSearch(nextSearch: string) {
    return applyCashbookFilters({ search: nextSearch })
  }

  function changeCashbookSearch(nextSearch: string) {
    runManagementLiveSearch(nextSearch, {
      setSearch: setCashbookSearch,
      load: applyCashbookSearch,
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
      try {
        const patch = financeAccountPayload(nextAccount)
        const updated = await service.updateFinanceAccount(editingBankAccountId, patch)
        setAccounts((current) => current.map((account) => account.id === editingBankAccountId ? updated : account))
        setBankAccountModalOpen(false)
      } catch (err) {
        setError(formatApiError(err, 'Không thể cập nhật tài khoản ngân hàng.'))
      }
      return
    }
    try {
      const payload = financeAccountPayload(nextAccount)
      const created = await service.createFinanceAccount(payload)
      setAccounts((current) => [...current, created])
      setCashbookFundMode('bank')
      setCashbookAccountId(created.id)
      setBankAccountModalOpen(false)
      await applyCashbookFilters({ finance_account_id: created.id })
    } catch (err) {
      setError(formatApiError(err, 'Không thể tạo tài khoản ngân hàng.'))
    }
  }

  async function softDeleteBankAccount() {
    if (editingBankAccountId === null) return
    const deletedAccountId = editingBankAccountId
    try {
      const updated = await service.updateFinanceAccount(deletedAccountId, { is_active: false })
      setAccounts((current) => current.map((account) => (
        account.id === deletedAccountId ? updated : account
      )))
      setPinnedBankAccountIds((current) => {
        const nextIds = current.filter((id) => id !== deletedAccountId)
        writePinnedBankAccountIds(nextIds)
        return nextIds
      })
      setBankAccountModalOpen(false)
      setBankAccountMenuOpen(false)
      setDeletedBankAccountsOpen(false)
      if (cashbookAccountId === deletedAccountId) {
        setCashbookAccountId('')
        setCashbookFundMode('bank')
        await applyCashbookFilters({ finance_account_id: '', finance_account_type: 'bank' })
      }
    } catch (err) {
      setError(formatApiError(err, 'Không thể xóa tài khoản ngân hàng.'))
    }
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
      const detail = await hydrateCashbookDetail(await service.getCashbookEntry(entry.id))
      setCashbookDetail(detail)
      setCashbookEntries((current) => current?.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)) ?? current)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được chi tiết sổ quỹ.'))
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

  async function exportCashbook() {
    setError(null)
    try {
      const exportPageSize = Math.max(cashbookTotal, visibleCashbookEntries.length, 1)
      const exportSortState = cashbookSortState ?? defaultCashbookSortState
      const result = await service.listCashbookEntries({
        search: lastCashbookSearch.trim() || undefined,
        search_scope: lastCashbookSearchScope,
        from: lastCashbookFrom.trim() || undefined,
        to: lastCashbookTo.trim() || undefined,
        finance_account_id: lastCashbookAccountId === 'all' || lastCashbookAccountId === '' ? undefined : lastCashbookAccountId,
        finance_account_type: cashbookFundMode === 'bank' && lastCashbookAccountId === '' ? 'bank' : undefined,
        direction: lastCashbookDirection,
        status: lastCashbookStatus,
        is_business_accounted: lastCashbookBusinessAccounted === 'all' ? undefined : lastCashbookBusinessAccounted === 'true',
        page: 1,
        page_size: exportPageSize,
        sort_key: exportSortState.key,
        sort_direction: exportSortState.direction,
      })
      const exportItems = showCashbookFavoritesOnly
        ? result.items.filter((item) => cashbookFavoriteIds.includes(item.id))
        : result.items
      downloadManagementCsv({
        filename: 'so-quy.csv',
        rows: buildCashbookCsv(exportItems),
      })
      setMessage('Đã tạo file sổ quỹ.')
    } catch (cause) {
      setError(formatApiError(cause, 'Không xuất được file sổ quỹ.'))
    }
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
    if (column === 'created_by') return entry.source?.source_creator_name ?? entry.created_by?.name ?? currentUserName
    if (column === 'finance_account') return financeAccountChoiceLabel(entry.finance_account)
    if (column === 'source_type') return entry.source?.category_name ? voucherTypeText(entry.source.category_name, entry.direction) : sourceTypeText(entry.source_type)
    if (column === 'counterparty') {
      if (!cashbookCounterpartyHasName(entry.counterparty)) return ''
      const label = cashbookCounterpartyLabel(entry)
      const counterpartyName = entry.counterparty?.name ?? ''
      const displayName = cashbookCounterpartyDisplayName(counterpartyName)
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
    if (column === 'note') return entry.source?.source_note ?? entry.source?.transfer_content ?? entry.note ?? ''
    return entry.is_business_accounted ? 'Có' : 'Không'
  }

  function cashbookCellClassName(column: CashbookColumnKey) {
    if (column === 'amount_delta') return 'finance-cashbook-money-column'
    if (column === 'note') return 'management-table-cell-truncate'
    return undefined
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
    if (voucherCounterpartyType === 'employee' && voucherCounterpartyId.trim() === '') {
      setError('Chọn nhân viên từ danh sách nhân viên đã lưu.')
      return
    }
    const issuedAt = parseManagementDateTimeInputText(voucherIssuedAt)
    if (issuedAt === null) {
      setError('Thời gian phiếu không hợp lệ.')
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
        created_at: issuedAt.toISOString(),
        amount,
        partner_debt_mode: voucherPartnerDebtMode,
        is_business_accounted: voucherBusinessAccounted,
        counterparty_type: voucherCounterpartyType,
        ...(voucherCounterpartyId.trim() ? { counterparty_id: voucherCounterpartyId.trim() } : {}),
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

  function canDeleteCashbookDetail(detail: CashbookEntryDetail) {
    return (detail.source.type === 'manual_voucher' || detail.source.type === 'payment_receipt') && detail.status === 'posted'
  }

  async function confirmCashbookDelete() {
    if (cashbookDeleteTarget === null) return
    if (!canDeleteCashbookDetail(cashbookDeleteTarget)) {
      setCashbookDeleteTarget(null)
      setError('Chỉ hủy được phiếu tự nhập. Dữ liệu KiotViet cần xử lý qua luồng import/chứng từ gốc.')
      return
    }

    setDeletingCashbookEntry(true)
    setError(null)
    setMessage(null)
    try {
      const result = await service.cancelCashbookVoucher(cashbookDeleteTarget.source.id)
      setMessage(`Đã hủy phiếu ${result.code}.`)
      setCashbookDeleteTarget(null)
      setSelectedCashbookEntry(null)
      setCashbookDetail(null)
      await Promise.all([loadCashbook({ page: 1 }), loadReferenceData()])
    } catch (cause) {
      setError(formatApiError(cause, 'Không hủy được phiếu thu chi.'))
    } finally {
      setDeletingCashbookEntry(false)
    }
  }

  function openCashbookDetailEdit(detail: CashbookEntryDetail) {
    if (detail.source.type === 'manual_voucher' && detail.status === 'posted') {
      openVoucherRevision({
        id: detail.source.id,
        code: detail.source.code || detail.code,
        source_type: 'manual_voucher',
        status: detail.status,
        amount: Math.abs(detail.amount_delta),
      }, detail)
      return
    }
    setCashbookEditPreview(detail)
    setCashbookEditForm({
      createdAt: dateText(detail.created_at),
      financeAccountId: detail.finance_account.id,
      note: detail.note ?? detail.source.source_note ?? '',
    })
  }

  function closeCashbookEditPreview() {
    setCashbookEditPreview(null)
    setCashbookEditForm({ createdAt: '', financeAccountId: '', note: '' })
  }

  function changeCashbookEditPaymentMethod(paymentMethod: 'cash' | 'bank_transfer') {
    const nextAccount = paymentMethod === 'bank_transfer'
      ? (selectedCashbookEditAccount?.account_type === 'bank' ? selectedCashbookEditAccount : activeBankAccounts[0])
      : (selectedCashbookEditAccount?.account_type === 'cash' ? selectedCashbookEditAccount : sortedActiveAccounts.find((account) => account.account_type === 'cash'))
    setCashbookEditForm((current) => ({ ...current, financeAccountId: nextAccount?.id ?? '' }))
  }

  async function saveCashbookEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cashbookEditPreview) return
    const createdAt = parseManagementDateTimeInputText(cashbookEditForm.createdAt)
    if (!createdAt) {
      setError('Thời gian không đúng định dạng dd/mm/yyyy hh:mm.')
      return
    }
    setSavingCashbookEdit(true)
    setError(null)
    setMessage(null)
    try {
      const financeAccountId = cashbookEditForm.financeAccountId === cashbookEditPreview.finance_account.id
        ? undefined
        : cashbookEditForm.financeAccountId
      const saved = await hydrateCashbookDetail(await service.updateCashbookEntry(cashbookEditPreview.id, {
        created_at: `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}T${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}:00.000Z`,
        ...(financeAccountId !== undefined ? { finance_account_id: financeAccountId } : {}),
        note: cashbookEditForm.note.trim() || null,
      }))
      setCashbookDetail((current) => current?.id === saved.id ? saved : current)
      setCashbookEntries((current) => current?.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)) ?? current)
      setSelectedCashbookEntry((current) => current?.id === saved.id ? { ...current, ...saved } : current)
      closeCashbookEditPreview()
      await Promise.all([loadCashbook({ page: cashbookPage }), loadReferenceData()])
      setCashbookEntries((current) => current?.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)) ?? current)
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được phiếu thu chi.'))
    } finally {
      setSavingCashbookEdit(false)
    }
  }

  const voucherDialogLabel = voucherMode === null
    ? ''
    : editingVoucher === null
      ? `Tạo phiếu ${voucherMode === 'in' ? 'thu' : 'chi'}`
      : `Sửa phiếu ${editingVoucher.code}`
  const voucherDialogTitle = voucherMode === null
    ? ''
    : editingVoucher === null
      ? `Tạo phiếu ${voucherMode === 'in' ? 'thu' : 'chi'}`
      : `Sửa phiếu ${editingVoucher.code}`
  const voucherCounterpartyRole = voucherMode === 'in' ? 'nộp' : 'nhận'
  const voucherActorRole = voucherMode === 'in' ? 'thu' : 'chi'
  const voucherTypeLabel = voucherMode === 'in' ? 'Loại thu' : 'Loại chi'
  const voucherAccountLabel = voucherMode === 'in' ? 'Tài khoản nhận' : 'Tài khoản chi'
  const voucherCounterpartyTypeLabel = voucherMode === 'in' ? 'Đối tượng nộp' : 'Đối tượng nhận'
  const voucherCounterpartyNameLabel = voucherMode === 'in' ? 'Tên người nộp' : 'Tên người nhận'
  const voucherActorName = currentUserName.trim() || 'Cloud Admin'
  const voucherCounterpartyOptionsForType = voucherMode === null ? [] : voucherCounterpartyTypeOptions(voucherType, voucherMode)
  const bankAccountModalTitle = editingBankAccountId === null ? 'Thêm tài khoản ngân hàng' : 'Sửa tài khoản ngân hàng'
  return (
    <ManagementPage
      title="Sổ quỹ"
      actions={
        <FinanceFiltersPanel
          search={cashbookSearch}
          onCreateVoucher={() => openVoucherForm('in')}
          onCreateExpenseVoucher={() => openVoucherForm('out')}
          onExportCashbook={exportCashbook}
          onOpenImport={() => setCashbookImportOpen(true)}
          onSearchChange={changeCashbookSearch}
          onSubmit={filterCashbook}
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
                <button
                  aria-expanded={cashbookQuickTimeOpen}
                  className="management-filter-choice management-filter-time-trigger"
                  type="button"
                  onClick={() => setCashbookQuickTimeOpen((current) => !current)}
                >
                  <span>{cashbookTimeFilter === 'custom' ? `${displayDate(cashbookFrom)} - ${displayDate(cashbookTo)}` : cashbookQuickTimeLabels[cashbookTimeFilter]}</span>
                  <span className="management-filter-choice-trailing">
                    <ChevronRight aria-hidden="true" size={17} />
                  </span>
                </button>
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
              <ManagementDateRangeInputs
                displayFrom={cashbookVisibleDateRange.from}
                displayTo={cashbookVisibleDateRange.to}
                from={cashbookFrom}
                to={cashbookTo}
                onCalendarOpen={() => setCashbookQuickTimeOpen(false)}
                onFromChange={(value) => void applyCashbookCustomDateFilter({ from: value })}
                onToChange={(value) => void applyCashbookCustomDateFilter({ to: value })}
              />
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
                    <span>{selectedBankAccount ? bankAccountTriggerText(selectedBankAccount) : 'Chọn tài khoản'}</span>
                    <ChevronDown aria-hidden="true" size={16} />
                  </button>
                  {bankAccountMenuOpen ? (
                    <div className="management-filter-account-menu" role="listbox" aria-label="Danh sách tài khoản ngân hàng">
                      <div className="management-filter-account-list">
                        {sortedBankAccounts.length > 0 ? sortedBankAccounts.map((account) => {
                          const accountLabel = bankAccountDisplayText(account)
                          const accountParts = bankAccountDisplayParts(account)
                          return (
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
                              <span className="management-filter-account-option-label">
                                <strong>{accountParts.primary}</strong>
                                {accountParts.secondary ? <span>{accountParts.secondary}</span> : null}
                                {accountParts.tertiary ? <em>{accountParts.tertiary}</em> : null}
                              </span>
                              <span className="management-filter-account-actions">
                                <button
                                  aria-label={`Sửa tài khoản ${accountLabel}`}
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
                                  aria-label={`Ghim tài khoản ${accountLabel}`}
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
                          )
                        }) : <span className="management-filter-account-empty">Không có tài khoản phù hợp</span>}
                      </div>
                      {deletedBankAccounts.length > 0 ? (
                        <div className="management-filter-account-deleted">
                          <button
                            aria-expanded={deletedBankAccountsOpen}
                            className="management-filter-account-deleted-toggle"
                            type="button"
                            onClick={() => setDeletedBankAccountsOpen((current) => !current)}
                          >
                            <span>Tài khoản đã xóa</span>
                            <ChevronDown aria-hidden="true" size={14} />
                          </button>
                          {deletedBankAccountsOpen ? (
                            <div className="management-filter-account-list">
                              {deletedBankAccounts.map((account) => {
                                const accountParts = bankAccountDisplayParts(account)
                                return (
                                  <div className="management-filter-account-option management-filter-account-option-muted" key={account.id}>
                                    <span className="management-filter-account-option-label">
                                      <strong>{accountParts.primary}</strong>
                                      {accountParts.secondary ? <span>{accountParts.secondary}</span> : null}
                                      {accountParts.tertiary ? <em>{accountParts.tertiary}</em> : null}
                                    </span>
                                    <span className="status-chip status-chip-neutral">Đã xóa</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
                    onChange={(event) => chooseVoucherType(event.target.value as CashbookVoucherType)}
                  >
                    {voucherTypeOptions(voucherMode).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Người {voucherActorRole}
                  <select disabled value={voucherActorName}>
                    <option value={voucherActorName}>{voucherActorName}</option>
                  </select>
                </label>
                <label>
                  {voucherCounterpartyTypeLabel}
                  <select
                    value={voucherCounterpartyType}
                    onChange={(event) => chooseVoucherCounterpartyType(event.target.value as CreateCashbookVoucherInput['counterparty_type'])}
                  >
                    {voucherCounterpartyOptionsForType.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="management-field-heading">
                    <label htmlFor="finance-voucher-counterparty-name">{voucherCounterpartyNameLabel}</label>
                    {voucherCounterpartyType === 'customer' || voucherCounterpartyType === 'supplier' ? (
                      <button
                        aria-label={voucherCounterpartyType === 'customer' ? 'Tạo mới khách hàng' : 'Tạo mới nhà cung cấp'}
                        className="management-field-link-action"
                        type="button"
                        onClick={openVoucherCounterpartyCreate}
                      >
                        Tạo mới
                      </button>
                    ) : null}
                  </span>
                  <input
                    id="finance-voucher-counterparty-name"
                    aria-label={voucherCounterpartyNameLabel}
                    list="finance-voucher-counterparty-options"
                    placeholder={`Tìm người ${voucherCounterpartyRole}`}
                    value={voucherCounterpartyName}
                    onChange={(event) => chooseVoucherCounterpartyName(event.target.value)}
                  />
                  <datalist id="finance-voucher-counterparty-options">
                    {voucherCounterpartyOptions.map((option) => (
                      <option key={option.id} value={option.name}>{option.code} - {option.name}</option>
                    ))}
                  </datalist>
                </div>
                <label>
                  Phương thức TT
                  <select
                    value={voucherPaymentMethod}
                    onChange={(event) => chooseVoucherPaymentMethod(event.target.value as CashbookEntryDetail['payment_method'])}
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                  </select>
                </label>
                {voucherPaymentMethod === 'bank_transfer' ? (
                  <label>
                    {voucherAccountLabel}
                    <select value={voucherAccountId} onChange={(event) => chooseVoucherAccount(event.target.value)}>
                      <option value="">Chọn tài khoản</option>
                      {activeBankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{financeAccountChoiceLabel(account)}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
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

      {voucherCounterpartyCreateOpen && (voucherCounterpartyType === 'customer' || voucherCounterpartyType === 'supplier') ? (
        <div className="management-modal-backdrop">
          <section
            aria-label={voucherCounterpartyType === 'customer' ? 'Tạo nhanh khách hàng' : 'Tạo nhanh nhà cung cấp'}
            aria-modal="true"
            className="management-modal-dialog management-modal-dialog-compact"
            role="dialog"
          >
            <header className="management-modal-header">
              <div>
                <h2>{voucherCounterpartyType === 'customer' ? 'Tạo nhanh khách hàng' : 'Tạo nhanh nhà cung cấp'}</h2>
              </div>
              <button
                aria-label={voucherCounterpartyType === 'customer' ? 'Đóng tạo nhanh khách hàng' : 'Đóng tạo nhanh nhà cung cấp'}
                className="management-modal-close"
                type="button"
                onClick={closeVoucherCounterpartyCreate}
              >
                ×
              </button>
            </header>
            <form
              aria-label={voucherCounterpartyType === 'customer' ? 'Thông tin tạo nhanh khách hàng' : 'Thông tin tạo nhanh nhà cung cấp'}
              className="management-modal-form"
              onSubmit={createVoucherCounterparty}
            >
              <div className="management-modal-form-grid">
                <label>
                  {voucherCounterpartyType === 'customer' ? 'Tên khách hàng' : 'Tên NCC'}
                  <input
                    autoFocus
                    required
                    value={voucherCounterpartyCreateName}
                    onChange={(event) => setVoucherCounterpartyCreateName(event.target.value)}
                  />
                </label>
                <label>
                  {voucherCounterpartyType === 'customer' ? 'Mã khách hàng' : 'Mã NCC'}
                  <input
                    placeholder="Bỏ trống để tự sinh"
                    value={voucherCounterpartyCreateCode}
                    onChange={(event) => setVoucherCounterpartyCreateCode(event.target.value)}
                  />
                </label>
                <label>
                  Điện thoại
                  <input
                    value={voucherCounterpartyCreatePhone}
                    onChange={(event) => setVoucherCounterpartyCreatePhone(event.target.value)}
                  />
                </label>
              </div>
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={closeVoucherCounterpartyCreate}>Bỏ qua</button>
                <button className="button button-primary" disabled={creatingVoucherCounterparty} type="submit">
                  Lưu
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      <CashbookImportDialog
        open={cashbookImportOpen}
        service={service}
        onClose={() => setCashbookImportOpen(false)}
        onImported={() => {
          void Promise.all([loadCashbook({ page: 1 }), loadReferenceData()])
        }}
        onOldDataDeleted={() => {
          void loadCashbook({ page: 1 })
        }}
      />

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
                    {vietnamBankOptions.map((bank) => (
                      <option key={bank.bin} value={bank.shortName}>{vietnamBankOptionLabel(bank)}</option>
                    ))}
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
              <footer className="management-modal-footer management-modal-footer-split">
                <div>
                  {editingBankAccountId !== null ? (
                    <button className="button button-danger" type="button" onClick={() => void softDeleteBankAccount()}>
                      <Trash2 aria-hidden="true" size={15} />
                      <span>Xóa</span>
                    </button>
                  ) : null}
                </div>
                <div className="management-modal-footer-actions">
                  <button className="button button-secondary" type="button" onClick={() => setBankAccountModalOpen(false)}>Bỏ qua</button>
                  <button className="button button-primary" type="submit">Lưu</button>
                </div>
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
                      <td>{debt.oldest_order_code ?? ''}</td>
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
                      <ManagementSortableHeader
                        key={column}
                        kind={column === 'amount_delta' ? 'number' : column === 'created_at' ? 'date' : 'text'}
                        sortKey={column}
                        sortState={cashbookSortState}
                        onSort={requestCashbookSort}
                      >
                        {cashbookColumnLabel(column)}
                      </ManagementSortableHeader>
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
                        {visibleCashbookColumns.map((column) => {
                          const content = cashbookCell(entry, column)
                          const text = typeof content === 'string' ? content : undefined
                          return (
                            <td className={cashbookCellClassName(column)} key={column} title={column === 'note' ? text : undefined}>
                              {column === 'note' ? <span className="management-table-cell-truncate-content">{content}</span> : content}
                            </td>
                          )
                        })}
                      </tr>
                      {selectedCashbookEntry?.id === entry.id ? (
                        <ManagementDetailRow colSpan={visibleCashbookColumns.length + 2} label={`Chi tiết sổ quỹ ${entry.code}`}>
                          <FinanceDetailPanel
                            detail={cashbookDetail}
                            currentUserName={currentUserName}
                            onDeleteRequest={setCashbookDeleteTarget}
                            onEditRequest={openCashbookDetailEdit}
                          />
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
                      ) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        )}
      </ManagementListSurface>
      ) : null}
      <ManagementConfirmDialog
        cancelLabel="Bỏ qua"
        confirmLabel={cashbookDeleteTarget && canDeleteCashbookDetail(cashbookDeleteTarget) ? 'Xóa' : 'Đã hiểu'}
        loading={deletingCashbookEntry}
        message={
          cashbookDeleteTarget && canDeleteCashbookDetail(cashbookDeleteTarget)
            ? `Phiếu ${cashbookDeleteTarget.code} sẽ được hủy mềm và hoàn lại phân bổ công nợ liên quan.`
            : 'Chỉ hủy được phiếu tự nhập. Dữ liệu KiotViet cần xử lý qua luồng import/chứng từ gốc.'
        }
        open={cashbookDeleteTarget !== null}
        title={cashbookDeleteTarget ? `Xóa phiếu ${cashbookDeleteTarget.code}` : 'Xóa phiếu'}
        onCancel={() => setCashbookDeleteTarget(null)}
        onConfirm={() => void confirmCashbookDelete()}
      />
      {cashbookEditPreview ? (
        <div className="management-modal-backdrop">
          <section
            aria-label={`Sửa phiếu ${cashbookEditPreview.code}`}
            aria-modal="true"
            className="management-modal-dialog finance-cashbook-edit-preview-dialog"
            role="dialog"
          >
            <header className="management-modal-header">
              <h2>{`Sửa phiếu ${cashbookEditPreview.code}`}</h2>
              <button
                aria-label={`Đóng popup sửa phiếu ${cashbookEditPreview.code}`}
                className="management-icon-button"
                type="button"
                onClick={closeCashbookEditPreview}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="finance-cashbook-edit-meta-line">
              <span><strong>Người tạo</strong> {cashbookDetailCreatorText(cashbookEditPreview) || currentUserName}</span>
              <span><strong>Khách hàng</strong> {cashbookDetailCounterpartyText(cashbookEditPreview) || '---'}</span>
            </div>
            <form aria-label={`Sửa phiếu ${cashbookEditPreview.code}`} className="management-modal-form finance-cashbook-edit-form" onSubmit={saveCashbookEdit}>
              <div className="management-modal-form-grid finance-cashbook-edit-form-grid">
                <ManagementDateTimeInput
                  className="finance-cashbook-edit-date-field"
                  dateButtonLabel="Chọn ngày phiếu"
                  datePickerLabel="Lịch chọn ngày phiếu"
                  inputLabel="Sửa thời gian phiếu"
                  label="Thời gian"
                  timeButtonLabel="Chọn giờ phiếu"
                  timePickerLabel="Chọn giờ phiếu"
                  value={cashbookEditForm.createdAt}
                  onChange={(createdAt) => setCashbookEditForm((current) => ({ ...current, createdAt }))}
                />
                <label>
                  Loại thu/chi
                  <input readOnly value={cashbookDetailCategoryText(cashbookEditPreview)} />
                </label>
                <ManagementDropdownField
                  label="Phương thức TT"
                  menuLabel="Chọn phương thức TT"
                  options={[
                    { value: 'cash', label: 'Tiền mặt' },
                    { value: 'bank_transfer', label: 'Chuyển khoản' },
                  ]}
                  value={cashbookEditPaymentMethod}
                  onChange={(value) => changeCashbookEditPaymentMethod(value as 'cash' | 'bank_transfer')}
                />
                {cashbookEditPaymentMethod === 'bank_transfer' ? (
                  <ManagementDropdownField
                    label="Số tài khoản"
                    menuLabel="Chọn số tài khoản"
                    options={cashbookEditAccountOptions.map((account) => ({
                      value: account.id,
                      label: financeAccountChoiceLabel(account),
                    }))}
                    value={cashbookEditForm.financeAccountId}
                    onChange={(financeAccountId) => setCashbookEditForm((current) => ({ ...current, financeAccountId }))}
                  />
                ) : null}
                <label className="management-modal-field-wide">
                  Tổng tiền {cashbookEditPreview.direction === 'in' ? 'thu' : 'chi'}
                  <input readOnly value={formatMoney(Math.abs(cashbookEditPreview.amount_delta))} />
                </label>
                <label className="management-modal-field-wide">
                  Ghi chú
                  <input
                    placeholder="Ghi chú..."
                    value={cashbookEditForm.note}
                    onChange={(event) => setCashbookEditForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </label>
              </div>
              {cashbookEditPreview.allocations.length > 0 ? (
                <section aria-label="Phân bổ vào hóa đơn" className="finance-cashbook-edit-allocation">
                  <label className="management-modal-checkbox-row finance-cashbook-edit-allocation-checkbox">
                    <input checked readOnly type="checkbox" />
                    <span>Phân bổ vào hóa đơn</span>
                  </label>
                  <ManagementTableViewport>
                    <table aria-label="Phân bổ vào hóa đơn" className="management-table management-detail-table finance-cashbook-edit-allocation-table">
                      <thead>
                        <tr>
                          <th>Mã phiếu</th>
                          <th>Thời gian</th>
                          <th>Giá trị phiếu</th>
                          <th>Đã thu trước</th>
                          <th>Tiền thu/chi</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashbookEditPreview.allocations.map((allocation) => (
                          <tr key={allocation.order_id || allocation.order_code}>
                            <td>{allocation.order_code}</td>
                            <td>{dateText(cashbookEditPreview.created_at)}</td>
                            <td><MoneyText value={allocation.order_total_amount} /></td>
                            <td><MoneyText value={allocation.collected_before} /></td>
                            <td><MoneyText value={allocation.allocated_amount} /></td>
                            <td><StatusChip tone={allocation.remaining_after <= 0 ? 'success' : 'warning'}>{allocation.remaining_after <= 0 ? 'Đã thanh toán' : 'Thanh toán 1 phần'}</StatusChip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ManagementTableViewport>
                </section>
              ) : null}
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={closeCashbookEditPreview}>Bỏ qua</button>
                <button className="button button-primary" disabled={savingCashbookEdit || !cashbookEditForm.financeAccountId} type="submit">Lưu</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </ManagementPage>
  )
}
