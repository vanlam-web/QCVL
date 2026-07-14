import type { FormEvent } from 'react'
import { Download, Search, Upload } from 'lucide-react'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
} from '../../components/ui-shell/management-layout'

interface FinanceFiltersPanelProps {
  search: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSearchChange: (value: string) => void
  onCreateVoucher: () => void
  onExportCashbook: () => void
  onOpenImport: () => void
}

export function FinanceFiltersPanel({
  search,
  onSubmit,
  onSearchChange,
  onCreateVoucher,
  onExportCashbook,
  onOpenImport,
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
          onChange={onSearchChange}
        />
      </ManagementCompactToolbar>
      <div className="finance-voucher-actions" aria-label="Tác vụ sổ quỹ">
        <button className="button button-secondary" type="button" onClick={onOpenImport}>
          <Upload aria-hidden="true" size={16} />
          Import KV
        </button>
        <button className="button button-secondary" type="button" onClick={onExportCashbook}>
          <Download aria-hidden="true" size={16} />
          Xuất file
        </button>
      </div>
    </div>
  )
}
