import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import type { InventoryService } from './inventory-service'
import type { KiotVietStocktakeImportPreview } from './types'

export function StocktakeImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<InventoryService, 'previewKiotVietStocktakeImport' | 'importKiotVietStocktakes' | 'deleteImportedKiotVietStocktakes'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietStocktakeImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const unmatchedCodeCount = preview
    ? Math.max(preview.summary.deleted_product_code_count, preview.summary.missing_product_count)
    : 0
  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Dòng chi tiết', value: `${preview.summary.valid_rows} dòng hợp lệ` },
    { label: 'Phiếu kiểm', value: `${preview.summary.stocktake_count} phiếu kiểm` },
    { label: 'Mã hàng', value: `${preview.summary.product_code_count} mã hàng` },
    { label: 'Khớp hàng hóa', value: `${preview.summary.matched_product_count} mã khớp` },
    { label: 'Chưa khớp', value: `${unmatchedCodeCount} mã thiếu/xóa` },
    { label: 'Lỗi công thức', value: `${preview.summary.formula_error_count} dòng lỗi công thức` },
  ] : []

  const notes = preview ? (
    <>
      {preview.missing_product_codes.length > 0 ? <p>Mã chưa khớp: {preview.missing_product_codes.join(', ')}</p> : null}
      <p>Import kiểm kho chỉ lưu lịch sử đối soát. Không ghi tồn vận hành và không tạo thẻ kho QCVL.</p>
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await service.previewKiotVietStocktakeImport({ file, cleanup_demo: false }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Khong xem truoc duoc file kiem kho KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function importFile() {
    if (!file || !preview || preview.invalid_rows.length > 0) return
    setLoading(true)
    setError(null)
    try {
      await service.importKiotVietStocktakes({ file, cleanup_demo: false })
      onImported()
      onClose()
    } catch (cause) {
      setError(formatApiError(cause, 'Khong import duoc lich su kiem kho KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    if (!window.confirm('Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang này?')) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietStocktakes()
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
      fileSectionLabel="File import kiểm kho"
      loading={loading}
      notes={notes}
      open={open}
      preview={Boolean(preview)}
      previewSectionLabel="Kết quả xem trước kiểm kho"
      summaryItems={summaryItems}
      title="Import kiểm kho KiotViet"
      warning="File kiểm kho KiotViet chỉ nhập lịch sử đối soát. Không ghi tồn vận hành và không tạo thẻ kho QCVL."
      canImport={Boolean(file && preview && preview.invalid_rows.length === 0)}
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
