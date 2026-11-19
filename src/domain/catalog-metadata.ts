import type { CatalogRecord, WorkspaceData } from './model'
import { compactProductTerm } from './product-synonyms'

export const classificationIds = (record?: Partial<CatalogRecord>): string[] => record?.classification_ids ?? (record?.classification_id ? [record.classification_id] : [])
export function classificationLabel(record: CatalogRecord, options: CatalogRecord[]): string {
  return classificationIds(record).map(id => `${options.find(item => item.id === id)?.name ?? 'Clasificación no disponible'}${id === record.classification_id ? ' (principal)' : ''}`).join(' · ') || 'Sin clasificaciones'
}
export function validateIngredientSynonyms(records: CatalogRecord[], row: CatalogRecord): Record<string, string> {
  const aliases = row.synonyms ?? records.find(item => item.id === row.id)?.synonyms ?? []
  if (!Array.isArray(aliases) || aliases.length > 20) return { synonyms: 'Registra hasta 20 sinónimos por ingrediente.' }
  const seen = new Set<string>()
  const others = records.filter(item => item.id !== row.id)
  for (const raw of aliases) {
    if (typeof raw !== 'string' || raw.trim().length < 2 || raw.trim().length > 80 || !compactProductTerm(raw) || raw.includes('\0')) return { synonyms: 'Cada sinónimo debe contener de 2 a 80 caracteres.' }
    const key = compactProductTerm(raw)
    if (seen.has(key)) return { synonyms: `El sinónimo «${raw}» está repetido.` }
    seen.add(key)
    if ([row.name, row.code].some(term => term && compactProductTerm(term) === key)) return { synonyms: `El sinónimo «${raw}» ya es el nombre o código del ingrediente.` }
    const conflict = others.find(item => [item.name, item.code, ...(item.synonyms ?? [])].some(term => term && compactProductTerm(term) === key))
    if (conflict) return { synonyms: `El sinónimo «${raw}» ya identifica al ingrediente «${conflict.name}».` }
  }
  for (const field of ['name', 'code'] as const) {
    const term = row[field]
    const conflict = term && others.find(item => item.synonyms?.some(alias => compactProductTerm(alias) === compactProductTerm(term)))
    if (conflict) return { [field]: `Ese nombre ya es un sinónimo de «${conflict.name}».` }
  }
  return {}
}
export function metadataSnapshot(record: CatalogRecord, data: WorkspaceData, kind = 'active_ingredients') {
  return { name: record.name, active: record.active, ...(kind === 'active_ingredients' ? {classification_id: record.classification_id ?? null, classifications: classificationIds(record).slice().sort().map(id => ({ id, name: data.catalogs.ingredient_classifications.find(item => item.id === id)?.name ?? id }))} : {}), synonyms: [...(record.synonyms ?? [])].sort() }
}
