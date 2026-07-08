import type { FormEvent, ReactNode, SyntheticEvent } from 'react'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

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
  popoverOpen = false,
  children,
}: {
  ariaLabel: string
  title?: string
  activeSummary?: string
  actions?: ReactNode
  popoverOpen?: boolean
  children: ReactNode
}) {
  return (
    <aside aria-label={ariaLabel} className={`management-filter-sidebar${popoverOpen ? ' management-filter-sidebar-popover-open' : ''}`}>
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
  onChange,
}: {
  label: string
  placeholder?: string
  value: string
  leadingIcon?: ReactNode
  trailingAction?: ReactNode
  onChange: (value: string) => void
}) {
  return (
    <div className="management-compact-search">
      {leadingIcon ? <span className="management-compact-search-leading">{leadingIcon}</span> : null}
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {trailingAction ? <span className="management-compact-search-trailing">{trailingAction}</span> : null}
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
      <strong className="management-table-footer-summary">{rangeStart} - {rangeEnd} trong {total} {entityLabel}</strong>
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
