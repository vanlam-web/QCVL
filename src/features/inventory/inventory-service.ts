import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type {
  InventoryProduct,
  InventoryProductListResponse,
  InventoryProductStatus,
  InventoryRollListResponse,
  InventorySheetListResponse,
  InventoryShape,
  MaterialOpeningInput,
  MaterialOpeningOptions,
  MaterialOpeningResult,
  PosShortagePreview,
  PosShortagePreviewInput,
  StockMovementListResponse,
  Stocktake,
  StocktakeListResponse,
} from './types'

export interface InventoryApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export interface StockAdjustmentInput {
  actual_qty: number
  reason: string
}

export function createInventoryService(api: InventoryApiRequester) {
  return {
    listInventoryProducts: (input: {
      search?: string
      status?: InventoryProductStatus | 'all'
      inventory_shape?: InventoryShape
      page?: number
      page_size?: number
    } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('q', input.search)
      if (input.status) params.set('status', input.status)
      if (input.inventory_shape) params.set('inventory_shape', input.inventory_shape)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<InventoryProductListResponse>(`/api/v1/inventory/products${query ? `?${query}` : ''}`)
    },
    getInventoryProduct: (productId: string) =>
      api.request<InventoryProduct>(`/api/v1/inventory/products/${productId}`),
    listStockMovements: (input: { product_id?: string; order_id?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.order_id) params.set('order_id', input.order_id)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<StockMovementListResponse>(`/api/v1/inventory/stock-movements${query ? `?${query}` : ''}`)
    },
    listStocktakes: (input: { search?: string; status?: Stocktake['status']; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.status) params.set('status', input.status)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<StocktakeListResponse>(`/api/v1/inventory/stocktakes${query ? `?${query}` : ''}`)
    },
    listInventoryRolls: (input: { product_id?: string; status?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.status) params.set('status', input.status)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<InventoryRollListResponse>(`/api/v1/inventory/rolls${query ? `?${query}` : ''}`)
    },
    listInventorySheets: (input: { product_id?: string; status?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.status) params.set('status', input.status)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<InventorySheetListResponse>(`/api/v1/inventory/sheets${query ? `?${query}` : ''}`)
    },
    adjustNormalProductStock: (productId: string, input: StockAdjustmentInput) =>
      api.request<Stocktake>(`/api/v1/inventory/products/${productId}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    previewPosShortage: (input: PosShortagePreviewInput) =>
      api.request<PosShortagePreview>('/api/v1/inventory/pos-shortage-preview', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getMaterialOpeningOptions: (productId: string) =>
      api.request<MaterialOpeningOptions>(
        `/api/v1/inventory/material-openings/options?product_id=${encodeURIComponent(productId)}`,
      ),
    createMaterialOpening: (input: MaterialOpeningInput) =>
      api.request<MaterialOpeningResult>('/api/v1/inventory/material-openings', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  }
}

export type InventoryService = ReturnType<typeof createInventoryService>

export function createBrowserInventoryService(getAccessToken: () => Promise<string | null>) {
  return createInventoryService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
