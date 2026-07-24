import { useState, type FormEvent } from 'react'
import { Download, Search } from 'lucide-react'
import {
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementImportButton,
} from '../../components/ui-shell/management-layout'

interface FinanceFiltersPanelProps {
  search: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSearchChange: (value: string) => void
  onCreateReceipt: () => void
  onCreatePayment: () => void
  onExportCashbook: () => void | Promise<void>
  onOpenImport: () => void
}

export function FinanceFiltersPanel({
  search,
  onSubmit,
  onSearchChange,
  onCreateReceipt,
  onCreatePayment,
  onExportCashbook,
  onOpenImport,
}: FinanceFiltersPanelProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  function chooseCreate(action: () => void) {
    setCreateMenuOpen(false)
    action()
  }

  return (
    <div className="finance-page-actions">
      <ManagementCompactToolbar ariaLabel="Lọc sổ quỹ" onSubmit={onSubmit}>
        <ManagementCompactSearch
          label="Tìm sổ quỹ"
          placeholder="Mã phiếu, người nộp/nhận, ghi chú"
          value={search}
          leadingIcon={<Search aria-hidden="true" size={16} />}
          trailingAction={
            <span className="management-compact-create-menu">
              <ManagementCompactCreateAction
                ariaLabel="Tạo phiếu thu hoặc phiếu chi"
                onClick={() => setCreateMenuOpen((current) => !current)}
              />
              {createMenuOpen ? (
                <span aria-label="Chọn loại phiếu" className="management-compact-create-menu-options" role="menu">
                  <button role="menuitem" type="button" onClick={() => chooseCreate(onCreateReceipt)}>Phiếu thu</button>
                  <button role="menuitem" type="button" onClick={() => chooseCreate(onCreatePayment)}>Phiếu chi</button>
                </span>
              ) : null}
            </span>
          }
          onChange={onSearchChange}
        />
      </ManagementCompactToolbar>
      <div className="finance-voucher-actions" aria-label="Tác vụ sổ quỹ">
        <ManagementImportButton onClick={onOpenImport}>Import</ManagementImportButton>
        <button className="button button-secondary" type="button" onClick={() => void onExportCashbook()}>
          <Download aria-hidden="true" size={16} />
          Xuất file
        </button>
      </div>
    </div>
  )
}
