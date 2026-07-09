import { useMemo, useState } from 'react'

export type ManagementSortKind = 'text' | 'number' | 'date'
export type ManagementSortDirection = 'asc' | 'desc'
export type ManagementSortState<Key extends string> = { key: Key; direction: ManagementSortDirection } | null

export interface ManagementSortColumn<Item> {
  kind: ManagementSortKind
  value: (item: Item) => string | number | null | undefined
}

export function firstManagementSortDirection(kind: ManagementSortKind): ManagementSortDirection {
  return kind === 'text' ? 'asc' : 'desc'
}

function compareSortValue(left: string | number | null | undefined, right: string | number | null | undefined, kind: ManagementSortKind) {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  if (kind === 'text') return String(left).localeCompare(String(right), 'vi', { numeric: true, sensitivity: 'base' })
  const leftNumber = kind === 'date' && typeof left === 'string' ? Date.parse(left) : Number(left)
  const rightNumber = kind === 'date' && typeof right === 'string' ? Date.parse(right) : Number(right)
  if (!Number.isFinite(leftNumber) && !Number.isFinite(rightNumber)) return 0
  if (!Number.isFinite(leftNumber)) return 1
  if (!Number.isFinite(rightNumber)) return -1
  return leftNumber - rightNumber
}

export function useManagementTableSort<Item, Key extends string>(
  items: readonly Item[],
  columns: Record<Key, ManagementSortColumn<Item>>,
) {
  const [sortState, setSortState] = useState<ManagementSortState<Key>>(null)
  const sortedItems = useMemo(() => {
    if (sortState === null) return [...items]
    const column = columns[sortState.key]
    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const compared = compareSortValue(column.value(left.item), column.value(right.item), column.kind)
        const directed = sortState.direction === 'asc' ? compared : -compared
        return directed === 0 ? left.index - right.index : directed
      })
      .map(({ item }) => item)
  }, [columns, items, sortState])

  function requestSort(key: Key) {
    const firstDirection = firstManagementSortDirection(columns[key].kind)
    setSortState((current) => {
      if (current === null || current.key !== key) return { key, direction: firstDirection }
      if (current.direction === firstDirection) return { key, direction: firstDirection === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  return { sortedItems, sortState, requestSort }
}
