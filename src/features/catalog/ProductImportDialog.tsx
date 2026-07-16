import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { displayPriceListName } from '../../lib/price-list-display'
import type { CatalogService } from './catalog-service'
import type { KiotVietProductImportPreview } from './types'

export function ProductImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
  title = 'Import hàng hóa KiotViet',
}: {
  open: boolean
  service: Pick<CatalogService, 'previewKiotVietProductImport' | 'importKiotVietProducts' | 'deleteImportedKiotVietProducts'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
  title?: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietProductImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Hợp lệ', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Tạo mới', value: `${preview.summary.create_rows} tạo mới` },
    { label: 'Cập nhật', value: `${preview.summary.update_rows} cập nhật` },
    { label: 'Lỗi', value: `${preview.summary.invalid_rows} dòng lỗi` },
    { label: 'Đơn vị', value: `${preview.summary.unit_review_rows} cần sửa` },
    { label: 'Giá bán', value: `${preview.summary.price_rows ?? 0} dòng giá bán` },
    { label: 'Tồn tạm', value: `${preview.summary.provisional_stock_rows ?? 0} dòng tồn tạm` },
    { label: 'BOM nháp', value: `${preview.summary.bom_rows ?? 0} dòng BOM nháp` },
    { label: 'Bảng giá', value: preview.summary.price_list_name ? displayPriceListName({ name: preview.summary.price_list_name }) : 'Chưa có bảng giá mặc định' },
  ] : []

  const notes = preview ? (
    <>
      {preview.summary.unit_review_rows > 0 ? (
        <p>{preview.summary.unit_review_rows} dòng thiếu ĐVT sẽ gán tạm: Cần cập nhật</p>
      ) : null}
      {preview.summary.ignored_columns.length > 0 ? <p>Bỏ qua: {preview.summary.ignored_columns.join(', ')}</p> : null}
      {preview.summary.deferred_columns.length > 0 ? <p>Làm sau: {preview.summary.deferred_columns.join(', ')}</p> : null}
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await service.previewKiotVietProductImport({ file, cleanup_demo: false }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function importFile() {
    if (!file || !preview || preview.invalid_rows.length > 0) return
    setLoading(true)
    setError(null)
    try {
      await service.importKiotVietProducts({ file, cleanup_demo: false })
      onImported()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được hàng hóa KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietProducts()
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
      title={title}
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Hàng hóa?"
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
