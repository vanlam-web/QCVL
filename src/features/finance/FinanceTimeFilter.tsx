import { ChevronRight } from 'lucide-react'
import { ManagementDateRangeInputs, ManagementFilterGroup } from '../../components/ui-shell/management-layout'
import { cashbookQuickTimeGroups, cashbookQuickTimeLabels, displayDate, type CashbookTimeFilter } from './finance-filters'

interface FinanceTimeFilterProps {
  open: boolean; filter: CashbookTimeFilter; from: string; to: string; displayFrom: string; displayTo: string
  onToggle: () => void; onClose: () => void; onPreset: (preset: Exclude<CashbookTimeFilter, 'custom'>) => void; onFromChange: (value: string) => void; onToChange: (value: string) => void
}
export function FinanceTimeFilter({open,filter,from,to,displayFrom,displayTo,onToggle,onClose,onPreset,onFromChange,onToChange}:FinanceTimeFilterProps){return <ManagementFilterGroup title="Thời gian">
  <div className="management-filter-time-options"><button aria-expanded={open} className="management-filter-choice management-filter-time-trigger" type="button" onClick={onToggle}><span>{filter==='custom'?`${displayDate(from)} - ${displayDate(to)}`:cashbookQuickTimeLabels[filter]}</span><span className="management-filter-choice-trailing"><ChevronRight aria-hidden="true" size={17}/></span></button></div>
  {open?<div aria-label="Chọn nhanh thời gian" className="management-filter-quick-time-menu" role="region">{cashbookQuickTimeGroups.map(group=><section key={group.title}><h3>{group.title}</h3><div>{group.presets.map(preset=><button className={filter===preset?'management-filter-quick-time-active':undefined} key={preset} type="button" onClick={()=>onPreset(preset)}>{cashbookQuickTimeLabels[preset]}</button>)}</div></section>)}</div>:null}
  <ManagementDateRangeInputs displayFrom={displayFrom} displayTo={displayTo} from={from} to={to} onCalendarOpen={onClose} onFromChange={onFromChange} onToChange={onToChange}/>
</ManagementFilterGroup>}
