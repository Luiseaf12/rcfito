import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { draftRecipeReference, type DraftRecipeDocument } from '../domain/application-draft-document.ts'
import { reportNumber } from '../lib/report-format.ts'

export type DraftPdfFonts = { regular: string; bold: string }
const dose = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 })
const water = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 })
const date = (value: string) => value ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : 'Por confirmar'
const text = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')

/** Text and tables only: no HTML, external links, API calls or workspace mutations. */
export async function createDraftRecipePdf(snapshot: DraftRecipeDocument, fonts: DraftPdfFonts) {
  const { reference, hash } = await draftRecipeReference(snapshot)
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true, putOnlyUsedFonts: true })
  doc.addFileToVFS('Vera.ttf', fonts.regular)
  doc.addFont('Vera.ttf', 'Vera', 'normal')
  doc.addFileToVFS('VeraBd.ttf', fonts.bold)
  doc.addFont('VeraBd.ttf', 'Vera', 'bold')
  doc.setFont('Vera', 'normal')
  const characters = [...new Set(JSON.stringify(snapshot))].filter(character => !/\s/.test(character))
  for (const style of ['normal', 'bold']) {
    doc.setFont('Vera', style)
    const metadata = doc.getFont().metadata as { characterToGlyph?: (code: number) => number }
    if (!metadata.characterToGlyph) throw new Error('No se pudo preparar la tipografía del PDF. Intenta exportar nuevamente.')
    const missing = characters.filter(character => !metadata.characterToGlyph!(character.codePointAt(0)!))
    if (missing.length) throw new Error(`El PDF no puede representar estos caracteres: ${missing.slice(0, 6).join(' ')}. Revisa el texto antes de exportar; el borrador se conserva.`)
  }
  doc.setFont('Vera', 'normal')
  doc.setCreationDate(new Date(snapshot.generated_at))
  doc.setFileId(hash.slice(0, 32))
  doc.setProperties({ title: 'Borrador de receta para revisión', subject: 'Indicación no guardada; dosis y agua por hectárea', author: text(snapshot.prepared_by), creator: 'RCFito' })
  const margin = 40, width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  const green: [number, number, number] = [35, 58, 48]
  const muted: [number, number, number] = [84, 98, 90]
  const generated = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Mazatlan' }).format(new Date(snapshot.generated_at))
  const drawn = new Set<number>()
  function header() {
    const page = doc.getCurrentPageInfo().pageNumber
    if (drawn.has(page)) return
    drawn.add(page)
    doc.setTextColor(...green); doc.setFont('Vera', 'bold'); doc.setFontSize(18)
    doc.text('RCFito', margin, 34)
    doc.setFontSize(16); doc.text('Borrador de receta', margin, 57)
    doc.setFont('Vera', 'normal'); doc.setFontSize(9)
    doc.text('PARA REVISIÓN - NO GUARDADO', margin, 74)
    doc.setTextColor(...muted); doc.setFontSize(7)
    doc.text(reference, margin, 88)
    doc.text(`Generado: ${generated} (Mazatlán)`, width - margin, 88, { align: 'right' })
    doc.setDrawColor(206, 220, 193); doc.setLineWidth(1); doc.line(margin, 94, width - margin, 94)
  }
  header()
  let y = 106
  function table(options: UserOptions) {
    autoTable(doc, {
      theme: 'striped', startY: y, margin: { left: margin, right: margin, top: 106, bottom: 54 }, rowPageBreak: 'avoid',
      headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 240] }, willDrawPage: header,
      ...options, styles: { font: 'Vera', fontSize: 9, cellPadding: 6, textColor: green, overflow: 'linebreak', valign: 'top', ...options.styles },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
  }
  function section(title: string) {
    if (y > height - 118) { doc.addPage(); header(); y = 110 }
    doc.setTextColor(...green); doc.setFont('Vera', 'bold'); doc.setFontSize(11)
    doc.text(title, margin, y); y += 11
  }
  const label = (value: string) => ({ content: value, styles: { fontStyle: 'bold' as const } })
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
  table({ theme: 'plain', pageBreak: 'avoid', head: [['Nota de la aplicación']], headStyles: { fillColor: [245, 247, 240], textColor: green, fontStyle: 'bold', fontSize: 11 }, styles: { cellPadding: 4 }, body: [[text(snapshot.observations) || 'Sin nota.']] })
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(220, 227, 216); doc.setLineWidth(.5); doc.line(margin, height - 43, width - margin, height - 43)
    doc.setFont('Vera', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted)
    doc.text('Borrador para confirmar destinos y dosis. No acredita un registro ni una autorización.', margin, height - 30)
    doc.text(`${reference} - Página ${page} de ${pages}`, width - margin, height - 17, { align: 'right' })
  }
  return { doc, reference, filename: `rcfito-borrador-${snapshot.indicated_date}-${reference}.pdf` }
}
