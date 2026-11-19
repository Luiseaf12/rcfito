import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand } from '../src/domain/rules'
import { createDemoData } from '../src/domain/demo'
import { completeInheritedWorkspace, productClassifications, classificationText } from '../src/domain/inherited-classifications'
import { buildProductUsage } from '../src/domain/product-usage'
import { validateCatalogEdit } from '../src/domain/catalogs'

function withApplication() {
 const data=createDemoData()
 return applyCommand(data,{type:'create_application_order',record:{id:crypto.randomUUID(),project_id:'project-ensenada',field_id:'field-norte',crop_id:'crop-pepino',method_id:'method-dron',indicated_date:'2026-11-18',scheduled_date:'2026-11-19',water_l_ha:100,observations:'Prueba',stage_ids:['stage-1'],products:[{product_id:'product-a',dose:5}]}},data.profiles[0])
}

test('herencia única de ingredientes, duplicados, inactivos e incompletos', () => {
  const data=createDemoData(), product=data.catalogs.products[0]
  data.catalogs.ingredient_classifications=[{id:'c1',name:'Insecticida',active:true},{id:'c2',name:'Acaricida',active:false}]
  for(const ingredient of data.catalogs.active_ingredients) { ingredient.classification_ids=['c1','c2'];ingredient.classification_id='c1' }
  product.ingredients=data.catalogs.active_ingredients.map(item=>({ingredient_id:item.id,concentration:null}))
  product.classification_ids=['obsolete-product-only']
  const snapshot=productClassifications(data,product,'recorded','2026-11-19T12:00:00Z')
  assert.deepEqual(snapshot.classifications.map(item=>item.id),['c1','c2'])
  assert.equal(snapshot.complete,true)
  assert.equal(productClassifications(data,{...product,ingredients:[]}).complete,false)
  assert.ok(validateCatalogEdit(data,'products',product).classification_ids)
})
test('demo reconstruye una sola vez, borra campos propios y conserva etiquetas históricas', () => {
  const input=withApplication(), pid=input.catalogs.products[0].id
  input.catalogs.products[0].classification_ids=['obsolete']
  const data=completeInheritedWorkspace(input)
  assert.equal(data.catalogs.products[0].classification_ids,undefined)
  const line=data.applicationOrders.flatMap(order=>order.products).find(item=>item.product_id===pid)
  assert.ok(line?.classification_snapshot)
  assert.equal(line.classification_snapshot.origin,'reconstructed')
  assert.match(classificationText(line.classification_snapshot),/Reconstruida/)
  const before=structuredClone(line.classification_snapshot)
  for(const item of data.catalogs.ingredient_classifications)item.name='Catálogo cambiado'
  assert.deepEqual(completeInheritedWorkspace(data).applicationOrders.flatMap(order=>order.products).find(item=>item.product_id===pid)?.classification_snapshot,before)
  assert.deepEqual(input.applicationOrders.map(item=>item.folio),data.applicationOrders.map(item=>item.folio))
})
test('filtro histórico no duplica cantidades ni depende del catálogo actual', () => {
  const data=completeInheritedWorkspace(withApplication())
  const base=buildProductUsage(data)
  const record=base.products.find(item=>item.history.length)
  assert.ok(record)
  for(const order of data.applicationOrders)for(const line of order.products)if(line.product_id===record.productId)line.classification_snapshot!.classifications=[{id:'c1',name:'Uno'},{id:'c2',name:'Dos'}]
  for(const target of data.applicationTargets)for(const line of target.actual_products)if(line.product_id===record.productId)line.classification_snapshot!.classifications=[{id:'c1',name:'Uno'},{id:'c2',name:'Dos'}]
  for(const change of data.applicationChanges)for(const snapshot of [change.before,change.after])for(const line of snapshot.products)if(line.product_id===record.productId)line.classification_snapshot!.classifications=[{id:'c1',name:'Uno'},{id:'c2',name:'Dos'}]
  const a=buildProductUsage(data,{classificationId:'c1'}),b=buildProductUsage(data,{classificationId:'c2'})
  assert.deepEqual(a.products.map(item=>item.totalQuantity),b.products.map(item=>item.totalQuantity))
  assert.equal(a.products.find(item=>item.productId===record.productId)?.totalQuantity,record.totalQuantity)
  assert.equal(buildProductUsage(data,{classificationId:'absent'}).products.length,0)
})
