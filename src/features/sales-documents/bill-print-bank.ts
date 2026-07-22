import type { FinanceAccount } from '../finance/types'
import type { BillPrintBankAccount } from './BillPrintSheet'

const pinnedBankAccountsStorageKey = 'finance.bankAccounts.pinnedIds'

export function pickBillPrintBankAccount(accounts: FinanceAccount[]): BillPrintBankAccount | null {
  const banks = accounts.filter(
    (account) => account.account_type === 'bank' && account.is_active !== false && Boolean(account.account_number?.trim()),
  )
  if (banks.length === 0) return null

  let pinnedIds: string[] = []
  try {
    if (typeof window !== 'undefined') {
      pinnedIds = JSON.parse(window.localStorage.getItem(pinnedBankAccountsStorageKey) ?? '[]') as string[]
    }
  } catch {
    pinnedIds = []
  }

  const selected = banks.find((account) => pinnedIds.includes(account.id)) ?? banks[0]
  if (!selected?.account_number?.trim()) return null
  return {
    bankName: selected.name,
    accountNumber: selected.account_number.trim(),
    accountHolder: selected.account_holder?.trim() || null,
  }
}
