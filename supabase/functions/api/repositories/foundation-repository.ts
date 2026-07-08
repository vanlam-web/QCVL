import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.108.2";
import type {
  CashbookBalanceData,
  CashbookEntryData,
  CashbookEntryDetailData,
  CashbookListData,
  CashbookVoucherData,
  CheckoutResultData,
  CustomerData,
  CustomerDebtDetailData,
  CustomerDebtSummaryData,
  CustomerGroupData,
  CurrentUserDeviceData,
  CurrentUserRecord,
  DebtCollectionResultData,
  FinanceAccountData,
  FoundationRepository,
  GetCurrentUserInput,
  InventoryProductData,
  InventoryRollData,
  InventorySheetData,
  MaterialOpeningOptionsData,
  MaterialOpeningResultData,
  PermissionCode,
  PermissionData,
  PaymentReceiptAllocationData,
  PaymentReceiptDetailData,
  PosMaterialShortagePreviewData,
  PriceFormulaPreviewData,
  PriceListData,
  ProductBomData,
  ProductData,
  ProductGroupData,
  ProductionQueueDraftPayloadData,
  ProductionQueueItemData,
  PurchasePhysicalPayloadData,
  PurchaseReceiptData,
  QuoteReopenPayloadData,
  QuoteSummaryData,
  ReconciliationData,
  RetailDebtInvoiceData,
  ResolvedPriceData,
  SalesDocumentDetailData,
  SalesDocumentListItemData,
  StockMovementData,
  StocktakeData,
  SupplierData,
  UserListItem,
  WorkstationData,
} from "../contracts.ts";

type DatabaseClient = SupabaseClient;
const currentUserCacheTtlMs = 2000;
const currentUserCache = new Map<string, { expiresAt: number; promise: Promise<CurrentUserRecord | null> }>();

const customerBaseSelect = "id, code, name, phone, customer_group_id, customer_groups(id, code, name)";
const customerExtendedSelect = "id, code, name, phone, tax_code, address, customer_group_id, created_by, created_at, customer_groups(id, code, name)";

type CustomerRepositoryRow = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tax_code?: string | null;
  address?: string | null;
  customer_group_id: string | null;
  created_by?: string | null;
  created_at?: string;
  customer_groups?: { id: string; code: string; name: string } | Array<{ id: string; code: string; name: string }> | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface PriceRow {
  product_id: string;
  unit_price: number | string | null;
  price_list_id: string;
  pricing_mode?: "manual" | "formula";
  formula_rule_id?: string | null;
}

interface AccountDeviceRow {
  id: string;
  device_key: string;
  device_name: string;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
  browser_name: string | null;
  os_name: string | null;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  status: "active" | "signed_out";
}

interface PriceFormulaRuleRow {
  cost_formula: PriceFormulaCost;
  profit_formula: PriceFormulaProfit;
  price_list_adjustments: Record<string, PriceFormulaAdjustment>;
}

interface FormulaProductRow {
  id: string;
  code: string;
  name: string;
  latest_purchase_cost: number | string | null;
}

interface FormulaPriceListRow {
  id: string;
  name: string;
}

interface FormulaPriceItemRow {
  product_id: string;
  price_list_id: string;
  unit_price: number | string | null;
  pricing_mode: "manual" | "formula";
}

export type PriceFormulaCost =
  | { type: "fixed"; amount: number }
  | { type: "amount_plus_percent"; amount?: number; percent_of_latest_purchase_cost?: number };

export type PriceFormulaTier =
  | {
    operator: "<" | "<=" | ">" | ">=" | "=";
    value: number;
    amount?: number;
    percent?: number;
  }
  | {
    from_exclusive?: number;
    from_inclusive?: number;
    to_exclusive?: number;
    to_inclusive?: number;
    amount?: number;
    percent?: number;
  };

export type PriceFormulaProfit =
  | { type: "fixed"; amount: number; percent?: number }
  | { type: "tiers"; tiers: PriceFormulaTier[] };

export type PriceFormulaAdjustment =
  | { type: "amount"; amount: number }
  | { type: "percent"; percent: number };

export interface PriceFormulaInput {
  name: string;
  product_filter: Record<string, unknown>;
  cost_formula: PriceFormulaCost;
  profit_formula: PriceFormulaProfit;
  price_list_adjustments: Record<string, PriceFormulaAdjustment>;
}

export function computeFormulaPrice(input: {
  latestPurchaseCost: number | null;
  costFormula: PriceFormulaCost;
  profitFormula: PriceFormulaProfit;
  priceListAdjustment?: PriceFormulaAdjustment;
}): {
  latest_purchase_cost: number;
  cost_amount: number;
  profit_amount: number;
  adjustment_amount: number;
  computed_price: number;
} {
  const latestPurchaseCost = input.latestPurchaseCost ?? 0;
  const costAmount = computeFormulaCost(input.costFormula, latestPurchaseCost);
  const profitAmount = computeFormulaProfit(input.profitFormula, latestPurchaseCost);
  const basePrice = latestPurchaseCost + costAmount + profitAmount;
  const adjustmentAmount = computeFormulaAdjustment(input.priceListAdjustment, basePrice);

  return {
    latest_purchase_cost: latestPurchaseCost,
    cost_amount: costAmount,
    profit_amount: profitAmount,
    adjustment_amount: adjustmentAmount,
    computed_price: roundUpToThousand(basePrice + adjustmentAmount),
  };
}

export function validatePriceFormula(input: PriceFormulaInput): void {
  if (input.product_filter !== null && typeof input.product_filter === "object" && "group_id" in input.product_filter) {
    throw new Error("FORMULA_PRODUCT_GROUP_UNSUPPORTED");
  }

  if (input.profit_formula.type !== "tiers") {
    return;
  }

  const intervals: Array<{ min: number; max: number; tier: PriceFormulaTier }> = [];
  for (const tier of input.profit_formula.tiers) {
    const interval = tierToInterval(tier);
    if (interval === null) {
      throw new Error("FORMULA_TIER_INVALID");
    }
    if (intervals.some((existing) => intervalsOverlap(existing, interval))) {
      throw new Error("FORMULA_TIER_OVERLAP");
    }
    intervals.push({ ...interval, tier });
  }
}

function computeFormulaCost(formula: PriceFormulaCost, latestPurchaseCost: number): number {
  if (formula.type === "fixed") {
    return roundMoney(formula.amount);
  }

  return roundMoney((formula.amount ?? 0) + latestPurchaseCost * ((formula.percent_of_latest_purchase_cost ?? 0) / 100));
}

function computeFormulaProfit(formula: PriceFormulaProfit, latestPurchaseCost: number): number {
  if (formula.type === "fixed") {
    return roundMoney((formula.amount ?? 0) + latestPurchaseCost * ((formula.percent ?? 0) / 100));
  }

  const matchingTier = formula.tiers.find((tier) => tierMatches(tier, latestPurchaseCost));
  if (matchingTier === undefined) {
    return 0;
  }

  return roundMoney((matchingTier.amount ?? 0) + latestPurchaseCost * ((matchingTier.percent ?? 0) / 100));
}

function computeFormulaAdjustment(adjustment: PriceFormulaAdjustment | undefined, priceBeforeAdjustment: number): number {
  if (adjustment === undefined) {
    return 0;
  }
  if (adjustment.type === "amount") {
    return roundMoney(adjustment.amount);
  }
  return roundMoney(priceBeforeAdjustment * (adjustment.percent / 100));
}

function roundMoney(value: number): number {
  return Math.ceil(value);
}

function roundUpToThousand(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

function tierMatches(tier: PriceFormulaTier, value: number): boolean {
  if ("operator" in tier) {
    if (tier.operator === "<") return value < tier.value;
    if (tier.operator === "<=") return value <= tier.value;
    if (tier.operator === ">") return value > tier.value;
    if (tier.operator === ">=") return value >= tier.value;
    return value === tier.value;
  }

  const aboveMin = tier.from_exclusive !== undefined
    ? value > tier.from_exclusive
    : tier.from_inclusive !== undefined
    ? value >= tier.from_inclusive
    : true;
  const belowMax = tier.to_exclusive !== undefined
    ? value < tier.to_exclusive
    : tier.to_inclusive !== undefined
    ? value <= tier.to_inclusive
    : true;
  return aboveMin && belowMax;
}

function tierToInterval(tier: PriceFormulaTier): { min: number; max: number } | null {
  if ("operator" in tier) {
    if (tier.operator === "<" || tier.operator === "<=") return { min: Number.NEGATIVE_INFINITY, max: tier.value };
    if (tier.operator === ">" || tier.operator === ">=") return { min: tier.value, max: Number.POSITIVE_INFINITY };
    return { min: tier.value, max: tier.value };
  }

  const min = tier.from_exclusive ?? tier.from_inclusive ?? Number.NEGATIVE_INFINITY;
  const max = tier.to_exclusive ?? tier.to_inclusive ?? Number.POSITIVE_INFINITY;
  return min <= max ? { min, max } : null;
}

function intervalsOverlap(left: { min: number; max: number }, right: { min: number; max: number }): boolean {
  return left.min <= right.max && right.min <= left.max;
}

export function resolvePriceRows(input: {
  productIds: string[];
  defaultPriceListId: string;
  customerPriceListId: string | null;
  priceRows: PriceRow[];
  latestPurchaseCosts: ReadonlyMap<string, number>;
  formulaRules?: ReadonlyMap<string, PriceFormulaRuleRow>;
}): ResolvedPriceData[] {
  const customerPrices = new Map<string, ResolvedPriceData>();
  const defaultPrices = new Map<string, ResolvedPriceData>();

  for (const row of input.priceRows) {
    const formulaPrice = resolveFormulaPrice(row, input.latestPurchaseCosts, input.formulaRules);
    if (formulaPrice !== null) {
      if (row.price_list_id === input.customerPriceListId) {
        customerPrices.set(row.product_id, formulaPrice);
      } else {
        defaultPrices.set(row.product_id, {
          ...formulaPrice,
          price_source: formulaPrice.price_source,
        });
      }
      continue;
    }

    const unitPrice = Number(row.unit_price);
    if (row.price_list_id === input.customerPriceListId) {
      const hasLatestPurchaseCost = input.latestPurchaseCosts.has(row.product_id);
      const latestPurchaseCost = input.latestPurchaseCosts.get(row.product_id);
      customerPrices.set(row.product_id, {
        product_id: row.product_id,
        unit_price: unitPrice === 0 ? latestPurchaseCost ?? 0 : unitPrice,
        price_source: unitPrice === 0
          ? !hasLatestPurchaseCost
            ? "latest_purchase_cost_missing_zero"
            : "latest_purchase_cost"
          : "customer_group_price_list",
        price_list_id: row.price_list_id,
      });
      continue;
    }

    defaultPrices.set(row.product_id, {
      product_id: row.product_id,
      unit_price: unitPrice,
      price_source: input.customerPriceListId === null ? "default_price_list" : "fallback_default_price_list",
      price_list_id: row.price_list_id,
    });
  }

  return input.productIds.map((productId) =>
    customerPrices.get(productId) ?? defaultPrices.get(productId) ?? {
      product_id: productId,
      unit_price: 0,
      price_source: input.customerPriceListId === null ? "default_price_list" : "fallback_default_price_list",
      price_list_id: input.defaultPriceListId,
    }
  );
}

function resolveFormulaPrice(
  row: PriceRow,
  latestPurchaseCosts: ReadonlyMap<string, number>,
  formulaRules: ReadonlyMap<string, PriceFormulaRuleRow> | undefined,
): ResolvedPriceData | null {
  if (row.pricing_mode !== "formula" || row.formula_rule_id === null || row.formula_rule_id === undefined) {
    return null;
  }
  const rule = formulaRules?.get(row.formula_rule_id);
  if (rule === undefined) {
    return null;
  }

  const hasLatestPurchaseCost = latestPurchaseCosts.has(row.product_id);
  const computed = computeFormulaPrice({
    latestPurchaseCost: hasLatestPurchaseCost ? latestPurchaseCosts.get(row.product_id) ?? 0 : null,
    costFormula: rule.cost_formula,
    profitFormula: rule.profit_formula,
    priceListAdjustment: rule.price_list_adjustments[row.price_list_id],
  });

  return {
    product_id: row.product_id,
    unit_price: computed.computed_price,
    price_source: hasLatestPurchaseCost ? "price_formula" : "price_formula_missing_cost_zero",
    price_list_id: row.price_list_id,
  };
}

async function loadCurrentUser(
  client: DatabaseClient,
  input: GetCurrentUserInput,
): Promise<CurrentUserRecord | null> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("user_id, display_name, username, phone, email, birthday, region, ward, address, note, organization_id, organizations(id, code, name)")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (profileError !== null) {
    throw profileError;
  }

  if (profile === null) {
    return null;
  }

  const organization = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  const { data: permissionRows, error: permissionError } = await client
    .from("user_permissions")
    .select("permission_code, permissions!inner(status)")
    .eq("user_id", input.userId)
    .eq("permissions.status", "active")
    .order("permission_code", { ascending: true });

  if (permissionError !== null) {
    throw permissionError;
  }

  let workstation = null;
  let workstationInvalid = false;

  if (input.workstationId !== null) {
    const { data: workstationRow, error: workstationError } = await client
      .from("workstations")
      .select("id, code, name, organization_id")
      .eq("id", input.workstationId)
      .eq("status", "active")
      .maybeSingle();

    if (workstationError !== null) {
      throw workstationError;
    }

    if (workstationRow === null || workstationRow.organization_id !== profile.organization_id) {
      workstationInvalid = true;
    } else {
      workstation = {
        id: workstationRow.id,
        code: workstationRow.code,
        name: workstationRow.name,
      };
    }
  }

  return {
    user: {
      id: input.userId,
      email: input.email,
      displayName: profile.display_name,
    },
    profile: {
      username: profile.username ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
      birthday: profile.birthday ?? null,
      region: profile.region ?? null,
      ward: profile.ward ?? null,
      address: profile.address ?? null,
      note: profile.note ?? null,
    },
    organization: {
      id: organization.id,
      code: organization.code,
      name: organization.name,
    },
    workstation,
    devices: [],
    permissions: (permissionRows ?? []).map((row) => row.permission_code),
    workstationInvalid,
  };
}

async function recordAccountDevice(
  client: DatabaseClient,
  input: { userId: string; clientDeviceId: string | null; userAgent: string | null; ipAddress: string | null },
): Promise<CurrentUserDeviceData[]> {
  const parsed = parseDevice(input.userAgent);
  const deviceKey = await makeDeviceKey(input.userId, input.clientDeviceId, input.userAgent, input.ipAddress);
  const now = new Date().toISOString();

  const { error } = await client
    .from("account_devices")
    .upsert({
      user_id: input.userId,
      device_key: deviceKey,
      device_name: parsed.deviceName,
      device_type: parsed.deviceType,
      browser_name: parsed.browserName,
      os_name: parsed.osName,
      ip_address: input.ipAddress,
      status: "active",
      last_seen_at: now,
    }, { onConflict: "user_id,device_key" });

  if (error !== null) throw error;
  return await listAccountDevices(client, input.userId, deviceKey);
}

