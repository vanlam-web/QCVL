import { BillNamedTemplatePicker } from './BillNamedTemplatePicker'
import type { BillPrintTemplate } from './bill-settings'

export function BillPrintToolbar({
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onPrint,
  onClose,
  preferenceStatus,
}: {
  templates: BillPrintTemplate[]
  selectedTemplateId: string
  onTemplateSelect: (templateId: string) => void
  onPrint: () => void
  onClose: () => void
  preferenceStatus?: string | null
}) {
  return (
    <div className="quote-print-toolbar">
      <BillNamedTemplatePicker
        compact
        legend="Chọn mẫu in"
        name="print_named_bill_template"
        templates={templates}
        value={selectedTemplateId}
        onChange={onTemplateSelect}
      />
      {preferenceStatus ? (
        <p className="quote-print-preference-status" role="status">
          {preferenceStatus}
        </p>
      ) : null}
      <button type="button" onClick={onPrint}>
        In
      </button>
      <button type="button" onClick={onClose}>
        Đóng
      </button>
    </div>
  )
}
