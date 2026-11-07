import type { SupabaseClient } from '@supabase/supabase-js'
import { isAppearance, readAppearance, type Appearance } from '@/domain/appearance'
export async function loadAppearance(client: SupabaseClient, userId: string): Promise<Appearance> {
  const {data,error} = await client.from('user_preferences').select('theme').eq('user_id',userId).maybeSingle()
  if(error) throw new Error('No se pudo consultar tu apariencia guardada. Intenta nuevamente.')
  return readAppearance(data?.theme)
}
export async function saveAppearance(client: SupabaseClient, userId: string, theme: Appearance): Promise<Appearance> {
  if(!isAppearance(theme)) throw new Error('Selecciona Sistema, Claro u Oscuro.')
  const {data,error} = await client.from('user_preferences').upsert({user_id:userId,theme},{onConflict:'user_id'}).select('theme').single()
  if(error || !data || data.theme !== theme) throw new Error('No se pudo guardar tu apariencia. Intenta nuevamente.')
  return theme
}
