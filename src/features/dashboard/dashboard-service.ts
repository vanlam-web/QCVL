import { createBrowserSalesDocumentService, type SalesDocumentService } from '../sales-documents/sales-document-service'
import type { SalesDocumentDetail, SalesDocumentListItem } from '../sales-documents/types'
import { createBrowserPurchaseReceiptService, type PurchaseReceiptService } from '../purchase/purchase-receipt-service'
import type { PurchaseReceipt } from '../purchase/purchase-receipt-types'
import { createBrowserCatalogService, type CatalogService } from '../catalog/catalog-service'
import { displayDateKey } from '../../lib/date-format'
import { currentSystemDate } from '../../lib/system-clock'

export interface DashboardRankItem {
  label: string
  value: string
  width: number
}

export interface DashboardActivity {
  kind: 'invoice' | 'payment' | 'purchase'
  actor: string
  action: string
  counterpartyPreposition?: 'cho' | 'từ'
  counterpartyLabel: string
  counterpartyCode?: string
  counterpartyType?: 'customer' | 'supplier'
  value: string
  documentCode: string
  documentType?: 'sales_invoice' | 'purchase_receipt'
  time: string
}

export interface DashboardSystemActivity {
  actor: string
  action: string
  target: string
  time: string
}

export interface DashboardData {
  todayRevenue: string
  todayInvoiceCount: number
  todayNetRevenue: string
  salesResultRevenue: string
  salesResultInvoiceCount: number
  salesResultNetRevenue: string
  salesResultComparison: DashboardComparison
  monthNetRevenue: string
  monthRevenuePoints: number[]
  weekdayBars: Array<{ label: string; value: number }>
  topProducts: DashboardRankItem[]
  topCustomers: DashboardRankItem[]
  activities: DashboardActivity[]
  hasMoreActivities: boolean
  systemActivities: DashboardSystemActivity[]
}

export interface DashboardComparison {
  direction: 'up' | 'down' | 'flat'
  percent: string
  label: string
}

export type DashboardPeriod = 'today' | 'yesterday' | 'last_7_days' | 'month' | 'last_month'

export interface DashboardLoadInput {
  salesResultPeriod?: DashboardPeriod
  revenuePeriod?: DashboardPeriod
  productRankPeriod?: DashboardPeriod
  customerRankPeriod?: DashboardPeriod
}

export interface DashboardService {
  loadDashboardData(input?: DashboardLoadInput): Promise<DashboardData>
  loadDashboardActivities?(input?: DashboardActivityLoadInput): Promise<DashboardActivityPage>
}

export interface DashboardClockProvider {
  now(): Promise<Date>
}

export interface DashboardActivityLoadInput {
  page?: number
  pageSize?: number
}

export interface DashboardActivityPage {
  activities: DashboardActivity[]
  hasMore: boolean
}

const maxDashboardDocuments = 100
export const dashboardInitialActivityPageSize = 20
export const dashboardActivityPageSize = 20
const maxRankItems = 10
const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

type DashboardProductRankLine = {
  product_id?: string | null
  product?: { code?: string | null; name?: string | null }
  product_snapshot?: { code?: string | null; name?: string | null }
  quantity?: number | string | null
  unit_price?: number | string | null
  discount_amount?: number | string | null
  line_total?: number | string | null
}

type DashboardProductRankDocument = SalesDocumentListItem & {
  items?: DashboardProductRankLine[]
}

type DashboardProductCatalogService = Pick<CatalogService, 'listProducts'>

type DashboardProductCatalogItem = {
  id: string
  code?: string | null
  name?: string | null
}

