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

    async close() {
      await pool.end()
    },
  }
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
