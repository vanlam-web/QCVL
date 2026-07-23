import type pg from 'pg'
import type { AuthUserRow, CurrentUserData, ServerRepository, WorkstationData } from '../../http-types.js'

type Pool = pg.Pool
export function createAuthSessionRepository(pool: Pool, dependencies: { ensureUserColumns: (pool: Pool) => Promise<void>; findWorkstation: (pool: Pool, organizationId: string, workstationId: string) => Promise<WorkstationData | null> }): Pick<ServerRepository, 'findUserByEmail' | 'findUserByLogin' | 'createSession' | 'deleteSession' | 'getSessionUser'> {
  return {
    async findUserByEmail(email) {
      const result = await pool.query('select id, email, password_hash, organization_id, display_name, status from users where email = $1 limit 1', [email])
      return result.rows[0] ?? null
    },
    async findUserByLogin(login) {
      await dependencies.ensureUserColumns(pool)
      const normalized = login.trim().toLowerCase()
      const phoneDigits = normalized.replace(/\D/g, '')
      const result = await pool.query(`select id, email, password_hash, organization_id, display_name, status from users where lower(email) = $1 or lower(coalesce(username, '')) = $1 or ($2 <> '' and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2) order by case when lower(email) = $1 then 1 when lower(coalesce(username, '')) = $1 then 2 else 3 end, created_at desc limit 2`, [normalized, phoneDigits])
      const rows = result.rows as AuthUserRow[]
      const directRows = rows.filter((row) => row.email.toLowerCase() === normalized)
      if (directRows[0]) return directRows[0]
      if (rows.length > 1) return null
      return rows[0] ?? null
    },
    async createSession(input) {
      await pool.query('insert into sessions (token, user_id, expires_at) values ($1, $2, $3)', [input.token, input.userId, input.expiresAt])
    },
    async deleteSession(token) {
      await pool.query('delete from sessions where token = $1', [token])
    },
    async getSessionUser(token, workstationId) {
      const result = await pool.query(`select u.id as user_id, u.email, u.display_name, u.status as user_status, o.id as organization_id, o.code as organization_code, o.name as organization_name, coalesce(jsonb_agg(up.permission_code order by up.permission_code) filter (where up.permission_code is not null), '[]'::jsonb) as permissions from sessions s join users u on u.id = s.user_id join organizations o on o.id = u.organization_id left join user_permissions up on up.user_id = u.id left join permissions p on p.code = up.permission_code and p.status = 'active' where s.token = $1 and s.expires_at > now() and u.status = 'active' group by u.id, o.id limit 1`, [token])
      const row = result.rows[0]
      if (!row) return null
      const workstation = workstationId ? await dependencies.findWorkstation(pool, row.organization_id, workstationId) : null
      return { user: { id: row.user_id, email: row.email, display_name: row.display_name }, organization: { id: row.organization_id, code: row.organization_code, name: row.organization_name }, workstation, permissions: row.permissions } satisfies CurrentUserData
    },
  }
}
