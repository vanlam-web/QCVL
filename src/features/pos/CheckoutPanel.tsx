import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { CalendarDays, Clock3, Pin } from 'lucide-react'
import type { Customer } from '../catalog/types'
import { customerDebtCurrentAmountFromLedger } from '../catalog/customer-debt-ledger'
import type { FinanceService } from '../finance/finance-service'
import type { CashbookEntry } from '../finance/types'
import type {
  CheckoutCartLine,
  CheckoutResult,
  CustomerDebtDetail,
  FinanceAccount,
  OrderService,
  QuoteSummary,
} from '../orders/order-service'
import type { SalesDocumentListItem, SalesDocumentService } from '../sales-documents/sales-document-service'
import { managementDateTimeCalendarDays, managementDateTimeTimeOptions } from '../../components/ui-shell/management-date-time-picker'
import { formatApiError } from '../../lib/api/error-message'
import { formatQcvDateTime, parseQcvDateTimeInputToStoredIso } from '../../lib/date-format'
import { currentSystemDate, currentSystemISOString } from '../../lib/system-clock'
import { formatMoney, parseMoneyInput } from '../../lib/number-format'
import { BillNamedTemplatePicker } from '../sales-documents/BillNamedTemplatePicker'
import {
  listBillTemplatesForDocument,
  readOrganizationBillSettingsCache,
  resolveNamedPrintTemplate,
  resolvePreferredNamedTemplate,
  writeOrganizationBillSettingsCache,
  type OrganizationBillSettings,
} from '../sales-documents/bill-settings'
import { checkoutSummary, linesToCheckoutItems } from './pos-core'

const pinnedBankAccountsStorageKey = 'finance.bankAccounts.pinnedIds'

