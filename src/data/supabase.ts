import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { catalogKinds, emptyWorkspace, type CatalogRecord, type SowingStage, type WorkspaceCommand, type WorkspaceData } from '@/domain/model'
import { normalizeConnection, type Connection } from './connection-config'

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
  runtimeConnection = normalizeConnection(config, window.location.href)
}
export function readConnection(): Connection | null {
  try { const saved=JSON.parse(localStorage.getItem(configKey)??'null'); if(saved?.mode==='demo')return null;if(saved?.url&&saved?.key) return normalizeConnection(saved) } catch { /* Ignore invalid browser preferences. */ }
  if (runtimeConnection) return runtimeConnection
  const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY
  return url&&key ? {url,key} : null
}
export function saveConnection(value: Connection | null) {
  if(!value) { localStorage.setItem(configKey,JSON.stringify({mode:'demo'})); return }
  localStorage.setItem(configKey,JSON.stringify(normalizeConnection(value)))
}
export const connect = (config:Connection) => createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
type Raw = Record<string, unknown>
const string = (value:unknown) => typeof value==='string'?value:''
const n = (value:unknown) => Number(value??0)
export async function loadWorkspace(client:SupabaseClient):Promise<WorkspaceData> {
  const tables=[...catalogKinds,'product_ingredients','profiles','user_agricultural_units','sowing_projects','project_lots','lot_subdivisions','sowing_stages']
  const entries=await Promise.all(tables.map(async table=>{
    const rows:Raw[]=[]; let offset=0
    while(true) { const {data,error}=await client.from(table).select('*').order(table==='product_ingredients'?'product_id':table==='user_agricultural_units'?'user_id':'id').range(offset,offset+499); if(error) throw new Error(`${table}: ${error.message}`);rows.push(...(data as Raw[]));if(data.length<500)break;offset+=500; if(offset>=20000)throw new Error('La consulta supera el límite de esta versión. Filtra el ámbito antes de continuar.') }
    return [table,rows] as const
  }))
  const raw=Object.fromEntries(entries)
  const d=emptyWorkspace()
  for(const kind of catalogKinds) d.catalogs[kind]=raw[kind].map(row=>({...row,id:string(row.id),name:string(row.name),active:row.active===true,...(kind==='products'?{family_id:row.product_family_id as string|null,default_dose:n(row.default_dose),ingredients:raw.product_ingredients.filter(i=>i.product_id===row.id).map(i=>({ingredient_id:string(i.active_ingredient_id),concentration:i.concentration as string|null}))}:{})})) as CatalogRecord[]
  d.projects=raw.sowing_projects.map(row=>({id:string(row.id),agricultural_unit_id:string(row.agricultural_unit_id),name:string(row.name),season:string(row.season),start_date:string(row.start_date),status:row.status as 'draft'|'active'|'closed'}))
  d.lots=raw.project_lots.map(row=>({id:string(row.id),project_id:string(row.project_id),field_id:string(row.field_id),code:string(row.code),name:string(row.name),area_ha:n(row.area_ha),infrastructure_type_id:string(row.infrastructure_type_id),active:row.active===true,field_name_snapshot:string(row.field_name),infrastructure_name_snapshot:string(row.infrastructure_type_name)}))
  d.subdivisions=raw.lot_subdivisions.map(row=>({id:string(row.id),lot_id:string(row.lot_id),name:string(row.name),area_ha:n(row.area_ha),active:row.active===true}))
  d.stages=raw.sowing_stages.map(row=>({id:string(row.id),subdivision_id:string(row.subdivision_id),stage_number:n(row.stage_number),crop_id:string(row.crop_id),variety_id:string(row.variety_id),area_ha:n(row.area_ha),planned_sowing_date:string(row.planned_sowing_date),actual_sowing_date:row.actual_sowing_date as string|null,closed_at:row.end_date as string|null,status:row.status as SowingStage['status'],crop_name_snapshot:string(row.crop_name),variety_name_snapshot:string(row.variety_name)}))
  d.profiles=raw.profiles.filter(row=>row.active).map(row=>({id:string(row.id),full_name:string(row.display_name),role:row.role==='admin'?'admin':'reader'}))
  d.assignments=raw.user_agricultural_units.map(row=>({user_id:string(row.user_id),agricultural_unit_id:string(row.agricultural_unit_id)}))
  return d
}

export async function writeCommand(client:SupabaseClient,c:WorkspaceCommand):Promise<void> {
  const rpc=async(name:string,args:Raw)=>{const {error}=await client.rpc(name,args);if(error)throw error}
  const update=async(table:string,id:string,values:Raw)=>{const {data,error}=await client.from(table).update(values).eq('id',id).select('id').single();if(error)throw error;if(!data)throw new Error('La operación no modificó ningún registro.')}
  const remove=async(table:string,id:string)=>{const {data,error}=await client.from(table).delete().eq('id',id).select('id').single();if(error)throw error;if(!data)throw new Error('No se pudo eliminar el registro.')}
  const clean=(record:object,keys:string[])=>Object.fromEntries(Object.entries(record).filter(([key,value])=>keys.includes(key)&&value!==undefined))
  switch(c.type) {
    case 'save_catalog': {
      const r=c.record
      if(c.kind==='products') {await rpc('save_product',{p_data:{...clean(r,['id','code','name','active','unit','default_dose','brand_id']),code:r.code||r.name,product_family_id:r.family_id||null,brand_id:r.brand_id||null},p_ingredients:(r.ingredients??[]).map(i=>({active_ingredient_id:i.ingredient_id,concentration:i.concentration||null}))});break}
      const values={...clean(r,['code','name','active','agricultural_unit_id','crop_id']),code:r.code||r.name}
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
