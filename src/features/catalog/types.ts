export type ProductStatus = 'active' | 'inactive'
export type SellMethod = 'quantity' | 'area_m2' | 'linear_m' | 'sheet' | 'combo'
export type ProductKind = 'goods' | 'service' | 'auxiliary_material' | 'roll' | 'sheet' | 'combo'

export interface Product {
  id: string
  code: string
  name: string
  status: ProductStatus
  product_kind?: ProductKind
  unit_name: string
  sell_method: SellMethod
  latest_purchase_cost?: number | null
  latest_purchase_cost_at?: string | null
  default_sale_price?: number | null
  product_group_id?: string | null
  product_group?: { id: string; code: string; name: string } | null
  inventory_shape?: 'normal' | 'roll' | 'sheet'
  track_inventory?: boolean
  unit_conversions?: ProductUnitConversion[]
  kiotviet_provisional_stock?: {
    quantity: number
    unit_name: string
    source_type: 'kiotviet_import'
    source_label: string | null
    status?: string
    updated_at?: string | null
  } | null
  operating_stock?: {
    quantity: number
    unit_name: string
    source_type: 'stock_movements'
    source_label: string | null
    updated_at?: string | null
  } | null
  latest_kiotviet_stocktake?: {
    code: string
    source_created_at: string | null
    source_balanced_at: string | null
    system_qty: number | null
    actual_qty: number | null
    difference_qty: number | null
    unit_name: string | null
  } | null
  draft_bom?: {
    id: string
    version: number
    status: 'draft'
    item_count: number
    notes: string | null
  } | null
}

export interface ProductUnitConversion {
  unit_id: string
  source_code?: string | null
  unit_name: string
  stock_qty_per_unit: number
  is_default_purchase_unit: boolean
  is_default_sale_unit: boolean
}

export interface ProductGroup {
  id: string
  code: string
  name: string
  is_default: boolean
  is_active: boolean
}

export interface ProductBomItem {
  id: string
  component_product_id: string
  component_product: {
    id: string
    code: string
    name: string
    unit_name: string
    product_kind?: ProductKind
    latest_purchase_cost?: number | null
  }
  quantity: number
  sort_order: number
  notes: string | null
}

export interface ProductBom {
  id: string
  product_id: string
  version: number
  status: 'draft' | 'active' | 'archived'
  notes: string | null
  created_at: string
  items: ProductBomItem[]
}

export interface ProductListResponse {
  items: Product[]
  page: number
  page_size: number
  total: number
  total_all?: number
  summary?: {
    total_qty: number
    negative_count: number
  }
}

export interface ProductStockMovement {
  id: string
  product_id: string
  movement_type: string
  quantity_delta: number
  created_at: string
  document_code?: string | null
  document_type?: 'sale_invoice' | 'purchase_receipt' | 'stocktake' | 'manual' | 'material_opening' | null
  transaction_price?: number | null
  cost_price?: number | null
  ending_qty?: number | null
  partner_name?: string | null
}

export interface ProductStockMovementListResponse {
  items: ProductStockMovement[]
  page: number
  page_size: number
  total: number
}

export interface ProductStocktake {
  id: string
  code: string
  status: 'draft' | 'balanced' | 'cancelled'
  source_type: 'manual' | 'product_edit'
  created_at: string
  balanced_at: string | null
  total_actual_qty: number
  total_actual_value: number | null
  total_difference_value: number | null
  increased_qty: number
  decreased_qty: number
  note: string | null
}

export interface KiotVietProductInvalidRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: string[]
}

export interface KiotVietProductImportPreview {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    create_rows: number
    update_rows: number
    unit_review_rows: number
    price_rows?: number
    price_skipped_rows?: number
    provisional_stock_rows?: number
    provisional_stock_skipped_rows?: number
    bom_rows?: number
    bom_skipped_rows?: number
    price_list_name?: string | null
    cleanup_demo_requested: boolean
    ignored_columns: string[]
    deferred_columns: string[]
  }
  invalid_rows: KiotVietProductInvalidRow[]
}

