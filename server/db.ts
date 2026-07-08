import pg from 'pg'
import type { CurrentUserData, ServerRepository, WorkstationData } from './http.js'

const { Pool } = pg

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

    async createSession(input) {
      await pool.query(
        `
          insert into sessions (token, user_id, expires_at)
          values ($1, $2, $3)
        `,
        [input.token, input.userId, input.expiresAt],
      )
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

    async close() {
      await pool.end()
    },
  }
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
