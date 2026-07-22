import { displayPriceListName } from '../../lib/price-list-display'
import { vietnameseMoneyInWords } from '../../lib/money-words-vi'
import { buildVietQrImageUrl, displayVietnamBankLabel } from '../../lib/vietqr'
import type { BillPrintTemplate, OrganizationBillSettings } from './bill-settings'
import { formatBillPlaceDate, invoiceFooterText, quoteFooterText } from './bill-settings'
import type { SalesDocumentDetail } from './types'
import {
  salesDocumentLineDimensionText,
  salesDocumentMeasureText,
  salesDocumentMoneyText,
  salesDocumentQuoteLineDimensionText,
} from './sales-document-presenter'

export type BillPrintBankAccount = {
  bankName: string
  accountNumber: string
  accountHolder: string | null
}

export function BillPrintSheet({
  document,
  settings,
  printContent,
  bankAccount = null,
}: {
  document: SalesDocumentDetail
  settings: Pick<
    OrganizationBillSettings,
    'shop_name' | 'shop_address' | 'shop_phone' | 'logo_data_url' | 'print_place'
  >
  printContent: BillPrintTemplate
  bankAccount?: BillPrintBankAccount | null
}) {
  const isQuote = document.order_type === 'quote'
  const remainingDebt = Math.max(0, document.total_amount - document.paid_amount)
  const surplus = Math.max(0, document.paid_amount - document.total_amount)
  // Nợ khách hiện tại từ master (không đổi công thức sổ nợ). Nợ cũ ≈ tổng nợ − còn lại chứng từ này.
  const customerDebt = typeof document.customer.total_debt_amount === 'number'
    ? Math.max(0, document.customer.total_debt_amount)
    : null
  const oldDebt = customerDebt !== null ? Math.max(0, customerDebt - remainingDebt) : null
  const totalDebt = customerDebt !== null ? customerDebt : remainingDebt > 0 ? remainingDebt : null
  const amountInWords = vietnameseMoneyInWords(
    isQuote ? document.total_amount : (totalDebt ?? (remainingDebt || document.total_amount)),
  )
  const footer = isQuote ? quoteFooterText(printContent) : invoiceFooterText(printContent)
  const bankLabel = bankAccount ? displayVietnamBankLabel(bankAccount.bankName) : ''
  const qrUrl = bankAccount
    ? buildVietQrImageUrl({
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountHolder: bankAccount.accountHolder,
        amount: remainingDebt > 0 ? remainingDebt : document.total_amount,
        description: document.code,
      })
    : null
  const placeDate = formatBillPlaceDate(document.created_at, settings.print_place)

  return (
    <article
      className="quote-print-page bill-print-sheet"
      aria-label={isQuote ? `Báo giá ${document.code}` : `Hóa đơn ${document.code}`}
    >
      <header className="bill-print-header">
        <div className="bill-print-shop">
          {printContent.show_logo && settings.logo_data_url ? (
            <img alt="" className="quote-print-logo bill-print-logo" src={settings.logo_data_url} />
          ) : null}
          <div className="bill-print-shop-text">
            <strong>{settings.shop_name}</strong>
            {printContent.show_shop_address && settings.shop_address ? (
              <p>Địa chỉ: {settings.shop_address}</p>
            ) : null}
            {printContent.show_shop_phone && settings.shop_phone ? (
              <p>Điện thoại: {settings.shop_phone}</p>
            ) : null}
          </div>
        </div>
        <div className="bill-print-title-block">
          <h1>{printContent.title}</h1>
          <p className="bill-print-doc-code">
            {isQuote ? 'Số báo giá' : 'Số hóa đơn'}: {document.code}
          </p>
          {printContent.header_note.trim() ? (
            <p className="quote-print-promo">{printContent.header_note}</p>
          ) : null}
        </div>
      </header>

      <section className="bill-print-customer" aria-label={isQuote ? 'Thông tin báo giá' : 'Thông tin hóa đơn'}>
        <p>
          <span>Kính gửi:</span> {document.customer.name}
        </p>
        <p>
          <span>Địa chỉ:</span> {document.customer.address?.trim() || '—'}
        </p>
        {printContent.show_customer_phone ? (
          <p>
            <span>SĐT:</span> {document.customer.phone?.trim() || ''}
          </p>
        ) : null}
        {printContent.show_seller || printContent.show_price_list ? (
          <p className="bill-print-customer-meta">
            {printContent.show_seller ? <>NV: {document.seller.name}</> : null}
            {printContent.show_seller && printContent.show_price_list ? ' · ' : null}
            {printContent.show_price_list ? <>Bảng giá: {displayPriceListName(document.price_list)}</> : null}
          </p>
        ) : null}
      </section>

      <table
        aria-label={isQuote ? 'Dòng hàng báo giá' : 'Dòng hàng hóa đơn'}
        className="quote-print-lines bill-print-lines"
      >
        <thead>
          <tr>
            <th>STT</th>
            {printContent.show_product_code ? <th>Mã hàng</th> : null}
            <th>Tên hàng</th>
            <th>Nội dung</th>
            {printContent.show_unit ? <th>ĐVT</th> : null}
            <th>Số lượng</th>
            <th>Đơn giá</th>
            {printContent.show_discount ? <th>CK</th> : null}
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {document.items.map((item) => {
            const dimension = isQuote
              ? salesDocumentQuoteLineDimensionText(item)
              : salesDocumentLineDimensionText(item)
            const content = [dimension, item.note].filter(Boolean).join(' · ')
            return (
              <tr key={item.id}>
                <td>{item.line_no}</td>
                {printContent.show_product_code ? <td>{item.product.code}</td> : null}
                <td>{item.product.name}</td>
                <td>{content}</td>
                {printContent.show_unit ? <td>{item.product.unit_name}</td> : null}
                <td>{salesDocumentMeasureText(item.quantity)}</td>
                <td>{salesDocumentMoneyText(item.unit_price)}</td>
                {printContent.show_discount ? (
                  <td>{item.discount_amount > 0 ? salesDocumentMoneyText(item.discount_amount) : ''}</td>
                ) : null}
                <td>{salesDocumentMoneyText(item.line_total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <section className="bill-print-summary" aria-label={isQuote ? 'Tổng báo giá' : 'Tổng hóa đơn'}>
        {bankAccount && (qrUrl || bankAccount.accountNumber) ? (
          <div className="bill-print-payment">
            {qrUrl ? <img alt="QR chuyển khoản" className="bill-print-qr" src={qrUrl} /> : null}
            <p>
              <strong>{bankLabel || bankAccount.bankName}:</strong> {bankAccount.accountNumber}
            </p>
            {bankAccount.accountHolder ? <p>{bankAccount.accountHolder}</p> : null}
          </div>
        ) : <div />}

        <dl className="bill-print-totals">
          <div>
            <dt>Tổng toa</dt>
            <dd>{salesDocumentMoneyText(document.subtotal_amount)}</dd>
          </div>
          {!isQuote && oldDebt !== null ? (
            <div>
              <dt>Nợ cũ</dt>
              <dd>{salesDocumentMoneyText(oldDebt)}</dd>
            </div>
          ) : null}
          {!isQuote && totalDebt !== null ? (
            <div>
              <dt>Tổng nợ</dt>
              <dd>{salesDocumentMoneyText(totalDebt)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Giảm giá</dt>
            <dd>{salesDocumentMoneyText(document.discount_amount)}</dd>
          </div>
          {isQuote ? (
            <div>
              <dt>Tổng báo giá</dt>
              <dd>{salesDocumentMoneyText(document.total_amount)}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Khách hàng thanh toán</dt>
                <dd>{salesDocumentMoneyText(document.paid_amount)}</dd>
              </div>
              {printContent.show_payment_summary ? (
                <>
                  <div>
                    <dt>Còn lại</dt>
                    <dd>{salesDocumentMoneyText(remainingDebt)}</dd>
                  </div>
                  {surplus > 0 ? (
                    <div>
                      <dt>Tiền thừa</dt>
                      <dd>{salesDocumentMoneyText(surplus)}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </dl>
      </section>

      <p className="bill-print-words">
        Tổng thanh toán bằng chữ: {amountInWords}
      </p>

      {printContent.show_notes ? (
        <p className="bill-print-note">
          Ghi chú: {document.note?.trim() || footer}
        </p>
      ) : (
        <p className="bill-print-note">{footer}</p>
      )}

      <footer className="bill-print-footer">
        {placeDate ? <p className="bill-print-place-date">{placeDate}</p> : null}
        {printContent.show_signatures ? (
          <div className="quote-print-signatures bill-print-signatures">
            <div>
              <p>Người bán</p>
              <strong>{document.seller.name}</strong>
            </div>
            <div>
              <p>Khách hàng</p>
              <span />
            </div>
          </div>
        ) : printContent.show_seller ? (
          <p className="bill-print-seller-name">{document.seller.name}</p>
        ) : null}
      </footer>
    </article>
  )
}
