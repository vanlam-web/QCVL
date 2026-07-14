import { useState } from 'react'
import { KiotVietImportDialog, type KiotVietImportSummaryItem } from '../../components/ui-shell/KiotVietImportDialog'
import { formatApiError } from '../../lib/api/error-message'
import { formatMoney } from '../../lib/number-format'
import type { FinanceService } from './finance-service'
import type { KiotVietCashbookImportPreview } from './types'

export function CashbookImportDialog({
  open,
  service,
  onClose,
  onOldDataDeleted,
  onImported,
}: {
  open: boolean
  service: Pick<FinanceService, 'previewKiotVietCashbookImport' | 'importKiotVietCashbook' | 'deleteImportedKiotVietCashbook'>
  onClose: () => void
  onOldDataDeleted?: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<KiotVietCashbookImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  if (!open) return null

  const hasInvalidRows = Boolean(preview && preview.invalid_rows.length > 0)
  const summaryItems: KiotVietImportSummaryItem[] = preview ? [
    { label: 'Dòng hợp lệ', value: `${preview.summary.valid_rows} dòng` },
    { label: 'Tài khoản', value: `${preview.summary.account_count} tài khoản` },
    { label: 'Tiền mặt', value: `${preview.summary.cash_rows} dòng` },
    { label: 'Ngân hàng', value: `${preview.summary.bank_rows} dòng` },
    { label: 'Đã thanh toán', value: `${preview.summary.posted_rows} dòng` },
    { label: 'Đã hủy', value: `${preview.summary.cancelled_rows} dòng` },
    { label: 'Tổng tiền mặt', value: formatMoney(preview.summary.cash_total_delta) },
    { label: 'Tổng ngân hàng', value: formatMoney(preview.summary.bank_total_delta) },
  ] : []

  const notes = preview ? (
    <>
      {hasInvalidRows ? <p role="alert">Chưa thể import vì còn {preview.invalid_rows.length} dòng lỗi.</p> : null}
      <p>Import sổ quỹ KiotViet dùng mã phiếu làm khóa. Tiền mặt vào quỹ mặc định, ngân hàng map theo tên tài khoản và số tài khoản.</p>
    </>
  ) : null

  async function previewFile() {
    if (!file) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      setPreview(await service.previewKiotVietCashbookImport({ file }))
    } catch (cause) {
      setPreview(null)
      setError(formatApiError(cause, 'Không xem trước được file sổ quỹ KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function importFile() {
    if (!file || !preview || hasInvalidRows) return
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      await service.importKiotVietCashbook({ file })
      onImported()
      onClose()
    } catch (cause) {
      setError(formatApiError(cause, 'Không import được sổ quỹ KiotViet.'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteOldData() {
    setLoading(true)
    setError(null)
    setDeleteNotice(null)
    try {
      const result = await service.deleteImportedKiotVietCashbook()
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
      fileSectionLabel="File import sổ quỹ"
      loading={loading}
      notes={notes}
      open={open}
      preview={Boolean(preview)}
      previewSectionLabel="Kết quả xem trước sổ quỹ"
      summaryItems={summaryItems}
      title="Import sổ quỹ KiotViet"
      canImport={Boolean(file && preview && !hasInvalidRows)}
      deleteOldDataConfirmMessage="Xóa toàn bộ dữ liệu cũ của lần import KiotViet trên trang Sổ quỹ?"
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
