import pg from 'pg'
import { pathToFileURL } from 'node:url'

export type ApprovedDebtRepair = {
  code: string
  expected_order_status: string
  expected_debt_status: string
  expected_remaining_debt: number
  next_debt_status: 'closed'
  next_remaining_debt: 0
}

export const approvedDebtRepairs: ApprovedDebtRepair[] = [
  { code: 'HD011228', expected_order_status: 'cancelled', expected_debt_status: 'open', expected_remaining_debt: 206230, next_debt_status: 'closed', next_remaining_debt: 0 },
  { code: 'HD011198', expected_order_status: 'completed', expected_debt_status: 'open', expected_remaining_debt: 0, next_debt_status: 'closed', next_remaining_debt: 0 },
]

export function validateApprovedDebtRepairs(repairs = approvedDebtRepairs) {
  if (repairs.length !== 2) throw new Error(`Expected exactly 2 approved debt repairs; received ${repairs.length}.`)
  const codes = repairs.map((repair) => repair.code)
  if (new Set(codes).size !== repairs.length) throw new Error('Approved debt repair codes must be unique.')
  if (codes.sort().join(',') !== ['HD011198', 'HD011228'].join(',')) throw new Error('Approved debt repair scope changed.')
  return repairs
}

export async function repairApprovedDebtStatus(databaseUrl: string, apply: boolean) {
  if (!databaseUrl.trim()) throw new Error('DATABASE_URL is required.')
  const repairs = validateApprovedDebtRepairs()
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query(apply ? 'begin transaction isolation level serializable' : 'begin transaction read only')
    const rows = []
    for (const repair of repairs) {
      const result = await client.query(`
        select o.code, o.status as order_status, d.id, d.status as debt_status,
          d.original_amount, d.paid_amount, d.remaining_debt, d.updated_at
        from orders o
        join customer_debt_entries d on d.order_id = o.id and d.organization_id = o.organization_id
        where o.code = $1
        ${apply ? 'for update of d' : ''}
      `, [repair.code])
      if (result.rowCount !== 1) throw new Error(`${repair.code}: expected exactly one debt row; found ${result.rowCount}.`)
      const row = result.rows[0]
      if (row.order_status !== repair.expected_order_status || row.debt_status !== repair.expected_debt_status || Number(row.remaining_debt) !== repair.expected_remaining_debt) {
        throw new Error(`${repair.code}: precondition mismatch; transaction aborted.`)
      }
      rows.push(row)
    }

    if (apply) {
      for (const repair of repairs) {
        const result = await client.query(`
          update customer_debt_entries d
          set status = $2, remaining_debt = $3, updated_at = now()
          from orders o
          where o.id = d.order_id
            and o.organization_id = d.organization_id
            and o.code = $1
            and o.status = $4
            and d.status = $5
            and d.remaining_debt = $6
        `, [repair.code, repair.next_debt_status, repair.next_remaining_debt, repair.expected_order_status, repair.expected_debt_status, repair.expected_remaining_debt])
        if (result.rowCount !== 1) throw new Error(`${repair.code}: guarded update affected ${result.rowCount} rows; transaction aborted.`)
      }
      await client.query('commit')
    } else {
      await client.query('rollback')
    }
    return { mode: apply ? 'apply' : 'dry-run', rows }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const apply = process.env.QCVL_REPAIR_CONFIRM === 'true'
  const result = await repairApprovedDebtStatus(process.env.DATABASE_URL ?? '', apply)
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