export function createDashboardService(
  salesDocumentService: SalesDocumentService,
  purchaseReceiptService?: PurchaseReceiptService,
  catalogService?: DashboardProductCatalogService,
  clockProvider: DashboardClockProvider = localDashboardClock,
): DashboardService {
  return {
    async loadDashboardData(input = {}) {
      const today = await clockProvider.now()
      const todayText = dateInputText(today)
      const salesResultPeriod = input.salesResultPeriod ?? 'month'
      const revenuePeriod = input.revenuePeriod ?? 'month'
      const productRankPeriod = input.productRankPeriod ?? 'month'
      const customerRankPeriod = input.customerRankPeriod ?? 'month'
      const salesResultRange = dashboardPeriodRange(today, salesResultPeriod)
      const previousSalesResultRange = dashboardPreviousPeriodRange(today, salesResultPeriod)
      const revenueRange = dashboardPeriodRange(today, revenuePeriod)
      const productRankRange = dashboardPeriodRange(today, productRankPeriod)
      const customerRankRange = dashboardPeriodRange(today, customerRankPeriod)
      const periodDocuments = new Map<string, Promise<SalesDocumentListItem[]>>()
      const loadPeriodDocuments = (range: DashboardDateRange) => {
        const key = `${range.from}:${range.to}`
        const existing = periodDocuments.get(key)
        if (existing) return existing
        const promise = listAllDashboardSalesDocuments(salesDocumentService, {
          type: 'invoice',
          from: range.from,
          to: range.to,
        })
        periodDocuments.set(key, promise)
        return promise
      }

      const [todayDocumentsResult, salesResultDocumentsResult, previousSalesResultDocumentsResult, revenueDocumentsResult, productRankDocumentsResult, customerRankDocumentsResult, recentDocumentsResult, recentPurchaseReceiptsResult] = await Promise.all([
        listAllDashboardSalesDocuments(salesDocumentService, {
          type: 'invoice',
          from: todayText,
          to: todayText,
        }),
        loadPeriodDocuments(salesResultRange),
        loadPeriodDocuments(previousSalesResultRange),
        loadPeriodDocuments(revenueRange),
        loadPeriodDocuments(productRankRange),
        loadPeriodDocuments(customerRankRange),
        listDashboardSalesDocumentsPage(salesDocumentService, {
          type: 'invoice',
          page: 1,
          page_size: dashboardInitialActivityPageSize,
        }),
        purchaseReceiptService ? safeListDashboardPurchaseReceiptsPage(purchaseReceiptService, {
          status: 'posted',
          page: 1,
          page_size: dashboardInitialActivityPageSize,
        }) : emptyDashboardPurchaseReceiptPage(),
      ])

      const todayDocuments = activeDocuments(todayDocumentsResult)
      const salesResultDocuments = activeDocuments(salesResultDocumentsResult)
      const previousSalesResultDocuments = activeDocuments(previousSalesResultDocumentsResult)
      const revenueDocuments = activeDocuments(revenueDocumentsResult)
      const productRankDocuments = activeDocuments(productRankDocumentsResult)
      const customerRankDocuments = activeDocuments(customerRankDocumentsResult)
      const recentDocuments = activeDocuments(recentDocumentsResult.items)
      const recentPurchaseReceipts = activePurchaseReceipts(recentPurchaseReceiptsResult.items)
      const productCatalog = await loadDashboardProductCatalog(catalogService, productRankDocuments)

      return buildDashboardData({
        now: today,
        todayDocuments,
        salesResultDocuments,
        previousSalesResultDocuments,
        salesResultComparisonLabel: salesResultComparisonLabel(salesResultPeriod),
        monthDocuments: revenueDocuments,
        revenueRange,
        recentDocuments,
        recentPurchaseReceipts,
        recentHasMore: recentDocumentsResult.hasMore || recentPurchaseReceiptsResult.hasMore,
        detailedDocuments: productRankDocuments,
        productCatalog,
        customerDocuments: customerRankDocuments,
      })
    },
    async loadDashboardActivities(input = {}) {
      const page = input.page ?? 1
      const pageSize = input.pageSize ?? dashboardActivityPageSize
      const now = await clockProvider.now()
      const [result, purchaseResult] = await Promise.all([
        listDashboardSalesDocumentsPage(salesDocumentService, {
          type: 'invoice',
          page,
          page_size: pageSize,
        }),
        purchaseReceiptService ? safeListDashboardPurchaseReceiptsPage(purchaseReceiptService, {
          status: 'posted',
          page,
          page_size: pageSize,
        }) : emptyDashboardPurchaseReceiptPage(),
      ])
      return buildDashboardActivityPage({
        now,
        documents: activeDocuments(result.items),
        purchaseReceipts: activePurchaseReceipts(purchaseResult.items),
        hasMore: result.hasMore || purchaseResult.hasMore,
      })
    },
  }
}

const localDashboardClock: DashboardClockProvider = {
  async now() {
    return currentSystemDate()
  },
}

interface DashboardDateRange {
  from: string
  to: string
}

