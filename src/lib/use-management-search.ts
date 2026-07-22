import { useState } from 'react'

export function useManagementSearch({
  initialSearch = '',
  onApply,
  onDraftChange,
}: {
  initialSearch?: string
  onApply?: (search: string) => void
  onDraftChange?: (search: string) => void
}) {
  const [draftSearch, setDraftSearch] = useState(initialSearch)
  const [appliedSearch, setAppliedSearch] = useState(initialSearch)

  function applySearch(nextSearch: string) {
    setDraftSearch(nextSearch)
    setAppliedSearch(nextSearch)
    onApply?.(nextSearch)
  }

  function changeSearch(nextSearch: string) {
    setDraftSearch(nextSearch)
    onDraftChange?.(nextSearch)
  }

  function submitSearch(event?: Pick<Event, 'preventDefault'>) {
    event?.preventDefault()
    applySearch(draftSearch.trim())
  }

  function clearSearch() {
    applySearch('')
  }

  return {
    draftSearch,
    appliedSearch,
    setDraftSearch,
    changeSearch,
    applySearch,
    submitSearch,
    clearSearch,
  }
}
