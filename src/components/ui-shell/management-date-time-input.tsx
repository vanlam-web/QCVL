import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'
import { currentSystemDate } from '../../lib/system-clock'

type PickerMode = 'date' | 'time'

type ManagementDateTimeInputProps = {
  label: string
  inputLabel: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  dateButtonLabel?: string
  timeButtonLabel?: string
  datePickerLabel?: string
  timePickerLabel?: string
}

export function ManagementDateTimeInput({
  label,
  inputLabel,
  value,
  onChange,
  className,
  placeholder = 'dd/mm/yyyy hh:mm',
  dateButtonLabel = `Chọn ngày ${label.toLocaleLowerCase('vi')}`,
  timeButtonLabel = `Chọn giờ ${label.toLocaleLowerCase('vi')}`,
  datePickerLabel = `Lịch chọn ngày ${label.toLocaleLowerCase('vi')}`,
  timePickerLabel = `Chọn giờ ${label.toLocaleLowerCase('vi')}`,
}: ManagementDateTimeInputProps) {
  const rootRef = useRef<HTMLLabelElement | null>(null)
  const selectedDateTime = parseManagementDateTimeInputText(value)
  const [pickerOpen, setPickerOpen] = useState<PickerMode | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = selectedDateTime ?? currentSystemDate()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const calendarDays = useMemo(() => managementDateTimeCalendarDays(calendarMonth), [calendarMonth])

  useEffect(() => {
    if (pickerOpen === null) return
    function closeOnOutsidePointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (root && !root.contains(event.target as Node)) setPickerOpen(null)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointerDown)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointerDown)
  }, [pickerOpen])

  function selectDate(date: Date) {
    const base = selectedDateTime ?? currentSystemDate()
    onChange(formatManagementDateTimeInputText(new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())))
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setPickerOpen(null)
  }

  function selectTime(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    const base = selectedDateTime ?? currentSystemDate()
    onChange(formatManagementDateTimeInputText(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)))
    setPickerOpen(null)
  }

  function toggleDatePicker() {
    const nextOpen = pickerOpen === 'date' ? null : 'date'
    if (nextOpen === 'date') {
      const base = selectedDateTime ?? currentSystemDate()
      setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setPickerOpen(nextOpen)
  }

  return (
    <label className={['management-date-time-input-field', className].filter(Boolean).join(' ')} ref={rootRef}>
      <span>{label}</span>
      <span className="management-date-time-input-shell">
        <input
          aria-label={inputLabel}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-expanded={pickerOpen === 'date'}
          aria-label={dateButtonLabel}
          className="management-date-time-input-button management-date-time-input-button-date"
          type="button"
          onClick={toggleDatePicker}
        >
          <CalendarDays aria-hidden="true" size={15} />
        </button>
        <button
          aria-expanded={pickerOpen === 'time'}
          aria-label={timeButtonLabel}
          className="management-date-time-input-button management-date-time-input-button-time"
          type="button"
          onClick={() => setPickerOpen((current) => current === 'time' ? null : 'time')}
        >
          <Clock3 aria-hidden="true" size={15} />
        </button>
        {pickerOpen === 'date' ? (
          <section aria-label={datePickerLabel} className="management-date-time-picker management-date-time-date-picker" role="region">
            <header>
              <button aria-label="Tháng trước" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                ‹
              </button>
              <strong>Tháng {calendarMonth.getMonth() + 1} {calendarMonth.getFullYear()}</strong>
              <button aria-label="Tháng sau" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                ›
              </button>
            </header>
            <div className="management-date-time-weekdays" aria-hidden="true">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="management-date-time-calendar-grid">
              {calendarDays.map((date) => {
                const selected = selectedDateTime ? date.toDateString() === selectedDateTime.toDateString() : false
                return (
                  <button
                    aria-pressed={selected}
                    className={date.getMonth() === calendarMonth.getMonth() ? undefined : 'management-date-time-muted-day'}
                    key={date.toISOString()}
                    type="button"
                    onClick={() => selectDate(date)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}
        {pickerOpen === 'time' ? (
          <section aria-label={timePickerLabel} className="management-date-time-picker management-date-time-time-picker" role="region">
            {managementDateTimeOptions.map((time) => (
              <button key={time} type="button" onClick={() => selectTime(time)}>
                {time}
              </button>
            ))}
          </section>
        ) : null}
      </span>
    </label>
  )
}

export function parseManagementDateTimeInputText(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!match) return null
  const [, day, month, year, hour = '0', minute = '00'] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function formatManagementDateTimeInputText(value: Date) {
  return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

function managementDateTimeCalendarDays(month: Date) {
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstDate.getDay() + 6) % 7
  const startDate = new Date(firstDate)
  startDate.setDate(firstDate.getDate() - offset)
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return date
  })
}

const managementDateTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})
