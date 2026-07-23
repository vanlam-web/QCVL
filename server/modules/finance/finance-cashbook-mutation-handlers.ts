import type { CashbookEntryData, CurrentUserData, FinanceAccountData, SalesDocumentData, ServerRepository } from '../../http.js'
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type VoucherRequest={financeAccountId:string;counterpartyType:string;counterpartyId?:string;counterpartyName?:string;counterpartyPhone?:string|null;[key:string]:unknown}
type CashbookDeps={request:Request;url:URL;currentUser:CurrentUserData;repository:ServerRepository;path:string;getIdFromPath(path:string):string|undefined;readJson(request:Request):Promise<Record<string,unknown>>;cashbookEntries:CashbookEntryData[];financeAccounts:FinanceAccountData[];salesDocuments:SalesDocumentData[];filterCashbookEntries(url:URL):CashbookEntryData[];sortCashbookEntriesForRequest(items:CashbookEntryData[],url:URL):CashbookEntryData[];cashbookEntriesUrl(url:URL):URL;cashbookSummarySourceUrl(url:URL):URL|null;cashbookListSummary(items:CashbookEntryData[],options:unknown):unknown;paged<T>(items:T[],page:number,pageSize:number):Paged<T>;enrichCashbookEntryDetail(entry:CashbookEntryData,resolver:(code:string)=>Promise<SalesDocumentData|null>):Promise<unknown>;optionalIsoDateTime(value:unknown,field:string):string|undefined;nullableString(value:unknown):string|null;manualCashbookVoucherRequestFromBody(body:Record<string,unknown>):VoucherRequest;makeManualCashbookVoucherEntry(request:VoucherRequest,account:FinanceAccountData,user:CurrentUserData,entries:CashbookEntryData[]):CashbookEntryData;cashbookVoucherListItem(entry:CashbookEntryData):unknown;validation(message:string,fields?:Record<string,string[]>):Error}
export function createFinanceCashbookMutationHandlers(deps:CashbookDeps){type CashbookRow=CashbookEntryData
type SalesRow=SalesDocumentData
type AccountRow=FinanceAccountData
type ContactRow={id:string;name:string;phone?:string|null}
const {request,url,currentUser,repository,path,getIdFromPath,readJson,cashbookEntries,financeAccounts,salesDocuments,filterCashbookEntries,sortCashbookEntriesForRequest,cashbookEntriesUrl,cashbookSummarySourceUrl,cashbookListSummary,paged,enrichCashbookEntryDetail,optionalIsoDateTime,nullableString,manualCashbookVoucherRequestFromBody,makeManualCashbookVoucherEntry,cashbookVoucherListItem,validation}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listCashbook: async () => {
      const entriesUrl = cashbookEntriesUrl(url)
      const usesDefaultDatabaseSort = !url.searchParams.get('sort_key')
        || (url.searchParams.get('sort_key') === 'created_at' && (url.searchParams.get('sort_direction') ?? 'desc') === 'desc')
      if (repository.listCashbookEntriesPage && usesDefaultDatabaseSort) {
        const pageData = await repository.listCashbookEntriesPage({ organizationId: currentUser.organization.id, url: entriesUrl })
        return {
          found: true,
          data: { ...pageData, page, page_size: pageSize },
        }
      }
      const entries = repository.listCashbookEntries
        ? await repository.listCashbookEntries({ organizationId: currentUser.organization.id, url: entriesUrl })
        : filterCashbookEntries(entriesUrl)
      const sortedEntries = sortCashbookEntriesForRequest(entries, url)
      const summarySourceUrl = cashbookSummarySourceUrl(url)
      const summarySourceEntries = summarySourceUrl
        ? repository.listCashbookEntries
          ? await repository.listCashbookEntries({ organizationId: currentUser.organization.id, url: summarySourceUrl })
          : filterCashbookEntries(summarySourceUrl)
        : entries
      return { found: true, data: { ...paged(sortedEntries, page, pageSize), summary: cashbookListSummary(entries, { from: url.searchParams.get('from'), sourceEntries: summarySourceEntries }) } }
    },
    getCashbookEntry: async () => {
      const id = getIdFromPath(path) ?? ''
      if (repository.getCashbookEntry) {
        const entry = await repository.getCashbookEntry({ organizationId: currentUser.organization.id, id })
        if (entry === null) return { found: true, data: { message: 'Cashbook entry not found' }, status: 404 }
        return {
          found: true,
          data: await enrichCashbookEntryDetail(entry, async (code: string) => {
            const directDocument = await repository.getSalesDocument?.({ organizationId: currentUser.organization.id, id: code })
            if (directDocument) return directDocument
            const searchUrl = new URL('http://api.local/api/v1/sales-documents')
            searchUrl.searchParams.set('search', code)
            searchUrl.searchParams.set('type', 'invoice')
            const documents = await repository.listSalesDocuments?.({ organizationId: currentUser.organization.id, url: searchUrl })
            return documents?.find((document: SalesRow) => document.code === code) ?? null
          }),
        }
      }
      const entry = cashbookEntries.find((item: CashbookRow) => item.id === id) ?? cashbookEntries[0]
      return {
        found: true,
        data: await enrichCashbookEntryDetail(entry, async (code: string) => (
        salesDocuments.find((document: SalesRow) => document.code === code) ?? null
        )),
      }
    },
    updateCashbookEntry: async () => {
      const id = getIdFromPath(path) ?? ''
      const body = await readJson(request)
      const createdAt = optionalIsoDateTime(body.created_at, 'created_at')
      const financeAccountId = body.finance_account_id === undefined ? undefined : nullableString(body.finance_account_id) ?? undefined
      const note = body.note === undefined ? undefined : nullableString(body.note)
      if (createdAt === undefined && financeAccountId === undefined && body.note === undefined) {
        throw validation('No cashbook fields to update.')
      }
      if (repository.updateCashbookEntry) {
        const entry = await repository.updateCashbookEntry({
          organizationId: currentUser.organization.id,
          id,
          ...(createdAt !== undefined ? { created_at: createdAt } : {}),
          ...(financeAccountId !== undefined ? { finance_account_id: financeAccountId } : {}),
          ...(body.note !== undefined ? { note } : {}),
        })
        if (entry === null) return { found: true, data: { code: 'NOT_FOUND', message: 'Cashbook entry not found.' }, status: 404 }
        return {
          found: true,
          data: await enrichCashbookEntryDetail(entry, async (code: string) => {
            const directDocument = await repository.getSalesDocument?.({ organizationId: currentUser.organization.id, id: code })
            if (directDocument) return directDocument
            const searchUrl = new URL('http://api.local/api/v1/sales-documents')
            searchUrl.searchParams.set('search', code)
            searchUrl.searchParams.set('type', 'invoice')
            const documents = await repository.listSalesDocuments?.({ organizationId: currentUser.organization.id, url: searchUrl })
            return documents?.find((document: SalesRow) => document.code === code) ?? null
          }),
        }
      }
      const index = cashbookEntries.findIndex((entry: CashbookRow) => entry.id === id || entry.code === id)
      if (index < 0) return { found: true, data: { code: 'NOT_FOUND', message: 'Cashbook entry not found.' }, status: 404 }
      const current = cashbookEntries[index]
      const account = financeAccountId ? financeAccounts.find((item: AccountRow) => item.id === financeAccountId) : null
      if (financeAccountId && !account) throw validation('finance_account_id is invalid.')
      const nextFinanceAccount = account
        ? {
            id: account.id,
            code: account.account_type === 'bank' ? account.account_number ?? account.code : account.code,
            name: account.name,
            account_type: account.account_type,
            account_number: account.account_number,
            account_holder: account.account_holder,
          }
        : current.finance_account
      cashbookEntries[index] = {
        ...current,
        ...(createdAt !== undefined ? { created_at: createdAt } : {}),
        ...(body.note !== undefined ? { note } : {}),
        finance_account: nextFinanceAccount,
        payment_method: nextFinanceAccount.account_type === 'bank' ? 'bank_transfer' : 'cash',
      }
      return { found: true, data: await enrichCashbookEntryDetail(cashbookEntries[index], async (code: string) => salesDocuments.find((document: SalesRow) => document.code === code) ?? null) }
    },
    createCashbookVoucher: async () => {
      const body = await readJson(request) as Record<string, unknown>
      const voucherRequest = manualCashbookVoucherRequestFromBody(body)
      const accountRows = repository.listFinanceAccounts
        ? await repository.listFinanceAccounts({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/finance/accounts?is_active=true') })
        : financeAccounts
    const account = accountRows.find((item: AccountRow) => item.id === voucherRequest.financeAccountId)
    if (!account) {
      throw validation('finance_account_id is invalid.', { finance_account_id: ['finance_account_id is invalid.'] })
    }
    if (voucherRequest.counterpartyType === 'customer') {
      const customers = repository.listCustomers
        ? await repository.listCustomers({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/customers?status=active&page=1&page_size=10000') })
        : []
      const customer = customers.find((item: ContactRow) => item.id === voucherRequest.counterpartyId)
      if (!customer) {
        throw validation('counterparty_id is required.', { counterparty_id: ['Choose an active customer.'] })
      }
      voucherRequest.counterpartyName = customer.name
      voucherRequest.counterpartyPhone = customer.phone ?? null
    }
    if (voucherRequest.counterpartyType === 'supplier') {
      const suppliers = repository.listSuppliers
        ? await repository.listSuppliers({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/suppliers?status=active&page=1&page_size=10000') })
        : []
      const supplier = suppliers.find((item: ContactRow) => item.id === voucherRequest.counterpartyId)
      if (!supplier) {
        throw validation('counterparty_id is required.', { counterparty_id: ['Choose an active supplier.'] })
      }
      voucherRequest.counterpartyName = supplier.name
      voucherRequest.counterpartyPhone = supplier.phone ?? null
    }
    if (voucherRequest.counterpartyType === 'employee') {
      const employees = repository.listEmployees
        ? await repository.listEmployees({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/employees?status=active') })
        : []
      const employee = employees.find((item: ContactRow) => item.id === voucherRequest.counterpartyId)
      if (!employee) {
        throw validation('counterparty_id is required.', { counterparty_id: ['Choose an active employee.'] })
      }
      voucherRequest.counterpartyName = employee.name
      voucherRequest.counterpartyPhone = employee.phone ?? null
    }
    if (voucherRequest.counterpartyType === 'delivery_partner') {
      const deliveryPartners = repository.listDeliveryPartners
        ? await repository.listDeliveryPartners({ organizationId: currentUser.organization.id, url: new URL('http://api.local/api/v1/delivery-partners?status=active') })
        : []
      const deliveryPartner = deliveryPartners.find((item: ContactRow) => item.id === voucherRequest.counterpartyId)
      if (!deliveryPartner) {
        throw validation('counterparty_id is required.', { counterparty_id: ['Choose an active delivery partner.'] })
      }
      voucherRequest.counterpartyName = deliveryPartner.name
      voucherRequest.counterpartyPhone = deliveryPartner.phone ?? null
    }
      const entriesUrl = new URL('http://api.local/api/v1/finance/cashbook')
      const existingEntries = repository.listCashbookEntries
        ? await repository.listCashbookEntries({ organizationId: currentUser.organization.id, url: entriesUrl })
        : cashbookEntries
      const entry = makeManualCashbookVoucherEntry(voucherRequest, account, currentUser, existingEntries)
      const created = repository.createCashbookVoucher
        ? await repository.createCashbookVoucher({ organizationId: currentUser.organization.id, entry })
        : entry
      if (!repository.createCashbookVoucher) cashbookEntries.unshift(created)
      return { found: true, data: cashbookVoucherListItem(created), status: 201 }
    },
    cancelCashbookVoucher: async () => {
      const pathParts = path.split('/').filter(Boolean)
      const voucherId = pathParts.at(-2) ?? ''
      const cancelled = repository.cancelCashbookVoucher
        ? await repository.cancelCashbookVoucher({ organizationId: currentUser.organization.id, id: voucherId })
        : null
      if (!cancelled) return { found: true, data: { code: 'NOT_FOUND', message: 'Cashbook voucher not found.' }, status: 404 }
      return { found: true, data: cashbookVoucherListItem(cancelled) }
    },
    reviseCashbookVoucher: async () => {
      const pathParts = path.split('/').filter(Boolean)
      return { found: true, data: { id: pathParts.at(-2) ?? '', code: 'PC0001', source_type: 'manual_voucher', status: 'posted', amount: 1000000 } }
    },
  }}
