import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const routerSource = readFileSync('src/app/router.tsx', 'utf8')

const routePageModules = [
  '../features/admin/FoundationAdminPage',
  '../features/dashboard/DashboardPage',
  '../features/catalog/CatalogPage',
  '../features/catalog/PriceBookPage',
  '../features/catalog/CustomersPage',
  '../features/purchase/SuppliersPage',
  '../features/purchase/PurchaseReceiptsPage',
  '../features/sales-documents/SalesDocumentsPage',
  '../features/sales-documents/QuotePrintPage',
  '../features/sales-documents/InvoicePrintPage',
  '../features/inventory/InventoryPage',
  '../features/finance/FinancePage',
  '../features/reports/ReportsPage',
  '../features/pos/PosShell',
]

describe('app route bundle boundaries', () => {
  test('loads route page modules lazily instead of bundling every page into the app shell', () => {
    expect(routerSource).toMatch(/import \{[^}]*\blazy\b[^}]*\} from 'react'/)

    for (const modulePath of routePageModules) {
      expect(routerSource).not.toMatch(new RegExp(`import .* from '${modulePath.replaceAll('/', '\\/')}'`))
      expect(routerSource).toContain(`import('${modulePath}')`)
    }
  })

  test('places the purchase receipt create route before the base receipt route', () => {
    const createRouteIndex = routerSource.indexOf('path={appRoutes.purchaseReceiptCreate}')
    const listRouteIndex = routerSource.indexOf('path={appRoutes.purchaseReceipts}')

    expect(createRouteIndex).toBeGreaterThan(-1)
    expect(listRouteIndex).toBeGreaterThan(-1)
    expect(createRouteIndex).toBeLessThan(listRouteIndex)
  })

  test('guards direct purchase receipt create loads by pathname', () => {
    expect(routerSource).toContain('useLocation')
    expect(routerSource).toContain('location.pathname === appRoutes.purchaseReceiptCreate')
    expect(routerSource).toContain('createMode={effectiveCreateMode}')
    expect(routerSource).toContain("key={effectiveCreateMode ? 'purchase-receipts-create' : 'purchase-receipts-list'}")
  })

  test('recovers from stale route chunks instead of leaving a blank page', () => {
    expect(routerSource).toContain('RouteLoadErrorBoundary')
    expect(routerSource).toContain('Failed to fetch dynamically imported module')
    expect(routerSource).toContain('window.location.reload()')
  })
})
