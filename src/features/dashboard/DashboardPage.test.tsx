import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage } from './DashboardPage'
import type { DashboardData, DashboardService } from './dashboard-service'
import { ApiError } from '../../lib/api/client'
import type { CurrentUserData } from '../../lib/api/types'

const currentUser: CurrentUserData = {
  user: { id: 'u-1', email: 'admin@qc.local', display_name: 'Admin' },
  organization: { id: 'o-1', code: 'VAN-LAM', name: 'Văn Lâm' },
  workstation: null,
  permissions: ['perm.create_order', 'perm.access_admin_panel'],
}

const dashboardData: DashboardData = {
  todayRevenue: '12 879 710',
  todayInvoiceCount: 25,
  todayNetRevenue: '12 879 710',
  salesResultRevenue: '12 879 710',
  salesResultInvoiceCount: 25,
  salesResultNetRevenue: '12 879 710',
  salesResultComparison: {
    direction: 'down',
    percent: '-84.99%',
    label: 'So với cùng kỳ tháng trước',
  },
  monthNetRevenue: '69 280 508',
  monthRevenuePoints: [100_000, 0, 250_000, 0, 50_000],
  weekdayBars: [
    { label: 'T2', value: 20 },
    { label: 'T3', value: 80 },
    { label: 'T4', value: 35 },
    { label: 'T5', value: 60 },
    { label: 'T6', value: 15 },
    { label: 'T7', value: 45 },
    { label: 'CN', value: 10 },
  ],
  topProducts: Array.from({ length: 10 }, (_, index) => ({
    label: `SP0000${String(index + 1).padStart(2, '0')} Hàng ${index + 1}`,
    value: `${10 - index},${index}tr`,
    width: Math.max(8, 100 - index * 8),
  })),
  topCustomers: Array.from({ length: 10 }, (_, index) => ({
    label: `KH0000${String(index + 1).padStart(2, '0')} Khách ${index + 1}`,
    value: `${10 - index},${index}tr`,
    width: Math.max(8, 100 - index * 8),
  })),
  activities: [
    {
      kind: 'payment',
      actor: 'Nhân viên bán hàng',
      action: 'bán và thu hóa đơn',
      counterpartyLabel: 'Siêu thị Thành Cổ',
      counterpartyCode: 'KH000514',
      value: '70 000',
      documentCode: 'HD011143',
      time: '5 phút trước',
    },
  ],
  hasMoreActivities: false,
  systemActivities: [
    {
      actor: 'Admin',
      action: 'thêm',
      target: 'HD011143',
      time: '10 phút trước',
    },
    {
      actor: 'Admin',
      action: 'sửa',
      target: 'HD011143',
      time: '8 phút trước',
    },
    {
      actor: 'Admin',
      action: 'xóa',
      target: 'HD011120',
      time: '5 phút trước',
    },
  ],
}

const service: DashboardService = {
  loadDashboardData: vi.fn(async () => dashboardData),
}

function dashboardDataForPeriods(input?: Parameters<DashboardService['loadDashboardData']>[0]): DashboardData {
  const revenuePeriod = input?.revenuePeriod ?? 'month'
  const salesResultPeriod = input?.salesResultPeriod ?? 'month'
  const productRankPeriod = input?.productRankPeriod ?? 'month'
  const customerRankPeriod = input?.customerRankPeriod ?? 'month'

  return {
    ...dashboardData,
    salesResultRevenue: salesResultPeriod === 'yesterday' ? '8 000' : '12 879 710',
    salesResultInvoiceCount: salesResultPeriod === 'yesterday' ? 3 : 25,
    salesResultNetRevenue: salesResultPeriod === 'yesterday' ? '8 000' : '12 879 710',
    salesResultComparison: salesResultPeriod === 'yesterday'
      ? { direction: 'up', percent: '12.50%', label: 'So với ngày trước đó' }
      : dashboardData.salesResultComparison,
    monthNetRevenue: revenuePeriod === 'last_7_days' ? '7 000' : '69 280 508',
    monthRevenuePoints: revenuePeriod === 'last_7_days' ? [7_000] : dashboardData.monthRevenuePoints,
    topProducts: [
      {
        label: productRankPeriod === 'yesterday' ? 'SP-YESTERDAY Hôm qua' : 'SP-MONTH Tháng này',
        value: productRankPeriod === 'yesterday' ? '1tr' : '6,4tr',
        width: 100,
      },
    ],
    topCustomers: [
      {
        label: customerRankPeriod === 'today' ? 'KH-TODAY Hôm nay' : 'KH-MONTH Tháng này',
        value: customerRankPeriod === 'today' ? '2tr' : '7,8tr',
        width: 100,
      },
    ],
  }
}

