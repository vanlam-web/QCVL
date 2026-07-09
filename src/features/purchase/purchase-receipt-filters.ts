import { currentMonthRange, localDateString } from '../../lib/date-ranges'

export { currentMonthRange, localDateString }

export function purchaseReceiptTimeQuickOptions() {
  const today = localDateString(new Date())
  const monthRange = currentMonthRange()
  return [
    { id: 'all', label: 'Toàn thời gian', from: '', to: '' },
    { id: 'today', label: 'Hôm nay', from: today, to: today },
    { id: 'this-month', label: 'Tháng này', from: monthRange.from, to: monthRange.to },
  ]
}
