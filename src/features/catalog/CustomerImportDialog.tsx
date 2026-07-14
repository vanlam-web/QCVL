import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { CatalogService } from './catalog-service'
import type { KiotVietCustomerImportPreview } from './types'

export function CustomerImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<CatalogService, 'previewKiotVietCustomerImport' | 'importKiotVietCustomers' | 'deleteImportedKiotVietCustomers'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietCustomerImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Hợp lệ', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Tạo mới', value: `${preview.summary.create_rows} tạo mới` },
    { label: 'Cập nhật', value: `${preview.summary.update_rows} cập nhật` },
    { label: 'Lỗi', value: `${preview.summary.invalid_rows} dòng lỗi` },
    { label: 'Nhóm khách', value: `${preview.summary.group_rows} nhóm khách` },
    { label: 'Nợ KV', value: formatMoney(preview.summary.kiotviet_debt_total) },
    { label: 'Tổng bán KV', value: formatMoney(preview.summary.kiotviet_total_sales) },
  ] : []

  const notes = preview ? (
    <>
      <p>Import dùng mã khách hàng làm khóa; tên khách được phép trùng giống KiotViet.</p>
      {preview.summary.ignored_columns.length > 0 ? <p>Bỏ qua: {preview.summary.ignored_columns.join(', ')}</p> : null}
      <p>Nợ KV và tổng bán KV chỉ là số tham chiếu, không phải công nợ chính của QCVL.</p>
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      setPreview(await service.previewKiotVietCustomerImport({ file }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file khách hàng KiotViet.'))
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
      await service.importKiotVietCustomers({ file })
      onImported()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được khách hàng KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietCustomers()
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
      title="Import khách hàng KiotViet"
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Khách hàng?"
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