async function signOutAccountDevice(
  client: DatabaseClient,
  input: {
    userId: string;
    accessToken: string;
    deviceId: string;
    clientDeviceId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  },
): Promise<CurrentUserDeviceData[] | null> {
  const currentDeviceKey = await makeDeviceKey(input.userId, input.clientDeviceId, input.userAgent, input.ipAddress);
  const { data: device, error: lookupError } = await client
    .from("account_devices")
    .select("id, device_key")
    .eq("id", input.deviceId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (lookupError !== null) throw lookupError;
  if (device === null || device.device_key === currentDeviceKey) return null;

  const { error: signOutError } = await client.auth.admin.signOut(input.accessToken, "others");
  if (signOutError !== null) throw signOutError;

  const { error } = await client
    .from("account_devices")
    .update({ status: "signed_out" })
    .eq("user_id", input.userId)
    .eq("status", "active")
    .neq("device_key", currentDeviceKey);

  if (error !== null) throw error;
  return await listAccountDevices(client, input.userId, currentDeviceKey);
}

async function listAccountDevices(
  client: DatabaseClient,
  userId: string,
  currentDeviceKey: string | null,
): Promise<CurrentUserDeviceData[]> {
  const { data, error } = await client
    .from("account_devices")
    .select("id, device_key, device_name, device_type, browser_name, os_name, ip_address, last_seen_at, created_at, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .limit(10);

  if (error !== null) throw error;
  return ((data ?? []) as AccountDeviceRow[]).map((row) => ({
    id: row.id,
    device_name: row.device_name,
    device_type: row.device_type,
    browser_name: row.browser_name,
    os_name: row.os_name,
    ip_address: row.ip_address,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    is_current_device: row.device_key === currentDeviceKey,
    status: row.status,
  }));
}

function parseDevice(userAgent: string | null): {
  deviceName: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browserName: string | null;
  osName: string | null;
} {
  const value = userAgent ?? "";
  const osName = value.includes("Windows")
    ? "Windows"
    : value.includes("Mac OS X")
    ? "macOS"
    : value.includes("Android")
    ? "Android"
    : value.includes("iPhone")
    ? "iOS"
    : value.includes("iPad")
    ? "iPadOS"
    : value.includes("Linux")
    ? "Linux"
    : null;
  const browserName = value.includes("Edg/")
    ? "Edge"
    : value.includes("Chrome/")
    ? "Chrome"
    : value.includes("Firefox/")
    ? "Firefox"
    : value.includes("Safari/")
    ? "Safari"
    : null;
  const deviceType = value.includes("iPad") || value.includes("Tablet")
    ? "tablet"
    : value.includes("Mobile") || value.includes("iPhone") || value.includes("Android")
    ? "mobile"
    : value.trim().length > 0
    ? "desktop"
    : "unknown";
  const deviceName = browserName !== null && osName !== null
    ? `${browserName} trên ${osName}`
    : osName ?? browserName ?? (deviceType === "unknown" ? "Thiết bị không xác định" : "Thiết bị");
  return { deviceName, deviceType, browserName, osName };
}

async function makeDeviceKey(
  userId: string,
  clientDeviceId: string | null,
  userAgent: string | null,
  ipAddress: string | null,
): Promise<string> {
  const clientKey = clientDeviceId?.trim();
  const source = clientKey && clientKey.length > 0
    ? `${userId}|client:${clientKey}`
    : `${userId}|ua:${userAgent ?? ""}|ip:${ipAddress ?? ""}`;
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createFoundationRepository(client: DatabaseClient): FoundationRepository {
  return {
    async getCurrentUser(input: GetCurrentUserInput): Promise<CurrentUserRecord | null> {
      const cacheKey = JSON.stringify([input.userId, input.email, input.workstationId]);
      const cached = currentUserCache.get(cacheKey);
      if (cached !== undefined && cached.expiresAt > Date.now()) return await cached.promise;

      const promise = loadCurrentUser(client, input);
      currentUserCache.set(cacheKey, { expiresAt: Date.now() + currentUserCacheTtlMs, promise });
      try {
        return await promise;
      } catch (cause) {
        currentUserCache.delete(cacheKey);
        throw cause;
      }
    },
    async updateCurrentUserProfile(input): Promise<CurrentUserRecord | null> {
      const { data: existing, error: existingError } = await client
        .from("profiles")
        .select("organization_id")
        .eq("user_id", input.userId)
        .eq("status", "active")
        .maybeSingle();

      if (existingError !== null) throw existingError;
      if (existing === null) return null;

      const { error } = await client
        .from("profiles")
        .update({
          display_name: input.displayName,
          username: input.profile.username,
          phone: input.profile.phone,
          email: input.profile.email,
          birthday: input.profile.birthday,
          region: input.profile.region,
          ward: input.profile.ward,
          address: input.profile.address,
          note: input.profile.note,
        })
        .eq("user_id", input.userId)
        .eq("status", "active");

      if (error !== null) throw error;
      for (const key of currentUserCache.keys()) {
        if (key.includes(input.userId)) currentUserCache.delete(key);
      }
      return await loadCurrentUser(client, { userId: input.userId, email: input.authEmail, workstationId: null });
    },
    async recordCurrentUserDevice(input): Promise<CurrentUserDeviceData[]> {
      return await recordAccountDevice(client, input);
    },
    async signOutCurrentUserDevice(input): Promise<CurrentUserDeviceData[] | null> {
      return await signOutAccountDevice(client, input);
    },
    async listWorkstations(organizationId: string): Promise<WorkstationData[]> {
      const { data, error } = await client
        .from("workstations")
        .select("id, code, name, status")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("code", { ascending: true });

      if (error !== null) {
        throw error;
      }

      return data ?? [];
    },
    async createWorkstation(input): Promise<WorkstationData> {
      const { data, error } = await client
        .from("workstations")
        .insert({
          organization_id: input.organizationId,
          code: input.code,
          name: input.name,
          status: "active",
        })
        .select("id, code, name, status")
        .single();

      if (error !== null) {
        throw error;
      }

      return data;
    },
    async updateWorkstation(input): Promise<WorkstationData | null> {
      const patch: { code?: string; name?: string; status?: "active" | "inactive" } = {};

      if (input.code !== undefined) {
        patch.code = input.code;
      }
      if (input.name !== undefined) {
        patch.name = input.name;
      }
      if (input.status !== undefined) {
        patch.status = input.status;
      }

      const { data, error } = await client
        .from("workstations")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, status")
        .maybeSingle();

      if (error !== null) {
        throw error;
      }

      return data;
    },
    async listUsers(input): Promise<{ items: UserListItem[]; total: number }> {
      let query = client
        .from("profiles")
        .select("user_id, display_name, username, phone, email, birthday, region, ward, address, note, status", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("display_name", { ascending: true })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (input.status !== undefined) query = query.eq("status", input.status);
      if (input.search !== undefined) {
        query = query.or(`display_name.ilike.%${input.search}%,username.ilike.%${input.search}%,phone.ilike.%${input.search}%,email.ilike.%${input.search}%`);
      }

      const { data, error, count } = await query;
      if (error !== null) throw error;
      const items = await Promise.all((data ?? []).map((row) => hydrateUser(client, row, "")));
      return { items, total: count ?? 0 };
    },
    async getUser(input): Promise<UserListItem | null> {
      const { data, error } = await client
        .from("profiles")
        .select("user_id, display_name, username, phone, email, birthday, region, ward, address, note, status")
        .eq("organization_id", input.organizationId)
        .eq("user_id", input.userId)
        .maybeSingle();
      if (error !== null) throw error;
      return data === null ? null : await hydrateUser(client, data, "");
    },
    async createUser(input): Promise<UserListItem> {
      const { data: authUser, error: authError } = await client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });
      if (authError !== null) throw authError;
      const createdId = authUser.user.id;
      try {
        const { error } = await client.rpc("create_profile_with_permissions", {
          p_actor_user_id: input.actorUserId,
          p_user_id: createdId,
          p_display_name: input.displayName,
          p_permission_codes: input.permissions,
          p_trace_id: input.traceId,
        });
        if (error !== null) throw error;
        const { error: profileError } = await client
          .from("profiles")
          .update({
            username: input.username ?? input.email,
            phone: input.phone ?? null,
            email: input.email,
            birthday: input.birthday ?? null,
            region: input.region ?? null,
            ward: input.ward ?? null,
            address: input.address ?? null,
            note: input.note ?? null,
          })
          .eq("user_id", createdId);
        if (profileError !== null) throw profileError;
      } catch (cause) {
        await client.auth.admin.deleteUser(createdId);
        throw cause;
      }
      return {
        id: createdId,
        email: input.email,
        username: input.username ?? input.email,
        phone: input.phone ?? null,
        birthday: input.birthday ?? null,
        region: input.region ?? null,
        ward: input.ward ?? null,
        address: input.address ?? null,
        note: input.note ?? null,
        display_name: input.displayName,
        status: "active",
        permissions: [...input.permissions].sort(),
      };
    },
    async updateUser(input): Promise<UserListItem | null> {
      const { error } = await client.rpc("update_profile_status", {
        p_actor_user_id: input.actorUserId,
        p_target_user_id: input.userId,
        p_display_name: input.displayName ?? null,
        p_status: input.status ?? null,
      });
      if (error !== null) throw error;
      return await this.getUser({ organizationId: input.organizationId, userId: input.userId });
    },
    async replaceUserPermissions(input): Promise<UserListItem | null> {
      const { error } = await client.rpc("replace_user_permissions", {
        p_actor_user_id: input.actorUserId,
        p_target_user_id: input.userId,
        p_permission_codes: input.permissions,
        p_trace_id: input.traceId,
      });
      if (error !== null) throw error;
      return await this.getUser({ organizationId: input.organizationId, userId: input.userId });
    },
    async listPermissions(): Promise<PermissionData[]> {
      const { data, error } = await client
        .from("permissions")
        .select("code, module, description")
        .eq("status", "active")
        .order("code", { ascending: true });
      if (error !== null) throw error;
      return (data ?? []) as PermissionData[];
    },
    async listProducts(input): Promise<{ items: ProductData[]; total: number }> {
      let query = client
        .from("products")
        .select("id, code, name, status, product_kind, unit_name, sell_method, latest_purchase_cost, latest_purchase_cost_at, product_group_id, product_groups(id, code, name)", {
          count: "exact",
        })
        .eq("organization_id", input.organizationId)
        .order("code", { ascending: true });

      if (input.productKind !== undefined) {
        query = query.eq("product_kind", input.productKind);
      }
      if (input.productGroupId !== undefined) {
        query = query.eq("product_group_id", input.productGroupId);
      }

      if (input.productKind === undefined && input.inventoryShape !== undefined) {
        const { data: matchingSettings, error: matchingSettingsError } = await client
          .from("product_inventory_settings")
          .select("product_id")
          .eq("organization_id", input.organizationId)
          .eq("inventory_shape", input.inventoryShape);
        if (matchingSettingsError !== null) throw matchingSettingsError;
        const productIds = (matchingSettings ?? []).map((row) => row.product_id).filter(isString);
        if (productIds.length === 0) return { items: [], total: 0 };
        query = query.in("id", productIds);
      }

      if (input.status !== "all") query = query.eq("status", input.status);
      if (input.sellMethod !== undefined) query = query.eq("sell_method", input.sellMethod);
      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }
      query = query.range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      const { data, error, count } = await query;
      if (error !== null) throw error;
      const items = (data ?? []).map(mapProductRow);
      if (items.length === 0) return { items, total: count ?? 0 };

      const { data: settings, error: settingsError } = await client
        .from("product_inventory_settings")
        .select("product_id, inventory_shape, track_inventory, stock_unit_id")
        .eq("organization_id", input.organizationId)
        .in("product_id", items.map((item) => item.id));
      if (settingsError !== null) throw settingsError;
      const settingsByProduct = new Map((settings ?? []).map((row) => [row.product_id, {
        stock_unit_id: isString(row.stock_unit_id) ? row.stock_unit_id : null,
        inventory_shape: row.inventory_shape as "normal" | "roll" | "sheet",
        track_inventory: Boolean(row.track_inventory),
      }]));
      const conversionsByProduct = await loadCatalogProductUnitConversions(
        client,
        input.organizationId,
        items.map((item) => item.id),
      );
      return {
        items: items.map((item) => ({
          ...item,
          inventory_shape: settingsByProduct.get(item.id)?.inventory_shape ?? "normal",
          track_inventory: settingsByProduct.get(item.id)?.track_inventory ?? true,
          unit_conversions: conversionsByProduct.get(item.id) ?? [],
        })),
        total: count ?? 0,
      };
    },
    async listProductGroups(input): Promise<{ items: ProductGroupData[] }> {
      let query = client
        .from("product_groups")
        .select("id, code, name, is_default, is_active")
        .eq("organization_id", input.organizationId)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (input.activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error !== null) throw error;
      return { items: (data ?? []) as ProductGroupData[] };
    },
    async createProductGroup(input): Promise<ProductGroupData> {
      const { data, error } = await client
        .from("product_groups")
        .insert({
          organization_id: input.organizationId,
          code: input.code ?? productGroupCodeFromName(input.name),
          name: input.name,
          is_default: false,
          is_active: true,
        })
        .select("id, code, name, is_default, is_active")
        .single();
      if (error !== null) throw error;
      return data as ProductGroupData;
    },
    async createProduct(input): Promise<ProductData> {
      const productGroupId = input.productGroupId === undefined
        ? await ensureDefaultProductGroup(client, input.organizationId)
        : input.productGroupId;
      const { data, error } = await client
        .from("products")
        .insert({
          organization_id: input.organizationId,
          code: input.code,
          name: input.name,
          status: input.status,
          product_kind: input.productKind,
          unit_name: input.unitName,
          sell_method: input.sellMethod,
          latest_purchase_cost: input.latestPurchaseCost ?? null,
          latest_purchase_cost_at: input.latestPurchaseCost === undefined ? null : new Date().toISOString(),
          latest_purchase_cost_updated_by: input.latestPurchaseCostUpdatedBy ?? null,
          product_group_id: productGroupId,
        })
        .select("id, code, name, status, product_kind, unit_name, sell_method, latest_purchase_cost, latest_purchase_cost_at, product_group_id, product_groups(id, code, name)")
        .single();
      if (error !== null) throw error;
      const shape = input.inventoryShape ?? "normal";
      const stockUnitId = await ensureInventoryUnit(client, input.organizationId, input.unitName, input.sellMethod);
      const { error: settingsError } = await client
        .from("product_inventory_settings")
        .upsert({
          organization_id: input.organizationId,
          product_id: data.id,
          track_inventory: input.trackInventory ?? (shape !== "normal" || input.sellMethod !== "combo"),
          inventory_shape: shape,
          stock_unit_id: stockUnitId,
        }, { onConflict: "organization_id,product_id" });
      if (settingsError !== null) throw settingsError;
      if (input.unitConversions !== undefined) {
        await replaceProductUnitConversions(client, {
          organizationId: input.organizationId,
          productId: data.id,
          stockUnitId,
          sellMethod: input.sellMethod,
          unitConversions: input.unitConversions,
        });
      }
      const conversions = await loadCatalogProductUnitConversions(client, input.organizationId, [data.id]);
      return {
        ...mapProductRow(data),
        inventory_shape: shape,
        track_inventory: input.trackInventory ?? (shape !== "normal" || input.sellMethod !== "combo"),
        unit_conversions: conversions.get(data.id) ?? [],
      };
    },
    async updateProduct(input): Promise<ProductData | null> {
      const patch: {
        code?: string;
        name?: string;
        status?: "active" | "inactive";
        product_kind?: string;
        unit_name?: string;
        sell_method?: string;
        latest_purchase_cost?: number | null;
        latest_purchase_cost_at?: string | null;
        latest_purchase_cost_updated_by?: string | null;
      } = {};
      if (input.code !== undefined) patch.code = input.code;
      if (input.name !== undefined) patch.name = input.name;
      if (input.status !== undefined) patch.status = input.status;
      if (input.productKind !== undefined) patch.product_kind = input.productKind;
      if (input.unitName !== undefined) patch.unit_name = input.unitName;
      if (input.sellMethod !== undefined) patch.sell_method = input.sellMethod;
      if (input.latestPurchaseCost !== undefined) {
        patch.latest_purchase_cost = input.latestPurchaseCost;
        patch.latest_purchase_cost_at = new Date().toISOString();
        patch.latest_purchase_cost_updated_by = input.latestPurchaseCostUpdatedBy ?? null;
      }

      const { data, error } = await client
        .from("products")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, status, product_kind, unit_name, sell_method, latest_purchase_cost, latest_purchase_cost_at")
        .maybeSingle();
      if (error !== null) throw error;
      return data as ProductData | null;
    },
    async getProductBom(input): Promise<ProductBomData | null> {
      return await loadProductBom(client, input.organizationId, input.productId);
    },
    async saveProductBom(input): Promise<ProductBomData> {
      const { data, error } = await client.rpc("save_product_bom_v1_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_product_id: input.productId,
        p_items: input.items.map((item) => ({
          component_product_id: item.componentProductId,
          quantity: item.quantity,
          notes: item.notes ?? null,
        })),
        p_notes: input.notes ?? null,
      });
      if (error !== null) throw error;
      if (!isRecord(data) || typeof data.id !== "string") throw new Error("BOM_SAVE_FAILED");
      const bom = await loadProductBom(client, input.organizationId, input.productId);
      if (bom === null) throw new Error("BOM_SAVE_FAILED");
      return bom;
    },
    async listPriceLists(input): Promise<PriceListData[]> {
      let query = client
        .from("price_lists")
        .select("id, code, name, is_default, is_active")
        .eq("organization_id", input.organizationId)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      if (input.activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error !== null) throw error;
      return (data ?? []) as PriceListData[];
    },
    async createPriceList(input): Promise<PriceListData> {
      const { data, error } = await client
        .from("price_lists")
        .insert({
          organization_id: input.organizationId,
          code: input.code,
          name: input.name,
          is_default: input.isDefault,
          is_active: true,
        })
        .select("id, code, name, is_default, is_active")
        .single();
      if (error !== null) throw error;
      return data as PriceListData;
    },
    async updatePriceList(input): Promise<PriceListData | null> {
      const patch: { code?: string; name?: string; is_default?: boolean; is_active?: boolean } = {};
      if (input.code !== undefined) patch.code = input.code;
      if (input.name !== undefined) patch.name = input.name;
      if (input.isDefault !== undefined) patch.is_default = input.isDefault;
      if (input.isActive !== undefined) patch.is_active = input.isActive;

      const { data, error } = await client
        .from("price_lists")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, is_default, is_active")
        .maybeSingle();
      if (error !== null) throw error;
      return data as PriceListData | null;
    },
    async upsertPriceListItem(input) {
      const { data, error } = await client
        .from("price_list_items")
        .upsert(
          {
            organization_id: input.organizationId,
            price_list_id: input.priceListId,
            product_id: input.productId,
            unit_price: input.unitPrice,
            pricing_mode: "manual",
            formula_rule_id: null,
          },
          { onConflict: "price_list_id,product_id" },
        )
        .select("product_id, unit_price, price_list_id")
        .single();
      if (error !== null) throw error;
      return {
        product_id: data.product_id,
        unit_price: Number(data.unit_price),
        price_source: "default_price_list",
        price_list_id: data.price_list_id,
      };
    },
    async deletePriceListItem(input): Promise<boolean> {
      const { data, error } = await client
        .from("price_list_items")
        .delete()
        .eq("organization_id", input.organizationId)
        .eq("price_list_id", input.priceListId)
        .eq("product_id", input.productId)
        .select("id");
      if (error !== null) throw error;
      return (data ?? []).length > 0;
    },
    async previewPriceFormula(input): Promise<PriceFormulaPreviewData> {
      const formula = normalizePriceFormula(input.formula);
      validatePriceFormula(formula);
      const [products, priceLists] = await Promise.all([
        loadFormulaProducts(client, input.organizationId, formula.product_filter),
        loadFormulaPriceLists(client, input.organizationId),
      ]);

      const currentItems = await loadFormulaPriceItems(
        client,
        input.organizationId,
        products.map((product) => product.id),
        priceLists.map((priceList) => priceList.id),
      );
      const adjustments = normalizePriceListAdjustments(formula.price_list_adjustments);

      return {
        affected_count: products.length,
        items: products.map((product) => {
          const latestPurchaseCost = toNullableNumber(product.latest_purchase_cost) ?? 0;
          const productItems = currentItems.get(product.id) ?? new Map();
          const firstCurrentItem = [...productItems.values()][0];

          return {
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            latest_purchase_cost: latestPurchaseCost,
            current_mode: firstCurrentItem?.pricing_mode ?? null,
            current_unit_price: firstCurrentItem === undefined ? null : toNullableNumber(firstCurrentItem.unit_price),
            computed_prices: priceLists.map((priceList) => {
              const currentItem = productItems.get(priceList.id);
              const currentUnitPrice = currentItem === undefined ? null : toNullableNumber(currentItem.unit_price);
              const computed = computeFormulaPrice({
                latestPurchaseCost,
                costFormula: formula.cost_formula,
                profitFormula: formula.profit_formula,
                priceListAdjustment: adjustments.get(priceList.id),
              });
              return {
                price_list_id: priceList.id,
                price_list_name: priceList.name,
                current_unit_price: currentUnitPrice,
                computed_unit_price: computed.computed_price,
                delta: currentUnitPrice === null ? null : computed.computed_price - currentUnitPrice,
              };
            }),
          };
        }),
      };
    },
    async applyPriceFormula(input): Promise<{ formula_rule_id: string; affected_count: number }> {
      const formula = normalizePriceFormula(input.formula);
      validatePriceFormula(formula);
      const uniqueItems = uniqueFormulaSelections(input.selectedItems);
      const { data, error } = await client.rpc("apply_price_formula_tx", {
        p_organization_id: input.organizationId,
        p_actor_user_id: input.actorUserId,
        p_formula: formula,
        p_selected_items: uniqueItems,
      });
      if (error !== null) throw error;
      return data as { formula_rule_id: string; affected_count: number };
    },
    async listCustomers(input): Promise<{ items: CustomerData[]; total: number }> {
      const hasAmountFilters =
        input.totalSalesMin !== undefined ||
        input.totalSalesMax !== undefined ||
        input.totalDebtMin !== undefined ||
        input.totalDebtMax !== undefined;
      let query = client
        .from("customers")
        .select(customerExtendedSelect, { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("code", { ascending: true });

      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      if (input.customerGroupId !== undefined) query = query.eq("customer_group_id", input.customerGroupId);
      if (input.createdFrom !== undefined) query = query.gte("created_at", input.createdFrom);
      if (input.createdTo !== undefined) query = query.lte("created_at", input.createdTo);
      if (input.createdBy !== undefined) query = query.eq("created_by", input.createdBy);
      if (!hasAmountFilters) {
        query = query.range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
      }

      const result = await query;
      let data = result.data as CustomerRepositoryRow[] | null;
      let error = result.error;
      let count = result.count;
      if (isMissingCustomerExtendedColumnError(error)) {
        let fallbackQuery = client
          .from("customers")
          .select(customerBaseSelect, { count: "exact" })
          .eq("organization_id", input.organizationId)
          .order("code", { ascending: true });

        if (input.search !== undefined) {
          const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
          fallbackQuery = fallbackQuery.or(`code.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
        }
        if (input.customerGroupId !== undefined) fallbackQuery = fallbackQuery.eq("customer_group_id", input.customerGroupId);
        if (!hasAmountFilters) {
          fallbackQuery = fallbackQuery.range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
        }

        const fallback = await fallbackQuery;
        data = fallback.data as CustomerRepositoryRow[] | null;
        error = fallback.error;
        count = fallback.count;
      }
      if (error !== null) throw error;
      const creatorMap = await loadSellerMap(client, (data ?? []).map((row) => row.created_by ?? ""));
      const customerIds = (data ?? []).map((row) => row.id);
      const [salesTotalMap, debtTotalMap] = await Promise.all([
        loadCustomerSalesTotals(client, input.organizationId, customerIds),
        loadCustomerDebtTotals(client, input.organizationId, customerIds),
      ]);
      const items = (data ?? []).map((row) => toCustomerData(row, creatorMap, salesTotalMap, debtTotalMap));
      if (!hasAmountFilters) return { items, total: count ?? 0 };

      const filteredItems = items.filter((customer) =>
        (input.totalSalesMin === undefined || customer.total_sales_amount >= input.totalSalesMin) &&
        (input.totalSalesMax === undefined || customer.total_sales_amount <= input.totalSalesMax) &&
        (input.totalDebtMin === undefined || customer.total_debt_amount >= input.totalDebtMin) &&
        (input.totalDebtMax === undefined || customer.total_debt_amount <= input.totalDebtMax)
      );
      const start = (input.page - 1) * input.pageSize;
      return { items: filteredItems.slice(start, start + input.pageSize), total: filteredItems.length };
    },
    async createCustomer(input): Promise<CustomerData> {
      const code = input.code ?? await nextCustomerCode(client, input.organizationId);
      const { data, error } = await client
        .from("customers")
        .insert({
          organization_id: input.organizationId,
          code,
          name: input.name,
          phone: input.phone ?? null,
          tax_code: input.taxCode ?? null,
          address: input.address ?? null,
          customer_group_id: input.customerGroupId ?? null,
          created_by: input.actorUserId,
        })
        .select("id, code, name, phone, tax_code, address, customer_group_id, created_by, created_at, customer_groups(id, code, name)")
        .single();
      if (error !== null) throw error;
      const creatorMap = await loadSellerMap(client, [data.created_by ?? ""]);
      return toCustomerData(data, creatorMap, new Map([[data.id, 0]]));
    },
    async updateCustomer(input): Promise<CustomerData | null> {
      const patch: {
        code?: string;
        name?: string;
        phone?: string | null;
        tax_code?: string | null;
        address?: string | null;
        customer_group_id?: string | null;
      } = {};
      if (input.code !== undefined) patch.code = input.code;
      if (input.name !== undefined) patch.name = input.name;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.taxCode !== undefined) patch.tax_code = input.taxCode;
      if (input.address !== undefined) patch.address = input.address;
      if (input.customerGroupId !== undefined) patch.customer_group_id = input.customerGroupId;

      const { data, error } = await client
        .from("customers")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, phone, tax_code, address, customer_group_id, created_by, created_at, customer_groups(id, code, name)")
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const creatorMap = await loadSellerMap(client, [data.created_by ?? ""]);
      const salesTotalMap = await loadCustomerSalesTotals(client, input.organizationId, [data.id]);
      return toCustomerData(data, creatorMap, salesTotalMap);
    },
    async listSuppliers(input): Promise<{ items: SupplierData[]; total: number }> {
      const hasAmountFilters =
        input.totalPurchaseMin !== undefined ||
        input.totalPurchaseMax !== undefined ||
        input.currentPayableMin !== undefined ||
        input.currentPayableMax !== undefined;
      let query = client
        .from("suppliers")
        .select("id, code, name, phone, email, address, tax_code, linked_customer_id, notes, status, customers(id, code, name)", {
          count: "exact",
        })
        .eq("organization_id", input.organizationId)
        .order("code", { ascending: true });

      if (input.status !== "all") query = query.eq("status", input.status);
      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      if (!hasAmountFilters) {
        query = query.range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error !== null) throw error;
      const items = await attachSupplierPurchaseTotals(client, input.organizationId, (data ?? []).map(toSupplierData));
      if (!hasAmountFilters) return { items, total: count ?? 0 };

      const filteredItems = items.filter((supplier) =>
        (input.totalPurchaseMin === undefined || supplier.total_purchase_amount >= input.totalPurchaseMin) &&
        (input.totalPurchaseMax === undefined || supplier.total_purchase_amount <= input.totalPurchaseMax) &&
        (input.currentPayableMin === undefined || supplier.current_payable_amount >= input.currentPayableMin) &&
        (input.currentPayableMax === undefined || supplier.current_payable_amount <= input.currentPayableMax)
      );
      const start = (input.page - 1) * input.pageSize;
      return { items: filteredItems.slice(start, start + input.pageSize), total: filteredItems.length };
    },
    async getSupplier(input): Promise<SupplierData | null> {
      const { data, error } = await client
        .from("suppliers")
        .select("id, code, name, phone, email, address, tax_code, linked_customer_id, notes, status, customers(id, code, name)")
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const [supplier] = await attachSupplierPurchaseTotals(client, input.organizationId, [toSupplierData(data)]);
      return supplier;
    },
    async createSupplier(input): Promise<SupplierData> {
      const code = input.code ?? await nextSupplierCode(client, input.organizationId);
      const { data, error } = await client
        .from("suppliers")
        .insert({
          organization_id: input.organizationId,
          code,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          tax_code: input.taxCode ?? null,
          linked_customer_id: input.linkedCustomerId ?? null,
          notes: input.notes ?? null,
          status: input.status ?? "active",
        })
        .select("id, code, name, phone, email, address, tax_code, linked_customer_id, notes, status, customers(id, code, name)")
        .single();
      if (error !== null) throw error;
      const [supplier] = await attachSupplierPurchaseTotals(client, input.organizationId, [toSupplierData(data)]);
      return supplier;
    },
    async updateSupplier(input): Promise<SupplierData | null> {
      const patch: {
        code?: string;
        name?: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        tax_code?: string | null;
        linked_customer_id?: string | null;
        notes?: string | null;
        status?: "active" | "inactive";
      } = {};
      if (input.code !== undefined) patch.code = input.code;
      if (input.name !== undefined) patch.name = input.name;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.email !== undefined) patch.email = input.email;
      if (input.address !== undefined) patch.address = input.address;
      if (input.taxCode !== undefined) patch.tax_code = input.taxCode;
      if (input.linkedCustomerId !== undefined) patch.linked_customer_id = input.linkedCustomerId;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.status !== undefined) patch.status = input.status;

      const { data, error } = await client
        .from("suppliers")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, phone, email, address, tax_code, linked_customer_id, notes, status, customers(id, code, name)")
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const [supplier] = await attachSupplierPurchaseTotals(client, input.organizationId, [toSupplierData(data)]);
      return supplier;
    },
    async listSupplierPayableReceipts(input) {
      const { data, error } = await client
        .from("purchase_receipts")
        .select("id, code, supplier_document_no, received_at, payable_amount, paid_amount, remaining_amount")
        .eq("organization_id", input.organizationId)
        .eq("supplier_id", input.supplierId)
        .eq("status", "posted")
        .order("received_at", { ascending: false });
      if (error !== null) throw error;

      const receiptIds = (data ?? []).map((row) => row.id);
      const paidByReceipt = await supplierPaymentAllocatedByReceipt(client, input.organizationId, receiptIds);
      return {
        items: (data ?? []).flatMap((row) => {
          const paidAfterPost = paidByReceipt.get(row.id) ?? 0;
          const outstanding = Number(row.remaining_amount) - paidAfterPost;
          if (outstanding <= 0) return [];
          return [{
            id: row.id,
            code: row.code,
            supplier_document_no: row.supplier_document_no,
            received_at: row.received_at,
            payable_amount: Number(row.payable_amount),
            paid_amount: Number(row.paid_amount),
            remaining_amount: Number(row.remaining_amount),
            paid_after_post_amount: paidAfterPost,
            outstanding_amount: outstanding,
          }];
        }),
      };
    },
    async paySupplier(input) {
      const payload: Record<string, unknown> = {
        payment_method: input.paymentMethod,
        allocations: input.allocations.map((allocation) => ({
          purchase_receipt_id: allocation.purchaseReceiptId,
          amount: allocation.amount,
        })),
      };
      if (input.financeAccountId !== undefined) payload.finance_account_id = input.financeAccountId;
      if (input.paidAt !== undefined) payload.paid_at = input.paidAt;
      if (input.note !== undefined) payload.note = input.note;

      const { data, error } = await client.rpc("pay_supplier_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_supplier_id: input.supplierId,
        p_payload: payload,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("SUPPLIER_PAYMENT_RESULT_INVALID");
      return {
        supplier_payment_id: String(data.supplier_payment_id),
        code: String(data.code),
        amount: Number(data.amount),
        cashbook_voucher_id: String(data.cashbook_voucher_id),
      };
    },
    async listPurchaseReceipts(input): Promise<{ items: PurchaseReceiptData[]; total: number }> {
      let query = client
        .from("purchase_receipts")
        .select(
          "id, code, supplier_id, received_at, status, supplier_document_no, subtotal_amount, discount_amount, payable_amount, paid_amount, remaining_amount, notes, created_by, created_at, updated_at, suppliers(id, code, name)",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .order("received_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      const exactCodeSearch = input.search !== undefined && /^PN[0-9]+$/i.test(input.search);
      if (input.status !== "all") query = query.eq("status", input.status);
      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        if (exactCodeSearch) {
          query = query.ilike("code", input.search);
        } else {
          const { data: matchingSuppliers, error: supplierSearchError } = await client
            .from("suppliers")
            .select("id")
            .eq("organization_id", input.organizationId)
            .or(`code.ilike.%${search}%,name.ilike.%${search}%`);
          if (supplierSearchError !== null) throw supplierSearchError;
          const supplierIds = (matchingSuppliers ?? []).map((supplier) => supplier.id);
          const supplierFilter = supplierIds.length > 0 ? `,supplier_id.in.(${supplierIds.join(",")})` : "";
          query = query.or(`code.ilike.%${search}%,supplier_document_no.ilike.%${search}%${supplierFilter}`);
        }
      }
      if (!exactCodeSearch && input.dateFrom !== undefined) query = query.gte("received_at", input.dateFrom);
      if (!exactCodeSearch && input.dateTo !== undefined) query = query.lte("received_at", input.dateTo);
      if (!exactCodeSearch && input.createdBy !== undefined) query = query.eq("created_by", input.createdBy);

      const { data, error, count } = await query;
      if (error !== null) throw error;
      const items = await attachPurchaseReceiptItems(client, input.organizationId, (data ?? []).map(toPurchaseReceiptHeaderData));
      return { items, total: count ?? 0 };
    },
    async getPurchaseReceipt(input): Promise<PurchaseReceiptData | null> {
      const { data, error } = await client
        .from("purchase_receipts")
        .select("id, code, supplier_id, received_at, status, supplier_document_no, subtotal_amount, discount_amount, payable_amount, paid_amount, remaining_amount, notes, created_by, created_at, updated_at, suppliers(id, code, name)")
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const [receipt] = await attachPurchaseReceiptSupplierPayments(
        client,
        input.organizationId,
        await attachPurchaseReceiptItems(client, input.organizationId, [toPurchaseReceiptHeaderData(data)]),
      );
      return receipt;
    },
    async createPurchaseReceipt(input): Promise<PurchaseReceiptData> {
      const payload = purchaseReceiptPayload({
        code: input.code,
        supplierId: input.supplierId,
        receivedAt: input.receivedAt,
        supplierDocumentNo: input.supplierDocumentNo,
        notes: input.notes,
        discountAmount: input.discountAmount,
        paidAmount: input.paidAmount,
        items: input.items,
      });
      const { data, error } = await client.rpc("save_purchase_receipt_draft_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_receipt_id: null,
        p_payload: payload,
      });
      if (error !== null) throw error;
      const receipt = await this.getPurchaseReceipt({ organizationId: input.organizationId, id: String(data) });
      if (receipt === null) throw new Error("PURCHASE_RECEIPT_NOT_FOUND");
      return receipt;
    },
    async updatePurchaseReceipt(input): Promise<PurchaseReceiptData | null> {
      const current = await this.getPurchaseReceipt({ organizationId: input.organizationId, id: input.id });
      if (current === null) return null;
      const payload = purchaseReceiptPayload({
        code: input.code ?? current.code,
        supplierId: input.supplierId ?? current.supplier_id,
        receivedAt: input.receivedAt ?? current.received_at,
        supplierDocumentNo: input.supplierDocumentNo === undefined ? current.supplier_document_no ?? undefined : input.supplierDocumentNo ?? undefined,
        notes: input.notes === undefined ? current.notes ?? undefined : input.notes ?? undefined,
        discountAmount: input.discountAmount ?? current.discount_amount,
        paidAmount: input.paidAmount ?? current.paid_amount,
        items: input.items ?? current.items.map((item) => ({
          productId: item.product_id,
          inventoryShape: item.inventory_shape,
          unitName: item.unit_name_snapshot,
          quantity: item.quantity,
          unitCost: item.unit_cost,
          discountAmount: item.discount_amount,
          physicalPayload: item.physical_payload,
        })),
      });
      const { data, error } = await client.rpc("save_purchase_receipt_draft_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_receipt_id: input.id,
        p_payload: payload,
      });
      if (error !== null) throw error;
      return await this.getPurchaseReceipt({ organizationId: input.organizationId, id: String(data) });
    },
    async postPurchaseReceipt(input) {
      const payload: Record<string, unknown> = {};
      if (input.paymentMethod !== undefined) payload.payment_method = input.paymentMethod;
      if (input.financeAccountId !== undefined) payload.finance_account_id = input.financeAccountId;
      const { data, error } = await client.rpc("post_purchase_receipt_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_receipt_id: input.id,
        p_payload: payload,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("PURCHASE_RECEIPT_POST_RESULT_INVALID");
      return {
        purchase_receipt_id: String(data.purchase_receipt_id),
        status: "posted",
        posted_at: String(data.posted_at),
        cashbook_voucher_id: data.cashbook_voucher_id === null || data.cashbook_voucher_id === undefined
          ? null
          : String(data.cashbook_voucher_id),
      };
    },
    async listCustomerGroups(input): Promise<CustomerGroupData[]> {
      let query = client
        .from("customer_groups")
        .select("id, code, name, price_list_id, is_active")
        .eq("organization_id", input.organizationId)
        .order("code", { ascending: true });

      if (input.activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error !== null) throw error;
      return (data ?? []) as CustomerGroupData[];
    },
    async createCustomerGroup(input): Promise<CustomerGroupData> {
      const { data, error } = await client
        .from("customer_groups")
        .insert({
          organization_id: input.organizationId,
          code: input.code,
          name: input.name,
          price_list_id: input.priceListId,
          is_active: true,
        })
        .select("id, code, name, price_list_id, is_active")
        .single();
      if (error !== null) throw error;
      return data as CustomerGroupData;
    },
    async updateCustomerGroup(input): Promise<CustomerGroupData | null> {
      const patch: { code?: string; name?: string; price_list_id?: string; is_active?: boolean } = {};
      if (input.code !== undefined) patch.code = input.code;
      if (input.name !== undefined) patch.name = input.name;
      if (input.priceListId !== undefined) patch.price_list_id = input.priceListId;
      if (input.isActive !== undefined) patch.is_active = input.isActive;

      const { data, error } = await client
        .from("customer_groups")
        .update(patch)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, code, name, price_list_id, is_active")
        .maybeSingle();
      if (error !== null) throw error;
      return data as CustomerGroupData | null;
    },
    async resolvePrices(input) {
      const { data: defaultPriceList, error: defaultPriceListError } = await client
        .from("price_lists")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();
      if (defaultPriceListError !== null) throw defaultPriceListError;
      if (defaultPriceList === null) throw new Error("DEFAULT_PRICE_LIST_REQUIRED");

      const productIds = [...new Set(input.productIds)];
      const { data: products, error: productsError } = await client
        .from("products")
        .select("id, latest_purchase_cost")
        .eq("organization_id", input.organizationId)
        .eq("status", "active")
        .in("id", productIds);
      if (productsError !== null) throw productsError;

      const activeProductIds = new Set((products ?? []).map((product) => product.id));
      if (activeProductIds.size !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");
      const latestPurchaseCosts = new Map<string, number>();
      for (const product of products ?? []) {
        if (product.latest_purchase_cost !== null) {
          latestPurchaseCosts.set(product.id, Number(product.latest_purchase_cost));
        }
      }

      let customerPriceListId: string | null = null;
      if (input.customerId !== undefined) {
        const { data: customer, error: customerError } = await client
          .from("customers")
          .select("id, customer_groups!left(price_list_id, is_active)")
          .eq("id", input.customerId)
          .eq("organization_id", input.organizationId)
          .maybeSingle();
        if (customerError !== null) throw customerError;
        if (customer === null) throw new Error("CUSTOMER_NOT_FOUND");
        const group = Array.isArray(customer.customer_groups)
          ? customer.customer_groups[0]
          : customer.customer_groups;
        if (group !== null && group?.is_active === true) {
          customerPriceListId = group.price_list_id;
        }
      }

      const listIds = customerPriceListId === null
        ? [defaultPriceList.id]
        : [customerPriceListId, defaultPriceList.id];

      const { data: priceRows, error: priceRowsError } = await client
        .from("price_list_items")
        .select("product_id, unit_price, price_list_id, pricing_mode, formula_rule_id")
        .eq("organization_id", input.organizationId)
        .in("price_list_id", listIds)
        .in("product_id", productIds);
      if (priceRowsError !== null) throw priceRowsError;
      const formulaRules = await loadPriceFormulaRules(
        client,
        input.organizationId,
        [...new Set((priceRows ?? []).map((row) => row.formula_rule_id).filter(isString))],
      );

      return resolvePriceRows({
        productIds,
        defaultPriceListId: defaultPriceList.id,
        customerPriceListId,
        priceRows: priceRows ?? [],
        latestPurchaseCosts,
        formulaRules,
      });
    },
    async checkoutOrder(input): Promise<CheckoutResultData> {
      const { data, error } = await client.rpc("checkout_order_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      return toCheckoutResultData(data);
    },
    async saveQuote(input): Promise<QuoteSummaryData> {
      const { data, error } = await client.rpc("save_quote_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      return toQuoteSummaryData(data);
    },
    async getQuoteReopenPayload(input): Promise<QuoteReopenPayloadData | null> {
      return await loadQuoteReopenPayload(client, input.organizationId, input.quoteId);
    },
    async reviseInvoice(input): Promise<Record<string, unknown>> {
      const { data, error } = await client.rpc("revise_invoice_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_order_id: input.orderId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      return isRecord(data) ? data : {};
    },
    async listSalesDocuments(input): Promise<{ items: SalesDocumentListItemData[]; total: number }> {
      let query = client
        .from("orders")
        .select(
          "id, code, order_type, status, customer_snapshot, subtotal_amount, discount_amount, total_amount, paid_amount, debt_amount, payment_status, note, created_by, created_at",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false });

      if (input.type !== undefined) query = query.eq("order_type", input.type);
      if (input.status !== undefined) query = query.eq("status", input.status);
      if (input.customerId !== undefined) query = query.eq("customer_id", input.customerId);
      if (input.paymentStatus !== undefined) query = query.eq("payment_status", input.paymentStatus);
      if (input.createdBy !== undefined) query = query.eq("created_by", input.createdBy);
      if (input.priceListId !== undefined) query = query.eq("price_list_id", input.priceListId);
      if (input.paymentMethod !== undefined) {
        const orderIds = await loadSalesDocumentOrderIdsByPaymentMethod(client, input.organizationId, input.paymentMethod);
        if (orderIds.length === 0) return { items: [], total: 0 };
        query = query.in("id", orderIds);
      }
      if (input.from !== undefined) query = query.gte("created_at", input.from);
      if (input.to !== undefined) query = query.lte("created_at", input.to);
      if (input.search === undefined) {
        query = query.range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error !== null) throw error;

      let rows = data ?? [];
      if (input.search !== undefined) {
        const search = input.search.toLocaleLowerCase("vi");
        rows = rows.filter((row) => {
          const customer = customerSnapshot(row.customer_snapshot);
          return row.code.toLocaleLowerCase("vi").includes(search) ||
            customer.code?.toLocaleLowerCase("vi").includes(search) === true ||
            customer.name.toLocaleLowerCase("vi").includes(search) ||
            customer.phone?.toLocaleLowerCase("vi").includes(search) === true ||
            row.note?.toLocaleLowerCase("vi").includes(search) === true;
        });
      }

      const page = input.search === undefined
        ? { items: rows, total: count ?? 0 }
        : paginate(rows, input.page, input.pageSize);
      const sellers = await loadSellerMap(client, page.items.map((row) => row.created_by));
      return {
        items: page.items.map((row) => toSalesDocumentListItem(row, sellers)),
        total: page.total,
      };
    },
    async getSalesDocument(input): Promise<SalesDocumentDetailData | null> {
      const { data: order, error } = await client
        .from("orders")
        .select(
          "id, code, order_type, status, customer_snapshot, price_list_id, subtotal_amount, discount_amount, total_amount, paid_amount, debt_amount, change_returned_amount, payment_status, note, created_by, created_at",
        )
        .eq("organization_id", input.organizationId)
        .eq("id", input.orderId)
        .maybeSingle();
      if (error !== null) throw error;
      if (order === null) return null;

      const sellers = await loadSellerMap(client, [order.created_by]);
      const base = toSalesDocumentListItem(order, sellers);
      const [items, priceList, paymentReceipts, debtEntries, stockMovements, history] = await Promise.all([
        loadSalesDocumentItems(client, input.organizationId, input.orderId),
        loadSalesDocumentPriceList(client, input.organizationId, order.price_list_id),
        loadSalesDocumentPaymentReceipts(client, input.organizationId, input.orderId),
        loadSalesDocumentDebtEntries(client, input.organizationId, input.orderId),
        loadSalesDocumentStockMovements(client, input.organizationId, input.orderId),
        loadSalesDocumentHistory(client, input.organizationId, input.orderId),
      ]);

      return {
        ...base,
        price_list: priceList,
        change_returned_amount: Number(order.change_returned_amount),
        items,
        payment_receipts: paymentReceipts,
        debt_entries: debtEntries,
        stock_movements: stockMovements,
        history,
      };
    },
    async listFinanceAccounts(input): Promise<FinanceAccountData[]> {
      let query = client
        .from("finance_accounts")
        .select("id, code, name, account_type, is_default_cash, is_active")
        .eq("organization_id", input.organizationId)
        .order("account_type", { ascending: true })
        .order("code", { ascending: true });

      if (input.accountType !== undefined) query = query.eq("account_type", input.accountType);
      if (input.isActive !== undefined) query = query.eq("is_active", input.isActive);

      const { data, error } = await query;
      if (error !== null) throw error;
      return (data ?? []) as FinanceAccountData[];
    },
    async listCustomerDebts(input): Promise<{ items: CustomerDebtSummaryData[]; total: number }> {
      const summaries = await loadCustomerDebtSummaries(client, input.organizationId);
      const search = input.search?.toLocaleLowerCase("vi");
      const filtered = search === undefined
        ? summaries
        : summaries.filter((item) =>
          item.customer_code?.toLocaleLowerCase("vi").includes(search) === true ||
          item.customer_name.toLocaleLowerCase("vi").includes(search)
        );
      return paginate(filtered, input.page, input.pageSize);
    },
    async listRetailDebts(input): Promise<{ items: RetailDebtInvoiceData[]; total: number }> {
      const retailCustomer = await loadCustomerByCode(client, input.organizationId, "KH000001");
      if (retailCustomer === null) {
        throw { code: "22023", message: "default retail customer KH000001 is not configured" };
      }
      const invoices = await loadRetailDebtInvoices(client, input.organizationId, retailCustomer.id);
      return paginate(invoices, input.page, input.pageSize);
    },
    async getCustomerDebt(input): Promise<CustomerDebtDetailData | null> {
      const { data: customer, error: customerError } = await client
        .from("customers")
        .select("id")
        .eq("id", input.customerId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (customerError !== null) throw customerError;
      if (customer === null) return null;

      const invoices = await loadOpenDebtInvoices(client, input.organizationId, input.customerId);
      return {
        customer_id: input.customerId,
        total_debt: invoices.reduce((sum, invoice) => sum + invoice.remaining_debt, 0),
        invoices,
      };
    },
    async collectCustomerDebt(input): Promise<DebtCollectionResultData> {
      const { data, error } = await client.rpc("collect_customer_debt_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("DEBT_COLLECTION_RESULT_INVALID");
      return {
        payment_receipt_id: String(data.payment_receipt_id ?? ""),
        allocated_amount: Number(data.paid_amount ?? data.allocated_amount ?? 0),
      };
    },
    async createCashbookVoucher(input): Promise<CashbookVoucherData> {
      const { data, error } = await client.rpc("create_cashbook_voucher_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("CASHBOOK_VOUCHER_RESULT_INVALID");
      return {
        id: String(data.id ?? ""),
        code: String(data.code ?? ""),
        source_type: "manual_voucher",
        status: String(data.status ?? "posted") as "posted" | "cancelled",
        amount: Number(data.amount ?? 0),
      };
    },
    async cancelCashbookVoucher(input): Promise<CashbookVoucherData> {
      const { data, error } = await client.rpc("cancel_cashbook_voucher_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_voucher_id: input.voucherId,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("CASHBOOK_VOUCHER_CANCEL_RESULT_INVALID");
      return {
        id: String(data.id ?? ""),
        code: String(data.code ?? ""),
        source_type: "manual_voucher",
        status: String(data.status ?? "cancelled") as "posted" | "cancelled",
        amount: Number(data.amount ?? 0),
      };
    },
    async reviseCashbookVoucher(input): Promise<CashbookVoucherData> {
      const { data, error } = await client.rpc("revise_cashbook_voucher_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_voucher_id: input.voucherId,
        p_payload: input.payload,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("CASHBOOK_VOUCHER_REVISE_RESULT_INVALID");
      return {
        id: String(data.id ?? ""),
        code: String(data.code ?? ""),
        source_type: "manual_voucher",
        status: String(data.status ?? "posted") as "posted" | "cancelled",
        amount: Number(data.amount ?? 0),
      };
    },
    async listCashbookEntries(input): Promise<CashbookListData> {
      let query = client
        .from("cashbook_entries")
        .select(
          "id, finance_account_id, entry_time, source_type, payment_receipt_method_id, cashbook_voucher_id, status, direction, amount_delta, is_business_accounted, description, created_at, finance_accounts(id, code, name, account_type)",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .order("entry_time", { ascending: false });

      if (input.financeAccountId !== undefined) query = query.eq("finance_account_id", input.financeAccountId);
      if (input.direction !== undefined) query = query.eq("direction", input.direction);
      if (input.sourceType !== undefined) query = query.eq("source_type", input.sourceType);
      if (input.status !== undefined) query = query.eq("status", input.status);
      if (input.isBusinessAccounted !== undefined) {
        query = query.eq("is_business_accounted", input.isBusinessAccounted);
      }
      if (input.from !== undefined) query = query.gte("entry_time", input.from);
      if (input.to !== undefined) query = query.lte("entry_time", input.to);

      const { data, error } = await query;
      if (error !== null) throw error;

      let items = await Promise.all((data ?? []).map((row) => hydrateCashbookEntry(client, input.organizationId, row)));
      if (input.financeAccountType !== undefined) {
        items = items.filter((item) => item.finance_account.account_type === input.financeAccountType);
      }
      if (input.search !== undefined) {
        const search = input.search.toLocaleLowerCase("vi");
        items = items.filter((item) => {
          const codeMatch = item.code.toLocaleLowerCase("vi").includes(search);
          const noteMatch = item.note?.toLocaleLowerCase("vi").includes(search) === true;
          if (input.searchScope === "code") return codeMatch;
          if (input.searchScope === "note") return noteMatch;
          if (input.searchScope === "transfer_content") return false;
          return codeMatch || noteMatch;
        });
      }

      const summaryItems = items.filter((item) => item.status === "posted");
      const totalIn = summaryItems
        .filter((item) => item.amount_delta > 0)
        .reduce((sum, item) => sum + item.amount_delta, 0);
      const totalOut = summaryItems
        .filter((item) => item.amount_delta < 0)
        .reduce((sum, item) => sum + item.amount_delta, 0);
      const page = paginate(items, input.page, input.pageSize);

      return {
        summary: {
          opening_balance: 0,
          total_in: totalIn,
          total_out: totalOut,
          ending_balance: totalIn + totalOut,
        },
        items: page.items,
        page: input.page,
        page_size: input.pageSize,
        total: page.total,
      };
    },
    async getCashbookEntry(input): Promise<CashbookEntryDetailData | null> {
      const { data, error } = await client
        .from("cashbook_entries")
        .select(
          "id, finance_account_id, entry_time, source_type, payment_receipt_method_id, cashbook_voucher_id, status, direction, amount_delta, is_business_accounted, description, created_by, created_at, finance_accounts(id, code, name, account_type)",
        )
        .eq("id", input.entryId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      return await hydrateCashbookEntryDetail(client, input.organizationId, data);
    },
    async getPaymentReceipt(input): Promise<PaymentReceiptDetailData | null> {
      return await loadPaymentReceiptDetail(client, input.organizationId, input.receiptId);
    },
    async listCashbookBalances(input): Promise<CashbookBalanceData[]> {
      const accounts = await this.listFinanceAccounts({ organizationId: input.organizationId, isActive: true });
      const { data: entries, error } = await client
        .from("cashbook_entries")
        .select("finance_account_id, amount_delta")
        .eq("organization_id", input.organizationId)
        .eq("status", "posted");
      if (error !== null) throw error;

      const balances = new Map<string, number>();
      for (const entry of entries ?? []) {
        balances.set(entry.finance_account_id, (balances.get(entry.finance_account_id) ?? 0) + Number(entry.amount_delta));
      }

      return accounts.map((account) => ({
        finance_account_id: account.id,
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        balance: balances.get(account.id) ?? 0,
      }));
    },
    async listCashbookVouchers(input): Promise<{ items: CashbookVoucherData[]; total: number }> {
      const { data, error, count } = await client
        .from("cashbook_vouchers")
        .select("id, code, status, amount", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .range(0, 99);
      if (error !== null) throw error;
      return {
        items: (data ?? []).map((row) => ({
          id: row.id,
          code: row.code,
          source_type: "manual_voucher",
          status: row.status,
          amount: Number(row.amount),
        })),
        total: count ?? 0,
      };
    },
    async listReconciliations(input): Promise<{ items: ReconciliationData[]; total: number }> {
      const { data, error, count } = await client
        .from("cash_reconciliations")
        .select("id, code, status, period_start, period_end", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("period_end", { ascending: false })
        .range(0, 99);
      if (error !== null) throw error;
      return { items: (data ?? []) as ReconciliationData[], total: count ?? 0 };
    },
    async listInventoryProducts(input): Promise<{ items: InventoryProductData[]; total: number }> {
      let query = client
        .from("products")
        .select("id, code, name, status", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("code", { ascending: true })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (input.status !== "all") query = query.eq("status", input.status);
      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data: products, error, count } = await query;
      if (error !== null) throw error;
      const items = await hydrateInventoryProducts(client, input.organizationId, products ?? [], input.inventoryShape);
      return { items, total: count ?? items.length };
    },
    async getInventoryProduct(input): Promise<InventoryProductData | null> {
      const { data, error } = await client
        .from("products")
        .select("id, code, name, status")
        .eq("id", input.productId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const [item] = await hydrateInventoryProducts(client, input.organizationId, [data]);
      return item ?? null;
    },
    async listStockMovements(input): Promise<{ items: StockMovementData[]; total: number }> {
      let query = client
        .from("stock_movements")
        .select(
          "id, product_id, movement_type, quantity_delta, created_at, orders(id, code, customer_snapshot), order_items(id, unit_price), purchase_receipts(id, code, suppliers(id, code, name)), purchase_receipt_items(id, unit_cost), stocktakes(id, code), products(id, latest_purchase_cost)",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (input.productId !== undefined) query = query.eq("product_id", input.productId);
      if (input.orderId !== undefined) query = query.eq("order_id", input.orderId);

      const { data, error, count } = await query;
      if (error !== null) throw error;
      return {
        items: (data ?? []).map((row) => {
          const order = firstRelation(row.orders);
          const orderItem = firstRelation(row.order_items);
          const purchaseReceipt = firstRelation(row.purchase_receipts);
          const purchaseReceiptItem = firstRelation(row.purchase_receipt_items);
          const supplier = firstRelation(purchaseReceipt?.suppliers);
          const stocktake = firstRelation(row.stocktakes);
          const product = firstRelation(row.products);
          const customer = order === null ? null : customerSnapshot(order.customer_snapshot);
          const documentCode = order?.code ?? purchaseReceipt?.code ?? stocktake?.code ?? null;
          const documentType = order !== null
            ? "sale_invoice"
            : purchaseReceipt !== null
              ? "purchase_receipt"
              : stocktake !== null
                ? "stocktake"
                : row.movement_type === "material_opening"
                  ? "material_opening"
                  : row.movement_type === "manual_adjustment"
                    ? "manual"
                    : null;
          return {
            id: row.id,
            product_id: row.product_id,
            movement_type: row.movement_type,
            quantity_delta: Number(row.quantity_delta),
            created_at: row.created_at,
            document_code: documentCode,
            document_type: documentType,
            transaction_price: orderItem?.unit_price === undefined || orderItem?.unit_price === null
              ? purchaseReceiptItem?.unit_cost === undefined || purchaseReceiptItem?.unit_cost === null
                ? null
                : Number(purchaseReceiptItem.unit_cost)
              : Number(orderItem.unit_price),
            cost_price: product?.latest_purchase_cost === undefined || product?.latest_purchase_cost === null
              ? purchaseReceiptItem?.unit_cost === undefined || purchaseReceiptItem?.unit_cost === null
                ? null
                : Number(purchaseReceiptItem.unit_cost)
              : Number(product.latest_purchase_cost),
            partner_name: customer?.name ?? supplier?.name ?? null,
          };
        }),
        total: count ?? 0,
      };
    },
    async listStocktakes(input): Promise<{ items: StocktakeData[]; total: number }> {
      let query = client
        .from("stocktakes")
        .select("id, code, status, source_type, created_at, balanced_at, note", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (input.status !== undefined) query = query.eq("status", input.status);
      if (input.createdFrom !== undefined) query = query.gte("created_at", input.createdFrom);
      if (input.createdTo !== undefined) query = query.lte("created_at", input.createdTo);
      if (input.search !== undefined) {
        const search = input.search.replaceAll(",", " ").replaceAll("%", "\\%");
        query = query.or(`code.ilike.%${search}%,note.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error !== null) throw error;
      return {
        items: await hydrateStocktakeAggregates(client, input.organizationId, (data ?? []) as Array<Record<string, unknown>>),
        total: count ?? 0,
      };
    },
    async getStocktake(input): Promise<StocktakeData | null> {
      const { data, error } = await client
        .from("stocktakes")
        .select("id, code, status, source_type, created_at, balanced_at, note")
        .eq("organization_id", input.organizationId)
        .eq("id", input.stocktakeId)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return null;
      const items = await hydrateStocktakeAggregates(client, input.organizationId, [data as Record<string, unknown>]);
      return items[0] ?? null;
    },
    async listInventoryRolls(input): Promise<{ items: InventoryRollData[]; total: number }> {
      let query = client
        .from("inventory_rolls")
        .select("id, product_id, code, width_m, initial_length_m, remaining_length_m, initial_area_m2, remaining_area_m2, status, note, created_at", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
      if (input.productId !== undefined) query = query.eq("product_id", input.productId);
      if (input.status !== undefined) query = query.eq("status", input.status);
      const { data, error, count } = await query;
      if (error !== null) throw error;
      return { items: (data ?? []).map(mapInventoryRoll), total: count ?? 0 };
    },
    async createInventoryRoll(input): Promise<InventoryRollData> {
      const remainingLength = input.remainingLengthM ?? input.initialLengthM;
      const row = {
        organization_id: input.organizationId,
        product_id: input.productId,
        code: input.code,
        width_m: input.widthM,
        initial_length_m: input.initialLengthM,
        remaining_length_m: remainingLength,
        initial_area_m2: input.widthM * input.initialLengthM,
        remaining_area_m2: input.widthM * remainingLength,
        status: input.status ?? "available",
        note: input.note ?? null,
        created_by: input.actorUserId,
      };
      const { data, error } = await client
        .from("inventory_rolls")
        .insert(row)
        .select("id, product_id, code, width_m, initial_length_m, remaining_length_m, initial_area_m2, remaining_area_m2, status, note, created_at")
        .single();
      if (error !== null) throw error;
      return mapInventoryRoll(data);
    },
    async updateInventoryRoll(input): Promise<InventoryRollData | null> {
      const { data: current, error: currentError } = await client
        .from("inventory_rolls")
        .select("id, product_id, width_m, remaining_length_m, remaining_area_m2")
        .eq("organization_id", input.organizationId)
        .eq("id", input.rollId)
        .maybeSingle();
      if (currentError !== null) throw currentError;
      if (current === null) return null;
      const nextRemainingLength = input.remainingLengthM ?? Number(current.remaining_length_m);
      const nextRemainingArea = Number(current.width_m) * nextRemainingLength;
      const patch: Record<string, unknown> = {
        remaining_length_m: nextRemainingLength,
        remaining_area_m2: nextRemainingArea,
      };
      if (input.status !== undefined) patch.status = input.status;
      const { data, error } = await client
        .from("inventory_rolls")
        .update(patch)
        .eq("organization_id", input.organizationId)
        .eq("id", input.rollId)
        .select("id, product_id, code, width_m, initial_length_m, remaining_length_m, initial_area_m2, remaining_area_m2, status, note, created_at")
        .single();
      if (error !== null) throw error;
      await insertObjectAdjustmentMovement(client, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: String(current.product_id),
        quantityDelta: nextRemainingArea - Number(current.remaining_area_m2),
        inventoryObjectType: "roll",
        inventoryRollId: input.rollId,
        inventorySheetId: null,
        reason: input.reason,
      });
      return mapInventoryRoll(data);
    },
    async listInventorySheets(input): Promise<{ items: InventorySheetData[]; total: number }> {
      let query = client
        .from("inventory_sheets")
        .select("id, product_id, code, sheet_kind, width_m, length_m, area_m2, status, note, created_at", { count: "exact" })
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
      if (input.productId !== undefined) query = query.eq("product_id", input.productId);
      if (input.status !== undefined) query = query.eq("status", input.status);
      const { data, error, count } = await query;
      if (error !== null) throw error;
      return { items: (data ?? []).map(mapInventorySheet), total: count ?? 0 };
    },
    async createInventorySheet(input): Promise<InventorySheetData> {
      const row = {
        organization_id: input.organizationId,
        product_id: input.productId,
        code: input.code,
        sheet_kind: input.sheetKind,
        width_m: input.widthM,
        length_m: input.lengthM,
        area_m2: input.widthM * input.lengthM,
        status: input.status ?? "available",
        note: input.note ?? null,
        created_by: input.actorUserId,
      };
      const { data, error } = await client
        .from("inventory_sheets")
        .insert(row)
        .select("id, product_id, code, sheet_kind, width_m, length_m, area_m2, status, note, created_at")
        .single();
      if (error !== null) throw error;
      return mapInventorySheet(data);
    },
    async updateInventorySheet(input): Promise<InventorySheetData | null> {
      const { data: current, error: currentError } = await client
        .from("inventory_sheets")
        .select("id, product_id, width_m, length_m, area_m2")
        .eq("organization_id", input.organizationId)
        .eq("id", input.sheetId)
        .maybeSingle();
      if (currentError !== null) throw currentError;
      if (current === null) return null;
      const nextWidth = input.widthM ?? Number(current.width_m);
      const nextLength = input.lengthM ?? Number(current.length_m);
      const nextArea = nextWidth * nextLength;
      const patch: Record<string, unknown> = {
        width_m: nextWidth,
        length_m: nextLength,
        area_m2: nextArea,
      };
      if (input.status !== undefined) patch.status = input.status;
      const { data, error } = await client
        .from("inventory_sheets")
        .update(patch)
        .eq("organization_id", input.organizationId)
        .eq("id", input.sheetId)
        .select("id, product_id, code, sheet_kind, width_m, length_m, area_m2, status, note, created_at")
        .single();
      if (error !== null) throw error;
      await insertObjectAdjustmentMovement(client, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: String(current.product_id),
        quantityDelta: nextArea - Number(current.area_m2),
        inventoryObjectType: "sheet",
        inventoryRollId: null,
        inventorySheetId: input.sheetId,
        reason: input.reason,
      });
      return mapInventorySheet(data);
    },
    async adjustNormalProductStock(input): Promise<StocktakeData> {
      const { data, error } = await client.rpc("adjust_normal_product_stock_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_product_id: input.productId,
        p_actual_qty: input.actualQty,
        p_reason: input.reason,
      });
      if (error !== null) throw error;
      if (!isRecord(data)) throw new Error("STOCKTAKE_RESULT_INVALID");
      return {
        id: String(data.id),
        code: String(data.code),
        status: "balanced",
        source_type: "product_edit",
        created_at: String(data.created_at),
        balanced_at: String(data.balanced_at),
        total_actual_qty: input.actualQty,
        total_actual_value: null,
        total_difference_value: null,
        increased_qty: 0,
        decreased_qty: 0,
        note: data.note === null ? null : String(data.note),
      };
    },
    async getMaterialOpeningOptions(input): Promise<MaterialOpeningOptionsData | null> {
      return await loadMaterialOpeningOptions(client, input.organizationId, input.productId);
    },
    async previewPosMaterialShortage(input): Promise<PosMaterialShortagePreviewData | null> {
      return await loadPosMaterialShortagePreview(client, input.organizationId, input.productId, input.quantity);
    },
    async createMaterialOpening(input): Promise<MaterialOpeningResultData> {
      if (input.inventoryShape === "roll") {
        return await createRollMaterialOpening(client, input);
      }
      if (input.inventoryShape === "sheet") {
        return await createSheetMaterialOpening(client, input);
      }
      const { data, error } = await client.rpc("open_normal_material_tx", {
        p_actor_user_id: input.actorUserId,
        p_organization_id: input.organizationId,
        p_payload: {
          product_id: input.productId,
          inventory_shape: input.inventoryShape,
          opened_unit_id: input.openedUnitId ?? "",
          opened_qty: input.openedQty ?? 0,
          old_remaining_qty: input.oldRemainingQty ?? 0,
          note: input.note ?? null,
        },
      });
      if (error !== null) throw error;
      return toMaterialOpeningResult(data);
    },
    async listProductionQueue(input): Promise<{ items: ProductionQueueItemData[]; total: number }> {
      const { data, error, count } = await client
        .from("production_queue_items")
        .select(
          "id, raw_file_name, received_at, status, parse_status, parse_error, parsed_payload, production_machines(id, code, name)",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .eq("status", "queued")
        .order("received_at", { ascending: true })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (error !== null) throw error;
      return { items: (data ?? []).map(toProductionQueueItemData), total: count ?? 0 };
    },
    async listProductionQueueHistory(input): Promise<{ items: ProductionQueueItemData[]; total: number }> {
      const { data, error, count } = await client
        .from("production_queue_items")
        .select(
          "id, raw_file_name, received_at, status, parse_status, parse_error, parsed_payload, production_machines(id, code, name)",
          { count: "exact" },
        )
        .eq("organization_id", input.organizationId)
        .neq("status", "queued")
        .order("handled_at", { ascending: false })
        .range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);

      if (error !== null) throw error;
      return { items: (data ?? []).map(toProductionQueueItemData), total: count ?? 0 };
    },
    async addProductionQueueItemToDraft(input): Promise<ProductionQueueDraftPayloadData | null> {
      const item = await claimProductionQueueItem(client, input.organizationId, input.queueItemId, input.actorUserId, "added_to_draft");
      return item === null ? null : await toProductionQueueDraftPayload(client, input.organizationId, item);
    },
    async dismissProductionQueueItem(input): Promise<ProductionQueueItemData | null> {
      const item = await claimProductionQueueItem(client, input.organizationId, input.queueItemId, input.actorUserId, "dismissed");
      return item === null ? null : await hydrateProductionQueueItem(client, input.organizationId, String(item.id));
    },
    async restoreProductionQueueItem(input): Promise<ProductionQueueItemData | null> {
      const { data, error } = await client.rpc("restore_production_queue_item_tx", {
        p_organization_id: input.organizationId,
        p_queue_item_id: input.queueItemId,
        p_actor_user_id: input.actorUserId,
      });
      if (error !== null) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!isRecord(row)) return null;
      return await hydrateProductionQueueItem(client, input.organizationId, String(row.id));
    },
  };
}

async function claimProductionQueueItem(
  client: DatabaseClient,
  organizationId: string,
  queueItemId: string,
  actorUserId: string,
  targetStatus: "added_to_draft" | "dismissed",
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client.rpc("claim_production_queue_item_tx", {
    p_organization_id: organizationId,
    p_queue_item_id: queueItemId,
    p_actor_user_id: actorUserId,
    p_target_status: targetStatus,
  });
  if (error !== null) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
}

async function hydrateProductionQueueItem(
  client: DatabaseClient,
  organizationId: string,
  queueItemId: string,
): Promise<ProductionQueueItemData | null> {
  const { data, error } = await client
    .from("production_queue_items")
    .select(
      "id, raw_file_name, received_at, status, parse_status, parse_error, parsed_payload, production_machines(id, code, name)",
    )
    .eq("id", queueItemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  return data === null ? null : toProductionQueueItemData(data);
}

async function toProductionQueueDraftPayload(
  client: DatabaseClient,
  organizationId: string,
  item: Record<string, unknown>,
): Promise<ProductionQueueDraftPayloadData> {
  const parsed = isRecord(item.parsed_payload) ? item.parsed_payload : {};
  const productCode = String(parsed.product_code ?? "");
  if (productCode.length === 0) throw new Error("PRODUCTION_QUEUE_PRODUCT_CODE_REQUIRED");

  const { data: product, error: productError } = await client
    .from("products")
    .select("id, code, name, unit_name, sell_method")
    .eq("organization_id", organizationId)
    .eq("code", productCode)
    .eq("status", "active")
    .maybeSingle();
  if (productError !== null) throw productError;
  if (product === null) throw new Error("PRODUCT_NOT_FOUND");

  const customerCode = typeof parsed.customer_code === "string" ? parsed.customer_code.trim() : "";
  const customer = customerCode.length === 0 ? null : await loadCustomerByCode(client, organizationId, customerCode);
  const widthM = numberFromPayload(parsed.width_m) ?? cmToMeters(parsed.width_cm);
  const heightM = numberFromPayload(parsed.height_m) ?? cmToMeters(parsed.height_cm);
  const linearM = numberFromPayload(parsed.linear_m);
  const quantity = numberFromPayload(parsed.quantity) ?? 1;

  return {
    queue_item_id: String(item.id),
    customer,
    draft_line: {
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      unit_name: product.unit_name,
      sell_method: product.sell_method,
      width_m: widthM,
      height_m: heightM,
      linear_m: linearM,
      quantity,
      source: "production_queue",
    },
  };
}

function toProductionQueueItemData(row: Record<string, unknown>): ProductionQueueItemData {
  const machine = Array.isArray(row.production_machines) ? row.production_machines[0] : row.production_machines;
  const machineRecord = isRecord(machine) ? machine : {};
  return {
    id: String(row.id),
    production_machine: {
      id: String(machineRecord.id ?? ""),
      code: String(machineRecord.code ?? ""),
      name: String(machineRecord.name ?? ""),
    },
    raw_file_name: String(row.raw_file_name),
    received_at: String(row.received_at),
    status: String(row.status) as "queued" | "added_to_draft" | "dismissed",
    parse_status: String(row.parse_status) as "pending" | "ok" | "error",
    parse_error: row.parse_error === null ? null : String(row.parse_error ?? ""),
    parsed: isRecord(row.parsed_payload) ? row.parsed_payload : {},
  };
}

async function loadCustomerByCode(
  client: DatabaseClient,
  organizationId: string,
  customerCode: string,
): Promise<{ id: string; code: string; name: string } | null> {
  const { data, error } = await client
    .from("customers")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("code", customerCode)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

function numberFromPayload(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cmToMeters(value: unknown): number | null {
  const centimeters = numberFromPayload(value);
  return centimeters === null ? null : centimeters / 100;
}

async function nextCustomerCode(client: DatabaseClient, organizationId: string): Promise<string> {
  const { data, error } = await client.rpc("next_customer_code", { p_organization_id: organizationId });
  if (error !== null) throw error;
  if (typeof data !== "string") throw new Error("CUSTOMER_CODE_REQUIRED");
  return data;
}

async function nextSupplierCode(client: DatabaseClient, organizationId: string): Promise<string> {
  const { data, error } = await client.rpc("next_supplier_code", { p_organization_id: organizationId });
  if (error !== null) throw error;
  if (typeof data !== "string") throw new Error("SUPPLIER_CODE_REQUIRED");
  return data;
}

function toCustomerData(
  row: CustomerRepositoryRow,
  creatorMap: Map<string, string> = new Map(),
  salesTotalMap: Map<string, number> = new Map(),
  debtTotalMap: Map<string, number> = new Map(),
): CustomerData {
  const group = Array.isArray(row.customer_groups) ? row.customer_groups[0] : row.customer_groups;
  const createdBy = row.created_by ?? null;
  const creatorName = createdBy === null ? undefined : creatorMap.get(createdBy);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    tax_code: row.tax_code ?? null,
    address: row.address ?? null,
    customer_group_id: row.customer_group_id,
    customer_group: group ?? null,
    created_at: row.created_at ?? "",
    created_by: createdBy === null ? null : { id: createdBy, name: creatorName ?? "" },
    total_sales_amount: salesTotalMap.get(row.id) ?? 0,
    total_debt_amount: debtTotalMap.get(row.id) ?? 0,
  };
}

function isMissingCustomerExtendedColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" &&
    (
      error.message?.includes("customers.tax_code") === true ||
      error.message?.includes("customers.address") === true ||
      error.message?.includes("customers.created_by") === true ||
      error.message?.includes("customers.created_at") === true
    );
}

async function loadCustomerSalesTotals(
  client: DatabaseClient,
  organizationId: string,
  customerIds: string[],
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(customerIds.filter((id) => id.length > 0))];
  const totals = new Map(uniqueIds.map((id) => [id, 0]));
  if (uniqueIds.length === 0) return totals;

  const { data, error } = await client
    .from("orders")
    .select("customer_id, total_amount")
    .eq("organization_id", organizationId)
    .eq("order_type", "invoice")
    .eq("status", "completed")
    .in("customer_id", uniqueIds);

  if (error !== null) throw error;

  for (const row of data ?? []) {
    const customerId = String(row.customer_id ?? "");
    if (customerId.length === 0) continue;
    totals.set(customerId, (totals.get(customerId) ?? 0) + Number(row.total_amount ?? 0));
  }

  return totals;
}

async function loadCustomerDebtTotals(
  client: DatabaseClient,
  organizationId: string,
  customerIds: string[],
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(customerIds.filter((id) => id.length > 0))];
  const totals = new Map(uniqueIds.map((id) => [id, 0]));
  if (uniqueIds.length === 0) return totals;

  const invoices = await loadOpenDebtInvoices(client, organizationId, undefined, uniqueIds);
  for (const invoice of invoices) {
    const customerId = invoice.customer_id ?? "";
    if (!totals.has(customerId)) continue;
    totals.set(customerId, (totals.get(customerId) ?? 0) + invoice.remaining_debt);
  }

  return totals;
}

