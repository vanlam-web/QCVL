import { Banknote } from 'lucide-react'
import { ManagementDetailSection } from '../../components/ui-shell/management-layout'
import { financeAccountChoiceLabel } from '../finance/finance-presenter'
import { money } from './purchase-receipt-presenter'
import type { PurchaseReceiptFinanceAccount } from './purchase-receipt-types'

export function PurchaseReceiptSupplierPaymentForm({
  receiptCode,
  outstandingAmount,
  amount,
  method,
  financeAccountId,
  bankAccounts,
  saving,
  onAmountChange,
  onMethodChange,
  onFinanceAccountChange,
  onSave,
}: {
  receiptCode: string
  outstandingAmount: number
  amount: number
  method: 'cash' | 'bank_transfer'
  financeAccountId: string
  bankAccounts: PurchaseReceiptFinanceAccount[]
  saving: boolean
  onAmountChange: (amount: number) => void
  onMethodChange: (method: 'cash' | 'bank_transfer') => void
  onFinanceAccountChange: (accountId: string) => void
  onSave: () => void
}) {
  return (
    <ManagementDetailSection ariaLabel="Thanh toán nhà cung cấp">
      <section role="form" aria-label="Thanh toán nhà cung cấp" className="receipt-payment-box">
        <h3>Thanh toán NCC</h3>
        <p>{receiptCode}</p>
        <p>Còn nợ: {money(outstandingAmount)}</p>
        <label>
          Số tiền trả cho {receiptCode}
          <input
            min="0"
            max={outstandingAmount}
            step="1000"
            type="number"
            value={amount}
            onChange={(event) => onAmountChange(Number(event.target.value))}
          />
        </label>
        <label>
          Phương thức trả NCC
          <select
            value={method}
            onChange={(event) => onMethodChange(event.target.value as 'cash' | 'bank_transfer')}
          >
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
          </select>
        </label>
        {method === 'bank_transfer' ? (
          <label>
            Tài khoản chuyển khoản NCC
            <select
              value={financeAccountId}
              onChange={(event) => onFinanceAccountChange(event.target.value)}
            >
              <option value="">Chọn tài khoản</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {financeAccountChoiceLabel(account)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="button button-primary" disabled={saving} type="button" onClick={onSave}>
          <Banknote aria-hidden="true" size={16} />
          Lưu thanh toán NCC
        </button>
      </section>
    </ManagementDetailSection>
  )
}
