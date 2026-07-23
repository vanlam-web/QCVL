import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
export function createPriceListQueryRepository(pool:pg.Pool,deps:{ensureCatalog:(pool:pg.Pool)=>Promise<void>;ensurePriceLists:(pool:pg.Pool)=>Promise<void>}):Pick<ServerRepository,'findDefaultPriceList'|'listPriceLists'>{return{
 async findDefaultPriceList(input){await deps.ensureCatalog(pool);await deps.ensurePriceLists(pool);const row=(await pool.query(`select id::text,name from price_lists where organization_id=$1 and is_default=true and is_active=true order by updated_at desc,created_at desc limit 1`,[input.organizationId])).rows[0];return row?{id:String(row.id),name:String(row.name)}:null},
 async listPriceLists(input){await deps.ensureCatalog(pool);await deps.ensurePriceLists(pool);const result=await pool.query(`select id::text,code,name,is_default,is_active from price_lists where organization_id=$1 order by is_default desc,name asc`,[input.organizationId]);return result.rows.map(row=>({id:String(row.id),code:String(row.code),name:String(row.name),is_default:Boolean(row.is_default),is_active:Boolean(row.is_active)}))},
}}
