import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { SupplierService } from './supplier-service'
import type { KiotVietSupplierImportPreview } from './types'

export function SupplierImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<SupplierService, 'previewKiotVietSupplierImport' | 'importKiotVietSuppliers' | 'deleteImportedKiotVietSuppliers'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietSupplierImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Hợp lệ', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Tạo mới', value: `${preview.summary.create_rows} tạo mới` },
    { label: 'Cập nhật', value: `${preview.summary.update_rows} cập nhật` },
    { label: 'Lỗi', value: `${preview.summary.invalid_rows} dòng lỗi` },
    { label: 'Nợ KV', value: formatMoney(preview.summary.kiotviet_payable_total) },
    { label: 'Tổng mua KV', value: formatMoney(preview.summary.kiotviet_total_purchase) },
  ] : []

  const notes = preview ? (
    <>
      <p>Import dùng mã nhà cung cấp làm khóa; tổng mua và nợ KV là số tham chiếu trước khi phiếu nhập QCVL đầy đủ.</p>
      {preview.summary.ignored_columns.length > 0 ? <p>Bỏ qua: {preview.summary.ignored_columns.join(', ')}</p> : null}
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      setPreview(await service.previewKiotVietSupplierImport({ file }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file nhà cung cấp KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function importFile() {
    if (!file || !preview || preview.invalid_rows.length > 0) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      await service.importKiotVietSuppliers({ file })
      onImported()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được nhà cung cấp KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietSuppliers()
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
      loading={loading}
      notes={notes}
      open={open}
      preview={Boolean(preview)}
      summaryItems={summaryItems}
      title="Import nhà cung cấp KiotViet"
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Nhà cung cấp?"
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