function dashboardPeriodRange(now: Date, period: DashboardPeriod): DashboardDateRange {
  if (period === 'today') return { from: dateInputText(now), to: dateInputText(now) }
  if (period === 'yesterday') {
    const yesterday = addDays(now, -1)
    return { from: dateInputText(yesterday), to: dateInputText(yesterday) }
  }
  if (period === 'last_7_days') return { from: dateInputText(addDays(now, -6)), to: dateInputText(now) }
  if (period === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: dateInputText(from), to: dateInputText(to) }
  }
  return { from: dateInputText(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateInputText(now) }
}

function dashboardPreviousPeriodRange(now: Date, period: DashboardPeriod): DashboardDateRange {
  if (period === 'today') {
    const yesterday = addDays(now, -1)
    return { from: dateInputText(yesterday), to: dateInputText(yesterday) }
  }
  if (period === 'yesterday') {
    const previousDay = addDays(now, -2)
    return { from: dateInputText(previousDay), to: dateInputText(previousDay) }
  }
  if (period === 'last_7_days') return { from: dateInputText(addDays(now, -13)), to: dateInputText(addDays(now, -7)) }
  if (period === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const to = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    return { from: dateInputText(from), to: dateInputText(to) }
  }
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const day = Math.min(now.getDate(), previousMonthEnd.getDate())
  const previousMonthTo = new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), day)
  return { from: dateInputText(previousMonthStart), to: dateInputText(previousMonthTo) }
}

function salesResultComparisonLabel(period: DashboardPeriod) {
  if (period === 'today') return 'So với hôm qua'
  if (period === 'yesterday') return 'So với ngày trước đó'
  if (period === 'last_7_days') return 'So với 7 ngày trước'
  if (period === 'last_month') return 'So với tháng trước đó'
  return 'So với cùng kỳ tháng trước'
}

function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}

async function listAllDashboardSalesDocuments(
  service: SalesDocumentService,
  input: Parameters<SalesDocumentService['listSalesDocuments']>[0],
) {
  const items = []
  const firstPage = await service.listSalesDocuments({
    ...input,
    page: 1,
    page_size: maxDashboardDocuments,
  })
  items.push(...firstPage.items)

  const totalPages = Math.ceil(firstPage.total / maxDashboardDocuments)
  if (totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => (
      service.listSalesDocuments({
        ...input,
        page: index + 2,
        page_size: maxDashboardDocuments,
      })
    )))
    for (const result of rest) {
      items.push(...result.items)
    }
  }

  return items
}

async function listDashboardSalesDocumentsPage(
  service: SalesDocumentService,
  input: Parameters<SalesDocumentService['listSalesDocuments']>[0],
) {
  const query = input ?? {}
  const page = query.page ?? 1
  const pageSize = query.page_size ?? maxDashboardDocuments
  const result = await service.listSalesDocuments({
    ...query,
    page,
    page_size: pageSize,
  })
  return {
    items: result.items,
    hasMore: result.total > page * pageSize || result.items.length === pageSize,
  }
}

async function listDashboardPurchaseReceiptsPage(
  service: PurchaseReceiptService,
  input: Parameters<PurchaseReceiptService['listReceipts']>[0],
) {
  const query = input ?? {}
  const page = query.page ?? 1
  const pageSize = query.page_size ?? maxDashboardDocuments
  const result = await service.listReceipts({
    ...query,
    page,
    page_size: pageSize,
  })
  return {
    items: result.items,
    hasMore: result.total > page * pageSize || result.items.length === pageSize,
  }
}

async function safeListDashboardPurchaseReceiptsPage(
  service: PurchaseReceiptService,
  input: Parameters<PurchaseReceiptService['listReceipts']>[0],
) {
  try {
    return await listDashboardPurchaseReceiptsPage(service, input)
  } catch {
    return emptyDashboardPurchaseReceiptPage()
  }
}

async function loadDashboardProductCatalog(
  service: DashboardProductCatalogService | undefined,
  documents: DashboardProductRankDocument[],
) {
  if (!service || !productRanksNeedCatalog(documents)) return []
  try {
    const result = await service.listProducts({ status: 'all', page: 1, page_size: 10000 })
    return result.items.map((item) => ({ id: item.id, code: item.code, name: item.name }))
  } catch {
    return []
  }
}

function productRanksNeedCatalog(documents: DashboardProductRankDocument[]) {
  return documents.some((document) => (document.items ?? []).some((item) => {
    const hasSnapshotLabel = Boolean(stringValue(item.product?.name) || stringValue(item.product_snapshot?.name))
    return !hasSnapshotLabel && Boolean(stringValue(item.product_id))
  }))
}

