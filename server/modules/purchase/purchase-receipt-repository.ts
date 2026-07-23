import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Receipt=Awaited<ReturnType<NonNullable<ServerRepository['listPurchaseReceipts']>>>[number]
export function createPurchaseReceiptQueryRepository(pool:pg.Pool,deps:{ensureSnapshots:(pool:pg.Pool)=>Promise<void>;matches:(url:URL,receipt:Receipt)=>boolean}):Pick<ServerRepository,'listPurchaseReceipts'|'getPurchaseReceipt'>{return{
 async listPurchaseReceipts(input){await deps.ensureSnapshots(pool);const result=await pool.query(`select data from purchase_receipt_snapshots where organization_id=$1 order by coalesce(nullif(data->>'received_at','')::timestamptz,created_at) desc`,[input.organizationId]);return result.rows.map(row=>row.data as Receipt).filter(receipt=>deps.matches(input.url,receipt))},
 async getPurchaseReceipt(input){await deps.ensureSnapshots(pool);const result=await pool.query('select data from purchase_receipt_snapshots where organization_id=$1 and (id=$2 or code=$2) limit 1',[input.organizationId,input.id]);return result.rows[0]?.data as Receipt|null??null},
}}
