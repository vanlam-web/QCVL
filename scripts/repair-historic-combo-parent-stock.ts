import pg from 'pg'
import { pathToFileURL } from 'node:url'

const expectedMovementCount = 175
const expectedQuantityDelta = -875.22
const tolerance = 0.000001

type Candidate = {
  id: string
  product_id: string
  product_code: string
  document_code: string | null
  quantity_delta: number
  transaction_price: number | null
  cost_price: number | null
  partner_name: string | null
  created_at: string
}

function reversalIdSql(sourceIdColumn: string) {
  const hash = `md5('combo-parent-stock-reversal:' || ${sourceIdColumn}::text)`
  return `(substr(${hash}, 1, 8) || '-' || substr(${hash}, 9, 4) || '-' || substr(${hash}, 13, 4) || '-' || substr(${hash}, 17, 4) || '-' || substr(${hash}, 21, 12))::uuid`
}

export async function repairHistoricComboParentStock(databaseUrl: string, apply: boolean) {
  if (!databaseUrl.trim()) throw new Error('DATABASE_URL is required.')
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query(apply ? 'begin transaction isolation level serializable' : 'begin transaction read only')
    const organization = await client.query<{ id: string }>(`select id::text from organizations where code = 'VAN-LAM' limit 2`)
    if (organization.rowCount !== 1) throw new Error(`Expected exactly one VAN-LAM organization; found ${organization.rowCount}.`)
    const organizationId = organization.rows[0].id
    const candidates = await client.query<Candidate>(`
      select
        sm.id::text, sm.product_id::text, p.code as product_code, sm.document_code,
        sm.quantity_delta, sm.transaction_price, sm.cost_price, sm.partner_name, sm.created_at
      from stock_movements sm
      join products p on p.organization_id = sm.organization_id and p.id = sm.product_id
      where sm.organization_id = $1::uuid
        and sm.movement_type = 'sale_deduction'
        and p.product_kind = 'combo'
        and not exists (
          select 1 from stock_movements reversal
          where reversal.organization_id = sm.organization_id
            and reversal.id = ${reversalIdSql('sm.id')}
        )
      order by sm.created_at, sm.id
      ${apply ? 'for update of sm' : ''}
    `, [organizationId])
    const rows = candidates.rows
    const total = rows.reduce((sum, row) => sum + Number(row.quantity_delta), 0)
    if (rows.length !== expectedMovementCount || Math.abs(total - expectedQuantityDelta) > tolerance) {
      throw new Error(`Historic combo scope changed: expected ${expectedMovementCount}/${expectedQuantityDelta}; found ${rows.length}/${total}.`)
    }
    if (apply) {
      const affectedProductIds = [...new Set(rows.map((row) => row.product_id))]
      const inserted = await client.query(`
        insert into stock_movements (
          id, organization_id, product_id, movement_type, quantity_delta, ending_qty,
          document_type, document_code, transaction_price, cost_price, partner_name, created_at
        )
        select
          ${reversalIdSql('sm.id')}, sm.organization_id, sm.product_id,
          'combo_parent_reversal', -sm.quantity_delta, null,
          'combo_parent_stock_reversal', sm.document_code,
          sm.transaction_price, sm.cost_price, sm.partner_name, now()
        from stock_movements sm
        join products p on p.organization_id = sm.organization_id and p.id = sm.product_id
        where sm.organization_id = $1::uuid
          and sm.movement_type = 'sale_deduction'
          and p.product_kind = 'combo'
          and not exists (
            select 1 from stock_movements reversal
            where reversal.organization_id = sm.organization_id
              and reversal.id = ${reversalIdSql('sm.id')}
          )
      `, [organizationId])
      if (inserted.rowCount !== expectedMovementCount) throw new Error(`Expected ${expectedMovementCount} reversal rows; inserted ${inserted.rowCount}.`)
      for (const productId of affectedProductIds) {
        const movements = await client.query<{ id: string; quantity_delta: number }>(`
          select id::text, quantity_delta from stock_movements
          where organization_id = $1::uuid and product_id = $2::uuid order by created_at, id
        `, [organizationId, productId])
        let endingQty = 0
        for (const movement of movements.rows) {
          endingQty += Number(movement.quantity_delta)
          await client.query('update stock_movements set ending_qty = $3 where organization_id = $1::uuid and id = $2::uuid', [organizationId, movement.id, endingQty])
        }
      }
      await client.query('commit')
    } else {
      await client.query('rollback')
    }
    return { mode: apply ? 'apply' : 'dry-run', movement_count: rows.length, parent_quantity_delta: total, reversal_quantity_delta: -total, records: rows }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const result = await repairHistoricComboParentStock(process.env.DATABASE_URL ?? '', process.env.QCVL_REPAIR_CONFIRM === 'true')
  console.log(JSON.stringify(result, null, 2))
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}