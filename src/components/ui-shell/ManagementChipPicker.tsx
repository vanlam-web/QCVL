import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ManagementChipOption } from './use-chip-selection'
import { normalizeManagementSearchText } from './management-search'

export function ManagementChipPicker({
  addLabel = 'Thêm',
  ariaLabel,
  emptyLabel = 'Không còn lựa chọn',
  isLocked,
  options,
  selectedOptions,
  unselectedOptions,
  onAdd,
  onRemove,
}: {
  addLabel?: string
  ariaLabel: string
  emptyLabel?: string
  isLocked?: (id: string) => boolean
  options: ManagementChipOption[]
  selectedOptions: ManagementChipOption[]
  unselectedOptions: ManagementChipOption[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedQuery = normalizeManagementSearchText(query)
  const visibleOptions = normalizedQuery
    ? unselectedOptions.filter((option) => normalizeManagementSearchText(option.label).includes(normalizedQuery))
    : unselectedOptions

  useEffect(() => {
    if (!open) return undefined

    function closeWhenOutside(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (pickerRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', closeWhenOutside, true)
    return () => document.removeEventListener('pointerdown', closeWhenOutside, true)
  }, [open])

  function openPicker() {
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function addOption(id: string) {
    onAdd(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={pickerRef} aria-label={ariaLabel} className="management-chip-picker">
      <div className="management-chip-picker-selected" onClick={openPicker}>
        {selectedOptions.map((option) => {
          const locked = isLocked?.(option.id) ?? false
          return (
            <span className="management-chip-picker-chip" key={option.id}>
              {option.label}
              {locked ? null : (
                <button
                  aria-label={`Bỏ ${option.label}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(option.id)
                  }}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            </span>
          )
        })}
        <input
          ref={inputRef}
          aria-expanded={open}
          aria-label={addLabel}
          className="management-chip-picker-input"
          placeholder={selectedOptions.length === 0 ? addLabel : ''}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open ? (
        <div aria-label={`${ariaLabel} lựa chọn`} className="management-chip-picker-menu" role="listbox">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                aria-selected="false"
                key={option.id}
                role="option"
                type="button"
                onClick={() => addOption(option.id)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <span className="management-chip-picker-empty">{options.length === 0 ? 'Chưa có dữ liệu' : (query.trim() ? 'Không có bảng giá phù hợp' : emptyLabel)}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
