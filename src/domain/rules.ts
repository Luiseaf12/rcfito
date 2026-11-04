import type { CatalogKind, CatalogRecord, UserProfile, WorkspaceCommand, WorkspaceData } from './model'
import { applyApplicationCommand } from './applications'
import { validateCatalogEdit } from './catalogs'
import { applyLotCorrection } from './lot-corrections'

const fail = (message: string): never => { throw new Error(message) }
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value
const positive = (value:number, label:string) => { if (!Number.isFinite(value) || value <= 0) fail(`${label} debe ser mayor que cero.`) }
const uuid = () => crypto.randomUUID()
const normalized = (value:string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX')

export function scopeWorkspace(data: WorkspaceData, profile: UserProfile): WorkspaceData {
  const result = structuredClone({ ...data, applicationOrders: data.applicationOrders ?? [], applicationTargets: data.applicationTargets ?? [], applicationChanges: data.applicationChanges ?? [], sowingGroups: data.sowingGroups ?? [] })
  if (profile.role === 'admin') return result
  const allowed = new Set(result.assignments.filter(a => a.user_id === profile.id).map(a=>a.agricultural_unit_id))
  result.catalogs.agricultural_units = result.catalogs.agricultural_units.filter(a=>allowed.has(a.id))
  result.catalogs.fields = result.catalogs.fields.filter(a=>allowed.has(a.agricultural_unit_id!))
  result.projects = result.projects.filter(p=>allowed.has(p.agricultural_unit_id))
  const projects = new Set(result.projects.map(p=>p.id))
  result.lots = result.lots.filter(l=>projects.has(l.project_id))
  const lots = new Set(result.lots.map(l=>l.id))
  result.lotCorrections = (result.lotCorrections ?? []).filter(change => lots.has(change.lot_id))
  result.subdivisions = result.subdivisions.filter(s=>lots.has(s.lot_id))
  const subdivisions = new Set(result.subdivisions.map(s=>s.id))
  result.stages = result.stages.filter(s=>subdivisions.has(s.subdivision_id))
  result.applicationOrders = result.applicationOrders.filter(o => projects.has(o.project_id))
  const orders = new Set(result.applicationOrders.map(o => o.id))
  result.applicationTargets = result.applicationTargets.filter(t => orders.has(t.order_id))
  result.applicationChanges = result.applicationChanges.filter(change => orders.has(change.order_id))
  result.sowingGroups = result.sowingGroups.filter(g => projects.has(g.project_id))
  result.profiles = result.profiles.filter(p=>p.id===profile.id)
  result.assignments = result.assignments.filter(a=>a.user_id===profile.id)
  return result
}

export function applyCommand(input: WorkspaceData, command: WorkspaceCommand, profile: UserProfile): WorkspaceData {
  if (profile.role !== 'admin') fail('Tu usuario tiene acceso de consulta. Solo la administración puede guardar cambios.')
  const d = structuredClone({ ...input, applicationOrders: input.applicationOrders ?? [], applicationTargets: input.applicationTargets ?? [], applicationChanges: input.applicationChanges ?? [], sowingGroups: input.sowingGroups ?? [] })
  if (applyApplicationCommand(d, command, profile)) return d
  const catalog = (kind:CatalogKind,id:string|undefined) => d.catalogs[kind].find(row=>row.id===id)
  const requireActive = (kind:CatalogKind,id:string|undefined) => { const row=catalog(kind,id); if(!row?.active) fail('Selecciona un elemento activo del catálogo.'); return row! }
  const projectOf = (id:string) => d.projects.find(p=>p.id===id) ?? fail('No se encontró el proyecto.')
  const editable = (id:string) => { const p=projectOf(id); if(p.status==='closed') fail('El proyecto está cerrado y conserva su historial.'); return p }
  const lotOf = (id:string) => d.lots.find(l=>l.id===id) ?? fail('No se encontró el lote.')
  const subOf = (id:string) => d.subdivisions.find(s=>s.id===id) ?? fail('No se encontró la subdivisión.')
  const stageOf = (id:string) => d.stages.find(s=>s.id===id) ?? fail('No se encontró la etapa.')
  switch(command.type) {
    case 'correct_lot': applyLotCorrection(d, command.record, profile); break
    case 'save_catalog': {
      const row={...command.record, name:command.record.name.trim()} as CatalogRecord
      const errors = validateCatalogEdit(d, command.kind, row)
      const message = Object.values(errors)[0]
      if (message) fail(message)
      if (command.kind === 'products') {
        if (row.synonyms === undefined) delete row.synonyms
        else row.synonyms = row.synonyms.map(synonym => synonym.trim())
      }
      const index=d.catalogs[command.kind].findIndex(r=>r.id===row.id)
      if(index<0) d.catalogs[command.kind].push({...row,id:uuid()}); else d.catalogs[command.kind][index]={...d.catalogs[command.kind][index],...row}
      break
    }
    case 'delete_catalog': {
      const {kind,id}=command
      if (kind === 'products' && (catalog(kind, id)?.synonyms?.length ?? 0) > 0) fail('Retira los sinónimos del producto antes de eliminarlo. Los nombres alternativos conservan su referencia.')
      const referenced = kind==='agricultural_units' ? d.projects.some(p=>p.agricultural_unit_id===id)||d.catalogs.fields.some(f=>f.agricultural_unit_id===id)||d.assignments.some(a=>a.agricultural_unit_id===id)
        :kind==='fields'?d.lots.some(l=>l.field_id===id)
        :kind==='crops'?d.stages.some(s=>s.crop_id===id)||d.catalogs.varieties.some(v=>v.crop_id===id)
        :kind==='varieties'?d.stages.some(s=>s.variety_id===id)
        :kind==='infrastructure_types'?d.lots.some(l=>l.infrastructure_type_id===id)
        :kind==='brands'?d.catalogs.products.some(p=>p.brand_id===id)
        :kind==='product_families'?d.catalogs.products.some(p=>p.family_id===id)
        :kind==='ingredient_classifications'?d.catalogs.active_ingredients.some(ingredient=>ingredient.classification_id===id)
        :kind==='active_ingredients'?d.catalogs.products.some(p=>p.ingredients?.some(i=>i.ingredient_id===id))
        :kind==='products'?d.applicationOrders.some(o=>o.products.some(p=>p.product_id===id))||d.applicationTargets.some(t=>t.actual_products.some(p=>p.product_id===id))||d.applicationChanges.some(change=>[change.before,change.after].some(snapshot=>snapshot.products.some(product=>product.product_id===id)))
        :kind==='application_methods'?d.applicationOrders.some(o=>o.method_id===id)||d.applicationChanges.some(change=>[change.before,change.after].some(snapshot=>'method_id' in snapshot&&snapshot.method_id===id)):false
      if(referenced) fail('Este registro ya está relacionado. Márcalo como inactivo para conservar su historial.')
      d.catalogs[kind]=d.catalogs[kind].filter(r=>r.id!==id); break
    }
    case 'save_project': {
      const r=command.record
      if(!r.name.trim()||!r.season.trim()) fail('Nombre y temporada son obligatorios.')
      requireActive('agricultural_units',r.agricultural_unit_id)
      if(d.projects.some(p=>p.id!==r.id&&p.agricultural_unit_id===r.agricultural_unit_id&&normalized(p.season)===normalized(r.season))) fail('Ya existe un proyecto de esa temporada para esta agrícola.')
      if(d.projects.some(p=>p.id!==r.id&&p.agricultural_unit_id===r.agricultural_unit_id&&p.status!=='closed')) fail('Esta agrícola ya tiene una temporada abierta. Ciérrala antes de capturar la siguiente.')
      if(r.id) { const existing=editable(r.id); if(existing.agricultural_unit_id!==r.agricultural_unit_id) fail('La agrícola del proyecto no se puede cambiar.'); Object.assign(existing,{name:r.name.trim(),season:r.season.trim()}) }
      else d.projects.push({...r,id:uuid(),name:r.name.trim(),season:r.season.trim(),status:'draft'})
      break
    }
    case 'activate_project': { const p=editable(command.id); p.status='active'; break }
    case 'close_project': {
      const p=editable(command.id); const lotIds=d.lots.filter(l=>l.project_id===p.id).map(l=>l.id); const subIds=d.subdivisions.filter(s=>lotIds.includes(s.lot_id)).map(s=>s.id)
      const orders = new Set(d.applicationOrders.filter(o => o.project_id === p.id).map(o => o.id))
      if (d.applicationTargets.some(t => orders.has(t.order_id) && t.status === 'indicated')) fail('Cancela o realiza las aplicaciones indicadas antes de cerrar la temporada.')
      if(d.stages.some(s=>subIds.includes(s.subdivision_id)&&s.status!=='closed')) fail('Cierra las etapas sembradas y retira las planeaciones pendientes antes de cerrar la temporada.')
      p.status='closed'; break
    }
    case 'copy_project': {
      const p=projectOf(command.id)
      if(p.status!=='closed') fail('Solo puedes copiar un proyecto cerrado.')
      if(d.projects.some(x=>x.agricultural_unit_id===p.agricultural_unit_id&&x.status!=='closed')) fail('Esta agrícola ya tiene una temporada abierta.')
      if(!command.name.trim()||!command.season.trim()) fail('Nombre y temporada son obligatorios.')
      if(d.projects.some(x=>x.agricultural_unit_id===p.agricultural_unit_id&&normalized(x.season)===normalized(command.season))) fail('Ya existe un proyecto de esa temporada para esta agrícola.')
      const newId=uuid(); d.projects.push({...p,id:newId,name:command.name.trim(),season:command.season.trim(),start_date:command.start_date,status:'draft'})
      for(const lot of [...d.lots].filter(l=>l.project_id===p.id&&l.active!==false)) { const lotId=uuid(); d.lots.push({...lot,id:lotId,project_id:newId,correction_version:0}); for(const sub of [...d.subdivisions].filter(s=>s.lot_id===lot.id&&s.active)) d.subdivisions.push({...sub,id:uuid(),lot_id:lotId}) }
      break
    }
    case 'save_lot': {
      const r=command.record; const p=editable(r.project_id); const f=requireActive('fields',r.field_id)
      if(f.agricultural_unit_id!==p.agricultural_unit_id) fail('El campo debe pertenecer a la agrícola del proyecto.')
      const infra=requireActive('infrastructure_types',r.infrastructure_type_id); positive(r.area_ha,'La superficie')
      if(!r.name.trim()) fail('El nombre del lote es obligatorio.')
      if(d.lots.some(l=>l.project_id===r.project_id&&l.id!==r.id&&normalized(l.name)===normalized(r.name))) fail('Ya existe un lote con ese nombre en el proyecto.')
      if(r.id) { const l=lotOf(r.id); if(l.project_id!==r.project_id) fail('El lote no puede cambiar de proyecto.'); const subs=d.subdivisions.filter(s=>s.lot_id===l.id); if(d.stages.some(s=>subs.some(sub=>sub.id===s.subdivision_id))) fail('Un lote con siembras conserva su configuración histórica.'); Object.assign(l,r,{field_name_snapshot:f.name,infrastructure_name_snapshot:infra.name}); if(subs.length===1) subs[0].area_ha=r.area_ha; else if(subs.filter(s=>s.active).reduce((sum,s)=>sum+s.area_ha,0)>r.area_ha) fail('La superficie no puede ser menor que las subdivisiones vigentes.') }
      else { const id=uuid(); d.lots.push({...r,id,field_name_snapshot:f.name,infrastructure_name_snapshot:infra.name}); d.subdivisions.push({id:uuid(),lot_id:id,name:'Superficie completa',area_ha:r.area_ha,active:true}) }
      break
    }
    case 'delete_lot': { const l=lotOf(command.id); editable(l.project_id); const ids=d.subdivisions.filter(s=>s.lot_id===l.id).map(s=>s.id); if(d.stages.some(s=>ids.includes(s.subdivision_id))) fail('El lote tiene historial de siembras y no se puede eliminar.'); d.subdivisions=d.subdivisions.filter(s=>s.lot_id!==l.id); d.lots=d.lots.filter(x=>x.id!==l.id); break }
    case 'replace_subdivisions': {
      const l=lotOf(command.lot_id); editable(l.project_id); const old=d.subdivisions.filter(s=>s.lot_id===l.id&&s.active)
      if(d.stages.some(s=>old.some(o=>o.id===s.subdivision_id)&&s.status!=='closed')) fail('Cierra las etapas y retira las planeaciones antes de redistribuir el lote.')
      if(!command.subdivisions.length) fail('Debe existir al menos una subdivisión.')
      if(new Set(command.subdivisions.map(s=>normalized(s.name))).size!==command.subdivisions.length) fail('Los nombres de subdivisión no pueden repetirse.')
      let sum=0; for(const s of command.subdivisions){ if(!s.name.trim()) fail('El nombre de cada subdivisión es obligatorio.'); positive(s.area_ha,'La superficie'); sum+=s.area_ha }
      if(sum>l.area_ha+0.000001) fail('La suma de subdivisiones supera la superficie del lote.')
      old.forEach(s=>s.active=false); command.subdivisions.forEach(s=>d.subdivisions.push({...s,id:uuid(),lot_id:l.id,active:true})); break
    }
    case 'save_stage': {
      const r=command.record; const sub=subOf(r.subdivision_id); const lot=lotOf(sub.lot_id); editable(lot.project_id)
      if(!sub.active) fail('La subdivisión ya no está vigente.')
      const crop=requireActive('crops',r.crop_id), variety=requireActive('varieties',r.variety_id)
      if(variety.crop_id!==crop.id) fail('La variedad no pertenece al cultivo seleccionado.')
      positive(r.area_ha,'La superficie sembrada'); if(r.area_ha>sub.area_ha) fail('La superficie sembrada supera la subdivisión.')
      if(!validDate(r.planned_sowing_date)) fail('La fecha planeada no es válida.')
      if(r.id&&d.stages.some(s=>s.id===r.id)) { const existing=stageOf(r.id); if(existing.status!=='planned') fail('Solo se puede editar una etapa planeada.'); if(existing.subdivision_id!==sub.id) fail('La etapa no puede cambiar de subdivisión.'); Object.assign(existing,r,{crop_name_snapshot:crop.name,variety_name_snapshot:variety.name}) }
      else { const n=Math.max(0,...d.stages.filter(s=>s.subdivision_id===sub.id).map(s=>s.stage_number))+1; d.stages.push({...r,id:r.id??uuid(),stage_number:n,status:'planned',actual_sowing_date:null,closed_at:null,crop_name_snapshot:crop.name,variety_name_snapshot:variety.name}) }
      break
    }
    case 'plant_stage': {
      const s=stageOf(command.id), sub=subOf(s.subdivision_id); const p=editable(lotOf(sub.lot_id).project_id)
      if(p.status!=='active') fail('Activa el proyecto antes de registrar una siembra real.')
      if(s.status!=='planned') fail('La etapa ya fue sembrada o cerrada.')
      if(d.stages.some(x=>x.subdivision_id===sub.id&&x.stage_number<s.stage_number&&x.status!=='closed')) fail('Cierra la etapa anterior antes de sembrar la siguiente.')
      if(!validDate(command.actual_sowing_date)) fail('La fecha real no es válida.')
      const previous=d.stages.filter(x=>x.subdivision_id===sub.id&&x.stage_number<s.stage_number).sort((a,b)=>b.stage_number-a.stage_number)[0]
      if(previous?.closed_at && command.actual_sowing_date<previous.closed_at) fail('La fecha real no puede ser anterior al cierre de la etapa previa.')
      s.status='planted';s.actual_sowing_date=command.actual_sowing_date; break
    }
    case 'close_stage': {
      const s=stageOf(command.id);editable(lotOf(subOf(s.subdivision_id).lot_id).project_id)
      if(s.status!=='planted') fail('Solo se cierra una etapa sembrada; retira una planeación si no se realizará.')
      if(d.applicationTargets.some(t=>t.stage_id===s.id&&t.status==='indicated')) fail('Cancela o realiza las aplicaciones indicadas antes de cerrar la etapa.')
      const lastDate=d.applicationTargets.filter(t=>t.stage_id===s.id&&t.status==='performed').map(t=>t.actual_date!).sort().at(-1)
      if(!validDate(command.closed_at)||command.closed_at<s.actual_sowing_date!||lastDate&&command.closed_at<lastDate) fail('La fecha de cierre debe ser igual o posterior a la siembra y a su última aplicación realizada.')
      s.status='closed';s.closed_at=command.closed_at;break
    }
    case 'discard_stage': { const s=stageOf(command.id);editable(lotOf(subOf(s.subdivision_id).lot_id).project_id);if(s.status!=='planned') fail('Solo se retira una etapa planeada.'); if(d.stages.some(x=>x.subdivision_id===s.subdivision_id&&x.stage_number>s.stage_number)) fail('Retira primero la última etapa planeada.');d.stages=d.stages.filter(x=>x.id!==s.id);break }
    case 'set_user_access': { const p=d.profiles.find(x=>x.id===command.user_id)??fail('No se encontró el usuario.'); if(p.id===profile.id&&command.role!=='admin') fail('No puedes retirar tu propio acceso de administrador.'); if(command.agricultural_unit_ids.some(id=>!catalog('agricultural_units',id))) fail('Selecciona agrícolas válidas.');p.role=command.role;d.assignments=d.assignments.filter(a=>a.user_id!==p.id).concat(command.agricultural_unit_ids.map(id=>({user_id:p.id,agricultural_unit_id:id})));break }
  }
  return d
}
