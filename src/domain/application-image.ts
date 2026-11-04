import { validateExtractedApplication } from './application-import.ts'
import type { ExtractedApplication } from './application-import.ts'
import type { ApplicationProductInput, ApplicationSourceCapture, CatalogRecord, ImageTotalUnit } from './model'

export type { ImageTotalUnit } from './model'
export type ImageSourceCapture = ApplicationSourceCapture
export type ImageExtraction = Omit<ExtractedApplication, 'products'> & {
  products: { name: string; presentation: string; quantity: number | null; unit: ImageTotalUnit | null }[]
  source_text: string
}
export type ImageTotalRow = { key: string; product_id: string; sourceName: string; presentation: string; quantity: string; totalUnit: ImageTotalUnit | null }
export type ImageSelectedStage = { stage_id: string; area_ha: number }
export type ApplicationImageIssue = { field: string; message: string }
export type ImageDoseRow = { product_id: string; dose: string; sourceName: string; importUnit: 'g' | 'ml' | null }
export type ImageAllocationLine = {
  key: string; product_id: string; source_name: string; presentation: string; quantity: number; unit: ImageTotalUnit; base_unit: 'g' | 'ml'
  /** Totals and delta use the original total unit; dose uses base units per hectare. */
  original_total: number; reconstructed_total: number; delta: number; dose: string
}
export type ImageAllocation = { errors: ApplicationImageIssue[]; doseRows: ImageDoseRow[]; area_ha: number; allocations: ImageAllocationLine[]; source_capture: ApplicationSourceCapture | null }

type Decimal = { coefficient: bigint; scale: number }
const units = ['g', 'kg', 'ml', 'L'] as const
const extractionKeys = ['agricultural_unit', 'destinations', 'application_number', 'crop', 'field', 'method', 'indicated_date', 'scheduled_date', 'water_l_ha', 'note', 'products', 'source_text'] as const
const fail = (message: string): never => { throw new Error(message) }
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(`${label} debe ser un objeto válido.`)
  return value as Record<string, unknown>
}
const onlyKeys = (row: Record<string, unknown>, keys: readonly string[], label: string) => {
  if (Object.keys(row).some(key => !keys.includes(key))) fail(`${label} contiene campos no admitidos.`)
}
const literalText = (value: unknown, limit: number, label: string): string => {
  if (typeof value !== 'string' || value.length > limit || value.includes('\u0000')) return fail(`${label} debe ser texto de hasta ${limit.toLocaleString('es-MX')} caracteres sin caracteres nulos.`)
  return value
}
const isUnit = (value: unknown): value is ImageTotalUnit => units.includes(value as ImageTotalUnit)
const baseUnit = (unit: ImageTotalUnit): 'g' | 'ml' => unit === 'g' || unit === 'kg' ? 'g' : 'ml'
const pow10 = (scale: number) => 10n ** BigInt(scale)

