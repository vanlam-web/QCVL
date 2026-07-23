import { ManagementFilterGroup } from '../../components/ui-shell/management-layout'
import { businessAccountedText } from './finance-presenter'
import type { CashbookBusinessAccountedFilter, CashbookDirection, CashbookStatus } from './types'

export interface FinanceFilterOptionsProps {
  directionSelection: CashbookDirection[]
  statusSelection: CashbookStatus[]
  businessAccounted: CashbookBusinessAccountedFilter
  onToggleDirection: (direction: CashbookDirection) => void
  onToggleStatus: (status: CashbookStatus) => void
  onBusinessAccountedChange: (value: CashbookBusinessAccountedFilter) => void
}

export function FinanceFilterOptions({
  directionSelection,
  statusSelection,
  businessAccounted,
  onToggleDirection,
  onToggleStatus,
  onBusinessAccountedChange,
}: FinanceFilterOptionsProps) {
  return (
    <>
      <ManagementFilterGroup title="Loại chứng từ">
        <label className={`management-filter-choice${directionSelection.includes('in') ? ' management-filter-choice-active' : ''}`}>
          <input
            checked={directionSelection.includes('in')}
            type="checkbox"
            onChange={() => onToggleDirection('in')}
          />
          <span>Phiếu thu</span>
        </label>
        <label className={`management-filter-choice${directionSelection.includes('out') ? ' management-filter-choice-active' : ''}`}>
          <input
            checked={directionSelection.includes('out')}
            type="checkbox"
            onChange={() => onToggleDirection('out')}
          />
          <span>Phiếu chi</span>
        </label>
      </ManagementFilterGroup>
      <ManagementFilterGroup title="Trạng thái sổ quỹ">
        <label className={`management-filter-choice${statusSelection.includes('posted') ? ' management-filter-choice-active' : ''}`}>
          <input
            checked={statusSelection.includes('posted')}
            type="checkbox"
            onChange={() => onToggleStatus('posted')}
          />
          <span>Đã thanh toán</span>
        </label>
        <label className={`management-filter-choice${statusSelection.includes('cancelled') ? ' management-filter-choice-active' : ''}`}>
          <input
            checked={statusSelection.includes('cancelled')}
            type="checkbox"
            onChange={() => onToggleStatus('cancelled')}
          />
          <span>Đã hủy</span>
        </label>
      </ManagementFilterGroup>
      <ManagementFilterGroup title="Hạch toán KQKD">
        <div className="management-filter-segmented" role="radiogroup" aria-label="Hạch toán KQKD">
          {(['all', 'true', 'false'] as CashbookBusinessAccountedFilter[]).map((option) => (
            <label
              className={businessAccounted === option ? 'management-filter-segmented-active' : undefined}
              key={option}
            >
              <input
                checked={businessAccounted === option}
                name="cashbook-business-accounted"
                type="radio"
                onChange={() => onBusinessAccountedChange(option)}
              />
              <span>{option === 'false' ? 'Không' : option === 'true' ? 'Có' : businessAccountedText(option)}</span>
            </label>
          ))}
        </div>
      </ManagementFilterGroup>
    </>
  )
}
