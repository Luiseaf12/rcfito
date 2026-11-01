import type { CatalogKind, CatalogRecord, WorkspaceData } from './model'
import { compactProductTerm, validateProductSynonyms } from './product-synonyms.ts'

// Applications may not be installed yet. Both editions use the same catalog rules.
type CatalogEditContext = Pick<WorkspaceData, 'catalogs' | 'lots' | 'stages'> & {
  applicationOrders?: readonly { products: readonly { product_id: string }[] }[]
  applicationTargets?: readonly { actual_products: readonly { product_id: string }[] }[]
  applicationChanges?: readonly { before: { products: readonly { product_id: string }[] }; after: { products: readonly { product_id: string }[] } }[]
}
type LockedField = 'agricultural_unit_id' | 'crop_id' | 'unit'

export function catalogEditLocks(data: CatalogEditContext, kind: CatalogKind, record?: CatalogRecord): Partial<Record<LockedField, string>> {
  if (!record) return {}
  if (kind === 'fields' && data.lots.some(lot => lot.field_id === record.id)) {
    return { agricultural_unit_id: 'La agrícola no puede cambiar porque este campo ya tiene lotes relacionados. Puedes editar su nombre, clave y estado.' }
  }
  if (kind === 'varieties' && data.stages.some(stage => stage.variety_id === record.id)) {
    return { crop_id: 'El cultivo no puede cambiar porque esta variedad ya se utilizó en etapas de siembra. Puedes editar su nombre y estado.' }
  }
  if (kind === 'products' && (
    record.unit_locked ||
    data.applicationOrders?.some(order => order.products.some(product => product.product_id === record.id)) ||
    data.applicationTargets?.some(target => target.actual_products.some(product => product.product_id === record.id)) ||
    data.applicationChanges?.some(change => [change.before, change.after].some(snapshot => snapshot.products.some(product => product.product_id === record.id)))
  )) {
    return { unit: 'La unidad no puede cambiar porque este producto ya se utilizó en aplicaciones. Las dosis y cantidades históricas conservan su unidad original.' }
  }
  return {}
}

// Existing inactive references remain valid; only new relationships require active records.
export function catalogRelationOptions(records: CatalogRecord[], existingIds: readonly string[] = []) {
  return records.filter(record => record.active || existingIds.includes(record.id)).map(record => ({
    value: record.id,
    label: `${record.name}${record.active ? '' : ' (inactivo)'}`,
  }))
}

export function validateCatalogEdit(data: CatalogEditContext, kind: CatalogKind, row: CatalogRecord): Record<string, string> {
  const errors: Record<string, string> = {}
  const existing = data.catalogs[kind].find(record => record.id === row.id)
  const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX')
  const unchangedProductName = kind === 'products' && existing && existing.name.trim() === row.name.trim()
  if (!row.name.trim()) errors.name = 'Escribe el nombre del registro.'
  else if (!unchangedProductName && data.catalogs[kind].some(record => record.id !== row.id && (kind === 'products' ? compactProductTerm(record.name) === compactProductTerm(row.name) : normalize(record.name) === normalize(row.name)) &&
    (kind !== 'fields' || record.agricultural_unit_id === row.agricultural_unit_id) &&
    (kind !== 'varieties' || record.crop_id === row.crop_id))) errors.name = 'Ya existe un registro con ese nombre en este ámbito.'

  const locks = catalogEditLocks(data, kind, existing)
  for (const field of ['agricultural_unit_id', 'crop_id', 'unit'] as const) {
    if (locks[field] && row[field] !== existing?.[field]) errors[field] = locks[field]!
  }
  const relation = (catalog: CatalogKind, id: string | null | undefined, previous: string | null | undefined, field: string, label: string) => {
    const record = data.catalogs[catalog].find(item => item.id === id)
    if (!record || (!record.active && id !== previous)) errors[field] ??= `Selecciona ${label} disponible. Una referencia inactiva existente puede conservarse.`
  }
  if (kind === 'fields') relation('agricultural_units', row.agricultural_unit_id, existing?.agricultural_unit_id, 'agricultural_unit_id', 'una agrícola activa')
  if (kind === 'varieties') relation('crops', row.crop_id, existing?.crop_id, 'crop_id', 'un cultivo activo')
  if (kind === 'active_ingredients' && row.classification_id) relation('ingredient_classifications', row.classification_id, existing?.classification_id, 'classification_id', 'una clasificación activa')
  if (kind === 'products') {
    Object.assign(errors, validateProductSynonyms(data.catalogs.products, row))
    if (!['g', 'ml'].includes(row.unit ?? '')) errors.unit = 'Selecciona gramos o mililitros.'
    if (!Number.isFinite(row.default_dose) || row.default_dose! < 0) errors.default_dose = 'Captura una dosis válida mayor o igual a cero.'
    if (row.brand_id) relation('brands', row.brand_id, existing?.brand_id, 'brand_id', 'una marca activa')
    if (row.family_id) relation('product_families', row.family_id, existing?.family_id, 'family_id', 'una familia activa')
    const ids = (row.ingredients ?? []).map(item => item.ingredient_id)
    if (new Set(ids).size !== ids.length) errors.ingredients = 'Cada ingrediente solo puede agregarse una vez.'
    for (const id of ids) relation('active_ingredients', id, existing?.ingredients?.find(item => item.ingredient_id === id)?.ingredient_id, 'ingredients', 'un ingrediente activo')
  }
  return errors
}