function toSupplierData(row: {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_code: string | null;
  linked_customer_id: string | null;
  notes: string | null;
  status: "active" | "inactive";
  customers?: { id: string; code: string; name: string } | Array<{ id: string; code: string; name: string }> | null;
}): SupplierData {
  const linkedCustomer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    tax_code: row.tax_code,
    linked_customer_id: row.linked_customer_id,
    linked_customer: linkedCustomer ?? null,
    notes: row.notes,
    status: row.status,
    current_payable_amount: 0,
    total_purchase_amount: 0,
  };
}

async function attachSupplierPurchaseTotals(
  client: DatabaseClient,
  organizationId: string,
  suppliers: SupplierData[],
): Promise<SupplierData[]> {
  if (suppliers.length === 0) return suppliers;
  const supplierIds = suppliers.map((supplier) => supplier.id);
  const { data, error } = await client
    .from("purchase_receipts")
    .select("id, supplier_id, payable_amount, remaining_amount")
    .eq("organization_id", organizationId)
    .eq("status", "posted")
    .in("supplier_id", supplierIds);
  if (error !== null) throw error;

  const receiptSupplierById = new Map<string, string>();
  const totalsBySupplier = new Map<string, { totalPurchase: number; currentPayable: number }>();
  for (const row of data ?? []) {
    receiptSupplierById.set(row.id, row.supplier_id);
    const current = totalsBySupplier.get(row.supplier_id) ?? { totalPurchase: 0, currentPayable: 0 };
    totalsBySupplier.set(row.supplier_id, {
      totalPurchase: current.totalPurchase + Number(row.payable_amount),
      currentPayable: current.currentPayable + Number(row.remaining_amount),
    });
  }

  const paidByReceipt = await supplierPaymentAllocatedByReceipt(client, organizationId, [...receiptSupplierById.keys()]);
  for (const [receiptId, paidAmount] of paidByReceipt) {
    const supplierId = receiptSupplierById.get(receiptId);
    if (supplierId === undefined) continue;
    const current = totalsBySupplier.get(supplierId);
    if (current === undefined) continue;
    totalsBySupplier.set(supplierId, {
      ...current,
      currentPayable: current.currentPayable - paidAmount,
    });
  }

  return suppliers.map((supplier) => {
    const totals = totalsBySupplier.get(supplier.id);
    if (totals === undefined) return supplier;
    return {
      ...supplier,
      current_payable_amount: totals.currentPayable,
      total_purchase_amount: totals.totalPurchase,
    };
  });
}

