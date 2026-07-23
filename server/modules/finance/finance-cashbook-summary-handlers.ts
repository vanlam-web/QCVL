import type { CashbookEntryData, CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
interface Account {id:string;code:string;name:string;account_type:'cash'|'bank'}
interface Dependencies {currentUser:CurrentUserData;repository:ServerRepository;accounts:Account[];fallbackEntries:CashbookEntryData[];toVoucher:(entry:CashbookEntryData)=>unknown}
export function createFinanceCashbookSummaryHandlers(d:Dependencies):{cashbookBalances:()=>RouteResult;cashbookVouchers:()=>RouteResult}{return {
 cashbookBalances:async()=>({found:true,data:{items:d.accounts.map(a=>({finance_account_id:a.id,code:a.code,name:a.name,account_type:a.account_type,balance:a.id==='cash-main'?5700000:14000000}))}}),
 cashbookVouchers:async()=>{const url=new URL('http://api.local/api/v1/finance/cashbook'),entries=d.repository.listCashbookEntries?await d.repository.listCashbookEntries({organizationId:d.currentUser.organization.id,url}):d.fallbackEntries,items=entries.filter(e=>e.source_type==='cashbook_voucher').map(d.toVoucher);return {found:true,data:{items,total:items.length}}},
}}
