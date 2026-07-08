export type PermissionCode = `perm.${string}`;
export type ProductStatus = "active" | "inactive";
export type SellMethod = "quantity" | "area_m2" | "linear_m" | "sheet" | "combo";
export type ProductKind = "goods" | "service" | "auxiliary_material" | "roll" | "sheet" | "combo";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PriceSource =
  | "default_price_list"
  | "customer_group_price_list"
  | "fallback_default_price_list"
  | "latest_purchase_cost"
  | "latest_purchase_cost_missing_zero"
  | "price_formula"
  | "price_formula_missing_cost_zero";

export interface RequestContext {
  traceId: string;
  userId: string;
  email: string;
  organizationId: string;
  workstationId: string | null;
  permissions: ReadonlySet<PermissionCode>;
}

export interface WorkstationData {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
}

export interface UserListItem {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  birthday?: string | null;
  region?: string | null;
  ward?: string | null;
  address?: string | null;
  note?: string | null;
  display_name: string;
  status: "active" | "inactive";
  permissions: PermissionCode[];
}

export interface PermissionData {
  code: PermissionCode;
  module: string;
  description: string;
}

export interface ProductData {
  id: string;
  code: string;
  name: string;
  status: ProductStatus;
  product_kind: ProductKind;
  unit_name: string;
  sell_method: SellMethod;
  latest_purchase_cost: number | null;
  latest_purchase_cost_at: string | null;
  product_group_id?: string | null;
  product_group?: { id: string; code: string; name: string } | null;
  inventory_shape?: "normal" | "roll" | "sheet";
  track_inventory?: boolean;
  unit_conversions?: ProductUnitConversionData[];
}

export interface ProductUnitConversionData {
  unit_id: string;
  unit_name: string;
  stock_qty_per_unit: number;
  is_default_purchase_unit: boolean;
  is_default_sale_unit: boolean;
}

