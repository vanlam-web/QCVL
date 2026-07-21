import { BillTemplatePicker } from './BillTemplatePicker'
import type { BillTemplateId } from './bill-settings'

export function BillPrintToolbar({
  template,
  onTemplateChange,
  onPrint,
  onClose,
  preferenceStatus,
}: {
  template: BillTemplateId
  onTemplateChange: (template: BillTemplateId) => void
  onPrint: () => void
  onClose: () => void
  preferenceStatus?: string | null
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
