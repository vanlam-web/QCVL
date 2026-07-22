import { useRef } from 'react'
import { customerDateTime } from '../catalog/customer-presenter'
import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'
import { formatMoney } from '../../lib/number-format'
import { recentInvoicePageSize } from './recent-invoices'

export function RecentInvoicesDialog({
  invoices,
  loading,
  error,
  page,
  total,
  selectingId,
  onClose,
  onPageChange,
  onOpenInvoice,
}: {
  invoices: SalesDocumentListItem[]
  loading: boolean
  error: string | null
  page: number
  total: number
  selectingId: string | null
  onClose: () => void
  onPageChange: (page: number) => void
  onOpenInvoice: (document: SalesDocumentListItem) => void
}) {
  const pageInputRef = useRef<HTMLInputElement | null>(null)
  const submitPage = () => {
    const nextPage = Number(pageInputRef.current?.value ?? page)
    if (!Number.isFinite(nextPage)) {
      if (pageInputRef.current) pageInputRef.current.value = String(page)
      return
    }
    const totalPages = Math.max(1, Math.ceil(total / recentInvoicePageSize))
    const safePage = Math.min(totalPages, Math.max(1, Math.trunc(nextPage)))
    if (pageInputRef.current) pageInputRef.current.value = String(safePage)
    onPageChange(safePage)
  }

  return (
    <div
      className="management-modal-backdrop pos-recent-invoices-backdrop"
      onMouseDown={onClose}
    >
      <section
        aria-label="Lịch sử 10 đơn gần nhất"
        aria-modal="true"
        className="management-modal-dialog pos-recent-invoices-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pos-recent-invoices-header">
          <button
            aria-label="Đóng lịch sử 10 đơn gần nhất"
            className="management-icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {error ? <p role="alert">{error}</p> : null}
        {loading ? (
          <p>Đang tải lịch sử hóa đơn...</p>
        ) : invoices.length === 0 ? (
          <p>Chưa có hóa đơn gần đây.</p>
        ) : (
          <>
            <div className="pos-recent-invoices-table-wrap">
              <table className="pos-recent-invoices-table">
                <thead>
                  <tr>
                    <th scope="col">Mã hóa đơn</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Nhân viên</th>
                    <th scope="col">Khách hàng</th>
                    <th scope="col">Tổng cộng</th>
                    <th scope="col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <a
                          className="pos-recent-invoices-code-link"
                          href={`/sales-documents?open=${document.id}`}
                          onClick={(event) => {
                            event.preventDefault()
                            onOpenInvoice(document)
                          }}
                        >
                          {document.code}
                        </a>
                      </td>
                      <td>{customerDateTime(document.created_at)}</td>
                      <td>{document.seller.name}</td>
                      <td>{document.customer.name}</td>
                      <td>{formatMoney(document.total_amount)}</td>
                      <td>
                        <button
                          aria-label={`Chọn ${document.code}`}
                          className="button button-secondary pos-recent-invoices-select"
                          disabled={selectingId === document.id}
                          type="button"
                          onClick={() => onOpenInvoice(document)}
                        >
                          Chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer aria-label="Phân trang lịch sử hóa đơn" className="management-table-footer pos-recent-invoices-footer" role="navigation">
              <span className="management-table-footer-size" aria-hidden="true" />
              <div className="management-table-footer-actions pos-recent-invoices-footer-actions">
                <button
                  aria-label="Trang trước"
                  disabled={page <= 1}
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                >
                  ‹
                </button>
                <input
                  aria-label="Trang hiện tại"
                  key={page}
                  ref={pageInputRef}
                  inputMode="numeric"
                  defaultValue={String(page)}
                  onBlur={submitPage}
                  onChange={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\d]/g, '') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      submitPage()
                    }
                  }}
                />
                <button
                  aria-label="Trang sau"
                  disabled={page * recentInvoicePageSize >= total}
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                >
                  ›
                </button>
              </div>
              <span className="management-table-footer-summary">
                {total > 0
                  ? `${Math.min((page - 1) * recentInvoicePageSize + 1, total)} - ${Math.min(page * recentInvoicePageSize, total)} trong ${total}`
                  : ''}
              </span>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
