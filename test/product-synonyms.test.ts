import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProductOptions, compactProductTerm, compareProductsByName, normalizeProductTerm, productOptionLabel, similarProductTerms, validateProductSynonyms } from '../src/domain/product-synonyms.ts'
import { validateCatalogEdit } from '../src/domain/catalogs.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { emptyWorkspace, type CatalogRecord } from '../src/domain/model.ts'

const product = (overrides: Partial<CatalogRecord> = {}): CatalogRecord => ({ id: 'own', name: 'Nombre oficial de ejemplo', code: 'DEMO-001', active: true, unit: 'ml', default_dose: 1, synonyms: [], ...overrides })

test('comparación espejo SQL elimina acentos, separadores y espacios solo para comparar', () => {
  assert.equal(normalizeProductTerm('  MÍX-C__7 / A. '), 'mix c 7 a')
  assert.equal(compactProductTerm('  MÍX-C__7 / A. '), 'mixc7a')
  assert.equal(compactProductTerm(' A\u0301cido - 2 '), 'acido2')
  assert.equal(compactProductTerm('Ácido2'), compactProductTerm('acido_2'))
  assert.equal(compactProductTerm('Æß'), '', 'no se transliteran letras fuera del contrato ASCII')
})

test('similitud respeta exactos cortos, umbral4, prefijos y distancias1/2', () => {
  for (const [left, right, expected] of [
    ['A-B', 'ab', true], ['abc', 'abd', false], ['abc', 'abcdef', false],
    ['Wex A', 'Wex B', true], ['abcd', 'abce', true], ['abcd', 'abxx', false],
    ['alph', 'alpha extendido', true], ['abcde', 'abxde', true], ['abcde', 'abxye', false],
    ['abcdefghi', 'abcxefghy', false], ['abcdefghij', 'abcxefghiy', true], ['abcdefghij', 'abxxefghiy', false],
    ['', '', false], ['---', '___', false],
  ] as const) {
    assert.equal(similarProductTerms(left, right), expected, `${left} / ${right}`)
    assert.equal(similarProductTerms(right, left), expected, `${right} / ${left}`)
  }
})

test('sinónimos hasta20 con2..80caracteres, sin vacíos, NUL o duplicados compactos', () => {
  const own = product()
  for (const synonyms of [[''], [' '], ['A'], ['--'], ['x'.repeat(81)], ['Nombre\u0000'], ['Apodo-Largo', '  ÁPODO LARGO  '], Array.from({ length: 21 }, (_, index) => `Apodo ${index}`)]) assert.ok(validateProductSynonyms([own], { ...own, synonyms }).synonyms)
  assert.ok(validateProductSynonyms([own], { ...own, synonyms: 'no-array' as unknown as string[] }).synonyms)
  assert.ok(validateProductSynonyms([own], { ...own, synonyms: [123] as unknown as string[] }).synonyms)
  assert.deepEqual(validateProductSynonyms([own], { ...own, synonyms: Array.from({ length: 20 }, (_, index) => `Apodo ${index}`) }), {})
  assert.deepEqual(validateProductSynonyms([own], { ...own, synonyms: ['AB', 'x'.repeat(80)] }), {})
})

test('alias propio equivalente a nombre/código falla; variantes parecidas del mismo ID se permiten', () => {
  const own = product({ name: 'Wex A', code: 'QA-700' })
  for (const synonyms of [['wex_a'], ['QA 700']]) assert.ok(validateProductSynonyms([own], { ...own, synonyms }).synonyms)
  assert.deepEqual(validateProductSynonyms([own], { ...own, synonyms: ['Wex B', 'Wex C'] }), {})
})

test('alias contra nombre, código y alias ajenos se valida también en productos inactivos', () => {
  const own = product()
  const foreign = product({ id: 'foreign', name: 'Nombre extranjero', code: 'CODE-ABC', active: false, synonyms: ['Referencia larga'] })
  for (const alias of ['Nombre_extranjero', 'codeabc', 'REFERENCIA-LARGA', 'referencia largx']) {
    const issue = validateProductSynonyms([own, foreign], { ...own, synonyms: [alias] }).synonyms
    assert.ok(issue, alias)
    assert.match(issue, /Nombre extranjero.*inactivo/)
  }
  const short = product({ id: 'other', name: 'Wex B' })
  assert.ok(validateProductSynonyms([own, short], { ...own, synonyms: ['Wex A'] }).synonyms)
})

