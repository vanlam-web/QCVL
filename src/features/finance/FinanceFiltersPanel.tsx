import type { FormEvent, ReactNode } from 'react'
import { Download, Search } from 'lucide-react'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
} from '../../components/ui-shell/management-layout'

export interface FinanceSearchSuggestion {
  id: string
  primary: string
  secondary?: string | null
  meta?: ReactNode
  ariaLabel: string
}

interface FinanceFiltersPanelProps {
  search: string
  suggestions?: FinanceSearchSuggestion[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSearchChange: (value: string) => void
  onSuggestionSelect: (suggestion: FinanceSearchSuggestion) => void
  onCreateVoucher: () => void
  onExportCashbook: () => void
}

export function FinanceFiltersPanel({
  search,
  suggestions,
  onSubmit,
  onSearchChange,
  onSuggestionSelect,
  onCreateVoucher,
  onExportCashbook,
}: FinanceFiltersPanelProps) {
  return (
    <div className="finance-page-actions">
      <ManagementCompactToolbar ariaLabel="Lọc sổ quỹ" onSubmit={onSubmit}>
        <ManagementCompactSearch
          label="Tìm sổ quỹ"
          placeholder="Mã phiếu, người nộp/nhận, ghi chú"
          value={search}
          leadingIcon={<Search aria-hidden="true" size={16} />}
          trailingAction={
            <ManagementCompactCreateAction ariaLabel="Tạo phiếu thu chi" onClick={onCreateVoucher} />
          }
          suggestions={suggestions}
          suggestionsLabel="Gợi ý sổ quỹ"
          emptySuggestion="Không có kết quả phù hợp"
          onChange={onSearchChange}
          onSuggestionSelect={(suggestion) => onSuggestionSelect(suggestion as FinanceSearchSuggestion)}
        />
      </ManagementCompactToolbar>
      <div className="finance-voucher-actions" aria-label="Tác vụ sổ quỹ">
        <button className="button button-secondary" type="button" onClick={onExportCashbook}>
          <Download aria-hidden="true" size={16} />
          Xuất file
        </button>
      </div>
    </div>
  )
}
