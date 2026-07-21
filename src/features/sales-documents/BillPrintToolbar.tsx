import { billTemplateLabel, type BillTemplateId } from './bill-settings'

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
      <label className="bill-template-picker">
        <span>Mẫu in</span>
        <select
          aria-label="Mẫu in"
          value={template}
          onChange={(event) => onTemplateChange(event.target.value as BillTemplateId)}
        >
          <option value="a4">{billTemplateLabel('a4')}</option>
          <option value="k80">{billTemplateLabel('k80')}</option>
        </select>
      </label>
      <button type="button" onClick={onPrint}>
        In
      </button>
      <button type="button" onClick={onClose}>
        Đóng
      </button>
    </div>
  )
}