function toPurchaseReceiptHeaderData(row: {
  id: string;
  code: string;
  supplier_id: string;
  received_at: string;
  status: "draft" | "posted" | "cancelled";
  supplier_document_no: string | null;
  subtotal_amount: number | string;
  discount_amount: number | string;
  payable_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  suppliers?: { id: string; code: string; name: string } | Array<{ id: string; code: string; name: string }> | null;
}): PurchaseReceiptData {
  const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
  return {
    id: row.id,
    code: row.code,
    supplier_id: row.supplier_id,
    supplier: supplier ?? { id: row.supplier_id, code: "", name: "" },
    received_at: row.received_at,
    status: row.status,
    supplier_document_no: row.supplier_document_no,
    subtotal_amount: Number(row.subtotal_amount),
    discount_amount: Number(row.discount_amount),
    payable_amount: Number(row.payable_amount),
    paid_amount: Number(row.paid_amount),
    remaining_amount: Number(row.remaining_amount),
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: [],
    supplier_payments: [],
  };
}

async function attachPurchaseReceiptItems(
  client: DatabaseClient,
  organizationId: string,
  receipts: PurchaseReceiptData[],
): Promise<PurchaseReceiptData[]> {
  if (receipts.length === 0) return receipts;
  const receiptIds = receipts.map((receipt) => receipt.id);
  const { data, error } = await client
    .from("purchase_receipt_items")
    .select("id, purchase_receipt_id, product_id, line_no, inventory_shape, unit_name_snapshot, quantity, unit_cost, discount_amount, line_amount, physical_payload, products(id, code, name)")
    .eq("organization_id", organizationId)
    .in("purchase_receipt_id", receiptIds)
    .order("line_no", { ascending: true });
  if (error !== null) throw error;

  const itemsByReceipt = new Map<string, PurchaseReceiptData["items"]>();
  for (const row of data ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const item = {
      id: row.id,
      product_id: row.product_id,
      product: product ?? { id: row.product_id, code: "", name: "" },
      line_no: Number(row.line_no),
      inventory_shape: row.inventory_shape as "normal" | "roll" | "sheet",
      unit_name_snapshot: row.unit_name_snapshot,
      quantity: Number(row.quantity),
      unit_cost: Number(row.unit_cost),
      discount_amount: Number(row.discount_amount),
      line_amount: Number(row.line_amount),
      physical_payload: row.physical_payload ?? null,
    };
    itemsByReceipt.set(row.purchase_receipt_id, [...(itemsByReceipt.get(row.purchase_receipt_id) ?? []), item]);
  }

  return receipts.map((receipt) => ({ ...receipt, items: itemsByReceipt.get(receipt.id) ?? [] }));
}

