import type { OrganizationBillSettings } from './bill-settings'

export function BillShopHeaderPreview({
  shop_name,
  shop_address,
  shop_phone,
}: Pick<OrganizationBillSettings, 'shop_name' | 'shop_address' | 'shop_phone'>) {
  return (
    <aside aria-label="Xem trước đầu bill" className="bill-shop-preview">
      <p className="bill-shop-preview-label">Xem trước đầu bill</p>
      <div className="bill-shop-preview-sheet">
        <strong>{shop_name.trim() || '—'}</strong>
        {shop_address.trim() ? <p>{shop_address}</p> : <p className="is-muted">Chưa có địa chỉ</p>}
        {shop_phone.trim() ? <p>ĐT: {shop_phone}</p> : <p className="is-muted">Chưa có điện thoại</p>}
        <div aria-hidden="true" className="bill-shop-preview-rule" />
        <p className="bill-shop-preview-sample">HÓA ĐƠN BÁN HÀNG</p>
      </div>
    </aside>
  )
}
