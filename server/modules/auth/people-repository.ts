import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type EmployeeItem = Awaited<ReturnType<NonNullable<ServerRepository['listEmployees']>>>[number]
type DeliveryPartnerItem = Awaited<ReturnType<NonNullable<ServerRepository['listDeliveryPartners']>>>[number]

const searchFrom = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const searchTo = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
const searchSql = (expression: string) => `translate(lower(${expression}), '${searchFrom}', '${searchTo}')`
type PeopleTable = 'employees' | 'delivery_partners'

export function createPeopleRepository(pool: pg.Pool): Pick<ServerRepository, 'listEmployees' | 'createEmployee' | 'listDeliveryPartners' | 'createDeliveryPartner'> {
  return {
    async listEmployees(input) { await ensureTable(pool, 'employees'); return listPeople(pool, 'employees', input.organizationId, input.url, employeeFromRow) },
    async createEmployee(input) { await ensureTable(pool, 'employees'); const code = input.code?.trim() || await nextCode(pool, 'employees', input.organizationId, 'nv', 'NV'); try { return employeeFromRow((await insertPerson(pool, 'employees', { ...input, code })).rows[0]) } catch (error) { if (isUniqueViolation(error)) throw new Error('EMPLOYEE_ALREADY_EXISTS'); throw error } },
    async listDeliveryPartners(input) { await ensureTable(pool, 'delivery_partners'); return listPeople(pool, 'delivery_partners', input.organizationId, input.url, deliveryPartnerFromRow) },
    async createDeliveryPartner(input) { await ensureTable(pool, 'delivery_partners'); const code = input.code?.trim() || await nextCode(pool, 'delivery_partners', input.organizationId, 'dvvc', 'DVVC'); try { return deliveryPartnerFromRow((await insertPerson(pool, 'delivery_partners', { ...input, code })).rows[0]) } catch (error) { if (isUniqueViolation(error)) throw new Error('DELIVERY_PARTNER_ALREADY_EXISTS'); throw error } },
  }
}

async function listPeople<T>(pool: pg.Pool, table: PeopleTable, organizationId: string, url: URL, map: (row: Record<string, unknown>) => T) {
  const search = normalizeSearchText(url.searchParams.get('search') ?? ''), status = url.searchParams.get('status'), params: unknown[] = [organizationId], filters = ['organization_id = $1']
  if (status === 'active' || status === 'inactive') { params.push(status); filters.push(`status = $${params.length}`) }
  if (search) { params.push(`%${search}%`); filters.push(`(${searchSql('name')} like $${params.length} or ${searchSql('code')} like $${params.length} or ${searchSql("coalesce(phone, '')")} like $${params.length})`) }
  const result = await pool.query(`select id::text, code, name, phone, note, status, created_at from ${table} where ${filters.join(' and ')} order by created_at desc, name`, params)
  return result.rows.map(map)
}

function insertPerson(pool: pg.Pool, table: PeopleTable, input: { organizationId: string; code: string; name: string; phone?: string | null; note?: string | null; status?: 'active' | 'inactive' }) { return pool.query(`insert into ${table} (id, organization_id, code, name, phone, note, status, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, now(), now()) returning id::text, code, name, phone, note, status, created_at`, [randomUUID(), input.organizationId, input.code, input.name.trim(), input.phone?.trim() || null, input.note?.trim() || null, input.status ?? 'active']) }
async function ensureTable(pool: pg.Pool, table: PeopleTable) { await pool.query(`create table if not exists ${table} (id uuid primary key, organization_id uuid not null references organizations(id) on delete cascade, code text not null, name text not null, phone text, note text, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now())`); await pool.query(`create unique index if not exists ${table}_org_code_uidx on ${table} (organization_id, lower(code))`); await pool.query(`create index if not exists ${table}_org_status_name_idx on ${table} (organization_id, status, name)`) }
async function nextCode(pool: pg.Pool, table: PeopleTable, organizationId: string, pattern: string, prefix: string) { const result = await pool.query(`select max(case when code ~* '^${pattern}[0-9]+$' then substring(code from '[0-9]+')::int else null end) as max_number from ${table} where organization_id = $1`, [organizationId]); return `${prefix}${String(Number(result.rows[0]?.max_number ?? 0) + 1).padStart(6, '0')}` }
function personBase(row: Record<string, unknown>) { return { id: String(row.id), code: String(row.code), name: String(row.name), phone: nullable(row.phone), note: nullable(row.note), status: row.status === 'inactive' ? 'inactive' as const : 'active' as const, created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) } }
function employeeFromRow(row: Record<string, unknown>): EmployeeItem { return personBase(row) }
function deliveryPartnerFromRow(row: Record<string, unknown>): DeliveryPartnerItem { return personBase(row) }
function nullable(value: unknown) { if (value === null || value === undefined) return null; const text = String(value); return text || null }
function normalizeSearchText(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim() }
function isUniqueViolation(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' }
