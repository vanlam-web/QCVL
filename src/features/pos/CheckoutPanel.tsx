import { useEffect, useMemo, useState } from 'react'
import type { Customer } from '../catalog/types'
import type {
  CheckoutCartLine,
  CheckoutResult,
  CustomerDebtDetail,
  FinanceAccount,
  OrderService,
  QuoteSummary,
  RecentPriceList,
} from '../orders/order-service'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'

export function CheckoutPanel({
  cartLines,
  selectedCustomer,
  orderService,
  sourceQuote,
  orderNote = '',
  quoteBlockedReason = null,
  onCheckoutSuccess,
}: {
  cartLines: CheckoutCartLine[]
  selectedCustomer: Customer | null
  orderService: OrderService
  sourceQuote?: { id: string; code: string }
  orderNote?: string
  quoteBlockedReason?: string | null
  onCheckoutSuccess?: () => void
}) {
  const [cashAmountOverride, setCashAmountOverride] = useState<number | null>(null)
  const [bankAmount, setBankAmount] = useState(0)
  const [bankAccountId, setBankAccountId] = useState('')
  const [oldDebtPaymentAmount, setOldDebtPaymentAmount] = useState(0)
  const [retailDebtNote, setRetailDebtNote] = useState('')
  const [surplusMode, setSurplusMode] = useState<'return' | 'old-debt'>('return')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [customerDebt, setCustomerDebt] = useState<CustomerDebtDetail | null>(null)
  const [debtLookupError, setDebtLookupError] = useState<string | null>(null)
  const [recentPrices, setRecentPrices] = useState<Record<string, RecentPriceList['items']>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [quoteResult, setQuoteResult] = useState<QuoteSummary | null>(null)

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + lineSubtotal(line), 0),
    [cartLines],
  )
  const discountAmount = useMemo(
    () => cartLines.reduce((sum, line) => sum + lineDiscount(line), 0),
    [cartLines],
  )
  const total = subtotal - discountAmount
  const cashAmount = cashAmountOverride ?? total
  const received = cashAmount + bankAmount
  const surplus = Math.max(received - total, 0)
  const debt = Math.max(total - received, 0)
  const visibleCustomerDebt =
    selectedCustomer !== null && customerDebt?.customer_id === selectedCustomer.id ? customerDebt : null
  const oldDebtPayment = selectedCustomer !== null && surplusMode === 'old-debt'
    ? oldDebtPaymentAmount + surplus
    : oldDebtPaymentAmount
  const grossCashAmount = cashAmount + oldDebtPaymentAmount

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

  async function showRecentPrices(line: CheckoutCartLine) {
    if (selectedCustomer === null) return
    const response = await orderService.listRecentCustomerProductPrices(selectedCustomer.id, line.product.id)
    setRecentPrices((current) => ({ ...current, [line.id]: response.items.slice(0, 5) }))
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
    if (bankAmount > 0 && bankAccountId === '') {
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
        note: orderNote.trim() || undefined,
        retail_debt_note: selectedCustomer === null ? retailDebtNote.trim() || undefined : undefined,
        items: cartLines.map(lineToCheckoutItem),
        payment: {
          cash_amount: grossCashAmount,
          bank_amount: bankAmount,
          bank_account_id: bankAmount > 0 ? bankAccountId : null,
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
        note: orderNote.trim() || undefined,
        retail_debt_note: selectedCustomer === null ? retailDebtNote.trim() || undefined : undefined,
        items: cartLines.map(lineToCheckoutItem),
        payment: {
          cash_amount: grossCashAmount,
          bank_amount: bankAmount,
          bank_account_id: bankAmount > 0 ? bankAccountId : null,
          old_debt_payment_amount: oldDebtPayment,
          change_returned_amount: surplusMode === 'return' ? surplus : 0,
        },
      }
      setQuoteResult(await orderService.saveQuote(payload))
    } catch (cause) {
      setError(formatApiError(cause, 'Không lưu được báo giá.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-label="Thanh toán" className="checkout-panel">
      <h2>Thanh toán</h2>
      <dl className="checkout-summary">
        <div>
          <dt>Tiền hàng</dt>
          <dd>{formatMoney(subtotal)}</dd>
        </div>
        <div>
          <dt>Chiết khấu</dt>
          <dd>{formatMoney(discountAmount)}</dd>
        </div>
        <div>
          <dt>Khách cần trả</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
        <div>
          <dt>Còn nợ</dt>
          <dd>{formatMoney(debt)}</dd>
        </div>
        {selectedCustomer !== null ? (
          <div>
            <dt>Tổng nợ hiện tại</dt>
            <dd>{formatMoney(visibleCustomerDebt?.total_debt ?? 0)}</dd>
          </div>
        ) : null}
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

      <label>
        Tiền mặt trả hóa đơn
        <input
          aria-label="Tiền mặt trả hóa đơn"
          inputMode="numeric"
          type="number"
          value={cashAmount}
          onChange={(event) => setCashAmountOverride(readMoney(event.target.value))}
        />
      </label>
      <label>
        Chuyển khoản trả hóa đơn
        <input
          aria-label="Chuyển khoản trả hóa đơn"
          inputMode="numeric"
          type="number"
          value={bankAmount}
          onChange={(event) => setBankAmount(readMoney(event.target.value))}
        />
      </label>
      {selectedCustomer !== null ? (
        <label>
          Thu nợ cũ
          <input
            aria-label="Thu nợ cũ"
            inputMode="numeric"
            type="number"
            value={oldDebtPaymentAmount}
            onChange={(event) => setOldDebtPaymentAmount(readMoney(event.target.value))}
          />
        </label>
      ) : null}
      <label>
        Tài khoản nhận chuyển khoản
        <select
          aria-label="Tài khoản nhận chuyển khoản"
          value={bankAccountId}
          onChange={(event) => setBankAccountId(event.target.value)}
        >
          <option value="">Chọn tài khoản</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} - {account.name}
            </option>
          ))}
        </select>
      </label>

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

      {cartLines.map((line) => (
        <div className="recent-price-row" key={line.id}>
          <button
            className="button button-secondary"
            disabled={selectedCustomer === null}
            type="button"
            onClick={() => void showRecentPrices(line)}
          >
            Giá gần đây {line.product.name}
          </button>
          {recentPrices[line.id]?.map((price) => (
            <span key={`${price.orderCode}-${price.soldAt}`}>
              <span>{price.orderCode}</span>
              <span>{formatMoney(price.unitPrice)}</span>
            </span>
          ))}
        </div>
      ))}

      {error ? <p role="alert">{error}</p> : null}
      {sourceQuote ? <p>Từ báo giá {sourceQuote.code}</p> : null}
      {quoteBlockedReason ? <p role="status">{quoteBlockedReason}</p> : null}
      <button
        className="button button-secondary"
        disabled={submitting || cartLines.length === 0 || quoteBlockedReason !== null}
        type="button"
        onClick={() => void saveQuote()}
      >
        Báo giá
      </button>
      <button
        className="button button-primary"
        disabled={submitting || quoteBlockedReason !== null}
        type="button"
        onClick={() => void submitCheckout()}
      >
        Tạo hóa đơn
      </button>

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

function readMoney(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function lineSubtotal(line: CheckoutCartLine): number {
  return Math.round(line.quantity * line.unitPrice)
}

function lineDiscount(line: CheckoutCartLine): number {
  return Math.min(Math.max(line.discountAmount ?? 0, 0), lineSubtotal(line))
}

function lineToCheckoutItem(line: CheckoutCartLine) {
  return {
    product_id: line.product.id,
    quantity: line.quantity,
    width_m: line.width_m,
    height_m: line.height_m,
    linear_m: line.linear_m,
    unit_price: line.unitPrice,
    discount_amount: lineDiscount(line),
    price_source: line.priceSource,
    note: line.note,
  }
}