/** Parse decimal notation as written, including JSON's exponent form, without binary arithmetic. */
function decimal(value: string): Decimal | null {
  if (value.length > 400) return null
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d{1,3}))?$/.exec(value.trim())
  if (!match) return null
  const exponent = Number(match[5] ?? 0)
  let scale = (match[3] ?? match[4] ?? '').length - exponent
  let coefficient = BigInt(`${match[1]}${match[2] ?? '0'}${match[3] ?? match[4] ?? ''}`)
  if (scale < 0) { coefficient *= pow10(-scale); scale = 0 }
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale-- }
  return { coefficient, scale }
}
function decimalText(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n
  let digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0')
  if (scale > 0) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '')
  return `${negative && coefficient !== 0n ? '-' : ''}${digits}`
}
function positiveAmount(value: unknown, label: string, decimals: number, limit = 100_000_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= limit) return fail(`${label} debe ser mayor que cero y menor que ${limit.toLocaleString('es-MX')}.`)
  const parsed = decimal(String(value))
  if (!parsed || parsed.scale > decimals) return fail(`${label} admite como máximo ${decimals} decimales.`)
  return value
}
function totalArea(selected: readonly ImageSelectedStage[]): { area: Decimal; area_ha: number } {
  if (!Array.isArray(selected) || !selected.length) return fail('Selecciona al menos una etapa completa para repartir las cantidades totales.')
  if (selected.some(stage => typeof stage?.stage_id !== 'string' || !stage.stage_id.trim()) || new Set(selected.map(stage => stage.stage_id)).size !== selected.length) return fail('Selecciona destinos completos sin repetir etapas para calcular la superficie.')
  const areas = selected.map((stage, index) => {
    if (typeof stage.area_ha !== 'number' || !Number.isFinite(stage.area_ha) || stage.area_ha <= 0) return fail(`El destino ${index + 1} necesita una superficie vigente mayor que cero.`)
    const parsed = decimal(String(stage.area_ha))!
    if (parsed.scale > 4) return fail(`La superficie del destino ${index + 1} admite como máximo 4 decimales; actualiza la selección.`)
    return parsed
  })
  const scale = Math.max(...areas.map(area => area.scale))
  const area = { coefficient: areas.reduce((sum, value) => sum + value.coefficient * pow10(scale - value.scale), 0n), scale }
  const area_ha = Number(decimalText(area.coefficient, area.scale))
  if (!Number.isFinite(area_ha) || area_ha <= 0) return fail('La superficie total seleccionada no es un número válido mayor que cero.')
  return { area, area_ha }
}

/** Validate OCR/model output without guessing missing totals or converting a presentation into quantity. */
export function validateImageExtraction(value: unknown): ImageExtraction {
  const raw = object(value, 'La interpretación de la imagen')
  onlyKeys(raw, extractionKeys, 'La interpretación de la imagen')
  const source = raw.products ?? []
  if (!Array.isArray(source) || source.length > 40) return fail('La imagen admite como máximo 40 renglones de productos.')
  const products: ImageExtraction['products'] = source.map((value, index) => {
    const row = object(value, `El producto del renglón ${index + 1}`)
    onlyKeys(row, ['name', 'presentation', 'quantity', 'unit'], `El producto del renglón ${index + 1}`)
    const unit = row.unit ?? null
    if (unit !== null && !isUnit(unit)) return fail(`Aclara la unidad del renglón ${index + 1}: usa g, kg, ml o L.`)
    return {
      name: literalText(row.name ?? '', 200, `El nombre del renglón ${index + 1}`),
      presentation: literalText(row.presentation ?? '', 200, `La presentación del renglón ${index + 1}`),
      quantity: row.quantity == null ? null : positiveAmount(row.quantity, `La cantidad total del renglón ${index + 1}`, 6), unit,
    }
  })
  const { source_text: _sourceText, products: _products, ...context } = raw
  const validated = validateExtractedApplication({ ...context, products: [] })
  return { ...validated, products, source_text: literalText(raw.source_text ?? '', 20000, 'El texto extraído de la imagen') }
}

