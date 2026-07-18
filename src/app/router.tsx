import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ForbiddenPage } from './ForbiddenPage'
import { useAuth } from '../features/auth/auth-context'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { createBrowserFoundationService } from '../features/users/foundation-service'
import { createBrowserCatalogService } from '../features/catalog/catalog-service'
import { createBrowserOrderService } from '../features/orders/order-service'
import { createBrowserProductionQueueService } from '../features/production-queue/production-queue-service'
import { createBrowserSupplierService } from '../features/purchase/supplier-service'
import { createBrowserPurchaseReceiptService } from '../features/purchase/purchase-receipt-service'
import { createBrowserSalesDocumentService } from '../features/sales-documents/sales-document-service'
import { createBrowserInventoryService } from '../features/inventory/inventory-service'
import { createBrowserFinanceService } from '../features/finance/finance-service'
import { createBrowserReportService } from '../features/reports/report-service'
import { createBrowserDashboardService } from '../features/dashboard/dashboard-service'
import { saveInvoiceRevisionHandoffPayload } from '../features/pos/invoice-revision-handoff'
import { saveQuoteReopenPayload } from '../features/pos/quote-draft-handoff'
import { AppShell } from '../components/ui-shell/AppShell'
import { appRoutes, quotePrintPath } from './routes'
import { permissions } from '../features/users/permissions'

const LoginPage = lazy(() => import('../features/auth/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })))
const PosShell = lazy(() => import('../features/pos/PosShell').then(({ PosShell }) => ({ default: PosShell })))
const FoundationAdminPage = lazy(() =>
  import('../features/admin/FoundationAdminPage').then(({ FoundationAdminPage }) => ({
    default: FoundationAdminPage,
  })),
)
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })),
)
const CatalogPage = lazy(() =>
  import('../features/catalog/CatalogPage').then(({ CatalogPage }) => ({ default: CatalogPage })),
)
const PriceBookPage = lazy(() =>
  import('../features/catalog/PriceBookPage').then(({ PriceBookPage }) => ({ default: PriceBookPage })),
)
const CustomersPage = lazy(() =>
  import('../features/catalog/CustomersPage').then(({ CustomersPage }) => ({ default: CustomersPage })),
)
const SuppliersPage = lazy(() =>
  import('../features/purchase/SuppliersPage').then(({ SuppliersPage }) => ({ default: SuppliersPage })),
)
const PurchaseReceiptsPage = lazy(() =>
  import('../features/purchase/PurchaseReceiptsPage').then(({ PurchaseReceiptsPage }) => ({
    default: PurchaseReceiptsPage,
  })),
)
const SalesDocumentsPage = lazy(() =>
  import('../features/sales-documents/SalesDocumentsPage').then(({ SalesDocumentsPage }) => ({
    default: SalesDocumentsPage,
  })),
)
const QuotePrintPage = lazy(() =>
  import('../features/sales-documents/QuotePrintPage').then(({ QuotePrintPage }) => ({ default: QuotePrintPage })),
)
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then(({ InventoryPage }) => ({ default: InventoryPage })),
)
const FinancePage = lazy(() =>
  import('../features/finance/FinancePage').then(({ FinancePage }) => ({ default: FinancePage })),
)
const ReportsPage = lazy(() =>
  import('../features/reports/ReportsPage').then(({ ReportsPage }) => ({ default: ReportsPage })),
)
const AccountPage = lazy(() =>
  import('../features/account/AccountPage').then((module) => ({ default: module.AccountPage })),
)

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<BootstrapScreen />}>
        <Routes>
          <Route path={appRoutes.login} element={<LoginRoute />} />
          <Route path={appRoutes.dashboard} element={<DashboardRoute />} />
          <Route path={appRoutes.account} element={<AccountRoute />} />
          <Route path={appRoutes.pos} element={<PosRoute />} />
          <Route path={appRoutes.admin} element={<AdminRoute />} />
          <Route path={appRoutes.products} element={<CatalogRoute />} />
          <Route path={appRoutes.priceBook} element={<PriceBookRoute />} />
          <Route path={appRoutes.customers} element={<CustomersRoute />} />
          <Route path={appRoutes.suppliers} element={<SuppliersRoute />} />
          <Route path={appRoutes.purchaseReceiptCreate} element={<PurchaseReceiptsRoute createMode />} />
          <Route path={appRoutes.purchaseReceipts} element={<PurchaseReceiptsRoute />} />
          <Route path={appRoutes.inventory} element={<InventoryRoute />} />
          <Route path={appRoutes.finance} element={<FinanceRoute />} />
          <Route path={appRoutes.reports} element={<ReportsRoute />} />
          <Route path={appRoutes.salesDocuments} element={<SalesDocumentsRoute />} />
          <Route path={appRoutes.quotePrint} element={<QuotePrintRoute />} />
          <Route path={appRoutes.forbidden} element={<ForbiddenRoute />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function LoginRoute() {
  const { currentUser, initialized } = useAuth()
  if (!initialized) return <BootstrapScreen />
  if (currentUser) return <Navigate to={appRoutes.dashboard} replace />
  return <LoginPage />
}

function DashboardRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const dashboardService = useMemo(() => createBrowserDashboardService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <DashboardPage
        currentUser={currentUser}
        service={dashboardService}
        onOpenPos={() => navigate(appRoutes.pos)}
        onOpenAdmin={() => navigate(appRoutes.admin)}
        onOpenPriceBook={() => navigate(appRoutes.priceBook)}
        onOpenSalesDocuments={() => navigate(appRoutes.salesDocuments)}
        onOpenSuppliers={() => navigate(appRoutes.suppliers)}
        onOpenPurchaseReceipts={() => navigate(appRoutes.purchaseReceipts)}
        onSignOut={() => void signOut()}
        showSignOut={false}
      />
    </AppShell>
  )
}

