import { MetricCard, MetricGrid, MoneyText } from '../../components/ui-shell/primitives'
import type { CashbookListResponse } from './types'

export interface FinanceSummaryCardsProps {
  summary: CashbookListResponse['summary']
}

export function FinanceSummaryCards({ summary }: FinanceSummaryCardsProps) {
  return (
    <MetricGrid ariaLabel="Tổng quan sổ quỹ">
      <MetricCard label="Quỹ đầu kỳ" value={<MoneyText value={summary.opening_balance} />} hint="Theo bộ lọc" tone="neutral" />
      <MetricCard label="Tổng thu" value={<MoneyText value={summary.total_in} />} hint="Theo bộ lọc sổ quỹ" tone="info" />
      <MetricCard label="Tổng chi" value={<MoneyText value={summary.total_out} />} hint="Theo bộ lọc" tone="warning" />
      <MetricCard label="Tồn quỹ" value={<MoneyText value={summary.ending_balance} />} hint="Theo bộ lọc" tone="success" />
    </MetricGrid>
  )
}
