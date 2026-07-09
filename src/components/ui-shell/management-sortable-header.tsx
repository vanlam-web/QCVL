import type { ReactNode } from 'react'
import { firstManagementSortDirection, type ManagementSortKind, type ManagementSortState } from './management-table-sort'

export function ManagementSortableHeader<Key extends string>({
  sortKey,
  kind,
  sortState,
  onSort,
  children,
}: {
  sortKey: Key
  kind: ManagementSortKind
  sortState: ManagementSortState<Key>
  onSort: (key: Key) => void
  children: ReactNode
}) {
  const active = sortState?.key === sortKey
  const ariaSort = active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'
  const firstDirection = firstManagementSortDirection(kind)
  const title = active
    ? sortState.direction === firstDirection
      ? 'Dao chieu sap xep'
      : 'Ve sap xep mac dinh'
    : 'Sap xep cot'
  return (
    <th aria-sort={ariaSort}>
      <button className="management-sort-header-button" title={title} type="button" onClick={() => onSort(sortKey)}>
        <span>{children}</span>
        <span aria-hidden="true" className="management-sort-header-indicator">
          {active ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
