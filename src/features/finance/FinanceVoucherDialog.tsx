import { CalendarDays, Info, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { CashbookDirection, CashbookEntryDetail, CashbookVoucherType, CreateCashbookVoucherInput, FinanceAccount } from './types'
import {
  financeAccountChoiceLabel,
  voucherTypeOptions,
} from './finance-presenter'
import { formatVoucherAmountInput } from './finance-filters'

export interface FinanceVoucherDialogProps {
  open: boolean
  voucherMode: CashbookDirection | null
  voucherIssuedAt: string
  onIssuedAtChange: (value: string) => void
  voucherType: CashbookVoucherType
  onVoucherTypeChange: (type: CashbookVoucherType) => void
  voucherActorName: string
  voucherActorRole: string
  voucherCounterpartyType: CreateCashbookVoucherInput['counterparty_type']
  onCounterpartyTypeChange: (type: CreateCashbookVoucherInput['counterparty_type']) => void
  voucherCounterpartyName: string
  onCounterpartyNameChange: (name: string) => void
  voucherCounterpartyOptions: Array<{ id: string; name: string; code: string }>
  counterpartyTypeOptions: Array<{ value: CreateCashbookVoucherInput['counterparty_type']; label: string }>
  voucherPaymentMethod: CashbookEntryDetail['payment_method']
  onPaymentMethodChange: (method: CashbookEntryDetail['payment_method']) => void
  voucherAccountId: string
  onAccountIdChange: (id: string) => void
  activeBankAccounts: FinanceAccount[]
  voucherAmount: string
  onAmountChange: (amount: string) => void
  voucherReason: string
  onReasonChange: (reason: string) => void
  voucherBusinessAccounted: boolean
  onBusinessAccountedChange: (checked: boolean) => void
  savingVoucher: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenCounterpartyCreate: () => void
  openVoucherForm: (direction: CashbookDirection) => void
}

type CounterpartyType = NonNullable<CreateCashbookVoucherInput['counterparty_type']>
const voucherCounterpartyLabels: Record<CounterpartyType, string> = {
  customer: 'Khách hàng',
  supplier: 'Nhà cung cấp',
  employee: 'Nhân viên',
  delivery_partner: 'Đối tác giao hàng',
  other: 'Khác',
  none: 'Khác',
}

export function FinanceVoucherDialog(props: FinanceVoucherDialogProps) {
  const {
    open,
    voucherMode,
    voucherIssuedAt,
    onIssuedAtChange,
    voucherType,
    onVoucherTypeChange,
    voucherActorName,
    voucherActorRole,
    voucherCounterpartyType,
    onCounterpartyTypeChange,
    voucherCounterpartyName,
    onCounterpartyNameChange,
    voucherCounterpartyOptions,
    counterpartyTypeOptions,
    voucherPaymentMethod,
    onPaymentMethodChange,
    voucherAccountId,
    onAccountIdChange,
    activeBankAccounts,
    voucherAmount,
    onAmountChange,
    voucherReason,
    onReasonChange,
    voucherBusinessAccounted,
    onBusinessAccountedChange,
    savingVoucher,
    onClose,
    onSubmit,
    onOpenCounterpartyCreate,
    openVoucherForm,
  } = props

  if (!open || voucherMode === null) return null

  const voucherDialogLabel = voucherMode === 'in' ? 'Tạo phiếu thu' : 'Tạo phiếu chi'
  const voucherDialogTitle = voucherMode === 'in' ? 'Tạo phiếu thu' : 'Tạo phiếu chi'
  const voucherTypeLabel = voucherMode === 'in' ? 'Loại thu' : 'Loại chi'
  const voucherCounterpartyTypeLabel = voucherMode === 'in' ? 'Đối tượng nộp' : 'Đối tượng nhận'
  const voucherCounterpartyNameLabel = voucherMode === 'in' ? 'Tên người nộp' : 'Tên người nhận'
  const voucherCounterpartyRole = voucherMode === 'in' ? 'nộp' : 'nhận'
  const voucherAccountLabel = voucherMode === 'in' ? 'Tài khoản nhận' : 'Tài khoản chi'

  const voucherTabs: Array<{ direction: CashbookDirection; label: string }> = voucherMode === 'out'
    ? [
        { direction: 'out', label: 'Phiếu chi' },
        { direction: 'in', label: 'Phiếu thu' },
      ]
    : [
        { direction: 'in', label: 'Phiếu thu' },
        { direction: 'out', label: 'Phiếu chi' },
      ]


  return (
    <div className="management-modal-backdrop">
      <section
        aria-label={voucherDialogLabel}
        aria-modal="true"
        className="management-modal-dialog management-modal-dialog-medium finance-voucher-panel"
        role="dialog"
      >
        <header className="management-modal-header">
          <h2>{voucherDialogTitle}</h2>
          <button aria-label="Đóng popup phiếu thu chi" className="management-icon-button" type="button" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="inline-detail-tabbar">
          <div className="inline-detail-tabs" role="tablist" aria-label="Loại phiếu">
            {voucherTabs.map((tab) => (
              <button
                aria-selected={voucherMode === tab.direction}
                key={tab.direction}
                role="tab"
                type="button"
                onClick={() => openVoucherForm(tab.direction)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <form aria-label={voucherDialogLabel} className="management-modal-form" onSubmit={onSubmit}>
          <div className="management-modal-form-grid">
            <label>
              Mã phiếu
              <input placeholder="Tự động" readOnly value="" />
            </label>
            <label className="management-input-with-icon">
              Thời gian
              <input value={voucherIssuedAt} onChange={(event) => onIssuedAtChange(event.target.value)} />
              <CalendarDays aria-hidden="true" size={16} />
            </label>
            <label>
              {voucherTypeLabel}
              <select
                value={voucherType}
                onChange={(event) => onVoucherTypeChange(event.target.value as CashbookVoucherType)}
              >
                {voucherTypeOptions(voucherMode).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Người {voucherActorRole}
              <select disabled value={voucherActorName}>
                <option value={voucherActorName}>{voucherActorName}</option>
              </select>
            </label>
            <label>
              {voucherCounterpartyTypeLabel}
              <select
                value={voucherCounterpartyType}
                onChange={(event) => onCounterpartyTypeChange(event.target.value as CreateCashbookVoucherInput['counterparty_type'])}
              >
                {counterpartyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div>
              <span className="management-field-heading">
                <label htmlFor="finance-voucher-counterparty-name">{voucherCounterpartyNameLabel}</label>
                {voucherCounterpartyType === 'customer'
                || voucherCounterpartyType === 'supplier'
                || voucherCounterpartyType === 'employee'
                || voucherCounterpartyType === 'delivery_partner' ? (
                  <button
                    aria-label={`Tạo mới ${voucherCounterpartyLabels[voucherCounterpartyType].toLowerCase()}`}
                    className="management-field-link-action"
                    type="button"
                    onClick={onOpenCounterpartyCreate}
                  >
                    Tạo mới
                  </button>
                ) : null}
              </span>
              <input
                id="finance-voucher-counterparty-name"
                aria-label={voucherCounterpartyNameLabel}
                list="finance-voucher-counterparty-options"
                placeholder={`Tìm người ${voucherCounterpartyRole}`}
                value={voucherCounterpartyName}
                onChange={(event) => onCounterpartyNameChange(event.target.value)}
              />
              <datalist id="finance-voucher-counterparty-options">
                {voucherCounterpartyOptions.map((option) => (
                  <option key={option.id} value={option.name}>{option.code} - {option.name}</option>
                ))}
              </datalist>
            </div>
            <label>
              Phương thức TT
              <select
                value={voucherPaymentMethod}
                onChange={(event) => onPaymentMethodChange(event.target.value as CashbookEntryDetail['payment_method'])}
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
              </select>
            </label>
            {voucherPaymentMethod === 'bank_transfer' ? (
              <label>
                {voucherAccountLabel}
                <select value={voucherAccountId} onChange={(event) => onAccountIdChange(event.target.value)}>
                  <option value="">Chọn tài khoản</option>
                  {activeBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{financeAccountChoiceLabel(account)}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="management-modal-field-wide">
              Số tiền
              <input
                inputMode="numeric"
                placeholder="0"
                value={voucherAmount}
                onChange={(event) => onAmountChange(formatVoucherAmountInput(event.target.value))}
              />
            </label>
            <label className="management-modal-field-wide">
              Ghi chú
              <textarea placeholder="Nhập ghi chú" rows={3} value={voucherReason} onChange={(event) => onReasonChange(event.target.value)} />
            </label>
            <label className="management-modal-checkbox-row management-modal-field-wide">
              <input
                checked={voucherBusinessAccounted}
                type="checkbox"
                onChange={(event) => onBusinessAccountedChange(event.target.checked)}
              />
              <span>Hạch toán kết quả kinh doanh</span>
              <Info aria-hidden="true" size={15} />
            </label>
          </div>
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>Bỏ qua</button>
            <button className="button button-secondary" disabled={savingVoucher} type="submit">Lưu & In</button>
            <button className="button button-primary" disabled={savingVoucher} type="submit">Lưu</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
