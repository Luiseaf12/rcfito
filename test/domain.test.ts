import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'
import type { SowingStage, UserProfile, WorkspaceCommand, WorkspaceData } from '../src/domain/model.ts'

function fixture() {
  const data = createDemoData()
  data.projects = []
  data.lots = []
  data.subdivisions = []
  data.stages = []
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  assert.equal(admin.role, 'admin')
  assert.equal(reader.role, 'reader')
  return { data, admin, reader }
}

function run(data: WorkspaceData, command: WorkspaceCommand, actor: UserProfile) {
  return applyCommand(data, command, actor)
}

function project(data: WorkspaceData, admin: UserProfile, agricultural_unit_id = 'agri-ensenada', season = '2026–2027') {
  const previous = new Set(data.projects.map(row => row.id))
  const next = run(data, { type: 'save_project', record: { agricultural_unit_id, name: `Proyecto ${season}`, season } }, admin)
  const created = next.projects.find(row => !previous.has(row.id))!
  assert.ok(created, 'la creación devuelve una identidad de proyecto nueva')
  return { data: next, project: created }
}

function lot(data: WorkspaceData, admin: UserProfile, project_id: string, field_id = 'field-norte', area_ha = 12) {
  const previous = new Set(data.lots.map(row => row.id))
  const next = run(data, { type: 'save_lot', record: { project_id, field_id, name: 'Lote de prueba', area_ha, infrastructure_type_id: 'infrastructure-malla' } }, admin)
  const created = next.lots.find(row => !previous.has(row.id))!
  assert.ok(created, 'la creación devuelve una identidad de lote nueva')
  return { data: next, lot: created, subdivision: next.subdivisions.find(row => row.lot_id === created.id)! }
}

function stage(data: WorkspaceData, admin: UserProfile, subdivision_id: string, overrides: Partial<SowingStage> = {}) {
  const previous = new Set(data.stages.map(row => row.id))
  const next = run(data, { type: 'save_stage', record: {
    subdivision_id, crop_id: 'crop-pepino', variety_id: 'var-pepino-persian', area_ha: 12,
    planned_sowing_date: '2026-11-02', ...overrides,
  } }, admin)
  const created = next.stages.find(row => !previous.has(row.id))!
  assert.ok(created, 'la planeación devuelve una identidad de etapa nueva')
  return { data: next, stage: created }
}

function prepared() {
  const f = fixture()
  const p = project(f.data, f.admin)
  const l = lot(p.data, f.admin, p.project.id)
  return { ...f, data: l.data, project: p.project, lot: l.lot, subdivision: l.subdivision }
}

test('el lector no puede guardar catálogos, proyectos ni asignaciones y el origen no cambia', () => {
  const { data, reader } = fixture()
  const before = structuredClone(data)
  const commands: WorkspaceCommand[] = [
    { type: 'save_catalog', kind: 'crops', record: { name: 'Otro cultivo', active: true } },
    { type: 'save_project', record: { agricultural_unit_id: 'agri-ensenada', name: 'No autorizado', season: '2026' } },
    { type: 'set_user_access', user_id: reader.id, role: 'admin', agricultural_unit_ids: ['agri-culiacan'] },
  ]
  for (const command of commands) assert.throws(() => run(data, command, reader), /consulta|administraci/i)
  assert.deepEqual(data, before)
})

test('el ámbito del lector filtra toda la jerarquía de agrícolas no asignadas', () => {
  const data = createDemoData()
  const before = structuredClone(data)
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  const scoped = scopeWorkspace(data, reader)
  assert.deepEqual(scoped.catalogs.agricultural_units.map(row => row.id), ['agri-ensenada'])
  assert.ok(scoped.catalogs.fields.every(row => row.agricultural_unit_id === 'agri-ensenada'))
  assert.ok(scoped.projects.every(row => row.agricultural_unit_id === 'agri-ensenada'))
  const projects = new Set(scoped.projects.map(row => row.id))
  const lots = new Set(scoped.lots.map(row => row.id))
  const subdivisions = new Set(scoped.subdivisions.map(row => row.id))
  assert.ok(scoped.lots.every(row => projects.has(row.project_id)))
  assert.ok(scoped.subdivisions.every(row => lots.has(row.lot_id)))
  assert.ok(scoped.stages.every(row => subdivisions.has(row.subdivision_id)))
  assert.deepEqual(scoped.profiles.map(row => row.id), [reader.id])
  assert.ok(scoped.assignments.every(row => row.user_id === reader.id))
  const unassigned = scopeWorkspace({ ...data, assignments: [] }, reader)
  assert.equal(unassigned.projects.length + unassigned.lots.length + unassigned.subdivisions.length + unassigned.stages.length, 0)
  assert.equal(unassigned.catalogs.agricultural_units.length, 0)
  assert.equal(unassigned.catalogs.fields.length, 0)
  assert.deepEqual(data, before)
})

