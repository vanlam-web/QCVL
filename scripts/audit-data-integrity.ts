import pg from 'pg'
import { pathToFileURL } from 'node:url'

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'info'
export type AuditFinding = { check_id: string; severity: AuditSeverity; domain: string; summary: string; count: number; records: unknown[]; truncated: boolean }
export type AuditReport = { generated_at: string; database: { connected: true; read_only: true }; totals: Record<AuditSeverity, number>; findings: AuditFinding[] }

type Query = { check_id: string; severity: AuditSeverity; domain: string; summary: string; tables: string[]; sql: string }
const limit = 100
const tolerance = 0.01

export const auditQueries: Query[] = [
  { check_id: 'SALES-001', severity: 'critical', domain: 'sales', summary: 'Subtotal trừ giảm giá lệch tổng hóa đơn', tables: ['orders'], sql: `select code,status,subtotal_amount,discount_amount,total_amount from orders where abs(subtotal_amount-discount_amount-total_amount)>${tolerance}` },
  { check_id: 'SALES-002', severity: 'critical', domain: 'sales', summary: 'Paid cộng debt lệch total trên hóa đơn chưa hủy', tables: ['orders'], sql: `select code,status,total_amount,paid_amount,debt_amount from orders where order_type='invoice' and status<>'cancelled' and abs(total_amount-paid_amount-debt_amount)>${tolerance}` },
  { check_id: 'SALES-003', severity: 'high', domain: 'sales', summary: 'Mã chứng từ trùng', tables: ['orders'], sql: `select organization_id::text,code,count(*)::int duplicate_count from orders group by organization_id,code having count(*)>1` },
  { check_id: 'SALES-004', severity: 'high', domain: 'sales', summary: 'Revision tham chiếu hóa đơn không tồn tại', tables: ['orders'], sql: `select o.code,o.revised_from_order_id,o.replaced_by_order_id from orders o where (o.revised_from_order_id is not null and not exists(select 1 from orders p where p.id=o.revised_from_order_id)) or (o.replaced_by_order_id is not null and not exists(select 1 from orders n where n.id=o.replaced_by_order_id))` },
  { check_id: 'DEBT-001', severity: 'critical', domain: 'debt', summary: 'Nợ còn lại vượt nợ hóa đơn', tables: ['customer_debt_entries','orders'], sql: `select o.code,d.id,d.remaining_debt,o.debt_amount from customer_debt_entries d join orders o on o.id=d.order_id where d.remaining_debt-o.debt_amount>${tolerance}` },
  { check_id: 'DEBT-002', severity: 'critical', domain: 'debt', summary: 'Original trừ paid lệch remaining trên hóa đơn chưa hủy', tables: ['customer_debt_entries','orders'], sql: `select o.code,d.id,d.original_amount,d.paid_amount,d.remaining_debt from customer_debt_entries d join orders o on o.id=d.order_id where o.status<>'cancelled' and abs(d.original_amount-d.paid_amount-d.remaining_debt)>${tolerance}` },
  { check_id: 'DEBT-003', severity: 'high', domain: 'debt', summary: 'Nợ mở của hóa đơn hủy hoặc đã hết nợ', tables: ['customer_debt_entries','orders'], sql: `select o.code,o.status,d.id,d.remaining_debt from customer_debt_entries d join orders o on o.id=d.order_id where d.status='open' and (o.status='cancelled' or d.remaining_debt<=${tolerance} or o.debt_amount<=${tolerance})` },
  { check_id: 'FINANCE-001', severity: 'critical', domain: 'finance', summary: 'Mã sổ quỹ trùng', tables: ['cashbook_entries'], sql: `select organization_id::text,code,count(*)::int duplicate_count from cashbook_entries group by organization_id,code having count(*)>1` },
  { check_id: 'FINANCE-002', severity: 'high', domain: 'finance', summary: 'Allocation sổ quỹ vượt số tiền phiếu', tables: ['cashbook_entries'], sql: `select c.code,c.amount_delta,coalesce(sum(nullif(a.value->>'amount','')::numeric),0) allocated_amount from cashbook_entries c cross join lateral jsonb_array_elements(coalesce(c.allocations,'[]'::jsonb)) a(value) group by c.id having coalesce(sum(nullif(a.value->>'amount','')::numeric),0)>abs(c.amount_delta)+${tolerance}` },
  { check_id: 'PURCHASE-001', severity: 'high', domain: 'purchase', summary: 'Phiếu nhập snapshot có paid + remaining lệch payable', tables: ['purchase_receipt_snapshots'], sql: `select code, nullif(data->>'payable_amount','')::numeric payable_amount, nullif(data->>'paid_amount','')::numeric paid_amount, nullif(data->>'remaining_amount','')::numeric remaining_amount from purchase_receipt_snapshots where data->>'status'='posted' and abs(coalesce(nullif(data->>'payable_amount','')::numeric,0)-coalesce(nullif(data->>'paid_amount','')::numeric,0)-coalesce(nullif(data->>'remaining_amount','')::numeric,0))>${tolerance}` },
  { check_id: 'PURCHASE-002', severity: 'high', domain: 'purchase', summary: 'Mã phiếu nhập snapshot trùng tổ chức', tables: ['purchase_receipt_snapshots'], sql: `select organization_id::text,code,count(*)::int duplicate_count from purchase_receipt_snapshots group by organization_id,code having count(*)>1` },
  { check_id: 'INVENTORY-001', severity: 'info', domain: 'inventory', summary: 'Movement cùng fingerprint cần đối chiếu với nhiều dòng sản phẩm trên chứng từ', tables: ['stock_movements'], sql: `select organization_id::text,product_id::text,movement_type,document_type,document_code,quantity_delta,created_at,count(*)::int fingerprint_count from stock_movements where document_code is not null group by organization_id,product_id,movement_type,document_type,document_code,quantity_delta,created_at having count(*)>1` },
  { check_id: 'INVENTORY-002', severity: 'high', domain: 'inventory', summary: 'Combo cha bị trừ kho', tables: ['stock_movements','products'], sql: `select sm.document_code,p.code,sm.quantity_delta from stock_movements sm join products p on p.id=sm.product_id where sm.movement_type='sale_deduction' and p.product_kind='combo'` },
  { check_id: 'INVENTORY-003', severity: 'medium', domain: 'inventory', summary: 'Sản phẩm active theo dõi kho chưa có movement', tables: ['products','stock_movements'], sql: `select p.code,p.name from products p where p.status='active' and p.track_inventory=true and p.product_kind not in ('combo','service') and not exists(select 1 from stock_movements s where s.organization_id=p.organization_id and s.product_id=p.id)` },
  { check_id: 'INVENTORY-004', severity: 'info', domain: 'inventory', summary: 'Tồn provisional KiotViet đang tồn tại', tables: ['inventory_provisional_balances'], sql: `select product_id::text,initial_qty,remaining_qty,status,source_type from inventory_provisional_balances` },
]

