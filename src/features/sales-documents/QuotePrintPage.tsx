import { useEffect, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import type { SalesDocumentService } from './sales-document-service'
import type { SalesDocumentDetail } from './types'
import {
  salesDocumentMeasureText,
  salesDocumentMoneyText,
  salesDocumentQuoteDateText,
  salesDocumentQuoteLineDimensionText,
} from './sales-document-presenter'

export function QuotePrintPage({
  documentId,
  service,
  onClose,
}: {
  documentId: string
  service: SalesDocumentService
  onClose: () => void
}) {
  const [document, setDocument] = useState<SalesDocumentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadDocument() {
      setError(null)
      try {
        const result = await service.getSalesDocument(documentId)
        if (!active) return
        setDocument(result)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được báo giá.'))
      }
    }

    void loadDocument()

    return () => {
      active = false
    }
  }, [documentId, service])

  if (error) {
    return (
      <main className="quote-print-shell">
        <p role="alert">{error}</p>
        <button className="quote-print-control" type="button" onClick={onClose}>
          Đóng
        </button>
      </main>
    )
  }

  if (!document) {
    return (
      <main className="quote-print-shell">
        <p>Đang tải báo giá...</p>
      </main>
    )
  }

  if (document.order_type !== 'quote' || !document.code.startsWith('BG')) {
    return (
      <main className="quote-print-shell">
        <p role="alert">Chỉ in báo giá BG... trong màn này</p>
        <button className="quote-print-control" type="button" onClick={onClose}>
          Đóng
        </button>
      </main>
    )
  }

  return (
    <main className="quote-print-shell">
      <div className="quote-print-toolbar">
        <button type="button" onClick={() => window.print()}>
          In
        </button>
        <button type="button" onClick={onClose}>
          Đóng
        </button>
      </div>

      <article className="quote-print-page" aria-label={`Báo giá ${document.code}`}>
        <header className="quote-print-heading">
          <div>
            <strong>QCVL</strong>
            <p>Xưởng in và thi công quảng cáo</p>
          </div>
          <div>
            <h1>BÁO GIÁ</h1>
            <dl>
              <div>
                <dt>Mã</dt>
                <dd>{document.code}</dd>
              </div>
              <div>
                <dt>Ngày</dt>
                <dd>{salesDocumentQuoteDateText(document.created_at)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="quote-print-parties" aria-label="Thông tin báo giá">
          <dl>
            <div>
              <dt>Khách hàng</dt>
              <dd>{document.customer.name}</dd>
            </div>
            <div>
              <dt>Điện thoại</dt>
              <dd>{document.customer.phone ?? '-'}</dd>
            </div>
            <div>
              <dt>Nhân viên</dt>
              <dd>{document.seller.name}</dd>
            </div>
            <div>
              <dt>Bảng giá</dt>
              <dd>{document.price_list?.name ?? '-'}</dd>
            </div>
          </dl>
        </section>

        <table aria-label="Dòng hàng báo giá" className="quote-print-lines">
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã hàng</th>
              <th>Nội dung</th>
              <th>ĐVT</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>CK</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((item) => (
              <tr key={item.id}>
                <td>{item.line_no}</td>
                <td>{item.product.code}</td>
                <td>
                  <strong>{item.product.name}</strong>
                  <p>{salesDocumentQuoteLineDimensionText(item)}</p>
                  {item.note ? <p>{item.note}</p> : null}
                </td>
                <td>{item.product.unit_name}</td>
                <td>{salesDocumentMeasureText(item.quantity)}</td>
                <td>{salesDocumentMoneyText(item.unit_price)}</td>
                <td>{item.discount_amount > 0 ? salesDocumentMoneyText(item.discount_amount) : '-'}</td>
                <td>{salesDocumentMoneyText(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="quote-print-totals" aria-label="Tổng báo giá">
          <dl>
            <div>
              <dt>Tổng tiền hàng</dt>
              <dd>{salesDocumentMoneyText(document.subtotal_amount)}</dd>
            </div>
            <div>
              <dt>Giảm giá</dt>
              <dd>{salesDocumentMoneyText(document.discount_amount)}</dd>
            </div>
            <div>
              <dt>Tổng báo giá</dt>
              <dd>{salesDocumentMoneyText(document.total_amount)}</dd>
            </div>
          </dl>
        </section>

        {document.note ? (
          <section className="quote-print-note" aria-label="Ghi chú">
            <h2>Ghi chú</h2>
            <p>{document.note}</p>
          </section>
        ) : null}

        <p className="quote-print-footnote">Giá trị báo giá chỉ dùng để xác nhận nội dung trước khi bán.</p>
      </article>
    </main>
  )
}

