import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { PurchaseReceiptService } from './purchase-receipt-service'
import type { KiotVietPurchaseReceiptImportPreview } from './purchase-receipt-types'

export function PurchaseReceiptImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<PurchaseReceiptService, 'previewKiotVietPurchaseReceiptImport' | 'importKiotVietPurchaseReceipts' | 'deleteImportedKiotVietPurchaseReceipts'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietPurchaseReceiptImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const hasReferenceErrors = Boolean(preview && (preview.missing_supplier_codes.length > 0 || preview.missing_product_codes.length > 0))
  const referenceErrorMessage = preview && hasReferenceErrors
    ? `Chưa thể import vì còn thiếu ${preview.missing_supplier_codes.length} mã NCC và ${preview.missing_product_codes.length} mã hàng.`
    : null
  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Dòng chi tiết', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Phiếu nhập', value: `${preview.summary.receipt_count} phiếu` },
    { label: 'Tạo mới', value: `${preview.summary.create_rows} tạo mới` },
    { label: 'Cập nhật', value: `${preview.summary.update_rows} cập nhật` },
    { label: 'Thiếu NCC', value: `${preview.summary.missing_supplier_count} mã` },
    { label: 'Thiếu hàng', value: `${preview.summary.missing_product_count} mã` },
    { label: 'Cần trả', value: formatMoney(preview.summary.payable_total) },
    { label: 'Đã trả', value: formatMoney(preview.summary.paid_total) },
  ] : []

  const notes = preview ? (
    <>
      {referenceErrorMessage ? <p role="alert">{referenceErrorMessage}</p> : null}
      {preview.missing_supplier_codes.length > 0 ? <p>Mã NCC chưa khớp: {preview.missing_supplier_codes.join(', ')}</p> : null}
      {preview.missing_product_codes.length > 0 ? <p>Mã hàng chưa khớp: {preview.missing_product_codes.join(', ')}</p> : null}
      <p>Import phiếu nhập KiotViet dùng mã phiếu nhập làm khóa. Phiếu đã nhập hàng sẽ là nguồn tăng tồn cho QCVL.</p>
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      setPreview(await service.previewKiotVietPurchaseReceiptImport({ file }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file nhập hàng KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function importFile() {
    if (!file || !preview || preview.invalid_rows.length > 0 || hasReferenceErrors) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      await service.importKiotVietPurchaseReceipts({ file })
      onImported()
      onClose()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được nhập hàng KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietPurchaseReceipts()
      setPreview(null)
      setDeleteNotice(`Đã xóa ${result.deleted_rows} dòng dữ liệu cũ.${result.blocked_rows > 0 ? ` ${result.blocked_rows} dòng đang được dùng nên chưa xóa.` : ''}`)
      ;(onOldDataDeleted ?? onImported)()
    } catch (cause) {
      setError(formatApiError(cause, 'Không xóa được dữ liệu import cũ.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KiotVietImportDialog
      deleteOldDataNotice={deleteNotice}
      error={error}
      file={file}
      fileSectionLabel="File import nhập hàng"
      loading={loading}
      notes={notes}
      open={open}
      preview={Boolean(preview)}
      previewSectionLabel="Kết quả xem trước nhập hàng"
      summaryItems={summaryItems}
      title="Import nhập hàng KiotViet"
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0 && !hasReferenceErrors)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Nhập hàng?"
      onClose={onClose}
      onDeleteOldData={() => void deleteOldData()}
      onFileChange={(nextFile) => {
        setFile(nextFile)
        setPreview(null)
        setError(null)
        setDeleteNotice(null)
      }}
      onImport={() => void importFile()}
      onPreview={() => void previewFile()}
    />
  )
}
