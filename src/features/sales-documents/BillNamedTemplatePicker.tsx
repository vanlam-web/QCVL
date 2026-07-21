import {
  billTemplateLabel,
  billTemplateSlotCode,
  type BillPrintTemplate,
} from './bill-settings'

export function BillNamedTemplatePicker({
  templates,
  value,
  onChange,
  name = 'named_bill_template',
  legend = 'Chọn mẫu in',
  compact = false,
}: {
  templates: BillPrintTemplate[]
  value: string
  onChange: (templateId: string) => void
  name?: string
  legend?: string
  compact?: boolean
}) {
  return (
    <fieldset
      aria-label={legend}
      className={compact ? 'bill-named-template-picker is-compact' : 'bill-named-template-picker'}
    >
      <legend>{legend}</legend>
      <div className="bill-named-template-list" role="radiogroup" aria-label={legend}>
        {templates.map((template, index) => {
          const selected = template.id === value
          const slot = billTemplateSlotCode(index)
          return (
            <label
              key={template.id}
              className={selected ? 'bill-named-template-card is-selected' : 'bill-named-template-card'}
            >
              <input
                checked={selected}
                name={name}
                type="radio"
                value={template.id}
                onChange={() => onChange(template.id)}
              />
              <span className="bill-named-template-slot" aria-hidden="true">{slot}</span>
              <span className="bill-named-template-body">
                <span className="bill-named-template-title">{template.name}</span>
                <span className="bill-named-template-meta">
                  {billTemplateLabel(template.paper_size)}
                  {template.is_default ? ' · Mặc định' : ''}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
