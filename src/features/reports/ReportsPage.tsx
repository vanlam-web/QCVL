import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import { EmptyState, MetricCard, MetricGrid, MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPage,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import type { CashbookEntry, CustomerDebtSummary } from '../finance/types'
import type { InventoryProduct } from '../inventory/types'
import type { SalesDocumentListItem } from '../sales-documents/types'
import type { ReportService } from './report-service'

function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function currentDayRange() {
  const today = localDateString(new Date())
  return { from: today, to: today }
}

function dateText(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

function numberText(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

export function ReportsPage({ service }: { service: ReportService }) {
  const initialRange = useMemo(() => currentDayRange(), [])
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [loadedRange, setLoadedRange] = useState(initialRange)
  const [sales, setSales] = useState<SalesDocumentListItem[] | null>(null)
  const [debts, setDebts] = useState<CustomerDebtSummary[] | null>(null)
  const [cashbook, setCashbook] = useState<CashbookEntry[] | null>(null)
  const [inventory, setInventory] = useState<InventoryProduct[] | null>(null)
  const [cashbookSummary, setCashbookSummary] = useState({ opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 })
  const [error, setError] = useState<string | null>(null)

  const salesTotal = sales?.reduce((sum, item) => sum + item.total_amount, 0) ?? 0
  const salesPaid = sales?.reduce((sum, item) => sum + item.paid_amount, 0) ?? 0
  const salesDebt = sales?.reduce((sum, item) => sum + item.debt_amount, 0) ?? 0
  const debtTotal = debts?.reduce((sum, item) => sum + item.total_debt, 0) ?? 0
  const negativeStockCount = inventory?.filter((item) => item.is_negative).length ?? 0
  const inventoryQty = inventory?.reduce((sum, item) => sum + item.available_qty, 0) ?? 0

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
        const range = currentDayRange()
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
              <label>
                <span className="management-compact-search-leading"><CalendarDays aria-hidden="true" size={16} /></span>
                Từ ngày
                <input aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                <span className="management-compact-search-leading"><CalendarDays aria-hidden="true" size={16} /></span>
                Đến ngày
                <input aria-label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
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
                  <th>Mã</th>
                  <th>Ngày</th>
                  <th>Tài khoản</th>
                  <th>Hướng</th>
                  <th>Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {cashbook.slice(0, 8).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.code}</td>
                    <td>{dateText(entry.created_at)}</td>
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
                  <th>Mã hóa đơn</th>
                  <th>Ngày</th>
                  <th>Khách</th>
                  <th>Người bán</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái thu</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map((document) => (
                  <tr key={document.id}>
                    <td><strong>{document.code}</strong></td>
                    <td>{dateText(document.created_at)}</td>
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
                  <th>Mã khách</th>
                  <th>Tên khách</th>
                  <th>Hóa đơn nợ</th>
                  <th>Hóa đơn cũ nhất</th>
                  <th>Tổng nợ</th>
                </tr>
              </thead>
              <tbody>
                {debts.slice(0, 10).map((debt) => (
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
          <MetricCard label="Tồn kho" value={numberText(inventoryQty)} hint="Cộng số lượng tồn" tone="info" />
          <MetricCard label="Âm kho" value={negativeStockCount} hint="Cần kiểm tra" tone={negativeStockCount > 0 ? 'danger' : 'success'} />
        </MetricGrid>
        {inventory === null ? <p>Đang tải hàng hóa...</p> : null}
        {inventory !== null && inventory.length === 0 ? <EmptyState>Chưa có hàng hóa đang kinh doanh.</EmptyState> : null}
        {inventory !== null && inventory.length > 0 ? (
          <ManagementTableViewport>
            <table aria-label="Hàng hóa" className="management-table">
              <thead>
                <tr>
                  <th>Mã hàng</th>
                  <th>Tên hàng</th>
                  <th>Loại hàng</th>
                  <th>Tồn kho</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {inventory.slice(0, 10).map((product) => (
                  <tr key={product.product_id}>
                    <td><strong>{product.code}</strong></td>
                    <td>{product.name}</td>
                    <td>{product.inventory_shape}</td>
                    <td>{numberText(product.available_qty)} {product.stock_unit}</td>
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
