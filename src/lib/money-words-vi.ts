/** Convert non-negative VND integer amounts to Vietnamese words. */
export function vietnameseMoneyInWords(amount: number): string {
  const value = Math.round(Math.abs(Number.isFinite(amount) ? amount : 0))
  if (value === 0) return 'Không đồng.'

  const words = readTriads(value)
    .map((triad, index, list) => formatTriad(triad, list.length - index - 1, index === 0))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const capitalized = words.charAt(0).toLocaleUpperCase('vi') + words.slice(1)
  return `${capitalized} đồng chẵn.`
}

const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const scales = ['', 'nghìn', 'triệu', 'tỷ']

function readTriads(value: number) {
  const triads: number[] = []
  let remaining = value
  while (remaining > 0 || triads.length === 0) {
    triads.unshift(remaining % 1000)
    remaining = Math.floor(remaining / 1000)
    if (remaining === 0) break
  }
  return triads
}

function formatTriad(triad: number, scaleIndex: number, isLeading: boolean) {
  if (triad === 0) return ''
  const hundred = Math.floor(triad / 100)
  const ten = Math.floor((triad % 100) / 10)
  const one = triad % 10
  const parts: string[] = []

  if (hundred > 0) {
    parts.push(`${ones[hundred]} trăm`)
  } else if (!isLeading && (ten > 0 || one > 0)) {
    parts.push('không trăm')
  }

  if (ten > 1) {
    parts.push(`${ones[ten]} mươi`)
    if (one === 1) parts.push('mốt')
    else if (one === 5) parts.push('lăm')
    else if (one > 0) parts.push(ones[one]!)
  } else if (ten === 1) {
    parts.push('mười')
    if (one === 5) parts.push('lăm')
    else if (one > 0) parts.push(ones[one]!)
  } else if (one > 0) {
    if (hundred > 0 || (!isLeading && scaleIndex > 0)) parts.push('lẻ')
    parts.push(one === 5 && (hundred > 0 || ten > 0) ? 'lăm' : ones[one]!)
  }

  const scale = scales[scaleIndex] ?? ''
  return scale ? `${parts.join(' ')} ${scale}` : parts.join(' ')
}
