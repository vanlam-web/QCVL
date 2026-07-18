import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  DollarSign,
  Minus,
  ReceiptText,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useState, type CSSProperties, type UIEvent, type WheelEvent } from 'react'
import { ManagementRecordLink, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { ApiError } from '../../lib/api/client'
import type { CurrentUserData } from '../../lib/api/types'
import { dashboardActivityPageSize, dashboardInitialActivityPageSize, emptyDashboardData, type DashboardActivity, type DashboardData, type DashboardLoadInput, type DashboardPeriod, type DashboardService, type DashboardSystemActivity } from './dashboard-service'

const activityIcons = {
  invoice: ShoppingCart,
  payment: ReceiptText,
  purchase: ReceiptText,
} satisfies Record<DashboardActivity['kind'], typeof ShoppingCart>

const dashboardPeriodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last_7_days', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
]
const nextDashboardActivityPageAfterInitial = Math.floor(dashboardInitialActivityPageSize / dashboardActivityPageSize) + 1

export function DashboardPage({
  service,
  onSignOut,
  showSignOut = true,
}: {
  currentUser: CurrentUserData
  service: DashboardService
  onOpenPos: () => void
  onOpenAdmin: () => void
  onOpenPriceBook: () => void
  onOpenSalesDocuments: () => void
  onOpenSuppliers: () => void
  onOpenPurchaseReceipts: () => void
  onSignOut: () => void
  showSignOut?: boolean
}) {
  const [dashboardData, setDashboardData] = useState<DashboardData>(() => emptyDashboardData())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [salesResultPeriod, setSalesResultPeriod] = useState<DashboardPeriod>('month')
  const [revenuePeriod, setRevenuePeriod] = useState<DashboardPeriod>('month')
  const [productRankPeriod, setProductRankPeriod] = useState<DashboardPeriod>('month')
  const [customerRankPeriod, setCustomerRankPeriod] = useState<DashboardPeriod>('month')
  const [salesResultMenuOpen, setSalesResultMenuOpen] = useState(false)
  const [revenueMenuOpen, setRevenueMenuOpen] = useState(false)
  const [revenueView, setRevenueView] = useState<'day' | 'hour' | 'weekday'>('day')
  const [activityTab, setActivityTab] = useState<'recent' | 'system'>('recent')
  const [nextActivityPage, setNextActivityPage] = useState(nextDashboardActivityPageAfterInitial)
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false)
  const dashboardPeriod = revenuePeriod
  const setDashboardPeriod = setRevenuePeriod

  useEffect(() => {
    let active = true
    const loadInput: DashboardLoadInput = {
      salesResultPeriod,
      revenuePeriod,
      productRankPeriod,
      customerRankPeriod,
    }
    setStatus('loading')
    service.loadDashboardData(loadInput)
      .then((data) => {
        if (!active) return
        setDashboardData(data)
        setNextActivityPage(nextDashboardActivityPageAfterInitial)
        setLoadingMoreActivities(false)
        setStatus('ready')
      })
      .catch((cause) => {
        if (!active) return
        if (
          cause instanceof ApiError &&
          ['AUTH_REQUIRED', 'ACCOUNT_INACTIVE', 'PERMISSION_DENIED'].includes(cause.code)
        ) {
          onSignOut()
          return
        }
        setDashboardData(emptyDashboardData())
        setNextActivityPage(nextDashboardActivityPageAfterInitial)
        setLoadingMoreActivities(false)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [service, salesResultPeriod, revenuePeriod, productRankPeriod, customerRankPeriod, onSignOut])

  const revenueAxisMax = dashboardRevenueAxisMax(dashboardData.monthRevenuePoints)
  const revenueBars = dashboardRevenueBars(dashboardData.monthRevenuePoints, revenueAxisMax)
  const revenueScale = dashboardRevenueScale(revenueAxisMax)
  const salesResultPeriodLabel = dashboardPeriodOptions.find((option) => option.value === salesResultPeriod)?.label ?? 'Tháng này'
  const dashboardPeriodLabel = dashboardPeriodOptions.find((option) => option.value === dashboardPeriod)?.label ?? 'Tháng này'
  const ComparisonIcon = dashboardData.salesResultComparison.direction === 'down'
    ? ArrowDownRight
    : dashboardData.salesResultComparison.direction === 'up'
      ? ArrowUpRight
      : Minus

  async function loadMoreActivities() {
    if (!dashboardData.hasMoreActivities || loadingMoreActivities || !service.loadDashboardActivities) return
    setLoadingMoreActivities(true)
    try {
      const nextPage = nextActivityPage
      const activityPage = await service.loadDashboardActivities({
        page: nextPage,
        pageSize: dashboardActivityPageSize,
      })
      setDashboardData((data) => ({
        ...data,
        activities: [...data.activities, ...activityPage.activities],
        hasMoreActivities: activityPage.hasMore,
      }))
      setNextActivityPage(nextPage + 1)
    } finally {
      setLoadingMoreActivities(false)
    }
  }

  return (
    <main className="dashboard-shell">
      {showSignOut ? (
        <header className="dashboard-header">
          <div className="dashboard-header-actions">
            <button className="dashboard-signout-button button button-secondary" type="button" onClick={onSignOut}>
              Đăng xuất
            </button>
          </div>
        </header>
      ) : null}

      <section className="dashboard-grid">
        <div className="dashboard-main-column">
          <section aria-label="Kết quả bán hàng" className="dashboard-card dashboard-kpi-card">
            <header>
              <div>
                <h2>Kết quả bán hàng</h2>
              </div>
              <div className="dashboard-period-filter" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSalesResultMenuOpen(false)
              }}>
                <button
                  aria-expanded={salesResultMenuOpen}
                  aria-haspopup="listbox"
                  aria-label={`Kết quả bán hàng thời gian: ${salesResultPeriodLabel}`}
                  className="dashboard-period-filter-trigger"
                  type="button"
                  onClick={() => setSalesResultMenuOpen((open) => !open)}
                >
                  {salesResultPeriodLabel}
                  <ChevronDown aria-hidden="true" size={14} />
                </button>
                {salesResultMenuOpen ? (
                  <div className="dashboard-period-filter-menu" role="listbox" aria-label="Kết quả bán hàng thời gian">
                    {dashboardPeriodOptions.map((option) => (
                      <button
                        aria-selected={option.value === salesResultPeriod}
                        key={option.value}
                        role="option"
                        type="button"
                        onClick={() => {
                          setSalesResultPeriod(option.value)
                          setSalesResultMenuOpen(false)
                        }}
                      >
                        <span>{option.label}</span>
                        {option.value === salesResultPeriod ? <Check aria-hidden="true" size={15} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {status === 'error' ? <small>Không tải được dữ liệu</small> : null}
            </header>
            <div className="dashboard-kpi-grid">
              <button
                aria-label="Xem nhanh hôm nay"
                aria-pressed={salesResultPeriod === 'today'}
                className="dashboard-kpi-quick-card"
                type="button"
                onClick={() => setSalesResultPeriod('today')}
              >
                <TrendingUp aria-hidden="true" size={20} />
                <span>Hôm nay</span>
                <strong>{dashboardData.todayRevenue}</strong>
                <small>{dashboardData.todayInvoiceCount} hóa đơn</small>
              </button>
              <article>
                <DollarSign aria-hidden="true" size={20} />
                <span>Doanh thu</span>
                <strong>{dashboardData.salesResultRevenue}</strong>
                <small>{dashboardData.salesResultInvoiceCount} hóa đơn</small>
              </article>
              <article className={`dashboard-kpi-comparison-card dashboard-kpi-comparison-${dashboardData.salesResultComparison.direction}`}>
                <ComparisonIcon aria-hidden="true" size={22} />
                <span>Doanh thu thuần</span>
                <strong>{dashboardData.salesResultComparison.percent}</strong>
                <small>{dashboardData.salesResultComparison.label}</small>
              </article>
            </div>
          </section>

          <section aria-label="Biểu đồ doanh thu thuần" className="dashboard-card dashboard-chart-card">
            <header>
              <div>
                <h2>Doanh thu thuần</h2>
                <strong>{dashboardData.monthNetRevenue}</strong>
              </div>
              <div className="dashboard-period-filter" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setRevenueMenuOpen(false)
              }}>
                <button
                  aria-expanded={revenueMenuOpen}
                  aria-haspopup="listbox"
                  aria-label={`Mốc thời gian doanh thu: ${dashboardPeriodLabel}`}
                  className="dashboard-period-filter-trigger"
                  type="button"
                  onClick={() => setRevenueMenuOpen((open) => !open)}
                >
                  {dashboardPeriodLabel}
                  <ChevronDown aria-hidden="true" size={14} />
                </button>
                {revenueMenuOpen ? (
                  <div className="dashboard-period-filter-menu" role="listbox" aria-label="Mốc thời gian doanh thu">
                    {dashboardPeriodOptions.map((option) => (
                      <button
                        aria-selected={option.value === dashboardPeriod}
                        key={option.value}
                        role="option"
                        type="button"
                        onClick={() => {
                          setDashboardPeriod(option.value)
                          setRevenueMenuOpen(false)
                        }}
                      >
                        <span>{option.label}</span>
                        {option.value === dashboardPeriod ? <Check aria-hidden="true" size={15} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </header>
            <div className="dashboard-chart-tabs" role="tablist" aria-label="Kiểu xem doanh thu">
              <button aria-selected={revenueView === 'day'} role="tab" type="button" onClick={() => setRevenueView('day')}>Theo ngày</button>
              <button aria-selected={revenueView === 'hour'} role="tab" type="button" onClick={() => setRevenueView('hour')}>Theo giờ</button>
              <button aria-selected={revenueView === 'weekday'} role="tab" type="button" onClick={() => setRevenueView('weekday')}>Theo thứ</button>
            </div>
            <div className="dashboard-column-chart" role="img" aria-label="Biểu đồ cột doanh thu thuần">
              <div className="dashboard-column-chart-scale" aria-hidden="true">
                {revenueScale.map((label) => <span key={label}>{label}</span>)}
              </div>
              <div
                className="dashboard-column-chart-plot"
                style={{ '--dashboard-day-count': revenueBars.length } as CSSProperties}
              >
                <div className="dashboard-column-chart-grid" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((line) => <i key={line} />)}
                </div>
                <div className="dashboard-column-chart-bars">
                  {revenueBars.map((bar) => (
                    <span key={bar.label} title={`${bar.label}: ${bar.amount}`}>
                      <b style={{ '--dashboard-bar-height': `${bar.height}%` } as CSSProperties} />
                      <em>{bar.label}</em>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="dashboard-split-grid">
            <RankCardDropdown title="Top 10 hàng bán chạy" items={dashboardData.topProducts} period={productRankPeriod} onPeriodChange={setProductRankPeriod} />
            <RankCardDropdown title="Top 10 khách mua nhiều nhất" items={dashboardData.topCustomers} period={customerRankPeriod} onPeriodChange={setCustomerRankPeriod} />
          </div>
        </div>

        <aside className="dashboard-side-column" aria-label="Thông tin phụ">
          <section className="dashboard-card dashboard-security-card" aria-label="Cảnh báo bảo mật">
            <ShieldAlert aria-hidden="true" size={22} />
            <div>
              <h2>Đăng nhập cần kiểm tra</h2>
              <p>Dữ liệu bảo mật đang chờ tích hợp từ hệ thống.</p>
            </div>
            <ArrowRight aria-hidden="true" size={18} />
          </section>

                    <section aria-label="Hoạt động gần đây" className="dashboard-card dashboard-activity-card">
            <header>
              <h2>Hoạt động gần đây</h2>
              <div className="dashboard-activity-tabs" role="tablist" aria-label="Loại hoạt động">
                <button aria-selected={activityTab === 'recent'} role="tab" type="button" onClick={() => setActivityTab('recent')}>
                  Giao dịch
                </button>
                <button aria-selected={activityTab === 'system'} role="tab" type="button" onClick={() => setActivityTab('system')}>
                  Hệ thống
                </button>
              </div>
            </header>
            {activityTab === 'recent' ? (
              <RecentActivityList
                activities={dashboardData.activities}
                hasMore={dashboardData.hasMoreActivities}
                isLoadingMore={loadingMoreActivities}
                onLoadMore={loadMoreActivities}
              />
            ) : <SystemActivityList activities={dashboardData.systemActivities} />}
          </section>
        </aside>
      </section>
    </main>
  )
}

function dashboardRevenueBars(points: number[], axisMax: number) {
  return points.map((point, index) => ({
    label: String(index + 1).padStart(2, '0'),
    amount: formatCompactChartMoney(point),
    height: axisMax > 0 && point > 0 ? Math.max(4, Math.round((point / axisMax) * 100)) : 0,
  }))
}

function dashboardRevenueAxisMax(points: number[]) {
  const maxValue = Math.max(...points, 0)
  return maxValue > 0 ? Math.ceil(maxValue / 1_000_000) * 1_000_000 : 4_000_000
}

function dashboardRevenueScale(axisMax: number) {
  return [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0].map(formatCompactChartMoney)
}

function formatCompactChartMoney(value: number) {
  if (value === 0) return '0'
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(millions)} tr`
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value).replaceAll('.', ' ')
}

function RecentActivityList({
  activities,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  activities: DashboardActivity[]
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  function maybeLoadMore(target: HTMLOListElement) {
    if (!hasMore || isLoadingMore) return
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 24
    if (!nearBottom) return
    onLoadMore()
  }

  function handleScroll(event: UIEvent<HTMLOListElement>) {
    maybeLoadMore(event.currentTarget)
  }

  function handleWheel(event: WheelEvent<HTMLOListElement>) {
    if (event.deltaY <= 0) return
    const target = event.currentTarget
    const hasScrollbar = target.scrollHeight > target.clientHeight
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 24
    if (hasScrollbar && !nearBottom) return
    maybeLoadMore(target)
  }

  return (
    <ol onScroll={handleScroll} onWheel={handleWheel}>
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.kind]
        const counterpartyPath = activity.counterpartyType === 'supplier' ? '/suppliers' : '/customers'
        const documentHref = activity.documentType === 'purchase_receipt'
          ? managementRecordOpenHref('/purchase/receipts', activity.documentCode)
          : managementRecordOpenHref('/sales-documents', activity.documentCode, { type: 'invoice' })
        const counterparty = activity.counterpartyCode ? (
          <ManagementRecordLink className="dashboard-activity-counterparty" href={managementRecordOpenHref(counterpartyPath, activity.counterpartyCode)}>
            {activity.counterpartyLabel}
          </ManagementRecordLink>
        ) : activity.counterpartyLabel
        return (
          <li key={`${activity.documentType ?? activity.kind}-${activity.documentCode}-${index}`}>
            <Icon aria-hidden="true" size={17} />
            <p>
              <span className="dashboard-activity-line">
                <strong>{activity.actor}</strong> {activity.action} {activity.counterpartyPreposition ?? 'cho'} {counterparty} trị giá{' '}
                <span className="dashboard-activity-money">{activity.value}</span> theo{' '}
                <ManagementRecordLink className="dashboard-activity-document" href={documentHref}>
                  {activity.documentCode}
                </ManagementRecordLink>
              </span>
              <small>{activity.time}</small>
            </p>
          </li>
        )
      })}
      {activities.length === 0 ? <li>Chưa có hoạt động bán hàng.</li> : null}
    </ol>
  )
}

function SystemActivityList({ activities }: { activities: DashboardSystemActivity[] }) {
  return (
    <ol>
      {activities.map((activity, index) => (
        <li key={`${activity.actor}-${activity.action}-${activity.target}-${activity.time}-${index}`}>
          <ReceiptText aria-hidden="true" size={17} />
          <p>
            <span className="dashboard-activity-line">
              <strong>{activity.actor}</strong> {activity.action} <b>{activity.target}</b>
            </span>
            <small>{activity.time}</small>
          </p>
        </li>
      ))}
      {activities.length === 0 ? <li>Chưa có hoạt động hệ thống.</li> : null}
    </ol>
  )
}

function RankCardDropdown({ title, items, period, onPeriodChange }: { title: string; items: Array<{ label: string; value: string; width: number }>; period: DashboardPeriod; onPeriodChange: (value: DashboardPeriod) => void }) {
  const [rankMenuOpen, setRankMenuOpen] = useState(false)
  const rankPeriodLabel = dashboardPeriodOptions.find((option) => option.value === period)?.label ?? 'Tháng này'

  return (
    <section aria-label={title} className="dashboard-card dashboard-rank-card">
      <header>
        <h2>{title}</h2>
        <div
          className="dashboard-period-filter"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setRankMenuOpen(false)
          }}
        >
          <button
            aria-expanded={rankMenuOpen}
            aria-haspopup="listbox"
            aria-label={`${title} thời gian: ${rankPeriodLabel}`}
            className="dashboard-period-filter-trigger"
            type="button"
            onClick={() => setRankMenuOpen((open) => !open)}
          >
            {rankPeriodLabel}
            <ChevronDown aria-hidden="true" size={14} />
          </button>
          {rankMenuOpen ? (
            <div className="dashboard-period-filter-menu" role="listbox" aria-label={`${title} thời gian`}>
              {dashboardPeriodOptions.map((option) => (
                <button
                  aria-selected={option.value === period}
                  key={option.value}
                  role="option"
                  type="button"
                  onClick={() => {
                    onPeriodChange(option.value)
                    setRankMenuOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === period ? <Check aria-hidden="true" size={15} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <ol>
        {items.map((item, index) => (
          <li key={item.label}>
            <span>{index + 1}</span>
            <div>
              <strong>{item.label}</strong>
              <i style={{ '--dashboard-rank-width': `${item.width}%` } as CSSProperties} />
            </div>
            <em>{item.value}</em>
          </li>
        ))}
        {items.length === 0 ? <li>Chưa có dữ liệu.</li> : null}
      </ol>
    </section>
  )
}
