export const managementPageSizeOptions = [15, 20, 25, 30, 50, 100] as const

export function pageSizeForManagementViewport(width = currentViewportWidth()) {
  if (width >= 1920) return 30
  if (width >= 1600) return 25
  if (width >= 1366) return 20
  return 15
}

function currentViewportWidth() {
  if (typeof window === 'undefined') return 1024
  return window.innerWidth
}
