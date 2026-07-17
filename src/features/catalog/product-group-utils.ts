import type { ProductGroup } from './types'

function normalizeProductGroupName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isInternalDeletedKiotVietProductGroup(group: ProductGroup) {
  const normalizedName = normalizeProductGroupName(group.name)
  return normalizedName.includes('kiotviet') && (
    normalizedName.includes('hang da xoa')
    || normalizedName.includes('h?ng ?? x?a')
    || normalizedName.includes('xoa kiotviet')
  )
}

export function visibleProductGroups(groups: ProductGroup[]) {
  return groups.filter((group) => !isInternalDeletedKiotVietProductGroup(group))
}
