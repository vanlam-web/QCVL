import { Copy, ExternalLink, FileOutput, Printer, Save, Trash2, WalletCards } from 'lucide-react'
import { ManagementDetailActionFooter } from '../../components/ui-shell/management-layout'
import type { PurchaseReceipt } from './purchase-receipt-types'

export function PurchaseReceiptActionFooter({
  receipt,
  outstandingAmount,
  hasSupplierPayments,
  canceling,
  onCancel,
  onExport,
  onPay,
  onPrint,
}: {
  receipt: PurchaseReceipt
  outstandingAmount: number
  hasSupplierPayments: boolean
  canceling: boolean
  onCancel: () => void
  onExport: () => void
  onPay: () => void
  onPrint: () => void
}) {
  const canCancel = receipt.status !== 'cancelled' && !hasSupplierPayments
  return (
    <ManagementDetailActionFooter
      leftActions={[
        {
          label: 'Hủy',
          disabled: !canCancel || canceling,
          title: receipt.status === 'cancelled'
            ? 'Phiếu đã hủy'
            : hasSupplierPayments
              ? 'Phiếu đã có thanh toán NCC, không thể hủy trực tiếp'
              : 'Hủy phiếu nhập',
          danger: true,
          icon: <Trash2 aria-hidden="true" size={15} />,
          onClick: onCancel,
        },
        { label: 'Sao chép', disabled: true, title: 'Chưa hỗ trợ sao chép phiếu nhập', icon: <Copy aria-hidden="true" size={15} /> },
        { label: 'Xuất file', icon: <FileOutput aria-hidden="true" size={15} />, onClick: onExport },
        ...(receipt.status !== 'cancelled' && outstandingAmount > 0
          ? [{
              label: 'Thanh toán NCC',
              icon: <WalletCards aria-hidden="true" size={15} />,
              variant: 'primary' as const,
              onClick: onPay,
            }]
          : []),
      ]}
      rightActions={[
        { label: 'Mở phiếu', disabled: true, title: 'Phiếu đang mở trong dòng chi tiết', variant: 'primary' as const, icon: <ExternalLink aria-hidden="true" size={15} /> },
        { label: 'Lưu', disabled: true, title: 'Phiếu đã ghi không chỉnh sửa trực tiếp', icon: <Save aria-hidden="true" size={15} /> },
        { label: 'In', icon: <Printer aria-hidden="true" size={15} />, onClick: onPrint },
      ]}
    />
  )
}
