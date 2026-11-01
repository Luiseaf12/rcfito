import { loadCatalogProductUsage } from './catalog-usage'
import { reconcileApplicationHistory } from './application-history'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { catalogKinds, emptyWorkspace, type ApplicationChange, type CatalogRecord, type ProductLine, type SowingStage, type WorkspaceCommand, type WorkspaceData } from '@/domain/model'
import { connectionSessionKey, migrateManagedSession, normalizeConnection, resolveConnection, storedConnection, type Connection } from './connection-config'

export type { Connection } from './connection-config'
const configKey = 'rcfito.supabase.v1'
let runtimeConnection: Connection | null = null
export async function loadRuntimeConnection(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}rcfito-config.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo consultar la conexión de esta instalación.')
  const config = await response.json()
  if (config.mode === 'demo') { runtimeConnection = null; return }
  if (config.mode !== 'supabase' || typeof config.url !== 'string' || typeof config.key !== 'string') {
    throw new Error('La configuración de esta instalación está incompleta.')
  }
  const next = normalizeConnection(config, window.location.href)
  if (next.managed && (new URL(next.url).origin !== window.location.origin || new URL(next.url).pathname !== '/supabase')) {
    throw new Error('La conexión gestionada debe usar el proxy /supabase de esta instalación.')
  }
  runtimeConnection = next
}
export function readConnection(): Connection | null {
  let saved: unknown = null
  try { saved = JSON.parse(localStorage.getItem(configKey) ?? 'null') } catch { /* Ignore invalid browser preferences. */ }
  const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY
  const connection = resolveConnection(saved, runtimeConnection, storedConnection(url && key ? { url, key } : null))
  if (connection?.managed) {
    try {
      migrateManagedSession(localStorage, storedConnection(saved), connection)
      localStorage.setItem(configKey, JSON.stringify(connection))
    } catch { /* A blocked store does not change the selected server. */ }
  }
  return connection
}
export function saveConnection(value: Connection | null): Connection | null {
  if(!value) { localStorage.setItem(configKey,JSON.stringify({mode:'demo'})); return null }
  const previous = normalizeConnection(value)
  const connection = resolveConnection(previous, runtimeConnection)!
  migrateManagedSession(localStorage, previous, connection)
  localStorage.setItem(configKey,JSON.stringify(connection))
  return connection
}
export const connect = (config:Connection) => createClient(config.url,config.key,{auth:{storageKey:connectionSessionKey(config),persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
type Raw = Record<string, unknown>
const string = (value:unknown) => typeof value==='string'?value:''
const n = (value:unknown) => Number(value??0)
export async function loadWorkspace(client:SupabaseClient, attempt=0):Promise<WorkspaceData> {
  const tables=[...catalogKinds,'product_ingredients','product_synonyms','profiles','user_agricultural_units','sowing_projects','project_lots','lot_subdivisions','sowing_stages','application_orders','application_order_products','application_targets','application_actual_products','application_changes','sowing_groups','sowing_group_members']
  const relationKeys: Record<string, string[]> = { product_ingredients:['product_id','active_ingredient_id'],user_agricultural_units:['user_id','agricultural_unit_id'],application_order_products:['order_id','product_id'],application_actual_products:['target_id','product_id'],sowing_group_members:['group_id','stage_id'] }
  const entries=await Promise.all(tables.map(async table=>{
    const rows:Raw[]=[]; let offset=0
    while(true) {
      const columns=table==='application_changes'?'id,order_id,target_id,kind,version,target_ids,reason,changed_by,changed_by_name,changed_at,before,after':'*'
      let query=client.from(table).select(columns).returns<Raw[]>()
      for(const key of relationKeys[table]??['id']) query=query.order(key)
      const {data,error}=await query.range(offset,offset+499)
      if(error) throw new Error(`${table}: ${error.message}`)
      rows.push(...(data as Raw[]));if(data.length<500)break;offset+=500
      if(offset>=20000)throw new Error('La consulta supera el límite de esta versión. Filtra el ámbito antes de continuar.')
    }
    return [table,rows] as const
  }))
  const raw=Object.fromEntries(entries)
  const d=emptyWorkspace()
  for(const kind of catalogKinds) d.catalogs[kind]=raw[kind].map(row=>({...row,id:string(row.id),name:string(row.name),active:row.active===true,...(kind==='products'?{family_id:row.product_family_id as string|null,default_dose:n(row.default_dose),synonyms:raw.product_synonyms.filter(s=>s.product_id===row.id).map(s=>string(s.name)),ingredients:raw.product_ingredients.filter(i=>i.product_id===row.id).map(i=>({ingredient_id:string(i.active_ingredient_id),concentration:i.concentration as string|null}))}:{})})) as CatalogRecord[]
  d.projects=raw.sowing_projects.map(row=>({id:string(row.id),agricultural_unit_id:string(row.agricultural_unit_id),name:string(row.name),season:string(row.season),start_date:string(row.start_date),status:row.status as 'draft'|'active'|'closed'}))
  d.lots=raw.project_lots.map(row=>({id:string(row.id),project_id:string(row.project_id),field_id:string(row.field_id),code:string(row.code),name:string(row.name),area_ha:n(row.area_ha),infrastructure_type_id:string(row.infrastructure_type_id),active:row.active===true,field_name_snapshot:string(row.field_name),infrastructure_name_snapshot:string(row.infrastructure_type_name)}))
  d.subdivisions=raw.lot_subdivisions.map(row=>({id:string(row.id),lot_id:string(row.lot_id),name:string(row.name),area_ha:n(row.area_ha),active:row.active===true}))
  d.stages=raw.sowing_stages.map(row=>({id:string(row.id),subdivision_id:string(row.subdivision_id),stage_number:n(row.stage_number),crop_id:string(row.crop_id),variety_id:string(row.variety_id),area_ha:n(row.area_ha),planned_sowing_date:string(row.planned_sowing_date),actual_sowing_date:row.actual_sowing_date as string|null,closed_at:row.end_date as string|null,status:row.status as SowingStage['status'],crop_name_snapshot:string(row.crop_name),variety_name_snapshot:string(row.variety_name)}))
  d.profiles=raw.profiles.filter(row=>row.active).map(row=>({id:string(row.id),full_name:string(row.display_name),role:row.role==='admin'?'admin':'reader'}))
  d.assignments=raw.user_agricultural_units.map(row=>({user_id:string(row.user_id),agricultural_unit_id:string(row.agricultural_unit_id)}))
  const productLine=(row:Raw):ProductLine=>({product_id:string(row.product_id),dose:n(row.dose),product_name:string(row.product_name),unit:row.unit as ProductLine['unit']})
  d.applicationOrders=raw.application_orders.map(row=>({id:string(row.id),folio:string(row.folio),project_id:string(row.project_id),field_id:string(row.field_id),crop_id:string(row.crop_id),method_id:string(row.method_id),indicated_date:string(row.indicated_date),scheduled_date:string(row.scheduled_date),water_l_ha:n(row.water_l_ha),observations:string(row.observations),source_text:string(row.source_text),revision:n(row.revision),application_number:typeof (row.request_signature as Raw | null)?.application_number==='number'?n((row.request_signature as Raw).application_number):undefined,project_name:string(row.project_name),field_name:string(row.field_name),crop_name:string(row.crop_name),method_name:string(row.method_name),products:raw.application_order_products.filter(p=>p.order_id===row.id).map(productLine)}))
  d.applicationTargets=raw.application_targets.map(row=>({id:string(row.id),order_id:string(row.order_id),stage_id:string(row.stage_id),application_number:row.application_number==null?undefined:n(row.application_number),status:row.status as 'indicated'|'performed'|'cancelled',lot_name:string(row.lot_name),subdivision_name:string(row.subdivision_name),stage_number:n(row.stage_number),crop_name:string(row.crop_name),variety_name:string(row.variety_name),area_ha:n(row.area_ha),actual_date:row.actual_date as string|null,actual_water_l_ha:row.actual_water_l_ha==null?null:n(row.actual_water_l_ha),actual_products:raw.application_actual_products.filter(p=>p.target_id===row.id).map(productLine),equipment:string(row.equipment),applicator:string(row.applicator),actual_observations:string(row.actual_observations),cancellation_reason:string(row.cancellation_reason),has_changes:row.has_changes===true,indication_change_id:row.indication_change_id?string(row.indication_change_id):null,correction_version:n(row.correction_version)}))
  d.applicationChanges=raw.application_changes.map(row=>({id:string(row.id),order_id:string(row.order_id),target_id:row.target_id?string(row.target_id):null,kind:row.kind as ApplicationChange['kind'],version:n(row.version),target_ids:Array.isArray(row.target_ids)?row.target_ids.map(string):[],reason:string(row.reason),changed_by:string(row.changed_by),changed_by_name:string(row.changed_by_name),changed_at:string(row.changed_at),before:row.before as ApplicationChange['before'],after:row.after as ApplicationChange['after']}))
  try { reconcileApplicationHistory(d) } catch(cause) { if(attempt<1)return loadWorkspace(client,attempt+1);throw cause }
  d.sowingGroups=raw.sowing_groups.map(row=>({id:string(row.id),project_id:string(row.project_id),field_id:string(row.field_id),crop_id:string(row.crop_id),name:string(row.name),active:row.active===true,stage_ids:raw.sowing_group_members.filter(m=>m.group_id===row.id&&m.active!==false).map(m=>string(m.stage_id)),historical_stage_ids:raw.sowing_group_members.filter(m=>m.group_id===row.id&&m.active===false).map(m=>string(m.stage_id))}))
  const usedProducts = await loadCatalogProductUsage(client)
  d.catalogs.products.forEach(product => { product.unit_locked = usedProducts.has(product.id) })
  return d
}

export async function writeCommand(client:SupabaseClient,c:WorkspaceCommand):Promise<void> {
  const rpc=async(name:string,args:Raw)=>{const {error}=await client.rpc(name,args);if(error)throw error}
  const update=async(table:string,id:string,values:Raw)=>{const {data,error}=await client.from(table).update(values).eq('id',id).select('id').single();if(error)throw error;if(!data)throw new Error('La operación no modificó ningún registro.')}
  const remove=async(table:string,id:string)=>{const {data,error}=await client.from(table).delete().eq('id',id).select('id').single();if(error)throw error;if(!data)throw new Error('No se pudo eliminar el registro.')}
  const clean=(record:object,keys:string[])=>Object.fromEntries(Object.entries(record).filter(([key,value])=>keys.includes(key)&&value!==undefined))
  switch(c.type) {
    case 'revise_application_order':
    case 'correct_application_target': {
      const {products,...values}=c.record
      await rpc(c.type,{p_data:values,p_products:products});break
    }
    case 'create_application_order': {
      const {stage_ids,products,...values}=c.record
      await rpc('create_application_order',{p_data:values,p_stage_ids:stage_ids,p_products:products});break
    }
    case 'perform_application_targets':await rpc('perform_application_targets',{p_order_id:c.order_id,p_target_ids:c.target_ids,p_data:c.data});break
    case 'cancel_application_targets':await rpc('cancel_application_targets',{p_order_id:c.order_id,p_target_ids:c.target_ids,p_reason:c.reason});break
    case 'save_sowing_group': {
      const {stage_ids,...values}=c.record
      await rpc('save_sowing_group',{p_data:values,p_stage_ids:stage_ids});break
    }
    case 'save_catalog': {
      const r=c.record
      if(c.kind==='products') {await rpc('save_product',{p_data:{...clean(r,['id','code','name','active','unit','default_dose','brand_id','synonyms']),code:r.code||r.name,product_family_id:r.family_id||null,brand_id:r.brand_id||null},p_ingredients:(r.ingredients??[]).map(i=>({active_ingredient_id:i.ingredient_id,concentration:i.concentration||null}))});break}
      const values={...clean(r,['code','name','active','agricultural_unit_id','crop_id','classification_id']),code:r.code||r.name}
      if(r.id)await update(c.kind,r.id,values);else {const {error}=await client.from(c.kind).insert(values);if(error)throw error}break
    }
    case 'delete_catalog': await remove(c.kind,c.id); break
    case 'save_project': if(c.record.id) await update('sowing_projects',c.record.id,clean(c.record,['name','season','start_date']));else await rpc('create_sowing_project',{p_data:c.record});break
    case 'activate_project':await update('sowing_projects',c.id,{status:'active'});break
    case 'close_project':await rpc('close_sowing_project',{p_project_id:c.id});break
    case 'copy_project':await rpc('copy_sowing_project',{p_source_project_id:c.id,p_data:{name:c.name,season:c.season,start_date:c.start_date}});break
    case 'save_lot': {const values={...clean(c.record,['project_id','field_id','name','code','area_ha','infrastructure_type_id']),code:c.record.code||c.record.name};if(c.record.id)await update('project_lots',c.record.id,values);else await rpc('create_project_lot',{p_data:values});break}
    case 'delete_lot':await rpc('delete_project_lot',{p_lot_id:c.id});break
    case 'replace_subdivisions':await rpc('replace_lot_subdivisions',{p_lot_id:c.lot_id,p_subdivisions:c.subdivisions.map((s,i)=>({...s,code:`S${i+1}`}))});break
    case 'save_stage':await rpc('save_sowing_stage',{p_data:clean(c.record,['id','subdivision_id','crop_id','variety_id','area_ha','planned_sowing_date'])});break
    case 'plant_stage':await rpc('transition_sowing_stage',{p_stage_id:c.id,p_status:'planted',p_date:c.actual_sowing_date});break
    case 'close_stage':await rpc('transition_sowing_stage',{p_stage_id:c.id,p_status:'closed',p_date:c.closed_at});break
    case 'discard_stage':await rpc('discard_planned_stage',{p_stage_id:c.id});break
    case 'set_user_access':await rpc('set_user_access',{p_user_id:c.user_id,p_role:c.role==='admin'?'admin':'viewer',p_active:true,p_agricultural_unit_ids:c.agricultural_unit_ids});break
  }
}
