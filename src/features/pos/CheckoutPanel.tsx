import { useEffect, useMemo, useState } from 'react'
import { Pin } from 'lucide-react'
import type { Customer } from '../catalog/types'
import type {
  CheckoutCartLine,
  CheckoutResult,
  CustomerDebtDetail,
  FinanceAccount,
  OrderService,
  QuoteSummary,
} from '../orders/order-service'
import { formatApiError } from '../../lib/api/error-message'
import { formatKvDateTime } from '../../lib/date-format'
import { formatMoney, parseMoneyInput } from '../../lib/number-format'
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
  revisionSource,
  onCheckoutSuccess,
}: {
  cartLines: CheckoutCartLine[]
  selectedCustomer: Customer | null
  orderService: OrderService
  orderNote?: string
  quoteBlockedReason?: string | null
  sellerName?: string
  orderCreatedAt?: string
  revisionSource?: { id: string; code: string }
  onCheckoutSuccess?: () => void
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
  const [debtLookupError, setDebtLookupError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [quoteResult, setQuoteResult] = useState<QuoteSummary | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(() => checkoutDateInputValue(orderCreatedAt))
  const [invoiceTime, setInvoiceTime] = useState(() => formatCheckoutDateTime(orderCreatedAt).time)

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
    selectedCustomerId: selectedCustomer?.id ?? null,
    surplusMode,
    oldDebtPaymentAmount,
  })
  const visibleCustomerDebt =
    selectedCustomer !== null && customerDebt?.customer_id === selectedCustomer.id ? customerDebt : null
  const pinnedBankAccount = useMemo(
    () => accounts.find((account) => pinnedBankAccountIds.includes(account.id)) ?? null,
    [accounts, pinnedBankAccountIds],
  )
  const selectedBankAccountId = bankAccountId || pinnedBankAccount?.id || ''
  const selectedBankAccount = accounts.find((account) => account.id === selectedBankAccountId) ?? null

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

    if (selectedCustomer === null) return

    orderService
      .getCustomerDebt(selectedCustomer.id)
      .then((response) => {
        if (active) {
          setCustomerDebt(response)
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
    setInvoiceDate(checkoutDateInputValue(orderCreatedAt))
    setInvoiceTime(formatCheckoutDateTime(orderCreatedAt).time)
  }, [orderCreatedAt])

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

    setSubmitting(true)
    try {
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
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      })
      setResult(checkout)
      onCheckoutSuccess?.()
    } catch (cause) {
      setError(formatApiError(cause, 'Không tạo được hóa đơn.'))
    } finally {
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

    setSubmitting(true)
    try {
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
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      })
      setResult(revised)
      onCheckoutSuccess?.()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được hóa đơn sửa.'))
    } finally {
      setSubmitting(false)
    }
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
      setQuoteResult(await orderService.saveQuote(payload))
      onCheckoutSuccess?.()
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được báo giá.'))
    } finally {
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
        <div aria-label="Thông tin hóa đơn" className="checkout-panel-meta" role="group">
          <strong aria-label="Tên hiển thị" title={displaySellerName}>{displaySellerName}</strong>
          <input
            aria-label="Ngày hóa đơn"
            className="checkout-panel-date-input"
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
          />
          <input
            aria-label="Thời gian hóa đơn"
            className="checkout-panel-time-input"
            type="time"
            value={invoiceTime}
            onChange={(event) => setInvoiceTime(event.target.value)}
          />
        </div>
        <div className="checkout-customer-line">
          <strong>{selectedCustomer?.name ?? 'Khách lẻ'}</strong>
          {selectedCustomer !== null && visibleCustomerDebt !== null && visibleCustomerDebt.total_debt > 0 ? (
            <span className="checkout-customer-debt">Tổng nợ {formatMoney(visibleCustomerDebt.total_debt)}</span>
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
        {selectedCustomer !== null && visibleCustomerDebt !== null && visibleCustomerDebt.total_debt > 0 ? (
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
      {selectedCustomer !== null && visibleCustomerDebt?.invoices.length ? (
        <ul className="customer-debt-list" aria-label="Hóa đơn còn nợ">
          {visibleCustomerDebt.invoices.slice(0, 3).map((invoice) => (
            <li key={invoice.order_id}>
              <span>{invoice.order_code}</span>
              <span>{formatMoney(invoice.remaining_debt)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="checkout-payment-methods">
        <legend>Phương thức thanh toán</legend>
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
  value,
  onChange,
}: {
  ariaLabel: string
  className?: string
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
      type="text"
      value={displayValue}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(readMoney(event.target.value))
      }}
      onFocus={(event) => {
        const input = event.currentTarget
        setDraft(formatMoney(value))
        window.requestAnimationFrame(() => input.select())
      }}
    />
  )
}

function formatCheckoutDateTime(value: string | undefined) {
  const formatted = formatKvDateTime(value ?? new Date(), '')
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
  const source = value ?? new Date().toISOString()
  const date = source.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  if (date) return date
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function checkoutCreatedAt(orderCreatedAt: string | undefined, invoiceDate: string, invoiceTime: string) {
  const source = orderCreatedAt ?? new Date().toISOString()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !/^\d{2}:\d{2}$/.test(invoiceTime)) return source
  return `${invoiceDate}T${invoiceTime}:00.000Z`
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

