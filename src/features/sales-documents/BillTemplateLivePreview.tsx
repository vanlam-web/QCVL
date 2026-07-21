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
        {settings.logo_data_url ? (
          <img alt="" className="bill-shop-preview-logo" src={settings.logo_data_url} />
        ) : null}
        <strong>{settings.shop_name.trim() || '—'}</strong>
        {settings.shop_address.trim() ? <p>{settings.shop_address}</p> : <p className="is-muted">Chưa có địa chỉ</p>}
        {settings.shop_phone.trim() ? <p>ĐT: {settings.shop_phone}</p> : <p className="is-muted">Chưa có điện thoại</p>}
        <div aria-hidden="true" className="bill-shop-preview-rule" />
        <p className="bill-template-live-title">{template.title}</p>
        <p className="bill-template-live-meta">KH: Công ty mẫu · NV: Admin</p>
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
        <p className="bill-template-live-footer">{footer}</p>
      </div>
    </aside>
  )
}
