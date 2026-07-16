export function displayPriceListName(priceList: { name: string; is_default?: boolean | null } | null | undefined): string {
  if (!priceList) return '-'
  return isDefaultPriceListDisplayName(priceList.name) || priceList.is_default === true ? 'Giá chung' : priceList.name
}

function isDefaultPriceListDisplayName(name: string) {
  const normalized = normalizeDisplayText(name)
  return normalized === normalizeDisplayText('Bảng giá chung') || normalized === normalizeDisplayText('Bang gia le')
}

function normalizeDisplayText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
