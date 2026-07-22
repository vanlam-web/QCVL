import type { Product } from '../catalog/types'
import type { CashbookEntry } from '../finance/types'

export interface CheckoutCartLine {
  id: string
  product: Product
  quantity: number
  width_m?: number
  height_m?: number
  linear_m?: number
  pieceCount?: number
  unitPrice: number
  saleUnitName?: string
  stockQtyPerSaleUnit?: number
  discountAmount?: number
  priceSource: string
  isManualPrice: boolean
  recentPrices?: Array<{ unitPrice: number; soldAt: string; orderCode: string }>
  note?: string
  quoteWarnings?: Array<{
    code: 'PRODUCT_INACTIVE' | 'PRODUCT_MISSING' | 'CURRENT_PRICE_DIFFERS'
    message: string
  }>
}

export interface FinanceAccount {
  id: string
  code: string
  name: string
  account_type: 'cash' | 'bank'
  is_default_cash: boolean
  is_active: boolean
}

export interface CheckoutInput {
  customer_id?: string
  created_at?: string
  note?: string
  retail_debt_note?: string
  items: Array<{
    product_id: string
    quantity: number
    width_m?: number
    height_m?: number
    linear_m?: number
    unit_price: number
    sale_unit_name?: string
    stock_qty_per_sale_unit?: number
    discount_amount?: number
    price_source: string
    note?: string
  }>
  payment: {
    cash_amount: number
    bank_amount: number
    bank_account_id?: string | null
    old_debt_payment_amount: number
    old_debt_allocations?: Array<{
      order_id: string
      order_code: string
      allocated_amount: number
    }>
    change_returned_amount: number
  }
}

export type RevisionReasonCode =
  | 'wrong_price'
  | 'wrong_dimension'
  | 'wrong_customer'
  | 'customer_changed_mind'
  | 'other'

export interface ReviseInvoiceInput extends CheckoutInput {
  revision_reason_code: RevisionReasonCode
  revision_reason_note?: string
}

export interface QuoteSummary {
  id: string
  code: string
  order_type: 'quote'
  status: 'active' | 'converted' | 'cancelled'
  total_amount: number
}

export interface QuoteReopenPayload {
  quote: {
    id: string
    code: string
    status: 'active' | 'converted' | 'cancelled'
  }
  customer: {
    customer_id: string | null
    snapshot: { code: string | null; name: string; phone: string | null }
    warnings: Array<{ code: 'CUSTOMER_CHANGED'; message: string }>
  }
  price_list: {
    price_list_id: string | null
    snapshot: { code: string | null; name: string | null }
    warnings: Array<{ code: 'PRICE_LIST_INACTIVE'; message: string }>
  }
  items: Array<{
    order_item_id: string
    product_id: string | null
    product_snapshot: {
      code: string
      name: string
      unit_name: string
      sell_method: Product['sell_method']
    }
    quantity: number
    width_m?: number | null
    height_m?: number | null
    linear_m?: number | null
    unit_price: number
    discount_amount: number
    price_source: string
    note: string | null
    warnings: Array<{
      code: 'PRODUCT_INACTIVE' | 'PRODUCT_MISSING' | 'CURRENT_PRICE_DIFFERS'
      message: string
    }>
  }>
  summary: { subtotal_amount: number; discount_amount: number; total_amount: number }
  note: string | null
}

export interface InvoiceRevisionHandoffPayload {
  mode: 'invoice-revision'
  original_order: {
    id: string
    code: string
  }
  customer: {
    customer_id: string | null
    snapshot: { code: string | null; name: string; phone: string | null }
  }
  items: Array<{
    order_item_id: string
    product_id: string | null
    product_snapshot: {
      code: string
      name: string
      unit_name: string
      sell_method: Product['sell_method']
    }
    quantity: number
    width_m?: number | null
    height_m?: number | null
    linear_m?: number | null
    unit_price: number
    discount_amount: number
    price_source: string
    note: string | null
  }>
  summary: { subtotal_amount: number; discount_amount: number; total_amount: number }
  note: string | null
  created_at?: string
}

export interface CheckoutResult {
  order: {
    id: string
    code: string
    order_type: 'invoice'
    status: 'completed'
    total_amount: number
    paid_amount: number
    debt_amount: number
    payment_status: 'unpaid' | 'partial' | 'paid'
    created_at?: string
    base_code?: string
    revision_no?: number
    revised_from_order_id?: string | null
  }
  payment_receipt: { id: string; code: string; total_received_amount: number } | null
  inventory_warnings: Array<{ product_id: string; code: string; message: string }>
}

export interface CustomerDebtDetail {
  customer_id: string
  total_debt: number
  invoices: Array<{
    order_id: string
    order_code: string
    created_at: string
    total_amount: number
    paid_amount: number
    debt_amount: number
    remaining_debt: number
  }>
  adjustments?: Array<{
    id: string
    source_code: string
    created_at: string
    transaction_type: string
    amount_delta: number
    paid_amount: number
    remaining_amount: number
    balance_after: number
    source_file: string | null
  }>
  linked_supplier_receipts?: Array<{
    id: string
    code: string
    created_at: string
    supplier_id: string
    supplier_code: string
    supplier_name: string
    payable_amount: number
    paid_amount: number
    remaining_amount: number
  }>
  cashbook_entries?: CashbookEntry[]
  ledger_rows?: Array<{
    id: string
    code: string
    created_at: string
    amount_delta: number
    balance_after: number
    source_type?: string
    source_id?: string | null
  }>
}

export interface CustomerOpenDebtResponse {
  items: Array<{
    order_id: string
    order_code: string
    created_at: string
    total_amount: number
    paid_amount: number
    remaining_debt: number
    allocated_amount: number
  }>
  has_more: boolean
}

export interface RecentPriceList {
  items: Array<{ unitPrice: number; soldAt: string; orderCode: string }>
}