test('una agrícola no puede abrir otra temporada y una agrícola diferente sí puede hacerlo', () => {
  const { data, admin } = fixture()
  const first = project(data, admin)
  const active = run(first.data, { type: 'activate_project', id: first.project.id }, admin)
  assert.throws(() => project(active, admin, 'agri-ensenada', '2027–2028'), /temporada|abierta/i)
  const other = project(active, admin, 'agri-culiacan', '2027–2028')
  assert.equal(other.data.projects.length, 2)
  assert.equal(data.projects.length, 0, 'el caso de uso es puro y conserva el workspace original')
})

test('crear lote genera una subdivisión vigente por toda su superficie', () => {
  const f = prepared()
  const subdivisions = f.data.subdivisions.filter(row => row.lot_id === f.lot.id)
  assert.equal(subdivisions.length, 1)
  assert.equal(subdivisions[0].active, true)
  assert.equal(subdivisions[0].area_ha, f.lot.area_ha)
  assert.notEqual(subdivisions[0].id, f.lot.id)
  assert.equal(f.lot.field_name_snapshot, 'Campo Norte')
  assert.equal(f.lot.infrastructure_name_snapshot, 'Mallasombra')
})

test('un lote no puede tomar un campo de otra agrícola', () => {
  const f = fixture()
  const p = project(f.data, f.admin)
  assert.throws(() => lot(p.data, f.admin, p.project.id, 'field-rio'), /campo.*agrícola|pertenecer/i)
  assert.equal(p.data.lots.length, 0)
  assert.equal(p.data.subdivisions.length, 0)
})

test('superficies excesivas o no finitas fallan sin dejar redistribución parcial', () => {
  const f = prepared()
  const before = structuredClone(f.data)
  assert.throws(() => run(f.data, { type: 'replace_subdivisions', lot_id: f.lot.id, subdivisions: [{ name: 'Norte', area_ha: 7 }, { name: 'Sur', area_ha: 6 }] }, f.admin), /superficie|supera/i)
  assert.throws(() => stage(f.data, f.admin, f.subdivision.id, { area_ha: 13 }), /superficie|supera/i)
  assert.throws(() => stage(f.data, f.admin, f.subdivision.id, { area_ha: Number.NaN }), /superficie|mayor/i)
  assert.throws(() => stage(f.data, f.admin, f.subdivision.id, { area_ha: Number.POSITIVE_INFINITY }), /superficie|mayor/i)
  const smaller = run(f.data, { type: 'replace_subdivisions', lot_id: f.lot.id, subdivisions: [{ name: 'Porción sembrable', area_ha: 10 }] }, f.admin)
  assert.equal(smaller.subdivisions.filter(row => row.lot_id === f.lot.id && row.active).reduce((total, row) => total + row.area_ha, 0), 10)
  assert.deepEqual(f.data, before)
})

test('la variedad debe corresponder al cultivo y la fecha civil debe existir', () => {
  const f = prepared()
  assert.throws(() => stage(f.data, f.admin, f.subdivision.id, { variety_id: 'var-tomate-saladette' }), /variedad.*cultivo/i)
  assert.throws(() => stage(f.data, f.admin, f.subdivision.id, { planned_sowing_date: '2026-02-30' }), /fecha/i)
  assert.equal(f.data.stages.length, 0)
})

