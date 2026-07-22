export function normalizeManagementSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function preventManagementSearchSubmit(event: { preventDefault: () => void }, action: () => void | Promise<void>) {
  event.preventDefault()
  void action()
}
