import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { SalesDocumentService } from './sales-document-service'
import type { KiotVietInvoiceImportPreview } from './types'

export function SalesDocumentImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<SalesDocumentService, 'previewKiotVietInvoiceImport' | 'importKiotVietInvoices' | 'deleteImportedKiotVietInvoices'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietInvoiceImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const hasReferenceErrors = Boolean(preview && (preview.missing_customer_codes.length > 0 || preview.missing_product_codes.length > 0))
  const referenceErrorMessage = preview && hasReferenceErrors
    ? `Chưa thể import vì còn thiếu ${preview.missing_customer_codes.length} mã khách và ${preview.missing_product_codes.length} mã hàng.`
    : null
  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Dòng chi tiết', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Hóa đơn', value: `${preview.summary.invoice_count} hóa đơn` },
    { label: 'Tạo mới', value: `${preview.summary.create_rows} tạo mới` },
    { label: 'Cập nhật', value: `${preview.summary.update_rows} cập nhật` },
    { label: 'Thiếu khách', value: `${preview.summary.missing_customer_count} mã` },
    { label: 'Thiếu hàng', value: `${preview.summary.missing_product_count} mã` },
    { label: 'Khách cần trả', value: formatMoney(preview.summary.total_amount) },
    { label: 'Đã trả', value: formatMoney(preview.summary.paid_total) },
  ] : []
  const notes = preview ? (
    <>
      {referenceErrorMessage ? <p role="alert">{referenceErrorMessage}</p> : null}
      {preview.missing_customer_codes.length > 0 ? <p>Mã khách chưa khớp: {preview.missing_customer_codes.join(', ')}</p> : null}
      {preview.missing_product_codes.length > 0 ? <p>Mã hàng chưa khớp: {preview.missing_product_codes.join(', ')}</p> : null}
      <p>Import hóa đơn KiotViet dùng mã hóa đơn làm khóa. Hóa đơn hoàn tất sẽ là nguồn trừ tồn cho QCVL.</p>
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      setPreview(await service.previewKiotVietInvoiceImport({ file }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file hóa đơn KiotViet.'))
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
      await service.importKiotVietInvoices({ file })
      onImported()
      onClose()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được hóa đơn KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietInvoices()
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
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0 && !hasReferenceErrors)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Hóa đơn?"
      deleteOldDataLabel="Xóa dữ liệu cũ"
      deleteOldDataNotice={deleteNotice}
      error={error}
      file={file}
      fileSectionLabel="File import hóa đơn"
      loading={loading}
      notes={notes}
      open={open}
      preview={Boolean(preview)}
      previewSectionLabel="Kết quả xem trước hóa đơn"
      summaryItems={summaryItems}
      title="Import hóa đơn KiotViet"
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
