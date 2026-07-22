import { WalletCards } from 'lucide-react'
import { formatQcvDateTime } from '../../lib/date-format'
import { ManagementDetailInlineNote, ManagementDetailSection } from '../../components/ui-shell/management-layout'
import { ManagementRecordLink, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { supplierPaymentMethodText, supplierPaymentStatusText } from './purchase-receipt-presenter'
import type { PurchaseReceiptSupplierPayment } from './purchase-receipt-types'

export function PurchaseReceiptPaymentHistory({
  payments,
  outstandingAmount,
  onPay,
}: {
  payments: PurchaseReceiptSupplierPayment[]
  outstandingAmount: number
  onPay: () => void
}) {
  return (
    <ManagementDetailSection ariaLabel="Lịch sử thanh toán NCC">
      {payments.length === 0 ? (
        <ManagementDetailInlineNote>Chưa có thanh toán NCC sau nhập.</ManagementDetailInlineNote>
      ) : (
        <table className="management-detail-table management-detail-linked-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Thời gian</th>
              <th>Người tạo</th>
              <th>Phương thức</th>
              <th>Trạng thái</th>
              <th>Tiền chi</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <ManagementRecordLink href={managementRecordOpenHref('/finance', payment.code)}>
                    {payment.code}
                  </ManagementRecordLink>
                </td>
                <td>{formatQcvDateTime(payment.paid_at)}</td>
                <td>{payment.created_by}</td>
                <td>{supplierPaymentMethodText(payment.payment_method)}</td>
                <td>
                  <StatusChip tone={payment.status === 'posted' ? 'success' : 'neutral'}>
                    {supplierPaymentStatusText(payment.status)}
                  </StatusChip>
                </td>
                <td><MoneyText value={payment.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {outstandingAmount > 0 ? (
        <button className="button button-primary" type="button" onClick={onPay}>
          <WalletCards aria-hidden="true" size={16} />
          Thanh toán NCC
        </button>
      ) : null}
    </ManagementDetailSection>
  )
}
