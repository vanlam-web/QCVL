import { Fragment, cloneElement, isValidElement, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import { CalendarDays, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { normalizeDateInput, toDisplayDateInput } from '../../lib/date-ranges'

export interface ManagementSearchSuggestion {
  id: string
  primary: ReactNode
  secondary?: ReactNode
  meta?: ReactNode
  ariaLabel?: string
}

export function ManagementPage({
  title,
  actions,
  kpis,
  filter,
  filterVisible = true,
  filterCollapsedControl,
  children,
}: {
  title: string
  actions?: ReactNode
  kpis?: ReactNode
  filter?: ReactNode
  filterVisible?: boolean
  filterCollapsedControl?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="management-page">
      <header className="management-page-header">
        <h1>{title}</h1>
        {actions ? <div className="management-page-actions">{actions}</div> : null}
      </header>
      <section
        aria-label={title}
        className={`management-layout${filterVisible && (filter || kpis) ? '' : ' management-layout-filters-hidden'}`}
      >
        {filterVisible && (filter || kpis) ? (
          <div className="management-filter-column">
            {kpis ? <div className="management-kpis">{kpis}</div> : null}
            {filter}
          </div>
        ) : null}
        {!filterVisible && filterCollapsedControl ? <div className="management-filter-rail">{filterCollapsedControl}</div> : null}
        <div className="management-main">{children}</div>
      </section>
    </main>
  )
}

export function ManagementFilterSidebar({
  ariaLabel,
  actions,
  onPopoverClose,
  popoverOpen = false,
  children,
}: {
  ariaLabel: string
  title?: string
  activeSummary?: string
  actions?: ReactNode
  onPopoverClose?: () => void
  popoverOpen?: boolean
  children: ReactNode
}) {
  const sidebarRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!popoverOpen || !onPopoverClose) return undefined
    const closePopover = onPopoverClose

    function closeWhenOutside(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (sidebarRef.current?.contains(target)) return
      closePopover()
    }

    document.addEventListener('pointerdown', closeWhenOutside, true)
    return () => document.removeEventListener('pointerdown', closeWhenOutside, true)
  }, [onPopoverClose, popoverOpen])

  return (
    <aside ref={sidebarRef} aria-label={ariaLabel} className={`management-filter-sidebar${popoverOpen ? ' management-filter-sidebar-popover-open' : ''}`}>
      {children}
      {actions ? <ManagementFilterActionBar>{actions}</ManagementFilterActionBar> : null}
    </aside>
  )
}

export function ManagementFilterActionBar({ children }: { children: ReactNode }) {
  return <div className="management-filter-actions">{children}</div>
}

export function ManagementFilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="management-filter-group">
      <h2>{title}</h2>
      <div className="management-filter-options">{children}</div>
    </section>
  )
}

export function ManagementFilterSelectField({
  label,
  value,
  children,
  onChange,
}: {
  label: string
  value: string
  children: ReactNode
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="management-filter-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

export function ManagementFilterNumberField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        className="management-filter-number-input"
        inputMode="numeric"
        min="0"
        placeholder={placeholder}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function ManagementFilterNumberRange({
  fromLabel,
  fromValue,
  toLabel,
  toValue,
  onFromChange,
  onToChange,
}: {
  fromLabel: string
  fromValue: string
  toLabel: string
  toValue: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <>
      <ManagementFilterNumberField label={fromLabel} placeholder="Từ" value={fromValue} onChange={onFromChange} />
      <ManagementFilterNumberField label={toLabel} placeholder="Tới" value={toValue} onChange={onToChange} />
    </>
  )
}

export function ManagementDateRangeInputs({
  displayFrom,
  displayTo,
  from,
  to,
  onCalendarOpen,
  onFromChange,
  onToChange,
}: {
  displayFrom?: string
  displayTo?: string
  from: string
  to: string
  onCalendarOpen?: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const [openCalendar, setOpenCalendar] = useState<DateInputField | null>(null)
  const dateRangeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openCalendar === null) return undefined

    function closeCalendarOnOutsideClick(event: PointerEvent) {
      if (dateRangeRef.current?.contains(event.target as Node)) return
      setOpenCalendar(null)
    }

    document.addEventListener('pointerdown', closeCalendarOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeCalendarOnOutsideClick)
  }, [openCalendar])

  function toggleCalendar(field: DateInputField) {
    setOpenCalendar((current) => current === field ? null : field)
  }

  return (
    <div className="management-filter-date-range" ref={dateRangeRef}>
      <ManagementDateInput
        calendarOpen={openCalendar === 'from'}
        displayValue={displayFrom}
        fieldId="from"
        label="Từ ngày"
        value={from}
        onCalendarClose={() => setOpenCalendar(null)}
        onCalendarOpen={onCalendarOpen}
        onCalendarToggle={toggleCalendar}
        onChange={onFromChange}
      />
      <ManagementDateInput
        calendarOpen={openCalendar === 'to'}
        displayValue={displayTo}
        fieldId="to"
        label="Đến ngày"
        value={to}
        onCalendarClose={() => setOpenCalendar(null)}
        onCalendarOpen={onCalendarOpen}
        onCalendarToggle={toggleCalendar}
        onChange={onToChange}
      />
    </div>
  )
}

