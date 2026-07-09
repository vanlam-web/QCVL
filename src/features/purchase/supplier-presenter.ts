import { formatMoney } from '../../lib/number-format'
import type { Supplier } from './types'

export function supplierListSummary(suppliers: Pick<Supplier, 'current_payable_amount' | 'total_purchase_amount'>[] | null) {
  return {
    payableTotal: suppliers?.reduce((sum, supplier) => sum + supplier.current_payable_amount, 0) ?? 0,
    purchaseTotal: suppliers?.reduce((sum, supplier) => sum + supplier.total_purchase_amount, 0) ?? 0,
  }
}

export function supplierMoneyText(value: number) {
  return formatMoney(value)
}
