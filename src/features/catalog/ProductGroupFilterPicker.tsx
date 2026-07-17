import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, GripVertical, Pencil, Search, X } from 'lucide-react'
import type { ProductGroup } from './types'
import { visibleProductGroups } from './product-group-utils'

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

function idsForNode(node: ProductGroupTreeNode): string[] {
  return [
    ...(node.group ? [node.group.id] : []),
    ...node.children.flatMap((child) => idsForNode(child)),
  ]
}

function filterTree(nodes: ProductGroupTreeNode[], query: string): ProductGroupTreeNode[] {
  if (!query) return nodes
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query)
    const matches = normalizeProductGroupSearch(node.fullName).includes(query)
    if (!matches && children.length === 0) return []
    return [{ ...node, children }]
  })
}

export function ProductGroupFilterPicker({
  groups,
  value,
  collapsedLabel,
  onChange,
  onRename,
}: {
  groups: ProductGroup[]
  value: string[]
  collapsedLabel: string
  onChange: (value: string[]) => void
  onRename?: (group: ProductGroup, name: string) => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState<string[]>(value)
  const [query, setQuery] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const displayGroups = useMemo(() => visibleProductGroups(groups), [groups])
  const tree = useMemo(() => buildProductGroupTree(displayGroups), [displayGroups])
  const normalizedQuery = normalizeProductGroupSearch(query)
  const visibleTree = useMemo(() => filterTree(tree, normalizedQuery), [tree, normalizedQuery])
  const activeIds = new Set(open ? draftValue : value)
  const selectedGroups = displayGroups.filter((group) => activeIds.has(group.id))

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
    setDraftValue(value)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function toggleNode(node: ProductGroupTreeNode) {
    const ids = idsForNode(node)
    if (ids.length === 0) return
    setDraftValue((current) => {
      const next = new Set(current)
      const selected = ids.every((id) => next.has(id))
      ids.forEach((id) => {
        if (selected) next.delete(id)
        else next.add(id)
      })
      return [...next]
    })
  }

  function toggleExpanded(node: ProductGroupTreeNode) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(node.key)) next.delete(node.key)
      else next.add(node.key)
      return next
    })
  }

  function applySelection() {
    onChange(draftValue)
    setOpen(false)
  }

  function clearSelection() {
    setDraftValue([])
    onChange([])
    setOpen(false)
  }

  function removeGroup(groupId: string) {
    onChange(value.filter((id) => id !== groupId))
  }

  function beginRename(group: ProductGroup) {
    setEditingGroupId(group.id)
    setEditingName(productGroupDisplayName(group.name))
  }

  function nextFullGroupName(group: ProductGroup, label: string) {
    const cleanLabel = label.trim()
    const parts = productGroupParts(group.name)
    if (parts.length <= 1) return cleanLabel
    return [...parts.slice(0, -1), cleanLabel].join(' >> ')
  }

  async function saveRename(group: ProductGroup) {
    const cleanLabel = editingName.trim()
    if (!cleanLabel) return
    setSavingGroupId(group.id)
    try {
      await onRename?.(group, nextFullGroupName(group, cleanLabel))
      setEditingGroupId(null)
      setEditingName('')
    } finally {
      setSavingGroupId(null)
    }
  }

  function renderNode(node: ProductGroupTreeNode, depth = 0): ReactNode {
    const ids = idsForNode(node)
    const checked = ids.length > 0 && ids.every((id) => activeIds.has(id))
    const expanded = normalizedQuery.length > 0 || expandedKeys.has(node.key)
    const hasChildren = node.children.length > 0
    return (
      <div key={node.key}>
        <div className="management-filter-product-group-row" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <GripVertical aria-hidden="true" size={16} />
          {hasChildren ? (
            <button
              aria-label={`${expanded ? 'Thu gọn' : 'Mở'} ${node.label}`}
              className="management-filter-product-group-expand"
              type="button"
              onClick={() => toggleExpanded(node)}
            >
              {expanded ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
            </button>
          ) : <span className="management-filter-product-group-expand-placeholder" />}
          {node.group && editingGroupId === node.group.id ? (
            <form
              className="management-filter-product-group-edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (node.group) void saveRename(node.group)
              }}
            >
              <input
                aria-label="Tên nhóm hàng"
                disabled={savingGroupId === node.group.id}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
              />
              <button aria-label="Lưu tên nhóm hàng" disabled={savingGroupId === node.group.id || editingName.trim() === ''} type="submit">
                <Check aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="Hủy sửa tên nhóm hàng"
                disabled={savingGroupId === node.group.id}
                type="button"
                onClick={() => {
                  setEditingGroupId(null)
                  setEditingName('')
                }}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </form>
          ) : (
            <>
              <label className="management-filter-product-group-check">
                <input checked={checked} type="checkbox" onChange={() => toggleNode(node)} />
                <span>{node.label}</span>
              </label>
              {node.group && onRename ? (
                <button
                  aria-label={`Sửa ${node.label}`}
                  className="management-filter-product-group-edit"
                  type="button"
                  onClick={() => beginRename(node.group as ProductGroup)}
                >
                  <Pencil aria-hidden="true" size={16} />
                </button>
              ) : null}
            </>
          )}
        </div>
        {expanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <div ref={pickerRef} className={`management-filter-product-group-picker${open ? ' management-filter-sidebar-popover-open' : ''}`}>
      <div className="management-chip-picker-selected" onClick={openPicker}>
        {selectedGroups.map((group) => (
          <span className="management-chip-picker-chip" key={group.id}>
            {productGroupDisplayName(group.name)}
            <button
              aria-label={`Bỏ ${productGroupDisplayName(group.name)}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                removeGroup(group.id)
              }}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          aria-expanded={open}
          aria-label={collapsedLabel}
          className="management-chip-picker-input"
          placeholder={selectedGroups.length > 0 ? '' : collapsedLabel}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open ? (
        <div aria-label="Chọn nhóm hàng" className="management-filter-product-group-popover" role="dialog">
          <div className="management-filter-product-group-header">
            <strong>Nhóm hàng</strong>
          </div>
          <label className="management-filter-product-group-search">
            <span className="sr-only">Tìm nhóm hàng</span>
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Tìm nhóm hàng"
              className="management-filter-select"
              placeholder="Tìm kiếm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="management-filter-product-group-list">
            {visibleTree.map((node) => renderNode(node))}
            {visibleTree.length === 0 ? <p className="management-filter-empty">Không có nhóm hàng</p> : null}
          </div>
          <div className="management-filter-product-group-footer">
            <button className="button button-secondary" type="button" onClick={clearSelection}>
              Chọn tất cả
            </button>
            <button className="button button-primary" type="button" onClick={applySelection}>
              Áp dụng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
