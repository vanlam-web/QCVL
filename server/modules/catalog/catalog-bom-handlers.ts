import { randomUUID } from 'node:crypto'
import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'
interface Dependencies { request:Request; currentUser:CurrentUserData; repository:ServerRepository; path:string; readJson:(request:Request)=>Promise<Record<string,unknown>>; nowIso:string; notFound:(message:string)=>Error }
export function createCatalogBomHandlers(d:Dependencies):{getProductBom:()=>RouteResult;upsertProductBom:()=>RouteResult}{return {
 getProductBom:async()=>{const productId=d.path.split('/')[4],data=await d.repository.getProductBom?.({organizationId:d.currentUser.organization.id,productId})??null;return {found:true,data}},
 upsertProductBom:async()=>{const productId=d.path.split('/')[4],body=await d.readJson(d.request) as {notes?:string|null;items?:Array<{component_product_id:string;quantity:number;notes?:string|null}>};if(!d.repository.upsertProductBom)return {found:true,data:{id:randomUUID(),product_id:productId,version:1,status:'active' as const,notes:body.notes??null,created_at:d.nowIso,items:[]}};const data=await d.repository.upsertProductBom({organizationId:d.currentUser.organization.id,productId,notes:body.notes??null,items:Array.isArray(body.items)?body.items:[]});if(!data)throw d.notFound('Product not found');return {found:true,data}},
}}
