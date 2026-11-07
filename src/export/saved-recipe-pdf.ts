import { applicationRoute, routeLabel } from '../domain/application-routes'
import { savedRecipeReference, type SavedRecipeDocument } from '../domain/saved-recipe-document.ts'
import { reportNumber } from '../lib/report-format.ts'
import { recipePdfLayout, pdfText as text, pdfDate as date, pdfLabel as label, type RecipePdfFonts } from './recipe-pdf-layout.ts'

const dose = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 })
const water = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 })
const status = { indicated: 'Indicada', performed: 'Realizada', cancelled: 'Cancelada' }

export async function createSavedRecipePdf(snapshot: SavedRecipeDocument, fonts: RecipePdfFonts) {
  const { reference, hash } = await savedRecipeReference(snapshot)
  const { table, section, note, finish } = recipePdfLayout({ generated_at: snapshot.generated_at, reference, hash, title: 'Receta indicada', status: 'RECETA GUARDADA - ÚLTIMA INDICACIÓN', subject: 'Última versión indicada; dosis y agua por hectárea', author: snapshot.exported_by, footer: 'Copia de la última indicación guardada. Consulta el seguimiento actualizado en RCFito.', content: snapshot }, fonts)
  table({ theme: 'plain', styles: { cellPadding: 4, fontSize: 8.5 }, columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 196 }, 2: { cellWidth: 72 }, 3: { cellWidth: 198 } }, body: [
    [label('Folio'), text(snapshot.folio), label('Revisión'), String(snapshot.revision)],
    [label('Agrícola'), text(snapshot.agricultural_unit), label('Temporada'), text(snapshot.season)],
    [label('Proyecto'), text(snapshot.project), label('Campo'), text(snapshot.field)],
    [label('Cultivo'), text(snapshot.crop), label('Medio'), `${routeLabel(applicationRoute(snapshot))} / ${text(snapshot.method)}`],
    [label('Indicación'), date(snapshot.indicated_date), label('Programada'), snapshot.scheduled_date ? date(snapshot.scheduled_date) : 'Fecha programada por confirmar'],
    [label('Origen'), text(snapshot.selection), label('Exportó'), text(snapshot.exported_by)],
    ...(snapshot.source ? [[label('Receta base'), { content: `${text(snapshot.source.folio)} - versión ${snapshot.source.revision}`, colSpan: 3 }]] : []),
  ] })
  section(`Destinos de la orden (${snapshot.targets.length})`)
  table({ head: [['Lote', 'Subdivisión', 'Etapa', 'Variedad', 'Superficie (ha)']], columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 144 }, 2: { cellWidth: 43, halign: 'center' }, 3: { cellWidth: 149 }, 4: { cellWidth: 91, halign: 'right' } }, body: snapshot.targets.map(target => [text(target.lot), text(target.subdivision), String(target.stage_number), text(target.variety), reportNumber.format(target.area_ha)]) })
  const correctedTargets = snapshot.targets.filter(target => target.area_correction)
  if (correctedTargets.length) {
    section('Superficies corregidas')
    table({ head: [['Destino', 'Anterior (ha)', 'Corregida (ha)', 'Corrección de malla']], columnStyles: { 0: { cellWidth: 250 }, 1: { cellWidth: 70, halign: 'right' }, 2: { cellWidth: 70, halign: 'right' }, 3: { cellWidth: 142 } }, body: correctedTargets.map(target => [`${text(target.lot)} / ${text(target.subdivision)} / Etapa ${target.stage_number}`, reportNumber.format(target.area_correction!.previous_area_ha), reportNumber.format(target.area_ha), `${target.area_correction!.version} - ${date(target.area_correction!.changed_at.slice(0, 10))}`]) })
    note('Historial de superficies', 'Los valores anteriores se conservan en el historial del proyecto. Las dosis y el gasto de agua por hectárea mantienen sus valores indicados.')
  }
  section(`Mezcla indicada - revisión ${snapshot.revision}`)
  table({ head: [['Producto / agua', 'Dosis / gasto', 'Unidad']], columnStyles: { 0: { cellWidth: 362 }, 1: { cellWidth: 98, halign: 'right' }, 2: { cellWidth: 72 } }, body: [
    ...snapshot.products.map(product => [text(product.product_name), dose.format(product.dose), `${product.unit}/ha`]),
    ['Gasto de agua', snapshot.water_l_ha == null ? 'No especificado' : water.format(snapshot.water_l_ha), 'L/ha'],
  ] })
  note('Nota de la indicación', snapshot.observations)
  section('Seguimiento por destino al exportar')
  table({ head: [['Lote', 'Subdivisión', 'Etapa', 'Núm.', 'Estado', 'Revisión indicada']], styles: { fontSize: 8, cellPadding: 5 }, columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 143 }, 2: { cellWidth: 42 }, 3: { cellWidth: 62 }, 4: { cellWidth: 83 }, 5: { cellWidth: 97 } }, body: snapshot.targets.map(target => [text(target.lot), text(target.subdivision), String(target.stage_number), target.application_number == null ? 'No registrado' : String(target.application_number), status[target.status], String(target.indication_revision)]) })
  if (snapshot.targets.some(target => target.indication_revision !== snapshot.revision)) note('Destinos con otra revisión indicada', `La mezcla de este PDF corresponde a la revisión ${snapshot.revision} de la orden. Los destinos que muestran otra revisión conservan la indicación que recibieron; esta copia no la sustituye. Consulta su historial en RCFito.`)
  const folio = snapshot.folio.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'receta'
  return { doc: finish(), reference, filename: `rcfito-receta-${folio}-r${snapshot.revision}-${reference}.pdf` }
}
