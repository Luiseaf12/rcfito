import assert from 'node:assert/strict'
import test from 'node:test'
import { updateVisibleGroupMembers } from '../src/domain/sowing-groups.ts'

test('filtrar por variedad y seleccionar o limpiar conserva los miembros de otras variedades', () => {
  const initial = ['persa-1', 'slicer-1']
  const persaSelected = updateVisibleGroupMembers(initial, ['persa-1', 'persa-2'], ['persa-1', 'persa-2'])
  assert.deepEqual(persaSelected, ['slicer-1', 'persa-1', 'persa-2'])
  const slicerCleared = updateVisibleGroupMembers(persaSelected, ['slicer-1'], [])
  assert.deepEqual(slicerCleared, ['persa-1', 'persa-2'])
  assert.deepEqual(updateVisibleGroupMembers(slicerCleared, [], []), slicerCleared)
  assert.deepEqual(initial, ['persa-1', 'slicer-1'])
})

test('selección visible no duplica ni agrega etapas ajenas al filtro', () => {
  assert.deepEqual(updateVisibleGroupMembers(['otra-variedad'], ['etapa-valida'], ['etapa-valida', 'etapa-valida', 'etapa-ajena']), ['otra-variedad', 'etapa-valida'])
})
