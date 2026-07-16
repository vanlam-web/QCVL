import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'
import type { Customer } from './types'
import { formatKvDate, formatKvDateTime } from '../../lib/date-format'

export function customerSalesDocumentStatusText(document: SalesDocumentListItem) {
  if (document.order_type === 'invoice') {
    if (document.status === 'cancelled') return 'Đã hủy'
    if (document.payment_status === 'paid') return 'Hoàn tất'
    if (document.payment_status === 'unpaid' || (document.debt_amount > 0 && document.paid_amount <= 0)) return 'Nợ'
    if (document.payment_status === 'partial') return 'Nợ 1 phần'
    if (document.debt_amount > 0) return 'Nợ 1 phần'
    return 'Hoàn tất'
  }

  if (document.status === 'active') return 'Đang hiệu lực'
  if (document.status === 'converted') return 'Đã chuyển'
  return 'Đã hủy'
}

export function customerDateTime(value: string | null | undefined) {
  return formatKvDateTime(value, 'Chưa có dữ liệu')
}

export function customerDate(value: string | null | undefined) {
  return formatKvDate(value, 'Chưa có dữ liệu')
}

export function customerVisibleSummary(customers: Array<Pick<Customer, 'total_debt_amount' | 'total_sales_amount'>>) {
  return {
    visibleDebtTotal: customers.reduce((sum, customer) => sum + (customer.total_debt_amount ?? 0), 0),
    visibleSalesTotal: customers.reduce((sum, customer) => sum + (customer.total_sales_amount ?? 0), 0),
  }
}
