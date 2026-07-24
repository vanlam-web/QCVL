import type { Customer, Product, SellMethod } from '../catalog/types'
import type { CheckoutCartLine, InvoiceRevisionHandoffPayload, QuoteReopenPayload } from '../orders/order-service'
import { parseMoneyInput } from '../../lib/number-format'
import { currentSystemISOString } from '../../lib/system-clock'

export const posDraftStorageKey = 'qc-oms.pos.invoice-tabs.v1'
export const maxInvoiceTabs = 10
export const quickProductLoadSize = 120

export type DiscountMode = 'amount' | 'percent'
export type CheckoutPaymentMode = 'cash' | 'bank' | 'mixed'
export type CheckoutSurplusMode = 'return' | 'old-debt'

export interface PosInvoiceTab {
  id: string
  number: number
  createdAt: string
  cartLines: CheckoutCartLine[]
  selectedCustomer: Customer | null
  orderNote: string
  sourceQuote?: { id: string; code: string }
  sourceRevision?: { id: string; code: string }
}

export function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function initialQuotePayloadToTabs(payload: QuoteReopenPayload | null): PosInvoiceTab[] {
  if (payload !== null) {
    return [
      {
        ...makeInvoiceTab(1),
        cartLines: quotePayloadToCartLines(payload),
        selectedCustomer: quotePayloadToCustomer(payload),
        orderNote: `Từ báo giá ${payload.quote.code}`,
        sourceQuote: { id: payload.quote.id, code: payload.quote.code },
      },
    ]
  }

  const restored = restoreInvoiceTabs()
  return restored.length > 0 ? restored : [makeInvoiceTab(1)]
}

export function initialInvoiceRevisionPayloadToTabs(payload: InvoiceRevisionHandoffPayload): PosInvoiceTab[] {
  return [
    {
      ...makeInvoiceTab(1),
      id: `invoice-revision-${payload.original_order.id}`,
      createdAt: payload.created_at ?? currentSystemISOString(),
      cartLines: invoiceRevisionPayloadToCartLines(payload),
      selectedCustomer: invoiceRevisionPayloadToCustomer(payload),
      orderNote: payload.note ?? `Sua hoa don ${payload.original_order.code}`,
      sourceRevision: { id: payload.original_order.id, code: payload.original_order.code },
    },
  ]
}

export function makeInvoiceTab(number: number): PosInvoiceTab {
  return {
    id: `invoice-${number}`,
    number,
    createdAt: currentSystemISOString(),
    cartLines: [],
    selectedCustomer: null,
    orderNote: '',
  }
}

export function invoiceTabLabel(tab: PosInvoiceTab, active = true) {
  if (tab.sourceRevision) {
    return `Sửa ${tab.sourceRevision.code}${isInvoiceTabDirty(tab) ? ' •' : ''}`
  }
  const dirty = isInvoiceTabDirty(tab)
  const prefix = active ? 'Hóa đơn' : 'HĐ'
  return `${prefix} ${tab.number}${dirty ? ' •' : ''}`
}

export function isInvoiceTabDirty(tab: PosInvoiceTab) {
  return tab.cartLines.length > 0 || tab.selectedCustomer !== null || tab.orderNote.trim() !== '' || tab.sourceQuote !== undefined || tab.sourceRevision !== undefined
}

export function nextInvoiceNumber(tabs: PosInvoiceTab[]) {
  const used = new Set(tabs.map((tab) => tab.number))
  for (let number = 1; number <= maxInvoiceTabs; number += 1) {
    if (!used.has(number)) return number
  }
  return Math.min(tabs.length + 1, maxInvoiceTabs)
}

export function removeCompletedInvoiceTab(tabs: PosInvoiceTab[], completedTabId: string) {
  const completedIndex = tabs.findIndex((tab) => tab.id === completedTabId)
  if (completedIndex < 0) return { tabs, activeTabId: tabs[0]?.id ?? makeInvoiceTab(1).id }

  const remaining = tabs.filter((tab) => tab.id !== completedTabId)
  if (remaining.length === 0) {
    const freshTab = makeInvoiceTab(1)
    return { tabs: [freshTab], activeTabId: freshTab.id }
  }

  const nextActiveTab = remaining[Math.min(completedIndex, remaining.length - 1)]
  return { tabs: remaining, activeTabId: nextActiveTab.id }
}

export function persistInvoiceTabs(tabs: PosInvoiceTab[]) {
  window.localStorage.setItem(posDraftStorageKey, JSON.stringify(tabs.slice(0, maxInvoiceTabs)))
}

