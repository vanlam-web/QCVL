import { formatMoney } from '../../lib/number-format'
import { formatKvDate } from '../../lib/date-format'
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

export function supplierCreatorLabel(supplier: Pick<Supplier, 'created_by' | 'source_creator_name'>) {
  return supplier.created_by?.name || supplier.source_creator_name || 'Chưa có dữ liệu'
}

export function supplierCreatedDateText(supplier: Pick<Supplier, 'created_at' | 'source_created_at'>) {
  return formatKvDate(supplier.created_at ?? supplier.source_created_at, 'Chưa có dữ liệu')
}

export function supplierGroupLabel(supplier: Pick<Supplier, 'supplier_group'>) {
  return supplier.supplier_group?.name || 'Chưa có'
}