export function countBySeverity(findings: AuditFinding[]) { const totals: Record<AuditSeverity, number>={critical:0,high:0,medium:0,info:0}; for(const f of findings) totals[f.severity]+=f.count; return totals }
export function findingFromRows(q: Query, rows: unknown[]): AuditFinding { return {check_id:q.check_id,severity:q.severity,domain:q.domain,summary:q.summary,count:rows.length,records:rows.slice(0,limit),truncated:rows.length>limit} }

export async function runDataIntegrityAudit(databaseUrl: string): Promise<AuditReport> {
  if (!databaseUrl.trim()) throw new Error('DATABASE_URL is required for data integrity audit.')
  const client=new pg.Client({connectionString:databaseUrl}); await client.connect(); const findings:AuditFinding[]=[]
  try { await client.query('begin transaction read only'); await client.query("set local statement_timeout='60s'")
    const tableRows=await client.query<{table_name:string}>(`select table_name from information_schema.tables where table_schema=current_schema()`); const tables=new Set(tableRows.rows.map(r=>r.table_name))
    for(const q of auditQueries){ if(q.tables.some(t=>!tables.has(t))){ findings.push({check_id:q.check_id,severity:'info',domain:'system',summary:`${q.summary}: thiếu bảng`,count:0,records:[],truncated:false}); continue }; findings.push(findingFromRows(q,(await client.query(q.sql)).rows)) }
    await client.query('rollback')
  } catch(error){ await client.query('rollback').catch(()=>undefined); throw error } finally { await client.end() }
  return {generated_at:new Date().toISOString(),database:{connected:true,read_only:true},totals:countBySeverity(findings),findings}
}

async function main(){ const report=await runDataIntegrityAudit(process.env.DATABASE_URL??''); console.log(JSON.stringify(report,null,2)); if(report.totals.critical>0) process.exitCode=2; else if(report.totals.high>0) process.exitCode=1 }
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