test('alta o renombre y cambio de código se cotejan a la inversa contra alias ajenos', () => {
  const own = product(), foreign = product({ id: 'foreign', name: 'Otro producto', synonyms: ['Referencia larga'] })
  assert.ok(validateProductSynonyms([own, foreign], { ...own, name: 'Referencia largx' }).name)
  assert.ok(validateProductSynonyms([own, foreign], { ...own, code: 'referencia-larga' }).code)
  assert.ok(validateProductSynonyms([foreign], product({ id: 'new', name: 'Referencia larga' })).name)
  const official = product({ id: 'official', name: 'Wex B', synonyms: [] })
  assert.deepEqual(validateProductSynonyms([official], product({ name: 'Wex A', synonyms: [] })), {}, 'los nombres oficiales parecidos no se bloquean entre sí')
})

test('omitir alias reutiliza lista efectiva para validar, preservarla y reemplazarla explícitamente', () => {
  const own = product({ synonyms: ['Alias conservado'] }), foreign = product({ id: 'foreign', name: 'Otro producto' })
  const omitted = { ...own }; delete omitted.synonyms
  assert.ok(validateProductSynonyms([own, foreign], { ...omitted, name: 'Alias conservado' }).synonyms, 'el nombre nuevo colisiona con un alias propio conservado')
  const data = emptyWorkspace(); data.catalogs.products = [own]
  const admin = { id: 'demo-admin', full_name: 'Administración ficticia', role: 'admin' as const }
  const saved = applyCommand(data, { type: 'save_catalog', kind: 'products', record: { ...omitted, default_dose: 2, synonyms: undefined } }, admin)
  assert.deepEqual(saved.catalogs.products[0].synonyms, ['Alias conservado'])
  const replaced = applyCommand(saved, { type: 'save_catalog', kind: 'products', record: { ...saved.catalogs.products[0], synonyms: ['  Alias nuevo  '] } }, admin)
  assert.deepEqual(replaced.catalogs.products[0].synonyms, ['Alias nuevo'])
  const removed = applyCommand(replaced, { type: 'save_catalog', kind: 'products', record: { ...replaced.catalogs.products[0], synonyms: [] } }, admin)
  assert.deepEqual(removed.catalogs.products[0].synonyms, [])
  assert.deepEqual(data.catalogs.products[0].synonyms, ['Alias conservado'])
})

test('catálogo integra errors.synonyms/name/code y conserva editables los nombres oficiales heredados', () => {
  const a = product({ id: 'a', name: 'Wex A', code: 'QA-1' }), b = product({ id: 'b', name: 'Wex B', code: 'QA-2' })
  const data = emptyWorkspace(); data.catalogs.products = [a, b]
  assert.deepEqual(validateCatalogEdit(data, 'products', { ...a, default_dose: 2 }), {})
  assert.ok(validateCatalogEdit(data, 'products', { ...a, synonyms: ['Wex B'] }).synonyms)
  data.catalogs.products = [product({ id: 'a', name: 'Vibe-C', code: 'QA-1' }), product({ id: 'b', name: 'Vibe C', code: 'QA-2' })]
  assert.deepEqual(validateCatalogEdit(data, 'products', { ...data.catalogs.products[0], default_dose: 2 }), {}, 'editar dosis no convierte un parecido heredado en un bloqueo de nombre')
  assert.ok(validateCatalogEdit(data, 'products', product({ id: 'new', name: 'VIBE_C' })).name)
  assert.ok(validateCatalogEdit(data, 'products', { ...data.catalogs.products[0], name: 'VIBE C' }).name)
})

