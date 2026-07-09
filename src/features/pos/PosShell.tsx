import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type { CurrentUserData } from '../../lib/api/types'
import type { CatalogService } from '../catalog/catalog-service'
import type { Product, ResolvedPrice, SellMethod } from '../catalog/types'
import type { InventoryService } from '../inventory/inventory-service'
import type { MaterialOpeningConversionOption, MaterialOpeningOptions, PosShortageMaterial, PosShortagePreview } from '../inventory/types'
import type { CheckoutCartLine, OrderService, RecentPriceList } from '../orders/order-service'
import type { ProductionQueueService } from '../production-queue/production-queue-service'
import type { ProductionQueueDraftPayload } from '../production-queue/types'
import { CheckoutPanel } from './CheckoutPanel'
import { CustomerPanel } from './CustomerPanel'
import { formatApiError } from '../../lib/api/error-message'
import { formatMeasure, formatMoney } from '../../lib/number-format'
import { ProductGrid } from './ProductGrid'
import { PosCartPanel } from './PosCartPanel'
import { PosPaymentPanel } from './PosPaymentPanel'
import { PosTopbar } from './PosTopbar'
import { ProductionQueuePanel } from './ProductionQueuePanel'
import { consumeQuoteReopenPayload } from './quote-draft-handoff'
import { permissions } from '../users/permissions'
import {
  areaPieceCount,
  areaQuantity,
  cartLineDiscountAmountFromPercent,
  cartLineDiscountPercent,
  clampLineDiscount,
  draftLineQuantity,
  initialQuotePayloadToTabs,
  isAreaLine,
  isInvoiceTabDirty,
  lineInputDraftKey,
  lineTotal,
  makeCartLine,
  makeInvoiceTab,
  maxInvoiceTabs,
  nextInvoiceNumber,
  normalizeMeasureInputText,
  normalizeSearch,
  persistInvoiceTabs,
  quickProductLoadSize,
  quoteBlockedReason,
  readNonNegativeNumber,
  readPositiveMoney,
  readPositiveNumber,
  removeCompletedInvoiceTab,
  type DiscountMode,
  type PosInvoiceTab,
} from './pos-core'

const sellMethodLabels: Record<SellMethod, string> = {
  quantity: 'Theo số lượng',
  area_m2: 'Theo m²',
  linear_m: 'Theo mét dài',
  sheet: 'Theo tấm',
  combo: 'Combo',
}

