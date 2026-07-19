import { Fragment, cloneElement, isValidElement, useEffect, useRef, useState, type AriaRole, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref, type SyntheticEvent } from 'react'
import { ArrowDownToLine, CalendarDays, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { normalizeDateInput, toDisplayDateInput } from '../../lib/date-ranges'
import { currentSystemDate } from '../../lib/system-clock'
import { managementPageSizeOptions } from '../../lib/management-page-size'

const managementDetailMetaGridStackedClass = 'management-detail-meta-grid-stacked'

export interface ManagementSearchSuggestion {
  id: string
  primary: ReactNode
  secondary?: ReactNode
  meta?: ReactNode
  ariaLabel?: string
}

export function ManagementPage({
  title,
  titlePrefix,
  actions,
  kpis,
  filter,
  filterVisible = true,
  filterCollapsedControl,
  className,
  children,
}: {
  title: string
  titlePrefix?: ReactNode
  actions?: ReactNode
  kpis?: ReactNode
  filter?: ReactNode
  filterVisible?: boolean
  filterCollapsedControl?: ReactNode
  className?: string
  children: ReactNode
}) {
  const hasVisibleSidebar = filterVisible && (filter || kpis)
  const hiddenFilterClass = filterCollapsedControl ? ' management-layout-filters-hidden' : ' management-layout-filters-none'

  return (
    <main className={`management-page${className ? ` ${className}` : ''}`}>
      <header className="management-page-header">
        <div className="management-page-title">
          {titlePrefix}
          <h1>{title}</h1>
        </div>
        {actions ? <div className="management-page-actions">{actions}</div> : null}
      </header>
      <section
        aria-label={title}
        className={`management-layout${hasVisibleSidebar ? '' : hiddenFilterClass}`}
      >
        {hasVisibleSidebar ? (
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

    function closeWhenOutside(event: Event) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (sidebarRef.current?.contains(target)) return
      closePopover()
    }

    document.addEventListener('pointerdown', closeWhenOutside, true)
    document.addEventListener('click', closeWhenOutside, true)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside, true)
      document.removeEventListener('click', closeWhenOutside, true)
    }
  }, [onPopoverClose, popoverOpen])

  return (
    <aside
      ref={sidebarRef}
      aria-label={ariaLabel}
      className={`management-filter-sidebar${popoverOpen ? ' management-filter-sidebar-popover-open' : ''}`}
      onClick={(event) => {
        if (!popoverOpen || !onPopoverClose) return
        if (!(event.target instanceof Element)) return
        if (event.target.closest('button, input, select, textarea, label, a, [role="button"], [role="checkbox"], [role="radio"], [role="option"]')) return
        if (event.target.closest('.management-filter-quick-time-menu, .management-filter-product-group-popover, .management-date-picker-popover, [aria-label="Chọn nhanh thời gian"]')) return
        onPopoverClose()
      }}
    >
      {children}
      {actions ? <ManagementFilterActionBar>{actions}</ManagementFilterActionBar> : null}
    </aside>
  )
}

export function ManagementFilterActionBar({ children }: { children: ReactNode }) {
  return <div className="management-filter-actions">{children}</div>
}

export function ManagementFilterGroup({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="management-filter-group">
      <div className="management-filter-group-header">
        <h2>{title}</h2>
        {action}
      </div>
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
  if (!normalized) return currentSystemDate()
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

export function ManagementImportButton({
  children = 'Import',
  onClick,
}: {
  children?: ReactNode
  onClick: () => void
}) {
  return (
    <button className="button button-secondary management-import-action" type="button" onClick={onClick}>
      <ArrowDownToLine aria-hidden="true" size={16} strokeWidth={2} />
      {children}
    </button>
  )
}

export function ManagementCompactToolbar({
  ariaLabel,
  children,
  className,
  onSubmit,
}: {
  ariaLabel: string
  children: ReactNode
  className?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form aria-label={ariaLabel} className={`management-compact-toolbar${className ? ` ${className}` : ''}`} role="search" onSubmit={onSubmit}>
      {children}
    </form>
  )
}

export function ManagementCompactSearch({
  label,
  className,
  placeholder,
  value,
  leadingIcon,
  trailingAction,
  suggestions,
  suggestionsLabel,
  emptySuggestion,
  selectFirstSuggestionOnEnter = false,
  inputRef,
  onFocus,
  onChange,
  onSuggestionSelect,
}: {
  label: string
  className?: string
  placeholder?: string
  value: string
  leadingIcon?: ReactNode
  trailingAction?: ReactNode
  suggestions?: ManagementSearchSuggestion[]
  suggestionsLabel?: string
  emptySuggestion?: ReactNode
  selectFirstSuggestionOnEnter?: boolean
  inputRef?: Ref<HTMLInputElement>
  onFocus?: () => void
  onChange: (value: string) => void
  onSuggestionSelect?: (suggestion: ManagementSearchSuggestion) => void
}) {
  const showSuggestions = suggestions !== undefined && (suggestions.length > 0 || emptySuggestion !== undefined)
  const showClearAction = value.length > 0 && isValidElement(trailingAction) && trailingAction.type === ManagementCompactCreateAction
  return (
    <div className={`management-compact-search${className ? ` ${className}` : ''}`}>
      {leadingIcon ? <span className="management-compact-search-leading">{leadingIcon}</span> : null}
      <input
        aria-label={label}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!selectFirstSuggestionOnEnter || event.key !== 'Enter' || suggestions === undefined || suggestions.length === 0) return
          event.preventDefault()
          onSuggestionSelect?.(suggestions[0])
        }}
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
  pageSizeOptions = managementPageSizeOptions,
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
  pageSizeOptions?: readonly number[]
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

export function ManagementDetailPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`management-detail-panel${className ? ` ${className}` : ''}`}>{children}</div>
}

