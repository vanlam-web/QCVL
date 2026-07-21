import { BillTemplatePicker } from './BillTemplatePicker'
import type { BillTemplateId } from './bill-settings'

export function BillPrintToolbar({
  template,
  onTemplateChange,
  onPrint,
  onClose,
}: {
  template: BillTemplateId
  onTemplateChange: (template: BillTemplateId) => void
  onPrint: () => void
  onClose: () => void
}) {
  return (
    <div className="quote-print-toolbar">
      <BillTemplatePicker
        compact
        legend="Mẫu in"
        name="print_bill_template"
        value={template}
        onChange={onTemplateChange}
      />
      <button type="button" onClick={onPrint}>
        In
      </button>
      <button type="button" onClick={onClose}>
        Đóng
      </button>
    </div>
  )
}
