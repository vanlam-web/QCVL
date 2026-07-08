export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const sign = value < 0 ? '-' : ''
  const integer = Math.round(Math.abs(value)).toString()
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

export function parseMoneyInput(value: string): number {
  const normalized = value.replace(/\s/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMeasure(value: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 3,
    useGrouping: false,
  })
}
