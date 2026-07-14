export type SupplierStatus = 'active' | 'inactive'

export interface SupplierLinkedCustomer {
  id: string
  code: string
  name: string
}

export interface Supplier {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  tax_code: string | null
  linked_customer_id: string | null
  linked_customer: SupplierLinkedCustomer | null
  notes: string | null
  status: SupplierStatus
  current_payable_amount: number
  total_purchase_amount: number
}

export interface SupplierListResponse {
  items: Supplier[]
  page: number
  page_size: number
  total: number
  summary?: {
    current_payable_amount: number
    total_purchase_amount: number
  }
}

export interface SupplierCustomerOption {
  id: string
  code: string
  name: string
  phone: string | null
}

export interface SupplierCustomerListResponse {
  items: SupplierCustomerOption[]
  page: number
  page_size: number
  total: number
}

export interface SupplierPayableReceipt {
  id: string
  code: string
  supplier_document_no: string | null
  received_at: string
  payable_amount: number
  paid_amount: number
  remaining_amount: number
  paid_after_post_amount: number
  outstanding_amount: number
}

export interface SupplierPayableReceiptListResponse {
  items: SupplierPayableReceipt[]
}

export interface SupplierFinanceAccount {
  id: string
  code: string
  name: string
  account_type: 'cash' | 'bank'
  is_default_cash: boolean
  is_active: boolean
}

export interface SupplierFinanceAccountListResponse {
  items: SupplierFinanceAccount[]
}

export interface SupplierPaymentInput {
  payment_method: 'cash' | 'bank_transfer'
  finance_account_id?: string
  paid_at?: string
  note?: string
  allocations: Array<{ purchase_receipt_id: string; amount: number }>
}

export interface SupplierPaymentResult {
  supplier_payment_id: string
  code: string
  amount: number
  cashbook_voucher_id: string
}

export interface KiotVietSupplierInvalidRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: string[]
}

export interface KiotVietSupplierImportPreview {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    create_rows: number
    update_rows: number
    kiotviet_payable_total: number
    kiotviet_total_purchase: number
    ignored_columns: string[]
  }
  invalid_rows: KiotVietSupplierInvalidRow[]
}

export interface KiotVietSupplierImportResult {
  summary: {
    total_rows?: number
    valid_rows?: number
    invalid_rows?: number
    created_rows: number
    updated_rows: number
    skipped_rows?: number
    kiotviet_payable_total?: number
    kiotviet_total_purchase?: number
  }
  invalid_rows: KiotVietSupplierInvalidRow[]
}

export interface KiotVietImportDeleteResult {
  deleted_rows: number
  blocked_rows: number
}
