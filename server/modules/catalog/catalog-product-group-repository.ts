import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type ProductGroup = Awaited<ReturnType<NonNullable<ServerRepository['listProductGroups']>>>[number]
export function createProductGroupRepository(pool: pg.Pool): Pick<ServerRepository, 'listProductGroups' | 'updateProductGroup'> {
  return {
    async listProductGroups(input) { const result = await pool.query<ProductGroup>(`select id::text, code, name, is_default, is_active from product_groups where organization_id = $1 and is_active = true order by is_default desc, name asc`, [input.organizationId]); return unique(result.rows) },
    async updateProductGroup(input) { const name = input.name.trim(); if (!name) return null; const result = await pool.query<ProductGroup>(`update product_groups set name = $3, code = $4, updated_at = now() where organization_id = $1 and id = $2 and is_active = true returning id::text, code, name, is_default, is_active`, [input.organizationId, input.id, name, importCode(name)]); return result.rows[0] ?? null },
  }
}
function unique(groups: ProductGroup[]) { const seen = new Set<string>(); return groups.filter((group) => { const key = normalize(group.name).replace(/\s*>>\s*/g, '>>').replace(/\s+/g, ' ').trim(); if (seen.has(key)) return false; seen.add(key); return true }) }
function importCode(name: string) { const normalized = name.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24); return `KV-${normalized || 'NHOM'}-${stableHash(name)}` }
function stableHash(value: string) { let hash = 0; for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; return hash.toString(36).toUpperCase().padStart(6, '0') }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim() }
