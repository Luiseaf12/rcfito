import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { snapshotSavedRecipe } from '../src/domain/saved-recipe-document.ts'
import { createSavedRecipePdf } from '../src/export/saved-recipe-pdf.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = resolve(root, '.artifacts/rcf036-pdf-qa')
let data = createDemoData()
const profile = data.profiles.find(item => item.id === DEMO_ADMIN_ID)!
data = applyCommand(data, { type: 'create_application_order', record: { id: 'saved-pdf-fictitious', project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-09', scheduled_date: '2026-10-10', water_l_ha: 120.1234, observations: 'Receta ficticia guardada para verificar acentos y dosis precisas.', stage_ids: ['stage-1'], products: [{ product_id: 'product-a', dose: .123456 }, { product_id: 'product-b', dose: 35.25 }] } }, profile)
const before = structuredClone(data)
const small = snapshotSavedRecipe(data, profile, 'saved-pdf-fictitious', '2026-11-02T21:00:00Z')
const long = structuredClone(small)
long.revision = 2
long.project = 'Proyecto ficticio con un nombre extenso para verificar la distribución del texto guardado'
long.targets = Array.from({ length: 28 }, (_, index) => ({ ...small.targets[0], id: `fictitious-${index}`, lot: `Lote ficticio ${String(index + 1).padStart(2, '0')}`, subdivision: 'Subdivisión con identificación extensa para revisión de áreas', variety: 'Variedad de demostración con nombre extenso', area_ha: 1.2345 + index, status: index % 3 === 0 ? 'performed' : index % 3 === 1 ? 'cancelled' : 'indicated', indication_revision: index % 3 === 2 ? 2 : 0, application_number: 15 + index }))
long.products = Array.from({ length: 8 }, (_, index) => ({ ...small.products[index % 2], product_id: `fictitious-product-${index}`, product_name: `Producto ficticio ${index + 1} con nombre comercial extenso para comprobar dosis y unidades`, dose: index === 0 ? .000001 : 2.123456 + index }))
long.observations = Array.from({ length: 40 }, (_, index) => `Nota ficticia ${index + 1}: verificar esta última indicación y los destinos históricos.`).join('\n')
const fonts = { regular: readFileSync(resolve(root, 'src/assets/fonts/Vera.ttf')).toString('base64'), bold: readFileSync(resolve(root, 'src/assets/fonts/VeraBd.ttf')).toString('base64') }
mkdirSync(output, { recursive: true })
for (const [name, snapshot] of [['receta-simple', small], ['receta-extensa', long]] as const) {
  const result = await createSavedRecipePdf(snapshot, fonts)
  const pages = result.doc.getNumberOfPages()
  if (name === 'receta-simple') assert.equal(pages, 1)
  else assert.ok(pages >= 3)
  writeFileSync(resolve(output, `${name}.pdf`), new Uint8Array(result.doc.output('arraybuffer')))
  console.log(`${name}: ${pages} página(s), ${result.reference}`)
}
await assert.rejects(() => createSavedRecipePdf({ ...small, observations: '漢字' }, fonts), /no puede representar/)
assert.deepEqual(data, before)
console.log('PDF guardado ficticio verificado sin mutaciones; glifos ausentes rechazados.')
