type ProductionHandlersDeps = {
  path: string
  page: number
  pageSize: number
  productionQueueItems: unknown[]
  products: Array<{ id: string; code: string; name: string; unit_name: string; sell_method: string }>
  paged: <T>(items: readonly T[], page: number, pageSize: number) => unknown
  newestFirst: <T>(items: readonly T[]) => T[]
  defaultRetailCustomer: () => unknown
}
export function createProductionHandlers(deps: ProductionHandlersDeps) {
  const { path, page, pageSize, productionQueueItems, products, paged, newestFirst, defaultRetailCustomer } = deps
  return {
    listQueue: async () => ({ found: true, data: paged(newestFirst(productionQueueItems), page, pageSize) }),
    history: async () => ({ found: true, data: paged([], page, pageSize) }),
    addToDraft: async () => ({ found: true, data: { queue_item_id: path.split('/')[4], customer: defaultRetailCustomer(), draft_line: { product_id: products[0].id, product_code: products[0].code, product_name: products[0].name, unit_name: products[0].unit_name, sell_method: products[0].sell_method, width_m: 1.2, height_m: 0.8, linear_m: null, quantity: 1, source: 'production_queue' } } }),
    setVisibility: async () => ({ found: true, data: {} }),
  }
}
