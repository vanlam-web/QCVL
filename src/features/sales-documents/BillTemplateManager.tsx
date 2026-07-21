import { useMemo, useState, type FormEvent } from 'react'
import { BillTemplateLivePreview } from './BillTemplateLivePreview'
import { BillTemplatePicker } from './BillTemplatePicker'
import {
  billDocumentTypeLabel,
  billTemplateLabel,
  billTemplateSlotCode,
  createBlankBillTemplate,
  maxBillTemplatesPerDocumentType,
  readImageFileAsDataUrl,
  type BillDocumentType,
  type BillPrintTemplate,
  type BillTemplateId,
  type OrganizationBillSettings,
} from './bill-settings'

export function BillTemplateManager({
  settings,
  loading,
  onSave,
  onLogoError,
}: {
  settings: OrganizationBillSettings
  loading?: boolean
  onSave: (patch: Partial<OrganizationBillSettings>) => Promise<void> | void
  onLogoError?: (message: string) => void
}) {
  const [documentType, setDocumentType] = useState<BillDocumentType>('invoice')
  const [templates, setTemplates] = useState<BillPrintTemplate[]>(() => settings.templates)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(() => settings.logo_data_url)
  const [selectedId, setSelectedId] = useState<string>(() =>
    settings.templates.find((item) => item.document_type === 'invoice' && item.is_default)?.id
      ?? settings.templates.find((item) => item.document_type === 'invoice')?.id
      ?? settings.templates[0]?.id
      ?? '',
  )

  const visibleTemplates = useMemo(
    () => templates.filter((item) => item.document_type === documentType),
    [documentType, templates],
  )

  const selected = visibleTemplates.find((item) => item.id === selectedId) ?? visibleTemplates[0] ?? null

  function updateSelected(patch: Partial<BillPrintTemplate>) {
    if (!selected) return
    setTemplates((current) => current.map((item) => {
      if (item.id !== selected.id) {
        if (patch.is_default && item.document_type === selected.document_type) {
          return { ...item, is_default: false }
        }
        return item
      }
      return { ...item, ...patch }
    }))
  }

  function addTemplate() {
    if (visibleTemplates.length >= maxBillTemplatesPerDocumentType) return
    const paper: BillTemplateId = visibleTemplates.some((item) => item.paper_size === 'k80') ? 'a4' : 'k80'
    const next = createBlankBillTemplate(documentType, paper)
    setTemplates((current) => [...current, next])
    setSelectedId(next.id)
  }

  function removeSelected() {
    if (!selected) return
    if (visibleTemplates.length <= 1) return
    if (!window.confirm(`Xóa mẫu "${selected.name}"? Không thể hoàn tác sau khi lưu.`)) return
    const remaining = templates.filter((item) => item.id !== selected.id)
    const stillHasDefault = remaining.some((item) => item.document_type === documentType && item.is_default)
    const next = stillHasDefault
      ? remaining
      : remaining.map((item, _index, list) => {
          if (item.document_type !== documentType) return item
          const firstOfType = list.find((candidate) => candidate.document_type === documentType)
          return { ...item, is_default: item.id === firstOfType?.id }
        })
    setTemplates(next)
    const fallback = next.find((item) => item.document_type === documentType)
    setSelectedId(fallback?.id ?? '')
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    await onSave({
      templates,
      logo_data_url: logoDataUrl,
    })
  }

  return (
    <div className="bill-template-manager">
      <div className="bill-template-manager-tabs" role="tablist" aria-label="Loại chứng từ">
        {(['invoice', 'quote'] as BillDocumentType[]).map((type) => (
          <button
            key={type}
            aria-selected={documentType === type}
            className={documentType === type ? 'is-active' : undefined}
            role="tab"
            type="button"
            onClick={() => {
              setDocumentType(type)
              const next = templates.find((item) => item.document_type === type && item.is_default)
                ?? templates.find((item) => item.document_type === type)
              if (next) setSelectedId(next.id)
            }}
          >
            {billDocumentTypeLabel(type)}
          </button>
        ))}
      </div>

      <div className="bill-template-manager-layout">
        <div className="bill-template-manager-list-pane">
          <div className="bill-template-manager-list-header">
            <h3>Danh sách mẫu</h3>
            <button
              className="button button-secondary"
              disabled={loading || visibleTemplates.length >= maxBillTemplatesPerDocumentType}
              type="button"
              onClick={addTemplate}
            >
              + Thêm mẫu
            </button>
          </div>
          <ul className="bill-template-manager-list">
            {visibleTemplates.map((item, index) => {
              const slot = billTemplateSlotCode(index)
              return (
                <li key={item.id}>
                  <button
                    className={item.id === selected?.id ? 'is-selected' : undefined}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="bill-template-manager-list-row">
                      <span className="bill-template-manager-slot" aria-hidden="true">{slot}</span>
                      <span className="bill-template-manager-list-text">
                        <span className="bill-template-manager-list-name">{item.name}</span>
                        <span className="bill-template-manager-list-meta">
                          {billTemplateLabel(item.paper_size)}
                          {item.is_default ? ' · Mặc định' : ''}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="admin-settings-field-hint">
            Tối đa {maxBillTemplatesPerDocumentType} mẫu / loại. Sửa sâu nội dung bên phải — chưa gồm editor HTML.
          </p>
        </div>

        {selected ? (
          <form className="admin-settings-form bill-template-manager-editor" onSubmit={handleSave}>
            <label>
              Tên mẫu
              <input
                disabled={loading}
                value={selected.name}
                onChange={(event) => updateSelected({ name: event.target.value })}
              />
            </label>
            <BillTemplatePicker
              legend="Mẫu in gợi ý"
              value={selected.paper_size}
              onChange={(paper_size) => updateSelected({ paper_size })}
            />
            <label>
              Tiêu đề trên bill
              <input
                disabled={loading}
                value={selected.title}
                onChange={(event) => updateSelected({ title: event.target.value })}
              />
            </label>
            <label>
              Dòng chân bill
              <textarea
                disabled={loading}
                placeholder="Để trống = câu mặc định khi in"
                rows={2}
                value={selected.footer_note}
                onChange={(event) => updateSelected({ footer_note: event.target.value })}
              />
            </label>
            <fieldset className="admin-settings-checkboxes admin-settings-checkboxes-inline">
              <legend>Cột trên bill</legend>
              <label>
                <input
                  checked={selected.show_product_code}
                  disabled={loading}
                  type="checkbox"
                  onChange={(event) => updateSelected({ show_product_code: event.target.checked })}
                />
                Hiện mã hàng
              </label>
              <label>
                <input
                  checked={selected.show_unit}
                  disabled={loading}
                  type="checkbox"
                  onChange={(event) => updateSelected({ show_unit: event.target.checked })}
                />
                Hiện ĐVT
              </label>
              <label>
                <input
                  checked={selected.show_discount}
                  disabled={loading}
                  type="checkbox"
                  onChange={(event) => updateSelected({ show_discount: event.target.checked })}
                />
                Hiện cột CK
              </label>
            </fieldset>
            <label className="admin-settings-checkboxes" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                checked={selected.is_default}
                disabled={loading || selected.is_default}
                type="checkbox"
                onChange={(event) => {
                  if (event.target.checked) updateSelected({ is_default: true })
                }}
              />
              Đặt làm mẫu mặc định cho {billDocumentTypeLabel(documentType).toLowerCase()}
            </label>
            <div className="admin-settings-logo-row">
              <label>
                Logo cửa hàng (dùng chung mọi mẫu)
                <span className="admin-settings-field-hint">PNG / JPG / WEBP · tối đa ~280KB</span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  disabled={loading}
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    void readImageFileAsDataUrl(file)
                      .then(setLogoDataUrl)
                      .catch((cause: unknown) => {
                        onLogoError?.(cause instanceof Error ? cause.message : 'Không đọc được logo.')
                      })
                  }}
                />
              </label>
              {logoDataUrl ? (
                <button
                  className="button button-secondary"
                  disabled={loading}
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                >
                  Xóa logo
                </button>
              ) : null}
            </div>
            <div className="admin-settings-form-actions">
              <button className="button button-primary" disabled={loading} type="submit">
                Lưu mẫu in
              </button>
              <button
                className="button button-secondary"
                disabled={loading || visibleTemplates.length <= 1}
                type="button"
                onClick={removeSelected}
              >
                Xóa mẫu này
              </button>
            </div>
          </form>
        ) : (
          <p>Chưa có mẫu để sửa.</p>
        )}

        {selected ? (
          <BillTemplateLivePreview
            settings={{
              shop_name: settings.shop_name,
              shop_address: settings.shop_address,
              shop_phone: settings.shop_phone,
              logo_data_url: logoDataUrl,
            }}
            template={selected}
          />
        ) : null}
      </div>
    </div>
  )
}
