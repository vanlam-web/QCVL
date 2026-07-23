import type { CurrentUserData, CustomerListData, ServerRepository, SupplierListData } from '../../http.js'
import type { RouteResult } from '../../route-types.js'
type SupplierRow=SupplierListData
type CustomerRow={id:string;code:string;name:string}
type SupplierPatch = Parameters<NonNullable<ServerRepository['updateSupplier']>>[0]['patch']
type PurchaseSupplierHandlerDeps = {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
  path: string
  readJson(request: Request): Promise<Record<string, unknown>>
  purchaseImportHandlers: { previewKiotVietSupplierImport(): RouteResult; importKiotVietSuppliers(): RouteResult; deleteImportedKiotVietSuppliers(): RouteResult }
  getIdFromPath(path: string): string | undefined
  suppliers: SupplierListData[]
  customers: CustomerListData[]
  filterSuppliers(url: URL): SupplierListData[]
  sortSuppliersForRequest(items: SupplierListData[], url: URL): SupplierListData[]
  supplierListSummary(items: SupplierListData[]): unknown
  paged<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; page_size: number; total: number }
  requiredString(value: unknown, field: string): string
  nullableString(value: unknown): string | null
  supplierPatchFromBody(body: Record<string, unknown>): SupplierPatch
  randomUUID(): string
  nowIso: string
  httpError(status: number, code: 'VALIDATION_ERROR' | 'RESOURCE_CONFLICT', message: string, fields?: Record<string, string[]>): Error
}
export function createPurchaseSupplierHandlers(deps:PurchaseSupplierHandlerDeps){const {request,url,currentUser,repository,path,readJson,purchaseImportHandlers,getIdFromPath,suppliers,customers,filterSuppliers,sortSuppliersForRequest,supplierListSummary,paged,requiredString,nullableString,supplierPatchFromBody,randomUUID,nowIso,httpError}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listSuppliers: async () => {
      const repositorySuppliers = await repository.listSuppliers?.({
        organizationId: currentUser.organization.id,
        userId: currentUser.user.id,
        url,
      })
      const items = sortSuppliersForRequest(repositorySuppliers ?? filterSuppliers(url), url)
      return { found: true, data: { ...paged(items, page, pageSize), summary: supplierListSummary(items) } }
    },
    previewKiotVietSupplierImport: purchaseImportHandlers.previewKiotVietSupplierImport,
    importKiotVietSuppliers: purchaseImportHandlers.importKiotVietSuppliers,
    deleteImportedKiotVietSuppliers: purchaseImportHandlers.deleteImportedKiotVietSuppliers,
    getSupplier: async () => {
      const repositorySuppliers = await repository.listSuppliers?.({
        organizationId: currentUser.organization.id,
        url: new URL('http://api.local/api/v1/suppliers?page=1&page_size=10000'),
      })
      return { found: true, data: repositorySuppliers?.find((supplier: SupplierRow) => supplier.id === getIdFromPath(path)) ?? suppliers.find((supplier: SupplierRow) => supplier.id === getIdFromPath(path)) ?? suppliers[0] }
    },
    createSupplier: async () => {
      const body = await readJson(request)
      const name = requiredString(body.name, 'name')
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      const statusRaw = body.status === undefined || body.status === null || body.status === ''
        ? 'active'
        : String(body.status).trim()
      if (statusRaw !== 'active' && statusRaw !== 'inactive') {
        throw httpError(400, 'VALIDATION_ERROR', 'status is invalid.', { status: ['status must be active or inactive.'] })
      }
      try {
        const created = repository.createSupplier
          ? await repository.createSupplier({
              organizationId: currentUser.organization.id,
              code: code || undefined,
              name,
              phone: nullableString(body.phone),
              email: nullableString(body.email),
              address: nullableString(body.address),
              tax_code: nullableString(body.tax_code),
              linked_customer_id: nullableString(body.linked_customer_id),
              notes: nullableString(body.notes),
              status: statusRaw,
            })
          : (() => {
              const fallback: SupplierListData = {
                ...suppliers[0],
                id: randomUUID(),
                code: code || `NCC${String(suppliers.length + 1).padStart(6, '0')}`,
                name,
                phone: nullableString(body.phone),
                email: nullableString(body.email),
                address: nullableString(body.address),
                tax_code: nullableString(body.tax_code),
                linked_customer_id: nullableString(body.linked_customer_id),
                linked_customer: null,
                notes: nullableString(body.notes),
                status: statusRaw,
                current_payable_amount: 0,
                total_purchase_amount: 0,
                created_at: nowIso,
              }
              suppliers.push(fallback)
              return fallback
            })()
        return { found: true, data: created, status: 201 }
      } catch (error) {
        if (error instanceof Error && error.message === 'SUPPLIER_ALREADY_EXISTS') {
          throw httpError(409, 'RESOURCE_CONFLICT', 'Supplier code already exists.', { code: ['Supplier code already exists.'] })
        }
        if (error instanceof Error && error.message === 'LINKED_CUSTOMER_NOT_FOUND') {
          throw httpError(400, 'VALIDATION_ERROR', 'linked_customer_id is invalid.', { linked_customer_id: ['linked_customer_id is invalid.'] })
        }
        throw error
      }
    },
    updateSupplier: async () => {
      const id = getIdFromPath(path) ?? ''
      const body = await readJson(request)
      const patch = supplierPatchFromBody(body)
      if (repository.updateSupplier) {
        const supplier = await repository.updateSupplier({ organizationId: currentUser.organization.id, id, patch })
        return supplier
          ? { found: true, data: supplier }
          : { found: true, data: { message: 'Supplier not found' }, status: 404 }
      }
      const index = suppliers.findIndex((supplier: SupplierRow) => supplier.id === id)
      const current = index >= 0 ? suppliers[index] : suppliers[0]
      const nextLinkedCustomerId = patch.linked_customer_id !== undefined ? patch.linked_customer_id : current.linked_customer_id
      const linkedCustomer = nextLinkedCustomerId
        ? customers.find((customer: CustomerRow) => customer.id === nextLinkedCustomerId) ?? null
        : null
      const updated = {
        ...current,
        ...patch,
        id,
        linked_customer_id: nextLinkedCustomerId ?? null,
        linked_customer: patch.linked_customer_id === undefined
          ? current.linked_customer
          : linkedCustomer
            ? { id: linkedCustomer.id, code: linkedCustomer.code, name: linkedCustomer.name }
            : null,
      }
      if (index >= 0) suppliers[index] = updated
      return { found: true, data: updated }
    },
  }}