test('se planea la siguiente etapa con la actual sembrada pero se planta después de cerrarla', () => {
  const f = prepared()
  const first = stage(f.data, f.admin, f.subdivision.id)
  let data = run(first.data, { type: 'activate_project', id: f.project.id }, f.admin)
  data = run(data, { type: 'plant_stage', id: first.stage.id, actual_sowing_date: '2026-11-03' }, f.admin)
  const second = stage(data, f.admin, f.subdivision.id, { planned_sowing_date: '2026-12-02' })
  assert.equal(second.stage.stage_number, 2)
  assert.equal(second.stage.status, 'planned')
  assert.equal(second.stage.actual_sowing_date, null)
  assert.throws(() => run(second.data, { type: 'plant_stage', id: second.stage.id, actual_sowing_date: '2026-12-02' }, f.admin), /cierra|anterior/i)
  data = run(second.data, { type: 'close_stage', id: first.stage.id, closed_at: '2026-12-01' }, f.admin)
  assert.throws(() => run(data, { type: 'plant_stage', id: second.stage.id, actual_sowing_date: '2026-11-30' }, f.admin), /cierre|anterior/i)
  data = run(data, { type: 'plant_stage', id: second.stage.id, actual_sowing_date: '2026-12-02' }, f.admin)
  assert.equal(data.stages.find(row => row.id === second.stage.id)!.status, 'planted')
  assert.equal(data.stages.find(row => row.id === first.stage.id)!.status, 'closed')
})

test('registrar siembra real exige proyecto activo y cierre con fecha válida', () => {
  const f = prepared()
  const planned = stage(f.data, f.admin, f.subdivision.id)
  assert.throws(() => run(planned.data, { type: 'plant_stage', id: planned.stage.id, actual_sowing_date: '2026-11-03' }, f.admin), /activa|proyecto/i)
  let data = run(planned.data, { type: 'activate_project', id: f.project.id }, f.admin)
  data = run(data, { type: 'plant_stage', id: planned.stage.id, actual_sowing_date: '2026-11-03' }, f.admin)
  assert.throws(() => run(data, { type: 'close_stage', id: planned.stage.id, closed_at: '' }, f.admin), /fecha/i)
  assert.throws(() => run(data, { type: 'close_stage', id: planned.stage.id, closed_at: '2026-11-02' }, f.admin), /fecha/i)
})

test('retirar planeaciones respeta el orden y no permite retirar siembras realizadas', () => {
  const f = prepared()
  const first = stage(f.data, f.admin, f.subdivision.id)
  const second = stage(first.data, f.admin, f.subdivision.id)
  assert.throws(() => run(second.data, { type: 'discard_stage', id: first.stage.id }, f.admin), /última|primero/i)
  const data = run(second.data, { type: 'discard_stage', id: second.stage.id }, f.admin)
  assert.deepEqual(data.stages.map(row => row.id), [first.stage.id])
  const active = run(data, { type: 'activate_project', id: f.project.id }, f.admin)
  const planted = run(active, { type: 'plant_stage', id: first.stage.id, actual_sowing_date: '2026-11-03' }, f.admin)
  assert.throws(() => run(planted, { type: 'discard_stage', id: first.stage.id }, f.admin), /planeada/i)
})

test('copiar una temporada cerrada conserva el origen y reinicia siembras en identidades nuevas', () => {
  const f = prepared()
  const first = stage(f.data, f.admin, f.subdivision.id)
  let data = run(first.data, { type: 'activate_project', id: f.project.id }, f.admin)
  data = run(data, { type: 'plant_stage', id: first.stage.id, actual_sowing_date: '2026-11-03' }, f.admin)
  assert.throws(() => run(data, { type: 'close_project', id: f.project.id }, f.admin), /etapa|planeaci/i)
  data = run(data, { type: 'close_stage', id: first.stage.id, closed_at: '2027-01-15' }, f.admin)
  data = run(data, { type: 'close_project', id: f.project.id }, f.admin)
  const source = structuredClone(data)
  const copied = run(data, { type: 'copy_project', id: f.project.id, name: 'Nueva temporada', season: '2027–2028' }, f.admin)
  const target = copied.projects.find(row => row.id !== f.project.id)!
  const targetLots = copied.lots.filter(row => row.project_id === target.id)
  assert.equal(target.status, 'draft')
  assert.equal(targetLots.length, 1)
  assert.equal(targetLots[0].area_ha, f.lot.area_ha)
  assert.notEqual(targetLots[0].id, f.lot.id)
  const targetSubdivisions = copied.subdivisions.filter(row => row.lot_id === targetLots[0].id)
  assert.equal(targetSubdivisions.length, 1)
  assert.notEqual(targetSubdivisions[0].id, f.subdivision.id)
  assert.equal(copied.stages.length, source.stages.length, 'no se copian siembras')
  assert.ok(copied.stages.every(row => row.subdivision_id === f.subdivision.id))
  const targetStage = stage(copied, f.admin, targetSubdivisions[0].id)
  assert.equal(targetStage.stage.stage_number, 1)
  assert.deepEqual(data, source)
  assert.deepEqual(copied.projects.find(row => row.id === f.project.id), source.projects[0])
  assert.deepEqual(copied.lots.find(row => row.id === f.lot.id), source.lots[0])
})

