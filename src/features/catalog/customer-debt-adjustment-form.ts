import { formatQcvDateTime, parseQcvDateTimeInputToLocalDate } from '../../lib/date-format'

export type CustomerDebtAdjustmentForm = {
  adjustmentId: string
  adjustedAt: string
  adjustedAtIso: string | null
  amount: string
  note: string
}

export function parseCustomerDebtAdjustmentDateTime(value: string) {
  return parseQcvDateTimeInputToLocalDate(value)
}

export function formatCustomerDebtAdjustmentDateTime(value: Date) {
  return formatQcvDateTime(value)
}
