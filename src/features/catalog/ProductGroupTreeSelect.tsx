import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { visibleProductGroups } from './product-group-utils'
import type { ProductGroup } from './types'

interface ProductGroupTreeNode {
  key: string
  label: string
  fullName: string
  group: ProductGroup | null
  children: ProductGroupTreeNode[]
}

function normalizeProductGroupSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function productGroupParts(name: string) {
  return name.split(/\s*>>\s*/).map((part) => part.trim()).filter(Boolean)
}

function productGroupDisplayName(name: string) {
  return productGroupParts(name).at(-1) ?? name
}

function buildProductGroupTree(groups: ProductGroup[]) {
  const roots: ProductGroupTreeNode[] = []
  const nodesByKey = new Map<string, ProductGroupTreeNode>()

  for (const group of groups) {
    const parts = productGroupParts(group.name)
    let siblings = roots
    let key = ''
    parts.forEach((part, index) => {
      key = key ? `${key}>>${part}` : part
      let node = nodesByKey.get(key)
      if (!node) {
        node = { key, label: part, fullName: key, group: null, children: [] }
        nodesByKey.set(key, node)
        siblings.push(node)
      }
      if (index === parts.length - 1) node.group = group
      siblings = node.children
    })
  }

  function sortNodes(nodes: ProductGroupTreeNode[]) {
    nodes.sort((left, right) => left.label.localeCompare(right.label, 'vi', { numeric: true, sensitivity: 'base' }))
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(roots)
  return roots
}

function flattenTree(nodes: ProductGroupTreeNode[], depth = 0): Array<{ node: ProductGroupTreeNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ])
}

export function ProductGroupTreeSelect({
  groups,
  value,
  placeholder,
  onChange,
}: {
  groups: ProductGroup[]
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const displayGroups = useMemo(() => visibleProductGroups(groups), [groups])
  const tree = useMemo(() => buildProductGroupTree(displayGroups), [displayGroups])
  const flatGroups = useMemo(() => flattenTree(tree), [tree])
  const normalizedQuery = normalizeProductGroupSearch(query)
  const visibleGroups = useMemo(
    () => flatGroups.filter(({ node }) => !normalizedQuery || normalizeProductGroupSearch(node.fullName).includes(normalizedQuery)),
    [flatGroups, normalizedQuery],
  )
  const selectedGroup = displayGroups.find((group) => group.id === value) ?? null

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

  function togglePicker() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function selectGroup(groupId: string) {
    onChange(groupId)
    setOpen(false)
  }

  return (
    <div ref={pickerRef} className={`management-filter-product-group-picker${open ? ' management-filter-sidebar-popover-open' : ''}`}>
      <button aria-expanded={open} className="management-chip-picker-selected management-filter-group-picker-trigger" type="button" onClick={togglePicker}>
        <span className={`management-chip-picker-input ${selectedGroup ? '' : 'management-chip-picker-input-placeholder'}`}>
          {selectedGroup ? productGroupDisplayName(selectedGroup.name) : placeholder}
        </span>
        <ChevronDown aria-hidden="true" className="management-filter-group-picker-chevron" size={18} />
      </button>
      {open ? (
        <div aria-label="Chọn nhóm hàng" className="management-filter-product-group-popover management-filter-product-group-popover-below management-filter-product-group-popover-flat" role="dialog">
          <label className="management-filter-product-group-search">
            <span className="sr-only">Tìm nhóm hàng</span>
            <Search aria-hidden="true" size={18} />
            <input
              ref={inputRef}
              aria-label="Tìm nhóm hàng"
              className="management-filter-select"
              placeholder="Tìm kiếm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="management-filter-product-group-list">
            <button
              className={`management-filter-product-group-option${value === '' ? ' is-selected' : ''}`}
              type="button"
              onClick={() => selectGroup('')}
            >
              {placeholder}
            </button>
            {visibleGroups.map(({ node, depth }) => (
              <button
                className={`management-filter-product-group-option${selectedGroup?.id === node.group?.id ? ' is-selected' : ''}`}
                key={node.key}
                style={{ paddingLeft: `${1 + depth * 1.75}rem` }}
                type="button"
                onClick={() => {
                  if (node.group) selectGroup(node.group.id)
                }}
              >
                {node.label}
              </button>
            ))}
            {visibleGroups.length === 0 ? <p className="management-filter-empty">Không có nhóm hàng</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
