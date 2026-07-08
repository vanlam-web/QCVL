import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type { ProductionQueueDraftPayload, ProductionQueueListResponse } from './types'

export interface ProductionQueueApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createProductionQueueService(api: ProductionQueueApiRequester) {
  return {
    listQueue: () => api.request<ProductionQueueListResponse>('/api/v1/production-queue'),
    listHistory: () => api.request<ProductionQueueListResponse>('/api/v1/production-queue/history'),
    addToDraft: (queueItemId: string) =>
      api.request<ProductionQueueDraftPayload>(
        `/api/v1/production-queue/${queueItemId}/add-to-draft`,
        { method: 'POST' },
      ),
    dismiss: (queueItemId: string) =>
      api.request(`/api/v1/production-queue/${queueItemId}/dismiss`, { method: 'POST' }),
    restore: (queueItemId: string) =>
      api.request(`/api/v1/production-queue/${queueItemId}/restore`, { method: 'POST' }),
  }
}

export type ProductionQueueService = ReturnType<typeof createProductionQueueService>

export function createBrowserProductionQueueService(getAccessToken: () => Promise<string | null>) {
  return createProductionQueueService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
