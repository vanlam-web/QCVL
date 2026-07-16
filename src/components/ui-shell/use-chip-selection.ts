import { useEffect, useMemo, useState } from 'react'

export interface ManagementChipOption {
  id: string
  label: string
}

export function useChipSelection({
  options,
  initialSelectedIds,
  lockedSelectedIds = [],
}: {
  options: ManagementChipOption[]
  initialSelectedIds: string[]
  lockedSelectedIds?: string[]
}) {
  const optionKey = options.map((option) => option.id).join('\u001f')
  const initialKey = initialSelectedIds.join('\u001f')
  const lockedKey = lockedSelectedIds.join('\u001f')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    const optionIds = new Set(options.map((option) => option.id))
    const initialIds = initialSelectedIds.filter((id) => optionIds.has(id))
    const lockedIds = lockedSelectedIds.filter((id) => optionIds.has(id))
    setSelectedIds((current) => {
      const kept = current.filter((id) => optionIds.has(id))
      const base = kept.length > 0 ? kept : initialIds
      const next = uniqueIds([...lockedIds, ...base])
      return sameIds(current, next) ? current : next
    })
  }, [initialKey, lockedKey, optionKey])

  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [optionKey])
  const selectedOptions = selectedIds.flatMap((id) => {
    const option = optionById.get(id)
    return option ? [option] : []
  })
  const selectedSet = new Set(selectedIds)
  const unselectedOptions = options.filter((option) => !selectedSet.has(option.id))
  const lockedSet = new Set(lockedSelectedIds)

  return {
    selectedIds,
    selectedOptions,
    unselectedOptions,
    addChip(id: string) {
      if (!optionById.has(id)) return
      setSelectedIds((current) => uniqueIds([...current, id]))
    },
    removeChip(id: string) {
      if (lockedSet.has(id)) return
      setSelectedIds((current) => current.filter((selectedId) => selectedId !== id))
    },
    isLocked(id: string) {
      return lockedSet.has(id)
    },
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
