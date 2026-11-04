import { compareDisplayText, compareNamed } from './list-order.ts'
import type { CatalogRecord } from './model'

/** Keep this comparison identical to the product-synonym SQL functions. */
export const normalizeProductTerm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const compactProductTerm = (value: string) => normalizeProductTerm(value).replaceAll(' ', '')

function editDistanceWithin(left: string, right: string, maximum: number): boolean {
  if (Math.abs(left.length - right.length) > maximum) return false
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    const current = [i]
    for (let j = 1; j <= right.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1))
    if (Math.min(...current) > maximum) return false
    previous = current
  }
  return previous[right.length] <= maximum
}

export function similarProductTerms(left: string, right: string): boolean {
  const a = compactProductTerm(left), b = compactProductTerm(right)
  if (!a || !b) return false
  if (a === b) return true
  const minimum = Math.min(a.length, b.length)
  if (minimum < 4) return false
  return a.startsWith(b) || b.startsWith(a) || editDistanceWithin(a, b, minimum >= 10 ? 2 : 1)
}

/** Missing aliases preserve the old list, including when an older client edits. */
export function validateProductSynonyms(products: readonly CatalogRecord[], row: CatalogRecord): Record<string, string> {
  const errors: Record<string, string> = {}
  const existing = products.find(product => product.id === row.id)
  const aliases: unknown = row.synonyms === undefined ? existing?.synonyms ?? [] : row.synonyms
  const ownCode = row.code === undefined ? existing?.code : row.code
  const others = products.filter(product => product.id !== row.id)
  const conflictLabel = (product: CatalogRecord) => `«${product.name}»${product.active ? '' : ' (inactivo)'}`
  if (!Array.isArray(aliases) || aliases.length > 20) errors.synonyms = 'Registra una lista de hasta 20 sinónimos por producto.'
  else {
    const seen = new Set<string>()
    for (const [index, raw] of aliases.entries()) {
      if (typeof raw !== 'string') { errors.synonyms = `El sinónimo ${index + 1} debe ser texto de 2 a 80 caracteres.`; break }
      const alias = raw.trim(), compact = compactProductTerm(alias)
      if (alias.length < 2 || alias.length > 80 || !compact || raw.includes('\u0000')) { errors.synonyms = `El sinónimo ${index + 1} debe contener un nombre de 2 a 80 caracteres; no puede quedar vacío.`; break }
      if (seen.has(compact)) { errors.synonyms = `El sinónimo «${alias}» está repetido aunque cambien acentos, espacios o separadores.`; break }
      seen.add(compact)
      if (compact === compactProductTerm(row.name) || ownCode && compact === compactProductTerm(ownCode)) { errors.synonyms = `El sinónimo «${alias}» ya coincide con el nombre o código de este producto.`; break }
      const conflict = others.find(product => [product.name, product.code, ...(product.synonyms ?? [])].some(term => typeof term === 'string' && similarProductTerms(alias, term)))
      if (conflict) { errors.synonyms = `El sinónimo «${alias}» coincide o se parece al nombre, código o sinónimo de ${conflictLabel(conflict)}. Usa un nombre que identifique solo este producto.`; break }
    }
  }
  // Official names are compared fuzzily only against aliases, never against
  // other official names. Existing similar official names remain editable.
  for (const [field, value] of [['name', row.name], ['code', ownCode]] as const) {
    if (!value) continue
    const conflict = others.find(product => (product.synonyms ?? []).some(alias => similarProductTerms(value, alias)))
    if (conflict) errors[field] = `El ${field === 'name' ? 'nombre' : 'código'} «${value}» coincide o se parece a un sinónimo de ${conflictLabel(conflict)}. Revisa los términos antes de guardar.`
  }
  return errors
}

const productCollator = { compare: compareDisplayText }
export function compareProductsByName(left: CatalogRecord, right: CatalogRecord): number {
  return compareNamed(left, right)
}
const ingredientNameKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim().replace(/\s+/g, ' ')

export function productOptionLabel(product: CatalogRecord, activeIngredients: readonly CatalogRecord[]): string {
  const ingredients = new Map(activeIngredients.map(ingredient => [ingredient.id, ingredient]))
  const grouped = new Map<string, { name: string; concentrations: Set<string> }>()
  for (const relation of product.ingredients ?? []) {
    const ingredient = ingredients.get(relation.ingredient_id)
    const name = ingredient?.name.trim() || 'Ingrediente no disponible'
    const key = ingredient ? ingredientNameKey(name) : `missing:${relation.ingredient_id}`
    let group = grouped.get(key)
    if (!group) { group = { name, concentrations: new Set<string>() }; grouped.set(key, group) }
    if (relation.concentration?.trim()) group.concentrations.add(relation.concentration.trim())
  }
  const label = (group: { name: string; concentrations: Set<string> }) => group.name + (group.concentrations.size ? ` (${[...group.concentrations].sort(productCollator.compare).join('; ')})` : '')
  const sameAsProduct = grouped.get(ingredientNameKey(product.name))
  const name = sameAsProduct?.concentrations.size ? `${product.name} (${[...sameAsProduct.concentrations].sort(productCollator.compare).join('; ')})` : product.name
  if (sameAsProduct) grouped.delete(ingredientNameKey(product.name))
  const suffix = [...grouped.values()].sort((left, right) => productCollator.compare(left.name, right.name)).map(label).join(' + ')
  return suffix ? `${name} · ${suffix}` : name
}

export function buildProductOptions(products: readonly CatalogRecord[], activeIngredients: readonly CatalogRecord[], original: readonly { product_id: string }[] = []): { value: string; label: string }[] {
  const retained = new Set(original.map(product => product.product_id))
  const available = products.filter(product => product.active || retained.has(product.id)).sort(compareProductsByName)
  const nameCounts = new Map<string, number>()
  for (const product of available) {
    const name = compactProductTerm(product.name)
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  return available.map(product => {
    const collision = (nameCounts.get(compactProductTerm(product.name)) ?? 0) > 1
    const identity = product.code?.trim() || product.id
    const identityCollision = collision && available.some(other => other.id !== product.id && compactProductTerm(other.name) === compactProductTerm(product.name) && (other.code?.trim() || other.id) === identity)
    return { value: product.id, label: `${productOptionLabel(product, activeIngredients)}${collision ? ` · ${identity}${identityCollision ? ` / ${product.id}` : ''}` : ''}${product.active ? '' : ' (inactivo, conservado)'}` }
  })
}