it('keeps dashboard period filters independent and reloads data for the changed section', async () => {
  const periodService: DashboardService = {
    loadDashboardData: vi.fn(async (input) => dashboardDataForPeriods(input)),
  }

  render(
    <DashboardPage
      currentUser={currentUser}
      service={periodService}
      onOpenPos={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenPriceBook={vi.fn()}
      onOpenSalesDocuments={vi.fn()}
      onOpenSuppliers={vi.fn()}
      onOpenPurchaseReceipts={vi.fn()}
      onSignOut={vi.fn()}
    />,
  )

  expect(await screen.findAllByText('12 879 710')).toHaveLength(2)
  expect(screen.getByText('69 280 508')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xem nhanh hôm nay' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kết quả bán hàng thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByText('-84.99%')).toBeInTheDocument()
  expect(screen.getByText('So với cùng kỳ tháng trước')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: Tháng này' }))
  await userEvent.click(screen.getByRole('option', { name: '7 ngày qua' }))

  expect(await screen.findAllByText('7 000')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: 7 ngày qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' }))
  await userEvent.click(screen.getByRole('option', { name: 'Hôm qua' }))

  expect(await screen.findByText('SP-YESTERDAY Hôm qua')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: 7 ngày qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Hôm qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()
  expect(periodService.loadDashboardData).toHaveBeenLastCalledWith({
    salesResultPeriod: 'month',
    revenuePeriod: 'last_7_days',
    productRankPeriod: 'yesterday',
    customerRankPeriod: 'month',
  })

  await userEvent.click(screen.getByRole('button', { name: 'Xem nhanh hôm nay' }))
  expect(screen.getByRole('button', { name: 'Kết quả bán hàng thời gian: Hôm nay' })).toBeInTheDocument()
  expect(periodService.loadDashboardData).toHaveBeenLastCalledWith({
    salesResultPeriod: 'today',
    revenuePeriod: 'last_7_days',
    productRankPeriod: 'yesterday',
    customerRankPeriod: 'month',
  })

  await userEvent.click(screen.getByRole('button', { name: 'Kết quả bán hàng thời gian: Hôm nay' }))
  await userEvent.click(screen.getByRole('option', { name: 'Hôm qua' }))

  expect(await screen.findAllByText('8 000')).toHaveLength(1)
  expect(screen.getByText('3 hóa đơn')).toBeInTheDocument()
  expect(screen.getByText('12.50%')).toBeInTheDocument()
  expect(screen.getByText('So với ngày trước đó')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kết quả bán hàng thời gian: Hôm qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: 7 ngày qua' })).toBeInTheDocument()
  expect(periodService.loadDashboardData).toHaveBeenLastCalledWith({
    salesResultPeriod: 'yesterday',
    revenuePeriod: 'last_7_days',
    productRankPeriod: 'yesterday',
    customerRankPeriod: 'month',
  })
})

it('signs out when dashboard data request is unauthorized', async () => {
  const onSignOut = vi.fn()
  const service: DashboardService = {
    loadDashboardData: vi.fn(async () => {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.', 'trace-auth')
    }),
  }

  render(
    <DashboardPage
      currentUser={currentUser}
      service={service}
      onOpenPos={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenPriceBook={vi.fn()}
      onOpenSalesDocuments={vi.fn()}
      onOpenSuppliers={vi.fn()}
      onOpenPurchaseReceipts={vi.fn()}
      onSignOut={onSignOut}
      showSignOut={false}
    />,
  )

  await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(1))
})

it('loads the next dashboard activity page when the activity list is scrolled to the bottom', async () => {
  const initialActivities = Array.from({ length: 20 }, (_, index) => ({
    kind: 'invoice' as const,
    actor: `Nhan vien ${index + 1}`,
    action: 'ban hoa don',
    counterpartyLabel: `Khach ${index + 1}`,
    value: `${index + 1} 000`,
    documentCode: `HD${String(index + 1).padStart(6, '0')}`,
    time: `${index + 1} phut truoc`,
  }))
  const manyActivitiesService: DashboardService = {
    loadDashboardData: vi.fn(async () => ({
      ...dashboardData,
      activities: initialActivities,
      hasMoreActivities: true,
    })),
    loadDashboardActivities: vi.fn(async () => ({
      activities: Array.from({ length: 20 }, (_, index) => ({
        kind: 'invoice' as const,
        actor: `Nhan vien ${index + 21}`,
        action: 'ban hoa don',
        counterpartyLabel: `Khach ${index + 21}`,
        value: `${index + 21} 000`,
        documentCode: `HD${String(index + 21).padStart(6, '0')}`,
        time: `${index + 21} phut truoc`,
      })),
      hasMore: false,
    })),
  }

  const { container } = render(
    <DashboardPage
      currentUser={currentUser}
      service={manyActivitiesService}
      onOpenPos={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenPriceBook={vi.fn()}
      onOpenSalesDocuments={vi.fn()}
      onOpenSuppliers={vi.fn()}
      onOpenPurchaseReceipts={vi.fn()}
      onSignOut={vi.fn()}
    />,
  )

  expect(await screen.findByText('Nhan vien 1')).toBeInTheDocument()
  expect(screen.getByText('Nhan vien 20')).toBeInTheDocument()
  expect(screen.queryByText('Nhan vien 21')).not.toBeInTheDocument()

  const activityList = container.querySelector('.dashboard-activity-card ol') as HTMLOListElement
  Object.defineProperty(activityList, 'scrollTop', { configurable: true, value: 600 })
  Object.defineProperty(activityList, 'clientHeight', { configurable: true, value: 400 })
  Object.defineProperty(activityList, 'scrollHeight', { configurable: true, value: 980 })
  fireEvent.scroll(activityList)

  expect(await screen.findByText('Nhan vien 21')).toBeInTheDocument()
  expect(screen.getByText('Nhan vien 40')).toBeInTheDocument()
  expect(manyActivitiesService.loadDashboardActivities).toHaveBeenCalledWith({ page: 2, pageSize: 20 })
})

it('links supplier and purchase receipt in purchase activities', async () => {
  const purchaseActivityData: DashboardData = {
    ...dashboardData,
    activities: [
      {
        kind: 'purchase',
        actor: 'Nguyễn Quản Lý',
        action: 'mua hàng',
        counterpartyPreposition: 'từ',
        counterpartyLabel: 'Thu Nghĩa',
        counterpartyCode: 'NCC000035',
        counterpartyType: 'supplier',
        value: '500 000',
        documentCode: 'PN000001',
        documentType: 'purchase_receipt',
        time: '30 phút trước',
      },
    ],
  }
  const purchaseActivityService: DashboardService = {
    loadDashboardData: vi.fn(async () => purchaseActivityData),
  }
  const { container } = render(
    <DashboardPage
      currentUser={currentUser}
      service={purchaseActivityService}
      onOpenPos={vi.fn()}
      onOpenAdmin={vi.fn()}
      onOpenPriceBook={vi.fn()}
      onOpenSalesDocuments={vi.fn()}
      onOpenSuppliers={vi.fn()}
      onOpenPurchaseReceipts={vi.fn()}
      onSignOut={vi.fn()}
    />,
  )

  expect(await screen.findByText('Nguyễn Quản Lý')).toBeInTheDocument()
  expect(container.querySelector('.dashboard-activity-line')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Nguyễn Quản Lý mua hàng từ Thu Nghĩa trị giá 500 000 theo PN000001')
  expect(screen.getByRole('link', { name: 'Thu Nghĩa' })).toHaveAttribute('href', '/suppliers?open=NCC000035')
  expect(screen.getByRole('link', { name: 'PN000001' })).toHaveAttribute('href', '/receipts?open=PN000001')
})

it('shows account-based modules without requiring a POS machine', async () => {
  const onOpenPos = vi.fn()
  const onOpenAdmin = vi.fn()
  const onOpenPriceBook = vi.fn()
  const onOpenSalesDocuments = vi.fn()
  const onOpenSuppliers = vi.fn()
  const onOpenPurchaseReceipts = vi.fn()
  const onSignOut = vi.fn()

  const { container } = render(
    <DashboardPage
      currentUser={currentUser}
      service={service}
      onOpenPos={onOpenPos}
      onOpenAdmin={onOpenAdmin}
      onOpenPriceBook={onOpenPriceBook}
      onOpenSalesDocuments={onOpenSalesDocuments}
      onOpenSuppliers={onOpenSuppliers}
      onOpenPurchaseReceipts={onOpenPurchaseReceipts}
      onSignOut={onSignOut}
    />,
  )

  expect(screen.queryByRole('heading', { name: 'QC-OMS' })).not.toBeInTheDocument()
  expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  expect(screen.queryByText('POS-01')).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Điều hướng tổng quan' })).not.toBeInTheDocument()
  expect(screen.queryByText('Tổng quan')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thông báo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Kết quả bán hàng' })).toHaveClass('dashboard-kpi-card')
  expect(screen.queryByText('Dữ liệu từ hóa đơn thật')).not.toBeInTheDocument()
  expect(screen.queryByText('Trả hàng')).not.toBeInTheDocument()
  expect(screen.getByText('Doanh thu')).toBeInTheDocument()
  expect(screen.getAllByText('Doanh thu thuần')).toHaveLength(2)
  expect(await screen.findAllByText('12 879 710')).toHaveLength(2)
  expect(screen.getByText('69 280 508')).toBeInTheDocument()
  expect(screen.getAllByText('25 hóa đơn')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Xem nhanh hôm nay' })).toBeInTheDocument()
  expect(container.querySelector('.dashboard-kpi-grid article:nth-of-type(1) small')?.textContent).toBe('25 hóa đơn')
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: Tháng này' })).toBeInTheDocument()
  expect(screen.getByText('SP000001 Hàng 1')).toBeInTheDocument()
  expect(screen.getByText('KH000001 Khách 1')).toBeInTheDocument()
  expect(screen.getByText('Nhân viên bán hàng')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Biểu đồ doanh thu thuần' })).toHaveClass('dashboard-chart-card')
  expect(screen.getByRole('img', { name: 'Biểu đồ cột doanh thu thuần' })).toBeInTheDocument()
  expect(screen.queryByText('02')).not.toBeInTheDocument()
  expect(screen.queryByText('04')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Theo giờ' }))
  expect(screen.getByRole('tab', { name: 'Theo giờ' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Theo ngày' })).toHaveAttribute('aria-selected', 'false')
  expect(Array.from(container.querySelectorAll('.dashboard-column-chart-plot b')).map((bar) => bar.getAttribute('style'))).toEqual([
    '--dashboard-bar-height: 10%;',
    '--dashboard-bar-height: 25%;',
    '--dashboard-bar-height: 5%;',
  ])
  expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: Tháng này' }))
  await userEvent.click(screen.getByRole('option', { name: '7 ngày qua' }))
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: 7 ngày qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Tháng này' }))
  await userEvent.click(screen.getByRole('option', { name: 'Hôm qua' }))
  expect(screen.getByRole('button', { name: 'Mốc thời gian doanh thu: 7 ngày qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 hàng bán chạy thời gian: Hôm qua' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top 10 khách mua nhiều nhất thời gian: Tháng này' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Top 10 hàng bán chạy' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Top 10 khách mua nhiều nhất' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Hoạt động gần đây' })).toHaveClass('dashboard-activity-card')
  expect(container.querySelector('.dashboard-activity-line')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Nhân viên bán hàng bán và thu hóa đơn cho Siêu thị Thành Cổ trị giá 70 000 theo HD011143')
  expect(screen.getByRole('link', { name: 'Siêu thị Thành Cổ' })).toHaveAttribute('href', '/customers?open=KH000514')
  expect(screen.getByRole('link', { name: 'HD011143' })).toHaveAttribute('href', '/sales-documents?open=HD011143&type=invoice')
  expect(screen.getByText('5 phút trước')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Tiện ích' })).not.toBeInTheDocument()
  expect(screen.queryByText('Thanh toán')).not.toBeInTheDocument()
  expect(screen.queryByText('Vay vốn')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Bán hàng' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Module hệ thống' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))

  expect(onOpenPos).not.toHaveBeenCalled()
  expect(onOpenAdmin).not.toHaveBeenCalled()
  expect(onOpenPriceBook).not.toHaveBeenCalled()
  expect(onOpenSalesDocuments).not.toHaveBeenCalled()
  expect(onOpenSuppliers).not.toHaveBeenCalled()
  expect(onOpenPurchaseReceipts).not.toHaveBeenCalled()
  expect(onSignOut).toHaveBeenCalled()
})
