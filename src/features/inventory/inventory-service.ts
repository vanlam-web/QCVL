import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import { parseKiotVietProductWorkbook } from '../catalog/kiotviet-product-import'
import type {
  InventoryProduct,
  InventoryProductListResponse,
  InventoryProductStatusFilter,
  InventoryRollListResponse,
  InventorySheetListResponse,
  InventoryShape,
  KiotVietStocktakeImportPreview,
  KiotVietStocktakeImportResult,
  KiotVietImportDeleteResult,
  MaterialOpeningInput,
  MaterialOpeningOptions,
  MaterialOpeningResult,
  PosShortagePreview,
  PosShortagePreviewInput,
  StockMovementListResponse,
  Stocktake,
  StocktakeDetail,
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
      status?: InventoryProductStatusFilter
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
    listStocktakes: (input: { search?: string; status?: Stocktake['status'] | string; from?: string; to?: string; created_by?: string; page?: number; page_size?: number; sort_key?: 'code' | 'created_at' | 'product_code' | 'product_name' | 'product_system_qty' | 'product_actual_qty' | 'product_difference_qty' | 'status'; sort_direction?: 'asc' | 'desc' } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.status) params.set('status', input.status)
      if (input.from) params.set('from', input.from)
      if (input.to) params.set('to', input.to)
      if (input.created_by) params.set('created_by', input.created_by)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      params.set('sort_key', input.sort_key ?? 'created_at')
      params.set('sort_direction', input.sort_direction ?? 'desc')
      const query = params.toString()
      return api.request<StocktakeListResponse>(`/api/v1/inventory/stocktakes${query ? `?${query}` : ''}`)
    },
    getStocktake: (id: string) =>
      api.request<StocktakeDetail>(`/api/v1/inventory/stocktakes/${encodeURIComponent(id)}`),
    updateStocktakeNote: (id: string, input: { note: string | null }) =>
      api.request<StocktakeDetail>(`/api/v1/inventory/stocktakes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    cancelStocktake: (id: string) =>
      api.request<StocktakeDetail>(`/api/v1/inventory/stocktakes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    previewKiotVietStocktakeImport: async (input: { file: File; cleanup_demo?: boolean }) =>
      api.request<KiotVietStocktakeImportPreview>('/api/v1/inventory/stocktakes/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietStocktakeImportPayload(input)),
      }),
    importKiotVietStocktakes: async (input: { file: File; cleanup_demo?: boolean }) =>
      api.request<KiotVietStocktakeImportResult>('/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietStocktakeImportPayload(input)),
      }),
    deleteImportedKiotVietStocktakes: async () =>
      api.request<KiotVietImportDeleteResult>('/api/v1/inventory/stocktakes/import/kiotviet', {
        method: 'DELETE',
      }),
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

async function buildKiotVietStocktakeImportPayload(input: { file: File; cleanup_demo?: boolean }) {
  const buffer = await input.file.arrayBuffer()
  if (canParseCompressedXlsxInBrowser()) {
    return {
      cleanup_demo: Boolean(input.cleanup_demo),
      file_name: input.file.name,
      rows: await parseKiotVietProductWorkbook(buffer),
    }
  }
  return {
    cleanup_demo: Boolean(input.cleanup_demo),
    file_name: input.file.name,
    file_base64: arrayBufferToBase64(buffer),
  }
}

function canParseCompressedXlsxInBrowser() {
  try {
    return typeof DecompressionStream === 'function' && Boolean(new DecompressionStream('deflate-raw'))
  } catch {
    return false
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function createBrowserInventoryService(getAccessToken: () => Promise<string | null>) {
  return createInventoryService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
