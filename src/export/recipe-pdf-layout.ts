import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'

export type RecipePdfFonts = { regular: string; bold: string }
export const pdfText = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
export const pdfDate = (value: string) => value ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : 'Por confirmar'
export const pdfLabel = (value: string) => ({ content: value, styles: { fontStyle: 'bold' as const } })

/** Shared local typography, tables and pagination for recipe copies. */
export function recipePdfLayout(input: { generated_at: string; reference: string; hash: string; title: string; status: string; subject: string; author: string; footer: string; content: unknown }, fonts: RecipePdfFonts) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true, putOnlyUsedFonts: true })
  doc.addFileToVFS('Vera.ttf', fonts.regular); doc.addFont('Vera.ttf', 'Vera', 'normal')
  doc.addFileToVFS('VeraBd.ttf', fonts.bold); doc.addFont('VeraBd.ttf', 'Vera', 'bold')
  const characters = [...new Set(JSON.stringify(input))].filter(character => !/\s/.test(character))
  for (const style of ['normal', 'bold']) {
    doc.setFont('Vera', style)
    const metadata = doc.getFont().metadata as { characterToGlyph?: (code: number) => number }
    if (!metadata.characterToGlyph) throw new Error('No se pudo preparar la tipografía del PDF. Intenta exportar nuevamente.')
    const missing = characters.filter(character => !metadata.characterToGlyph!(character.codePointAt(0)!))
    if (missing.length) throw new Error(`El PDF no puede representar estos caracteres: ${missing.slice(0, 6).join(' ')}. No se cambió ningún dato.`)
  }
  doc.setFont('Vera', 'normal'); doc.setCreationDate(new Date(input.generated_at)); doc.setFileId(input.hash.slice(0, 32))
  doc.setProperties({ title: input.title, subject: input.subject, author: pdfText(input.author), creator: 'RCFito' })
  const margin = 40, width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  const green: [number, number, number] = [35, 58, 48], muted: [number, number, number] = [84, 98, 90]
  const generated = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Mazatlan' }).format(new Date(input.generated_at))
  const drawn = new Set<number>()
  function header() {
    const page = doc.getCurrentPageInfo().pageNumber
    if (drawn.has(page)) return
    drawn.add(page)
    doc.setTextColor(...green); doc.setFont('Vera', 'bold'); doc.setFontSize(18); doc.text('RCFito', margin, 34)
    doc.setFontSize(16); doc.text(input.title, margin, 57)
    doc.setFont('Vera', 'normal'); doc.setFontSize(9); doc.text(input.status, margin, 74)
    doc.setTextColor(...muted); doc.setFontSize(7); doc.text(input.reference, margin, 88)
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
    doc.setTextColor(...green); doc.setFont('Vera', 'bold'); doc.setFontSize(11); doc.text(title, margin, y); y += 11
  }
  function note(title: string, value: string) {
    table({ theme: 'plain', pageBreak: 'avoid', head: [[title]], headStyles: { fillColor: [245, 247, 240], textColor: green, fontStyle: 'bold', fontSize: 11 }, styles: { cellPadding: 4 }, body: [[pdfText(value) || 'Sin nota.']] })
  }
  function finish() {
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page); doc.setDrawColor(220, 227, 216); doc.setLineWidth(.5); doc.line(margin, height - 43, width - margin, height - 43)
      doc.setFont('Vera', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted)
      doc.text(input.footer, margin, height - 30)
      doc.text(`${input.reference} - Página ${page} de ${pages}`, width - margin, height - 17, { align: 'right' })
    }
    return doc
  }
  return { table, section, note, finish }
}