async function attachPurchaseReceiptSupplierPayments(
  client: DatabaseClient,
  organizationId: string,
  receipts: PurchaseReceiptData[],
): Promise<PurchaseReceiptData[]> {
  if (receipts.length === 0) return receipts;
  const receiptIds = receipts.map((receipt) => receipt.id);
  const { data, error } = await client
    .from("supplier_payment_allocations")
    .select("purchase_receipt_id, allocated_amount, supplier_payments(id, code, paid_at, created_by, payment_method, status)")
    .eq("organization_id", organizationId)
    .in("purchase_receipt_id", receiptIds)
    .order("created_at", { ascending: false });
  if (error !== null) throw error;

  const paymentsByReceipt = new Map<string, PurchaseReceiptData["supplier_payments"]>();
  for (const row of data ?? []) {
    const payment = Array.isArray(row.supplier_payments) ? row.supplier_payments[0] : row.supplier_payments;
    if (payment === null || payment === undefined) continue;
    paymentsByReceipt.set(row.purchase_receipt_id, [
      ...(paymentsByReceipt.get(row.purchase_receipt_id) ?? []),
      {
        id: payment.id,
        code: payment.code,
        paid_at: payment.paid_at,
        created_by: payment.created_by,
        payment_method: payment.payment_method as "cash" | "bank_transfer",
        status: payment.status as "posted" | "cancelled",
        amount: Number(row.allocated_amount),
      },
    ]);
  }

  return receipts.map((receipt) => ({
    ...receipt,
    supplier_payments: paymentsByReceipt.get(receipt.id) ?? [],
  }));
}

async function supplierPaymentAllocatedByReceipt(
  client: DatabaseClient,
  organizationId: string,
  receiptIds: string[],
): Promise<Map<string, number>> {
  const paidByReceipt = new Map<string, number>();
  if (receiptIds.length === 0) return paidByReceipt;

  const { data, error } = await client
    .from("supplier_payment_allocations")
    .select("purchase_receipt_id, allocated_amount, supplier_payments!inner(status)")
    .eq("organization_id", organizationId)
    .in("purchase_receipt_id", receiptIds)
    .eq("supplier_payments.status", "posted");
  if (error !== null) throw error;

  for (const row of data ?? []) {
    paidByReceipt.set(row.purchase_receipt_id, (paidByReceipt.get(row.purchase_receipt_id) ?? 0) + Number(row.allocated_amount));
  }
  return paidByReceipt;
}

function purchaseReceiptPayload(input: {
  code?: string;
  supplierId: string;
  receivedAt: string;
  supplierDocumentNo?: string | null;
  notes?: string | null;
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
}): Record<string, unknown> {
  return {
    code: input.code,
    supplier_id: input.supplierId,
    received_at: input.receivedAt,
    supplier_document_no: input.supplierDocumentNo,
    notes: input.notes,
    discount_amount: input.discountAmount,
    paid_amount: input.paidAmount,
    items: input.items.map((item) => ({
      product_id: item.productId,
      inventory_shape: item.inventoryShape ?? "normal",
      unit_name: item.unitName,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      discount_amount: item.discountAmount,
      physical_payload: item.physicalPayload ?? null,
    })),
  };
}

function toCheckoutResultData(value: unknown): CheckoutResultData {
  if (!isRecord(value) || !isRecord(value.order)) {
    throw new Error("CHECKOUT_RESULT_INVALID");
  }

  const paymentReceipt = isRecord(value.payment_receipt)
    ? {
      id: String(value.payment_receipt.id),
      code: String(value.payment_receipt.code),
      total_received_amount: Number(value.payment_receipt.total_received_amount),
    }
    : null;

  return {
    order: {
      id: String(value.order.id),
      code: String(value.order.code),
      order_type: "invoice",
      status: "completed",
      total_amount: Number(value.order.total_amount),
      paid_amount: Number(value.order.paid_amount),
      debt_amount: Number(value.order.debt_amount),
      payment_status: String(value.order.payment_status) as "unpaid" | "partial" | "paid",
    },
    payment_receipt: paymentReceipt,
    inventory_warnings: Array.isArray(value.inventory_warnings)
      ? value.inventory_warnings.map((warning) => {
        if (!isRecord(warning)) throw new Error("CHECKOUT_RESULT_INVALID");
        return {
          product_id: String(warning.product_id),
          code: String(warning.code),
          message: String(warning.message),
        };
      })
      : [],
  };
}

function toQuoteSummaryData(value: unknown): QuoteSummaryData {
  if (!isRecord(value) || !isRecord(value.order)) {
    throw new Error("QUOTE_RESULT_INVALID");
  }

  return {
    id: String(value.order.id),
    code: String(value.order.code),
    order_type: "quote",
    status: String(value.order.status) as QuoteSummaryData["status"],
    total_amount: Number(value.order.total_amount),
  };
}

function toMaterialOpeningResult(value: unknown): MaterialOpeningResultData {
  if (!isRecord(value)) throw new Error("MATERIAL_OPENING_RESULT_INVALID");
  return {
    id: String(value.id),
    product_id: String(value.product_id),
    inventory_shape: "normal",
    source_type: "manual_normal",
    opened_unit_id: String(value.opened_unit_id),
    opened_qty: Number(value.opened_qty),
    opened_stock_qty: Number(value.opened_stock_qty),
    stock_movement_id: typeof value.stock_movement_id === "string" ? value.stock_movement_id : null,
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
    created_at: String(value.created_at),
  };
}

function customerSnapshot(value: unknown): { id: string | null; code: string | null; name: string; phone: string | null } {
  const snapshot = isRecord(value) ? value : {};
  if (snapshot.type === "retail") return { id: null, code: null, name: "Khách lẻ", phone: null };
  return {
    id: typeof snapshot.id === "string" ? snapshot.id : null,
    code: typeof snapshot.code === "string" ? snapshot.code : null,
    name: typeof snapshot.name === "string" ? snapshot.name : "Khách lẻ",
    phone: typeof snapshot.phone === "string" ? snapshot.phone : null,
  };
}

async function loadQuoteReopenPayload(
  client: DatabaseClient,
  organizationId: string,
  quoteId: string,
): Promise<QuoteReopenPayloadData | null> {
  const { data: quote, error: quoteError } = await client
    .from("orders")
    .select("id, code, status, customer_id, customer_snapshot, price_list_id, subtotal_amount, discount_amount, total_amount, note")
    .eq("organization_id", organizationId)
    .eq("id", quoteId)
    .eq("order_type", "quote")
    .maybeSingle();
  if (quoteError !== null) throw quoteError;
  if (quote === null) return null;

  const { data: itemRows, error: itemsError } = await client
    .from("order_items")
    .select("id, product_id, product_snapshot, quantity, width_m, height_m, linear_m, unit_price, discount_amount, price_source, note")
    .eq("organization_id", organizationId)
    .eq("order_id", quoteId)
    .order("line_no", { ascending: true });
  if (itemsError !== null) throw itemsError;

  const productIds = [...new Set((itemRows ?? []).map((row) => row.product_id).filter((id): id is string => typeof id === "string"))];
  const products = await loadProductsById(client, organizationId, productIds);
  const defaultPrices = await loadDefaultPrices(client, organizationId, productIds);
  const customer = customerSnapshot(quote.customer_snapshot);
  const customerWarnings = await loadCustomerWarnings(client, organizationId, quote.customer_id, customer);
  const priceListInfo = await loadQuotePriceListInfo(client, organizationId, quote.price_list_id);

  return {
    quote: {
      id: quote.id,
      code: quote.code,
      status: quote.status as QuoteReopenPayloadData["quote"]["status"],
    },
    customer: {
      customer_id: quote.customer_id,
      snapshot: {
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
      },
      warnings: customerWarnings,
    },
    price_list: priceListInfo,
    items: (itemRows ?? []).map((row) => {
      const snapshot = isRecord(row.product_snapshot) ? row.product_snapshot : {};
      const product = typeof row.product_id === "string" ? products.get(row.product_id) : undefined;
      const warnings: QuoteReopenPayloadData["items"][number]["warnings"] = [];

      if (typeof row.product_id !== "string" || product === undefined) {
        warnings.push({ code: "PRODUCT_MISSING", message: "Product is no longer available." });
      } else if (product.status !== "active") {
        warnings.push({ code: "PRODUCT_INACTIVE", message: "Product is inactive." });
      }

      const currentPrice = typeof row.product_id === "string" ? defaultPrices.get(row.product_id) : undefined;
      if (currentPrice !== undefined && currentPrice !== Number(row.unit_price)) {
        warnings.push({ code: "CURRENT_PRICE_DIFFERS", message: "Current price differs from quote snapshot." });
      }

      return {
        order_item_id: row.id,
        product_id: row.product_id,
        product_snapshot: {
          code: String(snapshot.code ?? ""),
          name: String(snapshot.name ?? ""),
          unit_name: String(snapshot.unit_name ?? ""),
          sell_method: String(snapshot.sell_method ?? "quantity") as QuoteReopenPayloadData["items"][number]["product_snapshot"]["sell_method"],
        },
        quantity: Number(row.quantity),
        width_m: row.width_m === null ? null : Number(row.width_m),
        height_m: row.height_m === null ? null : Number(row.height_m),
        linear_m: row.linear_m === null ? null : Number(row.linear_m),
        unit_price: Number(row.unit_price),
        discount_amount: Number(row.discount_amount),
        price_source: String(row.price_source),
        note: row.note,
        warnings,
      };
    }),
    summary: {
      subtotal_amount: Number(quote.subtotal_amount),
      discount_amount: Number(quote.discount_amount),
      total_amount: Number(quote.total_amount),
    },
    note: quote.note,
  };
}

async function loadSellerMap(client: DatabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const uniqueUserIds = [...new Set(userIds.filter((id) => id.length > 0))];
  if (uniqueUserIds.length === 0) return new Map();
  const { data, error } = await client
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", uniqueUserIds);
  if (error !== null) throw error;
  return new Map((data ?? []).map((row) => [row.user_id, row.display_name]));
}