function emptyDashboardPurchaseReceiptPage() {
  return {
    items: [] as PurchaseReceipt[],
    hasMore: false,
  }
}

export function createBrowserDashboardService(getAccessToken: () => Promise<string | null>) {
  return createDashboardService(
    createBrowserSalesDocumentService(getAccessToken),
    createBrowserPurchaseReceiptService(getAccessToken),
    createBrowserCatalogService(getAccessToken),
  )
}

export function emptyDashboardData(): DashboardData {
  return {
    todayRevenue: '0',
    todayInvoiceCount: 0,
    todayNetRevenue: '0',
    salesResultRevenue: '0',
    salesResultInvoiceCount: 0,
    salesResultNetRevenue: '0',
    salesResultComparison: {
      direction: 'flat',
      percent: '0.00%',
      label: 'So với hôm qua',
    },
    monthNetRevenue: '0',
    monthRevenuePoints: Array.from({ length: 12 }, () => 0),
    weekdayBars: weekdayLabels.slice(1).concat(weekdayLabels[0]).map((label) => ({ label, value: 0 })),
    topProducts: [],
    topCustomers: [],
    activities: [],
    hasMoreActivities: false,
    systemActivities: [],
  }
}

export function buildDashboardData({
  now,
  todayDocuments,
  salesResultDocuments = todayDocuments,
  previousSalesResultDocuments = [],
  salesResultComparisonLabel = 'So với hôm qua',
  monthDocuments,
  revenueRange,
  recentDocuments,
  recentPurchaseReceipts = [],
  recentHasMore = false,
  detailedDocuments,
  productCatalog,
  customerDocuments = monthDocuments,
  systemDetails,
}: {
  now: Date
  todayDocuments: SalesDocumentListItem[]
  salesResultDocuments?: SalesDocumentListItem[]
  previousSalesResultDocuments?: SalesDocumentListItem[]
  salesResultComparisonLabel?: string
  monthDocuments: SalesDocumentListItem[]
  revenueRange?: DashboardDateRange
  recentDocuments: SalesDocumentListItem[]
  recentPurchaseReceipts?: PurchaseReceipt[]
  recentHasMore?: boolean
  detailedDocuments: DashboardProductRankDocument[]
  productCatalog?: DashboardProductCatalogItem[]
  customerDocuments?: SalesDocumentListItem[]
  systemDetails?: SalesDocumentDetail[]
}): DashboardData {
  const todayRevenue = sum(todayDocuments, (document) => document.total_amount)
  const todayNetRevenue = sum(todayDocuments, netDocumentAmount)
  const salesResultRevenue = sum(salesResultDocuments, (document) => document.total_amount)
  const salesResultNetRevenue = sum(salesResultDocuments, netDocumentAmount)
  const previousSalesResultNetRevenue = sum(previousSalesResultDocuments, netDocumentAmount)
  const monthNetRevenue = sum(monthDocuments, netDocumentAmount)

  return {
    todayRevenue: formatDashboardMoney(todayRevenue),
    todayInvoiceCount: todayDocuments.length,
    todayNetRevenue: formatDashboardMoney(todayNetRevenue),
    salesResultRevenue: formatDashboardMoney(salesResultRevenue),
    salesResultInvoiceCount: salesResultDocuments.length,
    salesResultNetRevenue: formatDashboardMoney(salesResultNetRevenue),
    salesResultComparison: dashboardComparison(salesResultNetRevenue, previousSalesResultNetRevenue, salesResultComparisonLabel),
    monthNetRevenue: formatDashboardMoney(monthNetRevenue),
    monthRevenuePoints: revenueRange ? periodRevenuePoints(revenueRange, monthDocuments) : monthRevenuePoints(now, monthDocuments),
    weekdayBars: weekdayRevenueBars(monthDocuments),
    topProducts: topProductRanks(detailedDocuments, productCatalog),
    topCustomers: topCustomerRanks(customerDocuments),
    activities: dashboardActivities(now, recentDocuments, recentPurchaseReceipts),
    hasMoreActivities: recentHasMore,
    systemActivities: systemDetails ? systemActivityItems(now, systemDetails) : [],
  }
}

function buildDashboardActivityPage({
  now,
  documents,
  purchaseReceipts = [],
  hasMore,
}: {
  now: Date
  documents: SalesDocumentListItem[]
  purchaseReceipts?: PurchaseReceipt[]
  hasMore: boolean
}): DashboardActivityPage {
  return {
    activities: dashboardActivities(now, documents, purchaseReceipts),
    hasMore,
  }
}

