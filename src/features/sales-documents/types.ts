import type { SellMethod } from '../catalog/types'

export interface SalesDocumentListItem {
  id: string
  code: string
  order_type: 'quote' | 'invoice'
  status: 'active' | 'converted' | 'completed' | 'cancelled'
  created_at: string
  customer: { id: string | null; code: string | null; name: string; phone: string | null }
  seller: { id: string; name: string }
  subtotal_amount: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  debt_amount: number
  payment_status: 'not_applicable' | 'unpaid' | 'partial' | 'paid'
  note: string | null
}

export interface SalesDocumentDetail extends SalesDocumentListItem {
  price_list: { id: string; code: string; name: string } | null
  change_returned_amount: number
  items: Array<{
    id: string
    line_no: number
    product: { id: string | null; code: string; name: string; unit_name: string; sell_method: SellMethod }
    quantity: number
    width_m?: number | null
    height_m?: number | null
    linear_m?: number | null
    unit_price: number
    line_subtotal_amount: number
    discount_amount: number
    line_total: number
    price_source: string
    note: string | null
  }>
  payment_receipts: Array<{
    id: string
    code: string
    status: 'posted' | 'cancelled'
    receipt_type: 'sale_payment' | 'debt_collection' | 'mixed_sale_and_debt'
    total_received_amount: number
    created_at: string
    created_by: { id: string; name: string }
    methods: Array<{
      method_type: 'cash' | 'bank_transfer'
      amount: number
      finance_account: { id: string; code: string; name: string }
    }>
    allocations: Array<{
      order_id: string
      order_code: string
      allocated_amount: number
      remaining_after: number
    }>
  }>
  debt_entries: Array<{
    id: string
    entry_type: 'invoice_debt' | 'debt_payment' | 'debt_adjustment'
    amount_delta: number
    balance_after_order: number
    balance_after_customer: number
    created_at: string
  }>
  stock_movements: Array<{
    id: string
    product_id: string
    movement_type: string
    quantity_delta: number
    created_at?: string
    unit_name?: string
    note?: string | null
  }>
  history: Array<{ at: string; action: string; actor_name: string; note: string | null }>
}

export interface SalesDocumentListResponse {
  items: SalesDocumentListItem[]
  page: number
  page_size: number
  total: number
}
