import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export interface KiotVietImportSummaryItem {
  label: string
  value: ReactNode
}

export function KiotVietImportDialog({
  open,
  title,
  fileSectionLabel = 'File import',
  previewSectionLabel = 'Kết quả xem trước',
  warning,
  file,
  loading,
  canImport,
  preview,
  error,
  deleteOldDataLabel = 'Xóa dữ liệu cũ',
  deleteOldDataNotice,
  summaryItems,
  notes,
  onDeleteOldData,
  onFileChange,
  onPreview,
  onImport,
  onClose,
}: {
  open: boolean
  title: string
  fileSectionLabel?: string
  previewSectionLabel?: string
  warning?: ReactNode
  file: File | null
  loading: boolean
  canImport: boolean
  preview: boolean
  error: string | null
  deleteOldDataLabel?: string
  deleteOldDataNotice?: ReactNode
  summaryItems: KiotVietImportSummaryItem[]
  notes?: ReactNode
  onDeleteOldData?: () => void
  onFileChange: (file: File | null) => void
  onPreview: () => void
  onImport: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="management-modal-backdrop">
      <section aria-label={title} aria-modal="true" className="management-modal-dialog" role="dialog">
        <header className="management-modal-header">
          <h2>{title}</h2>
          <button aria-label="Đóng" className="management-icon-button" type="button" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="catalog-create-form">
          <section aria-label={fileSectionLabel} className="catalog-create-section">
            {warning ? <p>{warning}</p> : null}
            <div className="catalog-create-grid">
              <label>
                File KiotViet
                <input
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  type="file"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                />
              </label>
              {onDeleteOldData ? (
                <button className="button button-secondary" disabled={loading} type="button" onClick={onDeleteOldData}>
                  {deleteOldDataLabel}
                </button>
              ) : null}
            </div>
          </section>

          {error ? <p role="alert">{error}</p> : null}
          {deleteOldDataNotice ? <p role="status">{deleteOldDataNotice}</p> : null}

          {preview ? (
            <section aria-label={previewSectionLabel} className="catalog-create-section">
              <dl className="management-detail-summary-box">
                {summaryItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
              {notes}
            </section>
          ) : null}

          <footer className="management-modal-footer">
            <button className="button button-secondary" type="button" onClick={onClose}>Bỏ qua</button>
            <button className="button button-secondary" disabled={!file || loading} type="button" onClick={onPreview}>
              Xem trước
            </button>
            <button
              className="button button-primary"
              disabled={!file || !canImport || loading}
              type="button"
              onClick={onImport}
            >
              Import
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}