test('borrar producto con alias requiere retirarlos explícitamente y el lector nunca puede borrar', () => {
  const data = emptyWorkspace(), own = product({ synonyms: ['Apodo alternativo'] })
  data.catalogs.products = [own]
  const original = structuredClone(data)
  const admin = { id: 'demo-admin', full_name: 'Administración ficticia', role: 'admin' as const }
  const reader = { id: 'demo-reader', full_name: 'Consulta ficticia', role: 'reader' as const }
  const command = { type: 'delete_catalog' as const, kind: 'products' as const, id: own.id }
  assert.throws(() => applyCommand(data, command, admin), /Retira los sinónimos.*eliminarlo/)
  assert.throws(() => applyCommand(data, command, reader), /consulta|administración/)
  assert.deepEqual(data, original)
  const cleared = applyCommand(data, { type: 'save_catalog', kind: 'products', record: { ...own, synonyms: [] } }, admin)
  assert.throws(() => applyCommand(cleared, command, reader), /consulta|administración/)
  assert.deepEqual(applyCommand(cleared, command, admin).catalogs.products, [])
})

test('comparador y opciones ordenan nombres españoles con números naturales y empate por ID', () => {
  const records = [product({ id: 'p10', name: 'Producto 10' }), product({ id: 'b', name: 'Ácido' }), product({ id: 'p2', name: 'Producto 2' }), product({ id: 'a', name: 'acido' })]
  const before = structuredClone(records)
  assert.deepEqual([...records].sort(compareProductsByName).map(row => row.id), ['a', 'b', 'p2', 'p10'])
  assert.deepEqual(buildProductOptions(records, []).map(option => option.value), ['a', 'b', 'p2', 'p10'])
  assert.deepEqual(records, before)
})

test('etiqueta muestra nombre una vez e ingredientes únicos ordenados, incluidos inactivos', () => {
  const ingredients: CatalogRecord[] = [{ id: 'zinc', name: 'Zinc', active: false }, { id: 'zinc-other', name: 'ZINC', active: true }, { id: 'acid10', name: 'Ácido 10', active: true }, { id: 'acid2', name: 'Ácido 2', active: false }]
  const own = product({ name: 'Producto demostrativo', ingredients: [{ ingredient_id: 'zinc', concentration: '20 g/L' }, { ingredient_id: 'acid10', concentration: null }, { ingredient_id: 'acid2', concentration: '5%' }, { ingredient_id: 'zinc-other', concentration: '20 g/L' }, { ingredient_id: 'zinc', concentration: null }] })
  const before = structuredClone({ own, ingredients })
  assert.equal(productOptionLabel(own, ingredients), 'Producto demostrativo · Ácido 2 (5%) + Ácido 10 + Zinc (20 g/L)')
  assert.equal(productOptionLabel(product({ name: 'Sin ingredientes' }), ingredients), 'Sin ingredientes')
  assert.equal(productOptionLabel(product({ name: 'Zinc', ingredients: [{ ingredient_id: 'zinc', concentration: '20 g/L' }] }), ingredients), 'Zinc (20 g/L)')
  assert.deepEqual({ own, ingredients }, before)
})

test('selector conserva IDs e inactivos ya usados y solo agrega código ante colisión de nombre', () => {
  const unique = product({ id: 'unique', name: 'Único', code: 'SHOULD-NOT-SHOW' })
  const inactive = product({ id: 'old', name: 'Histórico', code: 'OLD', active: false })
  assert.deepEqual(buildProductOptions([unique, inactive], []), [{ value: 'unique', label: 'Único' }])
  assert.match(buildProductOptions([unique, inactive], [], [{ product_id: 'old' }])[0].label, /Histórico.*inactivo/)
  const duplicates = [product({ id: 'a', name: 'Ácido', code: 'CODE-A' }), product({ id: 'b', name: 'acido', code: 'CODE-B' })]
  assert.deepEqual(buildProductOptions(duplicates, []).map(option => option.label), ['Ácido · CODE-A', 'acido · CODE-B'])
  const noCodes = duplicates.map(record => ({ ...record, code: undefined }))
  assert.deepEqual(buildProductOptions(noCodes, []).map(option => option.label), ['Ácido · a', 'acido · b'])
})
