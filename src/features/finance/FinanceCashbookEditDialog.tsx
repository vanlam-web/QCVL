import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { appRoutes } from '../../app/routes'
import { ManagementDateTimeInput } from '../../components/ui-shell/management-date-time-input'
import {
  ManagementDropdownField,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { ManagementRecordLink, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { formatMoney } from '../../lib/number-format'
import {
  cashbookDetailCategoryText,
  cashbookDetailCounterpartyText,
  cashbookDetailCreatorText,
  financeAccountChoiceLabel,
  financeDateText,
} from './finance-presenter'
import type { CashbookEntryDetail, FinanceAccount } from './types'

type FinanceAccountChoice = Pick<FinanceAccount, 'id' | 'code' | 'name' | 'account_type'> & {
  account_number?: string | null
}

export type CashbookEditForm = {
  createdAt: string
  financeAccountId: string
  note: string
}

function cashbookEditAllocationHref(code: string) {
  if (code.startsWith('HD')) return managementRecordOpenHref('/sales-documents', code, { type: 'invoice' })
  if (code.startsWith('PN')) return managementRecordOpenHref(appRoutes.purchaseReceipts, code)
  return null
}

export function FinanceCashbookEditDialog({
  detail,
  currentUserName,
  form,
  saving,
  paymentMethod,
  accountOptions,
  onClose,
  onSubmit,
  onFormChange,
  onPaymentMethodChange,
}: {
  detail: CashbookEntryDetail
  currentUserName: string
  form: CashbookEditForm
  saving: boolean
  paymentMethod: 'cash' | 'bank_transfer'
  accountOptions: FinanceAccountChoice[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFormChange: (form: CashbookEditForm) => void
  onPaymentMethodChange: (paymentMethod: 'cash' | 'bank_transfer') => void
}) {
  return (
    <div className="management-modal-backdrop">
      <section
        aria-label={`Sửa phiếu ${detail.code}`}
        aria-modal="true"
        className="management-modal-dialog finance-cashbook-edit-preview-dialog"
        role="dialog"
      >
        <header className="management-modal-header">
          <h2>{`Sửa phiếu ${detail.code}`}</h2>
          <button
            aria-label={`Đóng popup sửa phiếu ${detail.code}`}
            className="management-icon-button"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="finance-cashbook-edit-meta-line">
          <span><strong>Người tạo</strong> {cashbookDetailCreatorText(detail) || currentUserName}</span>
          <span><strong>Khách hàng</strong> {cashbookDetailCounterpartyText(detail) || '---'}</span>
        </div>
        <form aria-label={`Sửa phiếu ${detail.code}`} className="management-modal-form finance-cashbook-edit-form" onSubmit={onSubmit}>
          <div className="management-modal-form-grid finance-cashbook-edit-form-grid">
            <ManagementDateTimeInput
              className="finance-cashbook-edit-date-field"
              dateButtonLabel="Chọn ngày phiếu"
              datePickerLabel="Lịch chọn ngày phiếu"
              inputLabel="Sửa thời gian phiếu"
              label="Thời gian"
              timeButtonLabel="Chọn giờ phiếu"
              timePickerLabel="Chọn giờ phiếu"
              value={form.createdAt}
              onChange={(createdAt) => onFormChange({ ...form, createdAt })}
            />
            <label>
              Loại thu/chi
              <input readOnly value={cashbookDetailCategoryText(detail)} />
            </label>
            <ManagementDropdownField
              label="Phương thức TT"
              menuLabel="Chọn phương thức TT"
              options={[
                { value: 'cash', label: 'Tiền mặt' },
                { value: 'bank_transfer', label: 'Chuyển khoản' },
              ]}
              value={paymentMethod}
              onChange={(value) => onPaymentMethodChange(value as 'cash' | 'bank_transfer')}
            />
            {paymentMethod === 'bank_transfer' ? (
              <ManagementDropdownField
                label="Số tài khoản"
                menuLabel="Chọn số tài khoản"
                options={accountOptions.map((account) => ({
                  value: account.id,
                  label: financeAccountChoiceLabel(account),
                }))}
                value={form.financeAccountId}
                onChange={(financeAccountId) => onFormChange({ ...form, financeAccountId })}
              />
            ) : null}
            <label className="management-modal-field-wide">
              Tổng tiền {detail.direction === 'in' ? 'thu' : 'chi'}
              <input readOnly value={formatMoney(Math.abs(detail.amount_delta))} />
            </label>
            <label className="management-modal-field-wide">
              Ghi chú
              <input
                placeholder="Ghi chú..."
                value={form.note}
                onChange={(event) => onFormChange({ ...form, note: event.target.value })}
              />
            </label>
          </div>
          {detail.allocations.length > 0 ? (
            <section aria-label="Phân bổ vào hóa đơn" className="finance-cashbook-edit-allocation">
              <label className="management-modal-checkbox-row finance-cashbook-edit-allocation-checkbox">
                <input checked readOnly type="checkbox" />
                <span>Phân bổ vào hóa đơn</span>
              </label>
              <ManagementTableViewport>
                <table aria-label="Phân bổ vào hóa đơn" className="management-table management-detail-table finance-cashbook-edit-allocation-table">
                  <thead>
                    <tr>
                      <th>Mã phiếu</th>
                      <th>Thời gian</th>
                      <th>Giá trị phiếu</th>
                      <th>Đã thu trước</th>
                      <th>Tiền thu/chi</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.allocations.map((allocation) => {
                      const allocationHref = cashbookEditAllocationHref(allocation.order_code)
                      return (
                        <tr key={allocation.order_id || allocation.order_code}>
                          <td>
                            {allocationHref
                              ? <ManagementRecordLink href={allocationHref}>{allocation.order_code}</ManagementRecordLink>
                              : allocation.order_code}
                          </td>
                          <td>{financeDateText(detail.created_at)}</td>
                          <td><MoneyText value={allocation.order_total_amount} /></td>
                          <td><MoneyText value={allocation.collected_before} /></td>
                          <td><MoneyText value={allocation.allocated_amount} /></td>
                          <td>
                            <StatusChip tone={allocation.remaining_after <= 0 ? 'success' : 'warning'}>
                              {allocation.remaining_after <= 0 ? 'Đã thanh toán' : 'Thanh toán 1 phần'}
                            </StatusChip>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ManagementTableViewport>
            </section>
          ) : null}
          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>Bỏ qua</button>
            <button className="button button-primary" disabled={saving || !form.financeAccountId} type="submit">Lưu</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
