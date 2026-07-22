import pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { displayDateRangeMatches } from './date-filter.js'
import {
  KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN,
  customerDebtTotalsSql,
  mapCustomerDebtTotalsRow,
  sliceCustomerOpenDebtsOldestFirst,
  type CustomerDebtTotalsRow,
} from './modules/finance/customer-debt.js'
import { buildPartnerDebtLedger, type PartnerDebtDocumentInput } from './modules/finance/partner-debt-ledger.js'
import {
  invoicePaymentStatus,
  rebuildKiotVietCashbookAllocations,
  type AllocatableInvoice,
  type AllocatablePurchaseReceipt,
} from './modules/finance/kiotviet-cashbook-allocation.js'
import type {
  AuthUserRow,
  CashbookEntryData,
  CurrentUserData,
  CustomerDebtSummaryData,
  CustomerListData,
  DeliveryPartnerListItemData,
  EmployeeListItemData,
  FinanceAccountData,
  ProductGroupListData,
  ProductListData,
  PurchaseReceiptData,
  SalesDocumentData,
  SalesDocumentPaymentReceiptData,
  ServerRepository,
  StockMovementData,
  StocktakeDetailData,
  StocktakeListData,
  SupplierListData,
  UserListItemData,
  WorkstationData,
} from './http.js'
import {
  mergeOrganizationBillSettingsPatch,
  normalizeOrganizationBillSettingsData,
  type OrganizationBillSettingsData,
  normalizeBillPreferenceValue,
  resolveCustomerBillPreferenceIds,
  syncCustomerBillPreferencePatch,
} from './bill-settings.js'

const { Pool } = pg

const productReferenceGuards = [
  { table: 'order_items', column: 'product_id' },
  { table: 'price_list_items', column: 'product_id' },
  { table: 'stock_movements', column: 'product_id' },
  { table: 'purchase_receipt_items', column: 'product_id' },
  { table: 'product_boms', column: 'product_id' },
  { table: 'product_bom_items', column: 'component_product_id' },
] as const

const financeAccountsEnsureCache = new WeakMap<pg.Pool, Promise<void>>()
const salesFinanceEnsureCache = new WeakMap<pg.Pool, Promise<void>>()
const userDisplayNameEnsureCache = new WeakMap<pg.Pool, Map<string, Promise<ReadonlyMap<string, string>>>>()
const financeAccountsListCache = new WeakMap<pg.Pool, Map<string, Promise<FinanceAccountData[]>>>()
const searchSelectionStatsEnsureCache = new WeakMap<pg.Pool, Promise<void>>()

