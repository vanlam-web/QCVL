import type { FormEvent } from 'react'
import type { CustomerGroup } from './types'

export type CustomerCreateForm = {
  code: string
  name: string
  phone: string
  taxCode: string
  address: string
  customerGroupId: string
  customerType: 'individual' | 'company'
  companyName: string
  note: string
}

export function createCustomerFormDefaults(): CustomerCreateForm {
  return {
    code: '',
    name: '',
    phone: '',
    taxCode: '',
    address: '',
    customerGroupId: '',
    customerType: 'individual',
    companyName: '',
    note: '',
  }
}

export function CustomerCreateDialog({
  error,
  form,
  formId = 'customer-create-form',
  groups,
  saving,
  onClose,
  onFormChange,
  onSubmit,
}: {
  error: string | null
  form: CustomerCreateForm
  formId?: string
  groups: CustomerGroup[]
  saving: boolean
  onClose: () => void
  onFormChange: (form: CustomerCreateForm) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="management-modal-backdrop">
      <section aria-label="Tạo khách hàng" aria-modal="true" className="management-modal-dialog" role="dialog">
        <header className="management-modal-header">
          <div>
            <h2>Tạo khách hàng</h2>
          </div>
          <button className="management-icon-button" type="button" aria-label="Đóng tạo khách hàng" onClick={onClose}>
            ×
          </button>
        </header>

        <form id={formId} aria-label="Tạo khách hàng" className="customer-create-form" onSubmit={onSubmit}>
          <fieldset>
            <legend>Thông tin chính</legend>
            <div className="form-grid form-grid-two">
              <label>
                Tên khách hàng
                <input
                  autoFocus
                  required
                  placeholder="Bắt buộc"
                  value={form.name}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                Mã khách hàng
                <input
                  placeholder="Bỏ trống để tự sinh"
                  value={form.code}
                  onChange={(event) => onFormChange({ ...form, code: event.target.value })}
                />
              </label>
              <label>
                Điện thoại
                <input value={form.phone} onChange={(event) => onFormChange({ ...form, phone: event.target.value })} />
              </label>
              <label>
                MST
                <input value={form.taxCode} onChange={(event) => onFormChange({ ...form, taxCode: event.target.value })} />
              </label>
              <div aria-label="Loại khách hàng" className="customer-create-type-field" role="radiogroup">
                <span>Loại khách hàng</span>
                <label>
                  <input
                    checked={form.customerType === 'individual'}
                    name={`${formId}-customer-type`}
                    type="radio"
                    value="individual"
                    onChange={() => onFormChange({ ...form, customerType: 'individual' })}
                  />
                  Cá nhân
                </label>
                <label>
                  <input
                    checked={form.customerType === 'company'}
                    name={`${formId}-customer-type`}
                    type="radio"
                    value="company"
                    onChange={() => onFormChange({ ...form, customerType: 'company' })}
                  />
                  Tổ chức
                </label>
              </div>
              {form.customerType === 'company' ? (
                <label>
                  Công ty
                  <input
                    placeholder="Nhập tên công ty"
                    value={form.companyName}
                    onChange={(event) => onFormChange({ ...form, companyName: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
          </fieldset>

          <fieldset>
            <legend>Địa chỉ</legend>
            <label>
              Địa chỉ
              <input
                placeholder="Nhập một dòng địa chỉ"
                value={form.address}
                onChange={(event) => onFormChange({ ...form, address: event.target.value })}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Nhóm khách hàng, ghi chú</legend>
            <label>
              Nhóm khách hàng
              <select
                aria-label="Nhóm khách hàng"
                value={form.customerGroupId}
                onChange={(event) => onFormChange({ ...form, customerGroupId: event.target.value })}
              >
                <option value="">Chọn nhóm khách hàng</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ghi chú
              <textarea
                placeholder="Nhập ghi chú"
                value={form.note}
                onChange={(event) => onFormChange({ ...form, note: event.target.value })}
              />
            </label>
          </fieldset>

          {error ? <p role="alert">{error}</p> : null}
        </form>

        <footer className="management-modal-footer">
          <button className="button button-secondary" type="button" onClick={onClose}>
            Bỏ qua
          </button>
          <button className="button button-primary" disabled={saving} type="submit" form={formId}>
            Lưu
          </button>
        </footer>
      </section>
    </div>
  )
}