export function CheckoutPanel({
  cartLines,
  selectedCustomer,
  orderService,
  orderNote = '',
  quoteBlockedReason = null,
  sellerName = '',
  orderCreatedAt,
  autoFocusCustomerPayment = false,
  revisionSource,
  loadBillSettings,
  onCheckoutSuccess,
}: {
  cartLines: CheckoutCartLine[]
  selectedCustomer: Customer | null
  orderService: OrderService
  financeService?: Pick<FinanceService, never>
  salesDocumentService?: Pick<SalesDocumentService, 'listSalesDocuments'>
  orderNote?: string
  quoteBlockedReason?: string | null
  sellerName?: string
  orderCreatedAt?: string
  autoFocusCustomerPayment?: boolean
  revisionSource?: { id: string; code: string }
  loadBillSettings?: () => Promise<OrganizationBillSettings>
  onCheckoutSuccess?: (payload: {
    kind: 'invoice' | 'quote'
    documentId: string
    templateId: string
  }) => void
}) {
  const [cashAmountOverride, setCashAmountOverride] = useState<number | null>(null)
  const [checkoutDiscountAmount, setCheckoutDiscountAmount] = useState(0)
  const [bankAmount, setBankAmount] = useState(0)
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccountMenuOpen, setBankAccountMenuOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank' | 'mixed'>('cash')
  const [mixedBankAutoBalance, setMixedBankAutoBalance] = useState(false)
  const [oldDebtPaymentAmount, setOldDebtPaymentAmount] = useState(0)
  const [oldDebtExpanded, setOldDebtExpanded] = useState(false)
  const [retailDebtNote, setRetailDebtNote] = useState('')
  const [surplusMode, setSurplusMode] = useState<'return' | 'old-debt'>('return')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [pinnedBankAccountIds, setPinnedBankAccountIds] = useState<string[]>(() => readPinnedBankAccountIds())
  const [customerDebt, setCustomerDebt] = useState<CustomerDebtDetail | null>(null)
  const [customerDebtLedger, setCustomerDebtLedger] = useState<{
    debt: CustomerDebtDetail
    invoiceHistory: SalesDocumentListItem[]
    cashbookHistory: CashbookEntry[]
  } | null>(null)
  const [debtLookupError, setDebtLookupError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [quoteResult, setQuoteResult] = useState<QuoteSummary | null>(null)
  const [invoiceDateDraft, setInvoiceDateDraft] = useState(() => ({ source: orderCreatedAt, value: checkoutDateInputValue(orderCreatedAt) }))
  const [invoiceTimeDraft, setInvoiceTimeDraft] = useState(() => ({ source: orderCreatedAt, value: formatCheckoutDateTime(orderCreatedAt).time }))
  const [invoiceDateTimePickerOpen, setInvoiceDateTimePickerOpen] = useState<'date' | 'time' | null>(null)
  const [invoiceCalendarMonth, setInvoiceCalendarMonth] = useState(() => checkoutCalendarMonth(orderCreatedAt))
  const [billSettings, setBillSettings] = useState<OrganizationBillSettings>(() => readOrganizationBillSettingsCache())
  const [invoiceBillTemplateOverride, setInvoiceBillTemplateOverride] = useState<{
    customerKey: string
    templateId: string
  } | null>(null)
  const invoiceDateTimePickerRef = useRef<HTMLDivElement | null>(null)
  const customerPaymentInputRef = useRef<HTMLInputElement | null>(null)
  const selectedCustomerId = selectedCustomer?.id ?? null
  const effectiveOldDebtPaymentAmount = selectedCustomerId === null ? 0 : oldDebtPaymentAmount
  const invoiceBillTemplates = listBillTemplatesForDocument(billSettings, 'invoice')
  const customerBillKey = selectedCustomer?.id ?? selectedCustomer?.code ?? 'walk-in'
  const preferredInvoiceBillTemplateId = resolvePreferredNamedTemplate({
    settings: billSettings,
    documentType: 'invoice',
    customerCode: selectedCustomer?.code,
    preferredTemplate: selectedCustomer?.preferred_bill_template,
    preferredTemplates: selectedCustomer?.preferred_bill_templates,
  }).id
  const invoiceBillTemplateId =
    invoiceBillTemplateOverride?.customerKey === customerBillKey
      ? invoiceBillTemplateOverride.templateId
      : preferredInvoiceBillTemplateId

  const {
    subtotal,
    maxCheckoutDiscount,
    total,
    cashAmount,
    customerPaymentAmount,
    surplus,
    debt,
    oldDebtPayment,
    grossCashAmount,
  } = checkoutSummary({
    cartLines,
    checkoutDiscountAmount,
    cashAmountOverride,
    bankAmount,
    paymentMode,
    selectedCustomerId,
    surplusMode,
    oldDebtPaymentAmount: effectiveOldDebtPaymentAmount,
  })
  const visibleCustomerDebt =
    selectedCustomer !== null && customerDebt?.customer_id === selectedCustomer.id ? customerDebt : null
  const visibleCustomerDebtAmount =
    selectedCustomer !== null && customerDebtLedger?.debt.customer_id === selectedCustomer.id
      ? customerDebtCurrentAmountFromLedger(customerDebtLedger, selectedCustomer.total_debt_amount ?? 0)
      : visibleCustomerDebt?.total_debt ?? 0
  const pinnedBankAccount = useMemo(
    () => accounts.find((account) => pinnedBankAccountIds.includes(account.id)) ?? null,
    [accounts, pinnedBankAccountIds],
  )
  const selectedBankAccountId = bankAccountId || pinnedBankAccount?.id || ''
  const selectedBankAccount = accounts.find((account) => account.id === selectedBankAccountId) ?? null
  const invoiceDate = invoiceDateDraft.source === orderCreatedAt ? invoiceDateDraft.value : checkoutDateInputValue(orderCreatedAt)
  const invoiceTime = invoiceTimeDraft.source === orderCreatedAt ? invoiceTimeDraft.value : formatCheckoutDateTime(orderCreatedAt).time

  useEffect(() => {
    let active = true
    orderService
      .listFinanceAccounts()
      .then((response) => {
        if (active) setAccounts(response.items.filter((account) => account.account_type === 'bank'))
      })
      .catch(() => {
        if (active) setAccounts([])
      })
    return () => {
      active = false
    }
  }, [orderService])

  useEffect(() => {
    let active = true
    if (!loadBillSettings) return undefined
    void loadBillSettings()
      .then((remote) => {
        if (!active) return
        const saved = writeOrganizationBillSettingsCache(remote)
        setBillSettings(saved)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [loadBillSettings])

  useEffect(() => {
    let active = true

    if (selectedCustomer === null) return

    orderService.getCustomerDebt(selectedCustomer.id)
      .then((debt) => {
        if (active) {
          setCustomerDebt(debt)
          setCustomerDebtLedger({
            debt,
            invoiceHistory: [],
            cashbookHistory: debt.cashbook_entries ?? [],
          })
          setDebtLookupError(null)
          setOldDebtPaymentAmount(0)
          setOldDebtExpanded(false)
        }
      })
      .catch((cause) => {
        if (active) {
          setDebtLookupError(formatApiError(cause, 'Không tải được công nợ khách hàng.'))
        }
      })

    return () => {
      active = false
    }
  }, [orderService, selectedCustomer])

  useEffect(() => {
    if (invoiceDateTimePickerOpen === null) return

    function closeInvoiceDateTimePickerOnOutsidePointerDown(event: PointerEvent) {
      const container = invoiceDateTimePickerRef.current
      if (container === null) return
      if (event.target instanceof Node && !container.contains(event.target)) {
        setInvoiceDateTimePickerOpen(null)
      }
    }

    window.addEventListener('pointerdown', closeInvoiceDateTimePickerOnOutsidePointerDown)
    return () => {
      window.removeEventListener('pointerdown', closeInvoiceDateTimePickerOnOutsidePointerDown)
    }
  }, [invoiceDateTimePickerOpen])

  useEffect(() => {
    if (!autoFocusCustomerPayment) return

    const animationFrameId = window.requestAnimationFrame(() => {
      const input = customerPaymentInputRef.current
      input?.focus()
      input?.select()
    })
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [autoFocusCustomerPayment])

  const selectedInvoiceDate = parseCheckoutDisplayDate(invoiceDate)
  const invoiceCalendarDays = managementDateTimeCalendarDays(invoiceCalendarMonth, 6)
  const selectInvoiceDate = (date: Date) => {
    setInvoiceDateDraft({ source: orderCreatedAt, value: formatCheckoutDisplayDate(date) })
    setInvoiceCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setInvoiceDateTimePickerOpen(null)
  }
  const selectInvoiceTime = (time: string) => {
    setInvoiceTimeDraft({ source: orderCreatedAt, value: time })
    setInvoiceDateTimePickerOpen(null)
  }
  const toggleInvoiceDatePicker = () => {
    const nextOpen = invoiceDateTimePickerOpen === 'date' ? null : 'date'
    if (nextOpen === 'date') {
      const base = parseCheckoutDisplayDate(invoiceDate) ?? currentSystemDate()
      setInvoiceCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setInvoiceDateTimePickerOpen(nextOpen)
  }

  async function submitCheckout() {
    setError(null)
    setResult(null)
    setQuoteResult(null)
    if (cartLines.length === 0) {
      setError('Chưa có dòng hàng để checkout.')
      return
    }
    if (quoteBlockedReason !== null) {
      setError(quoteBlockedReason)
      return
    }
    if (bankAmount > 0 && selectedBankAccountId === '') {
      setError('Chọn tài khoản nhận chuyển khoản.')
      return
    }
    if (selectedCustomer === null && debt > 0 && retailDebtNote.trim() === '') {
      setError('Nhập ghi chú nợ khách lẻ.')
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const oldDebtAllocations = await loadOldDebtAllocations(oldDebtPayment)
      const checkout = await orderService.checkout({
        customer_id: selectedCustomer?.id,
        created_at: checkoutCreatedAt(orderCreatedAt, invoiceDate, invoiceTime),
        note: orderNote.trim() || undefined,
        retail_debt_note: selectedCustomer === null ? retailDebtNote.trim() || undefined : undefined,
        items: linesToCheckoutItems(cartLines, checkoutDiscountAmount),
        payment: {
          cash_amount: grossCashAmount,
          bank_amount: bankAmount,
          bank_account_id: bankAmount > 0 ? selectedBankAccountId : null,
          old_debt_payment_amount: oldDebtPayment,
          old_debt_allocations: oldDebtAllocations,
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      })
      setResult(checkout)
      onCheckoutSuccess?.({
        kind: 'invoice',
        documentId: checkout.order.id,
        templateId: resolveNamedPrintTemplate(billSettings, 'invoice', { templateId: invoiceBillTemplateId }).id,
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được hóa đơn.'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function submitInvoiceRevision() {
    if (revisionSource === undefined) return
    setError(null)
    setResult(null)
    setQuoteResult(null)
    if (cartLines.length === 0) {
      setError('Chưa có dòng hàng để lưu hóa đơn sửa.')
      return
    }
    if (quoteBlockedReason !== null) {
      setError(quoteBlockedReason)
      return
    }
    if (bankAmount > 0 && selectedBankAccountId === '') {
      setError('Chọn tài khoản nhận chuyển khoản.')
      return
    }
    if (selectedCustomer === null && debt > 0 && retailDebtNote.trim() === '') {
      setError('Nhập ghi chú nợ khách lẻ.')
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const oldDebtAllocations = await loadOldDebtAllocations(oldDebtPayment)
      const revised = await orderService.reviseInvoice(revisionSource.id, {
        customer_id: selectedCustomer?.id,
        created_at: checkoutCreatedAt(orderCreatedAt, invoiceDate, invoiceTime),
        note: orderNote.trim() || undefined,
        retail_debt_note: selectedCustomer === null ? retailDebtNote.trim() || undefined : undefined,
        revision_reason_code: 'other',
        revision_reason_note: 'Sửa hóa đơn từ POS',
        items: linesToCheckoutItems(cartLines, checkoutDiscountAmount),
        payment: {
          cash_amount: grossCashAmount,
          bank_amount: bankAmount,
          bank_account_id: bankAmount > 0 ? selectedBankAccountId : null,
          old_debt_payment_amount: oldDebtPayment,
          old_debt_allocations: oldDebtAllocations,
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      })
      setResult(revised)
      onCheckoutSuccess?.({
        kind: 'invoice',
        documentId: revised.order.id,
        templateId: resolveNamedPrintTemplate(billSettings, 'invoice', { templateId: invoiceBillTemplateId }).id,
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được hóa đơn sửa.'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function loadOldDebtAllocations(amount: number) {
    if (selectedCustomer === null || amount <= 0) return undefined
    const response = await orderService.getCustomerOpenDebts(selectedCustomer.id, { amount, limit: 50 })
    return response.items.map((item) => ({
      order_id: item.order_id,
      order_code: item.order_code,
      allocated_amount: item.allocated_amount,
    }))
  }

  async function saveQuote() {
    setError(null)
    setResult(null)
    setQuoteResult(null)
    if (cartLines.length === 0) {
      setError('Chưa có dòng hàng để lưu báo giá.')
      return
    }
    if (quoteBlockedReason !== null) {
      setError(quoteBlockedReason)
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const payload = {
        customer_id: selectedCustomer?.id,
        created_at: checkoutCreatedAt(orderCreatedAt, invoiceDate, invoiceTime),
        note: orderNote.trim() || undefined,
        retail_debt_note: selectedCustomer === null ? retailDebtNote.trim() || undefined : undefined,
        items: linesToCheckoutItems(cartLines, checkoutDiscountAmount),
        payment: {
          cash_amount: grossCashAmount,
          bank_amount: bankAmount,
          bank_account_id: bankAmount > 0 ? selectedBankAccountId : null,
          old_debt_payment_amount: oldDebtPayment,
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      }
      const quote = await orderService.saveQuote(payload)
      setQuoteResult(quote)
      const invoiceNamed = resolveNamedPrintTemplate(billSettings, 'invoice', { templateId: invoiceBillTemplateId })
      const quoteNamed = resolveNamedPrintTemplate(billSettings, 'quote', { paper: invoiceNamed.paper_size })
      onCheckoutSuccess?.({
        kind: 'quote',
        documentId: quote.id,
        templateId: quoteNamed.id,
      })
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được báo giá.'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function choosePaymentMode(mode: 'cash' | 'bank' | 'mixed') {
    setPaymentMode(mode)
    if (mode === 'cash') {
      setCashAmountOverride(null)
      setBankAmount(0)
      setMixedBankAutoBalance(false)
      return
    }
    if (mode === 'mixed') {
      setCashAmountOverride(total)
      setBankAmount(0)
      setMixedBankAutoBalance(true)
      return
    }
    setCashAmountOverride(0)
    setBankAmount(total)
    setMixedBankAutoBalance(false)
  }

  function togglePinnedBankAccountId(accountId: string) {
    setBankAccountId(accountId)
    setPinnedBankAccountIds((current) => {
      const nextIds = current.includes(accountId) ? [] : [accountId]
      writePinnedBankAccountIds(nextIds)
      return nextIds
    })
  }

  const displaySellerName = sellerName.trim() || 'Nhân viên bán'

  return (
    <section aria-label="Thanh toán" className="checkout-panel">
      <header className="checkout-panel-header">
        <div aria-label="Thông tin hóa đơn" className="checkout-panel-meta" ref={invoiceDateTimePickerRef} role="group">
          <strong aria-label="Tên hiển thị" title={displaySellerName}>{displaySellerName}</strong>
          <span className="checkout-panel-date-time-shell">
            <input
              aria-label="Ngày hóa đơn"
              className="checkout-panel-date-input"
              inputMode="numeric"
              placeholder="dd/MM/yyyy"
              type="text"
              value={invoiceDate}
              onChange={(event) => {
                setInvoiceDateDraft({ source: orderCreatedAt, value: event.target.value })
                const parsed = parseCheckoutDisplayDate(event.target.value)
                if (parsed) setInvoiceCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
              }}
            />
            <button
              aria-expanded={invoiceDateTimePickerOpen === 'date'}
              aria-label="Chọn ngày hóa đơn"
              className="management-date-time-input-button checkout-panel-date-time-button checkout-panel-date-button"
              type="button"
              onClick={toggleInvoiceDatePicker}
            >
              <CalendarDays aria-hidden="true" size={14} />
            </button>
            {invoiceDateTimePickerOpen === 'date' ? (
              <section aria-label="Lịch chọn ngày hóa đơn" className="management-date-time-picker management-date-time-date-picker checkout-panel-date-time-picker checkout-panel-date-picker">
                <header>
                  <button aria-label="Tháng trước" type="button" onClick={() => setInvoiceCalendarMonth(new Date(invoiceCalendarMonth.getFullYear(), invoiceCalendarMonth.getMonth() - 1, 1))}>
                    ‹
                  </button>
                  <strong>Tháng {invoiceCalendarMonth.getMonth() + 1} {invoiceCalendarMonth.getFullYear()}</strong>
                  <button aria-label="Tháng sau" type="button" onClick={() => setInvoiceCalendarMonth(new Date(invoiceCalendarMonth.getFullYear(), invoiceCalendarMonth.getMonth() + 1, 1))}>
                    ›
                  </button>
                </header>
                <div aria-hidden="true" className="management-date-time-weekdays checkout-panel-date-weekdays">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="management-date-time-calendar-grid checkout-panel-date-grid">
                  {invoiceCalendarDays.map((date) => {
                    const selected = selectedInvoiceDate ? date.toDateString() === selectedInvoiceDate.toDateString() : false
                    return (
                      <button
                        aria-pressed={selected}
                        className={date.getMonth() === invoiceCalendarMonth.getMonth() ? undefined : 'management-date-time-muted-day checkout-panel-muted-day'}
                        key={date.toISOString()}
                        type="button"
                        onClick={() => selectInvoiceDate(date)}
                      >
                        {date.getDate()}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </span>
          <span className="checkout-panel-date-time-shell checkout-panel-time-shell">
            <input
              aria-label="Thời gian hóa đơn"
              className="checkout-panel-time-input"
              inputMode="numeric"
              placeholder="HH:mm"
              type="text"
              value={invoiceTime}
              onChange={(event) => setInvoiceTimeDraft({ source: orderCreatedAt, value: event.target.value })}
            />
            <button
              aria-expanded={invoiceDateTimePickerOpen === 'time'}
              aria-label="Chọn giờ hóa đơn"
              className="management-date-time-input-button checkout-panel-date-time-button checkout-panel-time-button"
              type="button"
              onClick={() => setInvoiceDateTimePickerOpen((current) => current === 'time' ? null : 'time')}
            >
              <Clock3 aria-hidden="true" size={14} />
            </button>
            {invoiceDateTimePickerOpen === 'time' ? (
              <section aria-label="Chọn giờ hóa đơn" className="management-date-time-picker management-date-time-time-picker checkout-panel-date-time-picker checkout-panel-time-picker">
                {managementDateTimeTimeOptions.map((time) => (
                  <button key={time} type="button" onClick={() => selectInvoiceTime(time)}>
                    {time}
                  </button>
                ))}
              </section>
            ) : null}
          </span>
        </div>
        <div className="checkout-customer-line">
          <strong>{selectedCustomer?.name ?? 'Khách lẻ'}</strong>
          {selectedCustomer !== null && visibleCustomerDebtAmount > 0 ? (
            <span className="checkout-customer-debt">{formatMoney(visibleCustomerDebtAmount)}</span>
          ) : null}
        </div>
      </header>

      <dl aria-label="Tóm tắt thanh toán" className="checkout-summary checkout-summary-compact">
        <div>
          <dt>{`Tiền hàng (${cartLines.length})`}</dt>
          <dd />
          <dd>{formatMoney(subtotal)}</dd>
        </div>
        <div>
          <dt>Giảm giá</dt>
          <dd />
          <dd>
            <MoneyInput
              ariaLabel="Giảm giá"
              value={checkoutDiscountAmount}
              onChange={(value) => setCheckoutDiscountAmount(Math.min(value, maxCheckoutDiscount))}
            />
          </dd>
        </div>
        <div className="checkout-summary-highlight">
          <dt>Khách cần trả</dt>
          <dd />
          <dd>{formatMoney(total)}</dd>
        </div>
        {paymentMode === 'mixed' ? (
          <>
            <div>
              <dt>Thanh toán tiền mặt</dt>
              <dd />
              <dd>
                <MoneyInput
                  ariaLabel="Thanh toán tiền mặt"
                  value={cashAmount}
                  onChange={(value) => {
                    setCashAmountOverride(value)
                    if (mixedBankAutoBalance) {
                      setBankAmount(Math.max(total - value, 0))
                    }
                    setPaymentMode('mixed')
                  }}
                />
              </dd>
            </div>
            <div>
              <dt>Thanh toán ngân hàng</dt>
              <dd />
              <dd>
                <MoneyInput
                  ariaLabel="Thanh toán ngân hàng"
                  value={bankAmount}
                  onChange={(value) => {
                    setBankAmount(value)
                    setMixedBankAutoBalance(false)
                    setPaymentMode('mixed')
                  }}
                />
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Khách thanh toán</dt>
            <dd />
            <dd>
              <MoneyInput
                ariaLabel="Khách thanh toán"
                inputRef={customerPaymentInputRef}
                value={customerPaymentAmount}
                onChange={(nextAmount) => {
                  if (paymentMode === 'bank') {
                    setBankAmount(nextAmount)
                    return
                  }
                  setCashAmountOverride(nextAmount)
                  setPaymentMode('cash')
                }}
              />
            </dd>
          </div>
        )}
        {selectedCustomer !== null && visibleCustomerDebtAmount > 0 ? (
          <div className="checkout-old-debt-summary">
            <dt>Tổng nợ cũ</dt>
            <dd />
            <dd>
              <button className="button button-secondary" type="button" onClick={() => setOldDebtExpanded((open) => !open)}>
                Trả thêm nợ cũ
              </button>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{surplus > 0 ? 'Tiền thừa' : 'Còn nợ'}</dt>
          <dd />
          <dd>{formatMoney(surplus > 0 ? surplus : debt)}</dd>
        </div>
      </dl>

      {selectedCustomer !== null && debtLookupError ? <p role="status">{debtLookupError}</p> : null}

      <fieldset className="checkout-payment-methods">
        <legend>Phương thức TT</legend>
        <label className={paymentMode === 'cash' ? 'checkout-payment-method-active' : undefined}>
          <input
            checked={paymentMode === 'cash'}
            name="checkout-payment-method"
            type="radio"
            onChange={() => choosePaymentMode('cash')}
          />
          Tiền mặt
        </label>
        <label className={paymentMode === 'bank' ? 'checkout-payment-method-active' : undefined}>
          <input
            checked={paymentMode === 'bank'}
            name="checkout-payment-method"
            type="radio"
            onChange={() => choosePaymentMode('bank')}
          />
          Chuyển khoản
        </label>
        <label className={paymentMode === 'mixed' ? 'checkout-payment-method-active' : undefined}>
          <input
            checked={paymentMode === 'mixed'}
            name="checkout-payment-method"
            type="radio"
            onChange={() => choosePaymentMode('mixed')}
          />
          Kết hợp
        </label>
      </fieldset>

      {(paymentMode === 'bank' || paymentMode === 'mixed' || bankAmount > 0) ? (
        <div className="checkout-bank-account-row">
          <button
            aria-label={`Tài khoản nhận chuyển khoản ${selectedBankAccount ? financeAccountLabel(selectedBankAccount) : 'Chọn tài khoản'}`}
            aria-expanded={bankAccountMenuOpen}
            aria-haspopup="listbox"
            className="checkout-bank-account-trigger"
            type="button"
            onClick={() => setBankAccountMenuOpen((open) => !open)}
          >
            <span>Tài khoản nhận chuyển khoản</span>
            <strong>{selectedBankAccount ? financeAccountLabel(selectedBankAccount) : 'Chọn tài khoản'}</strong>
          </button>
          {bankAccountMenuOpen ? (
            <div aria-label="Danh sách tài khoản nhận chuyển khoản" className="checkout-bank-account-menu" role="listbox">
              {accounts.map((account) => {
                const pinned = pinnedBankAccountIds.includes(account.id)
                return (
                  <div
                    aria-label={financeAccountLabel(account)}
                    aria-selected={selectedBankAccountId === account.id}
                    className="checkout-bank-account-option"
                    key={account.id}
                    role="option"
                    tabIndex={0}
                    onClick={() => {
                      setBankAccountId(account.id)
                      setBankAccountMenuOpen(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setBankAccountId(account.id)
                      setBankAccountMenuOpen(false)
                    }}
                  >
                    <span>{financeAccountLabel(account)}</span>
                    <button
                      aria-label={`${pinned ? 'Bỏ ghim' : 'Ghim'} tài khoản ${financeAccountLabel(account)}`}
                      aria-pressed={pinned}
                      className={pinned ? 'management-icon-button checkout-bank-account-pin checkout-bank-account-pin-active' : 'management-icon-button checkout-bank-account-pin'}
                      title={pinned ? 'Bỏ ghim tài khoản' : 'Ghim tài khoản'}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        togglePinnedBankAccountId(account.id)
                      }}
                    >
                      <Pin aria-hidden="true" size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedCustomer !== null && oldDebtExpanded ? (
        <label className="checkout-payment-card">
          Thanh toán nợ cũ
          <MoneyInput
            ariaLabel="Thanh toán nợ cũ"
            className=""
            value={oldDebtPaymentAmount}
            onChange={setOldDebtPaymentAmount}
          />
        </label>
      ) : null}

      {selectedCustomer === null && debt > 0 ? (
        <label>
          Ghi chú nợ khách lẻ
          <input
            aria-label="Ghi chú nợ khách lẻ"
            value={retailDebtNote}
            onChange={(event) => setRetailDebtNote(event.target.value)}
          />
        </label>
      ) : null}

      {selectedCustomer !== null && surplus > 0 ? (
        <fieldset>
          <legend>Khách trả dư {formatMoney(surplus)}</legend>
          <label>
            <input
              checked={surplusMode === 'return'}
              name="surplus-mode"
              type="radio"
              onChange={() => setSurplusMode('return')}
            />
            Trả lại khách
          </label>
          <label>
            <input
              checked={surplusMode === 'old-debt'}
              name="surplus-mode"
              type="radio"
              onChange={() => setSurplusMode('old-debt')}
            />
            Cấn vào nợ cũ
          </label>
        </fieldset>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      {quoteBlockedReason ? <p role="status">{quoteBlockedReason}</p> : null}
      {invoiceBillTemplates.length > 0 ? (
        <div className="checkout-bill-template">
          <BillNamedTemplatePicker
            compact
            legend="Mẫu in"
            name="checkout_bill_template"
            templates={invoiceBillTemplates}
            value={invoiceBillTemplateId}
            onChange={(templateId) => setInvoiceBillTemplateOverride({ customerKey: customerBillKey, templateId })}
          />
        </div>
      ) : null}
      <div aria-label="Thao tác cuối đơn" className="checkout-action-row">
        {revisionSource === undefined ? (
          <button
            className="button button-secondary"
            disabled={submitting || cartLines.length === 0 || quoteBlockedReason !== null}
            type="button"
            onClick={() => void saveQuote()}
          >
            Báo giá
          </button>
        ) : null}
        <button
          className="button button-primary"
          disabled={submitting || quoteBlockedReason !== null}
          type="button"
          onClick={() => void (revisionSource === undefined ? submitCheckout() : submitInvoiceRevision())}
        >
          {revisionSource === undefined ? 'Tạo hóa đơn' : 'Lưu sửa hóa đơn'}
        </button>
      </div>

      {quoteResult ? (
        <section aria-label="Kết quả báo giá" className="checkout-result">
          <strong>{quoteResult.code}</strong>
          <p>{formatMoney(quoteResult.total_amount)}</p>
        </section>
      ) : null}

      {result ? (
        <section aria-label="Kết quả checkout" className="checkout-result">
          <strong>{result.order.code}</strong>
          {result.payment_receipt ? <span>{result.payment_receipt.code}</span> : null}
          <p>{`Đã trả ${formatMoney(result.order.paid_amount)}`}</p>
          <p>{`Còn nợ ${formatMoney(result.order.debt_amount)}`}</p>
          {result.inventory_warnings.map((warning) => (
            <p key={`${warning.product_id}-${warning.message}`}>{warning.message}</p>
          ))}
        </section>
      ) : null}
    </section>
  )
}

function MoneyInput({
  ariaLabel,
  className = 'checkout-inline-money-input',
  inputRef,
  value,
  onChange,
}: {
  ariaLabel: string
  className?: string
  inputRef?: Ref<HTMLInputElement>
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayValue = draft ?? formatMoney(value)

  return (
    <input
      aria-label={ariaLabel}
      className={className}
      inputMode="numeric"
      ref={inputRef}
      type="text"
      value={displayValue}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(readMoney(event.target.value))
      }}
      onFocus={(event) => {
        setDraft(formatMoney(value))
        // Select synchronously. Deferred select (rAF) races with the next keystrokes
        // and can wipe typed digits in tests and when typing starts immediately.
        event.currentTarget.select()
      }}
    />
  )
}

function formatCheckoutDateTime(value: string | undefined) {
  const formatted = formatQcvDateTime(value ?? currentSystemDate(), '')
  if (!formatted) {
    return { date: '', time: '' }
  }
  const [date, time] = formatted.split(' ')
  return {
    date,
    time,
  }
}

function checkoutDateInputValue(value: string | undefined) {
  const formatted = formatCheckoutDateTime(value).date
  if (formatted) return formatted
  return formatCheckoutDateTime(currentSystemISOString()).date
}

function checkoutCalendarMonth(value: string | undefined) {
  const parsed = parseCheckoutDisplayDate(checkoutDateInputValue(value)) ?? currentSystemDate()
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
}

function checkoutCreatedAt(orderCreatedAt: string | undefined, invoiceDate: string, invoiceTime: string) {
  const source = orderCreatedAt ?? currentSystemISOString()
  const time = parseCheckoutTimeInput(invoiceTime)
  const createdAt = parseQcvDateTimeInputToStoredIso(`${invoiceDate} ${invoiceTime}`)
  if (!time || !createdAt) return source
  return createdAt
}

function parseCheckoutDateInput(value: string) {
  const localDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (localDate) {
    const [, day, month, year] = localDate
    return `${year}-${month}-${day}`
  }
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) return value
  return null
}

function parseCheckoutDisplayDate(value: string) {
  const parsed = parseCheckoutDateInput(value)
  if (!parsed) return null
  const [year, month, day] = parsed.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function formatCheckoutDisplayDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function parseCheckoutTimeInput(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null
}

function readMoney(value: string): number {
  const parsed = parseMoneyInput(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function readPinnedBankAccountIds() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pinnedBankAccountsStorageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writePinnedBankAccountIds(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(pinnedBankAccountsStorageKey, JSON.stringify(ids))
}

function financeAccountLabel(account: FinanceAccount) {
  return `${account.code} - ${account.name}`
}