/** Validate source metadata even on a retry. Catalog/surface checks run only for a new order. */
export function validateImageSourceCapture(value: unknown): ApplicationSourceCapture {
  const raw = object(value, 'El origen de la imagen')
  onlyKeys(raw, ['kind', 'area_ha', 'products'], 'El origen de la imagen')
  if (raw.kind !== 'image_totals') return fail('El origen de captura debe indicar cantidades totales de imagen.')
  if (typeof raw.area_ha !== 'number' || !Number.isFinite(raw.area_ha) || raw.area_ha <= 0 || decimal(String(raw.area_ha))!.scale > 4) return fail('La superficie del origen de imagen debe ser positiva y admitir como máximo 4 decimales.')
  if (!Array.isArray(raw.products) || !raw.products.length || raw.products.length > 40) return fail('El origen de imagen necesita de 1 a 40 renglones de productos.')
  const products = raw.products.map((value, index): ApplicationSourceCapture['products'][number] => {
    const row = object(value, `El origen del renglón ${index + 1}`)
    onlyKeys(row, ['product_id', 'source_name', 'presentation', 'quantity', 'unit'], `El origen del renglón ${index + 1}`)
    if (typeof row.product_id !== 'string' || !row.product_id.trim()) return fail(`Selecciona el producto del renglón ${index + 1}.`)
    if (!isUnit(row.unit)) return fail(`Aclara la unidad total del renglón ${index + 1}: usa g, kg, ml o L.`)
    return { product_id: row.product_id, source_name: literalText(row.source_name, 200, `El nombre de origen del renglón ${index + 1}`), presentation: literalText(row.presentation, 200, `La presentación de origen del renglón ${index + 1}`), quantity: positiveAmount(row.quantity, `La cantidad total del renglón ${index + 1}`, 6), unit: row.unit }
  })
  if (new Set(products.map(row => row.product_id)).size !== products.length) return fail('Un producto no puede repetirse entre las cantidades totales de la imagen.')
  return { kind: 'image_totals', area_ha: raw.area_ha, products: products.sort((a, b) => a.product_id.localeCompare(b.product_id)) }
}

/** Exact decimal HALF_UP allocation, followed by a reviewable reconstruction in the original units. */
export function buildImageAllocation(rows: readonly ImageTotalRow[], selected: readonly ImageSelectedStage[], productsCatalog: readonly CatalogRecord[]): ImageAllocation {
  const errors: ApplicationImageIssue[] = []
  const allocations: ImageAllocationLine[] = []
  const doseRows: ImageDoseRow[] = []
  const sourceProducts: ApplicationSourceCapture['products'] = []
  let area: Decimal | null = null
  let area_ha = 0
  try { ({ area, area_ha } = totalArea(selected)) } catch (error) { errors.push({ field: 'destinations', message: (error as Error).message }) }
  if (!rows.length || rows.length > 40) errors.push({ field: 'products', message: 'Agrega de 1 a 40 renglones con las cantidades totales de la imagen.' })
  const repeated = new Set(rows.filter(row => row.product_id && rows.filter(other => other.product_id === row.product_id).length > 1).map(row => row.product_id))
  rows.forEach((row, index) => {
    const add = (field: string, message: string) => errors.push({ field: `${field}:${index}`, message: `Renglón ${index + 1}: ${message}` })
    const before = errors.length
    const product = productsCatalog.find(product => product.id === row.product_id)
    if (!row.product_id) add('product', 'selecciona el producto del catálogo para conservar su código.')
    else if (!product?.active) add('product', 'selecciona un producto activo del catálogo.')
    if (repeated.has(row.product_id)) add('product', 'el producto se repite; reúne sus cantidades en un solo renglón antes de aprobar.')
    if (typeof row.sourceName !== 'string' || row.sourceName.length > 200 || row.sourceName.includes('\u0000')) add('sourceName', 'el nombre original debe ser texto de hasta 200 caracteres sin caracteres nulos.')
    if (typeof row.presentation !== 'string' || row.presentation.length > 200 || row.presentation.includes('\u0000')) add('presentation', 'la presentación debe ser texto de hasta 200 caracteres sin caracteres nulos.')
    const unit = isUnit(row.totalUnit) ? row.totalUnit : null
    const importUnit = unit ? baseUnit(unit) : null
    if (!unit) add('unit', 'aclara la unidad de la cantidad total: g, kg, ml o L.')
    if (product?.active && (product.unit !== 'g' && product.unit !== 'ml')) add('unit', 'el producto necesita una unidad fija g o ml en el catálogo.')
    else if (product?.active && importUnit && product.unit !== importUnit) add('unit', `la imagen indica ${unit} y el catálogo usa ${product.unit}; aclara si es masa o volumen antes de aprobar.`)
    const parsed = typeof row.quantity === 'string' ? decimal(row.quantity) : null
    const quantity = parsed ? Number(row.quantity) : NaN
    if (!parsed || !Number.isFinite(quantity) || quantity <= 0 || quantity >= 100_000_000) add('quantity', 'captura una cantidad total mayor que cero y menor que 100,000,000.')
    else if (parsed.scale > 6) add('quantity', 'la cantidad total admite como máximo 6 decimales; aclara el valor sin redondearlo.')
    const doseRow: ImageDoseRow = { product_id: row.product_id, dose: '', sourceName: row.sourceName, importUnit }
    doseRows.push(doseRow)
    if (errors.length !== before || !area || !parsed || !unit || !importUnit) return
    const multiplier = unit === 'kg' || unit === 'L' ? 1000n : 1n
    const numerator = parsed.coefficient * multiplier * pow10(6 + area.scale)
    const denominator = area.coefficient * pow10(parsed.scale)
    const quotient = numerator / denominator
    const rounded = quotient + (numerator % denominator * 2n >= denominator ? 1n : 0n)
    if (rounded <= 0n || rounded >= 100_000_000n * 1_000_000n) { add('quantity', 'la dosis calculada debe ser mayor que cero y menor que 100,000,000 por hectárea después del redondeo a 6 decimales.'); return }
    const dose = decimalText(rounded, 6)
    doseRow.dose = dose
    const reconstructedScale = 6 + area.scale + (multiplier === 1000n ? 3 : 0)
    const reconstructed = rounded * area.coefficient
    const deltaScale = Math.max(reconstructedScale, parsed.scale)
    const difference = reconstructed * pow10(deltaScale - reconstructedScale) - parsed.coefficient * pow10(deltaScale - parsed.scale)
    allocations.push({ key: row.key, product_id: row.product_id, source_name: row.sourceName, presentation: row.presentation, quantity, unit, base_unit: importUnit, original_total: quantity, reconstructed_total: Number(decimalText(reconstructed, reconstructedScale)), delta: Number(decimalText(difference, deltaScale)), dose })
    sourceProducts.push({ product_id: row.product_id, source_name: row.sourceName, presentation: row.presentation, quantity, unit })
  })
  return { errors, doseRows, area_ha, allocations, source_capture: errors.length ? null : { kind: 'image_totals', area_ha, products: sourceProducts } }
}

