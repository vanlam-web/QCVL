export type InventoryShape = 'normal' | 'roll' | 'sheet'
export type InventoryProductStatus = 'active' | 'inactive'
export type StocktakeStatus = 'draft' | 'balanced' | 'cancelled'

export interface InventoryProduct {
  product_id: string
  code: string
  name: string
  status: InventoryProductStatus
  inventory_shape: InventoryShape
  stock_unit: string
  available_qty: number
  is_negative: boolean
}

export interface InventoryProductListResponse {
  items: InventoryProduct[]
  page: number
  page_size: number
  total: number
  summary?: {
    total_qty: number
    negative_count: number
  }
}

export interface StockMovement {
  id: string
  product_id: string
  movement_type: string
  quantity_delta: number
  created_at: string
}

export interface StockMovementListResponse {
  items: StockMovement[]
  page: number
  page_size: number
  total: number
}

export interface Stocktake {
  id: string
  code: string
  status: StocktakeStatus
  source_type: 'manual' | 'product_edit' | 'kiotviet_import'
  created_at: string
  balanced_at: string | null
  source_creator_name?: string | null
  created_by: { id: string; name: string } | null
  total_actual_qty: number
  total_actual_value: number | null
  total_difference_value: number | null
  increased_qty: number
  decreased_qty: number
  product_code?: string | null
  product_name?: string | null
  product_system_qty?: number | null
  product_actual_qty?: number | null
  product_difference_qty?: number | null
  note: string | null
}

export interface StocktakeDetailItem {
  id: string
  line_no: number
  product_id: string | null
  product_code: string
  product_name: string
  unit_name: string | null
  system_qty: number | null
  actual_qty: number | null
  difference_qty: number | null
  line_actual_value: number | null
  line_difference_value: number | null
  note: string | null
}

export interface StocktakeDetail extends Stocktake {
  items: StocktakeDetailItem[]
}

export interface StocktakeCreatorOption {
  id: string
  name: string
}

export interface StocktakeListResponse {
  items: Stocktake[]
  creator_options?: StocktakeCreatorOption[]
  page: number
  page_size: number
  total: number
}

export interface KiotVietStocktakeImportPreview {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    stocktake_count: number
    product_code_count: number
    matched_product_count: number
    missing_product_count: number
    deleted_product_code_count: number
    formula_error_count: number
  }
  invalid_rows: Array<{ rowNumber: number; source_code: string | null; product_code: string | null; errors: string[] }>
  missing_product_codes: string[]
}

export interface KiotVietStocktakeImportResult {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    stocktakes_created: number
    stocktakes_updated: number
    items_created: number
    items_updated: number
    missing_product_rows: number
    cleanup_deleted_rows?: number
    cleanup_blocked_rows?: number
    creates_stock_movements: false
  }
  invalid_rows: KiotVietStocktakeImportPreview['invalid_rows']
}

export interface KiotVietImportDeleteResult {
  deleted_rows: number
  blocked_rows: number
}

export interface InventoryRoll {
  id: string
  product_id: string
  code: string
  width_m: number
  initial_length_m: number
  remaining_length_m: number
  initial_area_m2: number
  remaining_area_m2: number
  status: 'available' | 'in_use' | 'empty' | 'discarded'
  note: string | null
  created_at: string
}

export interface InventorySheet {
  id: string
  product_id: string
  code: string
  sheet_kind: 'full' | 'in_use' | 'remnant'
  width_m: number
  length_m: number
  area_m2: number
  status: 'available' | 'used' | 'discarded'
  note: string | null
  created_at: string
}

export interface InventoryRollListResponse {
  items: InventoryRoll[]
  page: number
  page_size: number
  total: number
}

export interface InventorySheetListResponse {
  items: InventorySheet[]
  page: number
  page_size: number
  total: number
}

export interface MaterialOpeningConversionOption {
  unit_id: string
  code: string
  name: string
  stock_qty_per_unit: number
}

export interface MaterialOpeningOptions {
  product: {
    id: string
    code: string
    name: string
    inventory_shape: InventoryShape
    stock_unit: { id: string; code: string; name: string }
  }
  conversions: MaterialOpeningConversionOption[]
  warnings: string[]
}

export type MaterialOpeningInput = {
  product_id: string
  inventory_shape: 'normal'
  opened_unit_id: string
  opened_qty: number
  old_remaining_qty?: number
  note?: string
} | {
  product_id: string
  inventory_shape: 'roll'
  old_inventory_roll_id: string
  old_remaining_length_m: number
  note?: string
} | {
  product_id: string
  inventory_shape: 'sheet'
  old_inventory_sheet_id: string
  old_remaining_width_m?: number
  old_remaining_length_m?: number
  discard_old_sheet?: boolean
  note?: string
}

export interface MaterialOpeningResult {
  id: string
  product_id: string
  inventory_shape: 'normal' | 'roll' | 'sheet'
  source_type: 'manual_normal' | 'standard_object' | 'kiotviet_provisional'
  opened_unit_id: string | null
  opened_qty: number | null
  opened_stock_qty: number | null
  stock_movement_id: string | null
  warnings: string[]
  created_at: string
}

export interface PosShortagePreviewInput {
  product_id: string
  quantity: number
}

export interface PosShortageMaterial {
  product_id: string
  code: string
  name: string
  required_qty: number
  available_qty: number
  shortage_qty: number
  stock_unit: { id: string; code: string; name: string }
  inventory_shape: 'normal'
  quick_material_opening_supported: boolean
  conversion_options: MaterialOpeningConversionOption[]
}

export interface PosShortagePreview {
  product_id: string
  quantity: number
  source: 'product' | 'standard_bom'
  bom_id?: string
  shortages: PosShortageMaterial[]
  warnings: string[]
}
