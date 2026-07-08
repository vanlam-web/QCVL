export type PaymentSettlementStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentSettlementTone = 'neutral' | 'warning' | 'success'

export function paymentSettlementStatusLabel(status: PaymentSettlementStatus) {
  if (status === 'paid') return 'Hoàn tất'
  if (status === 'partial') return 'Thanh toán 1 phần'
  return 'Chưa thanh toán'
}

export function paymentSettlementStatusTone(status: PaymentSettlementStatus): PaymentSettlementTone {
  if (status === 'paid') return 'success'
  if (status === 'partial') return 'warning'
  return 'neutral'
}
