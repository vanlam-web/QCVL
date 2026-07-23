import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'

type Pool = pg.Pool
type UserItem = Awaited<ReturnType<NonNullable<ServerRepository['listUsers']>>>[number]
type UserPermission = `perm.${string}`
type UserUpdateInput = Parameters<NonNullable<ServerRepository['updateUser']>>[0]
const searchFrom = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const searchTo = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
const searchSql = (expression: string) => `translate(lower(${expression}), '${searchFrom}', '${searchTo}')`

export function createUserRepository(pool: Pool, deps: { ensureColumns: (pool: Pool) => Promise<void>; invalidate: (organizationId: string) => void }): Pick<ServerRepository, 'listUsers' | 'createUser' | 'updateUser' | 'replaceUserPermissions'> {
  return {
    async listUsers(input) {
      await deps.ensureColumns(pool)
      const search = normalizeSearchText(input.url.searchParams.get('search') ?? ''), status = input.url.searchParams.get('status'), params: unknown[] = [input.organizationId], filters = ['u.organization_id = $1']
      if (status === 'active' || status === 'inactive') { params.push(status); filters.push(`u.status = $${params.length}`) }
      if (search) { params.push(`%${search}%`); filters.push(`(${searchSql('u.display_name')} like $${params.length} or ${searchSql('u.email')} like $${params.length} or ${searchSql("coalesce(u.username, '')")} like $${params.length} or ${searchSql("coalesce(u.phone, '')")} like $${params.length})`) }
      const result = await pool.query(userSelectSql(filters.join(' and ')), params)
      return result.rows.map(userFromRow)
    },
    async createUser(input) {
      await deps.ensureColumns(pool); await pool.query('begin')
      try { const inserted = await pool.query(`insert into users (id, organization_id, email, username, phone, birthday, region, ward, address, note, password_hash, display_name, status, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', now(), now()) returning id::text`, [randomUUID(), input.organizationId, input.email, input.username, input.phone, input.birthday, input.region, input.ward, input.address, input.note, input.passwordHash, input.displayName]); await replacePermissions(pool, String(inserted.rows[0]?.id), input.permissions); const user = await findUser(pool, input.organizationId, String(inserted.rows[0]?.id), deps.ensureColumns); await pool.query('commit'); deps.invalidate(input.organizationId); if (!user) throw new Error('Created user not found.'); return user }
      catch (error) { await pool.query('rollback'); if (isUniqueViolation(error)) throw new Error('USER_ALREADY_EXISTS'); throw error }
    },
    async updateUser(input) {
      await deps.ensureColumns(pool); const assignments: string[] = [], params: unknown[] = []; const fields: Array<[keyof UserUpdateInput, string]> = [['email','email'],['username','username'],['phone','phone'],['birthday','birthday'],['region','region'],['ward','ward'],['address','address'],['note','note'],['passwordHash','password_hash'],['displayName','display_name'],['status','status']]
      for (const [key, column] of fields) { const value = input[key]; if (value !== undefined) { params.push(value); assignments.push(`${column} = $${params.length}`) } }
      if (assignments.length) { params.push(input.organizationId, input.id); try { await pool.query(`update users set ${assignments.join(', ')}, updated_at = now() where organization_id = $${params.length - 1} and id = $${params.length}`, params) } catch (error) { if (isUniqueViolation(error)) throw new Error('USER_ALREADY_EXISTS'); throw error }; deps.invalidate(input.organizationId) }
      return findUser(pool, input.organizationId, input.id, deps.ensureColumns)
    },
    async replaceUserPermissions(input) {
      await pool.query('begin')
      try { const exists = await pool.query('select id from users where organization_id = $1 and id = $2', [input.organizationId, input.id]); if (!exists.rows[0]) { await pool.query('rollback'); return null }; await replacePermissions(pool, input.id, input.permissions); const user = await findUser(pool, input.organizationId, input.id, deps.ensureColumns); await pool.query('commit'); return user }
      catch (error) { await pool.query('rollback'); throw error }
    },
  }
}

function userSelectSql(where: string) { return `select u.id::text, u.email, u.username, u.phone, u.birthday, u.region, u.ward, u.address, u.note, u.display_name, u.status, coalesce(jsonb_agg(up.permission_code order by up.permission_code) filter (where up.permission_code is not null), '[]'::jsonb) as permissions from users u left join user_permissions up on up.user_id = u.id where ${where} group by u.id order by u.created_at desc, u.display_name` }
async function findUser(pool: Pool, organizationId: string, id: string, ensure: (pool: Pool) => Promise<void>): Promise<UserItem | null> { await ensure(pool); const result = await pool.query(`${userSelectSql('u.organization_id = $1 and u.id = $2').replace(' order by u.created_at desc, u.display_name','')} limit 1`, [organizationId, id]); return result.rows[0] ? userFromRow(result.rows[0]) : null }
async function replacePermissions(pool: Pool, userId: string, permissions: UserPermission[]) { await pool.query('delete from user_permissions where user_id = $1', [userId]); for (const permission of permissions) await pool.query('insert into user_permissions (user_id, permission_code) values ($1, $2) on conflict (user_id, permission_code) do nothing', [userId, permission]) }
function userFromRow(row: Record<string, unknown>): UserItem { return { id: String(row.id), email: String(row.email), username: nullable(row.username), phone: nullable(row.phone), birthday: row.birthday instanceof Date ? row.birthday.toISOString().slice(0, 10) : nullable(row.birthday), region: nullable(row.region), ward: nullable(row.ward), address: nullable(row.address), note: nullable(row.note), display_name: String(row.display_name), status: row.status === 'inactive' ? 'inactive' : 'active', permissions: Array.isArray(row.permissions) ? row.permissions.filter((p): p is UserPermission => typeof p === 'string' && p.startsWith('perm.')) : [] } }
function nullable(value: unknown) { if (value === null || value === undefined) return null; const text = String(value); return text || null }
function normalizeSearchText(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim() }
function isUniqueViolation(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' }
