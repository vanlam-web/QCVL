import type { CurrentUserData, ProductListData, ServerRepository, StockMovementData, StocktakeListData } from '../../http.js'
type InventoryProduct={product_id:string;available_qty:number;is_negative:boolean;[key:string]:unknown}
type Movement=StockMovementData
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type InventoryDeps={request:Request;url:URL;currentUser:CurrentUserData;repository:ServerRepository;path:string;readJson(request:Request):Promise<Record<string,unknown>>;getIdFromPath(path:string):string|undefined;inventoryProducts:InventoryProduct[];products:ProductListData[];stockMovements:StockMovementData[];filterInventoryProducts(url:URL):InventoryProduct[];inventoryProductListSummary(items:InventoryProduct[]):unknown;sortStocktakesForRequest(items:StocktakeListData[],url:URL):StocktakeListData[];stocktakeCreatorOptions(items:StocktakeListData[]):unknown;makeStocktake(user:CurrentUserData['user']):StocktakeListData;paged<T>(items:T[],page:number,pageSize:number):Paged<T>;newestFirst<T extends {created_at:string}>(items:T[]):T[];nowIso:string;randomUUID():string;requiredString(value:unknown,field:string):string;nullableString(value:unknown):string|null;validation(message:string,details?:Record<string,string[]>):Error}
export function createInventoryCoreHandlers(deps:InventoryDeps){const {request,url,currentUser,repository,path,readJson,getIdFromPath,inventoryProducts,products,stockMovements,filterInventoryProducts,inventoryProductListSummary,sortStocktakesForRequest,stocktakeCreatorOptions,makeStocktake,paged,newestFirst,nowIso,randomUUID,requiredString,nullableString,validation}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listProducts: async () => {
      const items = filterInventoryProducts(url)
      return { found: true, data: { ...paged(items, page, pageSize), summary: inventoryProductListSummary(items) } }
    },
    getProduct: async () => ({ found: true, data: inventoryProducts.find((product: InventoryProduct) => product.product_id === getIdFromPath(path)) ?? inventoryProducts[0] }),
    adjustStock: async () => {
      const body = await readJson(request)
      const actualQty = Number(body.actual_qty)
      const reason = requiredString(body.reason, 'reason')
      if (!Number.isFinite(actualQty) || actualQty < 0) {
        throw validation('actual_qty must be a non-negative number.', { actual_qty: ['actual_qty must be a non-negative number.'] })
      }
      const item = await repository.adjustNormalProductStock?.({
        organizationId: currentUser.organization.id,
        productId: getIdFromPath(path) ?? '',
        actualQty,
        reason,
        createdBy: { id: currentUser.user.id, name: currentUser.user.display_name },
      }) ?? makeStocktake(currentUser.user)
      return item
        ? { found: true, data: item }
        : { found: true, data: { message: 'Product not found' }, status: 404 }
    },
    stockMovements: async () => {
      const repositoryMovements = await repository.listStockMovements?.({ organizationId: currentUser.organization.id, url })
      const productId = url.searchParams.get('product_id')
      const items = repositoryMovements ?? (productId ? stockMovements.filter((movement: Movement) => movement.product_id === productId) : stockMovements)
      return { found: true, data: paged(newestFirst(items), page, pageSize) }
    },
    stocktakes: async () => {
      if (repository.listStocktakesPage && !url.searchParams.get('sort_key')) {
        const result = await repository.listStocktakesPage({ organizationId: currentUser.organization.id, url })
        return {
          found: true,
          data: {
            items: result.items,
            page,
            page_size: pageSize,
            total: result.total,
            creator_options: result.creator_options ?? stocktakeCreatorOptions(result.items),
          },
        }
      }
      const items = sortStocktakesForRequest(
        await repository.listStocktakes?.({ organizationId: currentUser.organization.id, url })
          ?? [makeStocktake(currentUser.user)],
        url,
      )
      const creatorUrl = new URL(url)
      creatorUrl.searchParams.delete('created_by')
      const creatorItems = await repository.listStocktakes?.({ organizationId: currentUser.organization.id, url: creatorUrl })
        ?? items
      return { found: true, data: { ...paged(items, page, pageSize), creator_options: stocktakeCreatorOptions(creatorItems) } }
    },
    getStocktake: async () => {
      const item = await repository.getStocktake?.({ organizationId: currentUser.organization.id, id: getIdFromPath(path) ?? '' })
      return item
        ? { found: true, data: item }
        : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
    },
    updateStocktake: async () => {
      const body = await readJson(request)
      if (body.status === 'cancelled') {
        const item = await repository.cancelStocktake?.({
          organizationId: currentUser.organization.id,
          id: getIdFromPath(path) ?? '',
        })
        return item
          ? { found: true, data: item }
          : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
      }
      const item = await repository.updateStocktakeNote?.({
        organizationId: currentUser.organization.id,
        id: getIdFromPath(path) ?? '',
        note: nullableString(body.note),
      })
      return item
        ? { found: true, data: item }
        : { found: true, data: { message: 'Stocktake not found' }, status: 404 }
    },
    shortagePreview: async () => ({
      found: true,
      data: { product_id: products[0].id, quantity: 1, source: 'product', shortages: [], warnings: [] },
    }),
    materialOpeningOptions: async () => ({
      found: true,
      data: {
        product: {
          id: products[0].id,
          code: products[0].code,
          name: products[0].name,
          inventory_shape: 'normal',
          stock_unit: { id: 'unit-normal', code: 'DONVI', name: 'đơn vị' },
        },
        conversions: [],
        warnings: [],
      },
    }),
    createMaterialOpening: async () => {
      const body = await readJson(request)
      const created = await repository.createMaterialOpening?.({
        organizationId: currentUser.organization.id,
        product_id: requiredString(body.product_id, 'product_id'),
        inventory_shape: 'normal',
        opened_unit_id: nullableString(body.opened_unit_id) ?? undefined,
        opened_qty: body.opened_qty === undefined ? undefined : Number(body.opened_qty),
        old_remaining_qty: body.old_remaining_qty === undefined ? undefined : Number(body.old_remaining_qty),
        note: nullableString(body.note) ?? undefined,
      }) ?? {
        id: randomUUID(),
        product_id: products[0].id,
        inventory_shape: 'normal',
        source_type: 'manual_normal',
        opened_unit_id: null,
        opened_qty: null,
        opened_stock_qty: null,
        stock_movement_id: null,
        warnings: [],
        created_at: nowIso,
      }
      return { found: true, data: created, status: 201 }
    },
  }
}