async function loadProductsById(
  client: DatabaseClient,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, { id: string; status: ProductData["status"] }>> {
  if (productIds.length === 0) return new Map();
  const { data, error } = await client
    .from("products")
    .select("id, status")
    .eq("organization_id", organizationId)
    .in("id", productIds);
  if (error !== null) throw error;
  return new Map((data ?? []).map((row) => [row.id, { id: row.id, status: row.status as ProductData["status"] }]));
}

async function loadDefaultPrices(
  client: DatabaseClient,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const { data: defaultPriceList, error: priceListError } = await client
    .from("price_lists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (priceListError !== null) throw priceListError;
  if (defaultPriceList === null) return new Map();

  const { data, error } = await client
    .from("price_list_items")
    .select("product_id, unit_price")
    .eq("organization_id", organizationId)
    .eq("price_list_id", defaultPriceList.id)
    .in("product_id", productIds);
  if (error !== null) throw error;
  return new Map((data ?? []).map((row) => [row.product_id, Number(row.unit_price)]));
}

async function loadCustomerWarnings(
  client: DatabaseClient,
  organizationId: string,
  customerId: string | null,
  snapshot: { code: string | null; name: string; phone: string | null },
): Promise<QuoteReopenPayloadData["customer"]["warnings"]> {
  if (customerId === null) return [];
  const { data, error } = await client
    .from("customers")
    .select("code, name, phone")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();
  if (error !== null) throw error;
  if (
    data === null ||
    data.code !== snapshot.code ||
    data.name !== snapshot.name ||
    data.phone !== snapshot.phone
  ) {
    return [{ code: "CUSTOMER_CHANGED", message: "Customer information changed after quote was saved." }];
  }
  return [];
}

async function loadQuotePriceListInfo(
  client: DatabaseClient,
  organizationId: string,
  priceListId: string | null,
): Promise<QuoteReopenPayloadData["price_list"]> {
  if (priceListId === null) {
    return {
      price_list_id: null,
      snapshot: { code: null, name: null },
      warnings: [],
    };
  }

  const { data, error } = await client
    .from("price_lists")
    .select("code, name, is_active")
    .eq("organization_id", organizationId)
    .eq("id", priceListId)
    .maybeSingle();
  if (error !== null) throw error;

  return {
    price_list_id: priceListId,
    snapshot: {
      code: data?.code ?? null,
      name: data?.name ?? null,
    },
    warnings: data === null || data.is_active !== true
      ? [{ code: "PRICE_LIST_INACTIVE", message: "Price list is inactive." }]
      : [],
  };
}

function toSalesDocumentListItem(
  row: Record<string, unknown>,
  sellers: Map<string, string>,
): SalesDocumentListItemData {
  const createdBy = String(row.created_by ?? "");
  return {
    id: String(row.id),
    code: String(row.code),
    order_type: String(row.order_type) as "quote" | "invoice",
    status: String(row.status) as "active" | "converted" | "completed" | "cancelled",
    created_at: String(row.created_at),
    customer: customerSnapshot(row.customer_snapshot),
    seller: { id: createdBy, name: sellers.get(createdBy) ?? createdBy },
    subtotal_amount: Number(row.subtotal_amount),
    discount_amount: Number(row.discount_amount),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    debt_amount: Number(row.debt_amount),
    payment_status: String(row.payment_status) as "not_applicable" | "unpaid" | "partial" | "paid",
    note: row.note === null ? null : String(row.note ?? ""),
  };
}

async function loadSalesDocumentOrderIdsByPaymentMethod(
  client: DatabaseClient,
  organizationId: string,
  paymentMethod: "cash" | "bank_transfer",
): Promise<string[]> {
  const { data, error } = await client
    .from("payment_receipts")
    .select("order_id, payment_receipt_methods!inner(method_type)")
    .eq("organization_id", organizationId)
    .eq("status", "posted")
    .not("order_id", "is", null)
    .eq("payment_receipt_methods.method_type", paymentMethod);
  if (error !== null) throw error;

  return Array.from(new Set((data ?? []).map((row) => String(row.order_id)).filter((orderId) => orderId.length > 0)));
}

async function loadSalesDocumentItems(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<SalesDocumentDetailData["items"]> {
  const { data, error } = await client
    .from("order_items")
    .select("id, line_no, product_id, product_snapshot, quantity, width_m, height_m, linear_m, unit_price, line_subtotal_amount, discount_amount, line_total, price_source, note")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("line_no", { ascending: true });
  if (error !== null) throw error;
  return (data ?? []).map((row) => {
    const snapshot = isRecord(row.product_snapshot) ? row.product_snapshot : {};
    return {
      id: row.id,
      line_no: Number(row.line_no),
      product: {
        id: row.product_id,
        code: String(snapshot.code ?? ""),
        name: String(snapshot.name ?? ""),
        unit_name: String(snapshot.unit_name ?? ""),
        sell_method: String(snapshot.sell_method ?? "quantity") as SalesDocumentDetailData["items"][number]["product"]["sell_method"],
      },
      quantity: Number(row.quantity),
      width_m: row.width_m === null ? null : Number(row.width_m),
      height_m: row.height_m === null ? null : Number(row.height_m),
      linear_m: row.linear_m === null ? null : Number(row.linear_m),
      unit_price: Number(row.unit_price),
      line_subtotal_amount: Number(row.line_subtotal_amount),
      discount_amount: Number(row.discount_amount),
      line_total: Number(row.line_total),
      price_source: row.price_source,
      note: row.note,
    };
  });
}

async function loadSalesDocumentPaymentReceipts(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<SalesDocumentDetailData["payment_receipts"]> {
  const { data, error } = await client
    .from("payment_receipts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error !== null) throw error;
  const receipts = await Promise.all((data ?? []).map((row) => loadPaymentReceiptDetail(client, organizationId, row.id)));
  return receipts.filter((receipt): receipt is PaymentReceiptDetailData => receipt !== null).map((receipt) => ({
    id: receipt.id,
    code: receipt.code,
    status: receipt.status,
    receipt_type: receipt.receipt_type,
    total_received_amount: receipt.total_received_amount,
    created_at: receipt.created_at,
    created_by: receipt.created_by,
    methods: receipt.methods,
    allocations: receipt.allocations,
  }));
}

async function loadSalesDocumentDebtEntries(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<SalesDocumentDetailData["debt_entries"]> {
  const { data, error } = await client
    .from("customer_debt_entries")
    .select("id, entry_type, amount_delta, balance_after_order, balance_after_customer, created_at")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error !== null) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    entry_type: row.entry_type,
    amount_delta: Number(row.amount_delta),
    balance_after_order: Number(row.balance_after_order),
    balance_after_customer: Number(row.balance_after_customer),
    created_at: row.created_at,
  }));
}

async function loadSalesDocumentStockMovements(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<StockMovementData[]> {
  const { data, error } = await client
    .from("stock_movements")
    .select("id, product_id, movement_type, quantity_delta, created_at")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error !== null) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    movement_type: row.movement_type,
    quantity_delta: Number(row.quantity_delta),
    created_at: row.created_at,
  }));
}

async function loadSalesDocumentHistory(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<SalesDocumentDetailData["history"]> {
  const { data, error } = await client
    .from("order_status_history")
    .select("to_status, reason, changed_by, changed_at")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });
  if (error !== null) throw error;
  return await Promise.all((data ?? []).map(async (row) => ({
    at: row.changed_at,
    action: row.to_status,
    actor_name: await loadProfileName(client, row.changed_by),
    note: row.reason,
  })));
}

async function loadSalesDocumentPriceList(
  client: DatabaseClient,
  organizationId: string,
  priceListId: string | null,
): Promise<SalesDocumentDetailData["price_list"]> {
  if (priceListId === null) return null;
  const { data, error } = await client
    .from("price_lists")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("id", priceListId)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

async function hydrateCashbookEntry(
  client: DatabaseClient,
  organizationId: string,
  row: Record<string, unknown>,
): Promise<CashbookEntryData> {
  const account = Array.isArray(row.finance_accounts) ? row.finance_accounts[0] : row.finance_accounts;
  let code = String(row.id);
  let note = row.description === null ? null : String(row.description ?? "");
  let counterparty: CashbookEntryData["counterparty"] = { type: "none", name: null, phone: null };

  if (row.source_type === "payment_receipt_method" && typeof row.payment_receipt_method_id === "string") {
    const receipt = await loadReceiptForPaymentMethod(client, organizationId, row.payment_receipt_method_id);
    if (receipt !== null) {
      code = receipt.code;
      note = note || `Thu ${receipt.code}`;
      const receiptDetail = await loadPaymentReceiptDetail(client, organizationId, receipt.id);
      const noteCustomer = receiptDetail?.customer == null
        ? await loadOrderCustomerRefFromCashbookNote(client, organizationId, note)
        : null;
      const customer = receiptDetail?.customer ?? noteCustomer;
      counterparty = {
        type: customer == null ? "none" : "customer",
        name: customer?.name ?? null,
        phone: null,
      };
    }
  }

  if (row.source_type === "cashbook_voucher" && typeof row.cashbook_voucher_id === "string") {
    const { data: voucher, error } = await client
      .from("cashbook_vouchers")
      .select("code, reason, counterparty_type, counterparty_name, counterparty_phone")
      .eq("id", row.cashbook_voucher_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error !== null) throw error;
    if (voucher !== null) {
      code = voucher.code;
      note = voucher.reason;
      counterparty = {
        type: voucher.counterparty_type,
        name: voucher.counterparty_name,
        phone: voucher.counterparty_phone,
      };
    }
  }

  return {
    id: String(row.id),
    code,
    status: String(row.status) as "posted" | "cancelled",
    direction: String(row.direction) as "in" | "out",
    amount_delta: Number(row.amount_delta),
    finance_account: toFinanceAccountRef(account),
    is_business_accounted: row.is_business_accounted !== false,
    source_type: String(row.source_type) as "payment_receipt_method" | "cashbook_voucher",
    created_at: String(row.entry_time ?? row.created_at),
    note,
    counterparty,
  };
}

async function hydrateCashbookEntryDetail(
  client: DatabaseClient,
  organizationId: string,
  row: Record<string, unknown>,
): Promise<CashbookEntryDetailData> {
  const base = await hydrateCashbookEntry(client, organizationId, row);
  const createdBy = await loadProfileName(client, String(row.created_by));
  const detail: CashbookEntryDetailData = {
    ...base,
    created_by: { id: String(row.created_by), name: createdBy },
    payment_method: "manual",
    source: { type: "manual_voucher", id: String(row.cashbook_voucher_id ?? ""), code: base.code, order_code: null },
    allocations: [],
  };

  if (row.source_type === "payment_receipt_method" && typeof row.payment_receipt_method_id === "string") {
    const receiptRow = await loadReceiptForPaymentMethod(client, organizationId, row.payment_receipt_method_id);
    if (receiptRow !== null) {
      const receipt = await loadPaymentReceiptDetail(client, organizationId, receiptRow.id);
      detail.payment_method = receiptRow.method_type as "cash" | "bank_transfer";
      detail.source = {
        type: "payment_receipt",
        id: receiptRow.id,
        code: receiptRow.code,
        order_code: receipt?.source_order?.code ?? cashbookDocumentCodeFromNote(base.note),
      };
      const receiptCounterparty = receipt?.customer == null
        ? null
        : { type: "customer" as const, name: receipt.customer.name, phone: null };
      detail.counterparty = {
        ...(receiptCounterparty ?? base.counterparty),
      };
      detail.allocations = receipt?.allocations ?? [];
      if (detail.allocations.length === 0) {
        const inferredAllocation = await loadCashbookNoteSaleAllocation(
          client,
          organizationId,
          base.note,
          Math.abs(base.amount_delta),
        );
        if (inferredAllocation !== null) detail.allocations = [inferredAllocation];
      }
    }
  }

  if (row.source_type === "cashbook_voucher" && typeof row.cashbook_voucher_id === "string") {
    const { data: voucher, error } = await client
      .from("cashbook_vouchers")
      .select("id, code, counterparty_type, counterparty_name, counterparty_phone")
      .eq("id", row.cashbook_voucher_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error !== null) throw error;
    if (voucher !== null) {
      detail.counterparty = {
        type: voucher.counterparty_type,
        name: voucher.counterparty_name,
        phone: voucher.counterparty_phone,
      };
      detail.source = { type: "manual_voucher", id: voucher.id, code: voucher.code, order_code: null };
    }
  }

  return detail;
}

async function loadReceiptForPaymentMethod(
  client: DatabaseClient,
  organizationId: string,
  paymentReceiptMethodId: string,
): Promise<{ id: string; code: string; method_type: string } | null> {
  const { data: method, error: methodError } = await client
    .from("payment_receipt_methods")
    .select("method_type, payment_receipt_id")
    .eq("id", paymentReceiptMethodId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (methodError !== null) throw methodError;
  if (method === null) return null;

  const { data: receipt, error: receiptError } = await client
    .from("payment_receipts")
    .select("id, code")
    .eq("id", method.payment_receipt_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (receiptError !== null) throw receiptError;
  return receipt === null ? null : { id: receipt.id, code: receipt.code, method_type: method.method_type };
}

async function loadPaymentReceiptDetail(
  client: DatabaseClient,
  organizationId: string,
  receiptId: string,
): Promise<PaymentReceiptDetailData | null> {
  const { data: receipt, error } = await client
    .from("payment_receipts")
    .select("id, code, status, receipt_type, customer_id, order_id, total_received_amount, sale_payment_amount, created_by, created_at")
    .eq("id", receiptId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  if (receipt === null) return null;

  const { data: methods, error: methodsError } = await client
    .from("payment_receipt_methods")
    .select("method_type, amount, finance_accounts(id, code, name)")
    .eq("payment_receipt_id", receipt.id)
    .eq("organization_id", organizationId)
    .order("line_no", { ascending: true });
  if (methodsError !== null) throw methodsError;

  const receiptCustomer = typeof receipt.customer_id === "string"
    ? await loadCustomerRef(client, organizationId, receipt.customer_id)
    : null;
  const sourceOrder = typeof receipt.order_id === "string"
    ? await loadOrderRef(client, organizationId, receipt.order_id)
    : null;
  const orderCustomer = receiptCustomer === null && typeof receipt.order_id === "string"
    ? await loadOrderCustomerRef(client, organizationId, receipt.order_id)
    : null;
  const customer = receiptCustomer ?? orderCustomer;
  const debtAllocations = await loadPaymentReceiptAllocations(client, organizationId, receipt.id);
  const salePaymentAmount = Number(receipt.sale_payment_amount) > 0
    ? Number(receipt.sale_payment_amount)
    : receipt.receipt_type === "sale_payment" ? Number(receipt.total_received_amount) : 0;
  const saleAllocation = typeof receipt.order_id === "string" && salePaymentAmount > 0
    ? await loadPaymentReceiptSaleAllocation(client, organizationId, receipt.order_id, salePaymentAmount)
    : null;

  return {
    id: receipt.id,
    code: receipt.code,
    status: receipt.status,
    receipt_type: receipt.receipt_type,
    total_received_amount: Number(receipt.total_received_amount),
    created_at: receipt.created_at,
    created_by: { id: String(receipt.created_by ?? ""), name: await loadProfileName(client, String(receipt.created_by ?? "")) },
    customer,
    source_order: sourceOrder,
    methods: (methods ?? []).map((method) => {
      const account = Array.isArray(method.finance_accounts) ? method.finance_accounts[0] : method.finance_accounts;
      return {
        method_type: method.method_type,
        amount: Number(method.amount),
        finance_account: {
          id: String(account?.id ?? ""),
          code: String(account?.code ?? ""),
          name: String(account?.name ?? ""),
        },
      };
    }),
    allocations: saleAllocation === null ? debtAllocations : [saleAllocation, ...debtAllocations],
  };
}

async function loadPaymentReceiptSaleAllocation(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
  allocatedAmount: number,
): Promise<PaymentReceiptAllocationData | null> {
  const order = await loadOrderRef(client, organizationId, orderId);
  return order === null ? null : paymentAllocationFromOrderSnapshot(order, allocatedAmount);
}

async function loadCashbookNoteSaleAllocation(
  client: DatabaseClient,
  organizationId: string,
  note: string | null,
  allocatedAmount: number,
): Promise<PaymentReceiptAllocationData | null> {
  const orderCode = cashbookDocumentCodeFromNote(note);
  if (orderCode === null || !orderCode.startsWith("HD")) return null;
  const order = await loadOrderRefByCode(client, organizationId, orderCode);
  return order === null ? null : paymentAllocationFromOrderSnapshot(order, allocatedAmount);
}

async function loadPaymentReceiptAllocations(
  client: DatabaseClient,
  organizationId: string,
  receiptId: string,
): Promise<PaymentReceiptAllocationData[]> {
  const { data, error } = await client
    .from("customer_debt_allocations")
    .select("order_id, allocated_amount, order_debt_before, order_debt_after")
    .eq("payment_receipt_id", receiptId)
    .eq("organization_id", organizationId)
    .order("line_no", { ascending: true });
  if (error !== null) throw error;

  return await Promise.all((data ?? []).map(async (allocation) => {
    const order = await loadOrderRef(client, organizationId, allocation.order_id);
    return {
      order_id: allocation.order_id,
      order_code: order?.code ?? "",
      order_total_amount: order?.total_amount ?? 0,
      collected_before: Math.max(Number(allocation.order_debt_before) - Number(allocation.allocated_amount), 0),
      allocated_amount: Number(allocation.allocated_amount),
      remaining_after: Number(allocation.order_debt_after),
    };
  }));
}

async function loadCustomerRef(
  client: DatabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ id: string; code: string; name: string } | null> {
  const { data, error } = await client
    .from("customers")
    .select("id, code, name")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

async function loadOrderRef(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<{ id: string; code: string; total_amount: number; paid_amount: number; debt_amount: number } | null> {
  const { data, error } = await client
    .from("orders")
    .select("id, code, total_amount, paid_amount, debt_amount")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  return data === null ? null : {
    id: data.id,
    code: data.code,
    total_amount: Number(data.total_amount),
    paid_amount: Number(data.paid_amount),
    debt_amount: Number(data.debt_amount),
  };
}

async function loadOrderRefByCode(
  client: DatabaseClient,
  organizationId: string,
  orderCode: string,
): Promise<{ id: string; code: string; total_amount: number; paid_amount: number; debt_amount: number } | null> {
  const { data, error } = await client
    .from("orders")
    .select("id, code, total_amount, paid_amount, debt_amount")
    .eq("code", orderCode)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  return data === null ? null : {
    id: data.id,
    code: data.code,
    total_amount: Number(data.total_amount),
    paid_amount: Number(data.paid_amount),
    debt_amount: Number(data.debt_amount),
  };
}

function paymentAllocationFromOrderSnapshot(
  order: { id: string; code: string; total_amount: number; paid_amount: number; debt_amount: number },
  allocatedAmount: number,
): PaymentReceiptAllocationData {
  const amount = Math.max(allocatedAmount, 0);
  return {
    order_id: order.id,
    order_code: order.code,
    order_total_amount: order.total_amount,
    collected_before: Math.max(order.paid_amount - amount, 0),
    allocated_amount: amount,
    remaining_after: Math.max(order.debt_amount, 0),
  };
}

async function loadOrderCustomerRef(
  client: DatabaseClient,
  organizationId: string,
  orderId: string,
): Promise<{ id: string | null; code: string | null; name: string } | null> {
  const { data, error } = await client
    .from("orders")
    .select("customer_snapshot")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) return null;
  const customer = customerSnapshot(data.customer_snapshot);
  return { id: customer.id, code: customer.code, name: customer.name };
}

async function loadOrderCustomerRefFromCashbookNote(
  client: DatabaseClient,
  organizationId: string,
  note: string | null,
): Promise<{ id: string | null; code: string | null; name: string } | null> {
  const orderCode = cashbookDocumentCodeFromNote(note);
  if (orderCode === null || !orderCode.startsWith("HD")) return null;
  const { data, error } = await client
    .from("orders")
    .select("customer_snapshot")
    .eq("code", orderCode)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) return null;
  const customer = customerSnapshot(data.customer_snapshot);
  return { id: customer.id, code: customer.code, name: customer.name };
}

function cashbookDocumentCodeFromNote(note: string | null): string | null {
  const match = note?.match(/\b(?:HD|PN)\d+(?:\.\d+)?\b/i);
  return match?.[0].toUpperCase() ?? null;
}

async function loadProfileName(client: DatabaseClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error !== null) throw error;
  return data?.display_name ?? "";
}

function toFinanceAccountRef(value: unknown): { id: string; code: string; name: string; account_type: "cash" | "bank" } {
  const account = isRecord(value) ? value : {};
  return {
    id: String(account.id ?? ""),
    code: String(account.code ?? ""),
    name: String(account.name ?? ""),
    account_type: String(account.account_type ?? "cash") as "cash" | "bank",
  };
}

async function loadCustomerDebtSummaries(
  client: DatabaseClient,
  organizationId: string,
): Promise<CustomerDebtSummaryData[]> {
  const invoices = await loadOpenDebtInvoices(client, organizationId);
  const byCustomer = new Map<string, CustomerDebtSummaryData>();

  for (const invoice of invoices) {
    if (invoice.customer_id === null) continue;
    const key = invoice.customer_id;
    const current = byCustomer.get(key) ?? {
      customer_id: invoice.customer_id,
      customer_code: invoice.customer_code,
      customer_name: invoice.customer_name,
      total_debt: 0,
      oldest_order_code: invoice.order_code,
      open_invoice_count: 0,
    };
    current.total_debt += invoice.remaining_debt;
    current.open_invoice_count += 1;
    current.oldest_order_code ??= invoice.order_code;
    byCustomer.set(key, current);
  }

  return [...byCustomer.values()]
    .filter((item) => item.total_debt > 0)
    .sort((left, right) => left.customer_name.localeCompare(right.customer_name, "vi"));
}

async function loadRetailDebtInvoices(
  client: DatabaseClient,
  organizationId: string,
  retailCustomerId: string,
): Promise<RetailDebtInvoiceData[]> {
  const invoices = await loadOpenDebtInvoices(client, organizationId, retailCustomerId);
  if (invoices.length === 0) return [];

  const { data, error } = await client
    .from("customer_debt_entries")
    .select("order_id, retail_debt_note, created_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", retailCustomerId)
    .eq("entry_type", "invoice_debt")
    .in("order_id", invoices.map((invoice) => invoice.order_id))
    .order("created_at", { ascending: false });
  if (error !== null) throw error;

  const noteByOrder = new Map<string, string | null>();
  for (const entry of data ?? []) {
    if (!noteByOrder.has(entry.order_id)) {
      noteByOrder.set(entry.order_id, entry.retail_debt_note ?? null);
    }
  }

  return invoices.map((invoice) => ({
    order_id: invoice.order_id,
    order_code: invoice.order_code,
    created_at: invoice.created_at,
    total_amount: invoice.total_amount,
    paid_amount: invoice.paid_amount,
    debt_amount: invoice.debt_amount,
    remaining_debt: invoice.remaining_debt,
    retail_debt_note: noteByOrder.get(invoice.order_id) ?? null,
  }));
}

async function loadOpenDebtInvoices(
  client: DatabaseClient,
  organizationId: string,
  customerId?: string,
  customerIds?: string[],
): Promise<Array<{
  order_id: string;
  order_code: string;
  created_at: string;
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  remaining_debt: number;
}>> {
  let orderQuery = client
    .from("orders")
    .select("id, code, customer_id, customer_snapshot, total_amount, paid_amount, debt_amount, created_at")
    .eq("organization_id", organizationId)
    .eq("order_type", "invoice")
    .eq("status", "completed")
    .gt("debt_amount", 0)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (customerId !== undefined) orderQuery = orderQuery.eq("customer_id", customerId);
  if (customerIds !== undefined && customerIds.length > 0) orderQuery = orderQuery.in("customer_id", customerIds);

  const { data: orders, error: ordersError } = await orderQuery;
  if (ordersError !== null) throw ordersError;
  if ((orders ?? []).length === 0) return [];

  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: allocations, error: allocationsError } = await client
    .from("customer_debt_allocations")
    .select("order_id, allocated_amount")
    .eq("organization_id", organizationId)
    .in("order_id", orderIds);
  if (allocationsError !== null) throw allocationsError;

  const allocatedByOrder = new Map<string, number>();
  for (const allocation of allocations ?? []) {
    allocatedByOrder.set(
      allocation.order_id,
      (allocatedByOrder.get(allocation.order_id) ?? 0) + Number(allocation.allocated_amount),
    );
  }

  return (orders ?? [])
    .map((order) => {
      const snapshot = isRecord(order.customer_snapshot) ? order.customer_snapshot : {};
      const debtAmount = Number(order.debt_amount);
      const remainingDebt = debtAmount - (allocatedByOrder.get(order.id) ?? 0);
      return {
        order_id: order.id,
        order_code: order.code,
        created_at: String(order.created_at),
        customer_id: order.customer_id,
        customer_code: typeof snapshot.code === "string" ? snapshot.code : null,
        customer_name: typeof snapshot.name === "string" ? snapshot.name : "Khách lẻ",
        total_amount: Number(order.total_amount),
        paid_amount: Number(order.paid_amount),
        debt_amount: debtAmount,
        remaining_debt: remainingDebt,
      };
    })
    .filter((invoice) => invoice.remaining_debt > 0);
}

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length };
}

