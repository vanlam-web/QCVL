export function normalizeManagementSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function managementSearchQuery(value: string) {
  return value.trim()
}

export function preventManagementSearchSubmit(event: { preventDefault: () => void }, action: () => void | Promise<void>) {
  event.preventDefault()
  void action()
}

export function runManagementLiveSearch(
  nextSearch: string,
  options: {
    setSearch: (value: string) => void
    resetSelection?: () => void
    load: (query: string) => void | Promise<void>
  },
) {
  options.setSearch(nextSearch)
  options.resetSelection?.()
  void options.load(managementSearchQuery(nextSearch))
}
