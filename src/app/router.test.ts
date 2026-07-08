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
  '../features/inventory/InventoryPage',
  '../features/finance/FinancePage',
  '../features/reports/ReportsPage',
  '../features/pos/PosShell',
]

describe('app route bundle boundaries', () => {
  test('loads route page modules lazily instead of bundling every page into the app shell', () => {
    expect(routerSource).toContain("import { lazy")

    for (const modulePath of routePageModules) {
      expect(routerSource).not.toMatch(new RegExp(`import .* from '${modulePath.replaceAll('/', '\\/')}'`))
      expect(routerSource).toContain(`import('${modulePath}')`)
    }
  })
})
