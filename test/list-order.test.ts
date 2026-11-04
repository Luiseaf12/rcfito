import assert from 'node:assert/strict'
import test from 'node:test'
import { compareDisplayText, sortDisplay, sortNamed, sortOptions } from '../src/domain/list-order.ts'
import { catalogRelationOptions } from '../src/domain/catalogs.ts'
import { currentApplicationDestinations } from '../src/domain/application-import.ts'
import { createDemoData } from '../src/domain/demo.ts'

test('orden español natural: acentos/mayúsculas equivalentes, eñe distinta y empates por identidad', () => {
  const input = Object.freeze([
    { id: 'z', name: 'Zinc' }, { id: '2', name: 'Malla 10' }, { id: 'b', name: 'ÁLAMO' },
    { id: 'n', name: 'Ñandú' }, { id: '1', name: 'Malla 2' }, { id: 'a', name: 'alamo' }, { id: 'o', name: 'Nopal' },
  ].map(row => Object.freeze(row)))
  assert.deepEqual(sortNamed(input).map(row => row.id), ['a', 'b', '1', '2', 'o', 'n', 'z'])
  assert.equal(compareDisplayText('Árbol', 'arbol'), 0)
  assert.equal(compareDisplayText('A\u0301rbol', 'ÁRBOL'), 0)
  assert.equal(input[0].id, 'z', 'ordenar una vista no reescribe los datos')
  assert.deepEqual(sortNamed([...input].reverse()), sortNamed(input), 'el empate es estable tras otra consulta')
})

test('opciones fijadas conservan posición; registros y referencias inactivas siguen ordenados por etiqueta', () => {
  const input = Object.freeze([
    { value: 'all', label: 'Todos', pinned: true }, { value: 'none', label: 'Sin asignar', pinned: true },
    { value: '3', label: 'Zinc', disabled: true }, { value: '2', label: 'azoxistrobin' },
    { value: '1', label: 'Ázoxistrobin' }, { value: '4', label: 'Cimoxanil (inactivo)' },
  ])
  assert.deepEqual(sortOptions(input).map(row => row.value), ['all', 'none', '1', '2', '4', '3'])
  assert.equal(sortOptions(input).at(-1)?.disabled, true)
  assert.equal(input[2].value, '3')
})

test('un catálogo desordenado ofrece ingredientes A-Z manteniendo solo los inactivos ya relacionados', () => {
  const records = [
    { id: 'k', name: 'Kasugamicina', active: true }, { id: 'e', name: 'Estreptomicina', active: true },
    { id: 'a', name: 'Azoxistrobin', active: true }, { id: 'c', name: 'Cimoxanil', active: false },
    { id: 'b', name: 'Borrado de nuevas opciones', active: false },
  ]
  const original = structuredClone(records)
  assert.deepEqual(catalogRelationOptions(records, ['c']).map(row => row.value), ['a', 'c', 'e', 'k'])
  assert.equal(catalogRelationOptions(records, ['c'])[1].label, 'Cimoxanil (inactivo)')
  assert.deepEqual(records, original)
})

test('orden global antes de paginar: filtro y relectura conservan páginas completas y estables', () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: String(i), label: `Malla ${23 - i}` }))
  const page = (source: typeof rows, index: number) => sortDisplay(source.filter(row => Number(row.label.slice(6)) % 2), row => row.label, row => row.id).slice(index * 5, (index + 1) * 5).map(row => row.label)
  assert.deepEqual(page(rows, 0), ['Malla 1', 'Malla 3', 'Malla 5', 'Malla 7', 'Malla 9'])
  assert.deepEqual(page(rows, 1), ['Malla 11', 'Malla 13', 'Malla 15', 'Malla 17', 'Malla 19'])
  assert.deepEqual(page([...rows].reverse(), 1), page(rows, 1))
})

test('destinos de recetas y grupos se ordenan por malla sin cambiar selección, etapas o datos', () => {
  const data = createDemoData()
  data.lots.find(row => row.id === 'lot-1')!.name = 'Malla 10'
  data.lots.find(row => row.id === 'lot-2')!.name = 'Malla 2'
  const subdivision = data.subdivisions.find(row => row.lot_id === 'lot-2')!
  const stage = data.stages.find(row => row.subdivision_id === subdivision.id)!
  stage.status = 'planted'; stage.actual_sowing_date = '2026-10-03'
  const original = structuredClone(data)
  const options = currentApplicationDestinations(data, 'project-ensenada')
  assert.deepEqual(options.map(row => row.lot.name), ['Malla 2', 'Malla 10'])
  data.stages.reverse()
  assert.deepEqual(currentApplicationDestinations(data, 'project-ensenada').map(row => row.stage.id), options.map(row => row.stage.id))
  data.stages.reverse()
  assert.deepEqual(data, original)
})