export function PosShell({
  catalogService,
  inventoryService,
  orderService,
  productionQueueService,
  currentUser,
  connected = true,
  onSignOut,
  onOpenAdmin,
  onOpenDashboard,
}: {
  catalogService: CatalogService
  inventoryService: InventoryService
  orderService: OrderService
  productionQueueService: ProductionQueueService
  currentUser: CurrentUserData
  connected?: boolean
  onSignOut: () => void
  onOpenAdmin: () => void
  onOpenDashboard: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [prices, setPrices] = useState<Record<string, ResolvedPrice>>({})
  const [initialQuotePayload] = useState(() => consumeQuoteReopenPayload())
  const [initialTabs] = useState(() => initialQuotePayloadToTabs(initialQuotePayload))
  const [tabs, setTabs] = useState<PosInvoiceTab[]>(initialTabs)
  const [activeTabId, setActiveTabId] = useState(initialTabs[0]?.id ?? makeInvoiceTab(1).id)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const checkoutDrawerRef = useRef<HTMLElement | null>(null)
  const [productCreateOpen, setProductCreateOpen] = useState(false)
  const [productCreateSaving, setProductCreateSaving] = useState(false)
  const [productCreateError, setProductCreateError] = useState<string | null>(null)
  const [productCreateForm, setProductCreateForm] = useState({
    code: '',
    name: '',
    unitName: '',
    sellMethod: 'quantity' as SellMethod,
  })
  const [hoveredCartLineId, setHoveredCartLineId] = useState<string | null>(null)
  const [selectedCartLineId, setSelectedCartLineId] = useState<string | null>(null)
  const [focusedCartLineId, setFocusedCartLineId] = useState<string | null>(null)
  const [priceEditorLineId, setPriceEditorLineId] = useState<string | null>(null)
  const [discountModes, setDiscountModes] = useState<Record<string, DiscountMode>>({})
  const [recentPriceLineId, setRecentPriceLineId] = useState<string | null>(null)
  const [recentPrices, setRecentPrices] = useState<Record<string, RecentPriceList['items']>>({})
  const [shortagePreviews, setShortagePreviews] = useState<Record<string, PosShortagePreview>>({})
  const [shortagePreviewErrors, setShortagePreviewErrors] = useState<Record<string, string>>({})
  const [quickOpeningLineId, setQuickOpeningLineId] = useState<string | null>(null)
  const [quickOpeningSelectedIds, setQuickOpeningSelectedIds] = useState<Record<string, boolean>>({})
  const [quickOpeningQtyByProduct, setQuickOpeningQtyByProduct] = useState<Record<string, number>>({})
  const [quickOpeningUnitByProduct, setQuickOpeningUnitByProduct] = useState<Record<string, string>>({})
  const [materialOpeningOptions, setMaterialOpeningOptions] = useState<Record<string, MaterialOpeningOptions>>({})
  const [materialOpeningSaving, setMaterialOpeningSaving] = useState(false)
  const [materialOpeningError, setMaterialOpeningError] = useState<string | null>(null)
  const [manualOpeningOpen, setManualOpeningOpen] = useState(false)
  const [manualOpeningProductId, setManualOpeningProductId] = useState('')
  const [manualOpeningUnitId, setManualOpeningUnitId] = useState('')
  const [manualOpeningQty, setManualOpeningQty] = useState(1)
  const [manualOpeningOldRemaining, setManualOpeningOldRemaining] = useState(0)
  const [pendingFocusLineId, setPendingFocusLineId] = useState<string | null>(null)
  const [lineInputDrafts, setLineInputDrafts] = useState<Record<string, string>>({})
  const productSearchRef = useRef<HTMLInputElement>(null)
  const primaryLineInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const autoFocusedCartLineIds = useRef<Set<string>>(new Set())
  const valueInputMouseUpSelectRefs = useRef<Set<HTMLInputElement>>(new Set())
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? makeInvoiceTab(1)
  const cartLines = activeTab.cartLines
  const selectedCustomer = activeTab.selectedCustomer
  const selectedCustomerId = selectedCustomer?.id
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + lineTotal(line), 0),
    [cartLines],
  )
  const activeCartLineId =
    selectedCartLineId ?? priceEditorLineId ?? recentPriceLineId ?? hoveredCartLineId ?? focusedCartLineId
  const canApplyDiscount = currentUser.permissions.includes(permissions.applyDiscount)
  const quickOpeningLine = quickOpeningLineId === null
    ? null
    : cartLines.find((line) => line.id === quickOpeningLineId) ?? null
  const quickOpeningShortages = quickOpeningLine === null
    ? []
    : supportedShortages(shortagePreviews[quickOpeningLine.id])
  const updateActiveTab = useCallback((updater: (tab: PosInvoiceTab) => PosInvoiceTab) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)),
    )
  }, [activeTabId])
  const productSearchResults = useMemo(() => {
    const query = normalizeSearch(productSearch)
    if (query.length === 0) return []
    return products
      .filter((product) =>
        `${product.code} ${product.name}`.split(/\s+/).some((part) =>
          normalizeSearch(part).includes(query),
        ) || normalizeSearch(`${product.code} ${product.name}`).includes(query),
      )
      .slice(0, 7)
  }, [productSearch, products])

  useEffect(() => {
    let active = true

    async function loadProducts() {
      setLoadingProducts(true)
      setError(null)
      try {
        const productResult = await catalogService.listProducts({
          status: 'active',
          page: 1,
          page_size: quickProductLoadSize,
          sort: 'pos_usage',
        })
        if (!active) return
        setProducts(productResult.items)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được sản phẩm POS.'))
      } finally {
        if (active) setLoadingProducts(false)
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [catalogService])

  useEffect(() => {
    let active = true

    async function resolveVisiblePrices() {
      if (products.length === 0) {
        setPrices({})
        return
      }

      try {
        const priceResult = await catalogService.resolvePrices(
          products.map((product) => product.id),
          selectedCustomerId,
        )
        if (!active) return
        setPrices(
          Object.fromEntries(priceResult.items.map((price) => [price.product_id, price])),
        )
        updateActiveTab((tab) => ({
          ...tab,
          cartLines: tab.cartLines.map((line) => {
            if (line.isManualPrice) return line
            const resolved = priceResult.items.find((price) => price.product_id === line.product.id)
            if (resolved === undefined) return line
            return clampLineDiscount({
              ...line,
              unitPrice: resolved.unit_price,
              priceSource: resolved.price_source,
            })
          }),
        }))
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được giá bán POS.'))
      }
    }

    void resolveVisiblePrices()

    return () => {
      active = false
    }
  }, [catalogService, products, selectedCustomerId, updateActiveTab])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== 'F3') return
      event.preventDefault()
      productSearchRef.current?.focus()
      productSearchRef.current?.select()
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    persistInvoiceTabs(tabs)
  }, [tabs])

  useEffect(() => {
    if (!checkoutOpen) return

    function closeCheckoutOnOutsidePointer(event: PointerEvent) {
      if (checkoutDrawerRef.current?.contains(event.target as Node)) return
      setCheckoutOpen(false)
    }

    window.addEventListener('pointerdown', closeCheckoutOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeCheckoutOnOutsidePointer)
  }, [checkoutOpen])

  useEffect(() => {
    let active = true

    for (const line of cartLines) {
      if (line.quantity <= 0) continue
      void inventoryService.previewPosShortage({ product_id: line.product.id, quantity: line.quantity })
        .then((preview) => {
          if (!active) return
          setShortagePreviews((current) => ({ ...current, [line.id]: preview }))
          setShortagePreviewErrors((current) => {
            if (!(line.id in current)) return current
            const next = { ...current }
            delete next[line.id]
            return next
          })
        })
        .catch((cause) => {
          if (!active) return
          setShortagePreviews((current) => {
            if (!(line.id in current)) return current
            const next = { ...current }
            delete next[line.id]
            return next
          })
          setShortagePreviewErrors((current) => ({
            ...current,
            [line.id]: formatApiError(cause, 'Không kiểm tra được tồn vật tư.'),
          }))
        })
    }

    return () => {
      active = false
    }
  }, [cartLines, inventoryService])

  useEffect(() => {
    if (pendingFocusLineId === null) return undefined
    const input = primaryLineInputRefs.current.get(pendingFocusLineId)
    if (input === undefined) return undefined

    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement !== input) {
        setPendingFocusLineId(null)
        return
      }
      autoFocusedCartLineIds.current.add(pendingFocusLineId)
      input.focus()
      input.select()
      setPendingFocusLineId(null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [cartLines, pendingFocusLineId])

  function createInvoiceTab() {
    if (tabs.length >= maxInvoiceTabs) return
    const tab = makeInvoiceTab(nextInvoiceNumber(tabs))
    setTabs((current) => [...current, tab])
    setActiveTabId(tab.id)
  }

  function closeInvoiceTab(tabId: string) {
    const target = tabs.find((tab) => tab.id === tabId)
    if (target === undefined) return
    if (
      isInvoiceTabDirty(target) &&
      !window.confirm('Đơn hàng này chưa được lưu, bạn có chắc chắn muốn xóa không?')
    ) {
      return
    }

    setTabs((current) => {
      const targetIndex = current.findIndex((tab) => tab.id === tabId)
      if (targetIndex < 0) return current
      const remaining = current.filter((tab) => tab.id !== tabId)
      if (remaining.length === 0) {
        const freshTab = makeInvoiceTab(1)
        setActiveTabId(freshTab.id)
        return [freshTab]
      }
      if (tabId === activeTabId) {
        const nextTab = remaining[Math.min(targetIndex, remaining.length - 1)]
        setActiveTabId(nextTab.id)
      }
      return remaining
    })
  }

  function selectProduct(product: Product) {
    const unitPrice = prices[product.id]?.unit_price ?? 0
    const priceSource = prices[product.id]?.price_source ?? 'default_price_list'
    const lineId = `${product.id}-${cartLines.length + 1}-${Date.now()}`
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: [
        ...tab.cartLines,
        makeCartLine({
          id: lineId,
          product,
          unitPrice,
          priceSource,
        }),
      ],
    }))
    setPendingFocusLineId(lineId)
  }

  function selectProductFromSearch(product: Product) {
    selectProduct(product)
    setProductSearch('')
  }

  function handleProductSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setProductSearch('')
      return
    }
    if (event.key !== 'Enter') return
    const firstResult = productSearchResults[0]
    if (firstResult === undefined) return
    event.preventDefault()
    selectProductFromSearch(firstResult)
  }

  async function createProductFromPos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProductCreateSaving(true)
    setProductCreateError(null)
    try {
      const created = await catalogService.createProduct({
        code: productCreateForm.code.trim(),
        name: productCreateForm.name.trim(),
        status: 'active',
        unit_name: productCreateForm.unitName.trim(),
        sell_method: productCreateForm.sellMethod,
      })
      setProducts((current) => [created, ...current].slice(0, 12))
      setPrices((current) => ({ ...current, [created.id]: current[created.id] ?? {
        product_id: created.id,
        unit_price: 0,
        price_source: 'default_price_list',
        price_list_id: '',
      } }))
      setProductCreateForm({ code: '', name: '', unitName: '', sellMethod: 'quantity' })
      setProductCreateOpen(false)
    } catch (cause) {
      setProductCreateError(formatApiError(cause, 'Không tạo được hàng hóa.'))
    } finally {
      setProductCreateSaving(false)
    }
  }

  function updateLineQuantity(lineId: string, quantity: number) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines.map((line) =>
        line.id === lineId
          ? clampLineDiscount({ ...line, quantity: Math.max(quantity, 0) })
          : line,
      ),
    }))
  }

  function updateAreaLineMeasurement(
    lineId: string,
    patch: { width_m?: number; height_m?: number; pieceCount?: number },
  ) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines.map((line) => {
        if (line.id !== lineId) return line
        const widthM = patch.width_m ?? line.width_m ?? 0
        const heightM = patch.height_m ?? line.height_m ?? 0
        const pieceCount = patch.pieceCount ?? areaPieceCount(line)
        return clampLineDiscount({
          ...line,
          width_m: widthM,
          height_m: heightM,
          pieceCount,
          quantity: areaQuantity(widthM, heightM, pieceCount),
        })
      }),
    }))
  }

  function updateLineUnitPrice(lineId: string, unitPrice: number) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines
        .map((line) =>
          line.id === lineId
            ? {
                ...line,
                unitPrice: Math.max(unitPrice, 0),
                priceSource: 'manual' as const,
                isManualPrice: true,
              }
            : line,
        )
        .map((line) => (line.id === lineId ? clampLineDiscount(line) : line)),
    }))
  }

  function updateLineDiscount(lineId: string, discountAmount: number) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines.map((line) =>
        line.id === lineId
          ? clampLineDiscount({ ...line, discountAmount: Math.max(discountAmount, 0) })
          : line,
      ),
    }))
  }

  function updateLineNote(lineId: string, note: string) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines.map((line) =>
        line.id === lineId ? { ...line, note } : line,
      ),
    }))
  }

  function addDefaultLineAfter(lineId: string) {
    const newLineId = `line-${Date.now()}`
    updateActiveTab((tab) => {
      const sourceIndex = tab.cartLines.findIndex((line) => line.id === lineId)
      if (sourceIndex < 0) return tab
      const source = tab.cartLines[sourceIndex]
      const price = prices[source.product.id]
      const newLine = makeCartLine({
        id: newLineId,
        product: source.product,
        unitPrice: price?.unit_price ?? 0,
        priceSource: price?.price_source ?? 'default_price_list',
      })
      return {
        ...tab,
        cartLines: [
          ...tab.cartLines.slice(0, sourceIndex + 1),
          newLine,
          ...tab.cartLines.slice(sourceIndex + 1),
        ],
      }
    })
    setHoveredCartLineId(null)
    setSelectedCartLineId(newLineId)
    setPendingFocusLineId(newLineId)
  }

  function updateLineDiscountPercent(line: CheckoutCartLine, percent: number) {
    updateLineDiscount(line.id, cartLineDiscountAmountFromPercent(line, percent))
  }

  function discountPercentValue(line: CheckoutCartLine) {
    return cartLineDiscountPercent(line)
  }

  async function showRecentPrices(line: CheckoutCartLine) {
    if (selectedCustomer === null) return
    setSelectedCartLineId(line.id)
    setPriceEditorLineId(line.id)
    setRecentPriceLineId(line.id)
    const response = await orderService.listRecentCustomerProductPrices(selectedCustomer.id, line.product.id)
    setRecentPrices((current) => ({ ...current, [line.id]: response.items.slice(0, 5) }))
  }

  function closeLineEditor(lineId: string) {
    setSelectedCartLineId((current) => (current === lineId ? null : current))
    setFocusedCartLineId((current) => (current === lineId ? null : current))
    setPriceEditorLineId((current) => (current === lineId ? null : current))
    setRecentPriceLineId((current) => (current === lineId ? null : current))
  }

  function setPrimaryLineInput(lineId: string, element: HTMLInputElement | null) {
    if (element === null) {
      primaryLineInputRefs.current.delete(lineId)
      return
    }
    primaryLineInputRefs.current.set(lineId, element)
  }

  function focusPrimaryLineInput(lineId: string) {
    const input = primaryLineInputRefs.current.get(lineId)
    if (input === undefined) return
    setSelectedCartLineId(lineId)
    window.requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }

  function handleValueInputMouseDown(event: ReactMouseEvent<HTMLInputElement>) {
    if (document.activeElement !== event.currentTarget) {
      valueInputMouseUpSelectRefs.current.add(event.currentTarget)
      return
    }

    const input = event.currentTarget
    const wholeValueSelected =
      input.selectionStart === 0 && input.selectionEnd === input.value.length
    if (wholeValueSelected) {
      const caretIndex = valueInputCaretIndexFromPointer(input, event.clientX)
      window.requestAnimationFrame(() => {
        input.setSelectionRange(caretIndex, caretIndex)
      })
    }
  }

  function handleValueInputMouseUp(event: ReactMouseEvent<HTMLInputElement>) {
    if (!valueInputMouseUpSelectRefs.current.has(event.currentTarget)) return
    event.preventDefault()
    valueInputMouseUpSelectRefs.current.delete(event.currentTarget)
  }

  function handleValueInputFocus(event: ReactFocusEvent<HTMLInputElement>) {
    event.currentTarget.select()
  }

  function handleValueInputBlur(event: ReactFocusEvent<HTMLInputElement>) {
    valueInputMouseUpSelectRefs.current.delete(event.currentTarget)
  }

  function lineInputValue(lineId: string, field: string, value: number) {
    return lineInputDrafts[lineInputDraftKey(lineId, field)] ?? formatMeasure(value)
  }

  function updateLineInputDraft(
    lineId: string,
    field: string,
    value: string,
    applyValue: (value: number) => void,
  ) {
    const normalized = normalizeMeasureInputText(value)
    setLineInputDrafts((current) => ({
      ...current,
      [lineInputDraftKey(lineId, field)]: normalized,
    }))
    applyValue(readPositiveNumber(normalized))
  }

  function clearLineInputDraft(lineId: string, field: string) {
    setLineInputDrafts((current) => {
      const key = lineInputDraftKey(lineId, field)
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function handleCartLineMouseDown(
    event: ReactMouseEvent<HTMLLIElement>,
    lineId: string,
  ) {
    if (event.target instanceof HTMLElement && event.target.closest('input, button, textarea, select, a') !== null) {
      return
    }
    focusPrimaryLineInput(lineId)
  }

  function removeLine(lineId: string) {
    updateActiveTab((tab) => ({
      ...tab,
      cartLines: tab.cartLines.filter((line) => line.id !== lineId),
    }))
  }

  async function recheckLineShortage(line: CheckoutCartLine) {
    const preview = await inventoryService.previewPosShortage({ product_id: line.product.id, quantity: line.quantity })
    setShortagePreviews((current) => ({ ...current, [line.id]: preview }))
    setShortagePreviewErrors((current) => {
      if (!(line.id in current)) return current
      const next = { ...current }
      delete next[line.id]
      return next
    })
  }

  async function openQuickMaterialOpening(line: CheckoutCartLine) {
    const shortages = supportedShortages(shortagePreviews[line.id])
    setQuickOpeningLineId(line.id)
    setMaterialOpeningError(null)
    setQuickOpeningSelectedIds(Object.fromEntries(shortages.map((shortage) => [shortage.product_id, true])))
    setQuickOpeningQtyByProduct((current) => ({
      ...current,
      ...Object.fromEntries(shortages.map((shortage) => [shortage.product_id, current[shortage.product_id] ?? 1])),
    }))
    setQuickOpeningUnitByProduct((current) => ({
      ...current,
      ...Object.fromEntries(shortages.map((shortage) => [
        shortage.product_id,
        current[shortage.product_id] ?? shortage.conversion_options[0]?.unit_id ?? '',
      ])),
    }))

    const optionResults = await Promise.allSettled(
      shortages.map(async (shortage) => [shortage.product_id, await inventoryService.getMaterialOpeningOptions(shortage.product_id)] as const),
    )
    setMaterialOpeningOptions((current) => {
      const next = { ...current }
      for (const result of optionResults) {
        if (result.status !== 'fulfilled') continue
        next[result.value[0]] = result.value[1]
      }
      return next
    })
    setQuickOpeningUnitByProduct((current) => {
      const next = { ...current }
      for (const result of optionResults) {
        if (result.status !== 'fulfilled') continue
        const [productId, options] = result.value
        next[productId] = options.conversions[0]?.unit_id ?? next[productId] ?? ''
      }
      return next
    })
  }

  async function submitQuickMaterialOpening(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (quickOpeningLine === null) return
    const selectedShortages = quickOpeningShortages.filter((shortage) => quickOpeningSelectedIds[shortage.product_id])
    if (selectedShortages.length === 0) {
      setMaterialOpeningError('Chọn ít nhất một vật tư để khui.')
      return
    }
    setMaterialOpeningSaving(true)
    setMaterialOpeningError(null)
    try {
      for (const shortage of selectedShortages) {
        const conversion = quickOpeningConversion(shortage, materialOpeningOptions[shortage.product_id], quickOpeningUnitByProduct[shortage.product_id])
        if (conversion === undefined) throw new Error('MATERIAL_OPENING_CONVERSION_MISSING')
        await inventoryService.createMaterialOpening({
          product_id: shortage.product_id,
          inventory_shape: 'normal',
          opened_unit_id: conversion.unit_id,
          opened_qty: quickOpeningQtyByProduct[shortage.product_id] ?? 1,
          old_remaining_qty: 0,
          note: `Khui nhanh từ POS: ${quickOpeningLine.product.name}`,
        })
      }
      await recheckLineShortage(quickOpeningLine)
      setQuickOpeningLineId(null)
    } catch (cause) {
      setMaterialOpeningError(formatApiError(cause, 'Không khui được vật tư.'))
    } finally {
      setMaterialOpeningSaving(false)
    }
  }

  function closeManualMaterialOpening() {
    setManualOpeningOpen(false)
    setManualOpeningProductId('')
    setManualOpeningUnitId('')
    setManualOpeningQty(1)
    setManualOpeningOldRemaining(0)
    setMaterialOpeningError(null)
  }

  async function selectManualMaterialOpeningProduct(productId: string) {
    setManualOpeningProductId(productId)
    setManualOpeningUnitId('')
    setMaterialOpeningError(null)
    if (!productId) return
    try {
      const options = await inventoryService.getMaterialOpeningOptions(productId)
      setMaterialOpeningOptions((current) => ({ ...current, [productId]: options }))
      setManualOpeningUnitId(options.conversions[0]?.unit_id ?? '')
    } catch (cause) {
      setMaterialOpeningError(formatApiError(cause, 'Không tải được đơn vị khui.'))
    }
  }

  async function submitManualMaterialOpening(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!manualOpeningProductId || !manualOpeningUnitId || manualOpeningQty <= 0 || manualOpeningOldRemaining < 0) {
      setMaterialOpeningError('Thông tin khui vật tư chưa hợp lệ.')
      return
    }
    setMaterialOpeningSaving(true)
    setMaterialOpeningError(null)
    try {
      await inventoryService.createMaterialOpening({
        product_id: manualOpeningProductId,
        inventory_shape: 'normal',
        opened_unit_id: manualOpeningUnitId,
        opened_qty: manualOpeningQty,
        old_remaining_qty: manualOpeningOldRemaining,
        note: 'Khui thủ công từ POS',
      })
      closeManualMaterialOpening()
    } catch (cause) {
      setMaterialOpeningError(formatApiError(cause, 'Không khui được vật tư.'))
    } finally {
      setMaterialOpeningSaving(false)
    }
  }

  async function handleProductionQueueDraft(payload: ProductionQueueDraftPayload) {
    const queueCustomer =
      payload.customer === null
        ? null
        : {
            id: payload.customer.id,
            code: payload.customer.code,
            name: payload.customer.name,
            phone: null,
            tax_code: null,
            address: null,
            customer_group_id: null,
            customer_group: null,
          }
    const customerForPricing = queueCustomer ?? selectedCustomer
    const priceResult = await catalogService.resolvePrices(
      [payload.draft_line.product_id],
      customerForPricing?.id,
    )
    const resolvedPrice = priceResult.items[0]
    updateActiveTab((tab) => ({
      ...tab,
      selectedCustomer: queueCustomer ?? tab.selectedCustomer,
      cartLines: [
        ...tab.cartLines,
        {
          id: `${payload.queue_item_id}-${tab.cartLines.length + 1}`,
          product: {
            id: payload.draft_line.product_id,
            code: payload.draft_line.product_code,
            name: payload.draft_line.product_name,
            status: 'active',
            unit_name: payload.draft_line.unit_name,
            sell_method: payload.draft_line.sell_method,
          },
          quantity: draftLineQuantity(payload.draft_line),
          width_m: payload.draft_line.width_m ?? undefined,
          height_m: payload.draft_line.height_m ?? undefined,
          linear_m: payload.draft_line.linear_m ?? undefined,
          pieceCount: payload.draft_line.sell_method === 'area_m2'
            ? payload.draft_line.quantity
            : undefined,
          unitPrice: resolvedPrice?.unit_price ?? 0,
          priceSource: resolvedPrice?.price_source ?? 'default_price_list',
          isManualPrice: false,
          discountAmount: 0,
          note: 'Từ hàng đợi máy sản xuất',
        },
      ],
    }))
  }

  return (
    <main className="pos-shell">
      <PosTopbar
        activeTabId={activeTabId}
        connected={connected}
        currentUser={currentUser}
        prices={prices}
        productSearch={productSearch}
        productSearchRef={productSearchRef}
        productSearchResults={productSearchResults}
        tabs={tabs}
        onCloseInvoiceTab={closeInvoiceTab}
        onCreateInvoiceTab={createInvoiceTab}
        onOpenAdmin={onOpenAdmin}
        onOpenDashboard={onOpenDashboard}
        onOpenManualMaterialOpening={() => setManualOpeningOpen(true)}
        onOpenProductCreate={() => setProductCreateOpen(true)}
        onProductSearchChange={setProductSearch}
        onProductSearchFocus={() => {
          setHoveredCartLineId(null)
          setSelectedCartLineId(null)
          setPriceEditorLineId(null)
          setRecentPriceLineId(null)
        }}
        onProductSearchKeyDown={handleProductSearchKeyDown}
        onProductSelect={selectProductFromSearch}
        onSetActiveTab={setActiveTabId}
        onSignOut={onSignOut}
      />
      <PosCartPanel
        cartTotal={cartTotal}
        hasLines={cartLines.length > 0}
        lineCount={cartLines.length}
        note={activeTab.orderNote}
        onNoteChange={(orderNote) => updateActiveTab((tab) => ({ ...tab, orderNote }))}
      >
        {cartLines.length > 0 ? (
          <ul
            aria-label="Dòng hàng trong giỏ"
            className="pos-cart-lines"
            style={cartColumnStyle(cartLines)}
          >
            {activeCartLineId === null ? (
              <li aria-label="Cột dòng hàng" className="pos-cart-line-heading">
                <div className="pos-cart-line-header pos-cart-line-header-static">
                  <span>STT</span>
                  <span>Tên hàng</span>
                  <span className="pos-cart-line-area-header">
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span>SL</span>
                  </span>
                  <span aria-hidden="true" />
                  <span>ĐV</span>
                  <span>Đơn giá</span>
                  <span>Thành tiền</span>
                </div>
              </li>
            ) : null}
            {cartLines.map((line, index) => (
              <li
                key={line.id}
                className="pos-cart-line-shell"
                data-active={activeCartLineId === line.id ? 'true' : 'false'}
                data-selected={selectedCartLineId === line.id ? 'true' : 'false'}
                onFocusCapture={() => {
                  setFocusedCartLineId(line.id)
                  if (autoFocusedCartLineIds.current.has(line.id)) {
                    autoFocusedCartLineIds.current.delete(line.id)
                    return
                  }
                  setSelectedCartLineId(line.id)
                }}
                onMouseDown={(event) => handleCartLineMouseDown(event, line.id)}
                onBlurCapture={(event) => {
                  const container = event.currentTarget
                  window.setTimeout(() => {
                    if (!container.contains(document.activeElement)) closeLineEditor(line.id)
                  }, 0)
                }}
                onMouseEnter={() => setHoveredCartLineId(line.id)}
                onMouseLeave={() => {
                  setHoveredCartLineId((current) => (current === line.id ? null : current))
                  setPriceEditorLineId((current) => (current === line.id ? null : current))
                  setRecentPriceLineId((current) => (current === line.id ? null : current))
                }}
              >
                {activeCartLineId === line.id ? (
                  <div
                    className="pos-cart-line-header"
                    data-area={isAreaLine(line) ? 'true' : 'false'}
                    aria-label={`Cột dòng ${line.product.name}`}
                  >
                    <span>STT</span>
                    <span>Tên hàng</span>
                    {isAreaLine(line) ? (
                      <span className="pos-cart-line-area-header">
                        <span>Rộng</span>
                        <span>Dài</span>
                        <span>SL</span>
                      </span>
                    ) : (
                      <span className="pos-cart-line-area-header">
                        <span aria-hidden="true" />
                        <span aria-hidden="true" />
                        <span>SL</span>
                      </span>
                    )}
                    <span aria-hidden="true" />
                    <span>ĐV</span>
                    {canApplyDiscount ? (
                      <button
                        aria-label={`Mở chiết khấu ${line.product.name}`}
                        className="pos-cart-line-header-action"
                        type="button"
                        onClick={() => {
                          setSelectedCartLineId(line.id)
                          setPriceEditorLineId((current) => (current === line.id ? null : line.id))
                          setRecentPriceLineId((current) => (current === line.id ? null : current))
                        }}
                      >
                        Đơn giá
                      </button>
                    ) : (
                      <span>Đơn giá</span>
                    )}
                    <span>Thành tiền</span>
                    {selectedCartLineId === line.id || hoveredCartLineId === line.id ? (
                      <button
                        aria-label={`Xóa ${line.product.name}`}
                        className="pos-cart-line-remove"
                        type="button"
                        onClick={() => removeLine(line.id)}
                      >
                        ×
                      </button>
                    ) : (
                      <span className="pos-cart-line-remove" aria-hidden="true" />
                    )}
                  </div>
                ) : null}
                <div className="pos-cart-line" data-area={isAreaLine(line) ? 'true' : 'false'}>
                  <span className="pos-cart-line-index">{index + 1}</span>
                  <div className="pos-cart-line-name">
                    <strong>{line.product.name}</strong>
                    {!isAreaLine(line) && lineDimensions(line) ? <span>{lineDimensions(line)}</span> : null}
                    {line.quoteWarnings?.map((warning) => (
                      <span key={warning.code}>{warning.message}</span>
                    ))}
                    {shortagePreviewErrors[line.id] ? <span role="status">{shortagePreviewErrors[line.id]}</span> : null}
                    {supportedShortages(shortagePreviews[line.id]).length > 0 ? (
                      <span className="pos-cart-line-shortage">
                        {shortageSummary(shortagePreviews[line.id])}
                        <button
                          aria-label={`Khui vật tư ${line.product.name}`}
                          type="button"
                          onClick={() => void openQuickMaterialOpening(line)}
                        >
                          Khui vật tư
                        </button>
                      </span>
                    ) : null}
                  </div>
                  {isAreaLine(line) ? (
                    <>
                      <div className="pos-cart-line-area-inputs">
                        <input
                          aria-label={`Rộng ${line.product.name}`}
                          inputMode="decimal"
                          ref={(element) => setPrimaryLineInput(line.id, element)}
                          style={{ width: `${compactMeasureInputWidthCh(lineInputValue(line.id, 'width', line.width_m ?? 0))}ch` }}
                          type="text"
                          value={lineInputValue(line.id, 'width', line.width_m ?? 0)}
                          onChange={(event) => {
                            updateLineInputDraft(line.id, 'width', event.target.value, (value) =>
                              updateAreaLineMeasurement(line.id, { width_m: value }),
                            )
                          }}
                          onBlur={(event) => {
                            handleValueInputBlur(event)
                            clearLineInputDraft(line.id, 'width')
                          }}
                          onFocus={handleValueInputFocus}
                          onMouseDown={handleValueInputMouseDown}
                          onMouseUp={handleValueInputMouseUp}
                        />
                        <span aria-hidden="true">×</span>
                        <input
                          aria-label={`Dài ${line.product.name}`}
                          inputMode="decimal"
                          style={{ width: `${compactMeasureInputWidthCh(lineInputValue(line.id, 'height', line.height_m ?? 0))}ch` }}
                          type="text"
                          value={lineInputValue(line.id, 'height', line.height_m ?? 0)}
                          onChange={(event) => {
                            updateLineInputDraft(line.id, 'height', event.target.value, (value) =>
                              updateAreaLineMeasurement(line.id, { height_m: value }),
                            )
                          }}
                          onBlur={(event) => {
                            handleValueInputBlur(event)
                            clearLineInputDraft(line.id, 'height')
                          }}
                          onFocus={handleValueInputFocus}
                          onMouseDown={handleValueInputMouseDown}
                          onMouseUp={handleValueInputMouseUp}
                        />
                        <span aria-hidden="true">×</span>
                        <input
                          aria-label={`Số tấm ${line.product.name}`}
                          inputMode="decimal"
                          style={{ width: `${compactMeasureInputWidthCh(lineInputValue(line.id, 'pieces', areaPieceCount(line)))}ch` }}
                          type="text"
                          value={lineInputValue(line.id, 'pieces', areaPieceCount(line))}
                          onChange={(event) => {
                            updateLineInputDraft(line.id, 'pieces', event.target.value, (value) =>
                              updateAreaLineMeasurement(line.id, { pieceCount: value }),
                            )
                          }}
                          onBlur={(event) => {
                            handleValueInputBlur(event)
                            clearLineInputDraft(line.id, 'pieces')
                          }}
                          onFocus={handleValueInputFocus}
                          onMouseDown={handleValueInputMouseDown}
                          onMouseUp={handleValueInputMouseUp}
                        />
                      </div>
                      <span className="pos-cart-line-equals" aria-hidden="true">=</span>
                      <strong className="pos-cart-line-unit" aria-label={`Diện tích ${line.product.name}`}>
                        {formatMeasure(line.quantity)} {line.product.unit_name}
                      </strong>
                    </>
                  ) : (
                    <>
                      <div className="pos-cart-line-quantity">
                        <input
                          aria-label={`Số lượng ${line.product.name}`}
                          inputMode="decimal"
                          ref={(element) => setPrimaryLineInput(line.id, element)}
                          style={{ width: `${compactMeasureInputWidthCh(lineInputValue(line.id, 'quantity', line.quantity))}ch` }}
                          type="text"
                          value={lineInputValue(line.id, 'quantity', line.quantity)}
                          onChange={(event) => {
                            updateLineInputDraft(line.id, 'quantity', event.target.value, (value) =>
                              updateLineQuantity(line.id, value),
                            )
                          }}
                          onBlur={(event) => {
                            handleValueInputBlur(event)
                            clearLineInputDraft(line.id, 'quantity')
                          }}
                          onFocus={handleValueInputFocus}
                          onMouseDown={handleValueInputMouseDown}
                          onMouseUp={handleValueInputMouseUp}
                        />
                      </div>
                      <span className="pos-cart-line-equals" aria-hidden="true" />
                      <strong className="pos-cart-line-unit">{line.product.unit_name}</strong>
                    </>
                  )}
                  <div className="pos-cart-line-price">
                    <input
                      aria-label={`Đơn giá ${line.product.name}`}
                      inputMode="numeric"
                      style={{ width: `${moneyInputWidthCh(line.unitPrice)}ch` }}
                      type="text"
                      value={formatMoney(line.unitPrice)}
                      onChange={(event) =>
                        updateLineUnitPrice(line.id, readPositiveMoney(event.target.value))
                      }
                      onBlur={handleValueInputBlur}
                      onFocus={handleValueInputFocus}
                      onMouseDown={handleValueInputMouseDown}
                      onMouseUp={handleValueInputMouseUp}
                    />
                    {canApplyDiscount && (priceEditorLineId === line.id || recentPriceLineId === line.id) ? (
                      <section aria-label={`Chiết khấu ${line.product.name}`} className="pos-line-price-editor">
                        <div className="pos-line-price-editor-grid">
                          <label>
                            <span>Đơn giá</span>
                            <input
                              aria-label={`Đơn giá đang sửa ${line.product.name}`}
                              inputMode="numeric"
                              style={{ width: `${moneyInputWidthCh(line.unitPrice)}ch` }}
                              type="text"
                              value={formatMoney(line.unitPrice)}
                              onChange={(event) =>
                                updateLineUnitPrice(line.id, readPositiveMoney(event.target.value))
                              }
                              onBlur={handleValueInputBlur}
                              onFocus={handleValueInputFocus}
                              onMouseDown={handleValueInputMouseDown}
                              onMouseUp={handleValueInputMouseUp}
                            />
                          </label>
                          <label>
                            <span>Giảm</span>
                            <input
                              aria-label={`Giảm giá ${line.product.name}`}
                              inputMode="numeric"
                              min="0"
                              type="number"
                              value={
                                (discountModes[line.id] ?? 'amount') === 'percent'
                                  ? discountPercentValue(line)
                                  : line.discountAmount ?? 0
                              }
                              onChange={(event) => {
                                const value = readPositiveNumber(event.target.value)
                                if ((discountModes[line.id] ?? 'amount') === 'percent') {
                                  updateLineDiscountPercent(line, value)
                                } else {
                                  updateLineDiscount(line.id, value)
                                }
                              }}
                              onBlur={handleValueInputBlur}
                              onFocus={handleValueInputFocus}
                              onMouseDown={handleValueInputMouseDown}
                              onMouseUp={handleValueInputMouseUp}
                            />
                            <span className="pos-line-discount-mode" role="group" aria-label={`Kiểu giảm giá ${line.product.name}`}>
                              <button
                                aria-pressed={(discountModes[line.id] ?? 'amount') === 'amount'}
                                type="button"
                                onClick={() => setDiscountModes((current) => ({ ...current, [line.id]: 'amount' }))}
                              >
                                Tiền
                              </button>
                              <button
                                aria-pressed={discountModes[line.id] === 'percent'}
                                type="button"
                                onClick={() => setDiscountModes((current) => ({ ...current, [line.id]: 'percent' }))}
                              >
                                %
                              </button>
                            </span>
                          </label>
                          <div>
                            <span>Giá bán</span>
                            <strong>{formatMoney(Math.max(line.unitPrice - (line.discountAmount ?? 0), 0))}</strong>
                          </div>
                        </div>
                        <button
                          className="pos-line-recent-toggle"
                          disabled={selectedCustomer === null}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void showRecentPrices(line)}
                        >
                          Lịch sử giá {line.product.name}
                        </button>
                        {recentPriceLineId === line.id ? (
                          <div className="pos-line-recent-prices" aria-label={`Lịch sử giá ${line.product.name}`}>
                            <span>Khách này</span>
                            {(recentPrices[line.id] ?? []).length === 0 ? (
                              <em>Chưa có giá gần đây</em>
                            ) : (
                              recentPrices[line.id].map((price) => (
                                <button
                                  key={`${price.orderCode}-${price.soldAt}`}
                                  aria-label={`${price.orderCode} ${formatMoney(price.unitPrice)}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => updateLineUnitPrice(line.id, price.unitPrice)}
                                >
                                  <span>{price.orderCode}</span>
                                  {' '}
                                  <strong>{formatMoney(price.unitPrice)}</strong>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  </div>
                  <strong className="pos-cart-line-total">{formatMoney(lineTotal(line))}</strong>
                  <span className="pos-cart-line-action-spacer" aria-hidden="true" />
                </div>
                {activeCartLineId === line.id && (selectedCartLineId === line.id || hoveredCartLineId === line.id) ? (
                  <div className="pos-cart-line-note-row">
                    <label className="pos-cart-line-note">
                      <input
                        aria-label={`Chú thích ${line.product.name}`}
                        placeholder="Ghi chú"
                        value={line.note ?? ''}
                        onChange={(event) => updateLineNote(line.id, event.target.value)}
                      />
                    </label>
                    <button
                      aria-label={`Thêm dòng ${line.product.name}`}
                      className="pos-cart-line-duplicate"
                      type="button"
                      onClick={() => addDefaultLineAfter(line.id)}
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </PosCartPanel>
      <PosPaymentPanel
        checkoutDrawerRef={checkoutDrawerRef}
        checkoutOpen={checkoutOpen}
        onCloseCheckout={() => setCheckoutOpen(false)}
        main={
          <>
          <CustomerPanel
            key={selectedCustomer?.id ?? 'no-customer'}
            service={catalogService}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={(customer) =>
              updateActiveTab((tab) => ({ ...tab, selectedCustomer: customer }))
            }
          />
          {error ? <p role="alert">{error}</p> : null}
          <ProductGrid
            products={products}
            prices={prices}
            loading={loadingProducts}
            onSelectProduct={selectProduct}
            footerAction={
              <button className="pos-checkout-launcher button button-primary" type="button" onClick={() => setCheckoutOpen(true)}>
                Thanh toán
              </button>
            }
          />
          </>
        }
        checkout={
          <CheckoutPanel
            cartLines={cartLines}
            selectedCustomer={selectedCustomer}
            orderService={orderService}
            orderNote={activeTab.orderNote}
            sellerName={currentUser.user.display_name}
            orderCreatedAt={activeTab.createdAt}
            quoteBlockedReason={quoteBlockedReason(cartLines)}
            onCheckoutSuccess={() => {
              setCheckoutOpen(false)
              setTabs((current) => {
                const result = removeCompletedInvoiceTab(current, activeTabId)
                setActiveTabId(result.activeTabId)
                return result.tabs
              })
            }}
          />
        }
      />
      <ProductionQueuePanel
        service={productionQueueService}
        onAddToDraft={handleProductionQueueDraft}
      />
      {productCreateOpen ? (
        <aside aria-label="Tạo hàng hóa" className="pos-product-create-popover">
          <form onSubmit={createProductFromPos}>
            <header>
              <h2>Tạo hàng hóa</h2>
              <button
                aria-label="Đóng tạo hàng hóa"
                type="button"
                onClick={() => setProductCreateOpen(false)}
              >
                ×
              </button>
            </header>
            {productCreateError ? <p role="alert">{productCreateError}</p> : null}
            <label>
              Mã hàng
              <input
                value={productCreateForm.code}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, code: event.target.value }))}
              />
            </label>
            <label>
              Tên hàng
              <input
                required
                value={productCreateForm.name}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Đơn vị
              <input
                required
                value={productCreateForm.unitName}
                onChange={(event) => setProductCreateForm((current) => ({ ...current, unitName: event.target.value }))}
              />
            </label>
            <label>
              Loại bán
              <select
                value={productCreateForm.sellMethod}
                onChange={(event) => setProductCreateForm((current) => ({
                  ...current,
                  sellMethod: event.target.value as SellMethod,
                }))}
              >
                {Object.entries(sellMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" disabled={productCreateSaving} type="submit">
              Thêm hàng hóa
            </button>
          </form>
        </aside>
      ) : null}
      {quickOpeningLine !== null ? (
        <aside aria-label="Khui vật tư nhanh" aria-modal="true" className="pos-material-opening-dialog" role="dialog">
          <form onSubmit={(event) => void submitQuickMaterialOpening(event)}>
            <header>
              <h2>Khui vật tư nhanh</h2>
              <button
                aria-label="Đóng khui vật tư nhanh"
                className="management-icon-button"
                type="button"
                onClick={() => setQuickOpeningLineId(null)}
              >
                ×
              </button>
            </header>
            <p>{quickOpeningLine.product.name}</p>
            {materialOpeningError ? <p role="alert">{materialOpeningError}</p> : null}
            <div className="pos-material-opening-list">
              {quickOpeningShortages.map((shortage) => {
                const options = materialOpeningOptions[shortage.product_id]
                const conversions = options?.conversions ?? shortage.conversion_options
                return (
                  <section key={shortage.product_id} className="pos-material-opening-item">
                    <label>
                      <input
                        aria-label={`Chọn ${shortage.name}`}
                        checked={quickOpeningSelectedIds[shortage.product_id] ?? false}
                        type="checkbox"
                        onChange={(event) =>
                          setQuickOpeningSelectedIds((current) => ({
                            ...current,
                            [shortage.product_id]: event.target.checked,
                          }))
                        }
                      />
                      <strong>{shortage.code} {shortage.name}</strong>
                    </label>
                    <span>Thiếu {formatMeasure(shortage.shortage_qty)} {shortage.stock_unit.name}</span>
                    <label>
                      Số lượng khui {shortage.name}
                      <input
                        aria-label={`Số lượng khui ${shortage.name}`}
                        min="0.001"
                        step="0.001"
                        type="number"
                        value={quickOpeningQtyByProduct[shortage.product_id] ?? 1}
                        onChange={(event) =>
                          setQuickOpeningQtyByProduct((current) => ({
                            ...current,
                            [shortage.product_id]: readPositiveNumber(event.target.value) || 1,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Đơn vị khui {shortage.name}
                      <select
                        aria-label={`Đơn vị khui ${shortage.name}`}
                        value={quickOpeningUnitByProduct[shortage.product_id] ?? conversions[0]?.unit_id ?? ''}
                        onChange={(event) =>
                          setQuickOpeningUnitByProduct((current) => ({
                            ...current,
                            [shortage.product_id]: event.target.value,
                          }))
                        }
                      >
                        {conversions.map((conversion) => (
                          <option key={conversion.unit_id} value={conversion.unit_id}>
                            {conversion.name} ({formatMeasure(conversion.stock_qty_per_unit)} {shortage.stock_unit.name})
                          </option>
                        ))}
                      </select>
                    </label>
                  </section>
                )
              })}
            </div>
            <button className="button button-primary" disabled={materialOpeningSaving} type="submit">
              Xác nhận khui
            </button>
          </form>
        </aside>
      ) : null}
      {manualOpeningOpen ? (
        <aside aria-label="Khui vật tư thủ công" aria-modal="true" className="pos-material-opening-dialog" role="dialog">
          <form onSubmit={(event) => void submitManualMaterialOpening(event)}>
            <header>
              <h2>Khui vật tư thủ công</h2>
              <button
                aria-label="Đóng khui vật tư thủ công"
                className="management-icon-button"
                type="button"
                onClick={closeManualMaterialOpening}
              >
                ×
              </button>
            </header>
            {materialOpeningError ? <p role="alert">{materialOpeningError}</p> : null}
            <label>
              Vật tư
              <select
                aria-label="Vật tư khui thủ công"
                value={manualOpeningProductId}
                onChange={(event) => void selectManualMaterialOpeningProduct(event.target.value)}
              >
                <option value="">Chọn vật tư</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số lượng khui
              <input
                aria-label="Số lượng khui thủ công"
                min="0.001"
                step="0.001"
                type="number"
                value={manualOpeningQty}
                onChange={(event) => setManualOpeningQty(readPositiveNumber(event.target.value))}
              />
            </label>
            <label>
              Đơn vị khui
              <select
                aria-label="Đơn vị khui thủ công"
                value={manualOpeningUnitId}
                onChange={(event) => setManualOpeningUnitId(event.target.value)}
              >
                <option value="">Chọn đơn vị</option>
                {(materialOpeningOptions[manualOpeningProductId]?.conversions ?? []).map((conversion) => (
                  <option key={conversion.unit_id} value={conversion.unit_id}>
                    {conversion.name} ({formatMeasure(conversion.stock_qty_per_unit)} {materialOpeningOptions[manualOpeningProductId]?.product.stock_unit.name})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phần cũ còn lại
              <input
                aria-label="Phần cũ còn lại thủ công"
                min="0"
                step="0.001"
                type="number"
                value={manualOpeningOldRemaining}
                onChange={(event) => setManualOpeningOldRemaining(readNonNegativeNumber(event.target.value))}
              />
            </label>
            <button className="button button-primary" disabled={materialOpeningSaving} type="submit">
              Xác nhận khui
            </button>
          </form>
        </aside>
      ) : null}
    </main>
  )
}

function valueInputCaretIndexFromPointer(input: HTMLInputElement, clientX: number) {
  const value = input.value
  if (value.length === 0) return 0

  const rect = input.getBoundingClientRect()
  if (rect.width <= 0) return value.length

  const style = window.getComputedStyle(input)
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
  const paddingRight = Number.parseFloat(style.paddingRight) || 0
  const measureText = makeInputTextMeasurer(style)
  const textWidth = measureText(value)
  const contentLeft = rect.left + paddingLeft
  const contentRight = rect.right - paddingRight
  const contentWidth = Math.max(contentRight - contentLeft, 1)
  const textLeft =
    style.textAlign === 'right'
      ? contentRight - textWidth
      : style.textAlign === 'center'
        ? contentLeft + (contentWidth - textWidth) / 2
        : contentLeft

  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index <= value.length; index += 1) {
    const distance = Math.abs(textLeft + measureText(value.slice(0, index)) - clientX)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }
  return closestIndex
}

function makeInputTextMeasurer(style: CSSStyleDeclaration) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context === null) {
    return (text: string) => text.length * 8
  }
  context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return (text: string) => context.measureText(text).width
}

function lineDimensions(line: CheckoutCartLine) {
  if (isAreaLine(line) && line.width_m !== undefined && line.height_m !== undefined) {
    return `${formatMeasure(line.width_m)} x ${formatMeasure(line.height_m)} x ${formatMeasure(areaPieceCount(line))} = ${formatMeasure(line.quantity)} m²`
  }
  const parts = [
    line.width_m !== undefined ? `R ${formatMeasure(line.width_m)}m` : null,
    line.height_m !== undefined ? `C ${formatMeasure(line.height_m)}m` : null,
    line.linear_m !== undefined ? `D ${formatMeasure(line.linear_m)}m` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function supportedShortages(preview: PosShortagePreview | undefined): PosShortageMaterial[] {
  return (preview?.shortages ?? []).filter((shortage) =>
    shortage.inventory_shape === 'normal' &&
    shortage.quick_material_opening_supported &&
    shortage.conversion_options.length > 0
  )
}

function shortageSummary(preview: PosShortagePreview | undefined) {
  const shortages = supportedShortages(preview)
  if (shortages.length === 0) return null
  if (shortages.length === 1) {
    const shortage = shortages[0]
    return `Thiếu vật tư: ${shortage.name} thiếu ${formatMeasure(shortage.shortage_qty)} ${shortage.stock_unit.name}`
  }
  return `Thiếu vật tư: ${shortages.length} vật tư có thể khui`
}

function quickOpeningConversion(
  shortage: PosShortageMaterial,
  options: MaterialOpeningOptions | undefined,
  unitId: string | undefined,
): MaterialOpeningConversionOption | undefined {
  const conversions = options?.conversions ?? shortage.conversion_options
  return conversions.find((conversion) => conversion.unit_id === unitId) ?? conversions[0]
}

function compactMeasureInputWidthCh(value: number | string) {
  const text = typeof value === 'string' ? value : formatMeasure(value)
  return Math.min(Math.max(text.length + 2, 3), 8)
}

function moneyInputWidthCh(value: number, min = 4, max = 24) {
  const text = formatMoney(value)
  const digits = text.replace(/\s/g, '').length
  const spaces = text.length - digits
  return Math.min(Math.max(digits + spaces * 0.45 + 1.3, min), max)
}

function cartColumnStyle(lines: CheckoutCartLine[]): CSSProperties {
  const maxUnitWidth = Math.max(3, ...lines.map((line) => unitColumnWidthCh(line)))
  const maxUnitPriceWidth = Math.max(9.5, ...lines.map((line) => moneyInputWidthCh(line.unitPrice)))
  const maxTotalWidth = Math.max(9.5, ...lines.map((line) => moneyInputWidthCh(lineTotal(line))))
  return {
    '--pos-line-unit-width': `${columnWidthRem(maxUnitWidth)}rem`,
    '--pos-line-price-width': `${columnWidthRem(maxUnitPriceWidth)}rem`,
    '--pos-line-total-width': `${columnWidthRem(maxTotalWidth)}rem`,
  } as CSSProperties
}

function unitColumnWidthCh(line: CheckoutCartLine) {
  const unitText = isAreaLine(line)
    ? `${formatMeasure(line.quantity)} ${line.product.unit_name}`
    : line.product.unit_name
  return Math.min(Math.max(unitText.length * 0.75 + 0.5, 2.25), 8)
}

function columnWidthRem(widthCh: number) {
  return Number((widthCh * 0.64).toFixed(2))
}
