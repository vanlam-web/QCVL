import type { OrganizationBillSettings } from './bill-settings'

export function BillShopHeaderPreview({
  shop_name,
  shop_address,
  shop_phone,
  logo_data_url,
  title = 'HÓA ĐƠN BÁN HÀNG',
}: Pick<OrganizationBillSettings, 'shop_name' | 'shop_address' | 'shop_phone' | 'logo_data_url'> & {
  title?: string
}) {
  return (
    <aside aria-label="Xem trước đầu bill" className="bill-shop-preview">
      <p className="bill-shop-preview-label">Xem trước đầu bill</p>
      <div className="bill-shop-preview-sheet">
        {logo_data_url ? (
          <img alt="" className="bill-shop-preview-logo" src={logo_data_url} />
        ) : null}
        <strong>{shop_name.trim() || '—'}</strong>
        {shop_address.trim() ? <p>{shop_address}</p> : <p className="is-muted">Chưa có địa chỉ</p>}
        {shop_phone.trim() ? <p>ĐT: {shop_phone}</p> : <p className="is-muted">Chưa có điện thoại</p>}
        <div aria-hidden="true" className="bill-shop-preview-rule" />
        <p className="bill-shop-preview-sample">{title}</p>
      </div>
    </aside>
  )
}