function AccountRoute() {
  const { currentUser, initialized, getAccessToken, refreshMe, signOut } = useAuth()
  const currentUserId = currentUser?.user.id
  const service = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])

  useEffect(() => {
    if (!initialized || !currentUserId) return
    void refreshMe().catch(() => undefined)
  }, [currentUserId, initialized, refreshMe])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <AccountPage
        currentUser={currentUser}
        onSaveProfile={async (input) => {
          await service.updateCurrentUserProfile(input)
          await refreshMe()
        }}
        onSignOutDevice={async (deviceId) => {
          await service.signOutCurrentUserDevice(deviceId)
          await refreshMe()
        }}
      />
    </AppShell>
  )
}

function PosRoute() {
  const { currentUser, initialized, accessConnection, signOut, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])
  const inventoryService = useMemo(() => createBrowserInventoryService(getAccessToken), [getAccessToken])
  const orderService = useMemo(() => createBrowserOrderService(getAccessToken), [getAccessToken])
  const productionQueueService = useMemo(
    () => createBrowserProductionQueueService(getAccessToken),
    [getAccessToken],
  )
  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.createOrder)) return <Navigate to={appRoutes.forbidden} replace />
  return (
    <PosShell
      catalogService={catalogService}
      inventoryService={inventoryService}
      orderService={orderService}
      productionQueueService={productionQueueService}
      currentUser={currentUser}
      connected={accessConnection === 'connected'}
      onSignOut={() => void signOut()}
      onOpenAdmin={() => navigate(appRoutes.admin)}
      onOpenDashboard={() => navigate(appRoutes.dashboard)}
    />
  )
}

function AdminRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.accessAdminPanel)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <FoundationAdminPage service={service} onOpenDashboard={() => navigate(appRoutes.dashboard)} />
    </AppShell>
  )
}

function CatalogRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.manageInventory)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <CatalogPage service={service} onOpenDashboard={() => navigate(appRoutes.dashboard)} />
    </AppShell>
  )
}

function PriceBookRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.editPriceBook)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <PriceBookPage service={service} onOpenDashboard={() => navigate(appRoutes.dashboard)} />
    </AppShell>
  )
}

function CustomersRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])
  const orderService = useMemo(() => createBrowserOrderService(getAccessToken), [getAccessToken])
  const salesDocumentService = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.createOrder)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <CustomersPage
        service={catalogService}
        orderService={orderService}
        salesDocumentService={salesDocumentService}
      />
    </AppShell>
  )
}

function SuppliersRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserSupplierService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.manageInventory)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <SuppliersPage service={service} onOpenDashboard={() => navigate(appRoutes.dashboard)} />
    </AppShell>
  )
}

function PurchaseReceiptsRoute({ createMode = false }: { createMode?: boolean }) {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserPurchaseReceiptService(getAccessToken), [getAccessToken])
  const effectiveCreateMode = createMode || location.pathname === appRoutes.purchaseReceiptCreate

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.manageInventory)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <PurchaseReceiptsPage
        key={effectiveCreateMode ? 'purchase-receipts-create' : 'purchase-receipts-list'}
        createMode={effectiveCreateMode}
        currentUser={currentUser}
        service={service}
        onCloseCreateReceipt={() => navigate(appRoutes.purchaseReceipts)}
        onOpenCreateReceipt={() => navigate(appRoutes.purchaseReceiptCreate)}
        onOpenDashboard={() => navigate(appRoutes.dashboard)}
      />
    </AppShell>
  )
}

function InventoryRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const service = useMemo(() => createBrowserInventoryService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.manageInventory)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <InventoryPage service={service} />
    </AppShell>
  )
}

function FinanceRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const service = useMemo(() => createBrowserFinanceService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.manageFinance)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <FinancePage service={service} />
    </AppShell>
  )
}

function ReportsRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const service = useMemo(() => createBrowserReportService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (
    !currentUser.permissions.includes(permissions.manageFinance) ||
    !currentUser.permissions.includes(permissions.manageInventory)
  ) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <ReportsPage service={service} />
    </AppShell>
  )
}

function SalesDocumentsRoute() {
  const { currentUser, initialized, getAccessToken, signOut } = useAuth()
  const navigate = useNavigate()
  const service = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])
  const orderService = useMemo(() => createBrowserOrderService(getAccessToken), [getAccessToken])
  const userService = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (
    !currentUser.permissions.includes(permissions.createOrder) &&
    !currentUser.permissions.includes(permissions.manageFinance)
  ) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <SalesDocumentsPage
        service={service}
        orderService={orderService}
        userService={userService}
        catalogService={catalogService}
        onCreateSalesDocument={() => navigate(appRoutes.pos)}
        onOpenDashboard={() => navigate(appRoutes.dashboard)}
        onOpenQuoteInPos={(payload) => {
          saveQuoteReopenPayload(payload)
          navigate(appRoutes.pos)
        }}
        onOpenInvoiceRevisionInPos={(payload) => {
          saveInvoiceRevisionHandoffPayload(payload)
          navigate(appRoutes.pos)
        }}
        onOpenQuotePrint={(documentId) => navigate(quotePrintPath(documentId))}
      />
    </AppShell>
  )
}

function QuotePrintRoute() {
  const { currentUser, initialized, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const service = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (
    !currentUser.permissions.includes(permissions.createOrder) &&
    !currentUser.permissions.includes(permissions.manageFinance)
  ) {
    return <Navigate to={appRoutes.forbidden} replace />
  }
  if (!id) return <Navigate to={appRoutes.salesDocuments} replace />

  return <QuotePrintPage documentId={id} service={service} onClose={() => navigate(appRoutes.salesDocuments)} />
}

function ForbiddenRoute() {
  const { currentUser, initialized } = useAuth()
  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  return <ForbiddenPage />
}

function RootRedirect() {
  const { currentUser, initialized } = useAuth()
  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  return <Navigate to={appRoutes.dashboard} replace />
}

function BootstrapScreen() {
  return (
    <main>
      <h1>QCVL</h1>
      <p>Đang khởi tạo phiên làm việc...</p>
    </main>
  )
}