export function restoreInvoiceTabs(): PosInvoiceTab[] {
  try {
    const raw = window.localStorage.getItem(posDraftStorageKey)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as PosInvoiceTab[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((tab) => Number.isInteger(tab.number) && Array.isArray(tab.cartLines))
      .slice(0, maxInvoiceTabs)
      .map((tab) => ({
        ...makeInvoiceTab(tab.number),
        id: typeof tab.id === 'string' ? tab.id : `invoice-${tab.number}`,
        createdAt: typeof tab.createdAt === 'string' ? tab.createdAt : currentSystemISOString(),
        cartLines: tab.cartLines.map(normalizeRestoredCartLine),
        selectedCustomer: tab.selectedCustomer ?? null,
        orderNote: typeof tab.orderNote === 'string' ? tab.orderNote : '',
        sourceQuote: tab.sourceQuote,
        sourceRevision: tab.sourceRevision,
      }))
  } catch {
    return []
  }
}

export function invoiceRevisionPayloadToCustomer(payload: InvoiceRevisionHandoffPayload): Customer | null {
  if (payload.customer.customer_id === null) return null
  return {
    id: payload.customer.customer_id,
    code: payload.customer.snapshot.code ?? '',
    name: payload.customer.snapshot.name,
    phone: payload.customer.snapshot.phone,
    tax_code: null,
    address: null,
    customer_group_id: null,
    customer_group: null,
  }
}

export function invoiceRevisionPayloadToCartLines(payload: InvoiceRevisionHandoffPayload): CheckoutCartLine[] {
  return payload.items.map((item, index) => ({
    id: `${payload.original_order.id}-revision-${index + 1}`,
    product: {
      id: item.product_id ?? `missing-${item.order_item_id}`,
      code: item.product_snapshot.code,
      name: item.product_snapshot.name,
      status: item.product_id === null ? 'inactive' : 'active',
      unit_name: item.product_snapshot.unit_name,
      sell_method: item.product_snapshot.sell_method,
    },
    quantity: item.quantity,
    width_m: item.width_m ?? undefined,
    height_m: item.height_m ?? undefined,
    linear_m: item.linear_m ?? undefined,
    unitPrice: item.unit_price,
    discountAmount: item.discount_amount,
    priceSource: item.price_source,
    isManualPrice: true,
    note: item.note ?? undefined,
  }))
}

export function quoteBlockedReason(cartLines: CheckoutCartLine[]): string | null {
  const blockedLine = cartLines.find((line) =>
    line.product.status !== 'active' || line.product.id.startsWith('missing-')
  )
  return blockedLine === undefined
    ? null
    : 'Sản phẩm trong báo giá không còn khả dụng. Hãy thay thế dòng trước khi thanh toán.'
}

export function quotePayloadToCustomer(payload: QuoteReopenPayload): Customer | null {
  if (payload.customer.customer_id === null) return null
  return {
    id: payload.customer.customer_id,
    code: payload.customer.snapshot.code ?? '',
    name: payload.customer.snapshot.name,
    phone: payload.customer.snapshot.phone,
    tax_code: null,
    address: null,
    customer_group_id: null,
    customer_group: null,
  }
}

export function quotePayloadToCartLines(payload: QuoteReopenPayload): CheckoutCartLine[] {
  return payload.items.map((item, index) => {
    const blocked = item.warnings.some(
      (warning) => warning.code === 'PRODUCT_INACTIVE' || warning.code === 'PRODUCT_MISSING',
    )
    return {
      id: `${payload.quote.id}-${index + 1}`,
      product: {
        id: item.product_id ?? `missing-${item.order_item_id}`,
        code: item.product_snapshot.code,
        name: item.product_snapshot.name,
        status: blocked ? 'inactive' : 'active',
        unit_name: item.product_snapshot.unit_name,
        sell_method: item.product_snapshot.sell_method,
      },
      quantity: item.quantity,
      width_m: item.width_m ?? undefined,
      height_m: item.height_m ?? undefined,
      linear_m: item.linear_m ?? undefined,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
      priceSource: item.price_source,
      isManualPrice: true,
      note: item.note ?? undefined,
      quoteWarnings: item.warnings,
    }
  })
}

export function readPositiveNumber(value: string): number {
  const normalized = normalizeMeasureInputText(value)
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function readNonNegativeNumber(value: string): number {
  const normalized = normalizeMeasureInputText(value)
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function normalizeMeasureInputText(value: string) {
  let hasDecimal = false
  let normalized = ''
  for (const character of value.trim().replace(/\s/g, '').replace(/,/g, '.')) {
    if (character >= '0' && character <= '9') {
      normalized += character
      continue
    }
    if (character === '.' && !hasDecimal) {
      normalized += character
      hasDecimal = true
    }
  }
  return normalized
}

export function lineInputDraftKey(lineId: string, field: string) {
  return `${lineId}:${field}`
}

export function readPositiveMoney(value: string): number {
  const parsed = parseMoneyInput(value)
  return parsed > 0 ? parsed : 0
}

export function normalizeRestoredCartLine(line: CheckoutCartLine): CheckoutCartLine {
  if (!isAreaLine(line)) return line
  const widthM = line.width_m !== undefined && line.width_m > 0 ? line.width_m : 1
  const heightM = line.height_m !== undefined && line.height_m > 0 ? line.height_m : 1
  const rawPieceCount = line.pieceCount ?? (
    line.width_m !== undefined && line.height_m !== undefined
      ? areaPieceCount(line)
      : 1
  )
  const pieceCount = rawPieceCount > 0 ? rawPieceCount : 1
  return {
    ...line,
    width_m: widthM,
    height_m: heightM,
    pieceCount,
    quantity: areaQuantity(widthM, heightM, pieceCount),
  }
}

export function makeCartLine({
  id,
  product,
  unitPrice,
  priceSource,
}: {
  id: string
  product: Product
  unitPrice: number
  priceSource: string
}): CheckoutCartLine {
  const base = {
    id,
    product,
    unitPrice,
    priceSource,
    isManualPrice: false,
    discountAmount: 0,
  }
  if (!isAreaProduct(product)) return { ...base, quantity: 1 }
  return {
    ...base,
    quantity: 1,
    width_m: 1,
    height_m: 1,
    pieceCount: 1,
  }
}

export function saleUnitOptions(product: Product) {
  const options = displaySaleUnitName(product.unit_name)
    ? [{ unitName: product.unit_name, stockQtyPerUnit: 1 }]
    : []
  for (const conversion of product.unit_conversions ?? []) {
    if (!Number.isFinite(conversion.stock_qty_per_unit) || conversion.stock_qty_per_unit <= 0) continue
    if (!displaySaleUnitName(conversion.unit_name)) continue
    if (options.some((option) => option.unitName === conversion.unit_name)) continue
    options.push({ unitName: conversion.unit_name, stockQtyPerUnit: conversion.stock_qty_per_unit })
  }
  return options
}

export function saleUnitStockQtyPerUnit(product: Product, saleUnitName?: string | null) {
  const selectedUnitName = saleUnitName?.trim() ?? ''
  const baseUnitName = product.unit_name.trim()
  if (selectedUnitName === '' || selectedUnitName === baseUnitName) return 1
  const option = saleUnitOptions(product).find((candidate) => candidate.unitName === selectedUnitName)
  return option?.stockQtyPerUnit ?? 1
}

export function convertSaleUnitPrice(
  product: Product,
  unitPrice: number,
  sourceSaleUnitName?: string | null,
  targetSaleUnitName?: string | null,
) {
  if (isAreaProduct(product)) return Math.max(Math.round(unitPrice), 0)
  const sourceFactor = saleUnitStockQtyPerUnit(product, sourceSaleUnitName)
  const targetFactor = saleUnitStockQtyPerUnit(product, targetSaleUnitName)
  if (sourceFactor <= 0 || targetFactor <= 0) return Math.max(Math.round(unitPrice), 0)
  return Math.max(Math.round((unitPrice / sourceFactor) * targetFactor), 0)
}

export function selectedSaleUnitText(line: CheckoutCartLine) {
  return line.saleUnitName ?? line.product.unit_name
}

export function displaySaleUnitName(value: string | null | undefined) {
  const unitName = value?.trim() ?? ''
  const normalized = unitName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  if (normalized === '' || normalized === 'can cap nhat') return ''
  return unitName
}

export function posPriceWithUnitText(priceText: string, unitName: string | null | undefined) {
  const displayUnit = displaySaleUnitName(unitName)
  return displayUnit ? `${priceText}/${displayUnit}` : priceText
}

export function isAreaLine(line: CheckoutCartLine) {
  return isAreaProduct(line.product)
}

export function isAreaProduct(product: Product) {
  const unitName = product.unit_name.trim().toLowerCase()
  return product.sell_method === 'area_m2' || unitName === 'm²' || unitName === 'm2'
}

export function areaPieceCount(line: CheckoutCartLine) {
  if (line.pieceCount !== undefined) return line.pieceCount
  const area = (line.width_m ?? 0) * (line.height_m ?? 0)
  if (area > 0) return roundMeasure(line.quantity / area)
  return line.quantity > 0 ? line.quantity : 1
}

export function areaQuantity(widthM: number, heightM: number, pieceCount: number) {
  return roundAreaQuantity(widthM * heightM * pieceCount)
}

export function roundAreaQuantity(value: number) {
  return Math.round(value * 100) / 100
}

export function roundMeasure(value: number) {
  return Math.round(value * 1000) / 1000
}

export function draftLineQuantity(draftLine: {
  sell_method: SellMethod
  width_m: number | null
  height_m: number | null
  quantity: number
}) {
  if (draftLine.sell_method !== 'area_m2' || draftLine.width_m === null || draftLine.height_m === null) {
    return draftLine.quantity
  }
  return areaQuantity(draftLine.width_m, draftLine.height_m, draftLine.quantity)
}

export function lineSubtotal(line: CheckoutCartLine): number {
  return Math.round(line.quantity * line.unitPrice)
}

export function lineDiscount(line: CheckoutCartLine): number {
  return Math.min(Math.max(line.discountAmount ?? 0, 0), lineSubtotal(line))
}

export function lineTotal(line: CheckoutCartLine): number {
  return lineSubtotal(line) - lineDiscount(line)
}

export function clampLineDiscount(line: CheckoutCartLine): CheckoutCartLine {
  return {
    ...line,
    discountAmount: lineDiscount(line),
  }
}

export function cartLineDiscountAmountFromPercent(line: CheckoutCartLine, percent: number) {
  const subtotal = lineSubtotal(line)
  return Math.round((subtotal * Math.min(Math.max(percent, 0), 100)) / 100)
}

export function cartLineDiscountPercent(line: CheckoutCartLine) {
  const subtotal = lineSubtotal(line)
  if (subtotal <= 0) return 0
  return Math.round((lineDiscount(line) / subtotal) * 100)
}

export function checkoutSummary({
  cartLines,
  checkoutDiscountAmount,
  cashAmount,
  cashAmountOverride,
  bankAmount,
  paymentMode,
  selectedCustomerId,
  surplusMode,
  oldDebtPaymentAmount,
}: {
  cartLines: CheckoutCartLine[]
  checkoutDiscountAmount: number
  cashAmount?: number
  cashAmountOverride?: number | null
  bankAmount: number
  paymentMode: CheckoutPaymentMode
  selectedCustomerId: string | null
  surplusMode: CheckoutSurplusMode
  oldDebtPaymentAmount: number
}) {
  const subtotal = cartLines.reduce((sum, line) => sum + lineSubtotal(line), 0)
  const lineDiscountAmount = cartLines.reduce((sum, line) => sum + lineDiscount(line), 0)
  const maxCheckoutDiscount = Math.max(subtotal - lineDiscountAmount, 0)
  const normalizedCheckoutDiscount = Math.min(Math.max(checkoutDiscountAmount, 0), maxCheckoutDiscount)
  const discountAmount = lineDiscountAmount + normalizedCheckoutDiscount
  const total = subtotal - discountAmount
  const resolvedCashAmount = cashAmount ?? cashAmountOverride ?? total
  const customerPaymentAmount = paymentMode === 'bank' ? bankAmount : resolvedCashAmount
  const received = resolvedCashAmount + bankAmount
  const surplus = Math.max(received - total, 0)
  const debt = Math.max(total - received, 0)
  const oldDebtPayment = selectedCustomerId !== null && surplusMode === 'old-debt'
    ? oldDebtPaymentAmount + surplus
    : oldDebtPaymentAmount
  const grossCashAmount = resolvedCashAmount + oldDebtPaymentAmount

  return {
    subtotal,
    lineDiscountAmount,
    maxCheckoutDiscount,
    discountAmount,
    total,
    cashAmount: resolvedCashAmount,
    customerPaymentAmount,
    received,
    surplus,
    debt,
    oldDebtPayment,
    grossCashAmount,
  }
}

export function linesToCheckoutItems(lines: CheckoutCartLine[], checkoutDiscountAmount: number) {
  let remainingCheckoutDiscount = Math.max(checkoutDiscountAmount, 0)

  return lines.map((line) => {
    const subtotal = lineSubtotal(line)
    const baseDiscount = lineDiscount(line)
    const extraDiscount = Math.min(remainingCheckoutDiscount, Math.max(subtotal - baseDiscount, 0))
    remainingCheckoutDiscount -= extraDiscount

    return lineToCheckoutItem(line, baseDiscount + extraDiscount)
  })
}

export function lineToCheckoutItem(line: CheckoutCartLine, discountAmount = lineDiscount(line)) {
  return {
    product_id: line.product.id,
    quantity: line.quantity,
    width_m: line.width_m,
    height_m: line.height_m,
    linear_m: line.linear_m,
    unit_price: line.unitPrice,
    sale_unit_name: line.saleUnitName,
    stock_qty_per_sale_unit: line.stockQtyPerSaleUnit,
    discount_amount: Math.min(Math.max(discountAmount, 0), lineSubtotal(line)),
    price_source: line.priceSource,
    note: line.note,
  }
}