function normalizePriceFormula(formula: Record<string, unknown>): PriceFormulaInput {
  if (typeof formula.name !== "string" || formula.name.trim().length < 1 || formula.name.trim().length > 120) {
    throw new Error("FORMULA_NAME_INVALID");
  }
  if (!isRecord(formula.product_filter)) throw new Error("FORMULA_PRODUCT_FILTER_INVALID");
  if (!isRecord(formula.cost_formula)) throw new Error("FORMULA_COST_INVALID");
  if (!isRecord(formula.profit_formula)) throw new Error("FORMULA_PROFIT_INVALID");
  if (!isRecord(formula.price_list_adjustments)) throw new Error("FORMULA_ADJUSTMENTS_INVALID");

  return {
    name: formula.name.trim(),
    product_filter: formula.product_filter,
    cost_formula: formula.cost_formula as unknown as PriceFormulaCost,
    profit_formula: formula.profit_formula as unknown as PriceFormulaProfit,
    price_list_adjustments: formula.price_list_adjustments as Record<string, PriceFormulaAdjustment>,
  };
}

function normalizePriceListAdjustments(
  adjustments: Record<string, PriceFormulaAdjustment>,
): Map<string, PriceFormulaAdjustment> {
  return new Map(Object.entries(adjustments).filter((entry): entry is [string, PriceFormulaAdjustment] =>
    isRecord(entry[1]) && (entry[1].type === "amount" || entry[1].type === "percent")
  ));
}

async function loadFormulaProducts(
  client: DatabaseClient,
  organizationId: string,
  productFilter: Record<string, unknown>,
): Promise<FormulaProductRow[]> {
  if ("group_id" in productFilter) throw new Error("FORMULA_PRODUCT_GROUP_UNSUPPORTED");
  if ("status" in productFilter && productFilter.status !== "active") throw new Error("FORMULA_STATUS_UNSUPPORTED");

  let query = client
    .from("products")
    .select("id, code, name, latest_purchase_cost")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("code", { ascending: true });

  const nameContains = typeof productFilter.name_contains === "string" ? productFilter.name_contains.trim() : "";
  if (nameContains !== "") {
    query = query.ilike("name", `%${escapeLike(nameContains)}%`);
  }
  const codeContains = typeof productFilter.code_contains === "string" ? productFilter.code_contains.trim() : "";
  if (codeContains !== "") {
    query = query.ilike("code", `%${escapeLike(codeContains)}%`);
  }
  if ("sell_method" in productFilter) {
    if (typeof productFilter.sell_method !== "string") throw new Error("FORMULA_SELL_METHOD_INVALID");
    query = query.eq("sell_method", productFilter.sell_method);
  }

  const { data, error } = await query;
  if (error !== null) throw error;
  return (data ?? []) as FormulaProductRow[];
}

async function loadFormulaPriceLists(
  client: DatabaseClient,
  organizationId: string,
): Promise<FormulaPriceListRow[]> {
  const { data, error } = await client
    .from("price_lists")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });
  if (error !== null) throw error;
  return (data ?? []) as FormulaPriceListRow[];
}

async function loadFormulaPriceItems(
  client: DatabaseClient,
  organizationId: string,
  productIds: string[],
  priceListIds: string[],
): Promise<Map<string, Map<string, FormulaPriceItemRow>>> {
  if (productIds.length === 0 || priceListIds.length === 0) return new Map();
  const { data, error } = await client
    .from("price_list_items")
    .select("product_id, price_list_id, unit_price, pricing_mode")
    .eq("organization_id", organizationId)
    .in("product_id", productIds)
    .in("price_list_id", priceListIds);
  if (error !== null) throw error;

  const itemsByProduct = new Map<string, Map<string, FormulaPriceItemRow>>();
  for (const row of (data ?? []) as FormulaPriceItemRow[]) {
    if (!itemsByProduct.has(row.product_id)) itemsByProduct.set(row.product_id, new Map());
    itemsByProduct.get(row.product_id)?.set(row.price_list_id, row);
  }
  return itemsByProduct;
}

async function loadPriceFormulaRules(
  client: DatabaseClient,
  organizationId: string,
  formulaRuleIds: string[],
): Promise<Map<string, PriceFormulaRuleRow>> {
  if (formulaRuleIds.length === 0) return new Map();
  const { data, error } = await client
    .from("price_formula_rules")
    .select("id, cost_formula, profit_formula, price_list_adjustments")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("id", formulaRuleIds);
  if (error !== null) throw error;

  return new Map((data ?? []).map((row) => [
    row.id,
    {
      cost_formula: row.cost_formula as unknown as PriceFormulaCost,
      profit_formula: row.profit_formula as unknown as PriceFormulaProfit,
      price_list_adjustments: row.price_list_adjustments as Record<string, PriceFormulaAdjustment>,
    },
  ]));
}

