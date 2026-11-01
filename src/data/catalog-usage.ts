import type { SupabaseClient } from '@supabase/supabase-js'

// Read only usage IDs, so catalog maintenance does not depend on application screens.
export async function loadCatalogProductUsage(client: SupabaseClient): Promise<Set<string>> {
  const used = await Promise.all([
    ['application_order_products', 'order_id'],
    ['application_actual_products', 'target_id'],
    ['application_change_products', 'change_id', 'phase'],
  ].map(async ([table, parentKey, extraKey]) => {
    const ids: string[] = []
    for (let offset = 0; offset < 20000; offset += 500) {
      let query = client.from(table).select('product_id').order(parentKey).order('product_id')
      if (extraKey) query = query.order(extraKey)
      const { data, error } = await query.range(offset, offset + 499)
      // Older installations have no applications yet. Other failures must not unlock units.
      if (error?.code === 'PGRST205' || error?.code === '42P01') return []
      if (error) throw new Error(`No se pudo comprobar el uso de productos: ${error.message}`)
      ids.push(...(data ?? []).map(row => row.product_id as string))
      if ((data ?? []).length < 500) return ids
    }
    throw new Error('El uso de productos supera el límite de consulta de esta versión.')
  }))
  return new Set(used.flat())
}
