import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { snapshotDraftRecipe } from '../src/domain/application-draft-document.ts'
import { createDraftRecipePdf } from '../src/export/application-draft-pdf.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.artifacts/rcf035-pdf-qa')
const data = createDemoData(), profile = data.profiles.find(item => item.id === DEMO_ADMIN_ID)!
const fonts = { regular: readFileSync(resolve(root, 'src/assets/fonts/Vera.ttf')).toString('base64'), bold: readFileSync(resolve(root, 'src/assets/fonts/VeraBd.ttf')).toString('base64') }
const before = structuredClone(data)
const small = snapshotDraftRecipe(data, {
  id: '11111111-1111-4111-8111-111111111111', generated_at: '2026-11-02T20:30:00Z', profile: { ...profile, full_name: 'Responsable QA ficticio' },
  form: { project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-11-02', scheduled_date: '', water_l_ha: '120.1234', observations: 'Ejemplo ficticio para revisión.\nConservar la dosis indicada: 0.123456 ml/ha. Ácido, revisión y aplicación.', application_number: '' },
  products: [{ product_id: 'product-a', dose: '0.123456' }, { product_id: 'product-b', dose: '35.25' }], stage_ids: ['stage-1'],
  review: { imported: false, unresolvedDestinations: [], destinationsReviewed: true, numberReviewed: false },
})
const long = structuredClone(small)
long.project = 'Temporada de demostración con un nombre extenso para comprobar el salto de línea y la lectura del contexto'
long.scheduled_date = '2026-11-04'
long.targets = Array.from({ length: 28 }, (_, index) => ({ ...small.targets[0], stage_id: `fictitious-${index}`, lot_id: `lot-${index}`, lot: `Lote ficticio ${String(index + 1).padStart(2, '0')}`, subdivision: 'Subdivisión con identificación extensa para revisión de áreas', area_ha: 1.2345 + index, variety: 'Variedad de demostración con nombre extenso', stage_number: index % 3 + 1 }))
long.products = Array.from({ length: 8 }, (_, index) => ({ ...small.products[index % 2], product_id: `fictitious-product-${index}`, code: `QA-${index + 1}`, name: `Producto ficticio ${index + 1} para revisión de nombres comerciales largos y dosis precisas`, dose: index === 0 ? .000001 : 2.123456 + index }))
long.observations = Array.from({ length: 40 }, (_, index) => `Nota ficticia ${index + 1}: revisar los lotes y productos de esta propuesta, sin modificar la receta anterior.`).join('\n')
mkdirSync(output, { recursive: true })
for (const [name, snapshot] of [['borrador-simple', small], ['borrador-extenso', long]] as const) {
  const result = await createDraftRecipePdf(snapshot, fonts)
  const pages = result.doc.getNumberOfPages()
  if (name === 'borrador-simple') assert.equal(pages, 1)
  else assert.ok(pages >= 3)
  writeFileSync(resolve(output, `${name}.pdf`), new Uint8Array(result.doc.output('arraybuffer')))
  console.log(`${name}: ${pages} página(s), ${result.reference}`)
}
await assert.rejects(() => createDraftRecipePdf({ ...small, observations: '漢字' }, fonts), /no puede representar/)
assert.deepEqual(data, before)
console.log('PDF ficticio generado sin mutaciones. Caracteres no representables rechazados, sin sustituir nombres.')