function uniqueFormulaSelections(
  items: Array<{ product_id: string; price_list_id: string }>,
): Array<{ product_id: string; price_list_id: string }> {
  const seen = new Set<string>();
  const uniqueItems = [];
  for (const item of items) {
    const key = `${item.product_id}:${item.price_list_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function escapeLike(value: string): string {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function hydrateInventoryProducts(
  client: DatabaseClient,
  organizationId: string,
  products: Array<{ id: string; code: string; name: string; status: "active" | "inactive" }>,
  inventoryShape?: "normal" | "roll" | "sheet",
): Promise<InventoryProductData[]> {
  const productIds = products.map((product) => product.id);
  if (productIds.length === 0) return [];

  const { data: settingsRows, error: settingsError } = await client
    .from("product_inventory_settings")
    .select("product_id, inventory_shape, stock_unit_id")
    .eq("organization_id", organizationId)
    .in("product_id", productIds);
  if (settingsError !== null) throw settingsError;

  const settingsByProduct = new Map((settingsRows ?? []).map((row) => [row.product_id, row]));
  const filteredProducts = inventoryShape === undefined
    ? products
    : products.filter((product) => settingsByProduct.get(product.id)?.inventory_shape === inventoryShape);
  const filteredProductIds = filteredProducts.map((product) => product.id);
  if (filteredProductIds.length === 0) return [];

  const stockUnitIds = [...new Set((settingsRows ?? []).map((row) => row.stock_unit_id).filter(isString))];
  const unitsById = new Map<string, string>();
  if (stockUnitIds.length > 0) {
    const { data: units, error: unitsError } = await client
      .from("inventory_units")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", stockUnitIds);
    if (unitsError !== null) throw unitsError;
    for (const unit of units ?? []) unitsById.set(unit.id, unit.name);
  }

  const { data: movements, error: movementsError } = await client
    .from("stock_movements")
    .select("product_id, quantity_delta")
    .eq("organization_id", organizationId)
    .in("product_id", filteredProductIds);
  if (movementsError !== null) throw movementsError;

  const qtyByProduct = new Map<string, number>();
  for (const movement of movements ?? []) {
    qtyByProduct.set(movement.product_id, (qtyByProduct.get(movement.product_id) ?? 0) + Number(movement.quantity_delta));
  }

  return filteredProducts.map((product) => {
    const settings = settingsByProduct.get(product.id);
    const availableQty = qtyByProduct.get(product.id) ?? 0;
    return {
      product_id: product.id,
      code: product.code,
      name: product.name,
      status: product.status,
      inventory_shape: settings?.inventory_shape ?? "normal",
      stock_unit: unitsById.get(settings?.stock_unit_id ?? "") ?? "đơn vị",
      available_qty: availableQty,
      is_negative: availableQty < 0,
    };
  });
}

async function loadPosMaterialShortagePreview(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
  quantity: number,
): Promise<PosMaterialShortagePreviewData | null> {
  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", productId)
    .maybeSingle();
  if (productError !== null) throw productError;
  if (product === null) return null;

  const requiredByProduct = new Map<string, number>();
  const bom = await loadProductBom(client, organizationId, productId);
  const source = bom !== null && bom.items.length > 0 ? "standard_bom" : "product";

  if (source === "standard_bom" && bom !== null) {
    for (const item of bom.items) {
      requiredByProduct.set(
        item.component_product_id,
        (requiredByProduct.get(item.component_product_id) ?? 0) + item.quantity * quantity,
      );
    }
  } else {
    requiredByProduct.set(productId, quantity);
  }

  const productIds = [...requiredByProduct.keys()];
  const { data: settingsRows, error: settingsError } = await client
    .from("product_inventory_settings")
    .select("product_id, inventory_shape, stock_unit_id")
    .eq("organization_id", organizationId)
    .in("product_id", productIds);
  if (settingsError !== null) throw settingsError;

  const settingsByProduct = new Map((settingsRows ?? []).map((row) => [row.product_id, row]));
  const normalProductIds = productIds.filter((id) => settingsByProduct.get(id)?.inventory_shape === "normal");
  const warnings = normalProductIds.length < productIds.length ? ["UNSUPPORTED_INVENTORY_SHAPE"] : [];
  if (normalProductIds.length === 0) {
    return {
      product_id: productId,
      quantity,
      source,
      ...(source === "standard_bom" && bom !== null ? { bom_id: bom.id } : {}),
      shortages: [],
      warnings,
    };
  }

  const { data: products, error: productsError } = await client
    .from("products")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .in("id", normalProductIds);
  if (productsError !== null) throw productsError;

  const stockUnitIds = [...new Set(
    normalProductIds.map((id) => settingsByProduct.get(id)?.stock_unit_id).filter(isString),
  )];
  const { data: units, error: unitsError } = stockUnitIds.length === 0
    ? { data: [], error: null }
    : await client
      .from("inventory_units")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .in("id", stockUnitIds);
  if (unitsError !== null) throw unitsError;

  const { data: movements, error: movementsError } = await client
    .from("stock_movements")
    .select("product_id, quantity_delta")
    .eq("organization_id", organizationId)
    .in("product_id", normalProductIds);
  if (movementsError !== null) throw movementsError;

  const availableByProduct = new Map<string, number>();
  for (const movement of movements ?? []) {
    availableByProduct.set(
      movement.product_id,
      (availableByProduct.get(movement.product_id) ?? 0) + Number(movement.quantity_delta),
    );
  }

  const shortagesProductIds = normalProductIds.filter((id) => {
    const requiredQty = requiredByProduct.get(id) ?? 0;
    const availableQty = availableByProduct.get(id) ?? 0;
    return requiredQty > availableQty;
  });
  const conversionsByProduct = await loadNormalMaterialOpeningConversions(
    client,
    organizationId,
    shortagesProductIds,
    settingsByProduct,
  );
  const productsById = new Map((products ?? []).map((row) => [row.id, row]));
  const unitsById = new Map((units ?? []).map((row) => [row.id, row]));

  return {
    product_id: productId,
    quantity,
    source,
    ...(source === "standard_bom" && bom !== null ? { bom_id: bom.id } : {}),
    shortages: shortagesProductIds.flatMap((id) => {
      const productRow = productsById.get(id);
      const settings = settingsByProduct.get(id);
      const stockUnit = unitsById.get(settings?.stock_unit_id ?? "");
      if (productRow === undefined || settings === undefined || stockUnit === undefined) return [];
      const requiredQty = requiredByProduct.get(id) ?? 0;
      const availableQty = availableByProduct.get(id) ?? 0;
      const conversionOptions = conversionsByProduct.get(id) ?? [];
      return [{
        product_id: id,
        code: productRow.code,
        name: productRow.name,
        required_qty: requiredQty,
        available_qty: availableQty,
        shortage_qty: requiredQty - availableQty,
        stock_unit: { id: stockUnit.id, code: stockUnit.code, name: stockUnit.name },
        inventory_shape: "normal" as const,
        quick_material_opening_supported: conversionOptions.length > 0,
        conversion_options: conversionOptions,
      }];
    }),
    warnings,
  };
}

async function loadNormalMaterialOpeningConversions(
  client: DatabaseClient,
  organizationId: string,
  productIds: string[],
  settingsByProduct: Map<string, { product_id: string; inventory_shape: string; stock_unit_id: string }>,
): Promise<Map<string, MaterialOpeningOptionsData["conversions"]>> {
  if (productIds.length === 0) return new Map();
  const { data: conversions, error: conversionError } = await client
    .from("product_unit_conversions")
    .select("product_id, sale_unit_id, stock_unit_id, stock_qty_per_sale_unit")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("product_id", productIds);
  if (conversionError !== null) throw conversionError;

  const filteredConversions = (conversions ?? []).filter((row) => {
    const settings = settingsByProduct.get(row.product_id);
    return settings !== undefined && row.stock_unit_id === settings.stock_unit_id;
  });
  const unitIds = [...new Set(filteredConversions.map((row) => row.sale_unit_id).filter(isString))];
  const unitsById = new Map<string, { code: string; name: string }>();
  if (unitIds.length > 0) {
    const { data: units, error: unitsError } = await client
      .from("inventory_units")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("id", unitIds);
    if (unitsError !== null) throw unitsError;
    for (const unit of units ?? []) unitsById.set(unit.id, { code: unit.code, name: unit.name });
  }

  const result = new Map<string, MaterialOpeningOptionsData["conversions"]>();
  for (const conversion of filteredConversions) {
    const unit = unitsById.get(conversion.sale_unit_id);
    if (unit === undefined) continue;
    const items = result.get(conversion.product_id) ?? [];
    items.push({
      unit_id: conversion.sale_unit_id,
      code: unit.code,
      name: unit.name,
      stock_qty_per_unit: Number(conversion.stock_qty_per_sale_unit),
    });
    result.set(conversion.product_id, items);
  }
  return result;
}

async function loadMaterialOpeningOptions(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
): Promise<MaterialOpeningOptionsData | null> {
  const { data: product, error: productError } = await client
    .from("products")
    .select("id, code, name, status")
    .eq("organization_id", organizationId)
    .eq("id", productId)
    .maybeSingle();
  if (productError !== null) throw productError;
  if (product === null) return null;

  const { data: settings, error: settingsError } = await client
    .from("product_inventory_settings")
    .select("inventory_shape, stock_unit_id")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .maybeSingle();
  if (settingsError !== null) throw settingsError;
  if (settings === null || !isString(settings.stock_unit_id)) return null;

  const { data: stockUnit, error: stockUnitError } = await client
    .from("inventory_units")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("id", settings.stock_unit_id)
    .maybeSingle();
  if (stockUnitError !== null) throw stockUnitError;
  if (stockUnit === null) return null;

  const { data: conversions, error: conversionError } = await client
    .from("product_unit_conversions")
    .select("sale_unit_id, stock_qty_per_sale_unit")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .eq("stock_unit_id", settings.stock_unit_id)
    .eq("is_active", true);
  if (conversionError !== null) throw conversionError;

  const conversionUnitIds = [...new Set((conversions ?? []).map((row) => row.sale_unit_id).filter(isString))];
  const unitsById = new Map<string, { code: string; name: string }>();
  if (conversionUnitIds.length > 0) {
    const { data: units, error: unitsError } = await client
      .from("inventory_units")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("id", conversionUnitIds);
    if (unitsError !== null) throw unitsError;
    for (const unit of units ?? []) unitsById.set(unit.id, { code: unit.code, name: unit.name });
  }

  return {
    product: {
      id: product.id,
      code: product.code,
      name: product.name,
      inventory_shape: settings.inventory_shape as "normal" | "roll" | "sheet",
      stock_unit: { id: stockUnit.id, code: stockUnit.code, name: stockUnit.name },
    },
    conversions: (conversions ?? [])
      .filter((row) => unitsById.has(row.sale_unit_id))
      .map((row) => {
        const unit = unitsById.get(row.sale_unit_id)!;
        return {
          unit_id: row.sale_unit_id,
          code: unit.code,
          name: unit.name,
          stock_qty_per_unit: Number(row.stock_qty_per_sale_unit),
        };
      }),
    warnings: settings.inventory_shape === "normal" && (conversions ?? []).length === 0 ? ["NO_ACTIVE_CONVERSION"] : [],
  };
}

async function loadProductBom(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
): Promise<ProductBomData | null> {
  const { data: bom, error: bomError } = await client
    .from("product_boms")
    .select("id, product_id, version, status, notes, created_at")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bomError !== null) throw bomError;
  if (bom === null) return null;

  const { data: rows, error: itemError } = await client
    .from("product_bom_items")
    .select("id, component_product_id, quantity, sort_order, notes")
    .eq("organization_id", organizationId)
    .eq("bom_id", bom.id)
    .order("sort_order", { ascending: true });
  if (itemError !== null) throw itemError;

  const componentIds = [...new Set((rows ?? []).map((row) => row.component_product_id).filter(isString))];
  const productsById = new Map<string, {
    id: string;
    code: string;
    name: string;
    unit_name: string;
    product_kind: ProductData["product_kind"];
    latest_purchase_cost: number | null;
  }>();
  if (componentIds.length > 0) {
    const { data: products, error: productError } = await client
      .from("products")
      .select("id, code, name, unit_name, product_kind, latest_purchase_cost")
      .eq("organization_id", organizationId)
      .in("id", componentIds);
    if (productError !== null) throw productError;
    for (const product of products ?? []) {
      productsById.set(product.id, {
        id: product.id,
        code: product.code,
        name: product.name,
        unit_name: product.unit_name,
        product_kind: product.product_kind as ProductData["product_kind"],
        latest_purchase_cost: product.latest_purchase_cost === null || product.latest_purchase_cost === undefined
          ? null
          : Number(product.latest_purchase_cost),
      });
    }
  }

  return {
    id: bom.id,
    product_id: bom.product_id,
    version: Number(bom.version),
    status: bom.status as "active" | "archived",
    notes: bom.notes,
    created_at: bom.created_at,
    items: (rows ?? []).map((row) => {
      const product = productsById.get(row.component_product_id);
      return {
        id: row.id,
        component_product_id: row.component_product_id,
        component_product: {
          id: product?.id ?? row.component_product_id,
          code: product?.code ?? "",
          name: product?.name ?? "",
          unit_name: product?.unit_name ?? "",
          product_kind: product?.product_kind,
          latest_purchase_cost: product?.latest_purchase_cost ?? null,
        },
        quantity: Number(row.quantity),
        sort_order: Number(row.sort_order),
        notes: row.notes,
      };
    }),
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

async function hydrateStocktakeAggregates(
  client: DatabaseClient,
  organizationId: string,
  rows: Array<Record<string, unknown>>,
): Promise<StocktakeData[]> {
  const stocktakeIds = rows.map((row) => String(row.id));
  if (stocktakeIds.length === 0) return [];

  const { data: itemRows, error: itemError } = await client
    .from("stocktake_items")
    .select("stocktake_id, product_id, actual_qty, difference_qty")
    .eq("organization_id", organizationId)
    .in("stocktake_id", stocktakeIds);
  if (itemError !== null) throw itemError;

  const productIds = [...new Set((itemRows ?? []).map((row) => row.product_id).filter(isString))];
  const costByProduct = new Map<string, number | null>();
  if (productIds.length > 0) {
    const { data: products, error: productError } = await client
      .from("products")
      .select("id, latest_purchase_cost")
      .eq("organization_id", organizationId)
      .in("id", productIds);
    if (productError !== null) throw productError;
    for (const product of products ?? []) {
      costByProduct.set(
        product.id,
        product.latest_purchase_cost === null || product.latest_purchase_cost === undefined ? null : Number(product.latest_purchase_cost),
      );
    }
  }

  const aggregates = new Map<string, {
    totalActualQty: number;
    totalActualValue: number | null;
    totalDifferenceValue: number | null;
    increasedQty: number;
    decreasedQty: number;
  }>();

  for (const item of itemRows ?? []) {
    const current = aggregates.get(item.stocktake_id) ?? {
      totalActualQty: 0,
      totalActualValue: 0,
      totalDifferenceValue: 0,
      increasedQty: 0,
      decreasedQty: 0,
    };
    const actualQty = Number(item.actual_qty);
    const differenceQty = Number(item.difference_qty);
    current.totalActualQty += actualQty;
    if (differenceQty > 0) current.increasedQty += differenceQty;
    if (differenceQty < 0) current.decreasedQty += Math.abs(differenceQty);

    const cost = costByProduct.get(item.product_id);
    if (cost === null || cost === undefined) {
      current.totalActualValue = null;
      current.totalDifferenceValue = null;
    } else {
      if (current.totalActualValue !== null) current.totalActualValue += actualQty * cost;
      if (current.totalDifferenceValue !== null) current.totalDifferenceValue += differenceQty * cost;
    }
    aggregates.set(item.stocktake_id, current);
  }

  return rows.map((row) => {
    const aggregate = aggregates.get(String(row.id)) ?? {
      totalActualQty: 0,
      totalActualValue: null,
      totalDifferenceValue: null,
      increasedQty: 0,
      decreasedQty: 0,
    };
    return {
      id: String(row.id),
      code: String(row.code),
      status: row.status as StocktakeData["status"],
      source_type: row.source_type as StocktakeData["source_type"],
      created_at: String(row.created_at),
      balanced_at: row.balanced_at === null || row.balanced_at === undefined ? null : String(row.balanced_at),
      total_actual_qty: aggregate.totalActualQty,
      total_actual_value: aggregate.totalActualValue,
      total_difference_value: aggregate.totalDifferenceValue,
      increased_qty: aggregate.increasedQty,
      decreased_qty: aggregate.decreasedQty,
      note: row.note === null || row.note === undefined ? null : String(row.note),
    };
  });
}

function mapInventoryRoll(row: Record<string, unknown>): InventoryRollData {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    code: String(row.code),
    width_m: Number(row.width_m),
    initial_length_m: Number(row.initial_length_m),
    remaining_length_m: Number(row.remaining_length_m),
    initial_area_m2: Number(row.initial_area_m2),
    remaining_area_m2: Number(row.remaining_area_m2),
    status: row.status as InventoryRollData["status"],
    note: row.note === null || row.note === undefined ? null : String(row.note),
    created_at: String(row.created_at),
  };
}

function mapInventorySheet(row: Record<string, unknown>): InventorySheetData {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    code: String(row.code),
    sheet_kind: row.sheet_kind as InventorySheetData["sheet_kind"],
    width_m: Number(row.width_m),
    length_m: Number(row.length_m),
    area_m2: Number(row.area_m2),
    status: row.status as InventorySheetData["status"],
    note: row.note === null || row.note === undefined ? null : String(row.note),
    created_at: String(row.created_at),
  };
}

async function insertObjectAdjustmentMovement(
  client: DatabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    quantityDelta: number;
    inventoryObjectType: "roll" | "sheet";
    inventoryRollId: string | null;
    inventorySheetId: string | null;
    reason: string;
  },
): Promise<void> {
  if (input.quantityDelta === 0) return;
  const { data: settings, error: settingsError } = await client
    .from("product_inventory_settings")
    .select("stock_unit_id")
    .eq("organization_id", input.organizationId)
    .eq("product_id", input.productId)
    .maybeSingle();
  if (settingsError !== null) throw settingsError;
  if (settings === null || settings.stock_unit_id === null) throw new Error("INVENTORY_SETTINGS_NOT_FOUND");

  const { error } = await client.from("stock_movements").insert({
    organization_id: input.organizationId,
    product_id: input.productId,
    movement_type: "manual_adjustment",
    quantity_delta: input.quantityDelta,
    stock_unit_id: settings.stock_unit_id,
    display_quantity: input.quantityDelta,
    display_unit_id: settings.stock_unit_id,
    inventory_object_type: input.inventoryObjectType,
    inventory_roll_id: input.inventoryRollId,
    inventory_sheet_id: input.inventorySheetId,
    reason: input.reason,
    created_by: input.actorUserId,
  });
  if (error !== null) throw error;
}

async function createRollMaterialOpening(
  client: DatabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    oldInventoryRollId?: string;
    oldRemainingLengthM?: number;
    note?: string;
  },
): Promise<MaterialOpeningResultData> {
  if (input.oldInventoryRollId === undefined || input.oldRemainingLengthM === undefined) {
    throw new Error("MATERIAL_OPENING_ROLL_INVALID");
  }
  const { data: roll, error: rollError } = await client
    .from("inventory_rolls")
    .select("id, product_id, width_m, remaining_length_m, remaining_area_m2")
    .eq("organization_id", input.organizationId)
    .eq("product_id", input.productId)
    .eq("id", input.oldInventoryRollId)
    .maybeSingle();
  if (rollError !== null) throw rollError;
  if (roll === null) throw new Error("INVENTORY_OBJECT_NOT_FOUND");

  const nextRemainingLength = input.oldRemainingLengthM;
  const nextRemainingArea = Number(roll.width_m) * nextRemainingLength;
  const opening = await insertMaterialOpeningLog(client, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    productId: input.productId,
    inventoryShape: "roll",
    oldInventoryRollId: input.oldInventoryRollId,
    oldInventorySheetId: null,
    oldSnapshot: {
      old_remaining_length_m: Number(roll.remaining_length_m),
      old_remaining_area_m2: Number(roll.remaining_area_m2),
    },
    inputPayload: {
      product_id: input.productId,
      inventory_shape: "roll",
      old_inventory_roll_id: input.oldInventoryRollId,
      old_remaining_length_m: nextRemainingLength,
      note: input.note ?? null,
    },
    resultPayload: {
      old_remaining_length_m: nextRemainingLength,
      old_remaining_area_m2: nextRemainingArea,
      stock_movement_id: null,
    },
    note: input.note,
  });

  const { error: updateError } = await client
    .from("inventory_rolls")
    .update({
      remaining_length_m: nextRemainingLength,
      remaining_area_m2: nextRemainingArea,
      status: nextRemainingLength === 0 ? "empty" : "in_use",
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.oldInventoryRollId);
  if (updateError !== null) throw updateError;

  const stockMovementId = await insertMaterialOpeningMovement(client, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    productId: input.productId,
    materialOpeningId: opening.id,
    quantityDelta: nextRemainingArea - Number(roll.remaining_area_m2),
    displayQuantity: nextRemainingArea - Number(roll.remaining_area_m2),
    displayUnitId: null,
    inventoryObjectType: "roll",
    inventoryRollId: input.oldInventoryRollId,
    inventorySheetId: null,
    reason: input.note ?? "Khui vật tư cuộn",
  });
  await updateMaterialOpeningResult(client, input.organizationId, opening.id, {
    old_remaining_length_m: nextRemainingLength,
    old_remaining_area_m2: nextRemainingArea,
    stock_movement_id: stockMovementId,
  });

  return {
    id: opening.id,
    product_id: input.productId,
    inventory_shape: "roll",
    source_type: "standard_object",
    opened_unit_id: null,
    opened_qty: null,
    opened_stock_qty: nextRemainingArea,
    stock_movement_id: stockMovementId,
    warnings: [],
    created_at: opening.createdAt,
  };
}

async function createSheetMaterialOpening(
  client: DatabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    oldInventorySheetId?: string;
    oldRemainingWidthM?: number;
    oldRemainingLengthMForSheet?: number;
    discardOldSheet?: boolean;
    note?: string;
  },
): Promise<MaterialOpeningResultData> {
  if (input.oldInventorySheetId === undefined) throw new Error("MATERIAL_OPENING_SHEET_INVALID");
  const { data: sheet, error: sheetError } = await client
    .from("inventory_sheets")
    .select("id, product_id, width_m, length_m, area_m2")
    .eq("organization_id", input.organizationId)
    .eq("product_id", input.productId)
    .eq("id", input.oldInventorySheetId)
    .maybeSingle();
  if (sheetError !== null) throw sheetError;
  if (sheet === null) throw new Error("INVENTORY_OBJECT_NOT_FOUND");

  const discard = input.discardOldSheet === true;
  if (!discard && (input.oldRemainingWidthM === undefined || input.oldRemainingLengthMForSheet === undefined)) {
    throw new Error("MATERIAL_OPENING_SHEET_INVALID");
  }
  const nextWidth = discard ? Number(sheet.width_m) : input.oldRemainingWidthM as number;
  const nextLength = discard ? Number(sheet.length_m) : input.oldRemainingLengthMForSheet as number;
  const nextArea = discard ? 0 : nextWidth * nextLength;
  const opening = await insertMaterialOpeningLog(client, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    productId: input.productId,
    inventoryShape: "sheet",
    oldInventoryRollId: null,
    oldInventorySheetId: input.oldInventorySheetId,
    oldSnapshot: {
      old_width_m: Number(sheet.width_m),
      old_length_m: Number(sheet.length_m),
      old_area_m2: Number(sheet.area_m2),
    },
    inputPayload: {
      product_id: input.productId,
      inventory_shape: "sheet",
      old_inventory_sheet_id: input.oldInventorySheetId,
      old_remaining_width_m: discard ? null : nextWidth,
      old_remaining_length_m: discard ? null : nextLength,
      discard_old_sheet: discard,
      note: input.note ?? null,
    },
    resultPayload: {
      old_remaining_area_m2: nextArea,
      stock_movement_id: null,
    },
    note: input.note,
  });

  const sheetPatch = discard
    ? { status: "discarded" }
    : { width_m: nextWidth, length_m: nextLength, area_m2: nextArea, status: "available" };
  const { error: updateError } = await client
    .from("inventory_sheets")
    .update(sheetPatch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.oldInventorySheetId);
  if (updateError !== null) throw updateError;

  const stockMovementId = await insertMaterialOpeningMovement(client, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    productId: input.productId,
    materialOpeningId: opening.id,
    quantityDelta: nextArea - Number(sheet.area_m2),
    displayQuantity: nextArea - Number(sheet.area_m2),
    displayUnitId: null,
    inventoryObjectType: "sheet",
    inventoryRollId: null,
    inventorySheetId: input.oldInventorySheetId,
    reason: input.note ?? "Khui vật tư tấm",
  });
  await updateMaterialOpeningResult(client, input.organizationId, opening.id, {
    old_remaining_area_m2: nextArea,
    stock_movement_id: stockMovementId,
  });

  return {
    id: opening.id,
    product_id: input.productId,
    inventory_shape: "sheet",
    source_type: "standard_object",
    opened_unit_id: null,
    opened_qty: null,
    opened_stock_qty: nextArea,
    stock_movement_id: stockMovementId,
    warnings: [],
    created_at: opening.createdAt,
  };
}

async function insertMaterialOpeningLog(
  client: DatabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    inventoryShape: "roll" | "sheet";
    oldInventoryRollId: string | null;
    oldInventorySheetId: string | null;
    oldSnapshot: Record<string, unknown>;
    inputPayload: Record<string, unknown>;
    resultPayload: Record<string, unknown>;
    note?: string;
  },
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await client
    .from("inventory_material_openings")
    .insert({
      organization_id: input.organizationId,
      product_id: input.productId,
      inventory_shape: input.inventoryShape,
      source_type: "standard_object",
      old_inventory_roll_id: input.oldInventoryRollId,
      old_inventory_sheet_id: input.oldInventorySheetId,
      old_snapshot: input.oldSnapshot,
      input_payload: input.inputPayload,
      result_payload: input.resultPayload,
      warning_codes: [],
      note: input.note ?? null,
      created_by: input.actorUserId,
    })
    .select("id, created_at")
    .single();
  if (error !== null) throw error;
  return { id: String(data.id), createdAt: String(data.created_at) };
}

async function updateMaterialOpeningResult(
  client: DatabaseClient,
  organizationId: string,
  materialOpeningId: string,
  resultPayload: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("inventory_material_openings")
    .update({ result_payload: resultPayload })
    .eq("organization_id", organizationId)
    .eq("id", materialOpeningId);
  if (error !== null) throw error;
}

async function insertMaterialOpeningMovement(
  client: DatabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    materialOpeningId: string;
    quantityDelta: number;
    displayQuantity: number;
    displayUnitId: string | null;
    inventoryObjectType: "roll" | "sheet";
    inventoryRollId: string | null;
    inventorySheetId: string | null;
    reason: string;
  },
): Promise<string | null> {
  if (input.quantityDelta === 0) return null;
  const { data: settings, error: settingsError } = await client
    .from("product_inventory_settings")
    .select("stock_unit_id")
    .eq("organization_id", input.organizationId)
    .eq("product_id", input.productId)
    .maybeSingle();
  if (settingsError !== null) throw settingsError;
  if (settings === null || settings.stock_unit_id === null) throw new Error("INVENTORY_SETTINGS_NOT_FOUND");

  const { data, error } = await client
    .from("stock_movements")
    .insert({
      organization_id: input.organizationId,
      product_id: input.productId,
      movement_type: "material_opening",
      quantity_delta: input.quantityDelta,
      stock_unit_id: settings.stock_unit_id,
      display_quantity: input.displayQuantity,
      display_unit_id: input.displayUnitId ?? settings.stock_unit_id,
      inventory_object_type: input.inventoryObjectType,
      inventory_roll_id: input.inventoryRollId,
      inventory_sheet_id: input.inventorySheetId,
      material_opening_id: input.materialOpeningId,
      reason: input.reason,
      created_by: input.actorUserId,
    })
    .select("id")
    .single();
  if (error !== null) throw error;
  return String(data.id);
}

async function loadCatalogProductUnitConversions(
  client: DatabaseClient,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, ProductData["unit_conversions"]>> {
  if (productIds.length === 0) return new Map();
  const { data: conversions, error } = await client
    .from("product_unit_conversions")
    .select("product_id, sale_unit_id, stock_qty_per_sale_unit, is_default_purchase_unit, is_default_sale_unit")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("product_id", productIds);
  if (error !== null) throw error;

  const unitIds = [...new Set((conversions ?? []).map((row) => row.sale_unit_id).filter(isString))];
  const unitsById = new Map<string, { name: string }>();
  if (unitIds.length > 0) {
    const { data: units, error: unitsError } = await client
      .from("inventory_units")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("id", unitIds);
    if (unitsError !== null) throw unitsError;
    for (const unit of units ?? []) unitsById.set(unit.id, { name: unit.name });
  }

  const result = new Map<string, ProductData["unit_conversions"]>();
  for (const conversion of conversions ?? []) {
    const unit = unitsById.get(conversion.sale_unit_id);
    if (unit === undefined) continue;
    const items = result.get(conversion.product_id) ?? [];
    items.push({
      unit_id: conversion.sale_unit_id,
      unit_name: unit.name,
      stock_qty_per_unit: Number(conversion.stock_qty_per_sale_unit),
      is_default_purchase_unit: Boolean(conversion.is_default_purchase_unit),
      is_default_sale_unit: Boolean(conversion.is_default_sale_unit),
    });
    result.set(conversion.product_id, items);
  }
  return result;
}

async function replaceProductUnitConversions(
  client: DatabaseClient,
  input: {
    organizationId: string;
    productId: string;
    stockUnitId: string;
    sellMethod: "quantity" | "area_m2" | "linear_m" | "sheet" | "combo";
    unitConversions: Array<{
      unitName: string;
      stockQtyPerUnit: number;
      isDefaultPurchaseUnit: boolean;
      isDefaultSaleUnit: boolean;
    }>;
  },
): Promise<void> {
  const { error: deactivateError } = await client
    .from("product_unit_conversions")
    .update({ is_active: false, is_default_purchase_unit: false, is_default_sale_unit: false })
    .eq("organization_id", input.organizationId)
    .eq("product_id", input.productId);
  if (deactivateError !== null) throw deactivateError;

  for (const conversion of input.unitConversions) {
    const saleUnitId = await ensureInventoryUnit(client, input.organizationId, conversion.unitName, input.sellMethod);
    const { error } = await client
      .from("product_unit_conversions")
      .upsert({
        organization_id: input.organizationId,
        product_id: input.productId,
        sale_unit_id: saleUnitId,
        stock_unit_id: input.stockUnitId,
        stock_qty_per_sale_unit: conversion.stockQtyPerUnit,
        is_active: true,
        is_default_purchase_unit: conversion.isDefaultPurchaseUnit,
        is_default_sale_unit: conversion.isDefaultSaleUnit,
      }, { onConflict: "organization_id,product_id,sale_unit_id" });
    if (error !== null) throw error;
  }
}

function mapProductRow(row: Record<string, unknown>): ProductData {
  const group = firstRelation(row.product_groups as { id: string; code: string; name: string } | Array<{ id: string; code: string; name: string }> | null | undefined);
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: row.status as ProductData["status"],
    product_kind: row.product_kind as ProductData["product_kind"],
    unit_name: String(row.unit_name),
    sell_method: row.sell_method as ProductData["sell_method"],
    latest_purchase_cost: row.latest_purchase_cost === null || row.latest_purchase_cost === undefined
      ? null
      : Number(row.latest_purchase_cost),
    latest_purchase_cost_at: row.latest_purchase_cost_at === null || row.latest_purchase_cost_at === undefined
      ? null
      : String(row.latest_purchase_cost_at),
    product_group_id: row.product_group_id === null || row.product_group_id === undefined
      ? null
      : String(row.product_group_id),
    product_group: group,
  };
}

async function ensureDefaultProductGroup(client: DatabaseClient, organizationId: string): Promise<string> {
  const { data: existing, error: existingError } = await client
    .from("product_groups")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (existingError !== null) throw existingError;
  if (existing?.id !== undefined) return existing.id;

  const { data: created, error: createError } = await client
    .from("product_groups")
    .insert({
      organization_id: organizationId,
      code: "GENERAL",
      name: "Giá chung",
      is_default: true,
      is_active: true,
    })
    .select("id")
    .single();
  if (createError !== null) throw createError;
  return created.id;
}

function productGroupCodeFromName(name: string): string {
  const code = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return code || "GROUP";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function ensureInventoryUnit(
  client: DatabaseClient,
  organizationId: string,
  unitName: string,
  sellMethod: "quantity" | "area_m2" | "linear_m" | "sheet" | "combo",
): Promise<string> {
  const normalizedName = unitName.trim() || "đơn vị";
  const code = normalizedName.slice(0, 30).toUpperCase();
  const { data: existing, error: existingError } = await client
    .from("inventory_units")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .maybeSingle();
  if (existingError !== null) throw existingError;
  if (existing?.id !== undefined) return existing.id;

  const { data: created, error: createError } = await client
    .from("inventory_units")
    .insert({
      organization_id: organizationId,
      code,
      name: normalizedName.slice(0, 60),
      unit_kind: inventoryUnitKindForSellMethod(sellMethod),
      decimal_precision: sellMethod === "quantity" || sellMethod === "sheet" || sellMethod === "combo" ? 0 : 3,
      is_active: true,
    })
    .select("id")
    .single();
  if (createError !== null) throw createError;
  return created.id;
}

function inventoryUnitKindForSellMethod(
  sellMethod: "quantity" | "area_m2" | "linear_m" | "sheet" | "combo",
): "quantity" | "length" | "area" | "package" {
  if (sellMethod === "area_m2") return "area";
  if (sellMethod === "linear_m") return "length";
  if (sellMethod === "combo") return "package";
  return "quantity";
}

async function hydrateUser(
  client: DatabaseClient,
  row: {
    user_id: string;
    display_name: string;
    username?: string | null;
    phone?: string | null;
    email?: string | null;
    birthday?: string | null;
    region?: string | null;
    ward?: string | null;
    address?: string | null;
    note?: string | null;
    status: "active" | "inactive";
  },
  email: string,
): Promise<UserListItem> {
  const { data: permissionRows, error } = await client
    .from("user_permissions")
    .select("permission_code")
    .eq("user_id", row.user_id)
    .order("permission_code", { ascending: true });
  if (error !== null) throw error;
  return {
    id: row.user_id,
    email: row.email ?? email,
    username: row.username ?? null,
    phone: row.phone ?? null,
    birthday: row.birthday ?? null,
    region: row.region ?? null,
    ward: row.ward ?? null,
    address: row.address ?? null,
    note: row.note ?? null,
    display_name: row.display_name,
    status: row.status,
    permissions: (permissionRows ?? []).map((permission) => permission.permission_code as PermissionCode),
  };
}

export function createSupabaseRepositoryFromEnv(): FoundationRepository {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (url === undefined || serviceRoleKey === undefined) {
    throw new Error("Supabase API environment variables are required.");
  }

  return createFoundationRepository(createClient(url, serviceRoleKey));
}
