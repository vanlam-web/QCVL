import { useMemo, useState } from 'react'

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
  const optionIds = useMemo(() => new Set(options.map((option) => option.id)), [options])
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(() => uniqueIds([
    ...lockedSelectedIds.filter((id) => optionIds.has(id)),
    ...initialSelectedIds.filter((id) => optionIds.has(id)),
  ]))
  const [hasUserSelection, setHasUserSelection] = useState(false)
  const selectedIds = useMemo(() => {
    const initialIds = initialSelectedIds.filter((id) => optionIds.has(id))
    const lockedIds = lockedSelectedIds.filter((id) => optionIds.has(id))
    const kept = draftSelectedIds.filter((id) => optionIds.has(id))
    const base = kept.length > 0 || hasUserSelection ? kept : initialIds
    return uniqueIds([...lockedIds, ...base])
  }, [draftSelectedIds, hasUserSelection, initialSelectedIds, lockedSelectedIds, optionIds])

  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options])
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
      setHasUserSelection(true)
      setDraftSelectedIds(uniqueIds([...selectedIds, id]))
    },
    removeChip(id: string) {
      if (lockedSet.has(id)) return
      setHasUserSelection(true)
      setDraftSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
    },
    isLocked(id: string) {
      return lockedSet.has(id)
    },
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}
