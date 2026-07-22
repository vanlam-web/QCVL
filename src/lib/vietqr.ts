import { vietnamBankOptions, type VietnamBankOption } from '../features/finance/vietnam-bank-catalog'

/** Bill-facing labels for catalog shortNames that look cramped on print (KV-style). */
const billBankDisplayAliases: Record<string, string> = {
  MBBank: 'MB Bank',
  VietinBank: 'VietinBank',
  Vietcombank: 'Vietcombank',
  HDBank: 'HD Bank',
  SeABank: 'SeABank',
  VPBank: 'VPBank',
  Techcombank: 'Techcombank',
  Sacombank: 'Sacombank',
  ACB: 'ACB',
  TPBank: 'TPBank',
  VIB: 'VIB',
  SHB: 'SHB',
  Eximbank: 'Eximbank',
  MSB: 'MSB',
  NamABank: 'Nam A Bank',
  OCB: 'OCB',
  BIDV: 'BIDV',
  Agribank: 'Agribank',
}

function findVietnamBankOption(bankName: string | null | undefined): VietnamBankOption | null {
  const needle = (bankName ?? '').trim().toLowerCase()
  if (!needle) return null
  const compact = needle.replace(/[\s_-]+/g, '')
  return vietnamBankOptions.find((bank) => {
    const shortName = bank.shortName.toLowerCase()
    const shortCompact = shortName.replace(/[\s_-]+/g, '')
    const name = bank.name.toLowerCase()
    const code = bank.code.toLowerCase()
    return (
      needle === shortName
      || compact === shortCompact
      || needle === code
      || compact === code.toLowerCase()
      || compact.includes(shortCompact)
      || shortCompact.includes(compact)
      || name.includes(needle)
    )
  }) ?? null
}

export function resolveVietnamBankBin(bankName: string | null | undefined): string | null {
  return findVietnamBankOption(bankName)?.bin ?? null
}

/** Label on A4 bill next to STK — prefers catalog shortName with readable spacing. */
export function displayVietnamBankLabel(bankName: string | null | undefined): string {
  const trimmed = (bankName ?? '').trim()
  if (!trimmed) return ''
  const match = findVietnamBankOption(trimmed)
  if (!match) return trimmed
  return billBankDisplayAliases[match.shortName] ?? match.shortName
}

export function buildVietQrImageUrl(input: {
  bankName: string
  accountNumber: string
  accountHolder?: string | null
  amount?: number | null
  description?: string | null
}): string | null {
  const bin = resolveVietnamBankBin(input.bankName)
  const accountNumber = input.accountNumber.replace(/\s+/g, '')
  if (!bin || !accountNumber) return null
  const params = new URLSearchParams()
  if (input.accountHolder?.trim()) params.set('accountName', input.accountHolder.trim())
  if (input.amount && input.amount > 0) params.set('amount', String(Math.round(input.amount)))
  if (input.description?.trim()) params.set('addInfo', input.description.trim())
  const query = params.toString()
  return `https://img.vietqr.io/image/${bin}-${accountNumber}-compact2.png${query ? `?${query}` : ''}`
}
