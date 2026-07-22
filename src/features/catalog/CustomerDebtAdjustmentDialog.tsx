import { CalendarDays, Clock3, Info, Pencil } from 'lucide-react'
import { useState } from 'react'
import { formatMoney, parseMoneyInput } from '../../lib/number-format'
import { currentSystemDate } from '../../lib/system-clock'
import { dateTimeStoredIsoFromLocalClock } from '../../lib/date-format'
import { managementDateTimeCalendarDays, managementDateTimeTimeOptions } from '../../components/ui-shell/management-date-time-picker'
import type { Customer } from './types'
import {
  formatCustomerDebtAdjustmentDateTime,
  parseCustomerDebtAdjustmentDateTime,
  type CustomerDebtAdjustmentForm,
} from './customer-debt-adjustment-form'

export function CustomerDebtAdjustmentDialog({
  customer,
  currentDebt,
  form,
  onChange,
  onClose,
  saving,
  error,
  canSave,
  onSubmit,
}: {
  customer: Customer
  currentDebt: number
  form: CustomerDebtAdjustmentForm
  onChange: (form: CustomerDebtAdjustmentForm) => void
  onClose: () => void
  saving: boolean
  error: string | null
  canSave: boolean
  onSubmit: (form: CustomerDebtAdjustmentForm) => void
}) {
  const selectedAdjustmentDateTime = parseCustomerDebtAdjustmentDateTime(form.adjustedAt)
  const [pickerOpen, setPickerOpen] = useState<'date' | 'time' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = currentSystemDate()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const calendarDays = managementDateTimeCalendarDays(calendarMonth)
  const canSubmit = canSave && !saving && form.adjustmentId.trim() !== '' && selectedAdjustmentDateTime !== null && parseMoneyInput(form.amount) > 0
  const updateField = (field: keyof CustomerDebtAdjustmentForm, value: string) => {
    onChange({ ...form, [field]: value })
  }
  const selectAdjustmentDate = (date: Date) => {
    const base = selectedAdjustmentDateTime ?? currentSystemDate()
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())
    onChange({ ...form, adjustedAt: formatCustomerDebtAdjustmentDateTime(next), adjustedAtIso: dateTimeStoredIsoFromLocalClock(next) })
    setPickerOpen(null)
  }
  const selectAdjustmentTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const base = selectedAdjustmentDateTime ?? currentSystemDate()
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    onChange({ ...form, adjustedAt: formatCustomerDebtAdjustmentDateTime(next), adjustedAtIso: dateTimeStoredIsoFromLocalClock(next) })
    setPickerOpen(null)
  }

  return (
    <div className="management-modal-backdrop">
      <section aria-label={`Điều chỉnh công nợ ${customer.code}`} aria-modal="true" className="management-modal-dialog management-modal-dialog-compact customer-debt-adjustment-dialog" role="dialog">
        <header className="management-modal-header">
          <h2>
            Điều chỉnh
            <span aria-label="Thông tin điều chỉnh công nợ" className="customer-debt-adjustment-info">
              <Info aria-hidden="true" size={13} />
            </span>
          </h2>
          <button aria-label="Đóng điều chỉnh công nợ" className="management-icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form
          aria-label="Điều chỉnh công nợ"
          className="management-modal-form customer-debt-adjustment-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) onSubmit(form)
          }}
        >
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          <div className="customer-debt-adjustment-row">
            <span>Nợ cần thu hiện tại</span>
            <strong>{formatMoney(currentDebt)}</strong>
          </div>
          <label>
            <span>Ngày điều chỉnh</span>
            <span className="customer-debt-adjustment-input-shell">
              <input
                placeholder="dd/mm/yyyy hh:mm"
                value={form.adjustedAt}
                onChange={(event) => updateField('adjustedAt', event.target.value)}
              />
              <button aria-expanded={pickerOpen === 'date'} aria-label="Chọn ngày điều chỉnh" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-date" type="button" onClick={() => setPickerOpen((current) => current === 'date' ? null : 'date')}>
                <CalendarDays size={15} />
              </button>
              <button aria-expanded={pickerOpen === 'time'} aria-label="Chọn giờ điều chỉnh" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-time" type="button" onClick={() => setPickerOpen((current) => current === 'time' ? null : 'time')}>
                <Clock3 size={15} />
              </button>
              {pickerOpen === 'date' ? (
                <section aria-label="Lịch chọn ngày điều chỉnh" className="management-date-time-picker management-date-time-date-picker customer-debt-adjustment-picker customer-debt-adjustment-date-picker">
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
                      const selected = selectedAdjustmentDateTime
                        ? date.toDateString() === selectedAdjustmentDateTime.toDateString()
                        : false
                      return (
                        <button
                          aria-pressed={selected}
                          className={date.getMonth() === calendarMonth.getMonth() ? undefined : 'management-date-time-muted-day customer-debt-adjustment-muted-day'}
                          key={date.toISOString()}
                          type="button"
                          onClick={() => selectAdjustmentDate(date)}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}
              {pickerOpen === 'time' ? (
                <section aria-label="Chọn giờ điều chỉnh" className="management-date-time-picker management-date-time-time-picker customer-debt-adjustment-picker customer-debt-adjustment-time-picker">
                  {managementDateTimeTimeOptions.map((time) => (
                    <button key={time} type="button" onClick={() => selectAdjustmentTime(time)}>
                      {time}
                    </button>
                  ))}
                </section>
              ) : null}
            </span>
          </label>
          <label>
            <span>Giá trị nợ điều chỉnh</span>
            <input
              autoFocus
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => updateField('amount', event.target.value)}
            />
          </label>
          <label>
            <span>Mô tả</span>
            <span className="customer-debt-adjustment-input-shell">
              <input
                value={form.note}
                onChange={(event) => updateField('note', event.target.value)}
              />
              <span aria-hidden="true" className="customer-debt-adjustment-input-button customer-debt-adjustment-input-button-left">
                <Pencil size={15} />
              </span>
            </span>
          </label>
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>
              Bỏ qua
            </button>
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              {saving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