export interface ProductGroupData {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

export interface ProductBomItemData {
  id: string;
  component_product_id: string;
  component_product: {
    id: string;
    code: string;
    name: string;
    unit_name: string;
    product_kind?: ProductKind;
    latest_purchase_cost?: number | null;
  };
  quantity: number;
  sort_order: number;
  notes: string | null;
}

export interface ProductBomData {
  id: string;
  product_id: string;
  version: number;
  status: "active" | "archived";
  notes: string | null;
  created_at: string;
  items: ProductBomItemData[];
}

export interface PriceListData {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

export interface CustomerGroupData {
  id: string;
  code: string;
  name: string;
  price_list_id: string;
  is_active: boolean;
}

export interface CustomerData {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tax_code: string | null;
  address: string | null;
  customer_group_id: string | null;
  customer_group: { id: string; code: string; name: string } | null;
  created_at: string;
  created_by: { id: string; name: string } | null;
  total_sales_amount: number;
  total_debt_amount: number;
}

export interface SupplierData {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_code: string | null;
  linked_customer_id: string | null;
  linked_customer: { id: string; code: string; name: string } | null;
  notes: string | null;
  status: "active" | "inactive";
  current_payable_amount: number;
  total_purchase_amount: number;
}

export interface PurchaseReceiptItemData {
  id: string;
  product_id: string;
  product: { id: string; code: string; name: string };
  line_no: number;
  inventory_shape: "normal" | "roll" | "sheet";
  unit_name_snapshot: string;
  quantity: number;
  unit_cost: number;
  discount_amount: number;
  line_amount: number;
  physical_payload: PurchasePhysicalPayloadData | null;
}

export type PurchasePhysicalPayloadData = { [key: string]: JsonValue };

export interface SupplierPaymentHistoryData {
  id: string;
  code: string;
  paid_at: string;
  created_by: string;
  payment_method: "cash" | "bank_transfer";
  status: "posted" | "cancelled";
  amount: number;
}

export interface PurchaseReceiptData {
  id: string;
  code: string;
  supplier_id: string;
  supplier: { id: string; code: string; name: string };
  received_at: string;
  status: "draft" | "posted" | "cancelled";
  supplier_document_no: string | null;
  subtotal_amount: number;
  discount_amount: number;
  payable_amount: number;
  paid_amount: number;
  remaining_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: PurchaseReceiptItemData[];
  supplier_payments: SupplierPaymentHistoryData[];
}

export interface PurchaseReceiptPostResult {
  purchase_receipt_id: string;
  status: "posted";
  posted_at: string;
  cashbook_voucher_id: string | null;
}

export interface SupplierPayableReceiptData {
  id: string;
  code: string;
  supplier_document_no: string | null;
  received_at: string;
  payable_amount: number;
  paid_amount: number;
  remaining_amount: number;
  paid_after_post_amount: number;
  outstanding_amount: number;
}

export interface SupplierPaymentResultData {
  supplier_payment_id: string;
  code: string;
  amount: number;
  cashbook_voucher_id: string;
}

export interface ResolvedPriceData {
  product_id: string;
  unit_price: number;
  price_source: PriceSource;
  price_list_id: string;
}

export interface PriceFormulaPreviewPriceData {
  price_list_id: string;
  price_list_name: string;
  current_unit_price: number | null;
  computed_unit_price: number;
  delta: number | null;
}

export interface PriceFormulaPreviewItemData {
  product_id: string;
  product_code: string;
  product_name: string;
  latest_purchase_cost: number;
  current_mode: "manual" | "formula" | null;
  current_unit_price: number | null;
  computed_prices: PriceFormulaPreviewPriceData[];
}

export interface PriceFormulaPreviewData {
  affected_count: number;
  items: PriceFormulaPreviewItemData[];
}

export interface CheckoutOrderSummaryData {
  id: string;
  code: string;
  order_type: "invoice";
  status: "completed";
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
}

export interface CheckoutPaymentReceiptData {
  id: string;
  code: string;
  total_received_amount: number;
}

export interface InventoryWarningData {
  product_id: string;
  code: string;
  message: string;
}

export interface CartValidationData {
  valid: boolean;
  warnings: InventoryWarningData[];
}

export interface CheckoutResultData {
  order: CheckoutOrderSummaryData;
  payment_receipt: CheckoutPaymentReceiptData | null;
  inventory_warnings: InventoryWarningData[];
}

export interface QuoteSummaryData {
  id: string;
  code: string;
  order_type: "quote";
  status: "active" | "converted" | "cancelled";
  total_amount: number;
}

export type QuoteReopenWarningCode =
  | "CURRENT_PRICE_DIFFERS"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_MISSING"
  | "PRICE_LIST_INACTIVE"
  | "CUSTOMER_CHANGED";

export interface QuoteReopenWarningData {
  code: QuoteReopenWarningCode;
  message: string;
}

export interface QuoteReopenPayloadData {
  quote: {
    id: string;
    code: string;
    status: "active" | "converted" | "cancelled";
  };
  customer: {
    customer_id: string | null;
    snapshot: { code: string | null; name: string; phone: string | null };
    warnings: QuoteReopenWarningData[];
  };
  price_list: {
    price_list_id: string | null;
    snapshot: { code: string | null; name: string | null };
    warnings: QuoteReopenWarningData[];
  };
  items: Array<{
    order_item_id: string;
    product_id: string | null;
    product_snapshot: { code: string; name: string; unit_name: string; sell_method: SellMethod };
    quantity: number;
    width_m?: number | null;
    height_m?: number | null;
    linear_m?: number | null;
    unit_price: number;
    discount_amount: number;
    price_source: string;
    note: string | null;
    warnings: QuoteReopenWarningData[];
  }>;
  summary: { subtotal_amount: number; discount_amount: number; total_amount: number };
  note: string | null;
}

export interface SalesDocumentListItemData {
  id: string;
  code: string;
  order_type: "quote" | "invoice";
  status: "active" | "converted" | "completed" | "cancelled";
  created_at: string;
  customer: { id: string | null; code: string | null; name: string; phone: string | null };
  seller: { id: string; name: string };
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  payment_status: "not_applicable" | "unpaid" | "partial" | "paid";
  note: string | null;
}

export interface SalesDocumentDetailData extends SalesDocumentListItemData {
  price_list: { id: string; code: string; name: string } | null;
  change_returned_amount: number;
  items: Array<{
    id: string;
    line_no: number;
    product: { id: string | null; code: string; name: string; unit_name: string; sell_method: SellMethod };
    quantity: number;
    width_m: number | null;
    height_m: number | null;
    linear_m: number | null;
    unit_price: number;
    line_subtotal_amount: number;
    discount_amount: number;
    line_total: number;
    price_source: string;
    note: string | null;
  }>;
  payment_receipts: Array<{
    id: string;
    code: string;
    status: "posted" | "cancelled";
    receipt_type: "sale_payment" | "debt_collection" | "mixed_sale_and_debt";
    total_received_amount: number;
    created_at: string;
    created_by: { id: string; name: string };
    methods: Array<{
      method_type: "cash" | "bank_transfer";
      amount: number;
      finance_account: { id: string; code: string; name: string };
    }>;
    allocations: PaymentReceiptAllocationData[];
  }>;
  debt_entries: Array<{
    id: string;
    entry_type: "invoice_debt" | "debt_payment" | "debt_adjustment";
    amount_delta: number;
    balance_after_order: number;
    balance_after_customer: number;
    created_at: string;
  }>;
  stock_movements: StockMovementData[];
  history: Array<{ at: string; action: string; actor_name: string; note: string | null }>;
}

export interface FinanceAccountData {
  id: string;
  code: string;
  name: string;
  account_type: "cash" | "bank";
  is_default_cash: boolean;
  is_active: boolean;
}

export interface CustomerDebtSummaryData {
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string;
  total_debt: number;
  oldest_order_code: string | null;
  open_invoice_count: number;
}

export interface CustomerDebtDetailData {
  customer_id: string;
  total_debt: number;
  invoices: Array<{
    order_id: string;
    order_code: string;
    created_at: string;
    total_amount: number;
    paid_amount: number;
    debt_amount: number;
    remaining_debt: number;
  }>;
}

export interface RetailDebtInvoiceData {
  order_id: string;
  order_code: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  remaining_debt: number;
  retail_debt_note: string | null;
}

export interface DebtCollectionResultData {
  payment_receipt_id: string;
  allocated_amount: number;
}

export interface CashbookBalanceData {
  finance_account_id: string;
  code: string;
  name: string;
  account_type: "cash" | "bank";
  balance: number;
}

export interface CashbookVoucherData {
  id: string;
  code: string;
  source_type: "payment_receipt" | "manual_voucher";
  status: "posted" | "cancelled";
  amount: number;
}

export interface CashbookEntryData {
  id: string;
  code: string;
  status: "posted" | "cancelled";
  direction: "in" | "out";
  amount_delta: number;
  finance_account: { id: string; code: string; name: string; account_type: "cash" | "bank" };
  is_business_accounted: boolean;
  source_type: "payment_receipt_method" | "cashbook_voucher";
  created_at: string;
  note: string | null;
  counterparty: { type: "customer" | "supplier" | "employee" | "other" | "none"; name: string | null; phone: string | null };
}

export interface CashbookListData {
  summary: {
    opening_balance: number;
    total_in: number;
    total_out: number;
    ending_balance: number;
  };
  items: CashbookEntryData[];
  page: number;
  page_size: number;
  total: number;
}

export interface PaymentReceiptAllocationData {
  order_id: string;
  order_code: string;
  order_total_amount: number;
  collected_before: number;
  allocated_amount: number;
  remaining_after: number;
}

export interface CashbookEntryDetailData extends CashbookEntryData {
  created_by: { id: string; name: string };
  payment_method: "cash" | "bank_transfer" | "manual";
  source: { type: "payment_receipt" | "manual_voucher"; id: string; code: string; order_code: string | null };
  allocations: PaymentReceiptAllocationData[];
}

export interface PaymentReceiptDetailData {
  id: string;
  code: string;
  status: "posted" | "cancelled";
  receipt_type: "sale_payment" | "debt_collection" | "mixed_sale_and_debt";
  total_received_amount: number;
  created_at: string;
  created_by: { id: string; name: string };
  customer: { id: string | null; code: string | null; name: string } | null;
  source_order: { id: string; code: string; total_amount: number } | null;
  methods: Array<{
    method_type: "cash" | "bank_transfer";
    amount: number;
    finance_account: { id: string; code: string; name: string };
  }>;
  allocations: PaymentReceiptAllocationData[];
}

export interface ReconciliationData {
  id: string;
  code: string;
  status: "draft" | "balanced" | "cancelled";
  period_start: string;
  period_end: string;
}

export interface InventoryProductData {
  product_id: string;
  code: string;
  name: string;
  status: ProductStatus;
  inventory_shape: "normal" | "roll" | "sheet";
  stock_unit: string;
  available_qty: number;
  is_negative: boolean;
}

export interface StockMovementData {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_delta: number;
  created_at: string;
  document_code?: string | null;
  document_type?: "sale_invoice" | "purchase_receipt" | "stocktake" | "manual" | "material_opening" | null;
  transaction_price?: number | null;
  cost_price?: number | null;
  partner_name?: string | null;
}

export interface StocktakeData {
  id: string;
  code: string;
  status: "draft" | "balanced" | "cancelled";
  source_type: "manual" | "product_edit";
  created_at: string;
  balanced_at: string | null;
  total_actual_qty: number;
  total_actual_value: number | null;
  total_difference_value: number | null;
  increased_qty: number;
  decreased_qty: number;
  note: string | null;
}

export interface InventoryRollData {
  id: string;
  product_id: string;
  code: string;
  width_m: number;
  initial_length_m: number;
  remaining_length_m: number;
  initial_area_m2: number;
  remaining_area_m2: number;
  status: "available" | "in_use" | "empty" | "discarded";
  note: string | null;
  created_at: string;
}

export interface InventorySheetData {
  id: string;
  product_id: string;
  code: string;
  sheet_kind: "full" | "in_use" | "remnant";
  width_m: number;
  length_m: number;
  area_m2: number;
  status: "available" | "used" | "discarded";
  note: string | null;
  created_at: string;
}

export interface MaterialOpeningOptionsData {
  product: {
    id: string;
    code: string;
    name: string;
    inventory_shape: "normal" | "roll" | "sheet";
    stock_unit: { id: string; code: string; name: string };
  };
  conversions: Array<{
    unit_id: string;
    code: string;
    name: string;
    stock_qty_per_unit: number;
  }>;
  warnings: string[];
}

export interface MaterialOpeningResultData {
  id: string;
  product_id: string;
  inventory_shape: "normal" | "roll" | "sheet";
  source_type: "manual_normal" | "standard_object" | "kiotviet_provisional";
  opened_unit_id: string | null;
  opened_qty: number | null;
  opened_stock_qty: number | null;
  stock_movement_id: string | null;
  warnings: string[];
  created_at: string;
}

export interface PosMaterialShortageItemData {
  product_id: string;
  code: string;
  name: string;
  required_qty: number;
  available_qty: number;
  shortage_qty: number;
  stock_unit: { id: string; code: string; name: string };
  inventory_shape: "normal";
  quick_material_opening_supported: boolean;
  conversion_options: MaterialOpeningOptionsData["conversions"];
}

export interface PosMaterialShortagePreviewData {
  product_id: string;
  quantity: number;
  source: "product" | "standard_bom";
  bom_id?: string;
  shortages: PosMaterialShortageItemData[];
  warnings: string[];
}

export interface ProductionQueueItemData {
  id: string;
  production_machine: { id: string; code: string; name: string };
  raw_file_name: string;
  received_at: string;
  status: "queued" | "added_to_draft" | "dismissed";
  parse_status: "pending" | "ok" | "error";
  parse_error: string | null;
  parsed: Record<string, unknown>;
}

export interface ProductionQueueDraftPayloadData {
  queue_item_id: string;
  customer: { id: string; code: string; name: string } | null;
  draft_line: {
    product_id: string;
    product_code: string;
    product_name: string;
    unit_name: string;
    sell_method: SellMethod;
    width_m: number | null;
    height_m: number | null;
    linear_m: number | null;
    quantity: number;
    source: "production_queue";
  };
}

export interface CurrentUserProfileData {
  username: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  region: string | null;
  ward: string | null;
  address: string | null;
  note: string | null;
}

export interface CurrentUserDeviceData {
  id: string;
  device_name: string;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
  browser_name: string | null;
  os_name: string | null;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  is_current_device: boolean;
  status: "active" | "signed_out";
}

export interface CurrentUserData {
  user: { id: string; email: string; display_name: string };
  profile: CurrentUserProfileData;
  organization: { id: string; code: string; name: string };
  workstation: { id: string; code: string; name: string } | null;
  devices: CurrentUserDeviceData[];
  permissions: PermissionCode[];
}

export interface CurrentUserRecord {
  user: { id: string; email: string; displayName: string };
  profile?: CurrentUserProfileData;
  organization: { id: string; code: string; name: string };
  workstation: { id: string; code: string; name: string } | null;
  devices?: CurrentUserDeviceData[];
  permissions: PermissionCode[];
  workstationInvalid: boolean;
}

export interface GetCurrentUserInput {
  userId: string;
  email: string;
  workstationId: string | null;
}

export interface FoundationRepository {
  getCurrentUser(input: GetCurrentUserInput): Promise<CurrentUserRecord | null>;
  updateCurrentUserProfile(input: {
    userId: string;
    authEmail: string;
    displayName: string;
    profile: CurrentUserProfileData;
  }): Promise<CurrentUserRecord | null>;
  recordCurrentUserDevice(input: {
    userId: string;
    clientDeviceId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<CurrentUserDeviceData[]>;
  signOutCurrentUserDevice(input: {
    userId: string;
    accessToken: string;
    deviceId: string;
    clientDeviceId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<CurrentUserDeviceData[] | null>;
  listWorkstations(organizationId: string): Promise<WorkstationData[]>;
  createWorkstation(input: {
    organizationId: string;
    code: string;
    name: string;
  }): Promise<WorkstationData>;
  updateWorkstation(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    status?: "active" | "inactive";
  }): Promise<WorkstationData | null>;
  listUsers(input: {
    organizationId: string;
    search?: string;
    status?: "active" | "inactive";
    page: number;
    pageSize: number;
  }): Promise<{ items: UserListItem[]; total: number }>;
  getUser(input: { organizationId: string; userId: string }): Promise<UserListItem | null>;
  createUser(input: {
    organizationId: string;
    email: string;
    username?: string | null;
    phone?: string | null;
    birthday?: string | null;
    region?: string | null;
    ward?: string | null;
    address?: string | null;
    note?: string | null;
    password: string;
    displayName: string;
    permissions: PermissionCode[];
    actorUserId: string;
    traceId: string;
  }): Promise<UserListItem>;
  updateUser(input: {
    organizationId: string;
    userId: string;
    displayName?: string;
    status?: "active" | "inactive";
    actorUserId: string;
  }): Promise<UserListItem | null>;
  replaceUserPermissions(input: {
    organizationId: string;
    userId: string;
    permissions: PermissionCode[];
    actorUserId: string;
    traceId: string;
  }): Promise<UserListItem | null>;
  listPermissions(): Promise<PermissionData[]>;
  listProducts(input: {
    organizationId: string;
    search?: string;
    status: ProductStatus | "all";
    sellMethod?: SellMethod;
    inventoryShape?: "normal" | "roll" | "sheet";
    productKind?: ProductKind;
    productGroupId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ProductData[]; total: number }>;
  listProductGroups(input: { organizationId: string; activeOnly: boolean }): Promise<{ items: ProductGroupData[] }>;
  createProductGroup(input: {
    organizationId: string;
    name: string;
    code?: string;
  }): Promise<ProductGroupData>;
  createProduct(input: {
    organizationId: string;
    code: string;
    name: string;
    status: ProductStatus;
    productKind: ProductKind;
    unitName: string;
    sellMethod: SellMethod;
    inventoryShape?: "normal" | "roll" | "sheet";
    trackInventory?: boolean;
    productGroupId?: string | null;
    latestPurchaseCost?: number | null;
    latestPurchaseCostUpdatedBy?: string;
    unitConversions?: Array<{
      unitName: string;
      stockQtyPerUnit: number;
      isDefaultPurchaseUnit: boolean;
      isDefaultSaleUnit: boolean;
    }>;
  }): Promise<ProductData>;
  updateProduct(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    status?: ProductStatus;
    productKind?: ProductKind;
    unitName?: string;
    sellMethod?: SellMethod;
    latestPurchaseCost?: number | null;
    latestPurchaseCostUpdatedBy?: string;
  }): Promise<ProductData | null>;
  getProductBom(input: { organizationId: string; productId: string }): Promise<ProductBomData | null>;
  saveProductBom(input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    notes?: string | null;
    items: Array<{ componentProductId: string; quantity: number; notes?: string | null }>;
  }): Promise<ProductBomData>;
  listPriceLists(input: { organizationId: string; activeOnly: boolean }): Promise<PriceListData[]>;
  createPriceList(input: {
    organizationId: string;
    code: string;
    name: string;
    isDefault: boolean;
  }): Promise<PriceListData>;
  updatePriceList(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }): Promise<PriceListData | null>;
  upsertPriceListItem(input: {
    organizationId: string;
    priceListId: string;
    productId: string;
    unitPrice: number;
  }): Promise<ResolvedPriceData>;
  deletePriceListItem(input: {
    organizationId: string;
    priceListId: string;
    productId: string;
  }): Promise<boolean>;
  previewPriceFormula(input: {
    organizationId: string;
    formula: Record<string, unknown>;
  }): Promise<PriceFormulaPreviewData>;
  applyPriceFormula(input: {
    organizationId: string;
    actorUserId: string;
    formula: Record<string, unknown>;
    selectedItems: Array<{ product_id: string; price_list_id: string }>;
  }): Promise<{ formula_rule_id: string; affected_count: number }>;
  listCustomers(input: {
    organizationId: string;
    search?: string;
    customerGroupId?: string;
    createdFrom?: string;
    createdTo?: string;
    createdBy?: string;
    totalSalesMin?: number;
    totalSalesMax?: number;
    totalDebtMin?: number;
    totalDebtMax?: number;
    page: number;
    pageSize: number;
  }): Promise<{ items: CustomerData[]; total: number }>;
  listSuppliers(input: {
    organizationId: string;
    search?: string;
    status: "active" | "inactive" | "all";
    totalPurchaseMin?: number;
    totalPurchaseMax?: number;
    currentPayableMin?: number;
    currentPayableMax?: number;
    page: number;
    pageSize: number;
  }): Promise<{ items: SupplierData[]; total: number }>;
  getSupplier(input: {
    organizationId: string;
    id: string;
  }): Promise<SupplierData | null>;
  createSupplier(input: {
    organizationId: string;
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    linkedCustomerId?: string | null;
    notes?: string;
    status?: "active" | "inactive";
  }): Promise<SupplierData>;
  updateSupplier(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxCode?: string | null;
    linkedCustomerId?: string | null;
    notes?: string | null;
    status?: "active" | "inactive";
  }): Promise<SupplierData | null>;
  listSupplierPayableReceipts(input: {
    organizationId: string;
    supplierId: string;
  }): Promise<{ items: SupplierPayableReceiptData[] }>;
  paySupplier(input: {
    organizationId: string;
    actorUserId: string;
    supplierId: string;
    paymentMethod: "cash" | "bank_transfer";
    financeAccountId?: string;
    paidAt?: string;
    note?: string;
    allocations: Array<{ purchaseReceiptId: string; amount: number }>;
  }): Promise<SupplierPaymentResultData>;
  listPurchaseReceipts(input: {
    organizationId: string;
    search?: string;
    status: "draft" | "posted" | "cancelled" | "all";
    dateFrom?: string;
    dateTo?: string;
    createdBy?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: PurchaseReceiptData[]; total: number }>;
  getPurchaseReceipt(input: {
    organizationId: string;
    id: string;
  }): Promise<PurchaseReceiptData | null>;
  createPurchaseReceipt(input: {
    organizationId: string;
    actorUserId: string;
    code?: string;
    supplierId: string;
    receivedAt: string;
    supplierDocumentNo?: string;
    notes?: string;
    discountAmount: number;
    paidAmount: number;
    items: Array<{
      productId: string;
      inventoryShape?: "normal" | "roll" | "sheet";
      unitName: string;
      quantity: number;
      unitCost: number;
      discountAmount: number;
      physicalPayload?: PurchasePhysicalPayloadData | null;
    }>;
  }): Promise<PurchaseReceiptData>;
  updatePurchaseReceipt(input: {
    organizationId: string;
    actorUserId: string;
    id: string;
    code?: string;
    supplierId?: string;
    receivedAt?: string;
    supplierDocumentNo?: string | null;
    notes?: string | null;
    discountAmount?: number;
    paidAmount?: number;
    items?: Array<{
      productId: string;
      inventoryShape?: "normal" | "roll" | "sheet";
      unitName: string;
      quantity: number;
      unitCost: number;
      discountAmount: number;
      physicalPayload?: PurchasePhysicalPayloadData | null;
    }>;
  }): Promise<PurchaseReceiptData | null>;
  postPurchaseReceipt(input: {
    organizationId: string;
    actorUserId: string;
    id: string;
    paymentMethod?: "cash" | "bank_transfer";
    financeAccountId?: string;
  }): Promise<PurchaseReceiptPostResult>;
  createCustomer(input: {
    organizationId: string;
    actorUserId: string;
    code?: string;
    name: string;
    phone?: string;
    taxCode?: string;
    address?: string;
    customerGroupId?: string | null;
  }): Promise<CustomerData>;
  updateCustomer(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    phone?: string | null;
    taxCode?: string | null;
    address?: string | null;
    customerGroupId?: string | null;
  }): Promise<CustomerData | null>;
  listCustomerGroups(input: { organizationId: string; activeOnly: boolean }): Promise<CustomerGroupData[]>;
  createCustomerGroup(input: {
    organizationId: string;
    code: string;
    name: string;
    priceListId: string;
  }): Promise<CustomerGroupData>;
  updateCustomerGroup(input: {
    organizationId: string;
    id: string;
    code?: string;
    name?: string;
    priceListId?: string;
    isActive?: boolean;
  }): Promise<CustomerGroupData | null>;
  resolvePrices(input: {
    organizationId: string;
    productIds: string[];
    customerId?: string;
  }): Promise<ResolvedPriceData[]>;
  checkoutOrder(input: {
    organizationId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<CheckoutResultData>;
  saveQuote(input: {
    organizationId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<QuoteSummaryData>;
  getQuoteReopenPayload(input: {
    organizationId: string;
    quoteId: string;
  }): Promise<QuoteReopenPayloadData | null>;
  reviseInvoice(input: {
    organizationId: string;
    actorUserId: string;
    orderId: string;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  listSalesDocuments(input: {
    organizationId: string;
    search?: string;
    type?: "quote" | "invoice";
    status?: "active" | "converted" | "completed" | "cancelled";
    customerId?: string;
    paymentStatus?: "not_applicable" | "unpaid" | "partial" | "paid";
    paymentMethod?: "cash" | "bank_transfer";
    createdBy?: string;
    priceListId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: SalesDocumentListItemData[]; total: number }>;
  getSalesDocument(input: {
    organizationId: string;
    orderId: string;
  }): Promise<SalesDocumentDetailData | null>;
  listFinanceAccounts(input: {
    organizationId: string;
    accountType?: "cash" | "bank";
    isActive?: boolean;
  }): Promise<FinanceAccountData[]>;
  listCustomerDebts(input: {
    organizationId: string;
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: CustomerDebtSummaryData[]; total: number }>;
  listRetailDebts(input: {
    organizationId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: RetailDebtInvoiceData[]; total: number }>;
  getCustomerDebt(input: { organizationId: string; customerId: string }): Promise<CustomerDebtDetailData | null>;
  collectCustomerDebt(input: {
    organizationId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<DebtCollectionResultData>;
  createCashbookVoucher(input: {
    organizationId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<CashbookVoucherData>;
  reviseCashbookVoucher(input: {
    organizationId: string;
    actorUserId: string;
    voucherId: string;
    payload: Record<string, unknown>;
  }): Promise<CashbookVoucherData>;
  cancelCashbookVoucher(input: {
    organizationId: string;
    actorUserId: string;
    voucherId: string;
  }): Promise<CashbookVoucherData>;
  listCashbookEntries(input: {
    organizationId: string;
    financeAccountId?: string;
    financeAccountType?: "cash" | "bank";
    search?: string;
    searchScope?: "code" | "note" | "transfer_content";
    direction?: "in" | "out";
    sourceType?: "payment_receipt_method" | "cashbook_voucher";
    status?: "posted" | "cancelled";
    isBusinessAccounted?: boolean;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<CashbookListData>;
  getCashbookEntry(input: {
    organizationId: string;
    entryId: string;
  }): Promise<CashbookEntryDetailData | null>;
  getPaymentReceipt(input: {
    organizationId: string;
    receiptId: string;
  }): Promise<PaymentReceiptDetailData | null>;
  listCashbookBalances(input: { organizationId: string }): Promise<CashbookBalanceData[]>;
  listCashbookVouchers(input: { organizationId: string }): Promise<{ items: CashbookVoucherData[]; total: number }>;
  listReconciliations(input: { organizationId: string }): Promise<{ items: ReconciliationData[]; total: number }>;
  listInventoryProducts(input: {
    organizationId: string;
    search?: string;
    status: ProductStatus | "all";
    inventoryShape?: "normal" | "roll" | "sheet";
    page: number;
    pageSize: number;
  }): Promise<{ items: InventoryProductData[]; total: number }>;
  getInventoryProduct(input: { organizationId: string; productId: string }): Promise<InventoryProductData | null>;
  listStockMovements(input: {
    organizationId: string;
    productId?: string;
    orderId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: StockMovementData[]; total: number }>;
  listStocktakes(input: {
    organizationId: string;
    search?: string;
    status?: "draft" | "balanced" | "cancelled";
    createdFrom?: string;
    createdTo?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: StocktakeData[]; total: number }>;
  getStocktake(input: {
    organizationId: string;
    stocktakeId: string;
  }): Promise<StocktakeData | null>;
  listInventoryRolls(input: {
    organizationId: string;
    productId?: string;
    status?: InventoryRollData["status"];
    page: number;
    pageSize: number;
  }): Promise<{ items: InventoryRollData[]; total: number }>;
  createInventoryRoll(input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    code: string;
    widthM: number;
    initialLengthM: number;
    remainingLengthM?: number;
    status?: InventoryRollData["status"];
    note?: string | null;
  }): Promise<InventoryRollData>;
  updateInventoryRoll(input: {
    organizationId: string;
    actorUserId: string;
    rollId: string;
    remainingLengthM?: number;
    status?: InventoryRollData["status"];
    reason: string;
  }): Promise<InventoryRollData | null>;
  listInventorySheets(input: {
    organizationId: string;
    productId?: string;
    status?: InventorySheetData["status"];
    page: number;
    pageSize: number;
  }): Promise<{ items: InventorySheetData[]; total: number }>;
  createInventorySheet(input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    code: string;
    sheetKind: InventorySheetData["sheet_kind"];
    widthM: number;
    lengthM: number;
    status?: InventorySheetData["status"];
    note?: string | null;
  }): Promise<InventorySheetData>;
  updateInventorySheet(input: {
    organizationId: string;
    actorUserId: string;
    sheetId: string;
    widthM?: number;
    lengthM?: number;
    status?: InventorySheetData["status"];
    reason: string;
  }): Promise<InventorySheetData | null>;
  adjustNormalProductStock(input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    actualQty: number;
    reason: string;
  }): Promise<StocktakeData>;
  getMaterialOpeningOptions(input: {
    organizationId: string;
    productId: string;
  }): Promise<MaterialOpeningOptionsData | null>;
  previewPosMaterialShortage(input: {
    organizationId: string;
    productId: string;
    quantity: number;
  }): Promise<PosMaterialShortagePreviewData | null>;
  createMaterialOpening(input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    inventoryShape: "normal" | "roll" | "sheet";
    openedUnitId?: string;
    openedQty?: number;
    oldRemainingQty?: number;
    oldInventoryRollId?: string;
    oldRemainingLengthM?: number;
    oldInventorySheetId?: string;
    oldRemainingWidthM?: number;
    oldRemainingLengthMForSheet?: number;
    discardOldSheet?: boolean;
    note?: string;
  }): Promise<MaterialOpeningResultData>;
  listProductionQueue(input: {
    organizationId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ProductionQueueItemData[]; total: number }>;
  listProductionQueueHistory(input: {
    organizationId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ProductionQueueItemData[]; total: number }>;
  addProductionQueueItemToDraft(input: {
    organizationId: string;
    actorUserId: string;
    queueItemId: string;
  }): Promise<ProductionQueueDraftPayloadData | null>;
  dismissProductionQueueItem(input: {
    organizationId: string;
    actorUserId: string;
    queueItemId: string;
  }): Promise<ProductionQueueItemData | null>;
  restoreProductionQueueItem(input: {
    organizationId: string;
    actorUserId: string;
    queueItemId: string;
  }): Promise<ProductionQueueItemData | null>;
}
