export type FinanceAccountType = 'cash' | 'bank'
export type CashbookDirection = 'in' | 'out'
export type CashbookStatus = 'posted' | 'cancelled'
export type CashbookSourceType = 'payment_receipt_method' | 'cashbook_voucher' | 'kiotviet_cashbook'
export type VoucherSourceType = 'payment_receipt' | 'manual_voucher'
export type CashbookVoucherType =
  | 'other_income'
  | 'capital_contribution'
  | 'transfer'
  | 'material_purchase'
  | 'supplier_payment'
  | 'staff_salary'
  | 'shipping_expense'
  | 'customer_refund'
  | 'operating_expense'
  | 'tax_or_vat'
  | 'commission'
  | 'other_expense'
export type PartnerDebtMode = 'affects_partner_debt' | 'not_affect_partner_debt' | 'no_partner_debt'
export type CashbookBusinessAccountedFilter = 'all' | 'true' | 'false'
export type CashbookSearchScope = 'all' | 'code' | 'note' | 'transfer_content' | 'counterparty'
export type CashbookColumnKey =
  | 'code'
  | 'created_at'
  | 'created_by'
  | 'source_type'
  | 'counterparty'
  | 'finance_account'
  | 'amount_delta'
  | 'status'
  | 'note'
  | 'is_business_accounted'

export interface FinanceAccount {
  id: string
  code: string
  name: string
  account_type: FinanceAccountType
  is_default_cash: boolean
  is_active: boolean
  account_number?: string
  account_holder?: string
  opening_balance?: number
  note?: string
  notify_on_transaction?: boolean
}

export interface FinanceAccountListResponse {
  items: FinanceAccount[]
}

export interface CustomerDebtSummary {
  customer_id: string | null
  customer_code: string | null
  customer_name: string
  total_debt: number
  oldest_order_code: string | null
  open_invoice_count: number
}

export interface CustomerDebtListResponse {
  items: CustomerDebtSummary[]
  page: number
  page_size: number
  total: number
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
}

export interface DebtCollectionInput {
  customer_id: string
  amount: number
  created_at?: string
  allocations?: Array<{
    order_id: string
    order_code: string
    allocated_amount: number
  }>
  payment_method: {
    cash_amount: number
    bank_amount: number
    bank_account_id?: string
    bank_transaction_ref?: string
  }
  note?: string
}

export type CustomerDebtAdjustment = NonNullable<CustomerDebtDetail['adjustments']>[number]

export interface UpdateCustomerDebtAdjustmentInput {
  adjusted_at: string
  amount_delta: number
  note?: string | null
}

export interface DebtCollectionResult {
  payment_receipt_id: string
  allocated_amount: number
}

export interface CashbookBalance {
  finance_account_id: string
  code: string
  name: string
  account_type: FinanceAccountType
  balance: number
}

export interface CashbookBalanceListResponse {
  items: CashbookBalance[]
}

export interface CashbookCounterparty {
  type: 'customer' | 'supplier' | 'employee' | 'other' | 'none'
  name: string | null
  phone: string | null
}

export interface CashbookEntry {
  id: string
  code: string
  status: CashbookStatus
  direction: CashbookDirection
  amount_delta: number
  finance_account: {
    id: string
    code: string
    name: string
    account_type: FinanceAccountType
    account_number?: string | null
    account_holder?: string | null
  }
  is_business_accounted: boolean
  source_type: CashbookSourceType
  created_at: string
  note: string | null
  counterparty?: CashbookCounterparty
  created_by?: { id: string; name: string } | null
  source?: {
    type: string
    id: string
    code: string
    order_code: string | null
    category_name?: string | null
    source_creator_name?: string | null
    source_note?: string | null
    transfer_content?: string | null
    counterparty_code?: string | null
    counterparty_address?: string | null
  }
}

export interface CashbookListResponse {
  summary: {
    opening_balance: number
    total_in: number
    total_out: number
    ending_balance: number
  }
  items: CashbookEntry[]
  page: number
  page_size: number
  total: number
}

export interface PaymentReceiptAllocation {
  order_id: string
  order_code: string
  order_total_amount: number
  collected_before: number
  allocated_amount: number
  remaining_after: number
}

export interface FinanceSalesDocumentSummary {
  id: string
  code: string
  total_amount: number
  paid_amount: number
  debt_amount: number
  payment_status: 'not_applicable' | 'unpaid' | 'partial' | 'paid'
  customer?: { id: string | null; code: string | null; name: string; phone: string | null }
}

export interface CashbookEntryDetail extends CashbookEntry {
  created_by: { id: string; name: string } | null
  counterparty: CashbookCounterparty
  payment_method: 'cash' | 'bank_transfer' | 'manual'
  source: NonNullable<CashbookEntry['source']>
  allocations: PaymentReceiptAllocation[]
}

export interface UpdateCashbookEntryInput {
  created_at?: string
  finance_account_id?: string
  note?: string | null
}

export interface CashbookVoucher {
  id: string
  code: string
  source_type: VoucherSourceType
  status: CashbookStatus
  amount: number
}

export interface CreateCashbookVoucherInput {
  voucher_direction: CashbookDirection
  voucher_type: CashbookVoucherType
  finance_account_id: string
  created_at?: string
  amount: number
  partner_debt_mode?: PartnerDebtMode
  is_business_accounted?: boolean
  counterparty_type?: 'customer' | 'supplier' | 'employee' | 'other' | 'none'
  counterparty_name?: string
  counterparty_phone?: string
  reason: string
}

export interface CashbookVoucherCounterpartyOption {
  id: string
  code: string
  name: string
  phone: string | null
}

export interface CashbookVoucherListResponse {
  items: CashbookVoucher[]
  total: number
}

export interface KiotVietCashbookImportPreview {
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    account_count: number
    cash_rows: number
    bank_rows: number
    posted_rows: number
    cancelled_rows: number
    cash_total_delta: number
    bank_total_delta: number
    created_rows?: number
    updated_rows?: number
    skipped_rows?: number
    accounts_created?: number
    accounts_updated?: number
  }
  invalid_rows: unknown[]
  accounts?: Array<{ account_type: FinanceAccountType; account_name: string; account_number: string | null }>
}

export interface KiotVietCashbookDeleteResult {
  deleted_rows: number
  blocked_rows: number
}
