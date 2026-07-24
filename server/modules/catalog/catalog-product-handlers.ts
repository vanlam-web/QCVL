import type { CurrentUserData, ProductGroupListData, ProductListData, ServerRepository } from '../../http.js'
import type { RouteResult } from '../../route-types.js'
import { PriceFormulaValidationError, parsePriceFormulaInput, parsePriceFormulaSelection } from './price-formula-core.js'
type ProductCreateInput=Omit<Parameters<NonNullable<ServerRepository['createProduct']>>[0],'organizationId'>
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type CatalogProductDeps={request:Request;url:URL;currentUser:CurrentUserData;repository:ServerRepository;path:string;readJson(request:Request):Promise<Record<string,unknown>>;getIdFromPath(path:string):string|undefined;products:ProductListData[];productGroups:ProductGroupListData[];priceLists:unknown[];catalogImportHandlers:{previewKiotVietProductImport():RouteResult;importKiotVietProducts():RouteResult;deleteImportedKiotVietProducts():RouteResult};catalogBomHandlers:{getProductBom():RouteResult;upsertProductBom():RouteResult};listProductsForRequest(url:URL,repository:ServerRepository,organizationId:string,userId:string):Promise<ProductListData[]>;countAllProductsForRequest(url:URL,repository:ServerRepository,organizationId:string,userId:string):Promise<number>;sortProductsForRequest(items:ProductListData[],url:URL):ProductListData[];paged<T>(items:T[],page:number,pageSize:number):Paged<T>;normalizeCreateProductInput(body:Record<string,unknown>):ProductCreateInput;randomUUID():string;nowIso:string;httpError(status:number,code:'VALIDATION_ERROR'|'RESOURCE_CONFLICT',message:string,fields?:Record<string,string[]>):Error}
export function createCatalogProductHandlers(deps:CatalogProductDeps){const {request,url,currentUser,repository,path,readJson,getIdFromPath,products,productGroups,priceLists,catalogImportHandlers,catalogBomHandlers,listProductsForRequest,countAllProductsForRequest,sortProductsForRequest,paged,normalizeCreateProductInput,randomUUID,nowIso,httpError}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listProducts: async () => {
      const sortKey = url.searchParams.get('sort_key')
      const sortDirection = url.searchParams.get('sort_direction') ?? 'desc'
      const usesDefaultDatabaseSort = !sortKey || (sortKey === 'created_at' && sortDirection === 'desc')
      if (repository.listProductsPage && url.searchParams.get('sort') !== 'pos_usage' && usesDefaultDatabaseSort) {
        const result = await repository.listProductsPage({ organizationId: currentUser.organization.id, userId: currentUser.user.id, url })
        return {
          found: true,
          data: {
            items: result.items,
            page,
            page_size: pageSize,
            total: result.total,
            total_all: result.total_all ?? result.total,
          },
        }
      }
      const isPosUsageSort = url.searchParams.get('sort') === 'pos_usage'
      const productsForRequest = await listProductsForRequest(url, repository, currentUser.organization.id, currentUser.user.id)
      const items = isPosUsageSort
        ? productsForRequest
        : sortProductsForRequest(productsForRequest, url)
      return {
        found: true,
        data: {
          ...paged(items, page, pageSize),
          total_all: isPosUsageSort
            ? productsForRequest.reduce((total, product) => total + 1 + (product.unit_conversions?.length ?? 0), 0)
            : await countAllProductsForRequest(url, repository, currentUser.organization.id, currentUser.user.id),
        },
      }
    },
    previewKiotVietProductImport: catalogImportHandlers.previewKiotVietProductImport,
    importKiotVietProducts: catalogImportHandlers.importKiotVietProducts,
    deleteImportedKiotVietProducts: catalogImportHandlers.deleteImportedKiotVietProducts,
    getProductBom: catalogBomHandlers.getProductBom,
    createProduct: async () => {
      const body = await readJson(request)
      const normalized = normalizeCreateProductInput(body)
      try {
        const created = repository.createProduct
          ? await repository.createProduct({
              organizationId: currentUser.organization.id,
              ...normalized,
            })
          : (() => {
              const resolvedGroup =
                (normalized.product_group_id
                  ? productGroups.find((group: ProductGroupListData) => group.id === normalized.product_group_id)
                  : productGroups.find((group: ProductGroupListData) => group.is_default))
                ?? products[0]?.product_group
              if (!resolvedGroup) throw httpError(400, 'VALIDATION_ERROR', 'product_group_id is invalid.', { product_group_id: ['product_group_id is invalid.'] })
              const latestPurchaseCost = normalized.latest_purchase_cost ?? null
              const fallback = {
                ...products[0],
                id: randomUUID(),
                code: normalized.code,
                name: normalized.name,
                status: normalized.status,
                product_kind: normalized.product_kind,
                unit_name: normalized.unit_name,
                sell_method: normalized.sell_method,
                inventory_shape: normalized.inventory_shape,
                track_inventory: normalized.track_inventory,
                product_group_id: resolvedGroup.id,
                product_group: { id: resolvedGroup.id, code: resolvedGroup.code, name: resolvedGroup.name },
                latest_purchase_cost: latestPurchaseCost,
                latest_purchase_cost_at: latestPurchaseCost === null ? null : nowIso,
                default_sale_price: null as number | null,
                unit_conversions: normalized.unit_conversions as typeof products[number]['unit_conversions'],
                created_at: nowIso,
                updated_at: nowIso,
              }
              products.push(fallback)
              return fallback
            })()
        return { found: true, data: created, status: 201 }
      } catch (error) {
        if (error instanceof Error && error.message === 'PRODUCT_ALREADY_EXISTS') {
          throw httpError(409, 'RESOURCE_CONFLICT', 'Product code already exists.', { code: ['Product code already exists.'] })
        }
        if (error instanceof Error && error.message === 'PRODUCT_GROUP_NOT_FOUND') {
          throw httpError(400, 'VALIDATION_ERROR', 'product_group_id is invalid.', { product_group_id: ['product_group_id is invalid.'] })
        }
        throw error
      }
    },
    updateProduct: async () => ({ found: true, data: { ...products[0], ...(await readJson(request)), id: getIdFromPath(path) } }),
    upsertProductBom: catalogBomHandlers.upsertProductBom,
    customerRecentPrices: async () => ({ found: true, data: { items: [{ unitPrice: 600000, soldAt: nowIso, orderCode: 'HD0001' }] } }),
    resolvePricing: async () => {
      const body = await readJson(request)
      const productIds = Array.isArray(body.product_ids) ? body.product_ids : products.map((product: ProductListData) => product.id)
      const repositoryPrices = await repository.resolvePrices?.({
        organizationId: currentUser.organization.id,
        productIds: productIds.map(String),
        customerId: typeof body.customer_id === 'string' && body.customer_id.trim() ? body.customer_id.trim() : null,
      })
      if (repositoryPrices) {
        return {
          found: true,
          data: { items: repositoryPrices },
        }
      }
      return {
        found: true,
        data: { items: productIds.map((productId: unknown) => ({ product_id: productId, unit_price: 600000, price_source: 'default_price_list', price_list_id: 'pl-default' })) },
      }
    },
    priceLists: async () => ({
      found: true,
      data: { items: await repository.listPriceLists?.({ organizationId: currentUser.organization.id }) ?? priceLists },
    }),
    previewPriceFormula: async () => {
      try {
        if (!repository.previewPriceFormula) throw httpError(503, 'VALIDATION_ERROR', 'Price formula persistence is unavailable.')
        const formula = parsePriceFormulaInput(await readJson(request))
        return { found: true, data: await repository.previewPriceFormula({ organizationId: currentUser.organization.id, formula }) }
      } catch (error) {
        if (error instanceof PriceFormulaValidationError) throw httpError(400, 'VALIDATION_ERROR', error.message)
        throw error
      }
    },
    applyPriceFormula: async () => {
      try {
        if (!repository.applyPriceFormula) throw httpError(503, 'VALIDATION_ERROR', 'Price formula persistence is unavailable.')
        const body = await readJson(request)
        const formula = parsePriceFormulaInput(body.formula)
        const selectedItems = parsePriceFormulaSelection(body.selected_items)
        return { found: true, data: await repository.applyPriceFormula({ organizationId: currentUser.organization.id, formula, selectedItems }) }
      } catch (error) {
        if (error instanceof PriceFormulaValidationError) throw httpError(400, 'VALIDATION_ERROR', error.message)
        throw error
      }
    },
  }}
