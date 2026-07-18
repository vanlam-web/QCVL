import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { formatMoney } from '../../lib/number-format'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>
}

export function MoneyText({ value }: { value: number }) {
  return <span className="money-text">{formatMoney(value)}</span>
}

export function managementRecordSearchHref(path: string, search: string, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ search })
  Object.entries(extraParams).forEach(([key, value]) => params.set(key, value))
  return `${path}?${params.toString()}`
}

export function managementRecordOpenHref(path: string, code: string, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ open: code })
  Object.entries(extraParams).forEach(([key, value]) => params.set(key, value))
  return `${path}?${params.toString()}`
}

export function ManagementRecordLink({
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a className={`management-record-link${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </a>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function MetricGrid({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <section aria-label={ariaLabel} className="metric-grid">
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
}) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  )
}