/** Recompute from current complete stages; a stale area or edited dose must be reviewed again. */
export function validateImageOrderSourceCapture(value: unknown, selected: readonly ImageSelectedStage[], productsCatalog: readonly CatalogRecord[], products: readonly ApplicationProductInput[]): ApplicationSourceCapture {
  const source = validateImageSourceCapture(value)
  const allocation = buildImageAllocation(source.products.map((row, index) => ({ key: String(index), product_id: row.product_id, sourceName: row.source_name, presentation: row.presentation, quantity: String(row.quantity), totalUnit: row.unit })), selected, productsCatalog)
  if (allocation.errors.length) return fail(allocation.errors.map(issue => issue.message).join(' '))
  if (source.area_ha !== allocation.area_ha) return fail('La superficie seleccionada cambió desde el reparto de la imagen. Revisa y calcula las dosis nuevamente antes de aprobar.')
  if (products.length !== allocation.doseRows.length || new Set(products.map(row => row.product_id)).size !== products.length || allocation.doseRows.some(row => !products.some(product => product.product_id === row.product_id && typeof product.dose === 'number' && product.dose === Number(row.dose)))) return fail('Las dosis de los productos no corresponden al reparto uniforme de los totales de la imagen. Revisa y calcula las dosis nuevamente antes de aprobar.')
  return source
}

/** Canonical creation identity: product order does not change the original source. */
export function imageSourceCaptureKey(source: ApplicationSourceCapture | null | undefined): string | null {
  if (source == null) return null
  return JSON.stringify({ kind: source.kind, area_ha: source.area_ha, products: source.products.map(row => ({ product_id: row.product_id, source_name: row.source_name, presentation: row.presentation, quantity: row.quantity, unit: row.unit })).sort((a, b) => a.product_id.localeCompare(b.product_id)) })
}
