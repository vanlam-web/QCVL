import { useEffect, useMemo, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import { quickDateRange, toDisplayDateInput } from '../../lib/date-ranges'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementDateRangeInputs,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import { useManagementTableSort } from '../../components/ui-shell/management-table-sort'
import type { CashbookEntry, CustomerDebtSummary } from '../finance/types'
import type { InventoryProduct } from '../inventory/types'
import type { SalesDocumentListItem } from '../sales-documents/types'
import type { ReportService } from './report-service'
import { reportDateText, reportNumberText, reportOverviewSummary } from './reports-presenter'


type ReportCashbookSortKey = 'code' | 'created_at' | 'finance_account' | 'direction' | 'amount_delta'
type ReportSaleSortKey = 'code' | 'created_at' | 'customer' | 'seller' | 'total_amount' | 'payment_status'
type ReportDebtSortKey = 'customer_code' | 'customer_name' | 'open_invoice_count' | 'oldest_order_code' | 'total_debt'
type ReportInventorySortKey = 'code' | 'name' | 'inventory_shape' | 'available_qty' | 'status'

export function ReportsPage({ service }: { service: ReportService }) {
  const initialRange = useMemo(() => quickDateRange('today'), [])
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [loadedRange, setLoadedRange] = useState(initialRange)
  const [sales, setSales] = useState<SalesDocumentListItem[] | null>(null)
  const [debts, setDebts] = useState<CustomerDebtSummary[] | null>(null)
  const [cashbook, setCashbook] = useState<CashbookEntry[] | null>(null)
  const [inventory, setInventory] = useState<InventoryProduct[] | null>(null)
  const [cashbookSummary, setCashbookSummary] = useState({ opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 })
  const [error, setError] = useState<string | null>(null)

  const { salesTotal, salesPaid, salesDebt, debtTotal, negativeStockCount, inventoryQty } = reportOverviewSummary({
    sales,
    debts,
    inventory,
  })
  const {
    sortedItems: sortedCashbook,
    sortState: reportCashbookSortState,
    requestSort: requestReportCashbookSort,
  } = useManagementTableSort<CashbookEntry, ReportCashbookSortKey>(cashbook ?? [], {
    code: { kind: 'text', value: (entry) => entry.code },
    created_at: { kind: 'date', value: (entry) => entry.created_at },
    finance_account: { kind: 'text', value: (entry) => entry.finance_account.code },
    direction: { kind: 'text', value: (entry) => entry.direction },
    amount_delta: { kind: 'number', value: (entry) => Math.abs(entry.amount_delta) },
  })
  const {
    sortedItems: sortedSales,
    sortState: reportSaleSortState,
    requestSort: requestReportSaleSort,
  } = useManagementTableSort<SalesDocumentListItem, ReportSaleSortKey>(sales ?? [], {
    code: { kind: 'text', value: (document) => document.code },
    created_at: { kind: 'date', value: (document) => document.created_at },
    customer: { kind: 'text', value: (document) => document.customer.name },
    seller: { kind: 'text', value: (document) => document.seller.name },
    total_amount: { kind: 'number', value: (document) => document.total_amount },
    payment_status: { kind: 'text', value: (document) => document.payment_status },
  })
  const {
    sortedItems: sortedDebts,
    sortState: reportDebtSortState,
    requestSort: requestReportDebtSort,
  } = useManagementTableSort<CustomerDebtSummary, ReportDebtSortKey>(debts ?? [], {
    customer_code: { kind: 'text', value: (debt) => debt.customer_code },
    customer_name: { kind: 'text', value: (debt) => debt.customer_name },
    open_invoice_count: { kind: 'number', value: (debt) => debt.open_invoice_count },
    oldest_order_code: { kind: 'text', value: (debt) => debt.oldest_order_code },
    total_debt: { kind: 'number', value: (debt) => debt.total_debt },
  })
  const {
    sortedItems: sortedInventory,
    sortState: reportInventorySortState,
    requestSort: requestReportInventorySort,
  } = useManagementTableSort<InventoryProduct, ReportInventorySortKey>(inventory ?? [], {
    code: { kind: 'text', value: (product) => product.code },
    name: { kind: 'text', value: (product) => product.name },
    inventory_shape: { kind: 'text', value: (product) => product.inventory_shape },
    available_qty: { kind: 'number', value: (product) => product.available_qty },
    status: { kind: 'text', value: (product) => (product.is_negative ? 'negative' : 'ok') },
  })

  async function loadReports(input: { from: string; to: string }) {
    setError(null)
    try {
      const [salesResult, debtResult, cashbookResult, inventoryResult] = await Promise.all([
        service.listSalesDocuments({ from: input.from, to: input.to, page: 1, page_size: 100 }),
        service.listCustomerDebts({ page: 1, page_size: 100 }),
        service.listCashbook({ from: input.from, to: input.to, page: 1, page_size: 100 }),
        service.listInventoryProducts({ page: 1, page_size: 100 }),
      ])
      setSales(salesResult.items)
      setDebts(debtResult.items)
      setCashbook(cashbookResult.items)
      setCashbookSummary(cashbookResult.summary)
      setInventory(inventoryResult.items)
      setLoadedRange(input)
    } catch (cause) {
      setError(formatApiError(cause, 'Không tải được báo cáo.'))
    }
  }

  useEffect(() => {
    let active = true
    async function loadInitial() {
      setError(null)
      try {
        const range = quickDateRange('today')
        const [salesResult, debtResult, cashbookResult, inventoryResult] = await Promise.all([
          service.listSalesDocuments({ from: range.from, to: range.to, page: 1, page_size: 100 }),
          service.listCustomerDebts({ page: 1, page_size: 100 }),
          service.listCashbook({ from: range.from, to: range.to, page: 1, page_size: 100 }),
          service.listInventoryProducts({ page: 1, page_size: 100 }),
        ])
        if (!active) return
        setFrom(range.from)
        setTo(range.to)
        setLoadedRange(range)
        setSales(salesResult.items)
        setDebts(debtResult.items)
        setCashbook(cashbookResult.items)
        setCashbookSummary(cashbookResult.summary)
        setInventory(inventoryResult.items)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được báo cáo.'))
      }
    }
    void loadInitial()
    return () => {
      active = false
    }
  }, [service])

  async function filterReports(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadReports({ from, to })
  }

  return (
    <ManagementPage
      title="Báo cáo"
      kpis={
        <MetricGrid ariaLabel="Tổng quan báo cáo">
          <MetricCard label="Doanh thu" value={<MoneyText value={salesTotal} />} hint={`${loadedRange.from} đến ${loadedRange.to}`} tone="success" />
          <MetricCard label="Đã thu" value={<MoneyText value={salesPaid} />} hint="Theo hóa đơn bán hàng" tone="info" />
          <MetricCard label="Còn nợ" value={<MoneyText value={debtTotal} />} hint="Tổng công nợ hiện tại" tone={debtTotal > 0 ? 'warning' : 'neutral'} />
          <MetricCard label="Âm kho" value={negativeStockCount} hint="Mặt hàng cần kiểm tra" tone={negativeStockCount > 0 ? 'danger' : 'success'} />
        </MetricGrid>
      }
      filter={
        <ManagementFilterSidebar
          ariaLabel="Bộ lọc báo cáo"
          actions={
            <button className="button button-primary" form="reports-filter-form" type="submit">Xem báo cáo</button>
          }
        >
          <form id="reports-filter-form" aria-label="Lọc báo cáo" className="management-filter-sidebar-form" onSubmit={filterReports}>
            <ManagementFilterGroup title="Thời gian">
              <ManagementDateRangeInputs
                displayFrom={toDisplayDateInput(from)}
                displayTo={toDisplayDateInput(to)}
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
              />
            </ManagementFilterGroup>
          </form>
        </ManagementFilterSidebar>
      }
    >
      {error ? <p role="alert">{error}</p> : null}

      <ManagementListSurface ariaLabel="Cuối ngày">
        <h2>Cuối ngày</h2>
        <MetricGrid ariaLabel="Chỉ số cuối ngày">
          <MetricCard label="Hóa đơn" value={sales?.length ?? 0} hint="Hóa đơn hoàn tất" tone="neutral" />
          <MetricCard label="Tiền thu" value={<MoneyText value={cashbookSummary.total_in} />} hint="Dòng thu sổ quỹ" tone="success" />
          <MetricCard label="Tiền chi" value={<MoneyText value={cashbookSummary.total_out} />} hint="Dòng chi sổ quỹ" tone="warning" />
          <MetricCard label="Quỹ cuối" value={<MoneyText value={cashbookSummary.ending_balance} />} hint="Theo sổ quỹ" tone="info" />
        </MetricGrid>
        {cashbook === null ? <p>Đang tải cuối ngày...</p> : null}
        {cashbook !== null && cashbook.length === 0 ? <EmptyState>Chưa có dòng sổ quỹ trong khoảng ngày.</EmptyState> : null}
        {cashbook !== null && cashbook.length > 0 ? (
          <ManagementTableViewport>
            <table aria-label="Dòng sổ quỹ cuối ngày" className="management-table">
              <thead>
                <tr>
                  <ManagementSortableHeader kind="text" sortKey="code" sortState={reportCashbookSortState} onSort={requestReportCashbookSort}>Mã</ManagementSortableHeader>
                  <ManagementSortableHeader kind="date" sortKey="created_at" sortState={reportCashbookSortState} onSort={requestReportCashbookSort}>Ngày</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="finance_account" sortState={reportCashbookSortState} onSort={requestReportCashbookSort}>Tài khoản</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="direction" sortState={reportCashbookSortState} onSort={requestReportCashbookSort}>Hướng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="amount_delta" sortState={reportCashbookSortState} onSort={requestReportCashbookSort}>Số tiền</ManagementSortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedCashbook.slice(0, 8).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.code}</td>
                    <td>{reportDateText(entry.created_at)}</td>
                    <td>{entry.finance_account.code}</td>
                    <td>{entry.direction === 'in' ? 'Thu' : 'Chi'}</td>
                    <td><MoneyText value={Math.abs(entry.amount_delta)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        ) : null}
      </ManagementListSurface>

      <ManagementListSurface ariaLabel="Bán hàng">
        <h2>Bán hàng</h2>
        <MetricGrid ariaLabel="Chỉ số bán hàng">
          <MetricCard label="Tổng tiền" value={<MoneyText value={salesTotal} />} hint="Sau chiết khấu" tone="success" />
          <MetricCard label="Đã thu trên hóa đơn" value={<MoneyText value={salesPaid} />} hint="Không gồm thu nợ cũ" tone="info" />
          <MetricCard label="Nợ phát sinh" value={<MoneyText value={salesDebt} />} hint="Từ hóa đơn trong kỳ" tone={salesDebt > 0 ? 'warning' : 'neutral'} />
        </MetricGrid>
        {sales === null ? <p>Đang tải bán hàng...</p> : null}
        {sales !== null && sales.length === 0 ? <EmptyState>Chưa có hóa đơn bán hàng trong khoảng ngày.</EmptyState> : null}
        {sales !== null && sales.length > 0 ? (
          <ManagementTableViewport>
            <table aria-label="Bán hàng" className="management-table">
              <thead>
                <tr>
                  <ManagementSortableHeader kind="text" sortKey="code" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Mã hóa đơn</ManagementSortableHeader>
                  <ManagementSortableHeader kind="date" sortKey="created_at" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Ngày</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="customer" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Khách</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="seller" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Người bán</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="total_amount" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Tổng tiền</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="payment_status" sortState={reportSaleSortState} onSort={requestReportSaleSort}>Trạng thái thu</ManagementSortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedSales.slice(0, 10).map((document) => (
                  <tr key={document.id}>
                    <td><strong>{document.code}</strong></td>
                    <td>{reportDateText(document.created_at)}</td>
                    <td>{document.customer.name}</td>
                    <td>{document.seller.name}</td>
                    <td><MoneyText value={document.total_amount} /></td>
                    <td><StatusChip tone={document.payment_status === 'paid' ? 'success' : 'warning'}>{document.payment_status}</StatusChip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        ) : null}
      </ManagementListSurface>

      <ManagementListSurface ariaLabel="Công nợ">
        <h2>Công nợ</h2>
        <MetricGrid ariaLabel="Chỉ số công nợ">
          <MetricCard label="Khách còn nợ" value={debts?.length ?? 0} hint="Tối đa 100 dòng đầu" tone="neutral" />
          <MetricCard label="Tổng nợ" value={<MoneyText value={debtTotal} />} hint="Công nợ hiện tại" tone={debtTotal > 0 ? 'warning' : 'success'} />
        </MetricGrid>
        {debts === null ? <p>Đang tải công nợ...</p> : null}
        {debts !== null && debts.length === 0 ? <EmptyState>Chưa có khách còn nợ.</EmptyState> : null}
        {debts !== null && debts.length > 0 ? (
          <ManagementTableViewport>
            <table aria-label="Công nợ" className="management-table">
              <thead>
                <tr>
                  <ManagementSortableHeader kind="text" sortKey="customer_code" sortState={reportDebtSortState} onSort={requestReportDebtSort}>Mã khách</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="customer_name" sortState={reportDebtSortState} onSort={requestReportDebtSort}>Tên khách</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="open_invoice_count" sortState={reportDebtSortState} onSort={requestReportDebtSort}>Hóa đơn nợ</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="oldest_order_code" sortState={reportDebtSortState} onSort={requestReportDebtSort}>Hóa đơn cũ nhất</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="total_debt" sortState={reportDebtSortState} onSort={requestReportDebtSort}>Tổng nợ</ManagementSortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedDebts.slice(0, 10).map((debt) => (
                  <tr key={debt.customer_id ?? debt.customer_name}>
                    <td>{debt.customer_code ?? 'Khách lẻ'}</td>
                    <td>{debt.customer_name}</td>
                    <td>{debt.open_invoice_count}</td>
                    <td>{debt.oldest_order_code ?? '-'}</td>
                    <td><MoneyText value={debt.total_debt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        ) : null}
      </ManagementListSurface>

      <ManagementListSurface ariaLabel="Hàng hóa">
        <h2>Hàng hóa</h2>
        <MetricGrid ariaLabel="Chỉ số tồn kho">
          <MetricCard label="Mặt hàng đang kinh doanh" value={inventory?.length ?? 0} hint="Tối đa 100 dòng đầu" tone="neutral" />
          <MetricCard label="Tồn kho" value={reportNumberText(inventoryQty)} hint="Cộng số lượng tồn" tone="info" />
          <MetricCard label="Âm kho" value={negativeStockCount} hint="Cần kiểm tra" tone={negativeStockCount > 0 ? 'danger' : 'success'} />
        </MetricGrid>
        {inventory === null ? <p>Đang tải hàng hóa...</p> : null}
        {inventory !== null && inventory.length === 0 ? <EmptyState>Chưa có hàng hóa đang kinh doanh.</EmptyState> : null}
        {inventory !== null && inventory.length > 0 ? (
          <ManagementTableViewport>
            <table aria-label="Hàng hóa" className="management-table">
              <thead>
                <tr>
                  <ManagementSortableHeader kind="text" sortKey="code" sortState={reportInventorySortState} onSort={requestReportInventorySort}>Mã hàng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="name" sortState={reportInventorySortState} onSort={requestReportInventorySort}>Tên hàng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="inventory_shape" sortState={reportInventorySortState} onSort={requestReportInventorySort}>Loại hàng</ManagementSortableHeader>
                  <ManagementSortableHeader kind="number" sortKey="available_qty" sortState={reportInventorySortState} onSort={requestReportInventorySort}>Tồn kho</ManagementSortableHeader>
                  <ManagementSortableHeader kind="text" sortKey="status" sortState={reportInventorySortState} onSort={requestReportInventorySort}>Trạng thái</ManagementSortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedInventory.slice(0, 10).map((product) => (
                  <tr key={product.product_id}>
                    <td><strong>{product.code}</strong></td>
                    <td>{product.name}</td>
                    <td>{product.inventory_shape}</td>
                    <td>{reportNumberText(product.available_qty)} {product.stock_unit}</td>
                    <td><StatusChip tone={product.is_negative ? 'danger' : 'success'}>{product.is_negative ? 'Âm kho' : 'Ổn'}</StatusChip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
        ) : null}
      </ManagementListSurface>
    </ManagementPage>
  )
}