export function ManagementDetailHeader({
  title,
  endAction,
  children,
}: {
  title: ReactNode
  endAction?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="management-detail-header">
      <h2>{title}</h2>
      {endAction}
      {children}
    </header>
  )
}

export function ManagementDetailSummary({
  ariaLabel,
  code,
  metaAriaLabel,
  metaItems,
  title,
}: {
  ariaLabel: string
  code?: ReactNode
  metaAriaLabel?: string
  metaItems?: Array<{ label: ReactNode; value: ReactNode }>
  title: ReactNode
}) {
  return (
    <section aria-label={ariaLabel} className="management-detail-summary" role="group">
      <div className="management-detail-summary-main">
        <div className="management-detail-title-line">
          <h2>{title}</h2>
          {code ? <span>{code}</span> : null}
        </div>
        {metaItems && metaItems.length > 0 ? (
          <div aria-label={metaAriaLabel} className="management-detail-meta-line">
            {metaItems.map((item, index) => (
              <ManagementDetailMetaText key={`${String(item.label)}-${index}`} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ManagementDetailSection({
  ariaLabel,
  children,
  className,
  role,
}: {
  ariaLabel: string
  children: ReactNode
  className?: string
  role?: AriaRole
}) {
  return (
    <section aria-label={ariaLabel} className={`management-detail-section${className ? ` ${className}` : ''}`} role={role}>
      {children}
    </section>
  )
}

export function ManagementDetailInfoList({
  columns,
  items,
}: {
  columns?: 'auto' | 'three' | 'four'
  items: Array<{ label: ReactNode; value: ReactNode; span?: number }>
}) {
  const listRef = useRef<HTMLDListElement | null>(null)
  const [stacked, setStacked] = useState(false)
  const gridClass = columns === 'three'
    ? 'management-detail-meta-grid management-detail-meta-grid-three'
    : columns === 'four'
      ? 'management-detail-meta-grid management-detail-meta-grid-four'
      : 'management-detail-meta-grid'

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const detailList = list

    function syncLayout() {
      const wasStacked = detailList.classList.contains(managementDetailMetaGridStackedClass)
      if (wasStacked) detailList.classList.remove(managementDetailMetaGridStackedClass)

      const nextStacked = shouldStackManagementDetailMetaGrid(detailList)

      if (wasStacked) detailList.classList.add(managementDetailMetaGridStackedClass)
      setStacked((current) => current === nextStacked ? current : nextStacked)
    }

    syncLayout()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncLayout)
      observer.observe(detailList)
      Array.from(detailList.children).forEach((child) => {
        if (child instanceof Element) observer?.observe(child)
      })
    }

    window.addEventListener('resize', syncLayout)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', syncLayout)
    }
  }, [items])

  return (
    <dl ref={listRef} className={`${gridClass}${stacked ? ` ${managementDetailMetaGridStackedClass}` : ''}`}>
      {items.map((item, index) => (
        <div key={`${String(item.label)}-${index}`} style={item.span ? { gridColumn: `span ${item.span}` } : undefined}>
          <dt className="management-detail-meta-label">{item.label}</dt>
          <dd className="management-detail-meta-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ManagementDetailCard({
  ariaLabel,
  children,
  className,
  title,
}: {
  ariaLabel: string
  children: ReactNode
  className?: string
  title: ReactNode
}) {
  return (
    <section aria-label={ariaLabel} className={`management-detail-card${className ? ` ${className}` : ''}`}>
      <h3>{title}</h3>
      <div className="management-detail-card-body">{children}</div>
    </section>
  )
}

function shouldStackManagementDetailMetaGrid(list: HTMLDListElement) {
  return Array.from(list.children).some((child) => {
    if (!(child instanceof HTMLElement)) return false

    const label = child.querySelector('dt')
    const value = child.querySelector('dd')
    if (!(label instanceof HTMLElement) || !(value instanceof HTMLElement)) return false

    const availableWidth = child.clientWidth
    if (availableWidth <= 0) return false

    const styles = window.getComputedStyle(child)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0')
    const neededWidth = label.scrollWidth + value.scrollWidth + (Number.isFinite(gap) ? gap : 0)

    return neededWidth > availableWidth + 1
  })
}

export function ManagementDetailMetaText({
  label,
  value,
}: {
  label: ReactNode
  value: ReactNode
}) {
  return (
    <span>
      <span className="management-detail-meta-label">{label}</span>{' '}
      <span className="management-detail-meta-value">{value}</span>
    </span>
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

export function ManagementDetailNote({
  icon,
  value,
  fallback = 'Chưa có ghi chú',
}: {
  icon?: ReactNode
  value?: string | null
  fallback?: ReactNode
}) {
  const noteText = value?.trim()

  return <ManagementDetailInlineNote icon={icon}>{noteText || fallback}</ManagementDetailInlineNote>
}

export function ManagementDetailNoteInput({
  ariaLabel,
  readOnly = false,
  value,
  placeholder = 'Chưa có ghi chú',
  rows = 4,
  onChange,
}: {
  ariaLabel: string
  readOnly?: boolean
  value: string
  placeholder?: string
  rows?: number
  onChange?: (value: string) => void
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      className="management-detail-note"
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
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
