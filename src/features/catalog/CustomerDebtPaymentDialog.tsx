import { useState } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'
import { ManagementRecordLink, MoneyText, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { ManagementTableViewport } from '../../components/ui-shell/management-layout'
import { managementDateTimeCalendarDays, managementDateTimeTimeOptions } from '../../components/ui-shell/management-date-time-picker'
import { currentSystemDate } from '../../lib/system-clock'
import { formatMoney, parseMoneyInput } from '../../lib/number-format'
import type { CashbookEntry, FinanceAccount } from '../finance/types'
import { financeAccountChoiceLabel } from '../finance/finance-presenter'
import type { CustomerDebtDetail } from '../orders/order-service'
import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'
import {
  buildCustomerDebtLedgerRows,
  buildCustomerDebtPaymentRows,
  buildCustomerDebtSummaryRows,
  customerDebtCurrentAmount,
  customerDebtLedgerRowsFromBackend,
  type CustomerDebtPaymentRow,
} from './customer-debt-ledger'
import { customerDateTime as dateTime } from './customer-presenter'
import {
  formatCustomerDebtAdjustmentDateTime,
  parseCustomerDebtAdjustmentDateTime,
} from './customer-debt-adjustment-form'
import type { Customer } from './types'

export type CustomerDebtLedgerState = {
  debt: CustomerDebtDetail
  invoiceHistory: SalesDocumentListItem[]
  cashbookHistory: CashbookEntry[]
} | 'loading' | 'error'

export type CustomerDebtPaymentForm = {
  paidAt: string
  method: 'cash' | 'bank_transfer'
  bankAccountId: string
  amount: string
  note: string
  allocateToInvoices: boolean
  invoicePayments: Record<string, string>
}

export function CustomerDebtPaymentDialog({
  customer,
  collectorName,
  debt,
  fallbackDebt,
  form,
  financeAccounts,
  saving,
  error,
  canSave,
  onChange,
  onClose,
  onSubmit,
}: {
  customer: Customer
  collectorName: string
  debt: CustomerDebtLedgerState | undefined
  fallbackDebt: number
  form: CustomerDebtPaymentForm
  financeAccounts: FinanceAccount[]
  saving: boolean
  error: string | null
  canSave: boolean
  onChange: (form: CustomerDebtPaymentForm) => void
  onClose: () => void
  onSubmit: (form: CustomerDebtPaymentForm, currentDebt: number, paymentRows: CustomerDebtPaymentRow[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState<'date' | 'time' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = currentSystemDate()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const selectedPaidDateTime = parseCustomerDebtAdjustmentDateTime(form.paidAt)
  const calendarDays = managementDateTimeCalendarDays(calendarMonth)
  const updateField = (field: keyof CustomerDebtPaymentForm, value: string | boolean | Record<string, string>) => {
    onChange({ ...form, [field]: value })
  }
  const selectPaidDate = (date: Date) => {
    const base = selectedPaidDateTime ?? currentSystemDate()
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())
    updateField('paidAt', formatCustomerDebtAdjustmentDateTime(next))
    setPickerOpen(null)
  }
  const selectPaidTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const base = selectedPaidDateTime ?? currentSystemDate()
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    updateField('paidAt', formatCustomerDebtAdjustmentDateTime(next))
    setPickerOpen(null)
  }
  const currentDebt = customerDebtCurrentAmount(debt, fallbackDebt)
  const bankAccounts = financeAccounts.filter((account) => account.is_active && account.account_type === 'bank')
  const invoiceRows = typeof debt === 'object'
    ? debt.invoiceHistory.length > 0
      ? debt.invoiceHistory
      : debt.debt.invoices.map((invoice) => ({
          id: invoice.order_id,
          code: invoice.order_code,
          created_at: invoice.created_at,
          total_amount: invoice.total_amount,
          paid_amount: invoice.paid_amount,
          debt_amount: invoice.remaining_debt,
          payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
          status: 'completed' as const,
          seller: { id: '', name: '' },
        }))
    : []
  const ledgerRows = typeof debt === 'object'
    ? (debt.debt.ledger_rows?.length ?? 0) > 0
      ? customerDebtLedgerRowsFromBackend(debt.debt)
      : buildCustomerDebtLedgerRows(
          invoiceRows,
          debt.cashbookHistory,
          debt.debt.adjustments ?? [],
          debt.debt.linked_supplier_receipts ?? [],
          { currentTotal: currentDebt },
        )
    : []
  const summaryRows = buildCustomerDebtSummaryRows(invoiceRows, ledgerRows, currentDebt)
  const hasManualInvoicePayments = Object.values(form.invoicePayments).some((value) => parseMoneyInput(value) > 0)
  const paymentAmount = parseMoneyInput(form.amount)
  const paymentRows = hasManualInvoicePayments
    ? summaryRows.map((row) => ({
        ...row,
        paid_before: Math.max(row.total_amount - row.remaining_debt, 0),
        payment_amount: Math.min(parseMoneyInput(form.invoicePayments[row.id] ?? ''), row.remaining_debt),
      }))
    : buildCustomerDebtPaymentRows(summaryRows, paymentAmount)
  const allocatedAmount = paymentRows.reduce((sum, row) => sum + row.payment_amount, 0)
  const unallocatedAmount = Math.max(paymentAmount - allocatedAmount, 0)
  const collectorLabel = collectorName.trim() || customer.created_by?.name || 'Chưa xác định'
  const updatePaymentMethod = (method: CustomerDebtPaymentForm['method']) => {
    onChange({
      ...form,
      method,
      bankAccountId: method === 'bank_transfer' ? form.bankAccountId || bankAccounts[0]?.id || '' : '',
    })
  }
  const updateAmount = (value: string) => {
    const digits = value.replace(/\D/g, '')
    onChange({ ...form, amount: digits === '' ? '' : formatMoney(Number(digits)), invoicePayments: {} })
  }
  const updateInvoicePayment = (row: CustomerDebtPaymentRow, value: string) => {
    const digits = value.replace(/\D/g, '')
    const nextAmount = digits === '' ? 0 : Math.min(Number(digits), row.remaining_debt)
    const nextInvoicePayments = {
      ...form.invoicePayments,
      [row.id]: nextAmount > 0 ? formatMoney(nextAmount) : '',
    }
    const nextTotal = summaryRows.reduce((sum, summaryRow) => {
      const rawValue = summaryRow.id === row.id ? nextInvoicePayments[summaryRow.id] : form.invoicePayments[summaryRow.id] ?? ''
      return sum + Math.min(parseMoneyInput(rawValue), summaryRow.remaining_debt)
    }, 0)
    const nextCurrentAmount = parseMoneyInput(form.amount)
    onChange({
      ...form,
      amount: nextCurrentAmount > 0 ? formatMoney(Math.max(nextCurrentAmount, nextTotal)) : nextTotal > 0 ? formatMoney(nextTotal) : '',
      invoicePayments: nextInvoicePayments,
    })
  }
  const canSubmit = canSave
    && !saving
    && paymentAmount > 0
    && debt !== undefined
    && debt !== 'loading'
    && debt !== 'error'
    && summaryRows.length > 0
    && (form.method !== 'bank_transfer' || form.bankAccountId.trim() !== '')

  return (
    <div className="management-modal-backdrop">
      <section aria-label={`Thanh toán công nợ ${customer.code}`} aria-modal="true" className="management-modal-dialog customer-debt-payment-dialog" role="dialog">
        <header className="management-modal-header">
          <div>
            <h2>Thanh toán</h2>
            <p>{customer.name} · Nợ hiện tại: {formatMoney(currentDebt)} · Người thu: {collectorLabel}</p>
          </div>
          <button aria-label="Đóng thanh toán công nợ" className="management-icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form
          aria-label="Thanh toán công nợ"
          className="management-modal-form customer-debt-payment-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(form, currentDebt, paymentRows)
          }}
        >
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          {debt === undefined || debt === 'loading' ? <p>Đang tải hóa đơn công nợ...</p> : null}
          {debt === 'error' ? <p role="alert">Không tải được hóa đơn công nợ.</p> : null}
          <div className="customer-debt-payment-grid">
            <label>
              <span>Thời gian</span>
              <span className="customer-debt-adjustment-input-shell">
                <input
                  placeholder="dd/mm/yyyy hh:mm"
                  value={form.paidAt}
                  onChange={(event) => updateField('paidAt', event.target.value)}
                />
                <button aria-expanded={pickerOpen === 'date'} aria-label="Chọn ngày thanh toán" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-date" type="button" onClick={() => setPickerOpen((current) => current === 'date' ? null : 'date')}>
                  <CalendarDays size={15} />
                </button>
                <button aria-expanded={pickerOpen === 'time'} aria-label="Chọn giờ thanh toán" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-time" type="button" onClick={() => setPickerOpen((current) => current === 'time' ? null : 'time')}>
                  <Clock3 size={15} />
                </button>
                {pickerOpen === 'date' ? (
                  <section aria-label="Lịch chọn ngày thanh toán" className="management-date-time-picker management-date-time-date-picker customer-debt-adjustment-picker customer-debt-adjustment-date-picker">
                    <header>
                      <button aria-label="Tháng trước" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                        ‹
                      </button>
                      <strong>Tháng {calendarMonth.getMonth() + 1} {calendarMonth.getFullYear()}</strong>
                      <button aria-label="Tháng sau" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                        ›
                      </button>
                    </header>
                    <div className="management-date-time-weekdays customer-debt-adjustment-weekdays" aria-hidden="true">
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="management-date-time-calendar-grid customer-debt-adjustment-calendar-grid">
                      {calendarDays.map((date) => {
                        const selected = selectedPaidDateTime ? date.toDateString() === selectedPaidDateTime.toDateString() : false
                        return (
                          <button
                            aria-pressed={selected}
                            className={date.getMonth() === calendarMonth.getMonth() ? undefined : 'management-date-time-muted-day customer-debt-adjustment-muted-day'}
                            key={date.toISOString()}
                            type="button"
                            onClick={() => selectPaidDate(date)}
                          >
                            {date.getDate()}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ) : null}
                {pickerOpen === 'time' ? (
                  <section aria-label="Chọn giờ thanh toán" className="management-date-time-picker management-date-time-time-picker customer-debt-adjustment-picker customer-debt-adjustment-time-picker">
                    {managementDateTimeTimeOptions.map((time) => (
                      <button key={time} type="button" onClick={() => selectPaidTime(time)}>
                        {time}
                      </button>
                    ))}
                  </section>
                ) : null}
              </span>
            </label>
            <label>
              <span>Phương thức TT</span>
              <select value={form.method} onChange={(event) => updatePaymentMethod(event.target.value as CustomerDebtPaymentForm['method'])}>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
              </select>
            </label>
            {form.method === 'bank_transfer' ? (
              <label>
                <span>Tài khoản ngân hàng</span>
                <select value={form.bankAccountId} onChange={(event) => updateField('bankAccountId', event.target.value)}>
                  <option value="">Chọn tài khoản</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{financeAccountChoiceLabel(account)}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="customer-debt-payment-full">
            <span>Số tiền</span>
            <input
              aria-label="Số tiền"
              autoFocus
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => updateAmount(event.target.value)}
            />
            <small>Nợ còn: {formatMoney(currentDebt - paymentAmount)}</small>
          </label>
          <label className="customer-debt-payment-full">
            <span>Ghi chú</span>
            <input placeholder="Nhập ghi chú" value={form.note} onChange={(event) => updateField('note', event.target.value)} />
          </label>
          <label className="customer-debt-payment-checkbox">
            <input checked={form.allocateToInvoices} type="checkbox" onChange={(event) => updateField('allocateToInvoices', event.target.checked)} />
            <span>Phân bổ vào hóa đơn</span>
          </label>
          {form.allocateToInvoices ? (
            <section aria-label="Phân bổ hóa đơn công nợ" className="customer-debt-payment-allocation">
              <ManagementTableViewport>
                <table aria-label="Danh sách phân bổ hóa đơn công nợ" className="customer-debt-payment-table">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Thời gian</th>
                      <th>Giá trị hóa đơn</th>
                      <th>Đã thu trước</th>
                      <th>Còn cần thu</th>
                      <th>Tiền thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <ManagementRecordLink href={managementRecordOpenHref('/sales-documents', row.code, { type: 'invoice' })}>
                            {row.code}
                          </ManagementRecordLink>
                        </td>
                        <td>{dateTime(row.created_at)}</td>
                        <td><MoneyText value={row.total_amount} /></td>
                        <td><MoneyText value={row.paid_before} /></td>
                        <td><MoneyText value={row.remaining_debt} /></td>
                        <td>
                          <input
                            aria-label={`Tiền thu ${row.code}`}
                            inputMode="numeric"
                            value={row.payment_amount > 0 ? formatMoney(row.payment_amount) : ''}
                            onChange={(event) => updateInvoicePayment(row, event.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ManagementTableViewport>
              <div className="customer-debt-payment-unallocated">
                <span>Tiền chưa phân bổ:</span>
                <strong>{formatMoney(unallocatedAmount)}</strong>
              </div>
            </section>
          ) : null}
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>
              Bỏ qua
            </button>
            <button className="button button-secondary" disabled={!canSubmit} type="submit">
              Tạo phiếu thu & In
            </button>
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              Tạo phiếu thu
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