function dashboardActivities(now: Date, documents: SalesDocumentListItem[], purchaseReceipts: PurchaseReceipt[] = []) {
  return [
    ...documents.map((document) => ({
      kind: document.paid_amount > 0 ? 'payment' as const : 'invoice' as const,
      actor: document.seller.name || 'Nhân viên',
      action: document.paid_amount > 0 ? 'bán và thu hóa đơn' : 'bán hóa đơn',
      counterpartyPreposition: 'cho' as const,
      counterpartyLabel: counterpartyLabel(document),
      counterpartyCode: counterpartyCode(document),
      counterpartyType: 'customer' as const,
      value: formatDashboardMoney(document.total_amount),
      documentCode: document.code,
      documentType: 'sales_invoice' as const,
      time: relativeTimeText(new Date(document.created_at), now),
      at: document.created_at,
    })),
    ...purchaseReceipts.map((receipt) => ({
      kind: 'purchase' as const,
      actor: receipt.created_by.name || 'Nhân viên',
      action: 'mua hàng',
      counterpartyPreposition: 'từ' as const,
      counterpartyLabel: receipt.supplier.name || 'NCC lẻ',
      counterpartyCode: receipt.supplier.code || undefined,
      counterpartyType: 'supplier' as const,
      value: formatDashboardMoney(receipt.payable_amount),
      documentCode: receipt.code,
      documentType: 'purchase_receipt' as const,
      time: relativeTimeText(new Date(receipt.created_at), now),
      at: receipt.created_at,
    })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .map((item) => {
      const { at, ...activity } = item
      void at
      return activity
    })
}

function counterpartyLabel(document: SalesDocumentListItem) {
  return document.customer.name || 'khách lẻ'
}

function counterpartyCode(document: SalesDocumentListItem) {
  return document.customer.code || undefined
}

function activeDocuments(documents: SalesDocumentListItem[]) {
  return documents.filter((document) => document.status !== 'cancelled')
}

function activePurchaseReceipts(receipts: PurchaseReceipt[]) {
  return receipts.filter((receipt) => receipt.status !== 'cancelled')
}

function netDocumentAmount(document: SalesDocumentListItem) {
  return Math.max(document.total_amount, 0)
}

function monthRevenuePoints(now: Date, documents: SalesDocumentListItem[]) {
  const currentDayOfMonth = now.getDate()
  const buckets = Array.from({ length: currentDayOfMonth }, () => 0)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  for (const document of documents) {
    const createdAtKey = displayDateKey(document.created_at)
    if (!createdAtKey.startsWith(`${currentMonthKey}-`)) continue
    const day = Number(createdAtKey.slice(8, 10))
    if (!Number.isFinite(day) || day < 1 || day > currentDayOfMonth) continue
    buckets[day - 1] += netDocumentAmount(document)
  }
  return buckets.length > 1 ? buckets : [0, buckets[0] ?? 0]
}

function periodRevenuePoints(range: DashboardDateRange, documents: SalesDocumentListItem[]) {
  const fromKey = displayDateKey(range.from)
  const toKey = displayDateKey(range.to)
  const from = dateKeyToUtcDate(fromKey)
  const to = dateKeyToUtcDate(toKey)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const buckets = Array.from({ length: days }, () => 0)
  for (const document of documents) {
    const createdAt = dateKeyToUtcDate(displayDateKey(document.created_at))
    const index = Math.round((createdAt.getTime() - from.getTime()) / 86_400_000)
    if (index < 0 || index >= buckets.length) continue
    buckets[index] += netDocumentAmount(document)
  }
  return buckets.length > 1 ? buckets : [0, buckets[0] ?? 0]
}

function dateKeyToUtcDate(value: string) {
  if (!value) return new Date(NaN)
  const [year, month, day] = value.split('-').map((part) => Number(part))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date(NaN)
  return new Date(Date.UTC(year, month - 1, day))
}

function weekdayRevenueBars(documents: SalesDocumentListItem[]) {
  const totals = new Map(weekdayLabels.map((label) => [label, 0]))
  for (const document of documents) {
    const dateKey = displayDateKey(document.created_at)
    const label = weekdayLabels[dateKeyToUtcDate(dateKey).getUTCDay()]
    totals.set(label, (totals.get(label) ?? 0) + netDocumentAmount(document))
  }
  const maxValue = Math.max(...totals.values(), 0)
  return weekdayLabels.slice(1).concat(weekdayLabels[0]).map((label) => ({
    label,
    value: maxValue > 0 ? Math.max(6, Math.round(((totals.get(label) ?? 0) / maxValue) * 100)) : 0,
  }))
}

function topProductRanks(documents: DashboardProductRankDocument[], productCatalog: DashboardProductCatalogItem[] = []) {
  const totals = new Map<string, number>()
  const productCatalogById = new Map(productCatalog.map((item) => [item.id, item]))
  for (const document of documents) {
    for (const item of document.items ?? []) {
      const label = productRankLabel(item, productCatalogById)
      const value = productRankLineTotal(item)
      if (!label || !Number.isFinite(value)) continue
      totals.set(label, (totals.get(label) ?? 0) + value)
    }
  }
  return rankItems(totals)
}

function productRankLabel(item: DashboardProductRankLine, productCatalogById: ReadonlyMap<string, DashboardProductCatalogItem>) {
  const productId = stringValue(item.product_id)
  const catalogProduct = productId ? productCatalogById.get(productId) : undefined
  const code = stringValue(item.product?.code) || stringValue(item.product_snapshot?.code) || stringValue(catalogProduct?.code)
  const name = stringValue(item.product?.name) || stringValue(item.product_snapshot?.name) || stringValue(catalogProduct?.name)
  if (code && name) return `${code} ${name}`
  if (name) return name
  if (code) return code
  return productId
}

function productRankLineTotal(item: DashboardProductRankLine) {
  const lineTotal = Number(item.line_total)
  if (Number.isFinite(lineTotal) && lineTotal > 0) return lineTotal
  const quantity = Number(item.quantity ?? 1)
  const unitPrice = Number(item.unit_price ?? 0)
  const discountAmount = Number(item.discount_amount ?? 0)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(discountAmount)) return 0
  return Math.max(quantity * unitPrice - discountAmount, 0)
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function topCustomerRanks(documents: SalesDocumentListItem[]) {
  const totals = new Map<string, number>()
  for (const document of documents) {
    const label = document.customer.code ? `${document.customer.code} ${document.customer.name}` : document.customer.name
    totals.set(label, (totals.get(label) ?? 0) + document.total_amount)
  }
  return rankItems(totals)
}

function systemActivityItems(now: Date, documents: SalesDocumentDetail[]) {
  return documents
    .flatMap((document) => document.history.map((entry) => ({
      actor: entry.actor_name || 'H\u1ec7 th\u1ed1ng',
      action: systemActionText(entry.action),
      target: document.code,
      time: relativeTimeText(new Date(entry.at), now),
      at: entry.at,
    })))
    .filter((activity) => activity.action !== '')
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 8)
    .map((item) => {
      const { at, ...activity } = item
      void at
      return activity
    })
}

function systemActionText(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes('delete') || normalized.includes('cancel') || normalized.includes('xo')) return 'x\u00f3a'
  if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('sua') || normalized.includes('s\u1eeda')) return 's\u1eeda'
  if (normalized.includes('create') || normalized.includes('add') || normalized.includes('tao') || normalized.includes('th\u00eam')) return 'th\u00eam'
  return ''
}

function rankItems(totals: Map<string, number>) {
  const sorted = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxRankItems)
  const maxValue = Math.max(...sorted.map(([, value]) => value), 0)
  return sorted.map(([label, value]) => ({
    label,
    value: compactMoneyText(value),
    width: maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 0,
  }))
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0)
}

function formatDashboardMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value).replaceAll('.', ' ')
}

function compactMoneyText(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(millions)}tr`
  }
  return formatDashboardMoney(value)
}

function dashboardComparison(current: number, previous: number, label: string): DashboardComparison {
  const direction = current === previous ? 'flat' : current > previous ? 'up' : 'down'
  if (previous === 0) {
    return {
      direction,
      percent: current === 0 ? '0.00%' : '100.00%',
      label,
    }
  }
  const changePercent = ((current - previous) / previous) * 100
  return {
    direction,
    percent: `${changePercent < 0 ? '-' : ''}${Math.abs(changePercent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
    label,
  }
}

function relativeTimeText(value: Date, now: Date) {
  const diffMs = Math.max(now.getTime() - value.getTime(), 0)
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${Math.floor(diffHours / 24)} ngày trước`
}

function dateInputText(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
