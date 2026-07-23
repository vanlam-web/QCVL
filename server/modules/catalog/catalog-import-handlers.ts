import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
import { applyKiotVietCustomerImport, mapKiotVietCustomerRows, previewKiotVietCustomerImport, type CustomerImportRepository } from './customer-import.js'
import { applyKiotVietProductImport, mapKiotVietProductRows, previewKiotVietProductImport, type ProductImportRepository } from './product-import.js'

type JsonBody=Record<string,unknown>; type ReadJson=(request:Request)=>Promise<JsonBody>; type RowsFromBody=(body:JsonBody)=>unknown[]
type CustomerImportAdapter = CustomerImportRepository & { deleteImportedKiotVietCustomers?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }> }
interface Context { request:Request; currentUser:CurrentUserData; repository:ServerRepository; readJson:ReadJson; productRowsFromBody:RowsFromBody; customerRowsFromBody:RowsFromBody; productRepository:ProductImportRepository; customerRepository:CustomerImportAdapter }
export function createCatalogImportHandlers(c:Context){const {request,currentUser,repository,readJson,productRowsFromBody,customerRowsFromBody,productRepository,customerRepository}=c;const organizationId=currentUser.organization.id;return {
previewKiotVietProductImport:async():RouteResult=>{const b=await readJson(request),m=mapKiotVietProductRows(productRowsFromBody(b) as never[]);return{found:true,data:await previewKiotVietProductImport({organizationId,repository:productRepository,rows:m.valid,invalidRows:m.invalid,cleanupDemo:Boolean(b.cleanup_demo)})}},
importKiotVietProducts:async():RouteResult=>{const b=await readJson(request),m=mapKiotVietProductRows(productRowsFromBody(b) as never[]);return{found:true,data:await applyKiotVietProductImport({organizationId,repository:productRepository,rows:m.valid,invalidRows:m.invalid,cleanupDemo:Boolean(b.cleanup_demo)})}},
deleteImportedKiotVietProducts:async():RouteResult=>{const r=await repository.deleteImportedKiotVietProducts?.({organizationId})??{deleted:0,blocked:0};return{found:true,data:{deleted_rows:r.deleted,blocked_rows:r.blocked}}},
previewKiotVietCustomerImport:async():RouteResult=>{const b=await readJson(request),m=mapKiotVietCustomerRows(customerRowsFromBody(b) as never[]);return{found:true,data:await previewKiotVietCustomerImport({organizationId,repository:customerRepository,rows:m.valid,invalidRows:m.invalid})}},
importKiotVietCustomers:async():RouteResult=>{const b=await readJson(request),m=mapKiotVietCustomerRows(customerRowsFromBody(b) as never[]);return{found:true,data:await applyKiotVietCustomerImport({organizationId,repository:customerRepository,rows:m.valid,invalidRows:m.invalid})}},
deleteImportedKiotVietCustomers:async():RouteResult=>{const r=await customerRepository.deleteImportedKiotVietCustomers?.({organizationId})??{deleted:0,blocked:0};return{found:true,data:{deleted_rows:r.deleted,blocked_rows:r.blocked}}},
}}
