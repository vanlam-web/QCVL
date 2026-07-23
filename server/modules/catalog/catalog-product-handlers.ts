import type { CurrentUserData, ProductGroupListData, ProductListData, ServerRepository } from '../../http.js'
import type { RouteResult } from '../../route-types.js'
type ProductCreateInput=Omit<Parameters<NonNullable<ServerRepository['createProduct']>>[0],'organizationId'>
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type CatalogProductDeps={request:Request;url:URL;currentUser:CurrentUserData;repository:ServerRepository;path:string;readJson(request:Request):Promise<Record<string,unknown>>;getIdFromPath(path:string):string|undefined;products:ProductListData[];productGroups:ProductGroupListData[];priceLists:unknown[];catalogImportHandlers:{previewKiotVietProductImport():RouteResult;importKiotVietProducts():RouteResult;deleteImportedKiotVietProducts():RouteResult};catalogBomHandlers:{getProductBom():RouteResult;upsertProductBom():RouteResult};listProductsForRequest(url:URL,repository:ServerRepository,organizationId:string,userId:string):Promise<ProductListData[]>;countAllProductsForRequest(url:URL,repository:ServerRepository,organizationId:string,userId:string):Promise<number>;sortProductsForRequest(items:ProductListData[],url:URL):ProductListData[];paged<T>(items:T[],page:number,pageSize:number):Paged<T>;normalizeCreateProductInput(body:Record<string,unknown>):ProductCreateInput;randomUUID():string;nowIso:string;httpError(status:number,code:'VALIDATION_ERROR'|'RESOURCE_CONFLICT',message:string,fields?:Record<string,string[]>):Error}
export function createCatalogProductHandlers(deps:CatalogProductDeps){const {request,url,currentUser,repository,path,readJson,getIdFromPath,products,productGroups,priceLists,catalogImportHandlers,catalogBomHandlers,listProductsForRequest,countAllProductsForRequest,sortProductsForRequest,paged,normalizeCreateProductInput,randomUUID,nowIso,httpError}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listProducts: async () => {
      if (repository.listProductsPage && url.searchParams.get('sort') !== 'pos_usage' && !url.searchParams.get('sort_key')) {
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
      const productsForRequest = await listProductsForRequest(url, repository, currentUser.organization.id, currentUser.user.id)
      const items = url.searchParams.get('sort') === 'pos_usage'
        ? productsForRequest
        : sortProductsForRequest(productsForRequest, url)
      return {
        found: true,
        data: {
          ...paged(items, page, pageSize),
          total_all: await countAllProductsForRequest(url, repository, currentUser.organization.id, currentUser.user.id),
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
    previewPriceFormula: async () => ({ found: true, data: { affected_count: 1, items: [{ product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, latest_purchase_cost: 250000, current_mode: 'manual', current_unit_price: 600000, computed_prices: [{ price_list_id: 'pl-default', price_list_name: 'Bang gia le', current_unit_price: 600000, computed_unit_price: 620000, delta: 20000 }] }] } }),
    applyPriceFormula: async () => ({ found: true, data: { formula_rule_id: randomUUID(), affected_count: 1 } }),
  }}
