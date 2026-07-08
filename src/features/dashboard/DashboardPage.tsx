import {
  ArrowRight,
  DollarSign,
  PackagePlus,
  ReceiptText,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { CurrentUserData } from '../../lib/api/types'

const chartWidth = 640
const chartHeight = 180
const chartInnerHeight = 136
const chartPaddingY = 24
const revenuePoints = [34, 46, 42, 58, 52, 74, 68, 86, 80, 98, 92, 116]
const weekdayBars = [
  { label: 'T2', value: 42 },
  { label: 'T3', value: 58 },
  { label: 'T4', value: 51 },
  { label: 'T5', value: 76 },
  { label: 'T6', value: 68 },
  { label: 'T7', value: 92 },
  { label: 'CN', value: 64 },
]

const topProducts = [
  { label: 'Mica 3mm', value: '8,4tr', width: 92 },
  { label: 'Decal sữa', value: '6,1tr', width: 76 },
  { label: 'Formex 5mm', value: '4,8tr', width: 61 },
  { label: 'Keo dán', value: '3,2tr', width: 42 },
]

const topCustomers = [
  { label: 'Công ty Phong Cảnh', value: '12,8tr', width: 95 },
  { label: 'Khách lẻ', value: '7,5tr', width: 68 },
  { label: 'Minh Anh Ads', value: '5,9tr', width: 55 },
  { label: 'Nội thất Nam Long', value: '4,1tr', width: 43 },
]

const activities = [
  { icon: ShoppingCart, actor: 'Thu ngân', text: 'vừa bán hóa đơn', value: '1 250 000', time: '12 phút trước' },
  { icon: PackagePlus, actor: 'Kho', text: 'vừa nhập hàng', value: '3 800 000', time: '42 phút trước' },
  { icon: ReceiptText, actor: 'Thu ngân', text: 'vừa thu công nợ', value: '650 000', time: '2 giờ trước' },
]

function wavePath(points: number[]) {
  return chartPoints(points)
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
}

function chartPoints(points: number[]) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const step = chartWidth / (points.length - 1)
  return points.map((point, index) => ({
    x: index * step,
    y: chartHeight - chartPaddingY - ((point - min) / (max - min || 1)) * chartInnerHeight,
  }))
}

export function DashboardPage({
  onSignOut,
  showSignOut = true,
}: {
  currentUser: CurrentUserData
  onOpenPos: () => void
  onOpenAdmin: () => void
  onOpenPriceBook: () => void
  onOpenSalesDocuments: () => void
  onOpenSuppliers: () => void
  onOpenPurchaseReceipts: () => void
  onSignOut: () => void
  showSignOut?: boolean
}) {
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
          <section aria-label="Kết quả bán hàng hôm nay" className="dashboard-card dashboard-kpi-card">
            <header>
              <div>
                <span>Hôm nay</span>
                <h2>Kết quả bán hàng</h2>
              </div>
              <small>Cập nhật theo ca làm việc hiện tại</small>
            </header>
            <div className="dashboard-kpi-grid">
              <article>
                <DollarSign aria-hidden="true" size={20} />
                <span>Doanh thu</span>
                <strong>18 450 000</strong>
                <small>12 hóa đơn</small>
              </article>
              <article>
                <TrendingUp aria-hidden="true" size={20} />
                <span>Doanh thu thuần</span>
                <strong>17 800 000</strong>
                <small>+8,6% so với kỳ trước</small>
              </article>
            </div>
          </section>

          <section aria-label="Biểu đồ doanh thu thuần" className="dashboard-card dashboard-chart-card">
            <header>
              <div>
                <span>Doanh thu thuần</span>
                <h2>118 600 000</h2>
              </div>
              <select aria-label="Mốc thời gian doanh thu" defaultValue="month">
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
              </select>
            </header>
            <div className="dashboard-chart-tabs" role="tablist" aria-label="Kiểu xem doanh thu">
              <button aria-selected="true" role="tab" type="button">Theo ngày</button>
              <button aria-selected="false" role="tab" type="button">Theo giờ</button>
              <button aria-selected="false" role="tab" type="button">Theo thứ</button>
            </div>
            <div className="dashboard-wave-chart">
              <svg aria-label="Sóng doanh thu thuần" role="img" viewBox="0 0 640 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dashboardWaveStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="55%" stopColor="var(--color-warning)" />
                    <stop offset="100%" stopColor="var(--color-success)" />
                  </linearGradient>
                  <linearGradient id="dashboardWaveFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[36, 72, 108, 144].map((y) => (
                  <line className="dashboard-chart-gridline" key={y} x1="0" x2="640" y1={y} y2={y} />
                ))}
                <path d={`${wavePath(revenuePoints)} L 640 180 L 0 180 Z`} fill="url(#dashboardWaveFill)" />
                <path d={wavePath(revenuePoints)} fill="none" stroke="url(#dashboardWaveStroke)" strokeLinecap="round" strokeWidth="5" />
                {chartPoints(revenuePoints).map(({ x, y }, index) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={index === revenuePoints.length - 1 ? 5 : 3.5} />
                ))}
              </svg>
              <div className="dashboard-bar-strip" aria-hidden="true">
                {weekdayBars.map((bar) => (
                  <span key={bar.label} style={{ '--dashboard-bar-height': `${bar.value}%` } as CSSProperties}>
                    <i />
                    <em>{bar.label}</em>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="dashboard-split-grid">
            <RankCard title="Top hàng bán chạy" items={topProducts} />
            <RankCard title="Top khách mua nhiều nhất" items={topCustomers} />
          </div>
        </div>

        <aside className="dashboard-side-column" aria-label="Thông tin phụ">
          <section className="dashboard-card dashboard-security-card" aria-label="Cảnh báo bảo mật">
            <ShieldAlert aria-hidden="true" size={22} />
            <div>
              <h2>2 đăng nhập cần kiểm tra</h2>
              <p>Hoạt động lạ từ thiết bị chưa ghi nhận.</p>
            </div>
            <ArrowRight aria-hidden="true" size={18} />
          </section>

          <section aria-label="Hoạt động gần đây" className="dashboard-card dashboard-activity-card">
            <header>
              <h2>Hoạt động gần đây</h2>
              <span>Realtime</span>
            </header>
            <ol>
              {activities.map((activity) => {
                const Icon = activity.icon
                return (
                  <li key={`${activity.actor}-${activity.time}`}>
                    <Icon aria-hidden="true" size={17} />
                    <p>
                      <strong>{activity.actor}</strong> {activity.text} <b>{activity.value}</b>
                      <small>{activity.time}</small>
                    </p>
                  </li>
                )
              })}
            </ol>
          </section>
        </aside>
      </section>

    </main>
  )
}

function RankCard({ title, items }: { title: string; items: Array<{ label: string; value: string; width: number }> }) {
  return (
    <section aria-label={title} className="dashboard-card dashboard-rank-card">
      <header>
        <h2>{title}</h2>
        <select aria-label={`${title} thời gian`} defaultValue="month">
          <option value="month">Tháng này</option>
          <option value="yesterday">Hôm qua</option>
        </select>
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
      </ol>
    </section>
  )
}