test('una siembra usada conserva snapshots al renombrar catálogos y bloquea la edición histórica', () => {
  const f = prepared()
  const first = stage(f.data, f.admin, f.subdivision.id)
  let data = run(first.data, { type: 'activate_project', id: f.project.id }, f.admin)
  data = run(data, { type: 'plant_stage', id: first.stage.id, actual_sowing_date: '2026-11-03' }, f.admin)
  data = run(data, { type: 'close_stage', id: first.stage.id, closed_at: '2027-01-15' }, f.admin)
  const crop = data.catalogs.crops.find(row => row.id === 'crop-pepino')!
  data = run(data, { type: 'save_catalog', kind: 'crops', record: { ...crop, name: 'Nombre actualizado' } }, f.admin)
  const field = data.catalogs.fields.find(row => row.id === 'field-norte')!
  data = run(data, { type: 'save_catalog', kind: 'fields', record: { ...field, name: 'Campo actualizado' } }, f.admin)
  const historical = data.stages.find(row => row.id === first.stage.id)!
  assert.equal(historical.crop_name_snapshot, 'Pepino')
  assert.equal(historical.variety_name_snapshot, 'Persa')
  assert.equal(data.lots.find(row => row.id === f.lot.id)!.field_name_snapshot, 'Campo Norte')
  assert.throws(() => run(data, { type: 'save_stage', record: { ...historical, area_ha: 5 } }, f.admin), /planeada|historial/i)
  assert.throws(() => run(data, { type: 'save_lot', record: { ...data.lots[0], area_ha: 20 } }, f.admin), /historial|siembra/i)
})

test('la baja lógica conserva referencias y eliminar un registro usado se rechaza', () => {
  const f = prepared()
  assert.throws(() => run(f.data, { type: 'delete_catalog', kind: 'fields', id: 'field-norte' }, f.admin), /relacionado|historial/i)
  const field = f.data.catalogs.fields.find(row => row.id === 'field-norte')!
  const disabled = run(f.data, { type: 'save_catalog', kind: 'fields', record: { ...field, active: false } }, f.admin)
  assert.equal(disabled.catalogs.fields.find(row => row.id === field.id)!.active, false)
  assert.equal(disabled.lots.find(row => row.id === f.lot.id)!.field_id, field.id)
  assert.equal(f.data.catalogs.fields.find(row => row.id === field.id)!.active, true)
})

test('producto e ingredientes conservan concentración opcional y rechazan relaciones duplicadas', () => {
  const { data, admin } = fixture()
  const record = { name: 'Producto de prueba', active: true, unit: 'g' as const, default_dose: 0,
    ingredients: [{ ingredient_id: 'ingredient-a', concentration: null }, { ingredient_id: 'ingredient-b', concentration: '25 %' }] }
  const next = run(data, { type: 'save_catalog', kind: 'products', record }, admin)
  const product = next.catalogs.products.find(row => row.name === record.name)!
  assert.deepEqual(product.ingredients, record.ingredients)
  assert.throws(() => run(data, { type: 'save_catalog', kind: 'products', record: { ...record, ingredients: [record.ingredients[0], record.ingredients[0]] } }, admin), /ingrediente|repitas/i)
  assert.throws(() => run(data, { type: 'save_catalog', kind: 'products', record: { ...record, default_dose: -1 } }, admin), /dosis/i)
})

test('una temporada histórica no se duplica dentro de la misma agrícola', () => {
  const f = fixture()
  const p = project(f.data, f.admin, 'agri-ensenada', '2026–2027')
  const closed = run(p.data, { type: 'close_project', id: p.project.id }, f.admin)
  assert.throws(() => project(closed, f.admin, 'agri-ensenada', '2026–2027'), /temporada|existe|duplic/i)
  assert.throws(() => run(closed, { type: 'copy_project', id: p.project.id, name: 'Copia duplicada', season: '2026–2027' }, f.admin), /temporada|existe|duplic/i)
})
