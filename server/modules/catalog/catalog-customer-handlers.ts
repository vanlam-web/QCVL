import type { CurrentUserData, CustomerListData, ServerRepository, SupplierListData, UserListItemData } from '../../http.js'
type FinancialTotals=Awaited<ReturnType<NonNullable<ServerRepository['getCustomerFinancialTotals']>>> extends Map<string,infer T>?T:never
type Paged<T>={items:T[];page:number;page_size:number;total:number}
type BillPatch={preferred_bill_template?:string|null;preferred_bill_templates?:string[]|null}
type CustomerDeps={request:Request;url:URL;currentUser:CurrentUserData;repository:ServerRepository;path:string;readJson(request:Request):Promise<Record<string,unknown>>;getIdFromPath(path:string):string|undefined;customers:CustomerListData[];customerGroups:Array<{id:string;code:string;name:string}>;suppliers:SupplierListData[];filterCustomers(url:URL):CustomerListData[];sortCustomersForRequest(items:CustomerListData[],url:URL):CustomerListData[];hydrateLinkedSuppliers(items:CustomerListData[],suppliers:SupplierListData[]):CustomerListData[];customerListSummary(items:CustomerListData[]):unknown;customerDisplayTotals(customer:CustomerListData,totals:FinancialTotals|undefined):Partial<CustomerListData>;resolveCustomerCreatedBy(customer:CustomerListData,users:UserListItemData[]):CustomerListData['created_by'];customerActivityFromSalesDocuments():Map<string,string>;randomUUID():string;nowIso:string;requiredString(value:unknown,field:string):string;nullableString(value:unknown):string|null;isBillPreferenceValue(value:unknown):value is string;isWalkInCustomerCode(code:string):boolean;syncCustomerBillPreferencePatch(input:BillPatch&{currentTemplate:string|null;currentTemplates:string[]|null}):{preferred_bill_template:string|null;preferred_bill_templates:string[]};httpError(status:number,code:'VALIDATION_ERROR',message:string,fields?:Record<string,string[]>):Error;paged<T>(items:T[],page:number,pageSize:number):Paged<T>}
type CustomerRow=CustomerListData
type GroupRow={id:string}
export function createCatalogCustomerHandlers(deps:CustomerDeps){const {request,url,currentUser,repository,path,readJson,getIdFromPath,customers,customerGroups,suppliers ,filterCustomers,sortCustomersForRequest,hydrateLinkedSuppliers,customerListSummary,customerDisplayTotals,resolveCustomerCreatedBy,customerActivityFromSalesDocuments,randomUUID,nowIso,requiredString,nullableString,isBillPreferenceValue,isWalkInCustomerCode,syncCustomerBillPreferencePatch,httpError,paged}=deps;const page=Number(url.searchParams.get('page') ?? '1');const pageSize=Number(url.searchParams.get('page_size') ?? '20');return{
    listCustomers: async () => {
      const financialTotals = await repository.getCustomerFinancialTotals?.(currentUser.organization.id)
      const userList = await repository.listUsers?.({
        organizationId: currentUser.organization.id,
        url: new URL('http://api.local/api/v1/users'),
      }) ?? []
      const repositoryCustomers = await repository.listCustomers?.({
        organizationId: currentUser.organization.id,
        userId: currentUser.user.id,
        url,
      })
      const repositorySuppliers = await repository.listSuppliers?.({
        organizationId: currentUser.organization.id,
        url: new URL('http://api.local/api/v1/suppliers?page=1&page_size=10000'),
      })
      const localActivity = repository.getCustomerFinancialTotals || repositoryCustomers ? undefined : customerActivityFromSalesDocuments()
      const filteredCustomers = (repositoryCustomers ?? filterCustomers(url)).map((customer: CustomerRow) => {
        const totals = financialTotals?.get(customer.id)
        const lastActivityAt = totals?.last_activity_at ?? localActivity?.get(customer.id) ?? customer.created_at
        return {
          ...customer,
          ...customerDisplayTotals(customer, totals),
          created_by: resolveCustomerCreatedBy(customer, userList),
          last_activity_at: lastActivityAt,
        }
      })
      const sortedCustomers = sortCustomersForRequest(hydrateLinkedSuppliers(filteredCustomers, repositorySuppliers ?? suppliers), url)
      return { found: true, data: { ...paged(sortedCustomers, page, pageSize), summary: customerListSummary(sortedCustomers) } }
    },
    createCustomer: async () => {
      const body = await readJson(request) as {
        code?: string
        name?: string
        phone?: string
        tax_code?: string | null
        address?: string | null
        note?: string | null
        customer_group_id?: string | null
        customer_type?: string | null
        company_name?: string | null
      }
      const name = requiredString(body.name, 'name')
      const createdBy = { id: currentUser.user.id, name: currentUser.user.display_name }
      const created = repository.createCustomer
        ? await repository.createCustomer({
            organizationId: currentUser.organization.id,
            code: body.code,
            name,
            phone: body.phone ?? null,
            tax_code: nullableString(body.tax_code),
            address: nullableString(body.address),
            note: nullableString(body.note),
            customer_group_id: body.customer_group_id ?? null,
            customer_type: nullableString(body.customer_type),
            company_name: nullableString(body.company_name),
            created_by: createdBy,
          })
        : {
            ...customers[0],
            ...body,
            name,
            id: randomUUID(),
            code: body.code || `KH${String(customers.length + 1).padStart(6, '0')}`,
            customer_group_id: body.customer_group_id ?? null,
            created_by: createdBy,
            created_at: nowIso,
            total_sales_amount: 0,
            total_debt_amount: 0,
          }
      if (!repository.createCustomer) customers.push(created)
      return { found: true, data: created, status: 201 }
    },
    updateCustomer: async () => {
      const body = await readJson(request)
      const id = getIdFromPath(path) ?? ''
      const patch: {
        code?: string
        name?: string
        phone?: string | null
        tax_code?: string | null
        address?: string | null
        note?: string | null
        customer_group_id?: string | null
        customer_type?: string | null
        company_name?: string | null
        preferred_bill_template?: string | null
        preferred_bill_templates?: string[] | null
      } = {}
      if (body.name !== undefined) patch.name = requiredString(body.name, 'name')
      if (body.code !== undefined) patch.code = requiredString(body.code, 'code')
      if (body.phone !== undefined) patch.phone = nullableString(body.phone)
      if (body.tax_code !== undefined) patch.tax_code = nullableString(body.tax_code)
      if (body.address !== undefined) patch.address = nullableString(body.address)
      if (body.note !== undefined) patch.note = nullableString(body.note)
      if (body.customer_group_id !== undefined) patch.customer_group_id = nullableString(body.customer_group_id)
      if (body.customer_type !== undefined) patch.customer_type = nullableString(body.customer_type)
      if (body.company_name !== undefined) patch.company_name = nullableString(body.company_name)
      if ('preferred_bill_template' in body) {
        if (body.preferred_bill_template === null || body.preferred_bill_template === '') {
          patch.preferred_bill_template = null
        } else if (isBillPreferenceValue(body.preferred_bill_template)) {
          patch.preferred_bill_template = body.preferred_bill_template.trim()
        } else {
          throw httpError(400, 'VALIDATION_ERROR', 'preferred_bill_template must be a4, k80, or a template id.', {
            preferred_bill_template: ['preferred_bill_template must be a4, k80, or a template id.'],
          })
        }
      }
      if ('preferred_bill_templates' in body) {
        if (body.preferred_bill_templates === null) {
          patch.preferred_bill_templates = []
        } else if (!Array.isArray(body.preferred_bill_templates)) {
          throw httpError(400, 'VALIDATION_ERROR', 'preferred_bill_templates must be an array.', {
            preferred_bill_templates: ['preferred_bill_templates must be an array.'],
          })
        } else {
          const invalid = body.preferred_bill_templates.some((item: unknown) => !isBillPreferenceValue(item))
          if (invalid) {
            throw httpError(400, 'VALIDATION_ERROR', 'preferred_bill_templates entries must be a4, k80, or a template id.', {
              preferred_bill_templates: ['preferred_bill_templates entries must be a4, k80, or a template id.'],
            })
          }
          patch.preferred_bill_templates = body.preferred_bill_templates.map((item: unknown) => String(item).trim())
        }
      }
      if (Object.keys(patch).length === 0) {
        throw httpError(400, 'VALIDATION_ERROR', 'At least one customer field is required.')
      }
      let repositoryCustomer: CustomerListData | null | undefined
      try {
        repositoryCustomer = await repository.updateCustomer?.({
          organizationId: currentUser.organization.id,
          id,
          patch,
        })
      } catch (error) {
        if (error instanceof Error && (error as { code?: string }).code === 'WALK_IN_BILL_PREFERENCE_FORBIDDEN') {
          throw httpError(400, 'VALIDATION_ERROR', 'Walk-in customers cannot store bill template preference.')
        }
        throw error
      }
      if (repositoryCustomer) return { found: true, data: repositoryCustomer }

      const index = customers.findIndex((customer: CustomerRow) => customer.id === id)
      if (index < 0) return { found: true, data: { message: 'Customer not found' }, status: 404 }
      if (
        isWalkInCustomerCode(customers[index].code)
        && ('preferred_bill_template' in patch || 'preferred_bill_templates' in patch)
      ) {
        throw httpError(400, 'VALIDATION_ERROR', 'Walk-in customers cannot store bill template preference.')
      }
      const group = patch.customer_group_id
        ? customerGroups.find((item: GroupRow) => item.id === patch.customer_group_id) ?? null
        : null
      const billPreference = syncCustomerBillPreferencePatch({
        preferred_bill_template: patch.preferred_bill_template,
        preferred_bill_templates: patch.preferred_bill_templates,
        currentTemplate: customers[index].preferred_bill_template ?? null,
        currentTemplates: customers[index].preferred_bill_templates ?? null,
      })
      const updated = {
        ...customers[index],
        code: patch.code ?? customers[index].code,
        name: patch.name ?? customers[index].name,
        phone: patch.phone === undefined ? customers[index].phone : patch.phone,
        tax_code: patch.tax_code === undefined ? customers[index].tax_code : patch.tax_code,
        address: patch.address === undefined ? customers[index].address : patch.address,
        note: patch.note === undefined ? customers[index].note : patch.note,
        customer_group_id: patch.customer_group_id === undefined ? customers[index].customer_group_id : patch.customer_group_id,
        customer_group: patch.customer_group_id === undefined ? customers[index].customer_group : group,
        customer_type: patch.customer_type === undefined ? customers[index].customer_type : patch.customer_type,
        company_name: patch.company_name === undefined ? customers[index].company_name : patch.company_name,
        preferred_bill_template:
          patch.preferred_bill_template !== undefined || patch.preferred_bill_templates !== undefined
            ? billPreference.preferred_bill_template
            : customers[index].preferred_bill_template ?? null,
        preferred_bill_templates:
          patch.preferred_bill_template !== undefined || patch.preferred_bill_templates !== undefined
            ? billPreference.preferred_bill_templates
            : customers[index].preferred_bill_templates ?? null,
      }
      customers[index] = updated
      return { found: true, data: updated }
    },
  }}
