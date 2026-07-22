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
  mode = 'single',
  selectedIds,
  onSelectedIdsChange,
}: {
  templates: BillPrintTemplate[]
  /** Mẫu đang xem / in (active). */
  value: string
  onChange: (templateId: string) => void
  name?: string
  legend?: string
  compact?: boolean
  /** `multi` = tick nhiều mẫu nhớ theo khách (SoT §4); `single` = chọn 1 (POS checkout). */
  mode?: 'single' | 'multi'
  selectedIds?: string[]
  onSelectedIdsChange?: (templateIds: string[]) => void
}) {
  const multi = mode === 'multi'
  const ticks = multi
    ? (selectedIds && selectedIds.length > 0 ? selectedIds : value ? [value] : [])
    : value
      ? [value]
      : []

  function activate(templateId: string) {
    // Parent (print page) thêm id vào list khi đổi mẫu đang xem — tránh double-call race.
    onChange(templateId)
  }

  function toggleTick(templateId: string, checked: boolean) {
    if (!multi || !onSelectedIdsChange) return
    if (checked) {
      const next = ticks.includes(templateId) ? ticks : [...ticks, templateId]
      onSelectedIdsChange(next)
      onChange(templateId)
      return
    }
    const next = ticks.filter((id) => id !== templateId)
    if (next.length === 0) {
      onSelectedIdsChange([value || templateId])
      return
    }
    onSelectedIdsChange(next)
    if (value === templateId) {
      onChange(next[0]!)
    }
  }

  return (
    <fieldset
      aria-label={legend}
      className={
        compact
          ? `bill-named-template-picker is-compact${multi ? ' is-multi' : ''}`
          : `bill-named-template-picker${multi ? ' is-multi' : ''}`
      }
    >
      <legend>{legend}</legend>
      <div
        className="bill-named-template-list"
        role={multi ? 'group' : 'radiogroup'}
        aria-label={legend}
      >
        {templates.map((template, index) => {
          const active = template.id === value
          const ticked = ticks.includes(template.id)
          const slot = billTemplateSlotCode(index)
          const cardClass = [
            'bill-named-template-card',
            multi ? (ticked ? 'is-selected' : '') : (active ? 'is-selected' : ''),
            multi && active ? 'is-active' : '',
          ].filter(Boolean).join(' ')

          if (!multi) {
            return (
              <label key={template.id} className={cardClass}>
                <input
                  checked={active}
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
          }

          return (
            <label key={template.id} className={cardClass}>
              <input
                aria-label={`Nhớ mẫu ${template.name}`}
                checked={ticked}
                className="bill-named-template-check"
                name={`${name}-tick`}
                type="checkbox"
                value={template.id}
                onChange={(event) => toggleTick(template.id, event.target.checked)}
              />
              <button
                aria-current={active ? 'true' : undefined}
                aria-label={`Xem mẫu ${template.name}`}
                className="bill-named-template-activate"
                type="button"
                onClick={() => activate(template.id)}
              >
                <span className="bill-named-template-slot" aria-hidden="true">{slot}</span>
                <span className="bill-named-template-body">
                  <span className="bill-named-template-title">{template.name}</span>
                  <span className="bill-named-template-meta">
                    {billTemplateLabel(template.paper_size)}
                    {template.is_default ? ' · Mặc định' : ''}
                    {active ? ' · Đang xem' : ''}
                  </span>
                </span>
              </button>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
