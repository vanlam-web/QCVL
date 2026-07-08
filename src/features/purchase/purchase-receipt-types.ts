import type { Supplier } from './types'

export type PurchaseReceiptStatus = 'draft' | 'posted' | 'cancelled'

export interface PurchaseReceiptProduct {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive'
  unit_name: string
  sell_method: 'quantity' | 'area_m2' | 'linear_m' | 'sheet' | 'combo'
  latest_purchase_cost: number | null
  latest_purchase_cost_at: string | null
  inventory_shape: 'normal' | 'roll' | 'sheet'
}

export interface RollPhysicalPayload {
  rolls: {
    width_m: number
    lengths_m: number[]
  }
}

export interface SheetPhysicalPayload {
  sheet_groups: Array<{
    width_m: number
    length_m: number
    quantity: number
  }>
}

export type PurchasePhysicalPayload = RollPhysicalPayload | SheetPhysicalPayload

export interface PurchaseReceiptItem {
  id: string
  product_id: string
  product: { id: string; code: string; name: string }
  line_no: number
  inventory_shape: 'normal' | 'roll' | 'sheet'
  unit_name_snapshot: string
  quantity: number
  unit_cost: number
  discount_amount: number
  line_amount: number
  physical_payload: PurchasePhysicalPayload | null
}

export interface PurchaseReceiptSupplierPayment {
  id: string
  code: string
  paid_at: string
  created_by: string
  payment_method: 'cash' | 'bank_transfer'
  status: 'posted' | 'cancelled'
  amount: number
}

export interface PurchaseReceipt {
  id: string
  code: string
  supplier_id: string
  supplier: { id: string; code: string; name: string }
  received_at: string
  status: PurchaseReceiptStatus
  supplier_document_no: string | null
  subtotal_amount: number
  discount_amount: number
  payable_amount: number
  paid_amount: number
  remaining_amount: number
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  items: PurchaseReceiptItem[]
  supplier_payments: PurchaseReceiptSupplierPayment[]
}

export interface PurchaseReceiptListResponse {
  items: PurchaseReceipt[]
  page: number
  page_size: number
  total: number
}

export interface PurchaseReceiptSupplierListResponse {
  items: Supplier[]
  page: number
  page_size: number
  total: number
}

export interface PurchaseReceiptProductListResponse {
  items: PurchaseReceiptProduct[]
  page: number
  page_size: number
  total: number
}

export interface PurchaseReceiptFinanceAccount {
  id: string
  code: string
  name: string
  account_type: 'cash' | 'bank'
  is_default_cash: boolean
  is_active: boolean
}

export interface PurchaseReceiptFinanceAccountListResponse {
  items: PurchaseReceiptFinanceAccount[]
}

export interface PurchaseReceiptPostInput {
  payment_method?: 'cash' | 'bank_transfer'
  finance_account_id?: string
}

export interface PurchaseReceiptPostResult {
  purchase_receipt_id: string
  status: 'posted'
  posted_at: string
  cashbook_voucher_id: string | null
}

export interface PurchaseReceiptSupplierPaymentInput {
  payment_method: 'cash' | 'bank_transfer'
  finance_account_id?: string
  note?: string
  allocations: Array<{ purchase_receipt_id: string; amount: number }>
}

export interface PurchaseReceiptSupplierPaymentResult {
  supplier_payment_id: string
  code: string
  amount: number
  cashbook_voucher_id: string
}

export interface PurchaseReceiptInputItem {
  product_id: string
  inventory_shape: 'normal' | 'roll' | 'sheet'
  unit_name: string
  quantity: number
  unit_cost: number
  discount_amount: number
  physical_payload: PurchasePhysicalPayload | null
}

export interface PurchaseReceiptInput {
  code: string
  supplier_id: string
  received_at: string
  supplier_document_no: string
  notes: string
  discount_amount: number
  paid_amount: number
  items: PurchaseReceiptInputItem[]
}
