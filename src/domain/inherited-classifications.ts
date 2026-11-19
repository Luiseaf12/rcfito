import { classificationIds } from './catalog-metadata'
import type { CatalogRecord, ClassificationSnapshot, ProductLine, WorkspaceData } from './model'

export function productClassifications(data: WorkspaceData, product: CatalogRecord, origin: ClassificationSnapshot['origin'] = 'draft', capturedAt = new Date().toISOString()): ClassificationSnapshot {
  const ingredients = (product.ingredients ?? []).map(relation => {
    const ingredient = data.catalogs.active_ingredients.find(item => item.id === relation.ingredient_id)
    return { id: relation.ingredient_id, name: ingredient?.name ?? 'Ingrediente no disponible', classification_id: ingredient?.classification_id ?? null, classifications: classificationIds(ingredient).map(id => ({ id, name: data.catalogs.ingredient_classifications.find(item => item.id === id)?.name ?? 'Clasificación no disponible' })) }
  })
  const classifications = [...new Map(ingredients.flatMap(item => item.classifications).map(item => [item.id, item])).values()].sort((a,b) => a.id.localeCompare(b.id))
  return { origin, captured_at: capturedAt, ingredients, classifications, complete: ingredients.length > 0 && ingredients.every(item => item.classifications.length > 0 && item.name !== 'Ingrediente no disponible') }
}
export function inheritedProduct(data: WorkspaceData, record: CatalogRecord): CatalogRecord {
  const snapshot = record.inherited_classifications ?? productClassifications(data, record)
  return { ...record, inherited_classifications:snapshot, classification_ids: snapshot.classifications.map(item => item.id), classification_id: null }
}
export function classificationText(snapshot?: ClassificationSnapshot): string {
  if (!snapshot) return 'Sin clasificación histórica disponible'
  return `${snapshot.classifications.map(item => item.name).join(' · ') || 'Sin clasificaciones'}${snapshot.complete ? '' : ' · Clasificación incompleta'}${snapshot.origin === 'reconstructed' ? ' · Reconstruida' : ''}`
}
export function snapshotForProduct(data: WorkspaceData, id: string, origin: ClassificationSnapshot['origin'], capturedAt: string) {
  return productClassifications(data, data.catalogs.products.find(item => item.id === id) ?? { id, name: '', active: false }, origin, capturedAt)
}

/** Demo upgrade only. Real snapshots are captured and authorized by Postgres. */
export function completeInheritedWorkspace(data: WorkspaceData, previous?: WorkspaceData): WorkspaceData {
  const result = structuredClone(data), capturedAt = new Date().toISOString()
  const stamp = (products: ProductLine[], force = false) => products.forEach(product => {
    if (force || !product.classification_snapshot) product.classification_snapshot = snapshotForProduct(result, product.product_id, previous ? 'recorded' : 'reconstructed', capturedAt)
  })
  result.catalogs.products.forEach(product => { delete product.classification_ids; delete product.classification_id })
  for (const order of result.applicationOrders) stamp(order.products)
  for (const change of result.applicationChanges) {
    stamp(change.before.products)
    stamp(change.after.products, !!previous && !previous.applicationChanges.some(item => item.id === change.id))
  }
  for (const target of result.applicationTargets) {
    const prior = previous?.applicationTargets.find(item => item.id === target.id)
    stamp(target.actual_products, !!previous && (prior?.status !== target.status || prior?.correction_version !== target.correction_version))
  }
  for (const change of result.catalogMetadataChanges ?? []) if (change.kind === 'products') {
    for (const snapshot of [change.before, change.after]) if (snapshot) { delete snapshot.classifications; delete snapshot.classification_id }
  }
  result.catalogMetadataChanges=result.catalogMetadataChanges?.filter(change=>change.kind!=='products'||JSON.stringify(change.before)!==JSON.stringify(change.after))
  return result
}
