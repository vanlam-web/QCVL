import { vietnamBankOptions } from '../features/finance/vietnam-bank-catalog'

export function resolveVietnamBankBin(bankName: string | null | undefined): string | null {
  const needle = (bankName ?? '').trim().toLowerCase()
  if (!needle) return null
  const compact = needle.replace(/[\s_-]+/g, '')
  const match = vietnamBankOptions.find((bank) => {
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
  })
  return match?.bin ?? null
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