export interface KiotVietProductImportResult {
  summary: {
    total_rows?: number
    valid_rows?: number
    invalid_rows?: number
    unit_review_rows?: number
    created_rows: number
    updated_rows: number
    skipped_rows?: number
    price_created_rows?: number
    price_updated_rows?: number
    price_skipped_rows?: number
    provisional_stock_created_rows?: number
    provisional_stock_updated_rows?: number
    provisional_stock_skipped_rows?: number
    bom_created_rows?: number
    bom_updated_rows?: number
    bom_skipped_rows?: number
    price_list_name?: string | null
    cleanup_deleted_rows: number
    cleanup_blocked_rows: number
  }
  invalid_rows: KiotVietProductInvalidRow[]
}

export interface KiotVietImportDeleteResult {
  deleted_rows: number
  blocked_rows: number
}

export interface KiotVietCustomerInvalidRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: string[]
}

export interface KiotVietCustomerImportPreview {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    create_rows: number
    update_rows: number
    group_rows: number
    kiotviet_debt_total: number
    kiotviet_total_sales: number
    ignored_columns: string[]
  }
  invalid_rows: KiotVietCustomerInvalidRow[]
}

export interface KiotVietCustomerImportResult {
  summary: {
    total_rows?: number
    valid_rows?: number
    invalid_rows?: number
    created_rows: number
    updated_rows: number
    skipped_rows?: number
    group_rows?: number
    kiotviet_debt_total?: number
    kiotviet_total_sales?: number
  }
  invalid_rows: KiotVietCustomerInvalidRow[]
}

export interface CustomerGroup {
  id: string
  code: string
  name: string
  price_list_id: string
  is_active: boolean
}

export interface Customer {
  id: string
  code: string
  name: string
  phone: string | null
  tax_code: string | null
  address: string | null
  customer_group_id: string | null
  customer_group: { id: string; code: string; name: string } | null
  customer_type?: 'individual' | 'company' | 'other' | string | null
  company_name?: string | null
  created_by?: { id: string; name: string } | null
  source_creator_name?: string | null
  created_at?: string
  note?: string | null
  status?: string | null
  total_sales_amount?: number
  total_debt_amount?: number
}

export interface CustomerListResponse {
  items: Customer[]
  page: number
  page_size: number
  total: number
  summary?: {
    total_debt_amount: number
    total_sales_amount: number
  }
}

export interface ResolvedPrice {
  product_id: string
  unit_price: number
  price_source:
    | 'default_price_list'
    | 'customer_group_price_list'
    | 'fallback_default_price_list'
    | 'latest_purchase_cost'
    | 'latest_purchase_cost_missing_zero'
    | 'price_formula'
    | 'price_formula_missing_cost_zero'
  price_list_id: string
}

export interface ResolvePricesResponse {
  items: ResolvedPrice[]
}

export interface PriceList {
  id: string
  code: string
  name: string
  is_default: boolean
  is_active: boolean
}

export interface PriceListResponse {
  items: PriceList[]
}

export interface PriceFormulaInput {
  name: string
  product_filter: {
    status: 'active'
    name_contains?: string
    code_contains?: string
    sell_method?: SellMethod
  }
  cost_formula: { type: 'fixed'; amount: number } | { type: 'amount_plus_percent'; amount: number; percent_of_latest_purchase_cost: number }
  profit_formula:
    | { type: 'fixed'; amount: number }
    | {
        type: 'tiers'
        tiers: Array<{ operator: '<' | '<=' | '>' | '>=' | '='; value: number; amount: number; percent?: number }>
      }
  price_list_adjustments: Record<string, { type: 'amount'; amount: number } | { type: 'percent'; percent: number }>
}

export interface PriceFormulaPreviewPrice {
  price_list_id: string
  price_list_name: string
  current_unit_price: number | null
  computed_unit_price: number
  delta: number | null
}

export interface PriceFormulaPreviewItem {
  product_id: string
  product_code: string
  product_name: string
  latest_purchase_cost: number
  current_mode: 'manual' | 'formula' | null
  current_unit_price: number | null
  computed_prices: PriceFormulaPreviewPrice[]
}

export interface PriceFormulaPreview {
  affected_count: number
  items: PriceFormulaPreviewItem[]
}

export interface PriceFormulaApplyResult {
  formula_rule_id: string
  affected_count: number
}
