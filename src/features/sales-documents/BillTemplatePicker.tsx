import {
  billTemplateDescription,
  billTemplateLabel,
  type BillTemplateId,
} from './bill-settings'

const templates: BillTemplateId[] = ['a4', 'k80']

export function BillTemplatePicker({
  value,
  onChange,
  name = 'default_bill_template',
  legend = 'Mẫu in',
  compact = false,
}: {
  value: BillTemplateId
  onChange: (template: BillTemplateId) => void
  name?: string
  legend?: string
  compact?: boolean
}) {
  return (
    <fieldset
      aria-label={legend}
      className={compact ? 'bill-template-cards is-compact' : 'bill-template-cards'}
    >
      <legend>{legend}</legend>
      <div className="bill-template-card-list">
        {templates.map((template) => {
          const selected = value === template
          return (
            <label
              key={template}
              className={selected ? 'bill-template-card is-selected' : 'bill-template-card'}
            >
              <input
                checked={selected}
                name={name}
                type="radio"
                value={template}
                onChange={() => onChange(template)}
              />
              <span className="bill-template-card-body">
                <span className="bill-template-card-title">{billTemplateLabel(template)}</span>
                {compact ? null : (
                  <span className="bill-template-card-desc">{billTemplateDescription(template)}</span>
                )}
                <span
                  aria-hidden="true"
                  className={`bill-template-card-preview bill-template-card-preview-${template}`}
                >
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
