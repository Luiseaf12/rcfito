import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'
import { reconcileApplicationHistory } from '../src/data/application-history.ts'

function fixture() {
  let data=createDemoData()
  const profile=data.profiles.find(item=>item.id===DEMO_ADMIN_ID)!
  data=applyCommand(data,{type:'create_application_order',record:{id:'history-order',project_id:'project-ensenada',field_id:'field-norte',crop_id:'crop-pepino',method_id:'method-dron',indicated_date:'2026-10-10',scheduled_date:'2026-10-11',water_l_ha:660,observations:'Nota ficticia',stage_ids:['stage-1'],products:[{product_id:'product-a',dose:500}]}},profile)
  const targetId=data.applicationTargets[0].id
  data=applyCommand(data,{type:'revise_application_order',record:{id:'history-revision',order_id:'history-order',expected_revision:0,target_ids:[targetId],method_id:'method-dron',indicated_date:'2026-10-10',scheduled_date:'2026-10-12',water_l_ha:700,observations:'Nueva nota ficticia',reason:'Corrección ficticia',products:[{product_id:'product-a',dose:600}]}},profile)
  return {data,profile,targetId}
}

test('una lectura coherente conserva su revisión y rechaza orden o pointer de otra lectura',()=>{
  const {data}=fixture()
  assert.doesNotThrow(()=>reconcileApplicationHistory(data))
  const oldOrder=structuredClone(data);oldOrder.applicationOrders[0].revision=0
  assert.throws(()=>reconcileApplicationHistory(oldOrder),/no coinciden/)
  const oldPointer=structuredClone(data);oldPointer.applicationTargets[0].indication_change_id=null
  assert.throws(()=>reconcileApplicationHistory(oldPointer),/cambió durante la consulta/)
  const lostEvent=structuredClone(data);lostEvent.applicationChanges=[]
  assert.throws(()=>reconcileApplicationHistory(lostEvent),/historial/)
})

test('una corrección se hidrata desde el evento de su versión aunque la mezcla REST llegue anterior',()=>{
  let {data,profile,targetId}=fixture()
  data=applyCommand(data,{type:'perform_application_targets',order_id:'history-order',target_ids:[targetId],data:{expected_revision:1,changed:false,actual_date:'2026-10-13',equipment:'',applicator:'',observations:''}},profile)
  data=applyCommand(data,{type:'correct_application_target',record:{id:'history-correction',target_id:targetId,expected_version:0,actual_date:'2026-10-14',water_l_ha:800,equipment:'Equipo ficticio',applicator:'',observations:'Corregida',reason:'Motivo ficticio',products:[{product_id:'product-b',dose:250}]}},profile)
  data.applicationTargets[0].actual_products=[];data.applicationTargets[0].actual_water_l_ha=660
  reconcileApplicationHistory(data)
  assert.equal(data.applicationTargets[0].actual_date,'2026-10-14')
  assert.equal(data.applicationTargets[0].actual_water_l_ha,800)
  assert.equal(data.applicationTargets[0].actual_products[0].product_id,'product-b')
  const missing=structuredClone(data);missing.applicationChanges=missing.applicationChanges.filter(change=>change.kind!=='performance')
  assert.throws(()=>reconcileApplicationHistory(missing),/cambió durante la consulta/)
})

test('el lector no recibe historial de otra agrícola ni puede modificarlo',()=>{
  const {data}=fixture()
  const reader={id:'reader-unassigned',full_name:'Lector ficticio',role:'reader' as const}
  const scoped=scopeWorkspace(data,reader)
  assert.equal(scoped.applicationOrders.length,0)
  assert.equal(scoped.applicationChanges.length,0)
  assert.throws(()=>applyCommand(data,{type:'correct_application_target',record:{id:'attempt',target_id:data.applicationTargets[0].id,expected_version:0,actual_date:'2026-10-14',water_l_ha:1,equipment:'',applicator:'',observations:'',reason:'Motivo',products:[{product_id:'product-a',dose:1}]}},reader),/consulta/)
})
