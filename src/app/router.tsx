import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ForbiddenPage } from './ForbiddenPage'
import { useAuth } from '../features/auth/auth-context'
import { Component, lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react'
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
import { appRoutes, invoicePrintPath, quotePrintPath } from './routes'
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
const InvoicePrintPage = lazy(() =>
  import('../features/sales-documents/InvoicePrintPage').then(({ InvoicePrintPage }) => ({ default: InvoicePrintPage })),
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

const routeReloadSessionKey = 'qcvl-route-import-reload-url'

function routeLoadErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function isRouteImportError(error: unknown) {
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    routeLoadErrorMessage(error),
  )
}

class RouteLoadErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    if (!isRouteImportError(error) || typeof window === 'undefined') return
    const currentUrl = window.location.href
    if (window.sessionStorage.getItem(routeReloadSessionKey) === currentUrl) return
    window.sessionStorage.setItem(routeReloadSessionKey, currentUrl)
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      const recoverLabel = isRouteImportError(this.state.error)
        ? 'Không tải được màn hình. Trình duyệt có thể đang giữ bản cũ.'
        : 'Không mở được màn hình.'
      return (
        <main role="alert">
          <h1>QCVL</h1>
          <p>{recoverLabel}</p>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
            Tải lại
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <RouteLoadErrorBoundary>
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
            <Route path={appRoutes.invoicePrint} element={<InvoicePrintRoute />} />
            <Route path={appRoutes.forbidden} element={<ForbiddenRoute />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </RouteLoadErrorBoundary>
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
  const { currentUser, initialized, signOut, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])
  const inventoryService = useMemo(() => createBrowserInventoryService(getAccessToken), [getAccessToken])
  const orderService = useMemo(() => createBrowserOrderService(getAccessToken), [getAccessToken])
  const financeService = useMemo(() => createBrowserFinanceService(getAccessToken), [getAccessToken])
  const salesDocumentService = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])
  const foundationService = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])
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
      financeService={financeService}
      salesDocumentService={salesDocumentService}
      productionQueueService={productionQueueService}
      currentUser={currentUser}
      onSignOut={() => void signOut()}
      onOpenAdmin={() => navigate(appRoutes.admin)}
      onOpenDashboard={() => navigate(appRoutes.dashboard)}
      loadBillSettings={foundationService.getOrganizationBillSettings}
      onOpenInvoicePrint={(documentId, templateId) =>
        navigate(invoicePrintPath(documentId, { returnTo: 'pos', template: templateId }))
      }
      onOpenQuotePrint={(documentId, templateId) =>
        navigate(quotePrintPath(documentId, { returnTo: 'pos', template: templateId }))
      }
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
  const financeService = useMemo(() => createBrowserFinanceService(getAccessToken), [getAccessToken])

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (!currentUser.permissions.includes(permissions.createOrder)) {
    return <Navigate to={appRoutes.forbidden} replace />
  }

  return (
    <AppShell currentUser={currentUser} onSignOut={() => void signOut()}>
      <CustomersPage
        currentUserName={currentUser.user.display_name || currentUser.user.email}
        service={catalogService}
        orderService={orderService}
        salesDocumentService={salesDocumentService}
        financeService={financeService}
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
      <FinancePage currentUserName={currentUser.user.display_name || currentUser.user.email} service={service} />
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
        onOpenInvoicePrint={(documentId) => navigate(invoicePrintPath(documentId))}
      />
    </AppShell>
  )
}

function printReturnPath(search: string) {
  const returnTo = new URLSearchParams(search).get('returnTo')
  return returnTo === 'pos' ? appRoutes.pos : appRoutes.salesDocuments
}

function QuotePrintRoute() {
  const { currentUser, initialized, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { id } = useParams()
  const service = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])
  const foundationService = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])
  const financeService = useMemo(() => createBrowserFinanceService(getAccessToken), [getAccessToken])
  const initialTemplate = searchParams.get('template')

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (
    !currentUser.permissions.includes(permissions.createOrder) &&
    !currentUser.permissions.includes(permissions.manageFinance)
  ) {
    return <Navigate to={appRoutes.forbidden} replace />
  }
  if (!id) return <Navigate to={appRoutes.salesDocuments} replace />

  return (
    <QuotePrintPage
      documentId={id}
      service={service}
      initialTemplate={initialTemplate}
      loadBillSettings={foundationService.getOrganizationBillSettings}
      loadBillBankAccount={async () => {
        const { pickBillPrintBankAccount } = await import('../features/sales-documents/bill-print-bank')
        const accounts = await financeService.listAccounts({ is_active: true })
        return pickBillPrintBankAccount(accounts.items)
      }}
      saveCustomerBillPreference={(customerId, preference) =>
        catalogService.updateCustomer(customerId, preference).then(() => undefined)
      }
      onClose={() => navigate(printReturnPath(location.search))}
    />
  )
}

function InvoicePrintRoute() {
  const { currentUser, initialized, getAccessToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { id } = useParams()
  const service = useMemo(() => createBrowserSalesDocumentService(getAccessToken), [getAccessToken])
  const foundationService = useMemo(() => createBrowserFoundationService(getAccessToken), [getAccessToken])
  const catalogService = useMemo(() => createBrowserCatalogService(getAccessToken), [getAccessToken])
  const financeService = useMemo(() => createBrowserFinanceService(getAccessToken), [getAccessToken])
  const initialTemplate = searchParams.get('template')

  if (!initialized) return <BootstrapScreen />
  if (!currentUser) return <Navigate to={appRoutes.login} replace />
  if (
    !currentUser.permissions.includes(permissions.createOrder) &&
    !currentUser.permissions.includes(permissions.manageFinance)
  ) {
    return <Navigate to={appRoutes.forbidden} replace />
  }
  if (!id) return <Navigate to={appRoutes.salesDocuments} replace />

  return (
    <InvoicePrintPage
      documentId={id}
      service={service}
      initialTemplate={initialTemplate}
      loadBillSettings={foundationService.getOrganizationBillSettings}
      loadBillBankAccount={async () => {
        const { pickBillPrintBankAccount } = await import('../features/sales-documents/bill-print-bank')
        const accounts = await financeService.listAccounts({ is_active: true })
        return pickBillPrintBankAccount(accounts.items)
      }}
      saveCustomerBillPreference={(customerId, preference) =>
        catalogService.updateCustomer(customerId, preference).then(() => undefined)
      }
      onClose={() => navigate(printReturnPath(location.search))}
    />
  )
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
