import test from 'node:test'
import assert from 'node:assert/strict'
import {readAppearance, resolvedAppearance, isAppearance} from '../src/domain/appearance'
test('una cuenta sin preferencia o con valor desconocido sigue Sistema',()=>{
  for(const value of [null,undefined,'', 'DARK', 'auto', {}, 'system']) assert.equal(readAppearance(value),'system')
})
test('Sistema sigue el equipo mientras Claro y Oscuro son elecciones explícitas',()=>{
  assert.equal(resolvedAppearance('system',true),'dark');assert.equal(resolvedAppearance('system',false),'light')
  assert.equal(resolvedAppearance('light',true),'light');assert.equal(resolvedAppearance('dark',false),'dark')
})
test('el contrato de preferencias admite exclusivamente las tres opciones acordadas',()=>{
  for(const value of ['system','light','dark']) assert.equal(isAppearance(value),true)
  for(const value of ['green','admin',null,0,{},'']) assert.equal(isAppearance(value),false)
})
