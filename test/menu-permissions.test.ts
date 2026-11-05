import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canViewMenu, effectiveMenus, firstAllowedPath, menuDefinitions, menuForPath, menuTemplates, normalizeMenus, readerMenus } from '../src/domain/menu-permissions.ts'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'

test('la navegación comparte claves únicas y resuelve detalles, alias y catálogos exactos',()=>{
  assert.equal(new Set(menuDefinitions.map(menu=>menu.key)).size,menuDefinitions.length)
  assert.equal(menuForPath('/aplicaciones/nueva-receta')?.key,'applications')
  assert.equal(menuForPath('/proyectos/id')?.key,'projects')
  assert.equal(menuForPath('/catalogos/products')?.key,'catalog:products')
  assert.equal(menuForPath('/catalogos/products-otro'),undefined)
})
test('admin conserva todas las secciones y perfil inactivo no conserva ninguna',()=>{
  const admin=createDemoData().profiles[0]
  assert.equal(effectiveMenus({...admin,menu_permissions:[]}).length,menuDefinitions.length)
  assert.deepEqual(effectiveMenus({...admin,active:false}),[])
  assert.deepEqual(scopeWorkspace(createDemoData(),{...admin,active:false}).projects,[])
})
test('demos anteriores conservan lectura y una lista explícita vacía deniega todo',()=>{
  const reader=createDemoData().profiles[1]
  assert.deepEqual(effectiveMenus(reader),readerMenus)
  assert.deepEqual(effectiveMenus({...reader,menu_permissions:[]}),[])
  assert.equal(firstAllowedPath({...reader,menu_permissions:['queries']}),'/consultas')
  assert.equal(firstAllowedPath({...reader,menu_permissions:[]}),null)
})
test('copiar o aplicar plantillas no concede administración, IA ni configuración',()=>{
  assert.deepEqual(normalizeMenus(['queries','users','ai_capture','connection','inventado','queries']),['queries'])
  for(const template of menuTemplates)assert.ok(template.menus.every(key=>readerMenus.includes(key)))
})
test('guardar acceso conserva el ámbito agrícola, registra antes/después y detecta versiones viejas',()=>{
  const data=createDemoData(),admin=data.profiles.find(user=>user.id===DEMO_ADMIN_ID)!
  const command={type:'set_user_access' as const,user_id:DEMO_READER_ID,role:'reader' as const,agricultural_unit_ids:['agri-ensenada'],menu_permissions:['queries'] as const,expected_version:0}
  const saved=applyCommand(data,{...command,menu_permissions:[...command.menu_permissions]},admin)
  const reader=saved.profiles.find(user=>user.id===DEMO_READER_ID)!
  assert.equal(canViewMenu(reader,'queries'),true);assert.equal(canViewMenu(reader,'projects'),false)
  assert.equal(saved.userAccessChanges?.length,1);assert.deepEqual(saved.userAccessChanges?.[0].after.menus,['queries'])
  assert.ok(scopeWorkspace(saved,reader).projects.every(project=>project.agricultural_unit_id==='agri-ensenada'))
  assert.throws(()=>applyCommand(saved,{...command,menu_permissions:[]},admin),/acceso cambió/)
  assert.throws(()=>applyCommand(saved,{...command,menu_permissions:[]},reader),/consulta/)
})
test('sin menús no se entregan datos operativos ni historial de accesos en demo',()=>{
  const data=createDemoData(),reader={...data.profiles[1],menu_permissions:[]}
  const scoped=scopeWorkspace(data,reader)
  assert.deepEqual(scoped.projects,[]);assert.deepEqual(scoped.lots,[]);assert.deepEqual(scoped.applicationOrders,[]);assert.deepEqual(scoped.userAccessChanges,[])
})
test('no se retira el último administrador activo',()=>{
  const data=createDemoData()
  assert.throws(()=>applyCommand(data,{type:'set_user_access',user_id:DEMO_ADMIN_ID,role:'reader',agricultural_unit_ids:[],menu_permissions:[]},data.profiles[0]),/administrador activo/)
})
