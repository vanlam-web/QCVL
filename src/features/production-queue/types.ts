import type { SellMethod } from '../catalog/types'

export interface ProductionQueueItem {
  id: string
  production_machine: { id: string; code: string; name: string }
  raw_file_name: string
  received_at: string
  status: 'queued' | 'added_to_draft' | 'dismissed'
  parse_status: 'pending' | 'ok' | 'error'
  parse_error: string | null
  parsed: Record<string, unknown>
}

export interface ProductionQueueListResponse {
  items: ProductionQueueItem[]
  page: number
  page_size: number
  total: number
}

export interface ProductionQueueDraftPayload {
  queue_item_id: string
  customer: { id: string; code: string; name: string } | null
  draft_line: {
    product_id: string
    product_code: string
    product_name: string
    unit_name: string
    sell_method: SellMethod
    width_m: number | null
    height_m: number | null
    linear_m: number | null
    quantity: number
    source: 'production_queue'
  }
}
