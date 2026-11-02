import { draftRecipeReference, type DraftRecipeDocument } from '../domain/application-draft-document.ts'
import { reportNumber } from '../lib/report-format.ts'
import { recipePdfLayout, pdfText as text, pdfDate as date, pdfLabel as label, type RecipePdfFonts } from './recipe-pdf-layout.ts'

export type DraftPdfFonts = RecipePdfFonts
const dose = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 })
const water = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 })

/** Text and tables only: no HTML, external links, API calls or workspace mutations. */
export async function createDraftRecipePdf(snapshot: DraftRecipeDocument, fonts: DraftPdfFonts) {
  const { reference, hash } = await draftRecipeReference(snapshot)
  const { table, section, note, finish } = recipePdfLayout({ generated_at: snapshot.generated_at, reference, hash, title: 'Borrador de receta', status: 'PARA REVISIÓN - NO GUARDADO', subject: 'Indicación no guardada; dosis y agua por hectárea', author: snapshot.prepared_by, footer: 'Borrador para confirmar destinos y dosis. No acredita un registro ni una autorización.', content: snapshot }, fonts)
  table({ theme: 'plain', styles: { cellPadding: 4, fontSize: 8.5 }, columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 196 }, 2: { cellWidth: 72 }, 3: { cellWidth: 198 } }, body: [
    [label('Agrícola'), text(snapshot.agricultural_unit), label('Temporada'), text(snapshot.season)],
    [label('Proyecto'), text(snapshot.project), label('Campo'), text(snapshot.field)],
    [label('Cultivo'), text(snapshot.crop), label('Medio'), text(snapshot.method)],
    [label('Indicación'), date(snapshot.indicated_date), label('Aplicación'), snapshot.scheduled_date ? date(snapshot.scheduled_date) : 'Fecha programada por confirmar'],
    [label('Destinos'), text(snapshot.selection), label('Preparó'), text(snapshot.prepared_by)],
    [label('Receta base'), { content: snapshot.source ? `${text(snapshot.source.folio)} - versión ${snapshot.source.revision}` : 'Captura desde cero', colSpan: 3 }],
    [label('Numeración'), { content: snapshot.requested_number ? `${snapshot.requested_number} (propuesta, sin reservar)` : 'Automática al guardar; aún no se reserva numeración.', colSpan: 3 }],
  ] })
  section(`Lotes y etapas seleccionados (${snapshot.targets.length})`)
  table({ head: [['Lote', 'Subdivisión', 'Etapa', 'Variedad', 'Superficie (ha)']], columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 144 }, 2: { cellWidth: 43, halign: 'center' }, 3: { cellWidth: 149 }, 4: { cellWidth: 91, halign: 'right' } }, body: snapshot.targets.map(target => [text(target.lot), text(target.subdivision), String(target.stage_number), text(target.variety), reportNumber.format(target.area_ha)]) })
  section('Productos, dosis y agua por hectárea')
  table({ head: [['Código', 'Producto / agua', 'Dosis / gasto', 'Unidad']], columnStyles: { 0: { cellWidth: 78 }, 1: { cellWidth: 284 }, 2: { cellWidth: 98, halign: 'right' }, 3: { cellWidth: 72 } }, body: [
    ...snapshot.products.map(product => [text(product.code) || '-', text(product.name), dose.format(product.dose), `${product.unit}/ha`]),
    ['AGUA', 'Gasto de agua', water.format(snapshot.water_l_ha), 'L/ha'],
  ] })
  note('Nota de la aplicación', snapshot.observations)
  return { doc: finish(), reference, filename: `rcfito-borrador-${snapshot.indicated_date}-${reference}.pdf` }
}