export function createPgRepository(databaseUrl: string): ServerRepository & { close(): Promise<void> } {
  const pool = new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 })

  return {
    async findUserByEmail(email) {
      const result = await pool.query(
        `
          select id, email, password_hash, organization_id, display_name, status
          from users
          where email = $1
          limit 1
        `,
        [email],
      )
      return result.rows[0] ?? null
    },
    async findUserByLogin(login) {
      await ensureUserManagementColumns(pool)
      const normalized = login.trim().toLowerCase()
      const phoneDigits = normalized.replace(/\D/g, '')
      const result = await pool.query(
        `
          select id, email, password_hash, organization_id, display_name, status
          from users
          where lower(email) = $1
             or lower(coalesce(username, '')) = $1
             or ($2 <> '' and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2)
          order by
            case
              when lower(email) = $1 then 1
              when lower(coalesce(username, '')) = $1 then 2
              else 3
            end,
            created_at desc
          limit 2
        `,
        [normalized, phoneDigits],
      )
      const rows = result.rows as AuthUserRow[]
      const directRows = rows.filter((row) => row.email.toLowerCase() === normalized)
      if (directRows[0]) return directRows[0]
      if (rows.length > 1) return null
      return rows[0] ?? null
    },

    async createSession(input) {
      await pool.query(
        `
          insert into sessions (token, user_id, expires_at)
          values ($1, $2, $3)
        `,
        [input.token, input.userId, input.expiresAt],
      )
    },

    async listUsers(input) {
      await ensureUserManagementColumns(pool)
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const params: unknown[] = [input.organizationId]
      const filters = ['u.organization_id = $1']
      if (status === 'active' || status === 'inactive') {
        params.push(status)
        filters.push(`u.status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        filters.push(`
          (
            ${accentInsensitiveSearchSql('u.display_name')} like $${params.length}
            or ${accentInsensitiveSearchSql('u.email')} like $${params.length}
            or ${accentInsensitiveSearchSql("coalesce(u.username, '')")} like $${params.length}
            or ${accentInsensitiveSearchSql("coalesce(u.phone, '')")} like $${params.length}
          )
        `)
      }
      const result = await pool.query(
        `
          select
            u.id::text,
            u.email,
            u.username,
            u.phone,
            u.birthday,
            u.region,
            u.ward,
            u.address,
            u.note,
            u.display_name,
            u.status,
            coalesce(
              jsonb_agg(up.permission_code order by up.permission_code)
                filter (where up.permission_code is not null),
              '[]'::jsonb
            ) as permissions
          from users u
          left join user_permissions up on up.user_id = u.id
          where ${filters.join(' and ')}
          group by u.id
          order by u.created_at desc, u.display_name
        `,
        params,
      )
      return result.rows.map(userListItemFromRow)
    },

    async createUser(input) {
      await ensureUserManagementColumns(pool)
      await pool.query('begin')
      try {
        const inserted = await pool.query(
          `
            insert into users (
              id, organization_id, email, username, phone, birthday, region, ward, address, note,
              password_hash, display_name, status, created_at, updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', now(), now())
            returning id::text
          `,
          [
            randomUUID(),
            input.organizationId,
            input.email,
            input.username,
            input.phone,
            input.birthday,
            input.region,
            input.ward,
            input.address,
            input.note,
            input.passwordHash,
            input.displayName,
          ],
        )
        const userId = String(inserted.rows[0]?.id)
        await replacePermissionsForUser(pool, userId, input.permissions)
        const user = await findUserListItem(pool, input.organizationId, userId)
        await pool.query('commit')
        invalidateOrgCache(userDisplayNameEnsureCache, pool, input.organizationId)
        if (!user) throw new Error('Created user not found.')
        return user
      } catch (error) {
        await pool.query('rollback')
        if (isUniqueViolation(error)) throw new Error('USER_ALREADY_EXISTS')
        throw error
      }
    },

    async updateUser(input) {
      await ensureUserManagementColumns(pool)
      const assignments: string[] = []
      const params: unknown[] = []
      if (input.email !== undefined) {
        params.push(input.email)
        assignments.push(`email = $${params.length}`)
      }
      if (input.username !== undefined) {
        params.push(input.username)
        assignments.push(`username = $${params.length}`)
      }
      if (input.phone !== undefined) {
        params.push(input.phone)
        assignments.push(`phone = $${params.length}`)
      }
      if (input.birthday !== undefined) {
        params.push(input.birthday)
        assignments.push(`birthday = $${params.length}`)
      }
      if (input.region !== undefined) {
        params.push(input.region)
        assignments.push(`region = $${params.length}`)
      }
      if (input.ward !== undefined) {
        params.push(input.ward)
        assignments.push(`ward = $${params.length}`)
      }
      if (input.address !== undefined) {
        params.push(input.address)
        assignments.push(`address = $${params.length}`)
      }
      if (input.note !== undefined) {
        params.push(input.note)
        assignments.push(`note = $${params.length}`)
      }
      if (input.passwordHash !== undefined) {
        params.push(input.passwordHash)
        assignments.push(`password_hash = $${params.length}`)
      }
      if (input.displayName !== undefined) {
        params.push(input.displayName)
        assignments.push(`display_name = $${params.length}`)
      }
      if (input.status !== undefined) {
        params.push(input.status)
        assignments.push(`status = $${params.length}`)
      }
      if (assignments.length > 0) {
        params.push(input.organizationId, input.id)
        try {
          await pool.query(
            `
              update users
              set ${assignments.join(', ')}, updated_at = now()
              where organization_id = $${params.length - 1} and id = $${params.length}
            `,
            params,
          )
        } catch (error) {
          if (isUniqueViolation(error)) throw new Error('USER_ALREADY_EXISTS')
          throw error
        }
        invalidateOrgCache(userDisplayNameEnsureCache, pool, input.organizationId)
      }
      return findUserListItem(pool, input.organizationId, input.id)
    },

    async replaceUserPermissions(input) {
      await pool.query('begin')
      try {
        const exists = await pool.query(
          'select id from users where organization_id = $1 and id = $2',
          [input.organizationId, input.id],
        )
        if (!exists.rows[0]) {
          await pool.query('rollback')
          return null
        }
        await replacePermissionsForUser(pool, input.id, input.permissions)
        const user = await findUserListItem(pool, input.organizationId, input.id)
        await pool.query('commit')
        return user
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async listEmployees(input) {
      await ensureEmployeeTables(pool)
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const params: unknown[] = [input.organizationId]
      const filters = ['organization_id = $1']
      if (status === 'active' || status === 'inactive') {
        params.push(status)
        filters.push(`status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        filters.push(`(
          ${accentInsensitiveSearchSql('name')} like $${params.length}
          or ${accentInsensitiveSearchSql('code')} like $${params.length}
          or ${accentInsensitiveSearchSql("coalesce(phone, '')")} like $${params.length}
        )`)
      }
      const result = await pool.query(
        `
          select id::text, code, name, phone, note, status, created_at
          from employees
          where ${filters.join(' and ')}
          order by created_at desc, name
        `,
        params,
      )
      return result.rows.map(employeeListItemFromRow)
    },

    async createEmployee(input) {
      await ensureEmployeeTables(pool)
      const code = input.code?.trim() || await nextEmployeeCode(pool, input.organizationId)
      try {
        const result = await pool.query(
          `
            insert into employees (id, organization_id, code, name, phone, note, status, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, now(), now())
            returning id::text, code, name, phone, note, status, created_at
          `,
          [
            randomUUID(),
            input.organizationId,
            code,
            input.name.trim(),
            input.phone?.trim() || null,
            input.note?.trim() || null,
            input.status ?? 'active',
          ],
        )
        return employeeListItemFromRow(result.rows[0])
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('EMPLOYEE_ALREADY_EXISTS')
        throw error
      }
    },

    async listDeliveryPartners(input) {
      await ensureDeliveryPartnerTables(pool)
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const params: unknown[] = [input.organizationId]
      const filters = ['organization_id = $1']
      if (status === 'active' || status === 'inactive') {
        params.push(status)
        filters.push(`status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        filters.push(`(
          ${accentInsensitiveSearchSql('name')} like $${params.length}
          or ${accentInsensitiveSearchSql('code')} like $${params.length}
          or ${accentInsensitiveSearchSql("coalesce(phone, '')")} like $${params.length}
        )`)
      }
      const result = await pool.query(
        `
          select id::text, code, name, phone, note, status, created_at
          from delivery_partners
          where ${filters.join(' and ')}
          order by created_at desc, name
        `,
        params,
      )
      return result.rows.map(deliveryPartnerListItemFromRow)
    },

    async createDeliveryPartner(input) {
      await ensureDeliveryPartnerTables(pool)
      const code = input.code?.trim() || await nextDeliveryPartnerCode(pool, input.organizationId)
      try {
        const result = await pool.query(
          `
            insert into delivery_partners (id, organization_id, code, name, phone, note, status, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, now(), now())
            returning id::text, code, name, phone, note, status, created_at
          `,
          [
            randomUUID(),
            input.organizationId,
            code,
            input.name.trim(),
            input.phone?.trim() || null,
            input.note?.trim() || null,
            input.status ?? 'active',
          ],
        )
        return deliveryPartnerListItemFromRow(result.rows[0])
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('DELIVERY_PARTNER_ALREADY_EXISTS')
        throw error
      }
    },

    async deleteSession(token) {
      await pool.query('delete from sessions where token = $1', [token])
    },

    async getSessionUser(token, workstationId) {
      const result = await pool.query(
        `
          select
            u.id as user_id,
            u.email,
            u.display_name,
            u.status as user_status,
            o.id as organization_id,
            o.code as organization_code,
            o.name as organization_name,
            coalesce(
              jsonb_agg(up.permission_code order by up.permission_code)
                filter (where up.permission_code is not null),
              '[]'::jsonb
            ) as permissions
          from sessions s
          join users u on u.id = s.user_id
          join organizations o on o.id = u.organization_id
          left join user_permissions up on up.user_id = u.id
          left join permissions p on p.code = up.permission_code and p.status = 'active'
          where s.token = $1
            and s.expires_at > now()
            and u.status = 'active'
          group by u.id, o.id
          limit 1
        `,
        [token],
      )
      const row = result.rows[0]
      if (!row) return null

      const workstation = workstationId
        ? await findWorkstation(pool, row.organization_id, workstationId)
        : null

      return {
        user: { id: row.user_id, email: row.email, display_name: row.display_name },
        organization: {
          id: row.organization_id,
          code: row.organization_code,
          name: row.organization_name,
        },
        workstation,
        permissions: row.permissions,
      } satisfies CurrentUserData
    },

    async listWorkstations(organizationId) {
      const result = await pool.query(
        `
          select id, code, name, status
          from workstations
          where organization_id = $1
          order by code
        `,
        [organizationId],
      )
      return result.rows as WorkstationData[]
    },

    async getOrganizationBillSettings(input) {
      await ensureOrganizationBillSettingsColumns(pool)
      const result = await pool.query(
        `
          select
            coalesce(nullif(btrim(shop_name), ''), name) as shop_name,
            coalesce(shop_address, '') as shop_address,
            coalesce(shop_phone, '') as shop_phone,
            coalesce(print_place, '') as print_place,
            case
              when default_bill_template in ('a4', 'k80') then default_bill_template
              else 'a4'
            end as default_bill_template,
            coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG') as invoice_title,
            coalesce(nullif(btrim(quote_title), ''), 'BẢNG BÁO GIÁ') as quote_title,
            coalesce(footer_note, '') as footer_note,
            coalesce(show_product_code, false) as show_product_code,
            coalesce(show_unit, true) as show_unit,
            coalesce(show_discount, false) as show_discount,
            logo_data_url,
            coalesce(bill_templates, '[]'::jsonb) as bill_templates
          from organizations
          where id = $1
          limit 1
        `,
        [input.organizationId],
      )
      const row = result.rows[0]
      if (!row) {
        return normalizeOrganizationBillSettingsData({
          shop_name: 'QCVL',
          shop_address: '',
          shop_phone: '',
          print_place: '',
          default_bill_template: 'a4',
        })
      }
      return mapOrganizationBillSettingsRow(row)
    },

    async updateOrganizationBillSettings(input) {
      await ensureOrganizationBillSettingsColumns(pool)
      const current = await pool.query(
        `
          select
            coalesce(nullif(btrim(shop_name), ''), name) as shop_name,
            coalesce(shop_address, '') as shop_address,
            coalesce(shop_phone, '') as shop_phone,
            coalesce(print_place, '') as print_place,
            case
              when default_bill_template in ('a4', 'k80') then default_bill_template
              else 'a4'
            end as default_bill_template,
            coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG') as invoice_title,
            coalesce(nullif(btrim(quote_title), ''), 'BẢNG BÁO GIÁ') as quote_title,
            coalesce(footer_note, '') as footer_note,
            coalesce(show_product_code, false) as show_product_code,
            coalesce(show_unit, true) as show_unit,
            coalesce(show_discount, false) as show_discount,
            logo_data_url,
            coalesce(bill_templates, '[]'::jsonb) as bill_templates
          from organizations
          where id = $1
          limit 1
        `,
        [input.organizationId],
      )
      const mapped = current.rows[0]
        ? mapOrganizationBillSettingsRow(current.rows[0])
        : normalizeOrganizationBillSettingsData({
            shop_name: 'QCVL',
            shop_address: '',
            shop_phone: '',
            print_place: '',
            default_bill_template: 'a4',
          })
      const next = mergeOrganizationBillSettingsPatch(mapped, input.patch)
      await pool.query(
        `
          update organizations
          set
            shop_name = $2,
            shop_address = $3,
            shop_phone = $4,
            print_place = $5,
            default_bill_template = $6,
            invoice_title = $7,
            quote_title = $8,
            footer_note = $9,
            show_product_code = $10,
            show_unit = $11,
            show_discount = $12,
            logo_data_url = $13,
            bill_templates = $14::jsonb
          where id = $1
        `,
        [
          input.organizationId,
          next.shop_name,
          next.shop_address,
          next.shop_phone,
          next.print_place,
          next.default_bill_template,
          next.invoice_title,
          next.quote_title,
          next.footer_note,
          next.show_product_code,
          next.show_unit,
          next.show_discount,
          next.logo_data_url,
          JSON.stringify(next.templates),
        ],
      )
      return next
    },

    async getPosProductUsageCounts(organizationId) {
      await ensurePosProductUsageTable(pool)
      const result = await pool.query(
        `
          select product_id, usage_count
          from pos_product_usage
          where organization_id = $1
        `,
        [organizationId],
      )
      return new Map(result.rows.map((row) => [row.product_id, Number(row.usage_count)]))
    },

    async recordPosProductUsage(input) {
      const productCounts = new Map<string, number>()
      for (const productId of input.productIds) {
        productCounts.set(productId, (productCounts.get(productId) ?? 0) + 1)
      }
      if (productCounts.size === 0) return
      await ensurePosProductUsageTable(pool)
      await pool.query('begin')
      try {
        for (const [productId, count] of productCounts) {
          await pool.query(
            `
              insert into pos_product_usage (organization_id, product_id, usage_count)
              values ($1, $2, $3)
              on conflict (organization_id, product_id)
              do update set
                usage_count = pos_product_usage.usage_count + excluded.usage_count,
                updated_at = now()
            `,
            [input.organizationId, productId, count],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async recordSearchSelection(input) {
      await ensureSearchSelectionStatsTable(pool)
      await pool.query(
        `
          insert into search_selection_stats (
            organization_id, user_id, entity_type, entity_id, select_count, last_selected_at
          )
          values ($1, $2, $3, $4, 1, now())
          on conflict (organization_id, user_id, entity_type, entity_id) do update
          set select_count = search_selection_stats.select_count + 1,
              last_selected_at = now()
        `,
        [input.organizationId, input.userId, input.entityType, input.entityId],
      )
    },

    async findProductsByCodes(input) {
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1
            from products p
            where p.organization_id = $1
              and p.code = requested.code
          )
          or exists (
            select 1
            from product_unit_conversions puc
            where puc.organization_id = $1
              and puc.source_code = requested.code
              and puc.is_active = true
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async listProductGroups(input) {
      const result = await pool.query<ProductGroupListData>(
        `
          select id::text, code, name, is_default, is_active
          from product_groups
          where organization_id = $1
            and is_active = true
          order by is_default desc, name asc
        `,
        [input.organizationId],
      )
      return uniqueProductGroups(result.rows)
    },

    async updateProductGroup(input) {
      const name = input.name.trim()
      if (!name) return null
      const result = await pool.query<ProductGroupListData>(
        `
          update product_groups
          set name = $3,
              code = $4,
              updated_at = now()
          where organization_id = $1
            and id = $2
            and is_active = true
          returning id::text, code, name, is_default, is_active
        `,
        [input.organizationId, input.id, name, productGroupImportCode(name)],
      )
      return result.rows[0] ?? null
    },

    async createProduct(input) {
      await ensureProductCatalogSchema(pool)
      await ensureProductUnitTables(pool)

      const code = input.code.trim()
      const name = input.name.trim()
      const unitName = input.unit_name.trim() || 'Can cap nhat'
      const existing = await pool.query(
        `
          select id
          from products
          where organization_id = $1
            and lower(code) = lower($2)
          limit 1
        `,
        [input.organizationId, code],
      )
      if (existing.rows[0]) throw new Error('PRODUCT_ALREADY_EXISTS')

      let productGroup: ProductGroupListData | null = null
      if (input.product_group_id) {
        const groupResult = await pool.query<ProductGroupListData>(
          `
            select id::text, code, name, is_default, is_active
            from product_groups
            where organization_id = $1
              and id = $2
              and is_active = true
            limit 1
          `,
          [input.organizationId, input.product_group_id],
        )
        productGroup = groupResult.rows[0] ?? null
        if (!productGroup) {
          throw new Error('PRODUCT_GROUP_NOT_FOUND')
        }
      } else {
        productGroup = await ensureDefaultProductGroup(pool, input.organizationId)
      }

      const productId = randomUUID()
      const latestPurchaseCost = input.latest_purchase_cost ?? null
      try {
        await pool.query(
          `
            insert into products (
              id, organization_id, code, name, status, product_group_id, unit_name,
              sell_method, product_kind, inventory_shape, track_inventory,
              latest_purchase_cost, latest_purchase_cost_at, created_at, updated_at
            )
            values (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11,
              $12, case when $12::numeric is null then null else now() end, now(), now()
            )
          `,
          [
            productId,
            input.organizationId,
            code,
            name,
            input.status,
            productGroup?.id ?? null,
            unitName,
            input.sell_method,
            input.product_kind,
            input.inventory_shape,
            input.track_inventory,
            latestPurchaseCost,
          ],
        )
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('PRODUCT_ALREADY_EXISTS')
        throw error
      }

      const stockUnitId = await upsertInventoryUnit(pool, input.organizationId, unitName)
      await upsertProductInventorySettings(
        pool,
        input.organizationId,
        productId,
        {
          track_inventory: input.track_inventory,
          inventory_shape: input.inventory_shape,
        } as ProductImportDbRow,
        stockUnitId,
      )
      const unitConversions = (input.unit_conversions ?? [])
        .filter((conversion) => conversion.unit_name.trim() && conversion.stock_qty_per_unit > 0)
        .map((conversion) => ({
          source_code: conversion.source_code ?? null,
          unit_name: conversion.unit_name.trim(),
          stock_qty_per_unit: conversion.stock_qty_per_unit,
          is_default_purchase_unit: Boolean(conversion.is_default_purchase_unit),
          is_default_sale_unit: Boolean(conversion.is_default_sale_unit),
        }))
      if (unitConversions.length > 0) {
        await upsertProductUnitConversions(pool, input.organizationId, productId, stockUnitId, unitConversions)
      }

      const createdAtResult = await pool.query(
        `
          select created_at, updated_at, latest_purchase_cost_at
          from products
          where id = $1
          limit 1
        `,
        [productId],
      )
      const timestamps = createdAtResult.rows[0]
      return {
        id: productId,
        code,
        name,
        status: input.status,
        product_kind: input.product_kind,
        unit_name: unitName,
        sell_method: input.sell_method,
        latest_purchase_cost: latestPurchaseCost,
        latest_purchase_cost_at: timestamps?.latest_purchase_cost_at
          ? new Date(String(timestamps.latest_purchase_cost_at)).toISOString()
          : null,
        default_sale_price: null,
        product_group_id: productGroup?.id ?? null,
        product_group: productGroup
          ? { id: productGroup.id, code: productGroup.code, name: productGroup.name }
          : null,
        inventory_shape: input.inventory_shape,
        track_inventory: input.track_inventory,
        unit_conversions: unitConversions,
        created_at: timestamps?.created_at ? new Date(String(timestamps.created_at)).toISOString() : new Date().toISOString(),
        updated_at: timestamps?.updated_at ? new Date(String(timestamps.updated_at)).toISOString() : new Date().toISOString(),
      }
    },

    async listProducts(input) {
      await ensureStockMovementsTable(pool)
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const sellMethod = input.url.searchParams.get('sell_method')
      const inventoryShape = input.url.searchParams.get('inventory_shape')
      const productKind = input.url.searchParams.get('product_kind')
      const productGroupIds = input.url.searchParams.getAll('product_group_id')
      const createdFrom = input.url.searchParams.get('created_from')
      const createdTo = input.url.searchParams.get('created_to')
      const clauses = ['p.organization_id = $1']
      const values: unknown[] = [input.organizationId]
      if (status === 'deleted') {
        clauses.push(`p.code like '%{DEL}%'`)
      } else if (status && status !== 'all') {
        values.push(status)
        clauses.push(`p.status = $${values.length}`)
        clauses.push(`p.code not like '%{DEL}%'`)
      }
      if (sellMethod) {
        values.push(sellMethod)
        clauses.push(`p.sell_method = $${values.length}`)
      }
      if (inventoryShape) {
        values.push(inventoryShape)
        clauses.push(`p.inventory_shape = $${values.length}`)
      }
      if (productKind) {
        values.push(productKind)
        clauses.push(`p.product_kind = $${values.length}`)
      }
      if (productGroupIds.length > 0) {
        values.push(productGroupIds)
        clauses.push(`p.product_group_id = any($${values.length}::uuid[])`)
      }
      if (createdFrom) {
        values.push(createdFrom)
        clauses.push(`(p.created_at at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (createdTo) {
        values.push(createdTo)
        clauses.push(`(p.created_at at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        clauses.push(`(${accentInsensitiveSearchSql('p.code')} like $${values.length} or ${accentInsensitiveSearchSql('p.name')} like $${values.length})`)
      }

      const result = await pool.query(
        `
          select
            p.id::text,
            p.code,
            p.name,
            p.status,
            p.product_kind,
            p.unit_name,
            p.sell_method,
            p.latest_purchase_cost,
            p.latest_purchase_cost_at,
            pli.unit_price as default_sale_price,
            coalesce(price_data.price_list_prices, '{}'::jsonb) as price_list_prices,
            p.product_group_id::text,
            case
              when pg.id is null then null
              else jsonb_build_object('id', pg.id::text, 'code', pg.code, 'name', pg.name)
            end as product_group,
            p.inventory_shape,
            p.track_inventory,
            coalesce(unit_data.unit_conversions, '[]'::jsonb) as unit_conversions,
            provisional_data.kiotviet_provisional_stock,
            operating_stock_data.operating_stock,
            latest_stocktake_data.latest_kiotviet_stocktake,
            draft_bom_data.draft_bom,
            p.created_at,
            p.updated_at
          from products p
          left join product_groups pg on pg.id = p.product_group_id and pg.organization_id = p.organization_id
          left join price_lists pl on pl.organization_id = p.organization_id and pl.is_default = true and pl.is_active = true
          left join price_list_items pli on pli.organization_id = p.organization_id and pli.price_list_id = pl.id and pli.product_id = p.id
          left join lateral (
            select jsonb_object_agg(pli_all.price_list_id::text, pli_all.unit_price) as price_list_prices
            from price_list_items pli_all
            where pli_all.organization_id = p.organization_id
              and pli_all.product_id = p.id
          ) price_data on true
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'source_code', puc.source_code,
                'unit_name', sale_unit.name,
                'stock_qty_per_unit', puc.stock_qty_per_sale_unit,
                'is_default_purchase_unit', puc.is_default_purchase_unit,
                'is_default_sale_unit', puc.is_default_sale_unit
              )
              order by puc.is_default_sale_unit desc, puc.is_default_purchase_unit desc, sale_unit.name
            ) as unit_conversions
            from product_unit_conversions puc
            join inventory_units sale_unit on sale_unit.id = puc.sale_unit_id
            where puc.organization_id = p.organization_id
              and puc.product_id = p.id
              and puc.is_active = true
              and sale_unit.is_active = true
          ) unit_data on true
          left join lateral (
            select jsonb_build_object(
              'quantity', ipb.remaining_qty,
              'unit_name', stock_unit.name,
              'source_type', ipb.source_type,
              'source_label', ipb.source_label,
              'status', ipb.status,
              'updated_at', ipb.updated_at
            ) as kiotviet_provisional_stock
            from inventory_provisional_balances ipb
            join inventory_units stock_unit on stock_unit.id = ipb.stock_unit_id
            where ipb.organization_id = p.organization_id
              and ipb.product_id = p.id
              and ipb.source_type = 'kiotviet_import'
            order by ipb.updated_at desc
            limit 1
          ) provisional_data on true
          left join lateral (
            select jsonb_build_object(
              'quantity', coalesce(latest.ending_qty, movement_total.quantity),
              'unit_name', p.unit_name,
              'source_type', 'stock_movements',
              'source_label', 'Moc ton + chung tu',
              'updated_at', latest.created_at
            ) as operating_stock
            from (
              select sm.id, sm.ending_qty, sm.created_at
              from stock_movements sm
              where sm.organization_id = p.organization_id
                and sm.product_id = p.id
              order by sm.created_at desc, sm.id desc
              limit 1
            ) latest
            cross join lateral (
              select coalesce(sum(sm_total.quantity_delta), 0) as quantity
              from stock_movements sm_total
              where sm_total.organization_id = p.organization_id
                and sm_total.product_id = p.id
            ) movement_total
          ) operating_stock_data on true
          left join lateral (
            select jsonb_build_object(
              'code', st.code,
              'source_created_at', st.source_created_at,
              'source_balanced_at', st.source_balanced_at,
              'system_qty', sti.system_qty,
              'actual_qty', sti.actual_qty,
              'difference_qty', sti.difference_qty,
              'unit_name', coalesce(sti.source_unit_name, stock_unit.name)
            ) as latest_kiotviet_stocktake
            from stocktake_items sti
            join stocktakes st on st.id = sti.stocktake_id and st.organization_id = sti.organization_id
            left join inventory_units stock_unit on stock_unit.id = sti.stock_unit_id
            where sti.organization_id = p.organization_id
              and sti.product_id = p.id
              and st.source_type = 'kiotviet_import'
              and st.source_system = 'kiotviet'
            order by coalesce(st.source_balanced_at, st.source_created_at, st.created_at) desc, sti.line_no desc
            limit 1
          ) latest_stocktake_data on true
          left join lateral (
            select jsonb_build_object(
              'id', pb.id::text,
              'version', pb.version,
              'status', pb.status,
              'item_count', count(pbi.id),
              'notes', pb.notes
            ) as draft_bom
            from product_boms pb
            left join product_bom_items pbi on pbi.organization_id = pb.organization_id and pbi.bom_id = pb.id
            where pb.organization_id = p.organization_id
              and pb.product_id = p.id
              and pb.status in ('active', 'draft')
            group by pb.id, pb.version, pb.status, pb.notes, pb.created_at
            order by case when pb.status = 'active' then 0 else 1 end, pb.version desc, pb.created_at desc
            limit 1
          ) draft_bom_data on true
          where ${clauses.join(' and ')}
          order by p.created_at desc, p.code asc, p.name asc
        `,
        values,
      )
      const items = result.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        status: String(row.status),
        product_kind: String(row.product_kind),
        unit_name: String(row.unit_name),
        sell_method: String(row.sell_method),
        latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
        latest_purchase_cost_at: row.latest_purchase_cost_at?.toISOString?.() ?? row.latest_purchase_cost_at ?? null,
        default_sale_price: row.default_sale_price === null ? null : Number(row.default_sale_price),
        price_list_prices: priceListPriceMap(row.price_list_prices),
        product_group_id: row.product_group_id === null ? null : String(row.product_group_id),
        product_group: row.product_group ?? null,
        inventory_shape: String(row.inventory_shape),
        track_inventory: Boolean(row.track_inventory),
        unit_conversions: (row.unit_conversions ?? []).map((conversion: {
          source_code?: string | null
          unit_name: string
          stock_qty_per_unit: string | number
          is_default_purchase_unit: boolean
          is_default_sale_unit: boolean
        }) => ({
          source_code: conversion.source_code ?? null,
          unit_name: String(conversion.unit_name),
          stock_qty_per_unit: Number(conversion.stock_qty_per_unit),
          is_default_purchase_unit: Boolean(conversion.is_default_purchase_unit),
          is_default_sale_unit: Boolean(conversion.is_default_sale_unit),
        })),
        kiotviet_provisional_stock: row.kiotviet_provisional_stock
          ? {
              quantity: Number(row.kiotviet_provisional_stock.quantity),
              unit_name: String(row.kiotviet_provisional_stock.unit_name),
              source_type: 'kiotviet_import',
              source_label: row.kiotviet_provisional_stock.source_label === null ? null : String(row.kiotviet_provisional_stock.source_label),
              status: String(row.kiotviet_provisional_stock.status),
              updated_at: row.kiotviet_provisional_stock.updated_at?.toISOString?.() ?? row.kiotviet_provisional_stock.updated_at ?? null,
            }
          : null,
        operating_stock: row.operating_stock
          ? {
              quantity: Number(row.operating_stock.quantity),
              unit_name: String(row.operating_stock.unit_name),
              source_type: 'stock_movements',
              source_label: row.operating_stock.source_label === null ? null : String(row.operating_stock.source_label),
              updated_at: row.operating_stock.updated_at?.toISOString?.() ?? row.operating_stock.updated_at ?? null,
            }
          : null,
        latest_kiotviet_stocktake: row.latest_kiotviet_stocktake
          ? {
              code: String(row.latest_kiotviet_stocktake.code),
              source_created_at: dbDateText(row.latest_kiotviet_stocktake.source_created_at),
              source_balanced_at: dbDateText(row.latest_kiotviet_stocktake.source_balanced_at),
              system_qty: row.latest_kiotviet_stocktake.system_qty === null ? null : Number(row.latest_kiotviet_stocktake.system_qty),
              actual_qty: row.latest_kiotviet_stocktake.actual_qty === null ? null : Number(row.latest_kiotviet_stocktake.actual_qty),
              difference_qty: row.latest_kiotviet_stocktake.difference_qty === null ? null : Number(row.latest_kiotviet_stocktake.difference_qty),
              unit_name: row.latest_kiotviet_stocktake.unit_name === null ? null : String(row.latest_kiotviet_stocktake.unit_name),
            }
          : null,
        draft_bom: row.draft_bom
          ? {
              id: String(row.draft_bom.id),
              version: Number(row.draft_bom.version),
              status: String(row.draft_bom.status) as 'draft' | 'active' | 'archived',
              item_count: Number(row.draft_bom.item_count),
              notes: row.draft_bom.notes === null ? null : String(row.draft_bom.notes),
            }
          : null,
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
      })) satisfies ProductListData[]
      return quickPickRankedItems({
        pool,
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'product',
        url: input.url,
        items,
        codeOf: (product) => product.code,
        nameOf: (product) => product.name,
      })
    },

    async listProductsPage(input) {
      const items = await this.listProducts?.(input) ?? []
      const { page, pageSize } = paginationFromUrl(input.url, 15)
      const start = Math.max(0, page - 1) * pageSize
      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        total_all: items.reduce((total, product) => total + 1 + (product.unit_conversions?.length ?? 0), 0),
      }
    },

    async listStockMovements(input) {
      await ensureStockMovementsTable(pool)
      const productId = input.url.searchParams.get('product_id')
      const values: unknown[] = [input.organizationId]
      const clauses = ['sm.organization_id = $1']
      if (productId) {
        values.push(productId)
        clauses.push(`sm.product_id = $${values.length}::uuid`)
      }
      const result = await pool.query(
        `
          select
            sm.id::text,
            sm.product_id::text,
            sm.movement_type,
            sm.quantity_delta,
            sm.created_at,
            sm.document_code,
            sm.document_type,
            sm.transaction_price,
            sm.cost_price,
            sm.ending_qty,
            sm.partner_name
          from stock_movements sm
          where ${clauses.join(' and ')}
          order by sm.created_at desc, sm.id desc
        `,
        values,
      )
      const movements = result.rows.map((row) => ({
        id: String(row.id),
        product_id: String(row.product_id),
        movement_type: String(row.movement_type),
        quantity_delta: Number(row.quantity_delta),
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        document_code: row.document_code === null ? null : String(row.document_code),
        document_type: row.document_type === null ? null : String(row.document_type) as StockMovementData['document_type'],
        transaction_price: row.transaction_price === null ? null : Number(row.transaction_price),
        cost_price: row.cost_price === null ? null : Number(row.cost_price),
        ending_qty: row.ending_qty === null ? null : Number(row.ending_qty),
        partner_name: row.partner_name === null ? null : String(row.partner_name),
      }))
      if (!productId) return movements
      const derived = await derivedPurchaseStockMovementsFromSnapshots(pool, input.organizationId, productId)
      if (movements.length === 0) return derived
      const existingPurchaseCodes = new Set(
        movements
          .filter((movement) => movement.document_type === 'purchase_receipt' && movement.document_code)
          .map((movement) => movement.document_code as string),
      )
      const missingDerived = derived.filter((movement) => (
        movement.document_code !== null && !existingPurchaseCodes.has(movement.document_code)
      ))
      if (missingDerived.length === 0) return movements
      const merged = [...movements, ...missingDerived].sort((left, right) => {
        const timeDiff = Date.parse(String(left.created_at)) - Date.parse(String(right.created_at))
        if (timeDiff !== 0) return timeDiff
        return String(left.id).localeCompare(String(right.id))
      })
      let endingQty = 0
      for (const movement of merged) {
        endingQty += Number(movement.quantity_delta)
        movement.ending_qty = endingQty
      }
      return merged.reverse()
    },

    async findDefaultPriceList(input) {
      await ensureProductCatalogSchema(pool)
      await ensurePriceListTables(pool)
      const result = await pool.query(
        `
          select id::text, name
          from price_lists
          where organization_id = $1
            and is_default = true
            and is_active = true
          order by updated_at desc, created_at desc
          limit 1
        `,
        [input.organizationId],
      )
      const row = result.rows[0]
      return row ? { id: String(row.id), name: String(row.name) } : null
    },

    async listPriceLists(input) {
      await ensureProductCatalogSchema(pool)
      await ensurePriceListTables(pool)
      const result = await pool.query(
        `
          select id::text, code, name, is_default, is_active
          from price_lists
          where organization_id = $1
          order by is_default desc, name asc
        `,
        [input.organizationId],
      )
      return result.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        is_default: Boolean(row.is_default),
        is_active: Boolean(row.is_active),
      }))
    },

    async resolvePrices(input) {
      if (input.productIds.length === 0) return []
      await ensureProductCatalogSchema(pool)
      await ensurePriceListTables(pool)
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          with requested as (
            select product_id, ordinality
            from unnest($2::uuid[]) with ordinality as requested(product_id, ordinality)
          ),
          customer_context as (
            select data->'customer_group'->>'name' as customer_group_name
            from customer_snapshots
            where organization_id = $1
              and $3::text is not null
              and id::text = $3::text
              and coalesce(data->>'customer_group_id', '') not in ('cg-retail', 'cg-vip')
            limit 1
          ),
          default_list as (
            select id
            from price_lists
            where organization_id = $1
              and is_default = true
              and is_active = true
            order by updated_at desc, created_at desc
            limit 1
          ),
          customer_list as (
            select pl.id
            from price_lists pl
            join customer_context cc on lower(pl.name) = lower(cc.customer_group_name)
            where pl.organization_id = $1
              and pl.is_active = true
            order by pl.updated_at desc, pl.created_at desc
            limit 1
          )
          select
            requested.product_id::text,
            coalesce(customer_item.unit_price, default_item.unit_price, 0) as unit_price,
            coalesce(unit_price_data.unit_prices_by_source_code, '{}'::jsonb) as unit_prices_by_source_code,
            case
              when customer_item.unit_price is not null then 'customer_group_price_list'
              when (select id from customer_list) is not null and default_item.unit_price is not null then 'fallback_default_price_list'
              else 'default_price_list'
            end as price_source,
            coalesce(
              case when customer_item.unit_price is not null then (select id from customer_list) end,
              (select id from default_list)
            )::text as price_list_id
          from requested
          join products p on p.id = requested.product_id and p.organization_id = $1
          left join price_list_items customer_item
            on customer_item.organization_id = $1
           and customer_item.price_list_id = (select id from customer_list)
           and customer_item.product_id = p.id
          left join price_list_items default_item
            on default_item.organization_id = $1
           and default_item.price_list_id = (select id from default_list)
           and default_item.product_id = p.id
          left join lateral (
            select jsonb_object_agg(puc.source_code, coalesce(customer_alias_item.unit_price, default_alias_item.unit_price)) as unit_prices_by_source_code
            from product_unit_conversions puc
            join products alias_product
              on alias_product.organization_id = $1
             and alias_product.code = puc.source_code
            left join price_list_items customer_alias_item
              on customer_alias_item.organization_id = $1
             and customer_alias_item.price_list_id = (select id from customer_list)
             and customer_alias_item.product_id = alias_product.id
            left join price_list_items default_alias_item
              on default_alias_item.organization_id = $1
             and default_alias_item.price_list_id = (select id from default_list)
             and default_alias_item.product_id = alias_product.id
            where puc.organization_id = $1
              and puc.product_id = p.id
              and puc.is_active = true
              and puc.source_code is not null
              and coalesce(customer_alias_item.unit_price, default_alias_item.unit_price) is not null
          ) unit_price_data on true
          order by requested.ordinality
        `,
        [input.organizationId, input.productIds, input.customerId],
      )
      return result.rows.map((row) => ({
        product_id: String(row.product_id),
        unit_price: Number(row.unit_price),
        unit_prices_by_source_code: priceListPriceMap(row.unit_prices_by_source_code),
        price_source: row.price_source as 'default_price_list' | 'customer_group_price_list' | 'fallback_default_price_list',
        price_list_id: row.price_list_id === null ? '' : String(row.price_list_id),
      }))
    },

    async listCustomers(input) {
      await ensureImportedSnapshotTables(pool)
      const [customerResult, supplierResult] = await Promise.all([
        pool.query(
        `
          select data
          from customer_snapshots
          where organization_id = $1
          order by coalesce(nullif(data->>'created_at', '')::timestamptz, created_at) desc
        `,
          [input.organizationId],
        ),
        pool.query(
          `
            select data
            from supplier_snapshots
            where organization_id = $1
          `,
          [input.organizationId],
        ),
      ])
      const suppliers = supplierResult.rows.map((row) => row.data as SupplierListData)
      const items = customerResult.rows
        .map((row) => row.data as CustomerListData)
        .map((customer) => hydrateCustomerLinkedSupplier(customer, suppliers))
        .filter((customer) => customerSnapshotMatches(input.url, customer))
      return quickPickRankedItems({
        pool,
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'customer',
        url: input.url,
        items,
        codeOf: (customer) => customer.code,
        nameOf: (customer) => customer.name,
      })
    },

    async createCustomer(input) {
      await ensureImportedSnapshotTables(pool)
      const code = input.code?.trim() || await nextManualCustomerCode(pool, input.organizationId)
      const groupId = input.customer_group_id ?? null
      const group = groupId ? await findCustomerGroupSnapshot(pool, input.organizationId, groupId) : null
      const createdAt = new Date().toISOString()
      const data: CustomerListData = {
        id: randomUUID(),
        code,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        tax_code: input.tax_code?.trim() || null,
        address: input.address?.trim() || null,
        customer_group_id: groupId,
        customer_group: group,
        created_by: input.created_by ?? null,
        created_at: createdAt,
        total_sales_amount: 0,
        total_debt_amount: 0,
        customer_type: input.customer_type?.trim() || null,
        company_name: input.company_name?.trim() || null,
        area_name: null,
        ward_name: null,
        note: input.note?.trim() || null,
        source_creator_name: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_net_sales: null,
        status: 'active',
      }
      await pool.query(
        `
          insert into customer_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
          values ($1, $2, $3, $4::jsonb, 'manual', $5::timestamptz, now())
        `,
        [data.id, input.organizationId, data.code, JSON.stringify(data), data.created_at],
      )
      return hydrateCustomerLinkedSupplier(data, [])
    },

    async findCustomerByCode(input) {
      await ensureImportedSnapshotTables(pool)
      const [customerResult, supplierResult] = await Promise.all([
        pool.query(
          `
            select data
            from customer_snapshots
            where organization_id = $1 and lower(code) = lower($2)
            limit 1
          `,
          [input.organizationId, input.code],
        ),
        pool.query(
          `
            select data
            from supplier_snapshots
            where organization_id = $1
          `,
          [input.organizationId],
        ),
      ])
      const customer = customerResult.rows[0]?.data as CustomerListData | undefined
      if (!customer) return null
      return hydrateCustomerLinkedSupplier(customer, supplierResult.rows.map((row) => row.data as SupplierListData))
    },

    async findCustomersByCodes(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1 from customer_snapshots c
            where c.organization_id = $1 and lower(c.code) = lower(requested.code)
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async updateCustomer(input) {
      await ensureImportedSnapshotTables(pool)
      const existing = await pool.query(
        `
          select data
          from customer_snapshots
          where organization_id = $1 and (id = $2 or lower(code) = lower($2))
          limit 1
        `,
        [input.organizationId, input.id],
      )
      const current = existing.rows[0]?.data as CustomerListData | undefined
      if (!current) return null
      if (
        (current.code ?? '').trim().toLowerCase() === 'khachle'
        && (input.patch.preferred_bill_template !== undefined || input.patch.preferred_bill_templates !== undefined)
      ) {
        throw Object.assign(new Error('WALK_IN_BILL_PREFERENCE_FORBIDDEN'), { code: 'WALK_IN_BILL_PREFERENCE_FORBIDDEN' })
      }
      const group = input.patch.customer_group_id === undefined
        ? current.customer_group
        : input.patch.customer_group_id === null
          ? null
          : await findCustomerGroupSnapshot(pool, input.organizationId, input.patch.customer_group_id)
      const billPreference =
        input.patch.preferred_bill_template !== undefined || input.patch.preferred_bill_templates !== undefined
          ? syncCustomerBillPreferencePatch({
              preferred_bill_template: input.patch.preferred_bill_template,
              preferred_bill_templates: input.patch.preferred_bill_templates,
              currentTemplate: current.preferred_bill_template ?? null,
              currentTemplates: current.preferred_bill_templates ?? null,
            })
          : null
      const data: CustomerListData = {
        ...current,
        code: input.patch.code ?? current.code,
        name: input.patch.name ?? current.name,
        phone: input.patch.phone === undefined ? current.phone : input.patch.phone,
        tax_code: input.patch.tax_code === undefined ? current.tax_code : input.patch.tax_code,
        address: input.patch.address === undefined ? current.address : input.patch.address,
        note: input.patch.note === undefined ? current.note : input.patch.note,
        customer_group_id: input.patch.customer_group_id === undefined ? current.customer_group_id : input.patch.customer_group_id,
        customer_group: group,
        customer_type: input.patch.customer_type === undefined ? current.customer_type : input.patch.customer_type,
        company_name: input.patch.company_name === undefined ? current.company_name : input.patch.company_name,
        preferred_bill_template: billPreference
          ? billPreference.preferred_bill_template
          : current.preferred_bill_template ?? null,
        preferred_bill_templates: billPreference
          ? billPreference.preferred_bill_templates
          : current.preferred_bill_templates ?? null,
      }
      await pool.query(
        `
          update customer_snapshots
          set code = $3, data = $4::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [input.organizationId, current.id, data.code, JSON.stringify(data)],
      )
      return hydrateCustomerLinkedSupplier(data, [])
    },

    async upsertCustomerGroupsByName(input) {
      return new Map(input.names
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [name, `customer-group-${hashText(name)}`]))
    },

    async upsertCustomersByCode(input) {
      await ensureImportedSnapshotTables(pool)
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const existing = await pool.query('select data from customer_snapshots where organization_id = $1 and code = $2 limit 1', [input.organizationId, row.code])
        const current = existing.rows[0]?.data as CustomerListData | undefined
        const data: CustomerListData = {
          id: current?.id ?? `customer-kv-${hashText(row.code)}`,
          code: row.code,
          name: row.name,
          phone: row.phone,
          tax_code: row.tax_code,
          address: row.address,
          customer_group_id: row.customer_group_id,
          customer_group: row.customer_group_id && row.customer_group_name
            ? { id: row.customer_group_id, code: priceListImportCode(row.customer_group_name), name: row.customer_group_name }
            : null,
          created_by: null,
          created_at: row.source_created_at ?? current?.created_at ?? new Date().toISOString(),
          total_sales_amount: row.kiotviet_net_sales ?? row.kiotviet_total_sales ?? current?.total_sales_amount ?? 0,
          total_debt_amount: row.kiotviet_current_debt ?? current?.total_debt_amount ?? 0,
          customer_type: row.customer_type,
          company_name: row.company_name,
          area_name: row.area_name,
          ward_name: row.ward_name,
          note: row.note,
          source_creator_name: row.source_creator_name,
          last_transaction_at: row.last_transaction_at,
          kiotviet_current_debt: row.kiotviet_current_debt,
          kiotviet_net_sales: row.kiotviet_net_sales,
          status: row.status,
        }
        const upsert = await pool.query(
          `
            insert into customer_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
            values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now())
            on conflict (organization_id, code)
            do update set data = excluded.data, source_type = excluded.source_type, updated_at = now()
            returning (xmax = 0) as inserted
          `,
          [data.id, input.organizationId, data.code, JSON.stringify(data), data.created_at],
        )
        if (upsert.rows[0]?.inserted) created += 1
        else updated += 1
      }
      return { created, updated, skipped: 0 }
    },

    async deleteImportedKiotVietCustomers(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          delete from customer_snapshots
          where organization_id = $1
            and source_type = 'kiotviet_import'
            and lower(code) <> 'khachle'
        `,
        [input.organizationId],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

    async listSuppliers(input) {
      await ensureImportedSnapshotTables(pool)
      await recomputeSupplierPurchaseTotals(pool, input.organizationId)
      const result = await pool.query(
        `
          select data
          from supplier_snapshots
          where organization_id = $1
          order by coalesce(nullif(data->>'created_at', '')::timestamptz, created_at) desc
        `,
        [input.organizationId],
      )
      const items = result.rows.map((row) => row.data as SupplierListData).filter((supplier) => supplierSnapshotMatches(input.url, supplier))
      return quickPickRankedItems({
        pool,
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'supplier',
        url: input.url,
        items,
        codeOf: (supplier) => supplier.code,
        nameOf: (supplier) => supplier.name,
      })
    },

    async createSupplier(input) {
      await ensureImportedSnapshotTables(pool)
      const code = input.code?.trim() || await nextManualSupplierCode(pool, input.organizationId)
      const existing = await pool.query(
        `
          select id
          from supplier_snapshots
          where organization_id = $1
            and lower(code) = lower($2)
          limit 1
        `,
        [input.organizationId, code],
      )
      if (existing.rows[0]) throw new Error('SUPPLIER_ALREADY_EXISTS')

      const linkedCustomerId = input.linked_customer_id?.trim() || null
      let linkedCustomer: { id: string; code: string; name: string } | null = null
      if (linkedCustomerId) {
        const customerResult = await pool.query(
          `
            select data
            from customer_snapshots
            where organization_id = $1 and id = $2
            limit 1
          `,
          [input.organizationId, linkedCustomerId],
        )
        const customer = customerResult.rows[0]?.data as CustomerListData | undefined
        if (!customer) throw new Error('LINKED_CUSTOMER_NOT_FOUND')
        linkedCustomer = { id: customer.id, code: customer.code, name: customer.name }
      }

      const createdAt = new Date().toISOString()
      const data: SupplierListData = {
        id: randomUUID(),
        code,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        tax_code: input.tax_code?.trim() || null,
        linked_customer_id: linkedCustomerId,
        linked_customer: linkedCustomer,
        notes: input.notes?.trim() || null,
        status: input.status?.trim() || 'active',
        current_payable_amount: 0,
        total_purchase_amount: 0,
        created_at: createdAt,
        source_creator_name: null,
        source_created_at: null,
        company_name: null,
      }
      try {
        await pool.query(
          `
            insert into supplier_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
            values ($1, $2, $3, $4::jsonb, 'manual', $5::timestamptz, now())
          `,
          [data.id, input.organizationId, data.code, JSON.stringify(data), data.created_at],
        )
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('SUPPLIER_ALREADY_EXISTS')
        throw error
      }
      return data
    },

    async findSuppliersByCodes(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1 from supplier_snapshots s
            where s.organization_id = $1 and lower(s.code) = lower(requested.code)
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async upsertSuppliersByCode(input) {
      await ensureImportedSnapshotTables(pool)
      let created = 0
      let updated = 0
      for (const row of input.rows) {
        const existing = await pool.query('select data from supplier_snapshots where organization_id = $1 and code = $2 limit 1', [input.organizationId, row.code])
        const current = existing.rows[0]?.data as SupplierListData | undefined
        const matchingCustomer = await pool.query(
          `
            select data
            from customer_snapshots
            where organization_id = $1
              and (
                lower(code) = lower($2)
                or lower(name) = lower($3)
              )
            limit 1
          `,
          [input.organizationId, row.code, row.name],
        )
        const linkedCustomer = matchingCustomer.rows[0]?.data as CustomerListData | undefined
        const data: SupplierListData = {
          id: current?.id ?? `supplier-kv-${hashText(row.code)}`,
          code: row.code,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          tax_code: row.tax_code,
          linked_customer_id: current?.linked_customer_id ?? linkedCustomer?.id ?? null,
          linked_customer: current?.linked_customer ?? (linkedCustomer ? { id: linkedCustomer.id, code: linkedCustomer.code, name: linkedCustomer.name } : null),
          notes: row.note,
          status: row.status,
          current_payable_amount: row.kiotviet_current_payable ?? current?.current_payable_amount ?? 0,
          total_purchase_amount: row.kiotviet_total_purchase ?? current?.total_purchase_amount ?? 0,
          created_at: row.source_created_at ?? current?.created_at ?? new Date().toISOString(),
          source_creator_name: row.source_creator_name,
          source_created_at: row.source_created_at,
          company_name: row.company_name,
        }
        const upsert = await pool.query(
          `
            insert into supplier_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
            values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now())
            on conflict (organization_id, code)
            do update set data = excluded.data, source_type = excluded.source_type, updated_at = now()
            returning (xmax = 0) as inserted
          `,
          [data.id, input.organizationId, data.code, JSON.stringify(data), data.created_at],
        )
        if (upsert.rows[0]?.inserted) created += 1
        else updated += 1
      }
      return { created, updated, skipped: 0 }
    },

    async updateSupplier(input) {
      await ensureImportedSnapshotTables(pool)
      const existing = await pool.query(
        `
          select data
          from supplier_snapshots
          where organization_id = $1 and id = $2
          limit 1
        `,
        [input.organizationId, input.id],
      )
      const current = existing.rows[0]?.data as SupplierListData | undefined
      if (!current) return null
      const linkedCustomerId = input.patch.linked_customer_id !== undefined ? input.patch.linked_customer_id : current.linked_customer_id ?? null
      const linkedCustomer = linkedCustomerId
        ? await pool.query(
          `
            select data
            from customer_snapshots
            where organization_id = $1 and id = $2
            limit 1
          `,
          [input.organizationId, linkedCustomerId],
        )
        : null
      const linkedCustomerData = linkedCustomer?.rows[0]?.data as CustomerListData | undefined
      const data: SupplierListData = {
        ...current,
        code: input.patch.code ?? current.code,
        name: input.patch.name ?? current.name,
        phone: input.patch.phone ?? current.phone,
        email: input.patch.email ?? current.email,
        address: input.patch.address ?? current.address,
        tax_code: input.patch.tax_code ?? current.tax_code,
        linked_customer_id: linkedCustomerId,
        linked_customer: linkedCustomerData ? { id: linkedCustomerData.id, code: linkedCustomerData.code, name: linkedCustomerData.name } : null,
        notes: input.patch.notes ?? current.notes,
        status: input.patch.status ?? current.status,
      }
      await pool.query(
        `
          update supplier_snapshots
          set code = $3, data = $4::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [input.organizationId, input.id, data.code, JSON.stringify(data)],
      )
      return data
    },

    async deleteImportedKiotVietSuppliers(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          delete from supplier_snapshots
          where organization_id = $1
            and source_type = 'kiotviet_import'
        `,
        [input.organizationId],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

    async listFinanceAccounts(input) {
      await ensureFinanceAccountsTable(pool)
      const isActive = input.url.searchParams.get('is_active')
      const accountType = input.url.searchParams.get('account_type')
      const params: unknown[] = [input.organizationId]
      const filters = ['organization_id = $1']
      if (isActive === 'true' || isActive === 'false') {
        params.push(isActive === 'true')
        filters.push(`is_active = $${params.length}`)
      }
      if (accountType === 'cash' || accountType === 'bank') {
        params.push(accountType)
        filters.push(`account_type = $${params.length}`)
      }
      const result = await pool.query(
        `
          select id, code, name, account_type, is_default_cash, is_active,
                 account_number, account_holder, opening_balance, note, notify_on_transaction
          from finance_accounts
          where ${filters.join(' and ')}
          order by case when account_type = 'cash' then 0 else 1 end, name, code
        `,
        params,
      )
      return result.rows.map(mapFinanceAccountRow)
    },

    async createFinanceAccount(input) {
      await ensureFinanceAccountsTable(pool)
      const account = input.account
      const id = account.id ?? `finance-account-${hashText(`${account.account_type}-${account.account_number ?? account.code}`)}`
      const result = await pool.query(
        `
          insert into finance_accounts (
            id, organization_id, code, name, account_type, is_default_cash, is_active,
            account_number, account_holder, opening_balance, note, notify_on_transaction, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
          on conflict (organization_id, id)
          do update set
            code = excluded.code,
            name = excluded.name,
            account_type = excluded.account_type,
            is_default_cash = excluded.is_default_cash,
            is_active = excluded.is_active,
            account_number = excluded.account_number,
            account_holder = excluded.account_holder,
            opening_balance = excluded.opening_balance,
            note = excluded.note,
            notify_on_transaction = excluded.notify_on_transaction,
            updated_at = now()
          returning id, code, name, account_type, is_default_cash, is_active,
                    account_number, account_holder, opening_balance, note, notify_on_transaction
        `,
        [
          id,
          input.organizationId,
          account.code,
          account.name,
          account.account_type,
          account.is_default_cash,
          account.is_active,
          account.account_number ?? null,
          account.account_holder ?? null,
          account.opening_balance ?? 0,
          account.note ?? null,
          account.notify_on_transaction ?? false,
        ],
      )
      invalidateOrgCache(financeAccountsListCache, pool, input.organizationId)
      return mapFinanceAccountRow(result.rows[0])
    },

    async updateFinanceAccount(input) {
      await ensureFinanceAccountsTable(pool)
      const assignments: string[] = []
      const values: unknown[] = []
      const patch = input.patch
      if (patch.code !== undefined) {
        values.push(patch.code)
        assignments.push(`code = $${values.length}`)
      }
      if (patch.name !== undefined) {
        values.push(patch.name)
        assignments.push(`name = $${values.length}`)
      }
      if (patch.account_type !== undefined) {
        values.push(patch.account_type)
        assignments.push(`account_type = $${values.length}`)
      }
      if (patch.is_default_cash !== undefined) {
        values.push(patch.is_default_cash)
        assignments.push(`is_default_cash = $${values.length}`)
      }
      if (patch.is_active !== undefined) {
        values.push(patch.is_active)
        assignments.push(`is_active = $${values.length}`)
      }
      if (patch.account_number !== undefined) {
        values.push(patch.account_number)
        assignments.push(`account_number = $${values.length}`)
      }
      if (patch.account_holder !== undefined) {
        values.push(patch.account_holder)
        assignments.push(`account_holder = $${values.length}`)
      }
      if (patch.opening_balance !== undefined) {
        values.push(patch.opening_balance)
        assignments.push(`opening_balance = $${values.length}`)
      }
      if (patch.note !== undefined) {
        values.push(patch.note)
        assignments.push(`note = $${values.length}`)
      }
      if (patch.notify_on_transaction !== undefined) {
        values.push(patch.notify_on_transaction)
        assignments.push(`notify_on_transaction = $${values.length}`)
      }
      if (assignments.length === 0) {
        const existing = await pool.query(
          `
            select id, code, name, account_type, is_default_cash, is_active,
                   account_number, account_holder, opening_balance, note, notify_on_transaction
            from finance_accounts
            where organization_id = $1 and id = $2
            limit 1
          `,
          [input.organizationId, input.id],
        )
        return existing.rows[0] ? mapFinanceAccountRow(existing.rows[0]) : null
      }
      values.push(input.organizationId, input.id)
      const result = await pool.query(
        `
          update finance_accounts
          set ${assignments.join(', ')}, updated_at = now()
          where organization_id = $${values.length - 1} and id = $${values.length}
          returning id, code, name, account_type, is_default_cash, is_active,
                    account_number, account_holder, opening_balance, note, notify_on_transaction
        `,
        values,
      )
      if (result.rows[0]) invalidateOrgCache(financeAccountsListCache, pool, input.organizationId)
      return result.rows[0] ? mapFinanceAccountRow(result.rows[0]) : null
    },

    async listPurchaseReceipts(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          select data
          from purchase_receipt_snapshots
          where organization_id = $1
          order by coalesce(nullif(data->>'received_at', '')::timestamptz, created_at) desc
        `,
        [input.organizationId],
      )
      return result.rows.map((row) => row.data as PurchaseReceiptData).filter((receipt) => purchaseReceiptSnapshotMatches(input.url, receipt))
    },

    async getPurchaseReceipt(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          select data
          from purchase_receipt_snapshots
          where organization_id = $1 and (id = $2 or code = $2)
          limit 1
        `,
        [input.organizationId, input.id],
      )
      return result.rows[0]?.data as PurchaseReceiptData | null ?? null
    },

    async savePurchaseReceipt(input) {
      await ensureImportedSnapshotTables(pool)
      await pool.query('begin')
      try {
        await pool.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipts:${input.organizationId}`])
        const existing = await pool.query(
          `
            select id
            from purchase_receipt_snapshots
            where organization_id = $1 and id = $2
            limit 1
          `,
          [input.organizationId, input.receipt.id],
        )
        const receipt = existing.rows[0]
          ? input.receipt
          : await purchaseReceiptWithSafeCode(pool, input.organizationId, input.receipt, input.sourceType)
        if (existing.rows[0]) {
          await pool.query(
            `
              update purchase_receipt_snapshots
              set code = $3, data = $4::jsonb, source_type = $5, updated_at = now()
              where organization_id = $1 and id = $2
            `,
            [
              input.organizationId,
              receipt.id,
              receipt.code,
              JSON.stringify(receipt),
              input.sourceType,
            ],
          )
        } else {
          await pool.query(
            `
              insert into purchase_receipt_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
              values ($1, $2, $3, $4::jsonb, $5, coalesce($6::timestamptz, now()), now())
            `,
            [
              receipt.id,
              input.organizationId,
              receipt.code,
              JSON.stringify(receipt),
              input.sourceType,
              receipt.created_at,
            ],
          )
        }
        await pool.query('commit')
        await recomputeSupplierPurchaseTotals(pool, input.organizationId, receipt.supplier_id)
        return receipt
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async postPurchaseReceipt(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureStockMovementsTable(pool)
      await ensureProductCatalogSchema(pool)
      await ensureSalesFinanceTables(pool)
      const existing = await loadPurchaseReceiptSnapshot(pool, input.organizationId, input.id)
      if (!existing) throw new Error('Purchase receipt not found')
      if (existing.status !== 'draft') {
        return {
          purchase_receipt_id: existing.id,
          status: 'posted' as const,
          posted_at: existing.received_at,
          cashbook_voucher_id: null,
        }
      }

      const postedAt = new Date().toISOString()
      const postedReceipt = {
        ...existing,
        status: 'posted' as const,
        updated_at: postedAt,
      } satisfies PurchaseReceiptData
      const affectedProducts = await replacePurchaseReceiptStockMovements(pool, input.organizationId, postedReceipt)
      await updateLatestPurchaseCostsFromReceipt(pool, input.organizationId, postedReceipt)

      let cashbookVoucherId: string | null = null
      if (postedReceipt.paid_amount > 0) {
        const entry = await purchaseSupplierCashbookEntry(pool, {
          organizationId: input.organizationId,
          supplier: postedReceipt.supplier,
          receipt: postedReceipt,
          amount: postedReceipt.paid_amount,
          paymentMethod: input.paymentMethod ?? 'cash',
          financeAccountId: input.financeAccountId,
          currentUser: input.currentUser,
          note: `Thanh toán ${postedReceipt.code}`,
          suffix: 'post',
        })
        await insertCashbookEntry(pool, input.organizationId, entry)
        cashbookVoucherId = entry.id
      }

      await pool.query(
        `
          update purchase_receipt_snapshots
          set data = $3::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [input.organizationId, existing.id, JSON.stringify(postedReceipt)],
      )
      await recomputeStockMovementBalances(pool, input.organizationId, affectedProducts)
      await recomputeSupplierPurchaseTotals(pool, input.organizationId, postedReceipt.supplier_id)
      return {
        purchase_receipt_id: postedReceipt.id,
        status: 'posted' as const,
        posted_at: postedAt,
        cashbook_voucher_id: cashbookVoucherId,
      }
    },

    async cancelPurchaseReceipt(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureStockMovementsTable(pool)
      const existing = await loadPurchaseReceiptSnapshot(pool, input.organizationId, input.id)
      if (!existing) return null
      if (existing.status === 'cancelled') return existing
      if (existing.paid_amount > 0 || (existing.supplier_payments as Array<{ status: string }>).some((payment) => payment.status === 'posted')) {
        throw new Error('PURCHASE_RECEIPT_HAS_PAYMENTS')
      }

      const cancelledAt = new Date().toISOString()
      const cancelledReceipt = {
        ...existing,
        status: 'cancelled' as const,
        paid_amount: 0,
        remaining_amount: 0,
        updated_at: cancelledAt,
      } satisfies PurchaseReceiptData

      await pool.query('begin')
      try {
        const affectedProducts = await deleteStockMovementsForDocument(pool, input.organizationId, 'purchase_receipt', existing.code)
        await pool.query(
          `
            update purchase_receipt_snapshots
            set data = $3::jsonb, updated_at = now()
            where organization_id = $1 and id = $2
          `,
          [input.organizationId, existing.id, JSON.stringify(cancelledReceipt)],
        )
        await recomputeStockMovementBalances(pool, input.organizationId, affectedProducts)
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      await recomputeSupplierPurchaseTotals(pool, input.organizationId, existing.supplier_id)
      return cancelledReceipt
    },

    async paySupplier(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureSalesFinanceTables(pool)
      const validAllocations = input.allocations.filter((allocation) => allocation.amount > 0)
      if (validAllocations.length === 0) throw new Error('No supplier payment allocations')

      const receipts: PurchaseReceiptData[] = []
      for (const allocation of validAllocations) {
        const receipt = await loadPurchaseReceiptSnapshot(pool, input.organizationId, allocation.purchase_receipt_id)
        if (!receipt) throw new Error('Purchase receipt not found')
        receipts.push(receipt)
      }
      const firstReceipt = receipts[0]
      const totalAmount = validAllocations.reduce((sum, allocation) => sum + allocation.amount, 0)
      const entry = await purchaseSupplierCashbookEntry(pool, {
        organizationId: input.organizationId,
        supplier: firstReceipt.supplier,
        receipt: firstReceipt,
        amount: totalAmount,
        paymentMethod: input.paymentMethod,
        financeAccountId: input.financeAccountId,
        currentUser: input.currentUser,
        note: input.note ?? `Thanh toán NCC ${firstReceipt.supplier.name}`,
        suffix: `pay-${Date.now()}`,
      })

      await pool.query('begin')
      try {
        await insertCashbookEntry(pool, input.organizationId, entry)
        for (const [index, allocation] of validAllocations.entries()) {
          const receipt = receipts[index]
          const amount = Math.min(allocation.amount, Math.max(receipt.remaining_amount, 0))
          const paidAmount = Math.min(receipt.payable_amount, receipt.paid_amount + amount)
          const remainingAmount = Math.max(receipt.payable_amount - paidAmount, 0)
          const payment = {
            id: `${entry.id}-${index + 1}`,
            code: entry.code,
            paid_at: entry.created_at,
            created_by: input.currentUser.user.display_name,
            payment_method: input.paymentMethod,
            status: 'posted' as const,
            amount,
          }
          const updatedReceipt = {
            ...receipt,
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            updated_at: entry.created_at,
            supplier_payments: [...receipt.supplier_payments, payment] as unknown as PurchaseReceiptData['supplier_payments'],
          } as PurchaseReceiptData
          await pool.query(
            `
              update purchase_receipt_snapshots
              set data = $3::jsonb, updated_at = now()
              where organization_id = $1 and id = $2
            `,
            [input.organizationId, receipt.id, JSON.stringify(updatedReceipt)],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      await recomputeSupplierPurchaseTotals(pool, input.organizationId, input.supplierId)

      return {
        supplier_payment_id: entry.id,
        code: entry.code,
        amount: totalAmount,
        cashbook_voucher_id: entry.id,
      }
    },

    async findPurchaseReceiptsByCodes(input) {
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1 from purchase_receipt_snapshots r
            where r.organization_id = $1 and lower(r.code) = lower(requested.code)
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async deleteImportedKiotVietPurchaseReceipts(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureStockMovementsTable(pool)
      await pool.query('begin')
      try {
        const affected = await deleteStockMovementsForDocuments(pool, input.organizationId, 'purchase_receipt')
        const result = await pool.query(
          `
            delete from purchase_receipt_snapshots
            where organization_id = $1 and source_type = 'kiotviet_import'
          `,
          [input.organizationId],
        )
        await recomputeStockMovementBalances(pool, input.organizationId, affected)
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertImportedKiotVietPurchaseReceipts(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureStockMovementsTable(pool)
      const products = await stockProductsByImportCode(pool, input.organizationId)
      let receiptsCreated = 0
      let receiptsUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let skippedRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        const supplier = await snapshotByCode<SupplierListData>(pool, 'supplier_snapshots', input.organizationId, row.supplier_code)
        const product = resolveStockProduct(products, row.product_code)
        if (!supplier || !product) {
          skippedRows += 1
          continue
        }
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      const affectedProducts = new Set<string>()
      await pool.query('begin')
      try {
        for (const [sourceCode, rows] of rowsBySourceCode) {
          const existing = await pool.query('select data from purchase_receipt_snapshots where organization_id = $1 and code = $2 limit 1', [input.organizationId, sourceCode])
          if (existing.rows[0]) receiptsUpdated += 1
          else receiptsCreated += 1
          if (existing.rows[0]) itemsUpdated += rows.length
          else itemsCreated += rows.length

          const first = rows[0]
          const supplier = await snapshotByCode<SupplierListData>(pool, 'supplier_snapshots', input.organizationId, first.supplier_code)
          const receipt = purchaseReceiptDataFromImportRows(sourceCode, rows, supplier)
          await pool.query(
            `
              insert into purchase_receipt_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
              values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now())
              on conflict (organization_id, code)
              do update set data = excluded.data, source_type = excluded.source_type, updated_at = now()
            `,
            [receipt.id, input.organizationId, receipt.code, JSON.stringify(receipt), receipt.received_at],
          )

          const deleted = await deleteStockMovementsForDocument(pool, input.organizationId, 'purchase_receipt', sourceCode)
          for (const productId of deleted) affectedProducts.add(productId)

          if (first.status !== 'posted') continue
          let runningEndingQty = 0
          for (const row of [...rows].sort((left, right) => left.rowNumber - right.rowNumber)) {
            const product = resolveStockProduct(products, row.product_code)
            if (!product?.track_inventory) continue
            const quantityDelta = row.quantity * product.factor
            if (quantityDelta === 0) continue
            runningEndingQty += quantityDelta
            affectedProducts.add(product.id)
            await insertStockMovement(pool, input.organizationId, {
              id: stableUuidFromText(`stock-movement-kv-purchase-${sourceCode}-${row.rowNumber}`),
              productId: product.id,
              movementType: 'purchase_receipt',
              quantityDelta,
              endingQty: runningEndingQty,
              documentType: 'purchase_receipt',
              documentCode: sourceCode,
              transactionPrice: row.unit_cost,
              costPrice: row.unit_cost,
              partnerName: supplier?.name ?? row.supplier_name ?? null,
              createdAt: first.received_at ?? first.source_created_at ?? first.updated_at ?? new Date().toISOString(),
            })
          }
        }
        await recomputeStockMovementBalances(pool, input.organizationId, affectedProducts)
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }

      return {
        receipts_created: receiptsCreated,
        receipts_updated: receiptsUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        skipped_rows: skippedRows,
      }
    },

    async upsertProductGroupsByName(input) {
      const names = [...new Set(input.names.map((name) => name.trim()).filter(Boolean))]
      if (names.length === 0) return new Map()

      await ensureProductCatalogSchema(pool)
      await pool.query('begin')
      try {
        const existing = await pool.query(
          `
            select id, name
            from product_groups
            where organization_id = $1
              and name = any($2::text[])
          `,
          [input.organizationId, names],
        )
        const existingNames = new Set(existing.rows.map((row) => String(row.name)))
        for (const name of names) {
          if (existingNames.has(name)) continue
          const code = productGroupImportCode(name)
          await pool.query(
            `
              insert into product_groups (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
              values ($1, $2, $3, $4, false, true, now(), now())
              on conflict (organization_id, code)
              do update set
                name = excluded.name,
                is_active = true,
                updated_at = now()
            `,
            [randomUUID(), input.organizationId, code, name],
          )
        }
        const result = await pool.query(
          `
            select id, name
            from product_groups
            where organization_id = $1
              and name = any($2::text[])
          `,
          [input.organizationId, names],
        )
        await pool.query('commit')
        return new Map(result.rows.map((row) => [String(row.name), String(row.id)]))
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertProductsByCode(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureProductCatalogSchema(pool)
      await ensureProductUnitTables(pool)
      let created = 0
      let updated = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const result = await pool.query(
            `
              insert into products (
                id, organization_id, code, name, status, product_group_id, unit_name,
                sell_method, product_kind, inventory_shape, track_inventory,
                latest_purchase_cost, latest_purchase_cost_at, created_at, updated_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, case when $12::numeric is null then null else now() end, coalesce($13::timestamptz, now()), now())
              on conflict (organization_id, code)
              do update set
                name = excluded.name,
                status = excluded.status,
                product_group_id = excluded.product_group_id,
                unit_name = excluded.unit_name,
                sell_method = excluded.sell_method,
                product_kind = excluded.product_kind,
                inventory_shape = excluded.inventory_shape,
                track_inventory = excluded.track_inventory,
                latest_purchase_cost = excluded.latest_purchase_cost,
                latest_purchase_cost_at = case
                  when excluded.latest_purchase_cost is distinct from products.latest_purchase_cost then now()
                  else products.latest_purchase_cost_at
                end,
                created_at = coalesce(excluded.created_at, products.created_at),
                updated_at = now()
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              row.code,
              row.name,
              row.status,
              row.product_group_id,
              row.unit_name,
              row.sell_method,
              row.product_kind,
              row.inventory_shape,
              row.track_inventory,
              row.latest_purchase_cost,
              row.source_created_at,
            ],
          )
          const productId = String(result.rows[0]?.id)
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
          const stockUnitId = await upsertInventoryUnit(pool, input.organizationId, row.unit_name)
          await upsertProductInventorySettings(pool, input.organizationId, productId, row, stockUnitId)
          if (row.unit_conversions.length > 0) {
            await upsertProductUnitConversions(pool, input.organizationId, productId, stockUnitId, row.unit_conversions)
          }
        }
        await pool.query('commit')
        return { created, updated, skipped: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertDefaultPriceListItems(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureProductCatalogSchema(pool)
      await ensurePriceListTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const product = await pool.query(
            `
              select id
              from products
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.product_code],
          )
          const productId = product.rows[0]?.id
          if (!productId) {
            skipped += 1
            continue
          }
          const result = await pool.query(
            `
              insert into price_list_items (id, organization_id, price_list_id, product_id, unit_price, created_at, updated_at)
              values ($1, $2, $3::uuid, $4, $5, now(), now())
              on conflict (price_list_id, product_id)
              do update set
                unit_price = excluded.unit_price,
                updated_at = now()
              returning (xmax = 0) as inserted
            `,
            [randomUUID(), input.organizationId, input.priceListId, productId, row.unit_price],
          )
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertPriceListItemsByName(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureProductCatalogSchema(pool)
      await ensurePriceListTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const product = await pool.query(
            `
              select id
              from products
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.product_code],
          )
          const productId = product.rows[0]?.id
          if (!productId) {
            skipped += 1
            continue
          }

          const priceListId = isDefaultPriceListName(row.price_list_name) && input.defaultPriceListId
            ? input.defaultPriceListId
            : await upsertPriceListByName(pool, input.organizationId, row.price_list_name)
          const result = await pool.query(
            `
              insert into price_list_items (id, organization_id, price_list_id, product_id, unit_price, created_at, updated_at)
              values ($1, $2, $3::uuid, $4, $5, now(), now())
              on conflict (price_list_id, product_id)
              do update set
                unit_price = excluded.unit_price,
                updated_at = now()
              returning (xmax = 0) as inserted
            `,
            [randomUUID(), input.organizationId, priceListId, productId, row.unit_price],
          )
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertProvisionalStockBalances(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureProductUnitTables(pool)
      await ensureInventoryProvisionalBalancesTable(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const product = await pool.query(
            `
              select id
              from products
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.product_code],
          )
          const productId = product.rows[0]?.id
          if (!productId) {
            skipped += 1
            continue
          }

          const settings = await pool.query(
            `
              select stock_unit_id::text
              from product_inventory_settings
              where organization_id = $1
                and product_id = $2
              limit 1
            `,
            [input.organizationId, productId],
          )
          const stockUnitId = settings.rows[0]?.stock_unit_id ?? await upsertInventoryUnit(pool, input.organizationId, row.unit_name)
          const result = await pool.query(
            `
              insert into inventory_provisional_balances (
                id, organization_id, product_id, source_type, source_label,
                initial_qty, remaining_qty, stock_unit_id, status, note, created_at, updated_at
              )
              values ($1, $2, $3, 'kiotviet_import', $4, $5, $5, $6, $7, $8, now(), now())
              on conflict (organization_id, product_id, source_type)
              do update set
                source_label = excluded.source_label,
                initial_qty = excluded.initial_qty,
                remaining_qty = excluded.remaining_qty,
                stock_unit_id = excluded.stock_unit_id,
                status = excluded.status,
                note = excluded.note,
                updated_at = now()
              returning (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              productId,
              row.source_label,
              row.quantity,
              stockUnitId,
              row.quantity > 0 ? 'open' : 'closed',
              'Imported from KiotViet product export. Provisional until stock is normalized.',
            ],
          )
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertDraftProductBoms(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureProductBomTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const productId = await findProductIdByCode(pool, input.organizationId, row.product_code)
          if (!productId) {
            skipped += 1
            continue
          }
          const componentIds: Array<{ id: string; quantity: number; sortOrder: number; code: string }> = []
          let missingComponent = false
          for (const [index, component] of row.components.entries()) {
            const componentId = await findProductIdByCode(pool, input.organizationId, component.component_code)
            if (!componentId) {
              missingComponent = true
              break
            }
            componentIds.push({ id: componentId, quantity: component.quantity, sortOrder: index + 1, code: component.component_code })
          }
          if (missingComponent || componentIds.length === 0) {
            skipped += 1
            continue
          }

          const hadExisting = await pool.query(
            `
              select id
              from product_boms
              where organization_id = $1
                and product_id = $2
                and status in ('draft', 'active')
                and notes like 'Imported from KiotViet%'
              limit 1
            `,
            [input.organizationId, productId],
          )
          await pool.query(
            `
              update product_boms
              set status = 'archived'
              where organization_id = $1
                and product_id = $2
                and status in ('draft', 'active')
                and notes like 'Imported from KiotViet%'
            `,
            [input.organizationId, productId],
          )
          const version = await pool.query(
            `
              select coalesce(max(version), 0) + 1 as next_version
              from product_boms
              where organization_id = $1
                and product_id = $2
            `,
            [input.organizationId, productId],
          )
          const bom = await pool.query(
            `
              insert into product_boms (id, organization_id, product_id, version, status, notes, created_at)
              values ($1, $2, $3, $4, 'active', $5, now())
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              productId,
              Number(version.rows[0]?.next_version ?? 1),
              `${row.note} Source: ${row.source_text}`,
            ],
          )
          const bomId = String(bom.rows[0]?.id)
          for (const component of componentIds) {
            await pool.query(
              `
                insert into product_bom_items (
                  id, organization_id, bom_id, component_product_id, quantity,
                  calculation_payload, sort_order, notes
                )
                values ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7)
              `,
              [randomUUID(), input.organizationId, bomId, component.id, component.quantity, component.sortOrder, `KiotViet component ${component.code}`],
            )
          }
          if (hadExisting.rows.length > 0) updated += 1
          else created += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async getProductBom(input) {
      return loadProductBomDetail(pool, input.organizationId, input.productId)
    },

    async upsertProductBom(input) {
      await ensureProductBomTables(pool)
      const product = await pool.query(
        `
          select id::text
          from products
          where organization_id = $1 and id::text = $2
          limit 1
        `,
        [input.organizationId, input.productId],
      )
      if (!product.rows[0]) return null

      const items = input.items ?? []
      for (const item of items) {
        const quantity = Number(item.quantity)
        if (!item.component_product_id || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('BOM item requires component_product_id and quantity > 0')
        }
      }

      await pool.query('begin')
      try {
        await pool.query(
          `
            update product_boms
            set status = 'archived'
            where organization_id = $1
              and product_id = $2
              and status in ('draft', 'active')
          `,
          [input.organizationId, input.productId],
        )
        const version = await pool.query(
          `
            select coalesce(max(version), 0) + 1 as next_version
            from product_boms
            where organization_id = $1
              and product_id = $2
          `,
          [input.organizationId, input.productId],
        )
        const bomId = randomUUID()
        const createdAt = new Date().toISOString()
        await pool.query(
          `
            insert into product_boms (id, organization_id, product_id, version, status, notes, created_at)
            values ($1, $2, $3, $4, 'active', $5, $6::timestamptz)
          `,
          [
            bomId,
            input.organizationId,
            input.productId,
            Number(version.rows[0]?.next_version ?? 1),
            input.notes ?? null,
            createdAt,
          ],
        )
        for (const [index, item] of items.entries()) {
          await pool.query(
            `
              insert into product_bom_items (
                id, organization_id, bom_id, component_product_id, quantity,
                calculation_payload, sort_order, notes
              )
              values ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7)
            `,
            [
              randomUUID(),
              input.organizationId,
              bomId,
              item.component_product_id,
              Number(item.quantity),
              index + 1,
              item.notes ?? null,
            ],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
      return loadProductBomDetail(pool, input.organizationId, input.productId)
    },

    async upsertImportedKiotVietStocktakes(input) {
      if (input.rows.length === 0) {
        return {
          stocktakes_created: 0,
          stocktakes_updated: 0,
          items_created: 0,
          items_updated: 0,
          missing_product_rows: 0,
        }
      }

      await ensureImportedStocktakeTables(pool)
      let stocktakesCreated = 0
      let stocktakesUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let missingProductRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()
      for (const row of input.rows) {
        const groupedRows = rowsBySourceCode.get(row.source_code) ?? []
        groupedRows.push(row)
        rowsBySourceCode.set(row.source_code, groupedRows)
      }

      await pool.query('begin')
      try {
        for (const [sourceCode, rows] of rowsBySourceCode) {
          const firstRow = rows[0]
          const status = importedStocktakeStatus(firstRow.status)
          const note = importedStocktakeNote(rows)
          const sourceCreatorName = importedStocktakeSourceCreatorName(rows)
          const sourceCreatorUserId = await findUserIdByImportedCreator(pool, input.organizationId, sourceCreatorName)
          const stocktake = await pool.query(
            `
              insert into stocktakes (
                id, organization_id, source_system, source_code, code, status, source_type,
                source_created_at, source_balanced_at, source_creator_name, note, balanced_at, created_by,
                created_at, updated_at
              )
              values ($1, $2, $3, $4, $4, $5, 'kiotviet_import', $6, $7, $8, $9, $10, $11, coalesce($6::timestamptz, now()), now())
              on conflict (organization_id, source_system, source_code)
              where source_system is not null and source_code is not null
              do update set
                status = excluded.status,
                source_created_at = excluded.source_created_at,
                source_balanced_at = excluded.source_balanced_at,
                source_creator_name = excluded.source_creator_name,
                note = excluded.note,
                balanced_at = excluded.balanced_at,
                created_by = excluded.created_by,
                updated_at = now()
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              'kiotviet',
              sourceCode,
              status,
              firstRow.source_created_at,
              firstRow.source_balanced_at,
              sourceCreatorName,
              note,
              status === 'balanced' ? firstRow.source_balanced_at : null,
              sourceCreatorUserId,
            ],
          )
          const stocktakeId = String(stocktake.rows[0]?.id)
          if (stocktake.rows[0]?.inserted) stocktakesCreated += 1
          else stocktakesUpdated += 1

          for (const row of rows) {
            const productId = await findProductIdByCode(pool, input.organizationId, row.product_code)
            if (!productId) missingProductRows += 1
            const item = await pool.query(
              `
                insert into stocktake_items (
                  id, organization_id, stocktake_id, line_no, product_id, stock_unit_id,
                  system_qty, actual_qty, difference_qty, note, source_row_number,
                  source_product_code, source_product_name, source_unit_name,
                  line_actual_value, line_difference_value, created_at
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $4, $11, $12, $13, $14, $15, now())
                on conflict (stocktake_id, source_row_number)
                where source_row_number is not null
                do update set
                  line_no = excluded.line_no,
                  product_id = excluded.product_id,
                  stock_unit_id = excluded.stock_unit_id,
                  system_qty = excluded.system_qty,
                  actual_qty = excluded.actual_qty,
                  difference_qty = excluded.difference_qty,
                  note = excluded.note,
                  source_product_code = excluded.source_product_code,
                  source_product_name = excluded.source_product_name,
                  source_unit_name = excluded.source_unit_name,
                  line_actual_value = excluded.line_actual_value,
                  line_difference_value = excluded.line_difference_value
                returning (xmax = 0) as inserted
              `,
              [
                randomUUID(),
                input.organizationId,
                stocktakeId,
                row.rowNumber,
                productId,
                null,
                row.system_qty,
                row.actual_qty,
                row.difference_qty,
                row.note,
                row.product_code,
                row.product_name,
                row.unit_name,
                row.total_actual_value,
                row.line_difference_value,
              ],
            )
            if (item.rows[0]?.inserted) itemsCreated += 1
            else itemsUpdated += 1
          }
        }
        await pool.query('commit')
        return {
          stocktakes_created: stocktakesCreated,
          stocktakes_updated: stocktakesUpdated,
          items_created: itemsCreated,
          items_updated: itemsUpdated,
          missing_product_rows: missingProductRows,
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async deleteDemoStocktakesForImport(input) {
      await ensureImportedStocktakeTables(pool)
      const result = await pool.query(
        `
          delete from stocktakes
          where organization_id = $1
            and source_system = 'kiotviet'
            and source_code = any($2::text[])
        `,
        [input.organizationId, ['KK-JULY', 'KK-JUNE', 'KK-DEMO']],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

    async deleteImportedKiotVietStocktakes(input) {
      await ensureImportedStocktakeTables(pool)
      await pool.query(
        `
          delete from stocktake_items
          where organization_id = $1
            and stocktake_id in (
              select id
              from stocktakes
              where organization_id = $1
                and (
                  source_type = 'kiotviet_import'
                  or source_system = 'kiotviet'
                )
            )
        `,
        [input.organizationId],
      )
      const result = await pool.query(
        `
          delete from stocktakes
          where organization_id = $1
            and (
              source_type = 'kiotviet_import'
              or source_system = 'kiotviet'
            )
        `,
        [input.organizationId],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

    async listStocktakes(input) {
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')
      const status = input.url.searchParams.get('status')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const createdBy = input.url.searchParams.get('created_by')
      const clauses = ['st.organization_id = $1']
      const values: unknown[] = [input.organizationId]

      if (status === '__none__') {
        clauses.push('false')
      } else if (status) {
        const statuses = status.split(',').map((item) => item.trim()).filter(Boolean)
        if (statuses.length > 0) {
          values.push(statuses)
          clauses.push(`st.status = any($${values.length}::text[])`)
        }
      }
      if (from) {
        values.push(from)
        clauses.push(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (to) {
        values.push(to)
        clauses.push(`(coalesce(st.source_created_at, st.created_at) at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        clauses.push(`(
          ${accentInsensitiveSearchSql('st.code')} like $${values.length}
          or ${accentInsensitiveSearchSql("coalesce(st.note, '')")} like $${values.length}
          or exists (
            select 1
            from stocktake_items search_sti
            left join products search_product
              on search_product.organization_id = search_sti.organization_id
              and search_product.id = search_sti.product_id
            where search_sti.organization_id = st.organization_id
              and search_sti.stocktake_id = st.id
              and (
                ${accentInsensitiveSearchSql("coalesce(search_sti.source_product_code, search_product.code, '')")} like $${values.length}
                or ${accentInsensitiveSearchSql("coalesce(search_sti.source_product_name, search_product.name, '')")} like $${values.length}
              )
          )
        )`)
      }
      if (createdBy && createdBy !== 'all') {
        values.push(createdBy)
        clauses.push(`st.created_by = $${values.length}::uuid`)
      }

      const result = await pool.query(
        `
          select
            st.id::text,
            st.code,
            st.status,
            st.source_type,
            st.source_creator_name,
            coalesce(st.source_created_at, st.created_at) as created_at,
            coalesce(st.source_balanced_at, st.balanced_at) as balanced_at,
            coalesce(sum(sti.actual_qty), 0) as total_actual_qty,
            case
              when count(sti.line_actual_value) = 0 then null
              else sum(sti.line_actual_value)
            end as total_actual_value,
            case
              when count(sti.line_difference_value) = 0 then null
              else sum(sti.line_difference_value)
            end as total_difference_value,
            coalesce(sum(greatest(sti.difference_qty, 0)), 0) as increased_qty,
            abs(coalesce(sum(least(sti.difference_qty, 0)), 0)) as decreased_qty,
            created_by_user.id::text as created_by_id,
            created_by_user.display_name as created_by_name,
            (
              select coalesce(nullif(list_sti.source_product_code, ''), list_product.code, '')
              from stocktake_items list_sti
              left join products list_product
                on list_product.organization_id = list_sti.organization_id
                and list_product.id = list_sti.product_id
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_code,
            (
              select coalesce(nullif(list_sti.source_product_name, ''), list_product.name, nullif(list_sti.source_product_code, ''), '')
              from stocktake_items list_sti
              left join products list_product
                on list_product.organization_id = list_sti.organization_id
                and list_product.id = list_sti.product_id
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_name,
            (
              select list_sti.system_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_system_qty,
            (
              select list_sti.actual_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_actual_qty,
            (
              select list_sti.difference_qty
              from stocktake_items list_sti
              where list_sti.organization_id = st.organization_id
                and list_sti.stocktake_id = st.id
              order by list_sti.line_no asc, list_sti.created_at asc
              limit 1
            ) as product_difference_qty,
            st.note
          from stocktakes st
          left join stocktake_items sti on sti.organization_id = st.organization_id and sti.stocktake_id = st.id
          left join users created_by_user on created_by_user.organization_id = st.organization_id and created_by_user.id = st.created_by
          where ${clauses.join(' and ')}
          group by st.id, st.code, st.status, st.source_type, st.source_creator_name, st.source_created_at, st.created_at, st.source_balanced_at, st.balanced_at, created_by_user.id, created_by_user.display_name, st.note
          order by coalesce(st.source_created_at, st.created_at) desc
        `,
        values,
      )

      return result.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        status: row.status === 'draft' || row.status === 'cancelled' ? row.status : 'balanced',
        source_type: row.source_type === 'kiotviet_import' || row.source_type === 'product_edit' ? row.source_type : 'manual',
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        balanced_at: row.balanced_at === null ? null : row.balanced_at?.toISOString?.() ?? row.balanced_at,
        source_creator_name: row.source_creator_name === null ? null : String(row.source_creator_name),
        created_by: row.created_by_id === null || row.created_by_id === undefined ? null : {
          id: String(row.created_by_id),
          name: String(row.created_by_name ?? row.created_by_id),
        },
        total_actual_qty: Number(row.total_actual_qty),
        total_actual_value: row.total_actual_value === null ? null : Number(row.total_actual_value),
        total_difference_value: row.total_difference_value === null ? null : Number(row.total_difference_value),
        increased_qty: Number(row.increased_qty),
        decreased_qty: Number(row.decreased_qty),
        product_code: row.product_code === null || row.product_code === undefined ? null : String(row.product_code),
        product_name: row.product_name === null || row.product_name === undefined ? null : String(row.product_name),
        product_system_qty: row.product_system_qty === null || row.product_system_qty === undefined ? null : Number(row.product_system_qty),
        product_actual_qty: row.product_actual_qty === null || row.product_actual_qty === undefined ? null : Number(row.product_actual_qty),
        product_difference_qty: row.product_difference_qty === null || row.product_difference_qty === undefined ? null : Number(row.product_difference_qty),
        note: row.note === null ? null : String(row.note),
      })) satisfies StocktakeListData[]
    },

    async listStocktakesPage(input) {
      const items = await this.listStocktakes?.(input) ?? []
      const { page, pageSize } = paginationFromUrl(input.url, 15)
      const start = Math.max(0, page - 1) * pageSize
      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        creator_options: stocktakeCreatorOptions(items),
      }
    },

    async getStocktake(input) {
      const header = await pool.query(
        `
          select
            st.id::text,
            st.code,
            st.status,
            st.source_type,
            st.source_creator_name,
            coalesce(st.source_created_at, st.created_at) as created_at,
            coalesce(st.source_balanced_at, st.balanced_at) as balanced_at,
            coalesce(sum(sti.actual_qty), 0) as total_actual_qty,
            case
              when count(sti.line_actual_value) = 0 then null
              else sum(sti.line_actual_value)
            end as total_actual_value,
            case
              when count(sti.line_difference_value) = 0 then null
              else sum(sti.line_difference_value)
            end as total_difference_value,
            coalesce(sum(greatest(sti.difference_qty, 0)), 0) as increased_qty,
            abs(coalesce(sum(least(sti.difference_qty, 0)), 0)) as decreased_qty,
            created_by_user.id::text as created_by_id,
            created_by_user.display_name as created_by_name,
            st.note
          from stocktakes st
          left join stocktake_items sti on sti.organization_id = st.organization_id and sti.stocktake_id = st.id
          left join users created_by_user on created_by_user.organization_id = st.organization_id and created_by_user.id = st.created_by
          where st.organization_id = $1
            and (st.id::text = $2 or st.code = $2 or st.source_code = $2)
          group by st.id, st.code, st.status, st.source_type, st.source_creator_name, st.source_created_at, st.created_at, st.source_balanced_at, st.balanced_at, created_by_user.id, created_by_user.display_name, st.note
          limit 1
        `,
        [input.organizationId, input.id],
      )
      const stocktake = header.rows[0]
      if (!stocktake) return null

      const items = await pool.query(
        `
          select
            sti.id::text,
            sti.line_no,
            sti.product_id::text,
            coalesce(nullif(sti.source_product_code, ''), p.code, '') as product_code,
            coalesce(nullif(sti.source_product_name, ''), p.name, nullif(sti.source_product_code, ''), '') as product_name,
            coalesce(sti.source_unit_name, u.name) as unit_name,
            sti.system_qty,
            sti.actual_qty,
            sti.difference_qty,
            sti.line_actual_value,
            sti.line_difference_value,
            sti.note
          from stocktake_items sti
          left join products p on p.organization_id = sti.organization_id and p.id = sti.product_id
          left join inventory_units u on u.organization_id = sti.organization_id and u.id = sti.stock_unit_id
          where sti.organization_id = $1 and sti.stocktake_id = $2::uuid
          order by sti.line_no asc, sti.created_at asc
        `,
        [input.organizationId, stocktake.id],
      )

      return {
        id: String(stocktake.id),
        code: String(stocktake.code),
        status: stocktake.status === 'draft' || stocktake.status === 'cancelled' ? stocktake.status : 'balanced',
        source_type: stocktake.source_type === 'kiotviet_import' || stocktake.source_type === 'product_edit' ? stocktake.source_type : 'manual',
        created_at: stocktake.created_at?.toISOString?.() ?? stocktake.created_at,
        balanced_at: stocktake.balanced_at === null ? null : stocktake.balanced_at?.toISOString?.() ?? stocktake.balanced_at,
        source_creator_name: stocktake.source_creator_name === null ? null : String(stocktake.source_creator_name),
        created_by: stocktake.created_by_id === null || stocktake.created_by_id === undefined ? null : {
          id: String(stocktake.created_by_id),
          name: String(stocktake.created_by_name ?? stocktake.created_by_id),
        },
        total_actual_qty: Number(stocktake.total_actual_qty),
        total_actual_value: stocktake.total_actual_value === null ? null : Number(stocktake.total_actual_value),
        total_difference_value: stocktake.total_difference_value === null ? null : Number(stocktake.total_difference_value),
        increased_qty: Number(stocktake.increased_qty),
        decreased_qty: Number(stocktake.decreased_qty),
        note: stocktake.note === null ? null : String(stocktake.note),
        items: items.rows.map((row) => ({
          id: String(row.id),
          line_no: Number(row.line_no),
          product_id: row.product_id === null ? null : String(row.product_id),
          product_code: String(row.product_code),
          product_name: String(row.product_name),
          unit_name: row.unit_name === null ? null : String(row.unit_name),
          system_qty: row.system_qty === null ? null : Number(row.system_qty),
          actual_qty: row.actual_qty === null ? null : Number(row.actual_qty),
          difference_qty: row.difference_qty === null ? null : Number(row.difference_qty),
          line_actual_value: row.line_actual_value === null ? null : Number(row.line_actual_value),
          line_difference_value: row.line_difference_value === null ? null : Number(row.line_difference_value),
          note: row.note === null ? null : String(row.note),
        })),
      } satisfies StocktakeDetailData
    },

    async updateStocktakeNote(input) {
      await ensureImportedStocktakeTables(pool)
      const result = await pool.query(
        `
          update stocktakes
          set note = $3
          where organization_id = $1
            and (id::text = $2 or code = $2 or source_code = $2)
          returning id::text
        `,
        [input.organizationId, input.id, input.note],
      )
      const updatedId = result.rows[0]?.id
      if (!updatedId) return null
      return this.getStocktake?.({ organizationId: input.organizationId, id: String(updatedId) }) ?? null
    },

    async cancelStocktake(input) {
      await ensureImportedStocktakeTables(pool)
      const result = await pool.query(
        `
          update stocktakes
          set status = 'cancelled',
              balanced_at = null,
              source_balanced_at = null
          where organization_id = $1
            and (id::text = $2 or code = $2 or source_code = $2)
          returning id::text
        `,
        [input.organizationId, input.id],
      )
      const updatedId = result.rows[0]?.id
      if (!updatedId) return null
      return this.getStocktake?.({ organizationId: input.organizationId, id: String(updatedId) }) ?? null
    },

    async adjustNormalProductStock(input) {
      await ensureImportedStocktakeTables(pool)
      await ensureStockMovementsTable(pool)
      const product = await pool.query(
        `
          select p.id::text, p.code, p.name, p.unit_name, p.latest_purchase_cost
          from products p
          where p.organization_id = $1
            and p.id = $2
            and p.track_inventory = true
          limit 1
        `,
        [input.organizationId, input.productId],
      )
      const productRow = product.rows[0]
      if (!productRow) return null

      const settings = await pool.query(
        `
          select stock_unit_id::text
          from product_inventory_settings
          where organization_id = $1
            and product_id = $2
          limit 1
        `,
        [input.organizationId, input.productId],
      )
      const currentQty = await latestStockMovementQty(pool, input.organizationId, input.productId)
      const differenceQty = input.actualQty - currentQty
      const stocktakeId = randomUUID()
      const stocktakeCode = `KK-QCVL-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
      const costPrice = productRow.latest_purchase_cost === null ? null : Number(productRow.latest_purchase_cost)
      await pool.query('begin')
      try {
        const stocktake = await pool.query(
          `
            insert into stocktakes (
              id, organization_id, source_system, source_code, code, status, source_type,
              source_created_at, source_balanced_at, source_creator_name, note, balanced_at, created_by,
              created_at, updated_at
            )
            values ($1, $2, 'qcvl', $3, $3, 'balanced', 'manual', now(), now(), $4, $5, now(), $6, now(), now())
            returning id::text, code
          `,
          [stocktakeId, input.organizationId, stocktakeCode, input.createdBy.name, input.reason, input.createdBy.id],
        )
        const code = String(stocktake.rows[0]?.code ?? stocktakeCode)
        await pool.query(
          `
            insert into stocktake_items (
              id, organization_id, stocktake_id, line_no, product_id, stock_unit_id,
              system_qty, actual_qty, difference_qty, note, source_row_number,
              source_product_code, source_product_name, source_unit_name,
              line_actual_value, line_difference_value, created_at
            )
            values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, $14, now())
          `,
          [
            randomUUID(),
            input.organizationId,
            stocktakeId,
            input.productId,
            settings.rows[0]?.stock_unit_id ?? null,
            currentQty,
            input.actualQty,
            differenceQty,
            input.reason,
            productRow.code,
            productRow.name,
            productRow.unit_name,
            costPrice === null ? null : input.actualQty * costPrice,
            costPrice === null ? null : differenceQty * costPrice,
          ],
        )
        await insertStockMovement(pool, input.organizationId, {
          id: stableUuidFromText(`stock-movement-manual-stocktake-${code}-${input.productId}`),
          productId: input.productId,
          movementType: 'stocktake_balance',
          quantityDelta: differenceQty,
          endingQty: input.actualQty,
          documentType: 'stocktake',
          documentCode: code,
          transactionPrice: null,
          costPrice,
          partnerName: null,
          createdAt: new Date().toISOString(),
        })
        await recomputeStockMovementBalances(pool, input.organizationId, new Set([input.productId]))
        await pool.query('commit')
        return this.getStocktake?.({ organizationId: input.organizationId, id: stocktakeId }) ?? null
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async createMaterialOpening(input) {
      await ensureProductUnitTables(pool)
      await ensureStockMovementsTable(pool)
      await ensureInventoryMaterialOpeningsTable(pool)
      if (input.input.inventory_shape !== 'normal') {
        throw new Error('MATERIAL_OPENING_SHAPE_NOT_SUPPORTED')
      }
      const product = await materialOpeningProduct(pool, input.organizationId, input.input.product_id)
      if (!product) throw new Error('PRODUCT_NOT_FOUND')
      if (product.inventory_shape !== 'normal') {
        throw new Error('MATERIAL_OPENING_SHAPE_NOT_SUPPORTED')
      }
      const openedUnitId = input.input.opened_unit_id ?? ''
      const openedQty = Number(input.input.opened_qty ?? 0)
      const oldRemainingQty = Number(input.input.old_remaining_qty ?? 0)
      if (!openedUnitId || !Number.isFinite(openedQty) || openedQty <= 0 || !Number.isFinite(oldRemainingQty) || oldRemainingQty < 0) {
        throw new Error('INVALID_MATERIAL_OPENING')
      }
      const stockQtyPerUnit = await materialOpeningStockQtyPerUnit(pool, input.organizationId, product.id, openedUnitId, product.stock_unit_id)
      const openedStockQty = openedQty * stockQtyPerUnit
      const quantityDelta = openedStockQty - oldRemainingQty
      const openingId = randomUUID()
      const createdAt = new Date().toISOString()
      let stockMovementId: string | null = null
      await pool.query('begin')
      try {
        const opening = await pool.query(
          `
            insert into inventory_material_openings (
              id, organization_id, product_id, inventory_shape, source_type,
              opened_unit_id, opened_qty, opened_stock_qty, old_remaining_qty,
              stock_movement_id, note, created_at
            )
            values ($1, $2, $3, 'normal', 'manual_normal', $4, $5, $6, $7, null, $8, $9)
            returning id::text, created_at
          `,
          [openingId, input.organizationId, product.id, openedUnitId, openedQty, openedStockQty, oldRemainingQty, input.input.note ?? null, createdAt],
        )
        if (quantityDelta !== 0) {
          stockMovementId = stableUuidFromText(`stock-movement-material-opening-${openingId}`)
          await insertStockMovement(pool, input.organizationId, {
            id: stockMovementId,
            productId: product.id,
            movementType: 'material_opening',
            quantityDelta,
            endingQty: quantityDelta,
            documentType: 'material_opening',
            documentCode: String(opening.rows[0]?.id ?? openingId),
            transactionPrice: null,
            costPrice: product.latest_purchase_cost,
            partnerName: null,
            createdAt,
          })
          await pool.query(
            `
              update inventory_material_openings
              set stock_movement_id = $3
              where organization_id = $1 and id = $2
            `,
            [input.organizationId, openingId, stockMovementId],
          )
          await recomputeStockMovementBalances(pool, input.organizationId, new Set([product.id]))
        }
        await pool.query('commit')
        return {
          id: String(opening.rows[0]?.id ?? openingId),
          product_id: product.id,
          inventory_shape: 'normal',
          source_type: 'manual_normal',
          opened_unit_id: openedUnitId,
          opened_qty: openedQty,
          opened_stock_qty: openedStockQty,
          stock_movement_id: stockMovementId,
          warnings: [],
          created_at: opening.rows[0]?.created_at?.toISOString?.() ?? createdAt,
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async deleteDemoProductsForImport(input) {
      await ensureProductCatalogSchema(pool)
      const candidates = await pool.query(
        `
          select id
          from products
          where organization_id = $1
            and (
              code like 'DEV20-SP-%'
              or code in ('MICA-3MM', 'DECAL-PP', 'CUT-CNC')
            )
        `,
        [input.organizationId],
      )
      const candidateIds = candidates.rows.map((row) => String(row.id))
      if (candidateIds.length === 0) return { deleted: 0, blocked: 0 }

      const referenced = new Set<string>()
      for (const guard of productReferenceGuards) {
        for (const productId of await referencedProductIds(pool, guard.table, guard.column, input.organizationId, candidateIds)) {
          referenced.add(productId)
        }
      }
      const deletable = candidateIds.filter((productId) => !referenced.has(productId))
      if (deletable.length === 0) return { deleted: 0, blocked: referenced.size }

      const result = await pool.query(
        `
          delete from products
          where organization_id = $1
            and id = any($2::uuid[])
        `,
        [input.organizationId, deletable],
      )
      return { deleted: result.rowCount ?? 0, blocked: referenced.size }
    },

    async deleteImportedKiotVietProducts(input) {
      await ensureProductCatalogSchema(pool)
      await ensureProductUnitTables(pool)
      await ensureInventoryProvisionalBalancesTable(pool)
      await ensureProductBomTables(pool)

      await pool.query('begin')
      try {
        await pool.query(
          `
            delete from inventory_provisional_balances
            where organization_id = $1
              and source_type = 'kiotviet_import'
          `,
          [input.organizationId],
        )
        await pool.query(
          `
            delete from product_boms
            where organization_id = $1
              and notes like 'Imported from KiotViet%'
          `,
          [input.organizationId],
        )
        const candidates = await pool.query(
          `
            select id
            from products
            where organization_id = $1
          `,
          [input.organizationId],
        )
        const candidateIds = candidates.rows.map((row) => String(row.id))
        if (candidateIds.length === 0) {
          await pool.query('commit')
          return { deleted: 0, blocked: 0 }
        }

        await deleteOptionalImportRows(
          pool,
          `
            delete from price_list_items
            where organization_id = $1
              and product_id = any($2::uuid[])
          `,
          [input.organizationId, candidateIds],
        )

        const guards = productReferenceGuards.filter((guard) => guard.table !== 'price_list_items' && guard.table !== 'product_boms')
        const referenced = new Set<string>()
        for (const guard of guards) {
          for (const productId of await referencedProductIds(pool, guard.table, guard.column, input.organizationId, candidateIds, {
            inTransaction: true,
          })) {
            referenced.add(productId)
          }
        }
        const deletable = candidateIds.filter((productId) => !referenced.has(productId))
        if (deletable.length === 0) {
          await pool.query('commit')
          return { deleted: 0, blocked: referenced.size }
        }

        const result = await pool.query(
          `
            delete from products
            where organization_id = $1
              and id = any($2::uuid[])
          `,
          [input.organizationId, deletable],
        )
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: referenced.size }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async ensureSalesFinanceSeed(input) {
      await ensureSalesFinanceTables(pool)
      const count = await pool.query('select count(*)::int as count from orders where organization_id = $1', [input.organizationId])
      if (Number(count.rows[0]?.count ?? 0) > 0) return

      await pool.query('begin')
      try {
        for (const document of input.documents) {
          await insertSalesDocument(pool, input.organizationId, document)
        }
        for (const entry of input.cashbookEntries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertImportedKiotVietCustomerDebtAdjustments(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureSalesFinanceTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0

      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const customer = await snapshotByCode<CustomerListData>(pool, 'customer_snapshots', input.organizationId, row.customer_code)
          if (!customer) {
            skipped += 1
            continue
          }
          const existing = await pool.query(
            `
              select id
              from customer_debt_adjustments
              where organization_id = $1
                and source_system = 'kiotviet'
                and source_code = $2
              limit 1
            `,
            [input.organizationId, row.source_code],
          )
          if (existing.rows[0]) updated += 1
          else created += 1

          await pool.query(
            `
              insert into customer_debt_adjustments (
                id, organization_id, customer_id, customer_snapshot, source_code, source_system,
                source_file, source_row, transaction_type, amount_delta, paid_amount,
                remaining_amount, balance_after, status, created_at, updated_at
              )
              values (
                $1, $2, $3, $4::jsonb, $5, 'kiotviet',
                $6, $7, $8, $9, 0,
                $10, $11, 'closed', coalesce($12::timestamptz, now()), now()
              )
              on conflict (organization_id, source_system, source_code)
              do update set
                customer_id = excluded.customer_id,
                customer_snapshot = excluded.customer_snapshot,
                source_file = excluded.source_file,
                source_row = excluded.source_row,
                transaction_type = excluded.transaction_type,
                amount_delta = excluded.amount_delta,
                paid_amount = 0,
                remaining_amount = excluded.remaining_amount,
                balance_after = excluded.balance_after,
                status = excluded.status,
                created_at = excluded.created_at,
                updated_at = now()
            `,
            [
              `customer-debt-adjustment-kv-${hashText(row.source_code)}`,
              input.organizationId,
              customer.id,
              JSON.stringify({ id: customer.id, code: customer.code, name: customer.name, phone: customer.phone ?? null }),
              row.source_code,
              row.source_file,
              row.rowNumber,
              row.transaction_type,
              row.amount_delta,
              row.amount_delta,
              row.balance_after,
              row.transaction_time,
            ],
          )
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertImportedKiotVietCashbook(input) {
      await ensureFinanceAccountsTable(pool)
      await ensureSalesFinanceTables(pool)
      await ensureImportedSnapshotTables(pool)
      let accountsCreated = 0
      let accountsUpdated = 0
      let entriesCreated = 0
      let entriesUpdated = 0
      const rows = preferPostedKiotVietCashbookRows(input.rows)

      await pool.query('begin')
      try {
        for (const row of rows) {
          const account = financeAccountFromKiotVietCashbookRow(row)
          const existingAccount = await pool.query(
            `
              select id
              from finance_accounts
              where organization_id = $1
                and id = $2
              limit 1
            `,
            [input.organizationId, account.id],
          )
          if (existingAccount.rows[0]) accountsUpdated += 1
          else accountsCreated += 1
          await pool.query(
            `
              insert into finance_accounts (
                id, organization_id, code, name, account_type, is_default_cash, is_active,
                account_number, account_holder, opening_balance, note, notify_on_transaction, updated_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
              on conflict (organization_id, id)
              do update set
                code = excluded.code,
                name = excluded.name,
                account_type = excluded.account_type,
                is_default_cash = excluded.is_default_cash,
                is_active = excluded.is_active,
                account_number = excluded.account_number,
                account_holder = excluded.account_holder,
                note = excluded.note,
                notify_on_transaction = excluded.notify_on_transaction,
                updated_at = now()
            `,
            [
              account.id,
              input.organizationId,
              account.code,
              account.name,
              account.account_type,
              account.is_default_cash,
              account.is_active,
              account.account_number ?? null,
              account.account_holder ?? null,
              account.opening_balance ?? 0,
              account.note ?? null,
              account.notify_on_transaction ?? false,
            ],
          )

          const linkedOrderCode = linkedInvoiceCodeFromKiotVietCashbookCode(row.source_code)
          const linkedCustomer = row.counterparty_code
            ? await snapshotByCode<CustomerListData>(pool, 'customer_snapshots', input.organizationId, row.counterparty_code)
            : null
          const entryId = `cashbook-kv-${hashText(row.source_code)}`
          const note = [row.source_note, row.transfer_content].filter(Boolean).join(' - ')
          const existingEntry = await pool.query(
            `
              select id
              from cashbook_entries
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.source_code],
          )
          if (existingEntry.rows[0]) entriesUpdated += 1
          else entriesCreated += 1

          await pool.query(
            `
              insert into cashbook_entries (
                id, organization_id, code, status, direction, amount_delta, finance_account,
                counterparty, note, source_type, source, allocations, is_business_accounted, created_by, created_at
              )
              values (
                $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, 'kiotviet_cashbook', $10::jsonb, '[]'::jsonb, true, null, coalesce($11::timestamptz, now())
              )
              on conflict (organization_id, code)
              do update set
                status = excluded.status,
                direction = excluded.direction,
                amount_delta = excluded.amount_delta,
                finance_account = excluded.finance_account,
                counterparty = excluded.counterparty,
                note = excluded.note,
                source_type = 'kiotviet_cashbook',
                source = excluded.source,
                allocations = '[]'::jsonb,
                created_at = excluded.created_at
            `,
            [
              entryId,
              input.organizationId,
              row.source_code,
              row.status,
              row.direction,
              row.amount_delta,
              JSON.stringify({
                id: account.id,
                code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
                name: account.name,
                account_type: account.account_type,
                account_number: account.account_number,
                account_holder: account.account_holder,
              }),
              JSON.stringify({
                type: linkedCustomer ? 'customer' : 'other',
                name: row.counterparty_name ?? row.counterparty_code ?? '',
                phone: row.counterparty_phone,
              }),
              note,
              JSON.stringify({
                type: 'kiotviet_cashbook',
                id: row.source_code,
                code: row.source_code,
                order_code: linkedOrderCode,
                customer_id: linkedCustomer?.id ?? null,
                source_created_at: row.source_created_at,
                source_creator_name: row.source_creator_name,
                category_name: row.category_name,
                transfer_content: row.transfer_content,
                source_note: row.source_note,
                counterparty_code: row.counterparty_code,
                counterparty_address: row.counterparty_address,
              }),
              row.entry_time,
            ],
          )
        }
        await rebuildImportedKiotVietCashbookAllocations(pool, input.organizationId)
        invalidateOrgCache(financeAccountsListCache, pool, input.organizationId)
        await pool.query('commit')
        return {
          accounts_created: accountsCreated,
          accounts_updated: accountsUpdated,
          entries_created: entriesCreated,
          entries_updated: entriesUpdated,
          skipped_rows: Math.max(input.rows.length - rows.length, 0),
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async deleteImportedKiotVietCashbook(input) {
      await ensureSalesFinanceTables(pool)
      await ensureImportedSnapshotTables(pool)
      await pool.query('begin')
      try {
        const result = await pool.query(
          `
            delete from cashbook_entries
            where organization_id = $1
              and source_type = 'kiotviet_cashbook'
          `,
          [input.organizationId],
        )
        await rebuildImportedKiotVietCashbookAllocations(pool, input.organizationId)
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async findSalesDocumentsByCodes(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1 from orders o
            where o.organization_id = $1 and lower(o.code) = lower(requested.code)
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async deleteImportedKiotVietInvoices(input) {
      await ensureSalesFinanceTables(pool)
      await ensureStockMovementsTable(pool)
      await pool.query('begin')
      try {
        const affected = await deleteStockMovementsForDocuments(pool, input.organizationId, 'sale_invoice')
        const result = await pool.query(
          `
            delete from orders
            where organization_id = $1
              and code like 'HD%'
          `,
          [input.organizationId],
        )
        await recomputeStockMovementBalances(pool, input.organizationId, affected)
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertImportedKiotVietInvoices(input) {
      await ensureImportedSnapshotTables(pool)
      await ensureSalesFinanceTables(pool)
      await ensureStockMovementsTable(pool)
      await ensureProductBomTables(pool)
      const products = await stockProductsByImportCode(pool, input.organizationId)
      const bomComponentsByProductId = await draftBomComponentsByProductId(pool, input.organizationId)
      let invoicesCreated = 0
      let invoicesUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let skippedRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        const customer = await snapshotByCode<CustomerListData>(pool, 'customer_snapshots', input.organizationId, row.customer_code)
        const product = resolveStockProduct(products, row.product_code)
        if (!customer || !product) {
          skippedRows += 1
          continue
        }
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      const affectedProducts = new Set<string>()
      await pool.query('begin')
      try {
        for (const [sourceCode, rows] of rowsBySourceCode) {
          const existing = await pool.query('select id from orders where organization_id = $1 and code = $2 limit 1', [input.organizationId, sourceCode])
          if (existing.rows[0]) invoicesUpdated += 1
          else invoicesCreated += 1
          if (existing.rows[0]) itemsUpdated += rows.length
          else itemsCreated += rows.length

          const first = rows[0]
          const customer = await snapshotByCode<CustomerListData>(pool, 'customer_snapshots', input.organizationId, first.customer_code)
          const document = salesDocumentDataFromImportRows(sourceCode, rows, customer)
          await insertSalesDocument(pool, input.organizationId, document)

          const deleted = await deleteStockMovementsForDocument(pool, input.organizationId, 'sale_invoice', sourceCode)
          for (const productId of deleted) affectedProducts.add(productId)

          if (first.status !== 'completed') continue
          let runningEndingQty = 0
          for (const row of [...rows].sort((left, right) => left.rowNumber - right.rowNumber)) {
            const product = resolveStockProduct(products, row.product_code)
            if (!product) continue
            const saleUnitFactor = row.stock_qty_per_sale_unit && row.stock_qty_per_sale_unit > 0 ? row.stock_qty_per_sale_unit : product.factor
            const soldQuantity = row.quantity * saleUnitFactor
            if (product.track_inventory) {
              const quantityDelta = -soldQuantity
              if (quantityDelta !== 0) {
                runningEndingQty += quantityDelta
                affectedProducts.add(product.id)
                await insertStockMovement(pool, input.organizationId, {
                  id: stableUuidFromText(`stock-movement-kv-sale-${sourceCode}-${row.rowNumber}`),
                  productId: product.id,
                  movementType: 'sale_deduction',
                  quantityDelta,
                  endingQty: runningEndingQty,
                  documentType: 'sale_invoice',
                  documentCode: sourceCode,
                  transactionPrice: row.unit_price,
                  costPrice: product.latest_purchase_cost,
                  partnerName: customer?.name ?? row.customer_name,
                  createdAt: first.created_at ?? first.updated_at ?? new Date().toISOString(),
                })
              }
            }
            for (const component of bomComponentsByProductId.get(product.id) ?? []) {
              if (!component.trackInventory) continue
              const quantityDelta = -soldQuantity * component.quantity * component.factor
              if (quantityDelta === 0) continue
              affectedProducts.add(component.productId)
              await insertStockMovement(pool, input.organizationId, {
                id: stableUuidFromText(`stock-movement-kv-sale-bom-${sourceCode}-${row.rowNumber}-${component.productId}`),
                productId: component.productId,
                movementType: 'sale_deduction',
                quantityDelta,
                endingQty: null,
                documentType: 'sale_invoice',
                documentCode: sourceCode,
                transactionPrice: null,
                costPrice: component.latestPurchaseCost,
                partnerName: customer?.name ?? row.customer_name,
                createdAt: first.created_at ?? first.updated_at ?? new Date().toISOString(),
              })
            }
          }
        }
        await recomputeStockMovementBalances(pool, input.organizationId, affectedProducts)
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }

      return {
        invoices_created: invoicesCreated,
        invoices_updated: invoicesUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        skipped_rows: skippedRows,
      }
    },

    async saveSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      await ensureStockMovementsTable(pool)
      await pool.query('begin')
      try {
        await insertSalesDocument(pool, input.organizationId, input.document)

        if (input.cashbookEntries.length > 0) {
          const receiptId = input.cashbookEntries[0].id
          const receiptCode = input.cashbookEntries[0].code
          const totalReceived = input.cashbookEntries.reduce((sum, entry) => sum + Math.max(entry.amount_delta, 0), 0)
          await pool.query(
            `
              insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [receiptId, input.organizationId, receiptCode, input.document.customer.id, input.document.id, totalReceived, input.cashbookEntries[0].note, input.cashbookEntries[0].created_at],
          )

          for (const entry of input.cashbookEntries) {
            await pool.query(
              `
                insert into payment_receipt_methods (
                  organization_id, payment_receipt_id, order_id, method,
                  finance_account_id, amount, allocations, created_at
                )
                values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7)
              `,
              [
                input.organizationId,
                receiptId,
                input.document.id,
                entry.finance_account.account_type === 'bank' ? 'bank_transfer' : 'cash',
                entry.finance_account.id,
                Math.abs(entry.amount_delta),
                entry.created_at,
              ],
            )
          }
        }

        for (const entry of input.cashbookEntries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }

        await saveSalesDocumentStockMovements(pool, input.organizationId, input.document)

        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async reviseSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      await ensureStockMovementsTable(pool)
      await pool.query('begin')
      try {
        const originalResult = await pool.query<PgOrderRow>(
          `
            select *
            from orders
            where organization_id = $1
              and (id = $2 or code = $3)
            limit 1
          `,
          [input.organizationId, input.originalOrderId, input.originalOrderCode],
        )
        const originalRow = originalResult.rows[0]
        if (!originalRow) {
          await pool.query('rollback')
          return null
        }

        const revisionResult = await pool.query<{ max_revision: number }>(
          `
            select coalesce(max(revision_no), 0)::int as max_revision
            from orders
            where organization_id = $1
              and regexp_replace(code, '\\.\\d+$', '') = $2
          `,
          [input.organizationId, input.document.base_code ?? input.originalOrderCode.replace(/\.\d+$/, ''),],
        )
        const baseCode = input.document.base_code ?? originalRow.base_code ?? originalRow.code.replace(/\.\d+$/, '')
        const nextRevisionNo = Math.max(Number(revisionResult.rows[0]?.max_revision ?? 0), Number(input.document.revision_no ?? 0)) || 0
        const revisionNo = nextRevisionNo > 0 ? nextRevisionNo : 1
        const revisedDocument: SalesDocumentData = {
          ...input.document,
          base_code: baseCode,
          revision_no: revisionNo,
          revised_from_order_id: originalRow.id,
        }

        await insertSalesDocument(pool, input.organizationId, revisedDocument)

        await pool.query(
          `
            update orders
            set status = 'cancelled',
                replaced_by_order_id = $3,
                cancel_reason_type = 'revised',
                updated_at = now()
            where organization_id = $1
              and id = $2
          `,
          [input.organizationId, originalRow.id, revisedDocument.id],
        )
        await pool.query(
          `
            update customer_debt_entries
            set status = 'closed',
                remaining_debt = 0,
                updated_at = now()
            where organization_id = $1
              and order_id = $2
              and status = 'open'
          `,
          [input.organizationId, originalRow.id],
        )

        if (input.cashbookEntries.length > 0) {
          const receiptId = input.cashbookEntries[0].id
          const receiptCode = input.cashbookEntries[0].code
          const totalReceived = input.cashbookEntries.reduce((sum, entry) => sum + Math.max(entry.amount_delta, 0), 0)
          await pool.query(
            `
              insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [receiptId, input.organizationId, receiptCode, revisedDocument.customer.id, revisedDocument.id, totalReceived, input.cashbookEntries[0].note, input.cashbookEntries[0].created_at],
          )
          for (const entry of input.cashbookEntries) {
            await pool.query(
              `
                insert into payment_receipt_methods (
                  organization_id, payment_receipt_id, order_id, method,
                  finance_account_id, amount, allocations, created_at
                )
                values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7)
              `,
              [
                input.organizationId,
                receiptId,
                revisedDocument.id,
                entry.finance_account.account_type === 'bank' ? 'bank_transfer' : 'cash',
                entry.finance_account.id,
                Math.abs(entry.amount_delta),
                entry.created_at,
              ],
            )
          }
        }

        for (const entry of input.cashbookEntries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }

        await saveSalesDocumentStockMovements(pool, input.organizationId, revisedDocument)
        await pool.query('commit')
        return this.getSalesDocument?.({ organizationId: input.organizationId, id: revisedDocument.id }) ?? revisedDocument
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async listSalesDocumentsPage(input) {
      await ensureSalesFinanceTables(pool)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const page = positiveInt(input.url.searchParams.get('page'), 1)
      const pageSize = positiveInt(input.url.searchParams.get('page_size'), 20)
      const offset = (page - 1) * pageSize
      const values: unknown[] = [input.organizationId]
      const filters = ['o.organization_id = $1']
      const type = filterValues(input.url, 'type')
      const status = filterValues(input.url, 'status')
      const customerId = input.url.searchParams.get('customer_id')
      const paymentStatus = filterValues(input.url, 'payment_status')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? '')

      if (type.length > 0) {
        values.push(type)
        filters.push(`o.order_type = any($${values.length}::text[])`)
      }
      if (status.length > 0) {
        values.push(status)
        filters.push(`o.status = any($${values.length}::text[])`)
      }
      if (customerId) {
        values.push(customerId)
        filters.push(`o.customer_id = $${values.length}`)
      }
      if (paymentStatus.length > 0) {
        values.push(paymentStatus)
        filters.push(`o.payment_status = any($${values.length}::text[])`)
      }
      if (from) {
        values.push(from)
        filters.push(`(o.created_at at time zone 'UTC')::date >= $${values.length}::date`)
      }
      if (to) {
        values.push(to)
        filters.push(`(o.created_at at time zone 'UTC')::date <= $${values.length}::date`)
      }
      if (search) {
        values.push(`%${search}%`)
        filters.push(`(
          ${accentInsensitiveSearchSql('o.code')} like $${values.length}
          or ${accentInsensitiveSearchSql("coalesce(o.customer_snapshot->>'code', '')")} like $${values.length}
          or ${accentInsensitiveSearchSql("coalesce(o.customer_snapshot->>'name', '')")} like $${values.length}
          or ${accentInsensitiveSearchSql("coalesce(o.note, '')")} like $${values.length}
        )`)
      }

      const summaryValues = [...values]
      values.push(pageSize, offset)
      const limitPlaceholder = `$${values.length - 1}`
      const offsetPlaceholder = `$${values.length}`
      const result = await pool.query(
        `
          with filtered_orders as (
            select o.*
            from orders o
            where ${filters.join(' and ')}
          ),
          filtered_summary as (
            select
              count(*)::int as total,
              coalesce(sum(total_amount), 0) as summary_total_amount,
              coalesce(sum(debt_amount), 0) as summary_debt_amount
            from filtered_orders
          ),
          paged_orders as (
            select *
            from filtered_orders
            order by updated_at desc, created_at desc
            limit ${limitPlaceholder}
            offset ${offsetPlaceholder}
          ),
          paged_items as (
            select
              oi.order_id,
              coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'product_id', oi.product_id,
                    'product_snapshot',
                      case
                        when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                        when p.id is not null then jsonb_build_object(
                          'code', p.code,
                          'name', p.name,
                          'unit_name', p.unit_name,
                          'sell_method', p.sell_method
                        )
                        else '{}'::jsonb
                      end,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'discount_amount', oi.discount_amount,
                    'line_total', oi.line_total,
                    'width_m', oi.width_m,
                    'height_m', oi.height_m,
                    'linear_m', oi.linear_m,
                    'note', oi.note
                  ) order by oi.sort_order
                ) filter (where oi.id is not null),
                '[]'::jsonb
              ) as items
            from order_items oi
            join paged_orders po on po.id = oi.order_id
            left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
            group by oi.order_id
          )
          select
            po.*,
            coalesce(pi.items, '[]'::jsonb) as items,
            fs.total,
            fs.summary_total_amount,
            fs.summary_debt_amount
          from paged_orders po
          cross join filtered_summary fs
          left join paged_items pi on pi.order_id = po.id
          order by po.updated_at desc, po.created_at desc
        `,
        values,
      )
      const firstRow = result.rows[0]
      let total = Number(firstRow?.total ?? 0)
      let summaryTotalAmount = Number(firstRow?.summary_total_amount ?? 0)
      let summaryDebtAmount = Number(firstRow?.summary_debt_amount ?? 0)
      if (!firstRow) {
        const summaryResult = await pool.query(
          `
            select
              count(*)::int as total,
              coalesce(sum(o.total_amount), 0) as summary_total_amount,
              coalesce(sum(o.debt_amount), 0) as summary_debt_amount
            from orders o
            where ${filters.join(' and ')}
          `,
          summaryValues,
        )
        total = Number(summaryResult.rows[0]?.total ?? 0)
        summaryTotalAmount = Number(summaryResult.rows[0]?.summary_total_amount ?? 0)
        summaryDebtAmount = Number(summaryResult.rows[0]?.summary_debt_amount ?? 0)
      }
      return {
        items: result.rows
          .map(mapOrderRow)
          .map((document) => hydrateSalesDocumentUserSnapshot(document, userDisplayNames)),
        total,
        summary: {
          total_amount: summaryTotalAmount,
          debt_amount: summaryDebtAmount,
        },
      }
    },

    async listSalesDocuments(input) {
      await ensureSalesFinanceTables(pool)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'product_id', oi.product_id,
                  'product_snapshot',
                    case
                      when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                      when p.id is not null then jsonb_build_object(
                        'code', p.code,
                        'name', p.name,
                        'unit_name', p.unit_name,
                        'sell_method', p.sell_method
                      )
                      else '{}'::jsonb
                    end,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount_amount', oi.discount_amount,
                  'line_total', oi.line_total,
                  'width_m', oi.width_m,
                  'height_m', oi.height_m,
                  'linear_m', oi.linear_m,
                  'note', oi.note
                ) order by oi.sort_order
              )
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
          where o.organization_id = $1
          group by o.id
          order by o.updated_at desc, o.created_at desc
        `,
        [input.organizationId],
      )
      return result.rows
        .map(mapOrderRow)
        .map((document) => hydrateSalesDocumentUserSnapshot(document, userDisplayNames))
        .filter((document) => salesDocumentMatches(input.url, document))
    },

    async getSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select
            o.*,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'product_id', oi.product_id,
                  'product_snapshot',
                    case
                      when oi.product_snapshot <> '{}'::jsonb then oi.product_snapshot
                      when p.id is not null then jsonb_build_object(
                        'code', p.code,
                        'name', p.name,
                        'unit_name', p.unit_name,
                        'sell_method', p.sell_method
                      )
                      else '{}'::jsonb
                    end,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount_amount', oi.discount_amount,
                  'line_total', oi.line_total,
                  'width_m', oi.width_m,
                  'height_m', oi.height_m,
                  'linear_m', oi.linear_m,
                  'note', oi.note
                ) order by oi.sort_order
              )
                filter (where oi.id is not null),
              '[]'::jsonb
            ) as items
          from orders o
          left join order_items oi on oi.order_id = o.id
          left join products p on p.organization_id = oi.organization_id and p.id::text = oi.product_id
          where o.organization_id = $1 and (o.id = $2 or o.code = $2)
          group by o.id
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!result.rows[0]) return null
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const document = hydrateSalesDocumentUserSnapshot(mapOrderRow(result.rows[0]), userDisplayNames)
      const paymentReceipts = await listSalesDocumentPaymentReceipts(pool, input.organizationId, document, userDisplayNames)
      const billCustomer = await loadCustomerBillPrintExtras(
        pool,
        input.organizationId,
        document.customer.id,
        document.customer.code,
      )
      return {
        ...document,
        customer: {
          ...document.customer,
          preferred_bill_template: billCustomer.preferred_bill_template,
          preferred_bill_templates: billCustomer.preferred_bill_templates,
          address: billCustomer.address,
          total_debt_amount: billCustomer.total_debt_amount,
        },
        payment_receipts: paymentReceipts,
      }
    },

    async cancelSalesDocument(input) {
      await ensureSalesFinanceTables(pool)
      await pool.query('begin')
      try {
        const result = await pool.query(
          `
            update orders
            set status = 'cancelled',
                payment_status = case when order_type = 'invoice' then payment_status else payment_status end,
                updated_at = now()
            where organization_id = $1
              and (id = $2 or code = $2)
              and status <> 'cancelled'
            returning id
          `,
          [input.organizationId, input.id],
        )
        const orderId = result.rows[0]?.id
        if (!orderId) {
          await pool.query('rollback')
          return this.getSalesDocument?.({ organizationId: input.organizationId, id: input.id }) ?? null
        }
        await pool.query(
          `
            update customer_debt_entries
            set status = 'closed',
                remaining_debt = 0,
                updated_at = now()
            where organization_id = $1
              and order_id = $2
              and status = 'open'
          `,
          [input.organizationId, orderId],
        )
        await pool.query('commit')
        return this.getSalesDocument?.({ organizationId: input.organizationId, id: String(orderId) }) ?? null
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async updateSalesDocumentNote(input) {
      await ensureSalesFinanceTables(pool)
      const assignments: string[] = ['updated_at = now()']
      const values: unknown[] = [input.organizationId, input.id]
      if (input.note !== undefined) {
        values.push(input.note ?? '')
        assignments.unshift(`note = $${values.length}`)
      }
      if (input.created_at !== undefined) {
        values.push(input.created_at)
        assignments.unshift(`created_at = $${values.length}::timestamptz`)
      }
      const result = await pool.query(
        `
          update orders
          set ${assignments.join(', ')}
          where organization_id = $1
            and (id = $2 or code = $2)
          returning id, code
        `,
        values,
      )
      const orderId = result.rows[0]?.id
      const orderCode = result.rows[0]?.code
      if (!orderId) return null
      const sameSaleReceiptBaseCode = salesDocumentSameSaleReceiptBaseCode(orderCode)
      if (input.created_at !== undefined && sameSaleReceiptBaseCode) {
        await pool.query(
          `
            update payment_receipts
            set created_at = $3::timestamptz
            where organization_id = $1
              and order_id = $2
              and (code = $4 or code like $4 || '-%')
          `,
          [input.organizationId, orderId, input.created_at, sameSaleReceiptBaseCode],
        )
        await pool.query(
          `
            update payment_receipt_methods
            set created_at = $3::timestamptz
            where organization_id = $1
              and payment_receipt_id in (
                select id
                from payment_receipts
                where organization_id = $1
                  and order_id = $2
                  and (code = $4 or code like $4 || '-%')
              )
          `,
          [input.organizationId, orderId, input.created_at, sameSaleReceiptBaseCode],
        ).catch((error: unknown) => {
          if (isMissingGuardRelationError(error)) return
          throw error
        })
        await pool.query(
          `
            update cashbook_entries
            set created_at = $2::timestamptz
            where organization_id = $1
              and source_type = 'payment_receipt_method'
              and (code = $3 or code like $3 || '-%')
          `,
          [input.organizationId, input.created_at, sameSaleReceiptBaseCode],
        )
      }
      return this.getSalesDocument?.({ organizationId: input.organizationId, id: String(orderId) }) ?? null
    },

    async getCustomerDebt(input) {
      await ensureSalesFinanceTables(pool)
      await ensureImportedSnapshotTables(pool)
      const [totalsResult, result, ledgerInvoiceResult, adjustmentResult, linkedSupplierReceiptResult] = await Promise.all([
        pool.query<CustomerDebtTotalsRow>(
          customerDebtTotalsSql({ singleCustomer: true }),
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              o.id,
              o.code,
              o.created_at,
              o.total_amount,
              o.paid_amount,
              o.debt_amount,
              coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt,
              coalesce(cde.updated_at, o.updated_at) as debt_updated_at
            from orders o
            left join customer_debt_entries cde
              on cde.organization_id = o.organization_id
             and cde.order_id = o.id
             and cde.status = 'open'
             and cde.remaining_debt > 0
            where o.organization_id = $1
              and o.customer_id = $2
              and o.order_type = 'invoice'
              and o.status <> 'cancelled'
              and coalesce(cde.remaining_debt, o.debt_amount) > 0
            order by debt_updated_at desc, o.created_at desc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              o.id,
              o.code,
              o.created_at,
              o.total_amount as ledger_total_amount
            from orders o
            where o.organization_id = $1
              and o.customer_id = $2
              and o.order_type = 'invoice'
              and o.status <> 'cancelled'
            order by o.created_at asc, o.code asc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select id, source_code, created_at, transaction_type, amount_delta, paid_amount, remaining_amount, balance_after, source_file
            from customer_debt_adjustments
            where organization_id = $1
              and customer_id = $2
              and source_system = 'kiotviet'
            order by created_at desc, source_row desc nulls last, updated_at desc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              pr.id::text,
              pr.code,
              coalesce(nullif(pr.data->>'received_at', '')::timestamptz, pr.created_at) as created_at,
              s.id::text as supplier_id,
              s.code as supplier_code,
              s.data->>'name' as supplier_name,
              coalesce(nullif(pr.data->>'payable_amount', '')::numeric, 0) as payable_amount,
              coalesce(nullif(pr.data->>'paid_amount', '')::numeric, 0) as paid_amount,
              coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0) as remaining_amount
            from purchase_receipt_snapshots pr
            join supplier_snapshots s
              on s.organization_id = pr.organization_id
             and (
               pr.data->>'supplier_id' = s.id
               or pr.data->'supplier'->>'id' = s.id
               or lower(s.code) = lower(pr.data->'supplier'->>'code')
               or s.id = 'supplier-kv-' || lower(regexp_replace(coalesce(pr.data->'supplier'->>'code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
             )
             and s.data->>'linked_customer_id' = $2
            where pr.organization_id = $1
              and pr.data->>'status' = 'posted'
              and coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0) > 0
            order by created_at desc, pr.code desc
          `,
          [input.organizationId, input.customerId],
        ),
      ])
      const totalsRow = totalsResult.rows[0]
      const customerCode = totalsRow ? mapCustomerDebtTotalsRow(totalsRow).customer_code : ''
      const cashbookResult = customerCode
        ? await pool.query(
            `
              select
                cbe.id,
                cbe.code,
                cbe.status,
                cbe.direction,
                cbe.amount_delta,
                cbe.finance_account,
                cbe.is_business_accounted,
                cbe.source_type,
                cbe.created_at,
                cbe.note,
                cbe.counterparty,
                cbe.created_by,
                cbe.source,
                cbe.allocations
              from cashbook_entries cbe
              left join orders o
                on o.organization_id = cbe.organization_id
               and o.code = cbe.source->>'order_code'
              left join customer_snapshots cs
                on cs.organization_id = cbe.organization_id
               and (
                 lower(cs.code) = lower(cbe.source->>'counterparty_code')
                 or cs.id = 'customer-kv-' || lower(regexp_replace(coalesce(cbe.source->>'counterparty_code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
               )
              where cbe.organization_id = $1
                and cbe.status = 'posted'
                and (
                  (
                    cbe.source_type = 'payment_receipt_method'
                    and (
                      cbe.source->>'customer_id' = $2
                      or (o.id is not null and o.customer_id = $2 and o.status <> 'cancelled')
                    )
                  )
                  or (
                    cbe.source_type = 'kiotviet_cashbook'
                    and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
                    and (
                      cbe.source->>'customer_id' = $2
                      or cs.id = $2
                      or cbe.source->>'counterparty_code' = $3
                      or (o.id is not null and o.customer_id = $2 and o.status <> 'cancelled')
                    )
                  )
                )
              order by cbe.created_at desc, cbe.code desc
            `,
            [input.organizationId, input.customerId, customerCode],
          )
        : { rows: [] }
      const invoices = result.rows.map((row) => ({
        order_id: row.id,
        order_code: row.code,
        created_at: row.created_at.toISOString(),
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        debt_amount: Number(row.debt_amount),
        remaining_debt: Number(row.remaining_debt),
      }))
      const adjustments = adjustmentResult.rows.map((row) => ({
        id: String(row.id),
        source_code: String(row.source_code),
        created_at: row.created_at.toISOString(),
        transaction_type: String(row.transaction_type),
        amount_delta: Number(row.amount_delta),
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
        balance_after: Number(row.balance_after),
        source_file: row.source_file === null ? null : String(row.source_file),
      }))
      const linkedSupplierReceipts = linkedSupplierReceiptResult.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        created_at: row.created_at.toISOString(),
        supplier_id: String(row.supplier_id),
        supplier_code: String(row.supplier_code),
        supplier_name: String(row.supplier_name),
        payable_amount: Number(row.payable_amount),
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
      }))
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const cashbookEntries = cashbookResult.rows
        .map(mapCashbookRow)
        .map((entry) => hydrateCashbookEntryUserSnapshot(entry, userDisplayNames))
        .map((entry) => hydrateCashbookEntryFinanceAccount(entry, accounts))
      const ledgerInvoices = ledgerInvoiceResult.rows.length > 0
        ? ledgerInvoiceResult.rows.map((row) => ({
            order_id: row.id,
            order_code: row.code,
            created_at: row.created_at.toISOString(),
            total_amount: Number(row.ledger_total_amount),
          }))
        : invoices
      const ledgerDocuments: PartnerDebtDocumentInput[] = [
        ...ledgerInvoices.map((invoice) => ({
          id: String(invoice.order_id),
          code: invoice.order_code,
          time: invoice.created_at,
          amount: invoice.total_amount,
          status: 'posted',
          sourceType: 'invoice',
          sourceId: String(invoice.order_id),
        })),
        ...cashbookEntries.map((entry) => ({
          id: entry.id,
          code: entry.code,
          time: entry.created_at,
          amount: Math.abs(entry.amount_delta),
          status: entry.status,
          sourceType: 'payment',
          sourceId: entry.id,
        })),
        ...adjustments.map((adjustment) => ({
          id: adjustment.id,
          code: adjustment.source_code,
          time: adjustment.created_at,
          amount: Math.abs(adjustment.amount_delta),
          normalizedAmountDelta: adjustment.amount_delta,
          status: 'posted',
          sourceType: 'adjustment',
          sourceId: adjustment.id,
        })),
        ...linkedSupplierReceipts.flatMap((receipt) => {
          const rows: PartnerDebtDocumentInput[] = [{
            id: receipt.id,
            code: receipt.code,
            time: receipt.created_at,
            amount: receipt.payable_amount,
            status: 'posted',
            sourceType: 'linked_supplier_receipt',
            sourceId: receipt.id,
          }]
          if (receipt.paid_amount > 0) {
            rows.push({
              id: `${receipt.id}:paid`,
              code: nextPurchaseSupplierPaymentCode(receipt.code, ''),
              time: receipt.created_at,
              amount: receipt.paid_amount,
              status: 'posted',
              sourceType: 'linked_supplier_payment',
              sourceId: receipt.id,
            })
          }
          return rows
        }),
      ]
      const ledger = buildPartnerDebtLedger({
        view: 'customer',
        linked: linkedSupplierReceipts.length > 0,
        documents: ledgerDocuments,
      })
      return {
        customer_id: input.customerId,
        total_debt: ledger.totalDebt,
        invoices,
        adjustments,
        linked_supplier_receipts: linkedSupplierReceipts,
        cashbook_entries: cashbookEntries,
        ledger_rows: ledger.rows.map((row) => ({
          id: row.id,
          code: row.code,
          created_at: row.time,
          amount_delta: row.amountDelta,
          balance_after: row.balanceAfter,
          source_type: row.sourceType,
          source_id: row.sourceId,
        })),
      }
    },

    async getCustomerOpenDebts(input) {
      await ensureSalesFinanceTables(pool)
      const limit = Math.max(1, Math.min(Math.floor(Number(input.limit ?? 50)), 100))
      const result = await pool.query(
        `
          select
            o.id,
            o.code,
            o.created_at,
            o.total_amount,
            o.paid_amount,
            coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt
          from orders o
          left join customer_debt_entries cde
            on cde.organization_id = o.organization_id
           and cde.order_id = o.id
           and cde.status = 'open'
           and cde.remaining_debt > 0
          where o.organization_id = $1
            and o.customer_id = $2
            and o.order_type = 'invoice'
            and o.status <> 'cancelled'
            and coalesce(cde.remaining_debt, o.debt_amount) > 0
          order by o.created_at asc, o.code asc
          limit $3
        `,
        [input.organizationId, input.customerId, limit + 1],
      )
      return sliceCustomerOpenDebtsOldestFirst(
        result.rows.map((row) => ({
          order_id: String(row.id),
          order_code: String(row.code),
          created_at: row.created_at.toISOString(),
          total_amount: Number(row.total_amount),
          paid_amount: Number(row.paid_amount),
          remaining_debt: Number(row.remaining_debt),
        })),
        { amount: input.amount, limit },
      )
    },

    async listCustomerDebts(input) {
      await ensureSalesFinanceTables(pool)
      await ensureImportedSnapshotTables(pool)
      const result = await pool.query<CustomerDebtTotalsRow>(customerDebtTotalsSql(), [input.organizationId])
      const debts = result.rows
        .map((row) => {
          const mapped = mapCustomerDebtTotalsRow(row)
          return {
            customer_id: mapped.customer_id,
            customer_code: mapped.customer_code,
            customer_name: mapped.customer_name,
            total_debt: mapped.total_debt,
            oldest_order_code: mapped.oldest_order_code,
            open_invoice_count: mapped.open_invoice_count,
            invoices: [],
          } satisfies CustomerDebtSummaryData
        })
        .filter((debt) => debt.total_debt !== 0)
      return debts.filter((debt) => customerDebtMatches(input.url, debt))
    },

    async collectCustomerDebt(input) {
      await ensureSalesFinanceTables(pool)
      if (input.amount <= 0 || input.cashAmount + input.bankAmount !== input.amount) {
        return { payment_receipt_id: '', allocated_amount: 0 }
      }

      await pool.query('begin')
      try {
        const [debtRows, openOrderRows, adjustmentRows, anchorRows, totalsBefore] = await Promise.all([
          pool.query(
            `
              select
                cde.id as debt_id,
                cde.remaining_debt,
                o.id as order_id,
                o.code as order_code,
                o.total_amount,
                o.paid_amount,
                o.debt_amount,
                o.customer_snapshot
              from customer_debt_entries cde
              join orders o on o.id = cde.order_id
              where cde.organization_id = $1
                and cde.customer_id = $2
                and cde.status = 'open'
                and cde.remaining_debt > 0
              order by cde.created_at asc
              for update of cde, o
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select
                null::text as debt_id,
                o.debt_amount as remaining_debt,
                o.id as order_id,
                o.code as order_code,
                o.total_amount,
                o.paid_amount,
                o.debt_amount,
                o.customer_snapshot
              from orders o
              where o.organization_id = $1
                and o.customer_id = $2
                and o.order_type = 'invoice'
                and o.status <> 'cancelled'
                and o.debt_amount > 0
                and o.payment_status <> 'paid'
              order by o.created_at asc, o.code asc
              for update of o
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select
                id,
                source_code,
                amount_delta,
                paid_amount,
                remaining_amount,
                balance_after,
                customer_snapshot
              from customer_debt_adjustments
              where organization_id = $1
                and customer_id = $2
                and status = 'open'
                and remaining_amount > 0
              order by created_at asc
              for update
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query(
            `
              select id, source_code, paid_amount, balance_after, customer_snapshot
              from customer_debt_adjustments
              where organization_id = $1
                and customer_id = $2
                and source_system = 'kiotviet'
              order by created_at desc, source_row desc nulls last, updated_at desc
              limit 1
              for update
            `,
            [input.organizationId, input.customerId],
          ),
          pool.query<CustomerDebtTotalsRow>(
            customerDebtTotalsSql({ singleCustomer: true }),
            [input.organizationId, input.customerId],
          ),
        ])

        const requestedAllocations = (input.allocations ?? [])
          .map((allocation) => ({
            order_id: allocation.order_id,
            order_code: allocation.order_code,
            allocated_amount: Math.max(Number(allocation.allocated_amount), 0),
          }))
          .filter((allocation) => allocation.allocated_amount > 0 && (allocation.order_id || allocation.order_code))
        let remainingPayment = input.amount
        const allocations: Array<{
          order_id: string
          order_code: string
          order_total_amount: number
          collected_before: number
          allocated_amount: number
          remaining_after: number
        }> = []
        const debtRowsByOrderId = new Set(debtRows.rows.map((row) => row.order_id))
        const openDebtRows = [
          ...debtRows.rows,
          ...openOrderRows.rows.filter((row) => !debtRowsByOrderId.has(row.order_id)),
        ]
        const debtAllocationRows = requestedAllocations.length > 0
          ? requestedAllocations
              .map((allocation) => ({
                allocation,
                row: openDebtRows.find((row) => row.order_id === allocation.order_id || row.order_code === allocation.order_code),
              }))
              .filter((item): item is { allocation: typeof requestedAllocations[number]; row: typeof debtRows.rows[number] } => Boolean(item.row))
          : openDebtRows.map((row) => ({ allocation: null, row }))

        for (const { allocation, row } of debtAllocationRows) {
          if (remainingPayment <= 0) break
          const allocated = Math.min(Number(row.remaining_debt), remainingPayment, allocation?.allocated_amount ?? remainingPayment)
          const nextDebt = Math.max(Number(row.remaining_debt) - allocated, 0)
          const nextPaid = Number(row.paid_amount) + allocated
          const paymentStatus = nextDebt <= 0 ? 'paid' : nextPaid <= 0 ? 'unpaid' : 'partial'
          if (row.debt_id) {
            await pool.query(
              `
                update customer_debt_entries
                set paid_amount = paid_amount + $1,
                    remaining_debt = $2,
                    status = case when $2::numeric <= 0 then 'closed' else 'open' end,
                    updated_at = now()
                where id = $3
              `,
              [allocated, nextDebt, row.debt_id],
            )
          }
          await pool.query(
            `
              update orders
              set paid_amount = $1,
                  debt_amount = $2,
                  payment_status = $3,
                  updated_at = now()
              where id = $4
            `,
            [nextPaid, nextDebt, paymentStatus, row.order_id],
          )
          allocations.push({
            order_id: row.order_id,
            order_code: row.order_code,
            order_total_amount: Number(row.total_amount),
            collected_before: Number(row.paid_amount),
            allocated_amount: allocated,
            remaining_after: nextDebt,
          })
          remainingPayment -= allocated
        }
        for (const row of adjustmentRows.rows) {
          if (remainingPayment <= 0) break
          const allocated = Math.min(Number(row.remaining_amount), remainingPayment)
          const nextRemaining = Math.max(Number(row.remaining_amount) - allocated, 0)
          await pool.query(
            `
              update customer_debt_adjustments
              set paid_amount = paid_amount + $1,
                  remaining_amount = $2,
                  status = case when $2::numeric <= 0 then 'closed' else 'open' end,
                  updated_at = now()
              where id = $3
            `,
            [allocated, nextRemaining, row.id],
          )
          allocations.push({
            order_id: row.id,
            order_code: row.source_code,
            order_total_amount: Number(row.amount_delta),
            collected_before: Number(row.paid_amount),
            allocated_amount: allocated,
            remaining_after: nextRemaining,
          })
          remainingPayment -= allocated
        }

        // Legacy KiotViet debt (anchored in `balance_after`) has no open debt entry
        // rows to allocate against. Recording the payment receipt is what reduces the
        // canonical total, so allocate the leftover against the anchor for audit.
        const anchorRow = anchorRows.rows[0]
        const canonicalDebtBefore = totalsBefore.rows[0] ? mapCustomerDebtTotalsRow(totalsBefore.rows[0]).total_debt : 0
        if (remainingPayment > 0 && anchorRow) {
          const allocatedSoFar = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
          const legacyRemaining = Math.max(canonicalDebtBefore - allocatedSoFar, 0)
          const allocated = Math.min(remainingPayment, legacyRemaining)
          if (allocated > 0) {
            await pool.query(
              `
                update customer_debt_adjustments
                set paid_amount = paid_amount + $1,
                    updated_at = now()
                where id = $2
              `,
              [allocated, anchorRow.id],
            )
            allocations.push({
              order_id: String(anchorRow.id),
              order_code: String(anchorRow.source_code),
              order_total_amount: Number(anchorRow.balance_after),
              collected_before: Number(anchorRow.paid_amount),
              allocated_amount: allocated,
              remaining_after: legacyRemaining - allocated,
            })
            remainingPayment -= allocated
          }
        }

        const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
        if (allocatedAmount <= 0) {
          await pool.query('commit')
          return { payment_receipt_id: '', allocated_amount: 0 }
        }

        const receiptId = randomUUID()
        const receiptCodeRow = await pool.query<{ max_seq: string | number | null }>(
          `
            select coalesce(max((regexp_match(code, '^TT(\\d{6})$'))[1]::int), 0) as max_seq
            from (
              select code
              from payment_receipts
              where organization_id = $1
              union all
              select code
              from cashbook_entries
              where organization_id = $1
            ) existing_codes
            where code ~ '^TT\\d{6}$'
          `,
          [input.organizationId],
        )
        const receiptCodeSeq = Number(receiptCodeRow.rows[0]?.max_seq ?? 0) + 1
        const receiptCode = `TT${String(receiptCodeSeq).padStart(6, '0')}`
        const createdAt = input.createdAt ?? new Date().toISOString()
        const firstCustomer = debtRows.rows[0]?.customer_snapshot ?? adjustmentRows.rows[0]?.customer_snapshot ?? { name: 'Khach hang', phone: null }
        const allocationCodes = allocations.map((allocation) => allocation.order_code).join(', ')
        const note = input.note?.trim() ? `${input.note.trim()} - ${allocationCodes}` : `Thu no ${allocationCodes}`
        const receiptOrderId = allocations.find((allocation) => allocation.order_code.startsWith('HD'))?.order_id ?? null
        const receiptOrderCode = allocations.find((allocation) => allocation.order_code.startsWith('HD'))?.order_code ?? allocations[0]?.order_code ?? null
        await pool.query(
          `
            insert into payment_receipts (id, organization_id, code, customer_id, order_id, total_received_amount, note, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
          `,
          [receiptId, input.organizationId, receiptCode, input.customerId, receiptOrderId, allocatedAmount, note, createdAt],
        )

        const entries: CashbookEntryData[] = []
        const methods = [
          { amount: input.cashAmount, account: cashAccount(), method: 'cash' },
          { amount: input.bankAmount, account: bankAccount(input.bankAccountId), method: 'bank_transfer' },
        ]

        for (const method of methods) {
          if (method.amount <= 0) continue
          await pool.query(
            `
              insert into payment_receipt_methods (
                organization_id, payment_receipt_id, order_id, method,
                finance_account_id, amount, bank_transaction_ref, allocations, created_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz)
            `,
            [
              input.organizationId,
              receiptId,
              receiptOrderId,
              method.method,
              method.account.id,
              method.amount,
              method.method === 'bank_transfer' ? input.bankTransactionRef ?? null : null,
              JSON.stringify(allocations),
              createdAt,
            ],
          )
          entries.push({
            id: randomUUID(),
            code: entries.length === 0 ? receiptCode : `${receiptCode}-${method.method === 'cash' ? 'TM' : 'NH'}`,
            status: 'posted',
            direction: 'in',
            amount_delta: method.amount,
            finance_account: method.account,
            is_business_accounted: true,
            source_type: 'payment_receipt_method',
            created_at: createdAt,
            note: method.method === 'bank_transfer' && input.bankTransactionRef ? `${note} (${input.bankTransactionRef})` : note,
            counterparty: { type: 'customer', name: firstCustomer.name, phone: firstCustomer.phone },
            source: { type: 'payment_receipt', id: receiptId, code: receiptCode, order_code: receiptOrderCode, customer_id: input.customerId },
            allocations,
          } as CashbookEntryData)
        }

        for (const entry of entries) {
          await insertCashbookEntry(pool, input.organizationId, entry)
        }

        await pool.query('commit')
        return { payment_receipt_id: receiptCode, allocated_amount: allocatedAmount }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async updateCustomerDebtAdjustment(input) {
      await ensureSalesFinanceTables(pool)
      await pool.query('begin')
      try {
        const result = await pool.query(
          `
            update customer_debt_adjustments
            set
              created_at = coalesce($3::timestamptz, created_at),
              amount_delta = coalesce($4::numeric, amount_delta),
              remaining_amount = greatest(coalesce($4::numeric, amount_delta) - paid_amount, 0),
              source_file = case when $5::boolean then $6::text else source_file end,
              updated_at = now()
            where organization_id = $1
              and id = $2
            returning
              id,
              source_code,
              created_at,
              transaction_type,
              amount_delta,
              paid_amount,
              remaining_amount,
              balance_after,
              source_file
          `,
          [
            input.organizationId,
            input.adjustmentId,
            input.adjustedAt ?? null,
            input.amountDelta ?? null,
            input.note !== undefined,
            input.note ?? null,
          ],
        )
        await pool.query('commit')
        const row = result.rows[0]
        if (!row) return null
        return {
          id: String(row.id),
          source_code: String(row.source_code),
          created_at: row.created_at.toISOString(),
          transaction_type: String(row.transaction_type),
          amount_delta: Number(row.amount_delta),
          paid_amount: Number(row.paid_amount),
          remaining_amount: Number(row.remaining_amount),
          balance_after: Number(row.balance_after),
          source_file: row.source_file === null ? null : String(row.source_file),
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async listCashbookEntries(input) {
      await ensureSalesFinanceTables(pool)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const result = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
          order by created_at desc
        `,
        [input.organizationId],
      )
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const entries = result.rows
        .map(mapCashbookRow)
        .map((entry) => hydrateCashbookEntryUserSnapshot(entry, userDisplayNames))
        .map((entry) => hydrateCashbookEntryFinanceAccount(entry, accounts))
      if (input.url.searchParams.get('exclude_replaced_deleted_accounts') !== 'true') {
        return entries.filter((entry) => cashbookEntryMatches(input.url, entry))
      }
      return entries.filter((entry) => !isReplacedDeletedFinanceAccount(entry.finance_account, accounts)).filter((entry) => cashbookEntryMatches(input.url, entry))
    },

    async listCashbookEntriesPage(input) {
      await ensureSalesFinanceTables(pool)
      const page = positiveInt(input.url.searchParams.get('page'), 1)
      const pageSize = positiveInt(input.url.searchParams.get('page_size'), 20)
      const offset = (page - 1) * pageSize
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const values: unknown[] = [input.organizationId]
      const filters = ['ce.organization_id = $1']
      const dateFilters: string[] = []

      const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
      }
      const financeAccountId = input.url.searchParams.get('finance_account_id')
      const financeAccountType = input.url.searchParams.get('finance_account_type')
      const direction = input.url.searchParams.get('direction')
      const status = input.url.searchParams.get('status')
      const isBusinessAccounted = input.url.searchParams.get('is_business_accounted')
      const from = input.url.searchParams.get('from')
      const to = input.url.searchParams.get('to')
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? '')
      const searchScope = input.url.searchParams.get('search_scope') ?? 'all'
      let fromPlaceholder: string | null = null

      if (financeAccountId && financeAccountId !== 'all') {
        filters.push(`coalesce(fa.id, ce.finance_account->>'id') = ${addValue(financeAccountId)}`)
      }
      if (financeAccountType && financeAccountType !== 'all') {
        filters.push(`coalesce(fa.account_type, ce.finance_account->>'account_type') = ${addValue(financeAccountType)}`)
      }
      if (direction && direction !== 'all') {
        filters.push(`ce.direction = ${addValue(direction)}`)
      }
      if (status && status !== 'all') {
        filters.push(`ce.status = ${addValue(status)}`)
      }
      if (isBusinessAccounted === 'true' || isBusinessAccounted === 'false') {
        filters.push(`ce.is_business_accounted = ${addValue(isBusinessAccounted === 'true')}`)
      }
      if (input.url.searchParams.get('exclude_replaced_deleted_accounts') === 'true') {
        const excludedFinanceAccountIds = accounts
          .filter((account) => isReplacedDeletedFinanceAccount(account, accounts))
          .map((account) => account.id)
        if (excludedFinanceAccountIds.length > 0) {
          filters.push(`coalesce(ce.finance_account->>'id', '') <> all(${addValue(excludedFinanceAccountIds)}::text[])`)
        }
      }
      if (from) {
        fromPlaceholder = addValue(from)
        dateFilters.push(`(created_at at time zone 'UTC')::date >= ${fromPlaceholder}::date`)
      }
      if (to) {
        dateFilters.push(`(created_at at time zone 'UTC')::date <= ${addValue(to)}::date`)
      }
      if (search) {
        const searchPlaceholder = addValue(`%${search}%`)
        const scopedSearchExpressions: Record<string, string[]> = {
          code: ['ce.code'],
          note: ["coalesce(ce.note, '')"],
          transfer_content: ["coalesce(ce.source->>'transfer_content', '')"],
          counterparty: ["coalesce(ce.counterparty->>'name', '')", "coalesce(ce.counterparty->>'phone', '')", "coalesce(ce.source->>'counterparty_code', '')"],
          finance_account: ["coalesce(fa.account_number, fa.code, ce.finance_account->>'code', '')", "coalesce(fa.name, ce.finance_account->>'name', '')"],
          all: [
            'ce.code',
            "coalesce(ce.note, '')",
            "coalesce(ce.counterparty->>'name', '')",
            "coalesce(ce.counterparty->>'phone', '')",
            "coalesce(ce.source->>'counterparty_code', '')",
            "coalesce(fa.account_number, fa.code, ce.finance_account->>'code', '')",
            "coalesce(fa.name, ce.finance_account->>'name', '')",
            "coalesce(ce.source->>'transfer_content', '')",
          ],
        }
        const expressions = scopedSearchExpressions[searchScope] ?? scopedSearchExpressions.all
        filters.push(`(${expressions.map((expression) => `${accentInsensitiveSearchSql(expression)} like ${searchPlaceholder}`).join(' or ')})`)
      }

      const currentDateWhere = dateFilters.length > 0 ? dateFilters.join(' and ') : 'true'
      const openingWhere = fromPlaceholder ? `(created_at at time zone 'UTC')::date < ${fromPlaceholder}::date` : 'false'
      values.push(pageSize, offset)
      const limitPlaceholder = `$${values.length - 1}`
      const offsetPlaceholder = `$${values.length}`
      const result = await pool.query(
        `
          with base_entries as (
            select ce.*
            from cashbook_entries ce
            left join finance_accounts fa
              on fa.organization_id = ce.organization_id
             and fa.id = ce.finance_account->>'id'
            where ${filters.join(' and ')}
          ),
          filtered_summary as (
            select
              count(*)::int as total,
              coalesce(sum(greatest(amount_delta, 0)), 0) as total_in,
              coalesce(sum(greatest(-amount_delta, 0)), 0) as total_out
            from base_entries
            where ${currentDateWhere}
          ),
          opening_summary as (
            select coalesce(sum(amount_delta), 0) as opening_balance
            from base_entries
            where ${openingWhere}
          ),
          paged_entries as (
            select *
            from base_entries
            where ${currentDateWhere}
            order by created_at desc
            limit ${limitPlaceholder}
            offset ${offsetPlaceholder}
          )
          select
            pe.*,
            fs.total,
            fs.total_in,
            fs.total_out,
            os.opening_balance
          from filtered_summary fs
          cross join opening_summary os
          left join paged_entries pe on true
          order by pe.created_at desc nulls last
        `,
        values,
      )
      const firstRow = result.rows[0]
      const total = Number(firstRow?.total ?? 0)
      const openingBalance = Number(firstRow?.opening_balance ?? 0)
      const totalIn = Number(firstRow?.total_in ?? 0)
      const totalOut = Number(firstRow?.total_out ?? 0)
      return {
        items: result.rows
          .filter((row) => row.id)
          .map(mapCashbookRow)
          .map((entry) => hydrateCashbookEntryUserSnapshot(entry, userDisplayNames))
          .map((entry) => hydrateCashbookEntryFinanceAccount(entry, accounts)),
        total,
        summary: {
          opening_balance: openingBalance,
          total_in: totalIn,
          total_out: totalOut,
          ending_balance: openingBalance + totalIn - totalOut,
        },
      }
    },

    async getCashbookEntry(input) {
      await ensureSalesFinanceTables(pool)
      const result = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
            and id = $2
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!result.rows[0]) return null
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const entry = hydrateCashbookEntryFinanceAccount(hydrateCashbookEntryUserSnapshot(mapCashbookRow(result.rows[0]), userDisplayNames), accounts)
      return hydrateCashbookEntryLink(pool, input.organizationId, entry)
    },

    async updateCashbookEntry(input) {
      await ensureSalesFinanceTables(pool)
      const current = await pool.query(
        `
          select *
          from cashbook_entries
          where organization_id = $1
            and (id = $2 or code = $2)
          limit 1
        `,
        [input.organizationId, input.id],
      )
      if (!current.rows[0]) return null
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const currentEntry = mapCashbookRow(current.rows[0])
      const account = input.finance_account_id ? accounts.find((item) => item.id === input.finance_account_id) : null
      if (input.finance_account_id && !account) return null
      const nextAccount = account ? cashbookFinanceAccountSnapshot(account) : currentEntry.finance_account
      const nextCreatedAt = input.created_at ?? currentEntry.created_at
      const nextNote = input.note !== undefined ? input.note : currentEntry.note
      const result = await pool.query(
        `
          update cashbook_entries
          set created_at = $3,
              note = $4,
              finance_account = $5
          where organization_id = $1
            and id = $2
          returning *
        `,
        [
          input.organizationId,
          currentEntry.id,
          nextCreatedAt,
          nextNote,
          JSON.stringify(nextAccount),
        ],
      )
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      const entry = hydrateCashbookEntryFinanceAccount(hydrateCashbookEntryUserSnapshot(mapCashbookRow(result.rows[0]), userDisplayNames), accounts)
      return hydrateCashbookEntryLink(pool, input.organizationId, entry)
    },

    async createCashbookVoucher(input) {
      await ensureSalesFinanceTables(pool)
      await insertCashbookEntry(pool, input.organizationId, input.entry)
      const accounts = await listFinanceAccountsForExclusion(pool, input.organizationId)
      const userDisplayNames = await userDisplayNameMap(pool, input.organizationId)
      return hydrateCashbookEntryFinanceAccount(hydrateCashbookEntryUserSnapshot(input.entry, userDisplayNames), accounts)
    },

    async cancelCashbookVoucher(input) {
      await ensureSalesFinanceTables(pool)
      await pool.query('begin')
      try {
        const current = await pool.query<PgCashbookRow>(
          `
            select *
            from cashbook_entries
            where organization_id = $1
              and status = 'posted'
              and source_type in ('cashbook_voucher', 'payment_receipt_method')
              and (
                id = $2
                or code = $2
                or source->>'id' = $2
                or source->>'code' = $2
              )
            order by created_at desc, code desc
            limit 1
            for update
          `,
          [input.organizationId, input.id],
        )
        const targetRow = current.rows[0]
        if (!targetRow) {
          await pool.query('rollback')
          return null
        }
        const target = mapCashbookRow(targetRow)

        if (target.source_type === 'payment_receipt_method') {
          const receiptId = target.source?.id ?? input.id
          const receiptCode = target.source?.code ?? target.code
          const siblingRows = await pool.query<PgCashbookRow>(
            `
              select *
              from cashbook_entries
              where organization_id = $1
                and status = 'posted'
                and source_type = 'payment_receipt_method'
                and (
                  source->>'id' = $2
                  or source->>'code' = $3
                  or code = $3
                  or code like $3 || '-%'
                )
              for update
            `,
            [input.organizationId, receiptId, receiptCode],
          )
          const sourceEntry = siblingRows.rows.map(mapCashbookRow).find((entry) => (entry.allocations?.length ?? 0) > 0) ?? target
          for (const allocation of sourceEntry.allocations ?? []) {
            const allocated = Math.max(Number(allocation.allocated_amount), 0)
            if (allocated <= 0) continue
            if (/^HD/i.test(allocation.order_code)) {
              await pool.query(
                `
                  update customer_debt_entries cde
                  set paid_amount = greatest(cde.paid_amount - $1::numeric, 0),
                      remaining_debt = cde.remaining_debt + $1::numeric,
                      status = 'open',
                      updated_at = now()
                  from orders o
                  where cde.organization_id = $2
                    and cde.order_id = o.id
                    and o.organization_id = $2
                    and (cde.order_id = $3 or o.code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
              await pool.query(
                `
                  update orders
                  set paid_amount = greatest(paid_amount - $1::numeric, 0),
                      debt_amount = least(total_amount, debt_amount + $1::numeric),
                      payment_status = case
                        when least(total_amount, debt_amount + $1::numeric) <= 0 then 'paid'
                        when greatest(paid_amount - $1::numeric, 0) <= 0 then 'unpaid'
                        else 'partial'
                      end,
                      updated_at = now()
                  where organization_id = $2
                    and (id = $3 or code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
            } else {
              await pool.query(
                `
                  update customer_debt_adjustments
                  set paid_amount = greatest(paid_amount - $1::numeric, 0),
                      remaining_amount = remaining_amount + $1::numeric,
                      status = 'open',
                      updated_at = now()
                  where organization_id = $2
                    and (id = $3 or source_code = $4)
                `,
                [allocated, input.organizationId, allocation.order_id, allocation.order_code],
              )
            }
          }
          await pool.query(
            `
              update cashbook_entries
              set status = 'cancelled'
              where organization_id = $1
                and status = 'posted'
                and source_type = 'payment_receipt_method'
                and (
                  source->>'id' = $2
                  or source->>'code' = $3
                  or code = $3
                  or code like $3 || '-%'
                )
            `,
            [input.organizationId, receiptId, receiptCode],
          )
          await pool.query(
            `delete from payment_receipts where organization_id = $1 and (id = $2 or code = $3)`,
            [input.organizationId, receiptId, receiptCode],
          )
        } else {
          await pool.query(
            `
              update cashbook_entries
              set status = 'cancelled'
              where organization_id = $1
                and status = 'posted'
                and source_type = 'cashbook_voucher'
                and (
                  id = $2
                  or code = $2
                  or source->>'id' = $2
                  or source->>'code' = $2
                )
            `,
            [input.organizationId, input.id],
          )
        }

        const result = await pool.query<PgCashbookRow>(
          `
            select *
            from cashbook_entries
            where organization_id = $1
              and id = $2
            limit 1
          `,
          [input.organizationId, target.id],
        )
        await pool.query('commit')
        const row = result.rows[0]
        return row ? mapCashbookRow(row) : { ...target, status: 'cancelled' }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async getCustomerFinancialTotals(organizationId) {
      await ensureSalesFinanceTables(pool)
      await ensureImportedSnapshotTables(pool)
      const sales = await pool.query(
        `
          select customer_id, sum(total_amount) as total_sales_amount, max(updated_at) as last_activity_at
          from orders
          where organization_id = $1
            and order_type = 'invoice'
            and status <> 'cancelled'
            and customer_id is not null
          group by customer_id
        `,
        [organizationId],
      )
      const debts = await pool.query<CustomerDebtTotalsRow>(customerDebtTotalsSql(), [organizationId])
      const totals = new Map<string, { total_sales_amount: number; total_debt_amount: number; last_activity_at?: string }>()
      for (const row of sales.rows) {
        totals.set(row.customer_id, {
          total_sales_amount: Number(row.total_sales_amount),
          total_debt_amount: 0,
          last_activity_at: row.last_activity_at?.toISOString(),
        })
      }
      for (const row of debts.rows) {
        const mapped = mapCustomerDebtTotalsRow(row)
        const existing = totals.get(mapped.customer_id) ?? { total_sales_amount: 0, total_debt_amount: 0 }
        totals.set(mapped.customer_id, {
          ...existing,
          total_debt_amount: mapped.total_debt,
          last_activity_at: mapped.last_activity_at ?? existing.last_activity_at,
        })
      }
      return totals
    },

    async close() {
      await pool.end()
    },
  }
}

type ProductImportDbRow = Parameters<NonNullable<ServerRepository['upsertProductsByCode']>>[0]['rows'][number]

function dbDateText(value: unknown) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
    return value.toISOString()
  }
  return String(value)
}

function paginationFromUrl(url: URL, defaultPageSize: number) {
  const rawPage = Number(url.searchParams.get('page') ?? '1')
  const rawPageSize = Number(url.searchParams.get('page_size') ?? String(defaultPageSize))
  return {
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
    pageSize: Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : defaultPageSize,
  }
}

function stocktakeCreatorOptions(items: readonly StocktakeListData[]) {
  const creators = new Map<string, string>()
  for (const item of items) {
    if (!item.created_by) continue
    creators.set(item.created_by.id, item.created_by.name)
  }
  return [...creators.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

async function ensureProductCatalogSchema(pool: pg.Pool) {
  await pool.query(`
    create table if not exists product_groups (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      is_default boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_product_groups_org_active on product_groups (organization_id, is_active)')
  await pool.query(`
    create table if not exists products (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      status text not null default 'active',
      unit_name text not null default 'Can cap nhat',
      sell_method text not null default 'quantity',
      product_kind text not null default 'goods',
      product_group_id uuid references product_groups(id),
      inventory_shape text not null default 'normal',
      track_inventory boolean not null default true,
      latest_purchase_cost numeric(18,2),
      latest_purchase_cost_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table products add column if not exists product_group_id uuid references product_groups(id)')
  await pool.query("alter table products add column if not exists sell_method text not null default 'quantity'")
  await pool.query("alter table products add column if not exists product_kind text not null default 'goods'")
  await pool.query("alter table products add column if not exists inventory_shape text not null default 'normal'")
  await pool.query('alter table products add column if not exists track_inventory boolean not null default true')
  await pool.query('alter table products add column if not exists latest_purchase_cost numeric(18,2)')
  await pool.query('alter table products add column if not exists latest_purchase_cost_at timestamptz')
  await pool.query('create index if not exists idx_products_org_group on products (organization_id, product_group_id)')
  await pool.query('create index if not exists idx_products_org_inventory_shape on products (organization_id, inventory_shape)')
  await pool.query('create index if not exists idx_products_org_product_kind on products (organization_id, product_kind)')
  await pool.query('create index if not exists idx_products_org_status on products (organization_id, status)')
  await pool.query('create index if not exists idx_products_org_updated on products (organization_id, updated_at desc, created_at desc)')
}

async function ensureProductUnitTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_units (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      unit_kind text not null default 'quantity' check (unit_kind in ('quantity', 'length', 'area', 'weight', 'volume', 'package')),
      decimal_precision integer not null default 3 check (decimal_precision between 0 and 6),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_inventory_units_org_active on inventory_units (organization_id, is_active)')
  await pool.query('create index if not exists idx_inventory_units_org_kind on inventory_units (organization_id, unit_kind)')
  await pool.query(`
    create table if not exists product_inventory_settings (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      track_inventory boolean not null default true,
      inventory_shape text not null default 'normal' check (inventory_shape in ('normal', 'roll', 'sheet')),
      stock_unit_id uuid not null references inventory_units(id),
      default_allow_negative boolean not null default true,
      roll_default_margin_width_m numeric(12,3),
      roll_default_margin_length_m numeric(12,3),
      roll_allow_rotate boolean,
      sheet_width_m numeric(12,3),
      sheet_length_m numeric(12,3),
      sheet_default_cut_margin_m numeric(12,3),
      sheet_remnant_min_area_m2 numeric(12,3) not null default 0.300,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id)
    )
  `)
  await pool.query('create index if not exists idx_product_inventory_settings_org_shape on product_inventory_settings (organization_id, inventory_shape)')
  await pool.query('create index if not exists idx_product_inventory_settings_stock_unit on product_inventory_settings (organization_id, stock_unit_id)')
  await pool.query(`
    create table if not exists product_unit_conversions (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      sale_unit_id uuid not null references inventory_units(id),
      stock_unit_id uuid not null references inventory_units(id),
      source_code text,
      stock_qty_per_sale_unit numeric(18,6) not null check (stock_qty_per_sale_unit > 0),
      is_default_purchase_unit boolean not null default false,
      is_default_sale_unit boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id, sale_unit_id)
    )
  `)
  await pool.query('create index if not exists idx_product_unit_conversions_product on product_unit_conversions (organization_id, product_id, is_active)')
  await pool.query('alter table product_unit_conversions add column if not exists source_code text')
  await pool.query('create index if not exists idx_product_unit_conversions_source_code on product_unit_conversions (organization_id, source_code) where source_code is not null and is_active = true')
}

async function ensurePriceListTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists price_lists (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      is_default boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists idx_price_lists_org_default on price_lists (organization_id, is_default, is_active)')
  await pool.query(`
    create table if not exists price_list_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      price_list_id uuid not null references price_lists(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      unit_price numeric(18,2) not null check (unit_price >= 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await pool.query('create unique index if not exists price_list_items_price_product_uidx on price_list_items (price_list_id, product_id)')
  await pool.query('create index if not exists idx_price_list_items_org_product on price_list_items (organization_id, product_id)')
}

async function upsertInventoryUnit(pool: pg.Pool, organizationId: string, unitName: string) {
  const name = unitName.trim() || 'Can cap nhat'
  const result = await pool.query(
    `
      insert into inventory_units (id, organization_id, code, name, unit_kind, decimal_precision, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, $5, 3, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        unit_kind = excluded.unit_kind,
        is_active = true,
        updated_at = now()
      returning id::text
    `,
    [randomUUID(), organizationId, inventoryUnitCode(name), name, inventoryUnitKind(name)],
  )
  return String(result.rows[0].id)
}

async function upsertProductInventorySettings(
  pool: pg.Pool,
  organizationId: string,
  productId: string,
  row: ProductImportDbRow,
  stockUnitId: string,
) {
  await pool.query(
    `
      insert into product_inventory_settings (
        id, organization_id, product_id, track_inventory, inventory_shape,
        stock_unit_id, default_allow_negative, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, true, now(), now())
      on conflict (organization_id, product_id)
      do update set
        track_inventory = excluded.track_inventory,
        inventory_shape = excluded.inventory_shape,
        stock_unit_id = excluded.stock_unit_id,
        updated_at = now()
    `,
    [randomUUID(), organizationId, productId, row.track_inventory, row.inventory_shape, stockUnitId],
  )
}

async function upsertProductUnitConversions(
  pool: pg.Pool,
  organizationId: string,
  productId: string,
  stockUnitId: string,
  conversions: ProductImportDbRow['unit_conversions'],
) {
  const activeSaleUnitIds: string[] = []
  for (const conversion of conversions) {
    if (conversion.stock_qty_per_unit <= 0) continue
    const saleUnitId = await upsertInventoryUnit(pool, organizationId, conversion.unit_name)
    activeSaleUnitIds.push(saleUnitId)
    await pool.query(
      `
        insert into product_unit_conversions (
          id, organization_id, product_id, sale_unit_id, stock_unit_id,
          source_code,
          stock_qty_per_sale_unit, is_default_purchase_unit, is_default_sale_unit,
          is_active, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), now())
        on conflict (organization_id, product_id, sale_unit_id)
        do update set
          source_code = excluded.source_code,
          stock_unit_id = excluded.stock_unit_id,
          stock_qty_per_sale_unit = excluded.stock_qty_per_sale_unit,
          is_default_purchase_unit = excluded.is_default_purchase_unit,
          is_default_sale_unit = excluded.is_default_sale_unit,
          is_active = true,
          updated_at = now()
      `,
      [
        randomUUID(),
        organizationId,
        productId,
        saleUnitId,
        stockUnitId,
        conversion.source_code,
        conversion.stock_qty_per_unit,
        conversion.is_default_purchase_unit,
        conversion.is_default_sale_unit,
      ],
    )
  }

  await pool.query(
    `
      update product_unit_conversions
      set is_active = false, updated_at = now()
      where organization_id = $1
        and product_id = $2
        and not (sale_unit_id = any($3::uuid[]))
    `,
    [organizationId, productId, activeSaleUnitIds],
  )
}

async function ensureInventoryProvisionalBalancesTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_provisional_balances (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      source_type text not null check (source_type in ('kiotviet_import')),
      source_label text,
      initial_qty numeric(18,6) not null check (initial_qty >= 0),
      remaining_qty numeric(18,6) not null check (remaining_qty >= 0),
      stock_unit_id uuid not null references inventory_units(id),
      status text not null check (status in ('open', 'fully_normalized', 'closed')),
      note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, product_id, source_type)
    )
  `)
  await pool.query('alter table inventory_provisional_balances add column if not exists source_label text')
  await pool.query('alter table inventory_provisional_balances add column if not exists initial_qty numeric(18,6)')
  await pool.query('alter table inventory_provisional_balances add column if not exists remaining_qty numeric(18,6)')
  await pool.query('alter table inventory_provisional_balances add column if not exists stock_unit_id uuid')
  await pool.query('alter table inventory_provisional_balances add column if not exists status text')
  await pool.query('alter table inventory_provisional_balances add column if not exists note text')
  await pool.query('alter table inventory_provisional_balances add column if not exists created_at timestamptz not null default now()')
  await pool.query('alter table inventory_provisional_balances add column if not exists updated_at timestamptz not null default now()')
  await pool.query(`
    create unique index if not exists inventory_provisional_balances_org_product_source_uidx
    on inventory_provisional_balances (organization_id, product_id, source_type)
  `)
  await pool.query('create index if not exists idx_inventory_provisional_balances_product on inventory_provisional_balances (organization_id, product_id, status)')
}

async function ensureImportedStocktakeTables(pool: pg.Pool) {
  await ensureProductUnitTables(pool)
  await pool.query(`
    create table if not exists stocktakes (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      status text not null check (status in ('draft', 'balanced', 'cancelled')),
      source_type text not null check (source_type in ('manual', 'product_edit', 'kiotviet_import')),
      source_system text,
      source_code text,
      source_created_at timestamptz,
      source_balanced_at timestamptz,
      source_creator_name text,
      note text,
      balanced_at timestamptz,
      created_by uuid null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table stocktakes add column if not exists source_system text')
  await pool.query('alter table stocktakes add column if not exists source_code text')
  await pool.query('alter table stocktakes add column if not exists source_created_at timestamptz')
  await pool.query('alter table stocktakes add column if not exists source_balanced_at timestamptz')
  await pool.query('alter table stocktakes add column if not exists source_creator_name text')
  await pool.query('alter table stocktakes add column if not exists created_by uuid null')
  await pool.query('alter table stocktakes alter column created_by drop not null')
  await relaxCheckConstraint(pool, 'stocktakes', 'source_type', ['manual', 'product_edit', 'kiotviet_import'])
  await pool.query(`
    create unique index if not exists stocktakes_org_source_system_code_uidx
    on stocktakes (organization_id, source_system, source_code)
    where source_system is not null and source_code is not null
  `)
  await pool.query('create index if not exists idx_stocktakes_org_status_created on stocktakes (organization_id, status, created_at desc)')
  await pool.query('create index if not exists idx_stocktakes_org_source on stocktakes (organization_id, source_system, source_code)')

  await pool.query(`
    create table if not exists stocktake_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      stocktake_id uuid not null references stocktakes(id) on delete cascade,
      line_no integer not null,
      product_id uuid null references products(id),
      stock_unit_id uuid null references inventory_units(id),
      system_qty numeric(18,6),
      actual_qty numeric(18,6),
      difference_qty numeric(18,6),
      inventory_object_type text,
      inventory_roll_id uuid,
      inventory_sheet_id uuid,
      note text,
      source_row_number integer,
      source_product_code text,
      source_product_name text,
      source_unit_name text,
      line_difference_value numeric(18,2),
      line_actual_value numeric(18,2),
      created_at timestamptz not null default now(),
      unique (stocktake_id, line_no)
    )
  `)
  await pool.query('alter table stocktake_items alter column product_id drop not null')
  await pool.query('alter table stocktake_items alter column stock_unit_id drop not null')
  await pool.query('alter table stocktake_items alter column system_qty drop not null')
  await pool.query('alter table stocktake_items alter column actual_qty drop not null')
  await pool.query('alter table stocktake_items alter column difference_qty drop not null')
  await pool.query('alter table stocktake_items add column if not exists source_row_number integer')
  await pool.query('alter table stocktake_items add column if not exists source_product_code text')
  await pool.query('alter table stocktake_items add column if not exists source_product_name text')
  await pool.query('alter table stocktake_items add column if not exists source_unit_name text')
  await pool.query('alter table stocktake_items add column if not exists line_actual_value numeric(18,2)')
  await pool.query('alter table stocktake_items add column if not exists line_difference_value numeric(18,2)')
  await pool.query('alter table stocktake_items add column if not exists inventory_object_type text')
  await pool.query('alter table stocktake_items add column if not exists inventory_roll_id uuid')
  await pool.query('alter table stocktake_items add column if not exists inventory_sheet_id uuid')
  await pool.query('alter table stocktake_items add column if not exists updated_at timestamptz not null default now()')
  await pool.query(`
    create unique index if not exists stocktake_items_stocktake_source_row_uidx
    on stocktake_items (stocktake_id, source_row_number)
    where source_row_number is not null
  `)
  await pool.query('create index if not exists idx_stocktake_items_stocktake on stocktake_items (organization_id, stocktake_id, line_no)')
  await pool.query('create index if not exists idx_stocktake_items_product on stocktake_items (organization_id, product_id)')
}

async function ensureStockMovementsTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists stock_movements (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      movement_type text not null,
      quantity_delta numeric(18,6) not null,
      ending_qty numeric(18,6),
      document_type text,
      document_code text,
      transaction_price numeric(18,2),
      cost_price numeric(18,2),
      partner_name text,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query('alter table stock_movements add column if not exists ending_qty numeric(18,6)')
  await pool.query('alter table stock_movements add column if not exists document_type text')
  await pool.query('alter table stock_movements add column if not exists document_code text')
  await pool.query('alter table stock_movements add column if not exists transaction_price numeric(18,2)')
  await pool.query('alter table stock_movements add column if not exists cost_price numeric(18,2)')
  await pool.query('alter table stock_movements add column if not exists partner_name text')
  await pool.query('create index if not exists idx_stock_movements_product_created on stock_movements (organization_id, product_id, created_at desc)')
  await pool.query('create index if not exists idx_stock_movements_document on stock_movements (organization_id, document_type, document_code)')
}

async function derivedPurchaseStockMovementsFromSnapshots(pool: pg.Pool, organizationId: string, productId: string): Promise<StockMovementData[]> {
  await ensureImportedSnapshotTables(pool)
  const result = await pool.query(
    `
      with target_product as (
        select p.id::text, p.code
        from products p
        where p.organization_id = $1
          and p.id = $2::uuid
        limit 1
      ),
      receipt_items as (
        select
          prs.data as receipt,
          item.value as item,
          coalesce(nullif(regexp_replace(item.value #>> '{product,code}', '\\{DEL\\d*\\}$', '', 'i'), ''), item.value #>> '{product,code}') as source_product_code,
          row_number() over (partition by prs.code order by item.ordinality) as line_no
        from purchase_receipt_snapshots prs
        cross join lateral jsonb_array_elements(coalesce(prs.data->'items', '[]'::jsonb)) with ordinality as item(value, ordinality)
        where prs.organization_id = $1
          and prs.data->>'status' = 'posted'
      )
      select
        receipt->>'code' as document_code,
        receipt->>'received_at' as created_at,
        coalesce(receipt #>> '{supplier,name}', receipt #>> '{supplier,code}') as partner_name,
        item #>> '{product,code}' as raw_product_code,
        line_no,
        (item->>'quantity')::numeric * case
          when lower(receipt_items.source_product_code) = lower(target_product.code) then 1
          else coalesce(puc.stock_qty_per_unit, 1)
        end as quantity_delta,
        nullif(item->>'unit_cost', '')::numeric as unit_cost
      from receipt_items
      join target_product on true
      left join product_unit_conversions puc
        on puc.organization_id = $1
       and puc.product_id = $2::uuid
       and puc.is_active = true
       and lower(puc.source_code) = lower(receipt_items.source_product_code)
      where lower(receipt_items.source_product_code) = lower(target_product.code)
         or puc.id is not null
      order by nullif(receipt->>'received_at', '')::timestamptz asc, document_code asc, line_no asc
    `,
    [organizationId, productId],
  )
  let endingQty = 0
  const movements = result.rows.map((row) => {
    const quantityDelta = Number(row.quantity_delta || 0)
    endingQty += quantityDelta
    return {
      id: `derived-purchase-${row.document_code}-${row.line_no}`,
      product_id: productId,
      movement_type: 'purchase_receipt',
      quantity_delta: quantityDelta,
      created_at: dbDateText(row.created_at),
      document_code: row.document_code === null ? null : String(row.document_code),
      document_type: 'purchase_receipt' as const,
      transaction_price: row.unit_cost === null ? null : Number(row.unit_cost),
      cost_price: row.unit_cost === null ? null : Number(row.unit_cost),
      ending_qty: endingQty,
      partner_name: row.partner_name === null ? null : String(row.partner_name),
    } satisfies StockMovementData
  })
  return movements.reverse()
}

type StockImportProduct = {
  id: string
  code: string
  name: string
  unit_name: string
  track_inventory: boolean
  latest_purchase_cost: number | null
  factor: number
  purchase_unit_name?: string | null
}

async function stockProductsByImportCode(pool: pg.Pool, organizationId: string) {
  await ensureProductCatalogSchema(pool)
  await ensureProductUnitTables(pool)
  const result = await pool.query(
    `
      select
        p.id::text,
        p.code,
        p.name,
        p.unit_name,
        p.track_inventory,
        p.latest_purchase_cost,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'source_code', puc.source_code,
              'unit_name', sale_unit.name,
              'stock_qty_per_unit', puc.stock_qty_per_sale_unit
            )
          ) filter (where puc.id is not null and puc.is_active = true),
          '[]'::jsonb
        ) as unit_conversions
      from products p
      left join product_unit_conversions puc
        on puc.organization_id = p.organization_id
       and puc.product_id = p.id
       and puc.is_active = true
      left join inventory_units sale_unit
        on sale_unit.organization_id = p.organization_id
       and sale_unit.id = puc.sale_unit_id
       and sale_unit.is_active = true
      where p.organization_id = $1
      group by p.id
    `,
    [organizationId],
  )
  const products = new Map<string, StockImportProduct>()
  for (const row of result.rows) {
    const base: StockImportProduct = {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      unit_name: String(row.unit_name),
      track_inventory: Boolean(row.track_inventory),
      latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
      factor: 1,
    }
    products.set(baseKiotVietImportCode(base.code), base)
    for (const conversion of row.unit_conversions ?? []) {
      const sourceCode = baseKiotVietImportCode(String(conversion.source_code ?? ''))
      if (!sourceCode) continue
      const factor = Number(conversion.stock_qty_per_unit ?? 1)
      products.set(sourceCode, {
        ...base,
        factor: factor > 0 ? factor : 1,
        purchase_unit_name: String(conversion.unit_name ?? '').trim() || null,
      })
    }
  }
  return products
}

function purchaseReceiptItemStockFactor(products: Map<string, StockImportProduct>, product: StockImportProduct, item: PurchaseReceiptData['items'][number]) {
  const unitName = String(item.unit_name_snapshot ?? '').trim()
  if (!unitName || unitName === product.unit_name) return 1
  const conversion = [...products.values()].find((candidate) => (
    candidate.id === product.id
    && candidate.purchase_unit_name === unitName
    && candidate.factor > 0
  ))
  return conversion?.factor ?? 1
}

function resolveStockProduct(products: Map<string, StockImportProduct>, productCode: string) {
  if (isDeletedKiotVietImportCode(productCode)) return null
  return products.get(baseKiotVietImportCode(productCode)) ?? null
}

function cashbookFinanceAccountFromPurchaseAccount(account: FinanceAccountData): CashbookEntryData['finance_account'] {
  return {
    id: account.id,
    code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
    name: account.name,
    account_type: account.account_type,
    account_number: account.account_number,
    account_holder: account.account_holder,
  }
}

async function loadPurchaseReceiptSnapshot(pool: pg.Pool, organizationId: string, id: string) {
  const result = await pool.query(
    `
      select data
      from purchase_receipt_snapshots
      where organization_id = $1
        and (id = $2 or code = $2)
      limit 1
    `,
    [organizationId, id],
  )
  return result.rows[0]?.data as PurchaseReceiptData | null ?? null
}

async function purchaseReceiptWithSafeCode(
  pool: pg.Pool,
  organizationId: string,
  receipt: PurchaseReceiptData,
  sourceType: 'manual' | 'kiotviet_import',
) {
  if (sourceType !== 'manual' || !/^PN\d{6}(?:\.\d+)?$/i.test(receipt.code.trim())) return receipt

  const result = await pool.query(
    `
      select max((substring(upper(code) from '^PN([0-9]{6})(?:\\.[0-9]+)?$'))::integer) as max_number
      from purchase_receipt_snapshots
      where organization_id = $1
        and upper(code) ~ '^PN[0-9]{6}(\\.[0-9]+)?$'
    `,
    [organizationId],
  )
  const currentNumber = Number(result.rows[0]?.max_number ?? 0)
  const requestedNumber = Number(receipt.code.trim().toUpperCase().match(/^PN(\d{6})/)?.[1] ?? 0)
  const nextNumber = Math.max(currentNumber + 1, requestedNumber)
  const code = `PN${String(nextNumber).padStart(6, '0')}`
  return code === receipt.code ? receipt : { ...receipt, code }
}

async function purchaseSupplierCashbookEntry(
  pool: pg.Pool,
  input: {
    organizationId: string
    supplier: PurchaseReceiptData['supplier']
    receipt: PurchaseReceiptData
    amount: number
    paymentMethod: 'cash' | 'bank_transfer'
    financeAccountId?: string
    currentUser: CurrentUserData
    note: string
    suffix: string
  },
) {
  const account = await resolveFinanceAccountForPurchasePayment(pool, input.organizationId, input.paymentMethod, input.financeAccountId)
  const code = nextPurchaseSupplierPaymentCode(input.receipt.code, input.suffix)
  return {
    id: `cashbook-voucher-${randomUUID()}`,
    code,
    status: 'posted',
    direction: 'out',
    amount_delta: -Math.max(input.amount, 0),
    finance_account: cashbookFinanceAccountFromPurchaseAccount(account),
    is_business_accounted: true,
    source_type: 'purchase_supplier_payment',
    created_at: new Date().toISOString(),
    note: input.note,
    counterparty: {
      type: 'supplier',
      name: input.supplier.name,
      phone: null,
    },
    created_by: { id: input.currentUser.user.id, name: input.currentUser.user.display_name },
    source: {
      type: 'purchase_supplier_payment',
      id: code,
      code,
      order_code: input.receipt.code,
      source_note: input.note,
    },
    allocations: [{
      order_id: input.receipt.id,
      order_code: input.receipt.code,
      order_total_amount: input.receipt.payable_amount,
      collected_before: Math.max(input.receipt.paid_amount, 0),
      allocated_amount: Math.max(input.amount, 0),
      remaining_after: Math.max(input.receipt.remaining_amount - input.amount, 0),
    }],
    payment_method: input.paymentMethod,
  } satisfies CashbookEntryData
}

async function resolveFinanceAccountForPurchasePayment(
  pool: pg.Pool,
  organizationId: string,
  paymentMethod: 'cash' | 'bank_transfer',
  financeAccountId?: string,
) {
  await ensureFinanceAccountsTable(pool)
  const accountId = financeAccountId?.trim()
  if (accountId) {
    const result = await pool.query(
      `
        select id, code, name, account_type, is_default_cash, is_active,
               account_number, account_holder, opening_balance, note, notify_on_transaction
        from finance_accounts
        where organization_id = $1 and id = $2
        limit 1
      `,
      [organizationId, accountId],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Finance account not found')
    return mapFinanceAccountRow(row)
  }
  const fallbackType = paymentMethod === 'bank_transfer' ? 'bank' : 'cash'
  const result = await pool.query(
    `
      select id, code, name, account_type, is_default_cash, is_active,
             account_number, account_holder, opening_balance, note, notify_on_transaction
      from finance_accounts
      where organization_id = $1 and account_type = $2 and is_active = true
      order by is_default_cash desc, name asc
      limit 1
    `,
    [organizationId, fallbackType],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Finance account not found')
  return mapFinanceAccountRow(row)
}

function nextPurchaseSupplierPaymentCode(receiptCode: string, suffix: string) {
  const code = receiptCode.trim().toUpperCase()
  const match = code.match(/^PN(\d{6}(?:\.\d+)?)$/)
  if (match) return `PCPN${match[1]}${suffix ? `-${suffix}` : ''}`
  return `PCPN${suffix ? `-${suffix}` : ''}`
}

function purchaseReceiptCodeFromSupplierPaymentCode(code: string) {
  const match = code.trim().toUpperCase().match(/^PCPN(\d{6}(?:\.\d+)?)/)
  return match ? `PN${match[1]}` : ''
}

async function recomputeSupplierPurchaseTotals(pool: pg.Pool, organizationId: string, supplierId?: string | null) {
  await ensureImportedSnapshotTables(pool)
  const supplierResult = await pool.query(
    `
      select id, data
      from supplier_snapshots
      where organization_id = $1
        and ($2::text is null or id = $2::text)
    `,
    [organizationId, supplierId ?? null],
  )
  const receiptResult = await pool.query(
    `
      select data
      from purchase_receipt_snapshots
      where organization_id = $1
        and ($2::text is null or data->'supplier'->>'id' = $2::text or data->>'supplier_id' = $2::text)
    `,
    [organizationId, supplierId ?? null],
  )
  const cashbookResult = await pool.query(
    `
      select id, code, status, amount_delta, created_at, source
      from cashbook_entries
      where organization_id = $1
        and status = 'posted'
        and (
          source_type = 'purchase_supplier_payment'
          or (
            source_type in ('cashbook_voucher', 'kiotviet_cashbook')
            and code ~* '^(PCPN|PC)[0-9]'
          )
        )
    `,
    [organizationId],
  )
  const suppliers = supplierResult.rows.map((row) => row.data as SupplierListData)
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const linkedSupplierByCustomerId = new Map<string, string>()
  for (const supplier of suppliers) {
    const linkedCustomerId = supplier.linked_customer_id?.trim()
    if (linkedCustomerId) linkedSupplierByCustomerId.set(linkedCustomerId, supplier.id)
  }
  const linkedCustomerIds = [...linkedSupplierByCustomerId.keys()]
  const [linkedInvoiceResult, linkedCashbookResult, linkedAdjustmentResult] = linkedCustomerIds.length > 0
    ? await Promise.all([
        pool.query(
          `
            select id, code, created_at, customer_id, total_amount
            from orders
            where organization_id = $1
              and customer_id = any($2::text[])
              and order_type = 'invoice'
              and status <> 'cancelled'
            order by created_at asc, code asc
          `,
          [organizationId, linkedCustomerIds],
        ),
        pool.query(
          `
            select
              cbe.id,
              cbe.code,
              cbe.status,
              cbe.amount_delta,
              cbe.created_at,
              coalesce(cbe.source->>'customer_id', o.customer_id, cs.id) as customer_id
            from cashbook_entries cbe
            left join orders o
              on o.organization_id = cbe.organization_id
             and o.code = cbe.source->>'order_code'
            left join customer_snapshots cs
              on cs.organization_id = cbe.organization_id
             and (
               lower(cs.code) = lower(cbe.source->>'counterparty_code')
               or cs.id = 'customer-kv-' || lower(regexp_replace(coalesce(cbe.source->>'counterparty_code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
             )
            where cbe.organization_id = $1
              and cbe.status = 'posted'
              and (
                (
                  cbe.source_type = 'payment_receipt_method'
                  and (
                    cbe.source->>'customer_id' = any($2::text[])
                    or (o.customer_id = any($2::text[]) and o.status <> 'cancelled')
                  )
                )
                or (
                  cbe.source_type = 'kiotviet_cashbook'
                  and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
                  and (
                    cbe.source->>'customer_id' = any($2::text[])
                    or cs.id = any($2::text[])
                    or (o.customer_id = any($2::text[]) and o.status <> 'cancelled')
                  )
                )
              )
            order by cbe.created_at asc, cbe.code asc
          `,
          [organizationId, linkedCustomerIds],
        ),
        pool.query(
          `
            select id, source_code, created_at, customer_id, amount_delta
            from customer_debt_adjustments
            where organization_id = $1
              and customer_id = any($2::text[])
              and source_system = 'kiotviet'
            order by created_at asc, source_row asc nulls last, updated_at asc
          `,
          [organizationId, linkedCustomerIds],
        ),
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }]
  const totals = new Map<string, {
    total_purchase_amount: number
    current_payable_amount: number
    debt_ledger_rows: NonNullable<SupplierListData['debt_ledger_rows']>
  }>()
  const receiptByCode = new Map<string, PurchaseReceiptData>()
  const documentsBySupplier = new Map<string, PartnerDebtDocumentInput[]>()
  const paymentTotalByReceiptCode = new Map<string, number>()
  for (const row of receiptResult.rows) {
    const receipt = row.data as PurchaseReceiptData
    if (receipt.status !== 'posted') continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    receiptByCode.set(receipt.code.trim().toUpperCase(), receipt)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: receipt.id,
      code: receipt.code,
      time: receipt.received_at || receipt.created_at,
      amount: Number(receipt.payable_amount || 0),
      status: 'posted',
      sourceType: 'purchase_receipt',
      sourceId: receipt.id,
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of cashbookResult.rows) {
    const code = String(row.code ?? '').trim().toUpperCase()
    const orderCode = String(row.source?.order_code ?? '').trim().toUpperCase()
    const matchedReceiptCode = orderCode || purchaseReceiptCodeFromSupplierPaymentCode(code)
    const receipt = matchedReceiptCode ? receiptByCode.get(matchedReceiptCode) : null
    if (!receipt) continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    const amount = Math.abs(Number(row.amount_delta || 0))
    paymentTotalByReceiptCode.set(receipt.code.trim().toUpperCase(), (paymentTotalByReceiptCode.get(receipt.code.trim().toUpperCase()) ?? 0) + amount)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: code || nextPurchaseSupplierPaymentCode(receipt.code, ''),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount,
      status: 'posted',
      sourceType: 'supplier_payment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const receipt of receiptByCode.values()) {
    const receiptCode = receipt.code.trim().toUpperCase()
    if ((paymentTotalByReceiptCode.get(receiptCode) ?? 0) > 0) continue
    const paidAmount = Math.max(Number(receipt.paid_amount || 0), Number(receipt.payable_amount || 0) - Number(receipt.remaining_amount || 0), 0)
    if (paidAmount <= 0) continue
    const supplierKey = receipt.supplier?.id ?? receipt.supplier_id
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: `${receipt.id}:paid`,
      code: nextPurchaseSupplierPaymentCode(receipt.code, ''),
      time: receipt.received_at || receipt.created_at,
      amount: paidAmount,
      status: 'posted',
      sourceType: 'supplier_payment',
      sourceId: receipt.id,
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedInvoiceResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Number(row.total_amount || 0),
      status: 'posted',
      sourceType: 'linked_customer_invoice',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedCashbookResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Math.abs(Number(row.amount_delta || 0)),
      status: String(row.status || 'posted'),
      sourceType: 'linked_customer_payment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const row of linkedAdjustmentResult.rows) {
    const supplierKey = linkedSupplierByCustomerId.get(String(row.customer_id))
    if (!supplierKey) continue
    const amountDelta = Number(row.amount_delta || 0)
    const documents = documentsBySupplier.get(supplierKey) ?? []
    documents.push({
      id: String(row.id),
      code: String(row.source_code),
      time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      amount: Math.abs(amountDelta),
      normalizedAmountDelta: amountDelta,
      status: 'posted',
      sourceType: 'linked_customer_adjustment',
      sourceId: String(row.id),
    })
    documentsBySupplier.set(supplierKey, documents)
  }
  for (const [supplierKey, documents] of documentsBySupplier) {
    const ledger = buildPartnerDebtLedger({ view: 'supplier', linked: Boolean(supplierById.get(supplierKey)?.linked_customer_id), documents })
    totals.set(supplierKey, {
      total_purchase_amount: documents
        .filter((document) => /^PN\d/i.test(document.code))
        .reduce((sum, document) => sum + Math.abs(Number(document.amount || 0)), 0),
      current_payable_amount: ledger.totalDebt,
      debt_ledger_rows: ledger.rows.map((row) => ({
        id: row.id,
        code: row.code,
        created_at: row.time,
        amount_delta: row.amountDelta,
        balance_after: row.balanceAfter,
        source_type: row.sourceType,
        source_id: row.sourceId,
      })),
    })
  }
  await pool.query('begin')
  try {
    for (const row of supplierResult.rows) {
      const current = row.data as SupplierListData
      const total = totals.get(current.id) ?? { total_purchase_amount: 0, current_payable_amount: 0, debt_ledger_rows: [] }
      const next = {
        ...current,
        total_purchase_amount: total.total_purchase_amount,
        current_payable_amount: total.current_payable_amount,
        debt_ledger_rows: total.debt_ledger_rows,
      } satisfies SupplierListData
      await pool.query(
        `
          update supplier_snapshots
          set data = $3::jsonb, updated_at = now()
          where organization_id = $1 and id = $2
        `,
        [organizationId, current.id, JSON.stringify(next)],
      )
    }
    await pool.query('commit')
  } catch (error) {
    await pool.query('rollback')
    throw error
  }
}

async function replacePurchaseReceiptStockMovements(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData) {
  await ensureStockMovementsTable(pool)
  await deleteStockMovementsForDocument(pool, organizationId, 'purchase_receipt', receipt.code)
  const products = await stockProductsByImportCode(pool, organizationId)
  let endingQty = 0
  const affectedProducts = new Set<string>()
  for (const [index, item] of receipt.items.entries()) {
    const product = [...products.values()].find((candidate) => candidate.id === item.product_id)
    if (!product?.track_inventory) continue
    const quantityDelta = Number(item.quantity || 0) * purchaseReceiptItemStockFactor(products, product, item)
    if (quantityDelta <= 0) continue
    endingQty += quantityDelta
    affectedProducts.add(product.id)
    await insertStockMovement(pool, organizationId, {
      id: stableUuidFromText(`stock-movement-manual-purchase-${receipt.code}-${index + 1}`),
      productId: product.id,
      movementType: 'purchase_receipt',
      quantityDelta,
      endingQty,
      documentType: 'purchase_receipt',
      documentCode: receipt.code,
      transactionPrice: item.unit_cost,
      costPrice: item.unit_cost,
      partnerName: receipt.supplier.name,
      createdAt: receipt.received_at,
    })
  }
  return affectedProducts
}

async function updateLatestPurchaseCostsFromReceipt(pool: pg.Pool, organizationId: string, receipt: PurchaseReceiptData) {
  await ensureProductCatalogSchema(pool)
  for (const item of receipt.items) {
    await pool.query(
      `
        update products
        set latest_purchase_cost = $3,
            latest_purchase_cost_at = now(),
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, item.product_id, item.unit_cost],
    )
  }
}

type DraftBomComponent = {
  productId: string
  quantity: number
  factor: number
  trackInventory: boolean
  latestPurchaseCost: number | null
}

async function draftBomComponentsByProductId(pool: pg.Pool, organizationId: string) {
  await ensureProductBomTables(pool)
  const result = await pool.query(
    `
      select
        pb.product_id::text as parent_product_id,
        p.id::text as component_product_id,
        pbi.quantity,
        p.track_inventory,
        p.latest_purchase_cost
      from product_boms pb
      join product_bom_items pbi
        on pbi.organization_id = pb.organization_id
       and pbi.bom_id = pb.id
      join products p
        on p.organization_id = pbi.organization_id
       and p.id = pbi.component_product_id
      where pb.organization_id = $1
        and pb.status in ('draft', 'active')
      order by pb.product_id, pbi.sort_order, pbi.id
    `,
    [organizationId],
  )
  const byProductId = new Map<string, DraftBomComponent[]>()
  for (const row of result.rows) {
    const parentId = String(row.parent_product_id)
    const components = byProductId.get(parentId) ?? []
    components.push({
      productId: String(row.component_product_id),
      quantity: Number(row.quantity ?? 0),
      factor: 1,
      trackInventory: Boolean(row.track_inventory),
      latestPurchaseCost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
    })
    byProductId.set(parentId, components)
  }
  return byProductId
}

async function snapshotByCode<T>(pool: pg.Pool, tableName: 'customer_snapshots' | 'supplier_snapshots', organizationId: string, code: string) {
  const importCode = baseKiotVietImportCode(code)
  const result = await pool.query(
    `
      select data
      from ${tableName}
      where organization_id = $1
        and (
          lower(code) = lower($2)
          or id = any($3::text[])
        )
      limit 1
    `,
    [organizationId, importCode, snapshotImportIds(tableName, importCode)],
  )
  return result.rows[0]?.data as T | null ?? null
}

function snapshotImportIds(tableName: 'customer_snapshots' | 'supplier_snapshots', code: string) {
  const prefix = tableName === 'customer_snapshots' ? 'customer-kv' : 'supplier-kv'
  const normalizedCode = baseKiotVietImportCode(code)
  return [
    `${prefix}-${normalizedCode.toLowerCase()}`,
    `${prefix}-${hashText(normalizedCode)}`,
  ]
}

async function loadCustomerBillPrintExtras(
  pool: pg.Pool,
  organizationId: string,
  customerId: string | null | undefined,
  customerCode: string | null | undefined,
) {
  if ((customerCode ?? '').trim().toLowerCase() === 'khachle') {
    return {
      preferred_bill_template: null,
      preferred_bill_templates: [] as string[],
      address: null,
      total_debt_amount: null,
    }
  }
  await ensureImportedSnapshotTables(pool)
  const result = await pool.query(
    `
      select data
      from customer_snapshots
      where organization_id = $1
        and (
          ($2::text is not null and id = $2)
          or ($3::text is not null and lower(code) = lower($3))
        )
      limit 1
    `,
    [organizationId, customerId ?? null, customerCode ?? null],
  )
  const data = result.rows[0]?.data as CustomerListData | undefined
  const debtRaw = data?.total_debt_amount
  const preferredIds = resolveCustomerBillPreferenceIds({
    preferred_bill_templates: data?.preferred_bill_templates,
    preferred_bill_template: data?.preferred_bill_template,
  })
  return {
    preferred_bill_template: normalizeBillPreferenceValue(data?.preferred_bill_template ?? null) ?? preferredIds[0] ?? null,
    preferred_bill_templates: preferredIds,
    address: typeof data?.address === 'string' && data.address.trim() ? data.address.trim() : null,
    total_debt_amount: typeof debtRaw === 'number' && Number.isFinite(debtRaw) ? debtRaw : null,
  }
}

function purchaseReceiptDataFromImportRows(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]['rows'],
  supplier: SupplierListData | null,
): PurchaseReceiptData {
  const first = rows[0]
  return {
    id: `purchase-receipt-kv-${hashText(sourceCode)}`,
    code: sourceCode,
    status: first.status,
    received_at: first.received_at ?? first.source_created_at ?? first.updated_at ?? new Date().toISOString(),
    supplier: supplier ?? {
      id: `supplier-kv-${hashText(first.supplier_code)}`,
      code: first.supplier_code,
      name: first.supplier_name ?? first.supplier_code,
    },
    created_by: { id: 'kiotviet', name: first.source_creator_name ?? first.received_by_name ?? 'KiotViet' },
    subtotal_amount: first.subtotal_amount,
    discount_amount: first.receipt_discount_amount,
    payable_amount: first.payable_amount,
    paid_amount: first.paid_amount,
    supplier_document_no: first.supplier_document_no ?? '',
    notes: first.note ?? null,
    items: rows.map((row, index) => ({
      id: `purchase-receipt-item-kv-${hashText(`${sourceCode}-${row.rowNumber}`)}`,
      product_id: resolveImportedProductSnapshotId(row.product_code),
      product: {
        id: `product-kv-${hashText(row.product_code)}`,
        code: row.product_code,
        name: row.product_name ?? row.product_code,
      },
      line_no: index + 1,
      inventory_shape: 'normal',
      unit_name_snapshot: row.unit_name ?? '',
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      discount_amount: row.line_discount_amount,
      line_amount: row.line_amount,
      physical_payload: null,
    })),
  } as PurchaseReceiptData
}

function salesDocumentDataFromImportRows(
  sourceCode: string,
  rows: Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'],
  customer: CustomerListData | null,
): SalesDocumentData {
  const first = rows[0]
  const totalAmount = first.total_amount
  const paidAmount = first.paid_amount
  return {
    id: `sales-document-kv-${hashText(sourceCode)}`,
    code: sourceCode,
    order_type: 'invoice',
    status: first.status,
    created_at: first.created_at ?? first.updated_at ?? new Date().toISOString(),
    customer: customer ?? {
      id: `customer-kv-${hashText(first.customer_code)}`,
      code: first.customer_code,
      name: first.customer_name,
      phone: first.customer_phone,
    },
    seller: { id: 'kiotviet', name: first.source_user_name ?? 'KiotViet' },
    subtotal_amount: first.subtotal_amount,
    discount_amount: first.invoice_discount_amount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    debt_amount: Math.max(totalAmount - paidAmount, 0),
    payment_status: paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    note: first.note ?? '',
    items: rows.map((row) => ({
      product_id: resolveImportedProductSnapshotId(row.product_code),
      quantity: row.quantity,
      unit_price: row.unit_price,
      discount_amount: row.line_discount_amount,
      line_total: row.line_amount,
      note: row.product_note,
    })),
  }
}

function resolveImportedProductSnapshotId(productCode: string) {
  return `product-kv-${hashText(baseKiotVietImportCode(productCode))}`
}

async function insertStockMovement(
  pool: pg.Pool,
  organizationId: string,
  movement: {
    id: string
    productId: string
    movementType: string
    quantityDelta: number
    endingQty: number | null
    documentType: string
    documentCode: string
    transactionPrice: number | null
    costPrice: number | null
    partnerName: string | null
    createdAt: string
  },
) {
  await pool.query(
    `
      insert into stock_movements (
        id, organization_id, product_id, movement_type, quantity_delta, ending_qty,
        document_type, document_code, transaction_price, cost_price, partner_name, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (id) do update set
        quantity_delta = excluded.quantity_delta,
        ending_qty = excluded.ending_qty,
        transaction_price = excluded.transaction_price,
        cost_price = excluded.cost_price,
        partner_name = excluded.partner_name,
        created_at = excluded.created_at
    `,
    [
      movement.id,
      organizationId,
      movement.productId,
      movement.movementType,
      movement.quantityDelta,
      movement.endingQty,
      movement.documentType,
      movement.documentCode,
      movement.transactionPrice,
      movement.costPrice,
      movement.partnerName,
      movement.createdAt,
    ],
  )
}

function shouldDeductSaleParentStock(product: { track_inventory: boolean; product_kind?: string | null } | null | undefined) {
  // KV Combo–Đóng gói / dịch vụ: không trừ tồn mã cha; chỉ trừ thành phần (BOM) khi có.
  if (!product?.track_inventory) return false
  const kind = String(product.product_kind ?? '').trim().toLowerCase()
  if (kind === 'combo' || kind === 'service') return false
  return true
}

async function saleParentProductsById(pool: pg.Pool, organizationId: string, productIds: Iterable<string>) {
  const ids = [...new Set([...productIds].map((id) => String(id ?? '').trim()).filter(Boolean))]
  const byId = new Map<string, { id: string; track_inventory: boolean; product_kind: string }>()
  if (ids.length === 0) return byId
  await ensureProductCatalogSchema(pool)
  const result = await pool.query(
    `
      select id::text, track_inventory, product_kind
      from products
      where organization_id = $1
        and id::text = any($2::text[])
    `,
    [organizationId, ids],
  )
  for (const row of result.rows) {
    byId.set(String(row.id), {
      id: String(row.id),
      track_inventory: Boolean(row.track_inventory),
      product_kind: String(row.product_kind ?? 'goods'),
    })
  }
  return byId
}

async function saveSalesDocumentStockMovements(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  const affectedProducts = await deleteStockMovementsForDocument(pool, organizationId, 'sale_invoice', document.code)
  if (document.order_type === 'invoice' && document.status === 'completed') {
    await ensureProductBomTables(pool)
    const bomComponentsByProductId = await draftBomComponentsByProductId(pool, organizationId)
    const parentProductsById = await saleParentProductsById(
      pool,
      organizationId,
      document.items.map((item) => String((item as { product_id?: string }).product_id ?? '')),
    )
    let runningEndingQty = 0
    for (const [index, rawItem] of document.items.entries()) {
      const item = rawItem as {
        product_id: string
        quantity?: number
        stock_qty_per_sale_unit?: number
        unit_price?: number
      }
      const quantity = Number(item.quantity ?? 0)
      const stockQtyPerSaleUnit = Number(item.stock_qty_per_sale_unit ?? 1)
      const factor = Number.isFinite(stockQtyPerSaleUnit) && stockQtyPerSaleUnit > 0 ? stockQtyPerSaleUnit : 1
      const soldQuantity = quantity * factor
      const quantityDelta = -soldQuantity
      const parentProduct = parentProductsById.get(item.product_id)
      if (shouldDeductSaleParentStock(parentProduct) && quantityDelta !== 0) {
        runningEndingQty += quantityDelta
        affectedProducts.add(item.product_id)
        await insertStockMovement(pool, organizationId, {
          id: stableUuidFromText(`stock-movement-pos-sale-${document.code}-${index + 1}`),
          productId: item.product_id,
          movementType: 'sale_deduction',
          quantityDelta,
          endingQty: runningEndingQty,
          documentType: 'sale_invoice',
          documentCode: document.code,
          transactionPrice: Number(item.unit_price ?? 0),
          costPrice: null,
          partnerName: document.customer.name,
          createdAt: document.created_at,
        })
      }
      for (const component of bomComponentsByProductId.get(item.product_id) ?? []) {
        if (!component.trackInventory) continue
        const componentDelta = -soldQuantity * component.quantity * component.factor
        if (componentDelta === 0) continue
        affectedProducts.add(component.productId)
        await insertStockMovement(pool, organizationId, {
          id: stableUuidFromText(`stock-movement-pos-sale-bom-${document.code}-${index + 1}-${component.productId}`),
          productId: component.productId,
          movementType: 'sale_deduction',
          quantityDelta: componentDelta,
          endingQty: null,
          documentType: 'sale_invoice',
          documentCode: document.code,
          transactionPrice: null,
          costPrice: component.latestPurchaseCost,
          partnerName: document.customer.name,
          createdAt: document.created_at,
        })
      }
    }
  }
  await recomputeStockMovementBalances(pool, organizationId, affectedProducts)
}

async function deleteStockMovementsForDocument(pool: pg.Pool, organizationId: string, documentType: string, documentCode: string) {
  const result = await pool.query(
    `
      delete from stock_movements
      where organization_id = $1
        and document_type = $2
        and document_code = $3
      returning product_id::text
    `,
    [organizationId, documentType, documentCode],
  )
  return new Set(result.rows.map((row) => String(row.product_id)))
}

async function deleteStockMovementsForDocuments(pool: pg.Pool, organizationId: string, documentType: string) {
  const result = await pool.query(
    `
      delete from stock_movements
      where organization_id = $1
        and document_type = $2
      returning product_id::text
    `,
    [organizationId, documentType],
  )
  return new Set(result.rows.map((row) => String(row.product_id)))
}

async function recomputeStockMovementBalances(pool: pg.Pool, organizationId: string, productIds: Iterable<string>) {
  for (const productId of new Set(productIds)) {
    const movements = await pool.query(
      `
        select id::text, quantity_delta
        from stock_movements
        where organization_id = $1 and product_id = $2
        order by created_at, id
      `,
      [organizationId, productId],
    )
    let endingQty = 0
    for (const row of movements.rows) {
      endingQty += Number(row.quantity_delta)
      await pool.query(
        `
          update stock_movements
          set ending_qty = $3
          where organization_id = $1 and id = $2
        `,
        [organizationId, row.id, endingQty],
      )
    }
  }
}

async function latestStockMovementQty(pool: pg.Pool, organizationId: string, productId: string) {
  const result = await pool.query(
    `
      select coalesce(ending_qty, quantity_delta) as ending_qty
      from stock_movements
      where organization_id = $1
        and product_id = $2
      order by created_at desc, id desc
      limit 1
    `,
    [organizationId, productId],
  )
  return result.rows[0]?.ending_qty === undefined ? 0 : Number(result.rows[0].ending_qty)
}

async function ensureInventoryMaterialOpeningsTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists inventory_material_openings (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      inventory_shape text not null check (inventory_shape in ('normal', 'roll', 'sheet')),
      source_type text not null,
      opened_unit_id text,
      opened_qty numeric(18,6),
      opened_stock_qty numeric(18,6),
      old_remaining_qty numeric(18,6),
      stock_movement_id text,
      note text,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query('create index if not exists idx_inventory_material_openings_product on inventory_material_openings (organization_id, product_id, created_at desc)')
}

async function materialOpeningProduct(pool: pg.Pool, organizationId: string, productId: string) {
  const result = await pool.query(
    `
      select p.id::text, p.code, p.name, p.latest_purchase_cost, pis.inventory_shape, pis.stock_unit_id::text
      from products p
      left join product_inventory_settings pis on pis.organization_id = p.organization_id and pis.product_id = p.id
      where p.organization_id = $1
        and p.id = $2
      limit 1
    `,
    [organizationId, productId],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost),
    inventory_shape: String(row.inventory_shape ?? 'normal'),
    stock_unit_id: row.stock_unit_id === null ? null : String(row.stock_unit_id),
  }
}

async function materialOpeningStockQtyPerUnit(pool: pg.Pool, organizationId: string, productId: string, openedUnitId: string, stockUnitId: string | null) {
  if (stockUnitId && openedUnitId === stockUnitId) return 1
  const result = await pool.query(
    `
      select coalesce(stock_qty_per_sale_unit, 1) as stock_qty_per_unit
      from product_unit_conversions
      where organization_id = $1
        and product_id = $2
        and sale_unit_id = $3::uuid
        and is_active = true
      limit 1
    `,
    [organizationId, productId, openedUnitId],
  )
  return Number(result.rows[0]?.stock_qty_per_unit ?? 1) || 1
}

function stableUuidFromText(value: string) {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function baseKiotVietImportCode(value: string) {
  return value.trim().replace(/\{DEL\d*\}$/i, '')
}

function isDeletedKiotVietImportCode(value: string) {
  return /\{DEL\d*\}$/i.test(value.trim())
}

async function relaxCheckConstraint(pool: pg.Pool, tableName: string, columnName: string, allowedValues: string[]) {
  const result = await pool.query(
    `
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = current_schema()
        and t.relname = $1
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%' || $2 || '%'
    `,
    [tableName, columnName],
  )
  for (const row of result.rows) {
    await pool.query(`alter table ${pgIdentifier(tableName)} drop constraint ${pgIdentifier(String(row.conname))}`)
  }
  const constraintName = `${tableName}_${columnName}_check`
  const valueList = allowedValues.map(sqlStringLiteral).join(', ')
  await pool.query(`alter table ${pgIdentifier(tableName)} add constraint ${pgIdentifier(constraintName)} check (${pgIdentifier(columnName)} in (${valueList}))`)
}

function importedStocktakeStatus(status: 'draft' | 'balanced' | 'cancelled' | 'unknown') {
  return status === 'unknown' ? 'draft' : status
}

function importedStocktakeNote(rows: Array<{ note: string | null }>) {
  return rows.find((row) => row.note?.trim())?.note?.trim() ?? 'Lịch sử kiểm kho KiotViet'
}

function importedStocktakeSourceCreatorName(rows: Array<{ source_creator_name?: string | null }>) {
  return rows.find((row) => row.source_creator_name?.trim())?.source_creator_name?.trim() ?? null
}

async function findUserIdByImportedCreator(pool: pg.Pool, organizationId: string, sourceCreatorName: string | null) {
  const normalized = normalizeImportedCreator(sourceCreatorName)
  if (!normalized) return null
  const result = await pool.query(
    `
      select id::text
      from users
      where organization_id = $1
        and status = 'active'
        and lower(coalesce(username, '')) = $2
      limit 2
    `,
    [organizationId, normalized],
  )
  return result.rows.length === 1 ? String(result.rows[0].id) : null
}

function normalizeImportedCreator(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\{DEL\}$/i, '')
    .trim()
    .toLowerCase()
}

function pgIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function sqlStringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function ensureProductBomTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists product_boms (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id uuid not null references products(id) on delete cascade,
      version integer not null check (version > 0),
      status text not null check (status in ('draft', 'active', 'archived')),
      notes text,
      created_at timestamptz not null default now(),
      unique (organization_id, product_id, version)
    )
  `)
  await pool.query('create index if not exists idx_product_boms_product_status on product_boms (organization_id, product_id, status)')
  await pool.query(`
    create table if not exists product_bom_items (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      bom_id uuid not null references product_boms(id) on delete cascade,
      component_product_id uuid not null references products(id),
      quantity numeric(18,6) not null check (quantity > 0),
      calculation_payload jsonb not null default '{}'::jsonb,
      sort_order integer not null default 1,
      notes text
    )
  `)
  await pool.query("alter table product_bom_items add column if not exists calculation_payload jsonb not null default '{}'::jsonb")
  await pool.query('alter table product_bom_items add column if not exists sort_order integer not null default 1')
  await pool.query('alter table product_bom_items add column if not exists notes text')
  await pool.query('create index if not exists idx_product_bom_items_bom on product_bom_items (organization_id, bom_id, sort_order)')
  await pool.query('create index if not exists idx_product_bom_items_component on product_bom_items (organization_id, component_product_id)')
}

async function loadProductBomDetail(pool: pg.Pool, organizationId: string, productId: string) {
  await ensureProductBomTables(pool)
  const bom = await pool.query(
    `
      select id::text, product_id::text, version, status, notes, created_at
      from product_boms
      where organization_id = $1
        and product_id::text = $2
        and status in ('active', 'draft')
      order by case when status = 'active' then 0 else 1 end, version desc, created_at desc
      limit 1
    `,
    [organizationId, productId],
  )
  const row = bom.rows[0]
  if (!row) return null
  const items = await pool.query(
    `
      select
        pbi.id::text,
        pbi.component_product_id::text,
        pbi.quantity,
        pbi.sort_order,
        pbi.notes,
        p.id::text as component_id,
        p.code as component_code,
        p.name as component_name,
        p.unit_name as component_unit_name,
        p.product_kind as component_product_kind,
        p.latest_purchase_cost as component_latest_purchase_cost
      from product_bom_items pbi
      join products p
        on p.organization_id = pbi.organization_id
       and p.id = pbi.component_product_id
      where pbi.organization_id = $1
        and pbi.bom_id = $2
      order by pbi.sort_order, pbi.id
    `,
    [organizationId, row.id],
  )
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    version: Number(row.version),
    status: String(row.status) as 'draft' | 'active' | 'archived',
    notes: row.notes === null ? null : String(row.notes),
    created_at: row.created_at?.toISOString?.() ?? String(row.created_at),
    items: items.rows.map((item) => ({
      id: String(item.id),
      component_product_id: String(item.component_product_id),
      component_product: {
        id: String(item.component_id),
        code: String(item.component_code),
        name: String(item.component_name),
        unit_name: String(item.component_unit_name),
        product_kind: String(item.component_product_kind),
        latest_purchase_cost: item.component_latest_purchase_cost === null ? null : Number(item.component_latest_purchase_cost),
      },
      quantity: Number(item.quantity),
      sort_order: Number(item.sort_order),
      notes: item.notes === null ? null : String(item.notes),
    })),
  }
}

async function findProductIdByCode(pool: pg.Pool, organizationId: string, productCode: string) {
  const result = await pool.query(
    `
      select p.id::text
      from products p
      where p.organization_id = $1
        and p.code = $2
      union
      select p.id::text
      from product_unit_conversions puc
      join products p
        on p.organization_id = puc.organization_id
        and p.id = puc.product_id
      where puc.organization_id = $1
        and puc.source_code = $2
        and puc.is_active = true
      limit 1
    `,
    [organizationId, productCode],
  )
  return result.rows[0]?.id ? String(result.rows[0].id) : null
}

function inventoryUnitCode(unitName: string) {
  const normalized = unitName
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return `KV-${normalized || 'UNIT'}-${stableHash(unitName)}`
}

function inventoryUnitKind(unitName: string) {
  const normalized = normalizeSearchText(unitName)
  if (normalized === 'm' || normalized.includes('met')) return 'length'
  if (normalized === 'm2' || normalized.includes('m2')) return 'area'
  if (normalized.includes('kg') || normalized.includes('gram')) return 'weight'
  if (normalized.includes('lit')) return 'volume'
  if (normalized.includes('ram') || normalized.includes('cuon') || normalized.includes('bao') || normalized.includes('kho')) return 'package'
  return 'quantity'
}

async function ensurePosProductUsageTable(pool: pg.Pool) {
  await pool.query(`
    create table if not exists pos_product_usage (
      organization_id uuid not null references organizations(id) on delete cascade,
      product_id text not null,
      usage_count integer not null default 0 check (usage_count >= 0),
      updated_at timestamptz not null default now(),
      primary key (organization_id, product_id)
    )
  `)
  await pool.query('create index if not exists pos_product_usage_rank_idx on pos_product_usage (organization_id, usage_count desc, product_id)')
}

async function ensureSearchSelectionStatsTable(pool: pg.Pool) {
  return ensureSchemaOnce(searchSelectionStatsEnsureCache, pool, async () => {
    await pool.query(`
      create table if not exists search_selection_stats (
        organization_id uuid not null references organizations(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        entity_type text not null check (entity_type in ('customer', 'supplier', 'product')),
        entity_id text not null,
        select_count integer not null default 0 check (select_count >= 0),
        last_selected_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (organization_id, user_id, entity_type, entity_id)
      )
    `)
    await pool.query(`
      create index if not exists search_selection_stats_rank_idx
      on search_selection_stats (organization_id, user_id, entity_type, select_count desc, last_selected_at desc)
    `)
  })
}

async function quickPickRankedItems<T extends { id: string }>(input: {
  pool: pg.Pool
  organizationId: string
  userId?: string
  entityType: 'customer' | 'supplier' | 'product'
  url: URL
  items: T[]
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}): Promise<T[]> {
  if (input.url.searchParams.get('search_context') !== 'quick_pick' || !input.userId || input.items.length === 0) {
    return input.items
  }
  const ranks = await searchSelectionRanks(input.pool, {
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: input.entityType,
    entityIds: input.items.map((item) => item.id),
  })
  return rankQuickPickItems(input.items, {
    ranks,
    search: normalizeSearchText(input.url.searchParams.get('search') ?? input.url.searchParams.get('q') ?? ''),
    codeOf: input.codeOf,
    nameOf: input.nameOf,
  })
}

async function searchSelectionRanks(pool: pg.Pool, input: {
  organizationId: string
  userId: string
  entityType: 'customer' | 'supplier' | 'product'
  entityIds: string[]
}) {
  await ensureSearchSelectionStatsTable(pool)
  const result = await pool.query(
    `
      select entity_id, select_count, last_selected_at
      from search_selection_stats
      where organization_id = $1
        and user_id = $2
        and entity_type = $3
        and entity_id = any($4::text[])
    `,
    [input.organizationId, input.userId, input.entityType, input.entityIds],
  )
  return new Map(result.rows.map((row) => [String(row.entity_id), {
    selectCount: Number(row.select_count),
    lastSelectedAt: row.last_selected_at?.toISOString?.() ?? String(row.last_selected_at),
  }]))
}

function rankQuickPickItems<T extends { id: string }>(items: T[], input: {
  ranks: Map<string, { selectCount: number; lastSelectedAt: string }>
  search: string
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}) {
  return items
    .map((item, index) => ({ item, index, score: quickPickItemScore(item, input) }))
    .sort((left, right) => (
      right.score.selectCount - left.score.selectCount
      || right.score.lastSelectedAt - left.score.lastSelectedAt
      || right.score.exactCode - left.score.exactCode
      || right.score.codePrefix - left.score.codePrefix
      || right.score.exactName - left.score.exactName
      || right.score.namePrefix - left.score.namePrefix
      || left.index - right.index
    ))
    .map((entry) => entry.item)
}

function quickPickItemScore<T extends { id: string }>(item: T, input: {
  ranks: Map<string, { selectCount: number; lastSelectedAt: string }>
  search: string
  codeOf: (item: T) => string
  nameOf: (item: T) => string
}) {
  const rank = input.ranks.get(item.id)
  const code = normalizeSearchText(input.codeOf(item))
  const name = normalizeSearchText(input.nameOf(item))
  return {
    selectCount: rank?.selectCount ?? 0,
    lastSelectedAt: rank ? Date.parse(rank.lastSelectedAt) || 0 : 0,
    exactCode: input.search && code === input.search ? 1 : 0,
    codePrefix: input.search && code.startsWith(input.search) ? 1 : 0,
    exactName: input.search && name === input.search ? 1 : 0,
    namePrefix: input.search && name.startsWith(input.search) ? 1 : 0,
  }
}

async function ensureFinanceAccountsTable(pool: pg.Pool) {
  return ensureSchemaOnce(financeAccountsEnsureCache, pool, async () => {
  await pool.query(`
    create table if not exists finance_accounts (
      id text not null,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      account_type text not null check (account_type in ('cash', 'bank')),
      is_default_cash boolean not null default false,
      is_active boolean not null default true,
      account_number text,
      account_holder text,
      opening_balance numeric(14,2) not null default 0,
      note text,
      notify_on_transaction boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (organization_id, id)
    )
  `)
  await pool.query('create index if not exists finance_accounts_org_type_idx on finance_accounts (organization_id, account_type, is_active, name)')
  })
}

function mapFinanceAccountRow(row: {
  id: string
  code: string
  name: string
  account_type: FinanceAccountData['account_type']
  is_default_cash: boolean
  is_active: boolean
  account_number: string | null
  account_holder: string | null
  opening_balance: string | number | null
  note: string | null
  notify_on_transaction: boolean | null
}): FinanceAccountData {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    account_type: row.account_type,
    is_default_cash: Boolean(row.is_default_cash),
    is_active: Boolean(row.is_active),
    account_number: row.account_number,
    account_holder: row.account_holder,
    opening_balance: row.opening_balance === null ? 0 : Number(row.opening_balance),
    note: row.note,
    notify_on_transaction: Boolean(row.notify_on_transaction),
  }
}

async function listFinanceAccountsForExclusion(pool: pg.Pool, organizationId: string) {
  return getCachedOrgPromise(financeAccountsListCache, pool, organizationId, async () => {
    await ensureFinanceAccountsTable(pool)
    const result = await pool.query(
      `
        select id, code, name, account_type, is_default_cash, is_active,
               account_number, account_holder, opening_balance, note, notify_on_transaction
        from finance_accounts
        where organization_id = $1
      `,
      [organizationId],
    )
    return result.rows.map(mapFinanceAccountRow)
  })
}

function getCachedOrgPromise<T>(
  cache: WeakMap<pg.Pool, Map<string, Promise<T>>>,
  pool: pg.Pool,
  organizationId: string,
  run: () => Promise<T>,
) {
  let byOrg = cache.get(pool)
  if (!byOrg) {
    byOrg = new Map<string, Promise<T>>()
    cache.set(pool, byOrg)
  }
  const existing = byOrg.get(organizationId)
  if (existing) return existing
  const pending = run().catch((error) => {
    byOrg?.delete(organizationId)
    throw error
  })
  byOrg.set(organizationId, pending)
  return pending
}

function invalidateOrgCache<T>(
  cache: WeakMap<pg.Pool, Map<string, Promise<T>>>,
  pool: pg.Pool,
  organizationId: string,
) {
  cache.get(pool)?.delete(organizationId)
}

function normalizeFinanceAccountIdentity(value: string | null | undefined) {
  return normalizeSearchText(value ?? '').replace(/\{del\}/g, '').replace(/\s+/g, '')
}

function financeAccountComparableKeys(account: Pick<FinanceAccountData, 'id' | 'code' | 'name'> & { account_number?: string | null }) {
  return [
    account.account_number,
    account.code,
    account.name,
    account.id,
  ].map(normalizeFinanceAccountIdentity).filter(Boolean)
}

function isDeletedFinanceAccount(account: Pick<FinanceAccountData, 'id' | 'code' | 'name'> & { account_number?: string | null }) {
  return [account.id, account.code, account.name, account.account_number].some((value) => normalizeSearchText(value ?? '').includes('{del}'))
}

function isReplacedDeletedFinanceAccount(
  account: Pick<FinanceAccountData, 'id' | 'code' | 'name' | 'account_type'> & { account_number?: string | null },
  accounts: FinanceAccountData[],
) {
  if (account.account_type !== 'bank' || !isDeletedFinanceAccount(account)) return false
  const keys = new Set(financeAccountComparableKeys(account))
  if (keys.size === 0) return false
  return accounts.some((candidate) => (
    candidate.account_type === 'bank'
    && candidate.is_active
    && !isDeletedFinanceAccount(candidate)
    && financeAccountComparableKeys(candidate).some((key) => keys.has(key))
  ))
}

async function ensureSalesFinanceTables(pool: pg.Pool) {
  return ensureSchemaOnce(salesFinanceEnsureCache, pool, async () => {
  await pool.query(`
    create table if not exists orders (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      order_type text not null check (order_type in ('invoice', 'quote')),
      status text not null,
      customer_id text,
      customer_snapshot jsonb not null,
      seller_snapshot jsonb not null,
      subtotal_amount numeric(14,2) not null default 0,
      discount_amount numeric(14,2) not null default 0,
      total_amount numeric(14,2) not null default 0,
      paid_amount numeric(14,2) not null default 0,
      debt_amount numeric(14,2) not null default 0,
      payment_status text not null,
      note text not null default '',
      source_quote_id text references orders(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query(`alter table orders add column if not exists base_code text`)
  await pool.query(`alter table orders add column if not exists revision_no integer not null default 0`)
  await pool.query(`alter table orders add column if not exists revised_from_order_id text references orders(id) on delete set null`)
  await pool.query(`alter table orders add column if not exists replaced_by_order_id text references orders(id) on delete set null`)
  await pool.query(`alter table orders add column if not exists cancel_reason_type text`)
  await pool.query(`alter table orders add column if not exists revision_reason_code text`)
  await pool.query(`alter table orders add column if not exists revision_reason_note text`)
  await pool.query(`update orders set base_code = regexp_replace(code, '\\.\\d+$', '') where base_code is null or btrim(base_code) = ''`)
  await pool.query('create index if not exists orders_org_type_created_idx on orders (organization_id, order_type, created_at desc)')
  await pool.query('create index if not exists orders_org_updated_created_idx on orders (organization_id, updated_at desc, created_at desc)')
  await pool.query('create index if not exists orders_org_customer_idx on orders (organization_id, customer_id)')
  await pool.query(`
    create table if not exists order_items (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      order_id text not null references orders(id) on delete cascade,
      product_id text not null,
      product_snapshot jsonb not null default '{}'::jsonb,
      quantity numeric(14,3) not null default 0,
      unit_price numeric(14,2) not null default 0,
      discount_amount numeric(14,2) not null default 0,
      line_total numeric(14,2) not null default 0,
      sort_order integer not null default 0
    )
  `)
  await pool.query('alter table order_items add column if not exists width_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists height_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists linear_m numeric(12,3)')
  await pool.query('alter table order_items add column if not exists note text')
  await pool.query('create index if not exists order_items_order_idx on order_items (order_id, sort_order)')
  await pool.query(`
    create table if not exists payment_receipts (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      customer_id text,
      order_id text references orders(id) on delete set null,
      total_received_amount numeric(14,2) not null default 0,
      note text not null default '',
      created_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table payment_receipts add column if not exists created_at timestamptz not null default now()')
  await pool.query(`
    create table if not exists payment_receipt_methods (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      payment_receipt_id text not null references payment_receipts(id) on delete cascade,
      order_id text references orders(id) on delete set null,
      method text not null check (method in ('cash', 'bank_transfer')),
      finance_account_id text not null,
      amount numeric(14,2) not null,
      bank_transaction_ref text,
      allocations jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `)
  await pool.query('alter table payment_receipt_methods add column if not exists payment_receipt_id text')
  await pool.query('alter table payment_receipt_methods add column if not exists order_id text')
  await pool.query('alter table payment_receipt_methods add column if not exists created_at timestamptz not null default now()')
  await pool.query(`
    create table if not exists customer_debt_entries (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      customer_id text not null,
      order_id text not null references orders(id) on delete cascade,
      original_amount numeric(14,2) not null,
      paid_amount numeric(14,2) not null default 0,
      remaining_debt numeric(14,2) not null,
      status text not null check (status in ('open', 'closed')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, order_id)
    )
  `)
  await pool.query('create index if not exists customer_debt_entries_customer_idx on customer_debt_entries (organization_id, customer_id, status, created_at desc)')
  await pool.query('create index if not exists customer_debt_entries_customer_updated_idx on customer_debt_entries (organization_id, customer_id, status, updated_at desc, created_at desc)')
  await pool.query(`
    create table if not exists customer_debt_adjustments (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      customer_id text not null,
      customer_snapshot jsonb not null default '{}'::jsonb,
      source_code text not null,
      source_system text not null default 'kiotviet',
      source_file text,
      source_row integer,
      transaction_type text not null default 'adjustment',
      amount_delta numeric(14,2) not null,
      paid_amount numeric(14,2) not null default 0,
      remaining_amount numeric(14,2) not null,
      balance_after numeric(14,2) not null default 0,
      status text not null check (status in ('open', 'closed')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, source_system, source_code)
    )
  `)
  await pool.query('create index if not exists customer_debt_adjustments_customer_idx on customer_debt_adjustments (organization_id, customer_id, status, created_at desc)')
  await pool.query(`
    create table if not exists cashbook_entries (
      id text primary key default gen_random_uuid()::text,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      status text not null default 'posted',
      direction text not null check (direction in ('in', 'out')),
      amount_delta numeric(14,2) not null,
      finance_account jsonb not null,
      counterparty jsonb not null,
      note text not null default '',
      source_type text not null,
      source jsonb not null default '{}'::jsonb,
      allocations jsonb not null default '[]'::jsonb,
      is_business_accounted boolean not null default true,
      created_by jsonb null,
      created_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('alter table cashbook_entries add column if not exists created_by jsonb null')
  await pool.query('alter table cashbook_entries add column if not exists source jsonb not null default \'{}\'::jsonb')
  await pool.query('alter table cashbook_entries add column if not exists allocations jsonb not null default \'[]\'::jsonb')
  await pool.query('alter table cashbook_entries add column if not exists created_at timestamptz not null default now()')
  await pool.query('create index if not exists cashbook_entries_org_created_idx on cashbook_entries (organization_id, created_at desc)')
  await migrateLegacyPosFinanceCodes(pool)
  })
}

function ensureSchemaOnce(cache: WeakMap<pg.Pool, Promise<void>>, pool: pg.Pool, run: () => Promise<void>) {
  const existing = cache.get(pool)
  if (existing) return existing
  const pending = run().catch((error) => {
    cache.delete(pool)
    throw error
  })
  cache.set(pool, pending)
  return pending
}

async function migrateLegacyPosFinanceCodes(pool: pg.Pool) {
  const legacyOrders = await pool.query<{
    organization_id: string
    id: string
    old_code: string
    order_type: 'invoice' | 'quote'
    created_at: Date
    rn: number
    max_seq: number
  }>(`
    select
      o.organization_id::text as organization_id,
      o.id,
      o.code as old_code,
      o.order_type,
      o.created_at,
      row_number() over (partition by o.organization_id, o.order_type order by o.created_at, o.id) as rn,
      coalesce((
        select max((regexp_match(o2.code, '^(?:HD|BG)(\\d{6})(?:\\.\\d+)?$'))[1]::int)
        from orders o2
        where o2.organization_id = o.organization_id
          and o2.order_type = o.order_type
          and o2.code ~ '^(?:HD|BG)\\d{6}(?:\\.\\d+)?$'
      ), 0) as max_seq
    from orders o
    where o.code ~ '^(HD|BG)-POS-'
    order by o.organization_id, o.order_type, o.created_at, o.id
  `)

  if (legacyOrders.rowCount === 0) return
  const stockMovementsTable = await pool.query<{ exists: boolean }>("select to_regclass('public.stock_movements') is not null as exists")
  const hasStockMovementsTable = stockMovementsTable.rows[0]?.exists === true

  for (const order of legacyOrders.rows) {
    const prefix = order.order_type === 'invoice' ? 'HD' : 'BG'
    const sequence = Number(order.max_seq) + Number(order.rn)
    const newOrderCode = `${prefix}${String(sequence).padStart(6, '0')}`
    await pool.query(
      `
        update orders
        set code = $1
        where organization_id = $2
          and id = $3
      `,
      [newOrderCode, order.organization_id, order.id],
    )

    const paymentReceiptCode = `TTHD${String(sequence).padStart(6, '0')}`
    await pool.query(
      `
        update payment_receipts
        set code = $1
        where organization_id = $2
          and order_id = $3
      `,
      [paymentReceiptCode, order.organization_id, order.id],
    )

    const cashbookRows = await pool.query<{
      id: string
      code: string
      finance_account: { account_type?: string }
      note: string
      source: Record<string, unknown> | null
      allocations: Array<Record<string, unknown>> | null
    }>(
      `
        select id, code, finance_account, note, source, allocations
        from cashbook_entries
        where organization_id = $1
          and (
            source->>'order_code' = $2
            or note like '%' || $2 || '%'
          )
        order by created_at, id
      `,
      [order.organization_id, order.old_code],
    )

    for (const [index, cashbookRow] of cashbookRows.rows.entries()) {
      const suffix = index === 0 ? '' : `-${cashbookRow.finance_account?.account_type === 'bank' ? 'NH' : 'TM'}`
      const newCashbookCode = `${paymentReceiptCode}${suffix}`
      const source = cashbookRow.source && typeof cashbookRow.source === 'object' ? cashbookRow.source : {}
      const allocations = Array.isArray(cashbookRow.allocations)
        ? cashbookRow.allocations.map((allocation) => (
            allocation && typeof allocation === 'object' && allocation.order_code === order.old_code
              ? { ...allocation, order_code: newOrderCode }
              : allocation
          ))
        : []
      const updatedNote = cashbookRow.note.includes(order.old_code) ? cashbookRow.note.replaceAll(order.old_code, newOrderCode) : cashbookRow.note
      await pool.query(
        `
          update cashbook_entries
          set code = $1,
              source = $2::jsonb,
              allocations = $3::jsonb,
              note = $4
          where organization_id = $5
            and id = $6
        `,
        [
          newCashbookCode,
          JSON.stringify({
            ...source,
            code: newCashbookCode,
            order_code: newOrderCode,
          }),
          JSON.stringify(allocations),
          updatedNote,
          order.organization_id,
          cashbookRow.id,
        ],
      )
    }

    if (hasStockMovementsTable) {
      await pool.query(
        `
          update stock_movements
          set document_code = $1
          where organization_id = $2
            and document_code = $3
        `,
        [newOrderCode, order.organization_id, order.old_code],
      )
    }
  }
}

type PgOrderRow = {
  id: string
  code: string
  order_type: 'invoice' | 'quote'
  status: string
  created_at: Date
  customer_snapshot: SalesDocumentData['customer']
  seller_snapshot: SalesDocumentData['seller']
  subtotal_amount: string | number
  discount_amount: string | number
  total_amount: string | number
  paid_amount: string | number
  debt_amount: string | number
  payment_status: string
  note: string
  items: SalesDocumentData['items']
  base_code?: string | null
  revision_no?: string | number | null
  revised_from_order_id?: string | null
  replaced_by_order_id?: string | null
  cancel_reason_type?: string | null
  revision_reason_code?: string | null
  revision_reason_note?: string | null
}

type PgCashbookRow = {
  id: string
  code: string
  status: CashbookEntryData['status']
  direction: CashbookEntryData['direction']
  amount_delta: string | number
  finance_account: CashbookEntryData['finance_account']
  is_business_accounted: boolean
  source_type: CashbookEntryData['source_type']
  created_at: Date
  note: string
  counterparty: CashbookEntryData['counterparty']
  created_by?: CashbookEntryData['created_by']
  source?: CashbookEntryData['source']
  allocations?: CashbookEntryData['allocations']
}

async function insertSalesDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData) {
  const orderResult = await pool.query(
    `
      insert into orders (
        id, organization_id, code, order_type, status, customer_id,
        customer_snapshot, seller_snapshot, subtotal_amount, discount_amount,
        total_amount, paid_amount, debt_amount, payment_status, note, base_code, revision_no,
        revised_from_order_id, replaced_by_order_id, cancel_reason_type, revision_reason_code, revision_reason_note, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now())
      on conflict (organization_id, code)
      do update set
        order_type = excluded.order_type,
        status = excluded.status,
        customer_id = excluded.customer_id,
        customer_snapshot = excluded.customer_snapshot,
        seller_snapshot = excluded.seller_snapshot,
        subtotal_amount = excluded.subtotal_amount,
        discount_amount = excluded.discount_amount,
        total_amount = excluded.total_amount,
        paid_amount = excluded.paid_amount,
        debt_amount = excluded.debt_amount,
        payment_status = excluded.payment_status,
        note = excluded.note,
        base_code = excluded.base_code,
        revision_no = excluded.revision_no,
        revised_from_order_id = excluded.revised_from_order_id,
        replaced_by_order_id = excluded.replaced_by_order_id,
        cancel_reason_type = excluded.cancel_reason_type,
        revision_reason_code = excluded.revision_reason_code,
        revision_reason_note = excluded.revision_reason_note,
        created_at = excluded.created_at,
        updated_at = now()
      returning id::text
    `,
    [
      document.id,
      organizationId,
      document.code,
      document.order_type,
      document.status,
      document.customer.id,
      JSON.stringify(document.customer),
      JSON.stringify(document.seller),
      document.subtotal_amount,
      document.discount_amount,
      document.total_amount,
      document.paid_amount,
      document.debt_amount,
      document.payment_status,
      document.note,
      document.base_code ?? null,
      document.revision_no ?? 0,
      document.revised_from_order_id ?? null,
      document.replaced_by_order_id ?? null,
      document.cancel_reason_type ?? null,
      document.revision_reason_code ?? null,
      document.revision_reason_note ?? null,
      document.created_at,
    ],
  )
  const orderId = String(orderResult.rows[0]?.id ?? document.id)

  await pool.query(
    `
      delete from order_items
      where organization_id = $1
        and order_id = $2
    `,
    [organizationId, orderId],
  )

  for (const [index, item] of document.items.entries()) {
    const detailItem = item as {
      product_id: string
      quantity?: number
      unit_price?: number
      discount_amount?: number
      line_total?: number
      width_m?: number | null
      height_m?: number | null
      linear_m?: number | null
      note?: string | null
    }
    const quantity = Number(detailItem.quantity ?? 1)
    const unitPrice = Number(detailItem.unit_price ?? 0)
    const discountAmount = Number(detailItem.discount_amount ?? 0)
    const lineTotal = Number.isFinite(detailItem.line_total ?? Number.NaN)
      ? Number(detailItem.line_total)
      : Math.max(quantity * unitPrice - discountAmount, 0)
    const widthM = typeof detailItem.width_m === 'number' && Number.isFinite(detailItem.width_m) ? detailItem.width_m : null
    const heightM = typeof detailItem.height_m === 'number' && Number.isFinite(detailItem.height_m) ? detailItem.height_m : null
    const linearM = typeof detailItem.linear_m === 'number' && Number.isFinite(detailItem.linear_m) ? detailItem.linear_m : null
    const note = typeof detailItem.note === 'string' && detailItem.note.trim() !== '' ? detailItem.note : null
    await pool.query(
      `
        insert into order_items (
          organization_id, order_id, product_id, product_snapshot, quantity, unit_price, discount_amount, line_total, sort_order,
          width_m, height_m, linear_m, note
        )
        values ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [organizationId, orderId, detailItem.product_id, quantity, unitPrice, discountAmount, lineTotal, index + 1, widthM, heightM, linearM, note],
    )
  }

  if (document.order_type === 'invoice' && document.status !== 'cancelled' && document.debt_amount > 0) {
    await pool.query(
      `
        insert into customer_debt_entries (
          organization_id, customer_id, order_id, original_amount, paid_amount,
          remaining_debt, status, created_at, updated_at
        )
        values ($1, $2, $3, $4, 0, $4, 'open', $5, now())
        on conflict (organization_id, order_id) do update set
          customer_id = excluded.customer_id,
          original_amount = excluded.original_amount,
          paid_amount = excluded.paid_amount,
          remaining_debt = excluded.remaining_debt,
          status = excluded.status,
          updated_at = now()
      `,
      [organizationId, document.customer.id, orderId, document.debt_amount, document.created_at],
    )
  } else if (document.order_type === 'invoice') {
    await pool.query(
      `
        update customer_debt_entries
        set remaining_debt = 0,
            status = 'closed',
            updated_at = now()
        where organization_id = $1
          and order_id = $2
          and status = 'open'
      `,
      [organizationId, orderId],
    )
  }
}

function mapOrderRow(row: PgOrderRow): SalesDocumentData {
  return {
    id: row.id,
    code: row.code,
    order_type: row.order_type,
    status: row.status,
    created_at: row.created_at.toISOString(),
    customer: row.customer_snapshot,
    seller: row.seller_snapshot,
    subtotal_amount: Number(row.subtotal_amount),
    discount_amount: Number(row.discount_amount),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    debt_amount: Number(row.debt_amount),
    payment_status: row.payment_status,
    note: row.note,
    items: row.items,
    base_code: row.base_code ?? undefined,
    revision_no: row.revision_no !== null && row.revision_no !== undefined ? Number(row.revision_no) : undefined,
    revised_from_order_id: row.revised_from_order_id ?? null,
    replaced_by_order_id: row.replaced_by_order_id ?? null,
    cancel_reason_type: row.cancel_reason_type ?? null,
    revision_reason_code: row.revision_reason_code ?? null,
    revision_reason_note: row.revision_reason_note ?? null,
  }
}

async function userDisplayNameMap(pool: pg.Pool, organizationId: string) {
  return getCachedOrgPromise(userDisplayNameEnsureCache, pool, organizationId, async () => {
    await ensureUserManagementColumns(pool)
    const result = await pool.query(
      `
        select id::text, display_name
        from users
        where organization_id = $1
      `,
      [organizationId],
    )
    return new Map(result.rows.map((row) => [String(row.id), String(row.display_name)]))
  })
}

function hydrateUserReference<T extends { id: string; name: string }>(reference: T, userDisplayNames: ReadonlyMap<string, string>): T {
  const displayName = userDisplayNames.get(reference.id)
  return displayName ? { ...reference, name: displayName } : reference
}

function hydrateSalesDocumentUserSnapshot(document: SalesDocumentData, userDisplayNames: ReadonlyMap<string, string>): SalesDocumentData {
  return {
    ...document,
    seller: hydrateUserReference(document.seller, userDisplayNames),
  }
}

function hydrateCashbookEntryUserSnapshot(entry: CashbookEntryData, userDisplayNames: ReadonlyMap<string, string>): CashbookEntryData {
  return {
    ...entry,
    created_by: entry.created_by ? hydrateUserReference(entry.created_by, userDisplayNames) : entry.created_by,
  }
}

async function listSalesDocumentPaymentReceipts(
  pool: pg.Pool,
  organizationId: string,
  document: SalesDocumentData,
  userDisplayNames: ReadonlyMap<string, string>,
): Promise<SalesDocumentPaymentReceiptData[]> {
  const result = await pool.query(
    `
      select
        id,
        code,
        status,
        direction,
        amount_delta,
        finance_account,
        is_business_accounted,
        source_type,
        created_at,
        note,
        counterparty,
        created_by,
        source,
        allocations
      from cashbook_entries
      where organization_id = $1
        and direction = 'in'
        and (
          source->>'order_code' = $2
          or allocations @> $3::jsonb
          or allocations @> $4::jsonb
        )
      order by created_at desc
    `,
    [
      organizationId,
      document.code,
      JSON.stringify([{ order_code: document.code }]),
      JSON.stringify([{ order_id: document.id }]),
    ],
  )

  return result.rows
    .map(mapCashbookRow)
    .map((entry) => hydrateCashbookEntryUserSnapshot(entry, userDisplayNames))
    .filter((entry) => cashbookEntryMatchesSalesDocument(entry, document))
    .map((entry) => cashbookEntrySalesDocumentPaymentReceipt(entry, document))
}

function mapCashbookRow(row: PgCashbookRow): CashbookEntryData {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    direction: row.direction,
    amount_delta: Number(row.amount_delta),
    finance_account: row.finance_account,
    is_business_accounted: row.is_business_accounted,
    source_type: row.source_type,
    created_at: row.created_at.toISOString(),
    note: row.note,
    counterparty: row.counterparty,
    created_by: row.created_by ?? null,
    source: row.source,
    allocations: row.allocations,
  }
}

function hydrateCashbookEntryFinanceAccount(
  entry: CashbookEntryData,
  accounts: readonly FinanceAccountData[],
): CashbookEntryData {
  const account = accounts.find((item) => item.id === entry.finance_account.id)
  if (!account) return entry
  return {
    ...entry,
    finance_account: cashbookFinanceAccountSnapshot(account),
  }
}

function cashbookFinanceAccountSnapshot(account: FinanceAccountData): CashbookEntryData['finance_account'] {
  return {
    id: account.id,
    code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
    name: account.name,
    account_type: account.account_type,
    account_number: account.account_number,
    account_holder: account.account_holder,
  }
}

function cashbookNoteOrderCode(note: string | null | undefined) {
  return note?.match(/\bHD(?:-[A-Z0-9]+)+\b|\bHD\d+(?:\.\d+)?\b/i)?.[0].toUpperCase() ?? null
}

function salesDocumentSameSaleReceiptBaseCode(orderCode: string | null | undefined) {
  const match = orderCode?.match(/^HD(\d{6}(?:\.\d+)?)$/i)
  return match ? `TTHD${match[1]}` : null
}

function cashbookEntryHasLinkedOrder(entry: CashbookEntryData) {
  return entry.source?.order_code || (entry.allocations?.length ?? 0) > 0
}

function cashbookEntryMatchesSalesDocument(entry: CashbookEntryData, document: SalesDocumentData) {
  if (entry.direction !== 'in') return false
  if (entry.source?.order_code === document.code) return true
  return (entry.allocations ?? []).some((allocation) => allocation.order_id === document.id || allocation.order_code === document.code)
}

function cashbookEntrySalesDocumentPaymentReceipt(
  entry: CashbookEntryData,
  document: SalesDocumentData,
): SalesDocumentPaymentReceiptData {
  const amount = Math.abs(Number(entry.amount_delta))
  const linkedAllocations = (entry.allocations ?? []).filter((allocation) => allocation.order_id === document.id || allocation.order_code === document.code)
  const allocations = linkedAllocations.length > 0
    ? linkedAllocations.map((allocation) => ({
        order_id: allocation.order_id,
        order_code: allocation.order_code,
        allocated_amount: Number(allocation.allocated_amount),
        remaining_after: Number(allocation.remaining_after),
      }))
    : [{
        order_id: document.id,
        order_code: document.code,
        allocated_amount: amount,
        remaining_after: Math.max(Number(document.debt_amount), 0),
      }]
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0)
  const sourceCreatorName = entry.source?.source_creator_name?.trim()

  return {
    id: entry.id,
    code: entry.code,
    status: entry.status === 'cancelled' ? 'cancelled' : 'posted',
    receipt_type: (entry.allocations?.length ?? 0) > 1 ? 'mixed_sale_and_debt' : 'sale_payment',
    total_received_amount: allocatedTotal > 0 ? allocatedTotal : amount,
    created_at: entry.created_at,
    created_by: entry.created_by ?? { id: sourceCreatorName ? `kiotviet-${entry.id}` : document.seller.id, name: sourceCreatorName || document.seller.name },
    methods: [{
      method_type: entry.finance_account.account_type === 'bank' || entry.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cash',
      amount,
      finance_account: {
        id: entry.finance_account.id,
        code: entry.finance_account.account_number ?? entry.finance_account.code,
        name: entry.finance_account.name,
      },
    }],
    allocations,
  }
}

async function hydrateCashbookEntryLink(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  if (entry.direction !== 'in' || cashbookEntryHasLinkedOrder(entry)) return entry
  const orderCode = cashbookNoteOrderCode(entry.note)
  if (orderCode === null) return entry

  const order = await pool.query(
    `
      select id, code, total_amount, paid_amount, debt_amount
      from orders
      where organization_id = $1
        and code = $2
      limit 1
    `,
    [organizationId, orderCode],
  )
  const row = order.rows[0]
  if (!row) return entry

  const allocatedAmount = Math.abs(Number(entry.amount_delta))
  const paidAmount = Number(row.paid_amount)
  return {
    ...entry,
    source: { type: 'payment_receipt', id: entry.id, code: entry.code, order_code: row.code },
    allocations: [{
      order_id: row.id,
      order_code: row.code,
      order_total_amount: Number(row.total_amount),
      collected_before: Math.max(paidAmount - allocatedAmount, 0),
      allocated_amount: allocatedAmount,
      remaining_after: Number(row.debt_amount),
    }],
  }
}

async function insertCashbookEntry(pool: pg.Pool, organizationId: string, entry: CashbookEntryData) {
  await pool.query(
    `
      insert into cashbook_entries (
        id, organization_id, code, status, direction, amount_delta, finance_account,
        counterparty, note, source_type, source, allocations, is_business_accounted, created_by, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15)
      on conflict (organization_id, code) do nothing
    `,
    [
      entry.id,
      organizationId,
      entry.code,
      entry.status,
      entry.direction,
      entry.amount_delta,
      JSON.stringify(entry.finance_account),
      JSON.stringify(entry.counterparty),
      entry.note,
      entry.source_type,
      JSON.stringify('source' in entry ? entry.source : {}),
      JSON.stringify('allocations' in entry ? entry.allocations : []),
      entry.is_business_accounted,
      JSON.stringify(entry.created_by ?? null),
      entry.created_at,
    ],
  )
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

const vietnameseSearchFrom = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const vietnameseSearchTo = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'

function priceListPriceMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([priceListId, unitPrice]) => [priceListId, Number(unitPrice)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  )
}

function accentInsensitiveSearchSql(expression: string) {
  return `translate(lower(${expression}), '${vietnameseSearchFrom}', '${vietnameseSearchTo}')`
}

async function ensureUserManagementColumns(pool: pg.Pool) {
  await pool.query('alter table users add column if not exists username text')
  await pool.query('alter table users add column if not exists phone text')
  await pool.query('alter table users add column if not exists birthday date')
  await pool.query('alter table users add column if not exists region text')
  await pool.query('alter table users add column if not exists ward text')
  await pool.query('alter table users add column if not exists address text')
  await pool.query('alter table users add column if not exists note text')
  await pool.query(`
    create unique index if not exists users_org_username_uidx
    on users (organization_id, lower(username))
    where username is not null and btrim(username) <> ''
  `)
  await pool.query('create index if not exists users_org_created_idx on users (organization_id, created_at desc)')
}

async function ensureEmployeeTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists employees (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      phone text,
      note text,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await pool.query(`
    create unique index if not exists employees_org_code_uidx
    on employees (organization_id, lower(code))
  `)
  await pool.query('create index if not exists employees_org_status_name_idx on employees (organization_id, status, name)')
}

async function ensureDeliveryPartnerTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists delivery_partners (
      id uuid primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      name text not null,
      phone text,
      note text,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await pool.query(`
    create unique index if not exists delivery_partners_org_code_uidx
    on delivery_partners (organization_id, lower(code))
  `)
  await pool.query('create index if not exists delivery_partners_org_status_name_idx on delivery_partners (organization_id, status, name)')
}

async function ensureOrganizationBillSettingsColumns(pool: pg.Pool) {
  await pool.query('alter table organizations add column if not exists shop_name text')
  await pool.query('alter table organizations add column if not exists shop_address text')
  await pool.query('alter table organizations add column if not exists shop_phone text')
  await pool.query('alter table organizations add column if not exists print_place text')
  await pool.query('alter table organizations add column if not exists default_bill_template text')
  await pool.query('alter table organizations add column if not exists invoice_title text')
  await pool.query('alter table organizations add column if not exists quote_title text')
  await pool.query('alter table organizations add column if not exists footer_note text')
  await pool.query('alter table organizations add column if not exists show_product_code boolean')
  await pool.query('alter table organizations add column if not exists show_unit boolean')
  await pool.query('alter table organizations add column if not exists show_discount boolean')
  await pool.query('alter table organizations add column if not exists logo_data_url text')
  await pool.query('alter table organizations add column if not exists bill_templates jsonb')
  await pool.query(`
    update organizations
    set bill_templates = coalesce(bill_templates, '[]'::jsonb)
    where bill_templates is null
  `)
  await pool.query(`
    update organizations
    set shop_name = coalesce(nullif(btrim(shop_name), ''), name)
    where shop_name is null or btrim(shop_name) = ''
  `)
  await pool.query(`
    update organizations
    set shop_address = coalesce(shop_address, '')
    where shop_address is null
  `)
  await pool.query(`
    update organizations
    set shop_phone = coalesce(shop_phone, '')
    where shop_phone is null
  `)
  await pool.query(`
    update organizations
    set print_place = coalesce(print_place, '')
    where print_place is null
  `)
  await pool.query(`
    update organizations
    set default_bill_template = 'a4'
    where default_bill_template is null
       or btrim(default_bill_template) = ''
       or default_bill_template not in ('a4', 'k80')
  `)
  await pool.query(`
    update organizations
    set invoice_title = coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG')
    where invoice_title is null or btrim(invoice_title) = ''
  `)
  await pool.query(`
    update organizations
    set quote_title = coalesce(nullif(btrim(quote_title), ''), 'BẢNG BÁO GIÁ')
    where quote_title is null or btrim(quote_title) = ''
  `)
  await pool.query(`
    update organizations
    set footer_note = coalesce(footer_note, '')
    where footer_note is null
  `)
  await pool.query(`
    update organizations
    set show_product_code = coalesce(show_product_code, false),
        show_unit = coalesce(show_unit, true),
        show_discount = coalesce(show_discount, false)
    where show_product_code is null
       or show_unit is null
       or show_discount is null
  `)
}

function mapOrganizationBillSettingsRow(row: Record<string, unknown>) {
  return normalizeOrganizationBillSettingsData({
    shop_name: String(row.shop_name ?? 'QCVL'),
    shop_address: String(row.shop_address ?? ''),
    shop_phone: String(row.shop_phone ?? ''),
    print_place: String(row.print_place ?? ''),
    default_bill_template: (row.default_bill_template === 'k80' ? 'k80' : 'a4') as 'a4' | 'k80',
    invoice_title: String(row.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG'),
    quote_title: String(row.quote_title ?? 'BẢNG BÁO GIÁ'),
    footer_note: String(row.footer_note ?? ''),
    show_product_code: row.show_product_code === true,
    show_unit: row.show_unit !== false,
    show_discount: row.show_discount === true,
    logo_data_url: typeof row.logo_data_url === 'string' && row.logo_data_url ? row.logo_data_url : null,
    templates: Array.isArray(row.bill_templates)
      ? row.bill_templates
      : typeof row.bill_templates === 'string'
        ? JSON.parse(row.bill_templates)
        : row.bill_templates && typeof row.bill_templates === 'object'
          ? (row.bill_templates as OrganizationBillSettingsData['templates'])
          : [],
  })
}

async function replacePermissionsForUser(pool: pg.Pool, userId: string, permissions: `perm.${string}`[]) {
  await pool.query('delete from user_permissions where user_id = $1', [userId])
  for (const permission of permissions) {
    await pool.query(
      `
        insert into user_permissions (user_id, permission_code)
        values ($1, $2)
        on conflict (user_id, permission_code) do nothing
      `,
      [userId, permission],
    )
  }
}

async function findUserListItem(pool: pg.Pool, organizationId: string, id: string) {
  await ensureUserManagementColumns(pool)
  const result = await pool.query(
    `
      select
        u.id::text,
        u.email,
        u.username,
        u.phone,
        u.birthday,
        u.region,
        u.ward,
        u.address,
        u.note,
        u.display_name,
        u.status,
        coalesce(
          jsonb_agg(up.permission_code order by up.permission_code)
            filter (where up.permission_code is not null),
          '[]'::jsonb
        ) as permissions
      from users u
      left join user_permissions up on up.user_id = u.id
      where u.organization_id = $1 and u.id = $2
      group by u.id
      limit 1
    `,
    [organizationId, id],
  )
  const row = result.rows[0]
  return row ? userListItemFromRow(row) : null
}

function userListItemFromRow(row: Record<string, unknown>): UserListItemData {
  return {
    id: String(row.id),
    email: String(row.email),
    username: nullableDbString(row.username),
    phone: nullableDbString(row.phone),
    birthday: row.birthday instanceof Date ? row.birthday.toISOString().slice(0, 10) : nullableDbString(row.birthday),
    region: nullableDbString(row.region),
    ward: nullableDbString(row.ward),
    address: nullableDbString(row.address),
    note: nullableDbString(row.note),
    display_name: String(row.display_name),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    permissions: Array.isArray(row.permissions)
      ? row.permissions.filter((permission): permission is `perm.${string}` => typeof permission === 'string' && permission.startsWith('perm.'))
      : [],
  }
}

function employeeListItemFromRow(row: Record<string, unknown>): EmployeeListItemData {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    phone: nullableDbString(row.phone),
    note: nullableDbString(row.note),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

function deliveryPartnerListItemFromRow(row: Record<string, unknown>): DeliveryPartnerListItemData {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    phone: nullableDbString(row.phone),
    note: nullableDbString(row.note),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

function nullableDbString(value: unknown) {
  if (value === null || value === undefined) return null
  const result = String(value)
  return result ? result : null
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

async function ensureDefaultProductGroup(pool: pg.Pool, organizationId: string): Promise<ProductGroupListData> {
  const existing = await pool.query<ProductGroupListData>(
    `
      select id::text, code, name, is_default, is_active
      from product_groups
      where organization_id = $1
        and is_active = true
      order by is_default desc, name asc
      limit 1
    `,
    [organizationId],
  )
  if (existing.rows[0]) return existing.rows[0]

  const id = randomUUID()
  const name = 'Giá chung'
  const code = 'GENERAL'
  await pool.query(
    `
      insert into product_groups (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, true, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        is_default = true,
        is_active = true,
        updated_at = now()
      returning id::text, code, name, is_default, is_active
    `,
    [id, organizationId, code, name],
  )
  const created = await pool.query<ProductGroupListData>(
    `
      select id::text, code, name, is_default, is_active
      from product_groups
      where organization_id = $1
        and code = $2
      limit 1
    `,
    [organizationId, code],
  )
  return created.rows[0] ?? {
    id,
    code,
    name,
    is_default: true,
    is_active: true,
  }
}

function filterValues(url: URL, key: string) {
  return (url.searchParams.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function filterValueMatches(values: string[], actual: string) {
  if (values.length === 0) return true
  return values.includes(actual)
}

function dateRangeMatches(value: string, from: string | null, to: string | null) {
  return displayDateRangeMatches(value, from, to)
}

function salesDocumentMatches(url: URL, document: SalesDocumentData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? '')
  const type = filterValues(url, 'type')
  const status = filterValues(url, 'status')
  const customerId = url.searchParams.get('customer_id')
  const paymentStatus = filterValues(url, 'payment_status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!filterValueMatches(type, document.order_type)) return false
  if (!filterValueMatches(status, document.status)) return false
  if (customerId && document.customer.id !== customerId) return false
  if (!filterValueMatches(paymentStatus, document.payment_status)) return false
  if (!dateRangeMatches(document.created_at, from, to)) return false
  if (search) {
    const haystack = normalizeSearchText(`${document.code} ${document.customer.code ?? ''} ${document.customer.name} ${document.note ?? ''}`)
    if (!haystack.includes(search)) return false
  }
  return true
}

function cashbookEntryMatches(url: URL, entry: CashbookEntryData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const searchScope = url.searchParams.get('search_scope') ?? 'all'
  const financeAccountId = url.searchParams.get('finance_account_id')
  const financeAccountType = url.searchParams.get('finance_account_type')
  const direction = url.searchParams.get('direction')
  const status = url.searchParams.get('status')
  const isBusinessAccounted = url.searchParams.get('is_business_accounted')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (financeAccountId && financeAccountId !== 'all' && entry.finance_account.id !== financeAccountId) return false
  if (financeAccountType && financeAccountType !== 'all' && entry.finance_account.account_type !== financeAccountType) return false
  if (direction && direction !== 'all' && entry.direction !== direction) return false
  if (status && status !== 'all' && entry.status !== status) return false
  if (isBusinessAccounted === 'true' && !entry.is_business_accounted) return false
  if (isBusinessAccounted === 'false' && entry.is_business_accounted) return false
  if (!dateRangeMatches(entry.created_at, from, to)) return false
  if (search) {
    const scopedHaystacks = {
      code: entry.code,
      note: entry.note ?? '',
      transfer_content: entry.source?.transfer_content ?? '',
      counterparty: `${entry.counterparty.name} ${entry.counterparty.phone ?? ''}`,
      all: `${entry.code} ${entry.note} ${entry.counterparty.name} ${entry.counterparty.phone ?? ''} ${entry.finance_account.code} ${entry.finance_account.name} ${entry.source?.transfer_content ?? ''}`,
    }
    const haystack = normalizeSearchText(scopedHaystacks[searchScope as keyof typeof scopedHaystacks] ?? scopedHaystacks.all)
    if (!haystack.includes(search)) return false
  }
  return true
}

function customerDebtMatches(url: URL, debt: CustomerDebtSummaryData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  if (!search) return true
  const haystack = normalizeSearchText(`${debt.customer_code} ${debt.customer_name} ${debt.oldest_order_code}`)
  return haystack.includes(search)
}

type KiotVietCashbookImportRow = NonNullable<Parameters<NonNullable<ServerRepository['upsertImportedKiotVietCashbook']>>[0]>['rows'][number]

function preferPostedKiotVietCashbookRows(rows: KiotVietCashbookImportRow[]) {
  const byCode = new Map<string, KiotVietCashbookImportRow>()
  for (const row of rows) {
    const previous = byCode.get(row.source_code)
    if (!previous || (previous.status === 'cancelled' && row.status === 'posted')) {
      byCode.set(row.source_code, row)
    }
  }
  return [...byCode.values()]
}

function financeAccountFromKiotVietCashbookRow(row: KiotVietCashbookImportRow): FinanceAccountData {
  if (row.account_type === 'cash') {
    return {
      id: 'cash-main',
      code: 'TM',
      name: 'Tien mat',
      account_type: 'cash',
      is_default_cash: true,
      is_active: true,
      opening_balance: 0,
      note: null,
      notify_on_transaction: false,
    }
  }
  const accountNumber = row.account_number ?? `BANK-${hashText(row.account_name).slice(0, 12)}`
  const isDeletedAccount = accountNumber.includes('{DEL}') || row.account_name.includes('{DEL}')
  return {
    id: `bank-kv-${hashText(accountNumber)}`,
    code: accountNumber,
    name: row.account_name,
    account_type: 'bank',
    is_default_cash: false,
    is_active: !isDeletedAccount,
    account_number: accountNumber,
    account_holder: row.account_name,
    opening_balance: 0,
    note: 'Imported from KiotViet So Quy.',
    notify_on_transaction: true,
  }
}

function linkedInvoiceCodeFromKiotVietCashbookCode(code: string) {
  const match = code.trim().toUpperCase().match(/^TTHDO?(\d+(?:\.\d+)?)$/)
  return match ? `HD${match[1]}` : null
}

async function rebuildImportedKiotVietCashbookAllocations(pool: pg.Pool, organizationId: string) {
  const [invoiceResult, receiptResult, cashbookResult] = await Promise.all([
    pool.query<{
      id: string
      code: string
      created_at: Date
      status: string
      order_type: string
      total_amount: string | number
      paid_amount: string | number
      debt_amount: string | number
      customer_id: string | null
      customer_snapshot: { id?: string; code?: string; name?: string } | null
    }>(
      `
        select id, code, created_at, status, order_type, total_amount, paid_amount, debt_amount,
               customer_id, customer_snapshot
        from orders
        where organization_id = $1
          and id like 'sales-document-kv-%'
          and order_type = 'invoice'
      `,
      [organizationId],
    ),
    pool.query<{
      id: string
      code: string
      data: {
        status?: string
        received_at?: string
        payable_amount?: number
        paid_amount?: number
        remaining_amount?: number
        supplier?: { id?: string; code?: string; name?: string }
        supplier_id?: string
      }
    }>(
      `
        select id, code, data
        from purchase_receipt_snapshots
        where organization_id = $1
          and id like 'purchase-receipt-kv-%'
      `,
      [organizationId],
    ),
    pool.query<{
      id: string
      code: string
      created_at: Date
      direction: 'in' | 'out'
      amount_delta: string | number
      status: string
      source: Record<string, unknown> | null
      counterparty: { name?: string; phone?: string | null } | null
    }>(
      `
        select id, code, created_at, direction, amount_delta, status, source, counterparty
        from cashbook_entries
        where organization_id = $1
          and source_type = 'kiotviet_cashbook'
      `,
      [organizationId],
    ),
  ])

  const invoices: AllocatableInvoice[] = invoiceResult.rows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    created_at: row.created_at.toISOString(),
    status: String(row.status),
    order_type: String(row.order_type),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    debt_amount: Number(row.debt_amount),
    customer: {
      id: String(row.customer_id ?? row.customer_snapshot?.id ?? ''),
      code: String(row.customer_snapshot?.code ?? ''),
      name: row.customer_snapshot?.name,
    },
  }))

  const receipts: AllocatablePurchaseReceipt[] = receiptResult.rows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    received_at: String(row.data?.received_at ?? new Date().toISOString()),
    status: String(row.data?.status ?? 'posted'),
    payable_amount: Number(row.data?.payable_amount ?? 0),
    paid_amount: Number(row.data?.paid_amount ?? 0),
    remaining_amount: Number(row.data?.remaining_amount ?? 0),
    supplier: {
      id: String(row.data?.supplier?.id ?? row.data?.supplier_id ?? ''),
      code: String(row.data?.supplier?.code ?? ''),
      name: row.data?.supplier?.name,
    },
    supplier_id: row.data?.supplier_id,
  }))

  const rebuilt = rebuildKiotVietCashbookAllocations({
    invoices,
    receipts,
    cashbookRows: cashbookResult.rows.map((row) => ({
      id: String(row.id),
      source_code: String(row.code),
      entry_time: row.created_at.toISOString(),
      direction: row.direction,
      amount_delta: Number(row.amount_delta),
      status: String(row.status),
      counterparty_code: typeof row.source?.counterparty_code === 'string' ? row.source.counterparty_code : null,
      counterparty_name: row.counterparty?.name ?? null,
      category_name: typeof row.source?.category_name === 'string' ? row.source.category_name : null,
    })),
  })

  for (const invoice of rebuilt.invoices) {
    const paymentStatus = invoicePaymentStatus(invoice.paid_amount, invoice.debt_amount)
    await pool.query(
      `
        update orders
        set paid_amount = $3,
            debt_amount = $4,
            payment_status = $5,
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, invoice.id, invoice.paid_amount, invoice.debt_amount, paymentStatus],
    )
    if (invoice.debt_amount > 0) {
      await pool.query(
        `
          insert into customer_debt_entries (
            organization_id, customer_id, order_id, original_amount, paid_amount,
            remaining_debt, status, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, 'open', now(), now())
          on conflict (organization_id, order_id) do update set
            customer_id = excluded.customer_id,
            original_amount = excluded.original_amount,
            paid_amount = excluded.paid_amount,
            remaining_debt = excluded.remaining_debt,
            status = 'open',
            updated_at = now()
        `,
        [organizationId, invoice.customer.id, invoice.id, invoice.total_amount, invoice.paid_amount, invoice.debt_amount],
      )
    } else {
      await pool.query(
        `
          update customer_debt_entries
          set paid_amount = $3,
              remaining_debt = 0,
              status = 'closed',
              updated_at = now()
          where organization_id = $1
            and order_id = $2
        `,
        [organizationId, invoice.id, invoice.paid_amount],
      )
    }
  }

  for (const receipt of rebuilt.receipts) {
    await pool.query(
      `
        update purchase_receipt_snapshots
        set data = jsonb_set(
              jsonb_set(data, '{paid_amount}', to_jsonb($3::numeric), true),
              '{remaining_amount}', to_jsonb($4::numeric), true
            ),
            updated_at = now()
        where organization_id = $1
          and id = $2
      `,
      [organizationId, receipt.id, receipt.paid_amount, receipt.remaining_amount],
    )
  }

  for (const entry of rebuilt.cashbookAllocations) {
    await pool.query(
      `
        update cashbook_entries
        set allocations = $3::jsonb,
            source = jsonb_set(coalesce(source, '{}'::jsonb), '{order_code}', to_jsonb($4::text), true)
        where organization_id = $1
          and id = $2
      `,
      [organizationId, entry.id, JSON.stringify(entry.allocations), entry.order_code],
    )
  }
}

async function ensureImportedSnapshotTables(pool: pg.Pool) {
  await pool.query(`
    create table if not exists customer_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists customer_snapshots_org_updated_idx on customer_snapshots (organization_id, updated_at desc)')
  await pool.query(`
    create table if not exists supplier_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists supplier_snapshots_org_updated_idx on supplier_snapshots (organization_id, updated_at desc)')
  await pool.query(`
    create table if not exists purchase_receipt_snapshots (
      id text primary key,
      organization_id uuid not null references organizations(id) on delete cascade,
      code text not null,
      data jsonb not null,
      source_type text not null default 'kiotviet_import',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, code)
    )
  `)
  await pool.query('create index if not exists purchase_receipt_snapshots_org_updated_idx on purchase_receipt_snapshots (organization_id, updated_at desc)')
}

async function findCustomerGroupSnapshot(pool: pg.Pool, organizationId: string, groupId: string) {
  const result = await pool.query(
    `
      select data->'customer_group' as customer_group
      from customer_snapshots
      where organization_id = $1
        and data->>'customer_group_id' = $2
        and data->'customer_group' is not null
      limit 1
    `,
    [organizationId, groupId],
  )
  const group = result.rows[0]?.customer_group as CustomerListData['customer_group'] | undefined
  return group ?? { id: groupId, code: groupId, name: groupId }
}

function hashText(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 10)
}

async function nextManualCustomerCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^kh[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from customer_snapshots
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `KH${String(nextNumber).padStart(6, '0')}`
}

async function nextManualSupplierCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^ncc[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from supplier_snapshots
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `NCC${String(nextNumber).padStart(6, '0')}`
}

async function nextEmployeeCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^nv[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from employees
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `NV${String(nextNumber).padStart(6, '0')}`
}

async function nextDeliveryPartnerCode(pool: pg.Pool, organizationId: string) {
  const result = await pool.query(
    `
      select max(
        case
          when code ~* '^dvvc[0-9]+$' then substring(code from '[0-9]+')::int
          else null
        end
      ) as max_number
      from delivery_partners
      where organization_id = $1
    `,
    [organizationId],
  )
  const nextNumber = Number(result.rows[0]?.max_number ?? 0) + 1
  return `DVVC${String(nextNumber).padStart(6, '0')}`
}

function customerSnapshotMatches(url: URL, customer: CustomerListData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const groupId = url.searchParams.get('customer_group_id')
  const debtMin = optionalFilterNumber(url.searchParams.get('debt_min'))
  const debtMax = optionalFilterNumber(url.searchParams.get('debt_max'))
  if (status && status !== 'all' && (customer.status ?? 'active') !== status) return false
  if (groupId && groupId !== 'all' && customer.customer_group_id !== groupId) return false
  if (debtMin !== undefined && customer.total_debt_amount < debtMin) return false
  if (debtMax !== undefined && customer.total_debt_amount > debtMax) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${customer.code} ${customer.name} ${customer.phone ?? ''} ${customer.tax_code ?? ''} ${customer.address ?? ''} ${customer.note ?? ''}`)
  return haystack.includes(search)
}

function hydrateCustomerLinkedSupplier(customer: CustomerListData, suppliers: SupplierListData[]) {
  const linkedSupplier = suppliers.find((supplier) => supplier.linked_customer_id === customer.id)
    ?? suppliers.find((supplier) => supplierMatchesCustomer(supplier, customer))
    ?? null
  return linkedSupplier
    ? { ...customer, linked_supplier: { id: linkedSupplier.id, code: linkedSupplier.code, name: linkedSupplier.name, linked_at: linkedSupplier.created_at ?? null } }
    : { ...customer, linked_supplier: null }
}

function supplierSnapshotMatches(url: URL, supplier: SupplierListData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const totalPurchaseMin = optionalFilterNumber(url.searchParams.get('total_purchase_min'))
  const totalPurchaseMax = optionalFilterNumber(url.searchParams.get('total_purchase_max'))
  const currentPayableMin = optionalFilterNumber(url.searchParams.get('current_payable_min'))
  const currentPayableMax = optionalFilterNumber(url.searchParams.get('current_payable_max'))
  if (status && status !== 'all' && supplier.status !== status) return false
  if (totalPurchaseMin !== undefined && supplier.total_purchase_amount < totalPurchaseMin) return false
  if (totalPurchaseMax !== undefined && supplier.total_purchase_amount > totalPurchaseMax) return false
  if (currentPayableMin !== undefined && supplier.current_payable_amount < currentPayableMin) return false
  if (currentPayableMax !== undefined && supplier.current_payable_amount > currentPayableMax) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${supplier.code} ${supplier.name} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.tax_code ?? ''} ${supplier.notes ?? ''}`)
  return haystack.includes(search)
}

function supplierMatchesCustomer(supplier: Pick<SupplierListData, 'code' | 'name'>, customer: Pick<CustomerListData, 'code' | 'name'>) {
  return normalizeSearchText(supplier.code) === normalizeSearchText(customer.code)
    || normalizeSearchText(supplier.name) === normalizeSearchText(customer.name)
}

function purchaseReceiptSnapshotMatches(url: URL, receipt: PurchaseReceiptData) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? url.searchParams.get('q') ?? '')
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const createdBy = url.searchParams.get('created_by')
  const supplierId = url.searchParams.get('supplier_id')
  const supplierCode = normalizeSearchText(url.searchParams.get('supplier_code') ?? '')
  if (status && status !== 'all' && receipt.status !== status) return false
  if (
    (supplierId || supplierCode) &&
    receipt.supplier_id !== supplierId &&
    receipt.supplier.id !== supplierId &&
    normalizeSearchText(receipt.supplier.code) !== supplierCode
  ) return false
  if (!dateRangeMatches(receipt.received_at, dateFrom, dateTo)) return false
  if (createdBy && createdBy !== 'all' && receipt.created_by.id !== createdBy) return false
  if (!search) return true
  const haystack = normalizeSearchText(`${receipt.code} ${receipt.supplier.code} ${receipt.supplier.name} ${receipt.supplier_document_no ?? ''} ${receipt.notes ?? ''}`)
  return haystack.includes(search)
}

function optionalFilterNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function cashAccount() {
  return { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' }
}

function bankAccount(accountId?: string | null) {
  return {
    id: accountId && accountId.trim() !== '' ? accountId : 'bank-main',
    code: 'VCB',
    name: 'Vietcombank',
    account_type: 'bank',
  }
}

function productGroupKey(value: string) {
  return normalizeSearchText(value)
    .replace(/\s*>>\s*/g, '>>')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueProductGroups(groups: ProductGroupListData[]) {
  const byKey = new Map<string, ProductGroupListData>()
  for (const group of groups) {
    const key = productGroupKey(group.name)
    const current = byKey.get(key)
    if (!current || (!current.is_default && group.is_default)) byKey.set(key, group)
  }
  return [...byKey.values()]
}

function productGroupImportCode(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  return `KV-${normalized || 'NHOM'}-${stableHash(name)}`
}

function priceListImportCode(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/Ä/g, 'D')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  return `KV-BG-${normalized || 'BANG-GIA'}-${stableHash(name)}`
}

function isDefaultPriceListName(name: string) {
  const normalized = normalizeSearchText(name)
  return normalized === normalizeSearchText('Bảng giá chung') || normalized === normalizeSearchText('Bang gia le')
}

async function upsertPriceListByName(pool: pg.Pool, organizationId: string, name: string) {
  const code = priceListImportCode(name)
  const result = await pool.query(
    `
      insert into price_lists (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, false, true, now(), now())
      on conflict (organization_id, code)
      do update set
        name = excluded.name,
        is_active = true,
        updated_at = now()
      returning id::text
    `,
    [randomUUID(), organizationId, code, name],
  )
  return String(result.rows[0].id)
}

function stableHash(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash.toString(36).toUpperCase().padStart(6, '0')
}

async function referencedProductIds(
  pool: pg.Pool,
  table: (typeof productReferenceGuards)[number]['table'],
  column: (typeof productReferenceGuards)[number]['column'],
  organizationId: string,
  productIds: string[],
  options: { inTransaction?: boolean } = {},
) {
  const sql = `
        select distinct ${column} as product_id
        from ${table}
        where organization_id = $1
          and ${column} = any($2::uuid[])
      `
  try {
    const result = options.inTransaction
      ? await queryWithOptionalRelationSavepoint(pool, `guard_${table}_${column}`, sql, [organizationId, productIds])
      : await pool.query(sql, [organizationId, productIds])
    return result.rows.map((row) => String(row.product_id))
  } catch (error) {
    if (isMissingGuardRelationError(error)) return []
    throw error
  }
}

async function deleteOptionalImportRows(pool: pg.Pool, sql: string, values: unknown[]) {
  try {
    await queryWithOptionalRelationSavepoint(pool, 'delete_optional_import_rows', sql, values)
  } catch (error) {
    if (isMissingGuardRelationError(error)) return
    throw error
  }
}

async function queryWithOptionalRelationSavepoint(pool: pg.Pool, name: string, sql: string, values: unknown[]) {
  const savepoint = `qcvl_optional_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`
  await pool.query(`savepoint ${savepoint}`)
  try {
    const result = await pool.query(sql, values)
    await pool.query(`release savepoint ${savepoint}`)
    return result
  } catch (error) {
    if (isMissingGuardRelationError(error)) {
      await pool.query(`rollback to savepoint ${savepoint}`)
      await pool.query(`release savepoint ${savepoint}`)
    }
    throw error
  }
}

function isMissingGuardRelationError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return code === '42P01' || code === '42703'
}

async function findWorkstation(pool: pg.Pool, organizationId: string, workstationId: string) {
  const result = await pool.query(
    `
      select id, code, name
      from workstations
      where organization_id = $1 and id = $2 and status = 'active'
      limit 1
    `,
    [organizationId, workstationId],
  )
  return result.rows[0] ?? null
}
