import {
  billDocumentTypeLabel,
  billTemplateLabel,
  invoiceFooterText,
  quoteFooterText,
  type BillPrintTemplate,
  type OrganizationBillSettings,
} from './bill-settings'

export function BillTemplateLivePreview({
  settings,
  template,
}: {
  settings: Pick<OrganizationBillSettings, 'shop_name' | 'shop_address' | 'shop_phone' | 'logo_data_url'>
  template: BillPrintTemplate
}) {
  const footer = template.document_type === 'quote'
    ? quoteFooterText(template)
    : invoiceFooterText(template)

  return (
    <aside aria-label="Xem trước mẫu in" className="bill-template-live-preview">
      <p className="bill-shop-preview-label">
        Xem trước · {billDocumentTypeLabel(template.document_type)} · {billTemplateLabel(template.paper_size)}
      </p>
      <div className={`bill-template-live-sheet is-${template.paper_size}`}>
        {template.show_logo && settings.logo_data_url ? (
          <img alt="" className="bill-shop-preview-logo" src={settings.logo_data_url} />
        ) : null}
        <strong>{settings.shop_name.trim() || '—'}</strong>
        {template.show_shop_address ? (
          settings.shop_address.trim() ? <p>{settings.shop_address}</p> : <p className="is-muted">Chưa có địa chỉ</p>
        ) : null}
        {template.show_shop_phone ? (
          settings.shop_phone.trim() ? <p>ĐT: {settings.shop_phone}</p> : <p className="is-muted">Chưa có điện thoại</p>
        ) : null}
        {template.header_note.trim() ? <p className="bill-template-live-promo">{template.header_note}</p> : null}
        <div aria-hidden="true" className="bill-shop-preview-rule" />
        <p className="bill-template-live-title">{template.title}</p>
        <p className="bill-template-live-meta">
          KH: Công ty mẫu
          {template.show_customer_phone ? ' · 0909…' : ''}
          {template.show_seller ? ' · NV: Admin' : ''}
          {template.show_price_list ? ' · BG chung' : ''}
        </p>
        <table className="bill-template-live-lines">
          <thead>
            <tr>
              <th>STT</th>
              {template.show_product_code ? <th>Mã</th> : null}
              <th>Nội dung</th>
              {template.show_unit ? <th>ĐVT</th> : null}
              <th>SL</th>
              {template.show_discount ? <th>CK</th> : null}
              <th>TT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              {template.show_product_code ? <td>DECAL</td> : null}
              <td>Decal PP</td>
              {template.show_unit ? <td>m²</td> : null}
              <td>2</td>
              {template.show_discount ? <td>0</td> : null}
              <td>200.000</td>
            </tr>
          </tbody>
        </table>
        <p className="bill-template-live-total">Tổng: 200.000</p>
        {template.document_type === 'invoice' && template.show_payment_summary ? (
          <p className="bill-template-live-meta">Đã trả: 200.000 · Còn nợ: 0</p>
        ) : null}
        {template.show_notes ? <p className="bill-template-live-meta">Ghi chú: Giao trong ngày</p> : null}
        {template.show_signatures ? (
          <div className="bill-template-live-signatures" aria-hidden="true">
            <span>Người bán</span>
            <span>Khách hàng</span>
          </div>
        ) : null}
        <p className="bill-template-live-footer">{footer}</p>
      </div>
    </aside>
  )
}
