import { readFileSync } from 'node:fs'
import { createPgRepository } from '../server/db.ts'
import { parseBusinessTimeToUtc } from '../server/date-filter.ts'
import { mapKiotVietProductRows, parseKiotVietProductWorkbookBuffer } from '../server/modules/catalog/product-import.ts'

const sourceCreatedAt = (value: string | null) => {
  if (!value) return null
  const serial = Number(value)
  return Number.isFinite(serial) && serial > 0 ? parseBusinessTimeToUtc(serial) : parseBusinessTimeToUtc(value)
}

const databaseUrl = process.env.QCVL_NAS_DATABASE_URL
if (!databaseUrl) throw new Error('QCVL_NAS_DATABASE_URL required')
const file = process.env.QCVL_A6XB_SOURCE
if (!file) throw new Error('QCVL_A6XB_SOURCE required')
const organizationId = '3936a25e-a2b6-42c1-837d-758b3b6cfc89'
const repo = createPgRepository(databaseUrl)
const mapped = mapKiotVietProductRows(parseKiotVietProductWorkbookBuffer(readFileSync(file)))
if (mapped.invalid.length) throw new Error(`Catalog source invalid rows: ${JSON.stringify(mapped.invalid)}`)
const row = mapped.valid.filter((item) => item.code === 'A6XB')
if (row.length !== 1) throw new Error(`Expected exactly one A6XB frozen source row; got ${row.length}`)
const product = row[0]
const groups = await repo.upsertProductGroupsByName?.({ organizationId, names: [product.product_group_name] })
const productGroupId = groups?.get(product.product_group_name) ?? null
if (!productGroupId) throw new Error('A6XB product group was not resolved')
const result = await repo.upsertProductsByCode?.({ organizationId, rows: [{
  code: product.code, name: product.name, status: product.status, product_group_id: productGroupId,
  unit_name: product.unit_name, sell_method: product.sell_method, product_kind: product.product_kind,
  inventory_shape: product.inventory_shape, track_inventory: product.track_inventory,
  latest_purchase_cost: product.latest_purchase_cost, unit_conversions: product.unit_conversions,
  source_created_at: sourceCreatedAt(product.source_created_at), source: product,
}] })
console.log(JSON.stringify({ source_code: product.code, source_name: product.name, source_cost: product.latest_purchase_cost, source_unit: product.unit_name, source_group: product.product_group_name, result, excluded_side_effects: ['price_list', 'provisional_stock', 'bom'] }, null, 2))
await repo.close()

