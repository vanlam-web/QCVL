import type pg from 'pg'
import type { ServerRepository, WorkstationData } from '../../http-types.js'
import { mergeOrganizationBillSettingsPatch, normalizeOrganizationBillSettingsData, type OrganizationBillSettingsData } from '../../bill-settings.js'

type Pool = pg.Pool

export function createOrganizationSettingsRepository(pool: Pool, ensureColumns: (pool: Pool) => Promise<void>): Pick<ServerRepository, 'listWorkstations' | 'getOrganizationBillSettings' | 'updateOrganizationBillSettings'> {
  return {
    async listWorkstations(organizationId) {
      const result = await pool.query(`select id, code, name, status from workstations where organization_id = $1 order by code`, [organizationId])
      return result.rows as WorkstationData[]
    },
    async getOrganizationBillSettings(input) {
      await ensureColumns(pool)
      const result = await pool.query(settingsSelectSql, [input.organizationId])
      return result.rows[0] ? mapSettingsRow(result.rows[0]) : defaultSettings()
    },
    async updateOrganizationBillSettings(input) {
      await ensureColumns(pool)
      const current = await pool.query(settingsSelectSql, [input.organizationId])
      const mapped = current.rows[0] ? mapSettingsRow(current.rows[0]) : defaultSettings()
      const next = mergeOrganizationBillSettingsPatch(mapped, input.patch)
      await pool.query(`update organizations set shop_name = $2, shop_address = $3, shop_phone = $4, print_place = $5, default_bill_template = $6, invoice_title = $7, quote_title = $8, footer_note = $9, show_product_code = $10, show_unit = $11, show_discount = $12, logo_data_url = $13, bill_templates = $14::jsonb where id = $1`, [input.organizationId, next.shop_name, next.shop_address, next.shop_phone, next.print_place, next.default_bill_template, next.invoice_title, next.quote_title, next.footer_note, next.show_product_code, next.show_unit, next.show_discount, next.logo_data_url, JSON.stringify(next.templates)])
      return next
    },
  }
}

const settingsSelectSql = `select coalesce(nullif(btrim(shop_name), ''), name) as shop_name, coalesce(shop_address, '') as shop_address, coalesce(shop_phone, '') as shop_phone, coalesce(print_place, '') as print_place, case when default_bill_template in ('a4', 'k80') then default_bill_template else 'a4' end as default_bill_template, coalesce(nullif(btrim(invoice_title), ''), 'HÓA ĐƠN BÁN HÀNG') as invoice_title, coalesce(nullif(btrim(quote_title), ''), 'BẢNG BÁO GIÁ') as quote_title, coalesce(footer_note, '') as footer_note, coalesce(show_product_code, false) as show_product_code, coalesce(show_unit, true) as show_unit, coalesce(show_discount, false) as show_discount, logo_data_url, coalesce(bill_templates, '[]'::jsonb) as bill_templates from organizations where id = $1 limit 1`

function defaultSettings() { return normalizeOrganizationBillSettingsData({ shop_name: 'QCVL', shop_address: '', shop_phone: '', print_place: '', default_bill_template: 'a4' }) }
function mapSettingsRow(row: Record<string, unknown>) {
  let templates: OrganizationBillSettingsData['templates'] = []
  if (Array.isArray(row.bill_templates)) templates = row.bill_templates as OrganizationBillSettingsData['templates']
  else if (typeof row.bill_templates === 'string') templates = JSON.parse(row.bill_templates)
  else if (row.bill_templates && typeof row.bill_templates === 'object') templates = row.bill_templates as OrganizationBillSettingsData['templates']
  return normalizeOrganizationBillSettingsData({ shop_name: String(row.shop_name ?? 'QCVL'), shop_address: String(row.shop_address ?? ''), shop_phone: String(row.shop_phone ?? ''), print_place: String(row.print_place ?? ''), default_bill_template: row.default_bill_template === 'k80' ? 'k80' : 'a4', invoice_title: String(row.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG'), quote_title: String(row.quote_title ?? 'BẢNG BÁO GIÁ'), footer_note: String(row.footer_note ?? ''), show_product_code: row.show_product_code === true, show_unit: row.show_unit !== false, show_discount: row.show_discount === true, logo_data_url: typeof row.logo_data_url === 'string' && row.logo_data_url ? row.logo_data_url : null, templates })
}