type DateInputField = 'from' | 'to'

function dateKeyToLocalDate(value: string) {
  const normalized = normalizeDateInput(value)
  if (!normalized) return new Date()
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function ManagementDateInput({
  calendarOpen,
  displayValue,
  fieldId,
  label,
  value,
  onCalendarClose,
  onCalendarOpen,
  onCalendarToggle,
  onChange,
}: {
  calendarOpen: boolean
  displayValue?: string
  fieldId: DateInputField
  label: string
  value: string
  onCalendarClose: () => void
  onCalendarOpen?: () => void
  onCalendarToggle: (field: DateInputField) => void
  onChange: (value: string) => void
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => dateKeyToLocalDate(value))
  const selectedDate = dateKeyToLocalDate(value)
  const inputValue = displayValue ?? value

  function updateDateInput(nextText: string) {
    const normalized = normalizeDateInput(nextText)
    if (normalized !== null && (normalized === '' || nextText.trim().length >= 10)) onChange(normalized)
  }

  function formatOnBlur(input: HTMLInputElement) {
    const normalized = normalizeDateInput(input.value)
    input.value = normalized === null ? toDisplayDateInput(value) : toDisplayDateInput(normalized)
  }

  function openCalendar() {
    setVisibleMonth(dateKeyToLocalDate(value))
    if (!calendarOpen) onCalendarOpen?.()
    onCalendarToggle(fieldId)
  }

  function moveMonth(amount: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  function selectDate(date: Date) {
    onChange(localDateKey(date))
    onCalendarClose()
  }

  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const calendarStart = new Date(firstDay)
  calendarStart.setDate(firstDay.getDate() - mondayOffset)
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)
    return date
  })
  const monthTitle = `Tháng ${visibleMonth.getMonth() + 1} ${visibleMonth.getFullYear()}`

  return (
    <div className="management-date-input-field">
      <label>
        <span className="sr-only">{label}</span>
        <input
          aria-label={label}
          defaultValue={toDisplayDateInput(inputValue)}
          inputMode="numeric"
          key={inputValue}
          placeholder="dd/mm/yyyy"
          onBlur={(event) => formatOnBlur(event.currentTarget)}
          onChange={(event) => updateDateInput(event.target.value)}
        />
      </label>
      <button
        aria-expanded={calendarOpen}
        aria-label={`Mở lịch ${label}`}
        className="management-date-calendar-button"
        type="button"
        onClick={openCalendar}
      >
        <CalendarDays size={16} />
      </button>
      {calendarOpen ? (
        <div aria-label={`Chọn ${label}`} className={`management-date-picker-popover management-date-picker-popover-${fieldId}`} role="dialog">
          <div className="management-date-picker-header">
            <button aria-label="Tháng trước" type="button" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <strong>{monthTitle}</strong>
            <button aria-label="Tháng sau" type="button" onClick={() => moveMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="management-date-picker-weekdays" aria-hidden="true">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="management-date-picker-grid">
            {days.map((date) => {
              const dateKey = localDateKey(date)
              const muted = date.getMonth() !== visibleMonth.getMonth()
              const selected = sameLocalDay(date, selectedDate)
              return (
                <button
                  aria-label={`Chọn ngày ${toDisplayDateInput(dateKey)}`}
                  className={`${muted ? 'management-date-picker-day-muted' : ''}${selected ? ' management-date-picker-day-selected' : ''}`}
                  key={dateKey}
                  type="button"
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ManagementListSurface({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <section aria-label={ariaLabel} className="management-list-surface">
      {children}
    </section>
  )
}

export function ManagementActionIconButton({
  ariaLabel,
  title = ariaLabel,
  variant = 'secondary',
  children,
  onClick,
}: {
  ariaLabel: string
  title?: string
  variant?: 'primary' | 'secondary'
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`management-action-icon button button-${variant}`}
      title={title}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function ManagementCompactCreateAction({
  ariaLabel,
  title = ariaLabel,
  onClick,
}: {
  ariaLabel: string
  title?: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="management-compact-create-action"
      title={title}
      type="button"
      onClick={onClick}
    >
      <Plus aria-hidden="true" size={18} strokeWidth={2} />
    </button>
  )
}

export function ManagementCompactToolbar({
  ariaLabel,
  children,
  onSubmit,
}: {
  ariaLabel: string
  children: ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form aria-label={ariaLabel} className="management-compact-toolbar" role="search" onSubmit={onSubmit}>
      {children}
    </form>
  )
}

export function ManagementCompactSearch({
  label,
  placeholder,
  value,
  leadingIcon,
  trailingAction,
  suggestions,
  suggestionsLabel,
  emptySuggestion,
  onChange,
  onSuggestionSelect,
}: {
  label: string
  placeholder?: string
  value: string
  leadingIcon?: ReactNode
  trailingAction?: ReactNode
  suggestions?: ManagementSearchSuggestion[]
  suggestionsLabel?: string
  emptySuggestion?: ReactNode
  onChange: (value: string) => void
  onSuggestionSelect?: (suggestion: ManagementSearchSuggestion) => void
}) {
  const showSuggestions = suggestions !== undefined && (suggestions.length > 0 || emptySuggestion !== undefined)
  const showClearAction = value.length > 0 && isValidElement(trailingAction) && trailingAction.type === ManagementCompactCreateAction
  return (
    <div className="management-compact-search">
      {leadingIcon ? <span className="management-compact-search-leading">{leadingIcon}</span> : null}
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {trailingAction ? (
        <span className="management-compact-search-trailing">
          {showClearAction ? (
            <button
              aria-label="Xóa tìm kiếm"
              className="management-compact-create-action management-compact-create-action-clear"
              title="Xóa tìm kiếm"
              type="button"
              onClick={() => onChange('')}
            >
              <Plus aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          ) : (
            trailingAction
          )}
        </span>
      ) : null}
      {showSuggestions ? (
        <ul aria-label={suggestionsLabel ?? `${label} gợi ý`} className="management-search-suggestions" role="listbox">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  aria-label={suggestion.ariaLabel}
                  role="option"
                  type="button"
                  onClick={() => onSuggestionSelect?.(suggestion)}
                >
                  <strong>{suggestion.primary}</strong>
                  {suggestion.secondary ? <span>{suggestion.secondary}</span> : null}
                  {suggestion.meta ? <span>{suggestion.meta}</span> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="management-search-suggestions-empty">{emptySuggestion}</li>
          )}
        </ul>
      ) : null}
    </div>
  )
}

export function ManagementTableViewport({ children }: { children: ReactNode }) {
  return <div className="management-table-viewport">{children}</div>
}

export function ManagementPagination({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <nav aria-label={ariaLabel} className="management-pagination">
      {children}
    </nav>
  )
}

export function ManagementTableFooter({
  ariaLabel,
  entityLabel,
  page,
  pageSize,
  total,
  totalDetail,
  canGoPrevious,
  canGoNext,
  pageSizeOptions = [15, 30, 50, 100],
  onPageSizeChange,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: {
  ariaLabel: string
  entityLabel: string
  page: number
  pageSize: number
  total: number
  totalDetail?: string
  canGoPrevious: boolean
  canGoNext: boolean
  pageSizeOptions?: number[]
  onPageSizeChange?: (pageSize: number) => void
  onFirst?: () => void
  onPrevious: () => void
  onNext: () => void
  onLast?: () => void
}) {
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <nav aria-label={ariaLabel} className="management-table-footer">
      <div className="management-table-footer-size">
        <span>Hiển thị</span>
        <label>
          <span className="sr-only">Số dòng hiển thị</span>
          <select
            aria-label="Số dòng hiển thị"
            disabled={onPageSizeChange === undefined}
            value={pageSize}
            onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} dòng
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="management-table-footer-actions">
        <button aria-label="Trang đầu" disabled={!canGoPrevious} title="Trang đầu" type="button" onClick={onFirst ?? onPrevious}>
          <ChevronFirst aria-hidden="true" size={18} />
        </button>
        <button aria-label="Trang trước" disabled={!canGoPrevious} title="Trang trước" type="button" onClick={onPrevious}>
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <input
          aria-label="Trang hiện tại"
          inputMode="numeric"
          readOnly
          value={page}
        />
        <button aria-label="Trang sau" disabled={!canGoNext} title="Trang sau" type="button" onClick={onNext}>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <button aria-label="Trang cuối" disabled={!canGoNext} title="Trang cuối" type="button" onClick={onLast ?? onNext}>
          <ChevronLast aria-hidden="true" size={18} />
        </button>
      </div>
      <strong className="management-table-footer-summary">
        {rangeStart} - {rangeEnd} trong {total} {entityLabel}{totalDetail ? ` (${totalDetail})` : ''}
      </strong>
    </nav>
  )
}

export function ManagementRowActionButton({
  ariaLabel,
  title = ariaLabel,
  children,
  disabled,
  onClick,
}: {
  ariaLabel: string
  title?: string
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="management-row-action button button-secondary"
      disabled={disabled}
      title={title}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function ManagementTableCheckboxControl({
  ariaLabel,
  checked,
  onChange,
  onClick,
}: {
  ariaLabel: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  onClick?: (event: MouseEvent<HTMLInputElement>) => void
}) {
  return (
    <span className="finance-cashbook-checkbox-control">
      <input
        aria-label={ariaLabel}
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange?.(event.target.checked)}
        onClick={onClick}
      />
    </span>
  )
}

export function ManagementTableFavoriteButton({
  active,
  ariaLabel,
  onClick,
}: {
  active: boolean
  ariaLabel: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`finance-cashbook-star-button${active ? ' finance-cashbook-star-button-active' : ''}`}
      type="button"
      onClick={onClick}
    >
      ☆
    </button>
  )
}

export interface ManagementDataTableColumn<TItem> {
  key: string
  header: ReactNode
  headerIsCell?: boolean
  cell: (item: TItem) => ReactNode
  className?: string
}

export function ManagementDataTable<TItem>({
  ariaLabel,
  columns,
  items,
  getRowKey,
  selectedRowKey,
  getDetailLabel,
  renderDetail,
  detailClassName,
  onRowClick,
  onRowKeyDown,
}: {
  ariaLabel: string
  columns: Array<ManagementDataTableColumn<TItem>>
  items: TItem[]
  getRowKey: (item: TItem) => string
  selectedRowKey?: string | null
  getDetailLabel?: (item: TItem) => string
  renderDetail?: (item: TItem) => ReactNode
  detailClassName?: string
  onRowClick?: (item: TItem, event: MouseEvent<HTMLTableRowElement>) => void
  onRowKeyDown?: (item: TItem, event: KeyboardEvent<HTMLTableRowElement>) => void
}) {
  return (
    <table aria-label={ariaLabel} className="management-table">
      <thead>
        <tr>
          {columns.map((column) => (
            column.headerIsCell && isValidElement(column.header)
              ? cloneElement(column.header, { key: column.key })
              : <th key={column.key} className={column.className}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const rowKey = getRowKey(item)
          const selected = selectedRowKey === rowKey
          const detail = selected ? renderDetail?.(item) : null
          return (
            <Fragment key={rowKey}>
              <tr
                aria-expanded={selected}
                className={`management-data-row${selected ? ' management-data-row-selected' : ''}`}
                tabIndex={onRowKeyDown ? 0 : undefined}
                onClick={onRowClick ? (event) => onRowClick(item, event) : undefined}
                onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(item, event) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>{column.cell(item)}</td>
                ))}
              </tr>
              {detail ? (
                <ManagementDetailRow
                  colSpan={columns.length}
                  detailClassName={detailClassName}
                  label={getDetailLabel?.(item) ?? `Chi tiết ${rowKey}`}
                  rowClassName="management-detail-row-selected"
                >
                  {detail}
                </ManagementDetailRow>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

export interface ManagementInlineDetailTab {
  key: string
  label: ReactNode
  onSelect?: () => void
}

export function ManagementInlineDetailTabs({
  ariaLabel,
  activeKey,
  tabs,
  endAction,
  onSelect,
}: {
  ariaLabel: string
  activeKey: string
  tabs: ManagementInlineDetailTab[]
  endAction?: ReactNode
  onSelect?: (key: string) => void
}) {
  return (
    <div className="inline-detail-tabbar">
      <div aria-label={ariaLabel} className="inline-detail-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            aria-selected={activeKey === tab.key}
            role="tab"
            type="button"
            onClick={() => {
              tab.onSelect?.()
              onSelect?.(tab.key)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {endAction}
    </div>
  )
}

export function ManagementDetailInfoList({
  items,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>
}) {
  return (
    <dl>
      {items.map((item, index) => (
        <div key={`${String(item.label)}-${index}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ManagementDetailInlineNote({
  icon,
  children,
}: {
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <p className="management-detail-inline-note">
      {icon}
      {children}
    </p>
  )
}

export interface ManagementDetailAction {
  label: string
  icon?: ReactNode
  ariaLabel?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  danger?: boolean
  onClick?: () => void
}

function ManagementDetailActionButton({ action }: { action: ManagementDetailAction }) {
  return (
    <button
      aria-label={action.ariaLabel}
      className={`button button-${action.danger ? 'danger' : action.variant ?? 'secondary'}`}
      disabled={action.disabled}
      type="button"
      onClick={action.onClick}
    >
      {action.icon}
      {action.label}
    </button>
  )
}

export function ManagementDetailActionFooter({
  leftActions,
  rightActions,
}: {
  leftActions?: ManagementDetailAction[]
  rightActions?: ManagementDetailAction[]
}) {
  return (
    <footer className="management-detail-footer-actions">
      <div className="management-detail-footer-actions-left">
        {leftActions?.map((action) => (
          <ManagementDetailActionButton key={action.label} action={action} />
        ))}
      </div>
      <div className="management-detail-footer-actions-right">
        {rightActions?.map((action) => (
          <ManagementDetailActionButton key={action.label} action={action} />
        ))}
      </div>
    </footer>
  )
}

export function ManagementConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Đồng ý',
  cancelLabel = 'Bỏ qua',
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="management-modal-backdrop">
      <section aria-label={title} aria-modal="true" className="management-modal-dialog management-modal-dialog-compact" role="dialog">
        <header className="management-modal-header">
          <h2>{title}</h2>
          <button aria-label={`Đóng ${title}`} className="management-icon-button" disabled={loading} type="button" onClick={onCancel}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <p>{message}</p>
        <footer className="management-modal-footer">
          <button className="button button-secondary" disabled={loading} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button button-primary" disabled={loading} type="button" onClick={onConfirm}>
            {loading ? 'Đang xử lý' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function ManagementDetailRow({
  colSpan,
  label,
  rowClassName = '',
  detailClassName = '',
  children,
}: {
  colSpan: number
  label: string
  rowClassName?: string
  detailClassName?: string
  children: ReactNode
}) {
  const stopDetailEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <tr
      className={`management-detail-row management-detail-row-selected${rowClassName ? ` ${rowClassName}` : ''}`}
      onClick={stopDetailEvent}
      onDoubleClick={stopDetailEvent}
      onKeyDown={stopDetailEvent}
      onMouseDown={stopDetailEvent}
      onPointerDown={stopDetailEvent}
    >
      <td
        colSpan={colSpan}
        onClick={stopDetailEvent}
        onDoubleClick={stopDetailEvent}
        onKeyDown={stopDetailEvent}
        onMouseDown={stopDetailEvent}
        onPointerDown={stopDetailEvent}
      >
        <section
          aria-label={label}
          className={`management-inline-detail${detailClassName ? ` ${detailClassName}` : ''}`}
          role="region"
          onClick={stopDetailEvent}
          onDoubleClick={stopDetailEvent}
          onKeyDown={stopDetailEvent}
          onMouseDown={stopDetailEvent}
          onPointerDown={stopDetailEvent}
        >
          {children}
        </section>
      </td>
    </tr>
  )
}
