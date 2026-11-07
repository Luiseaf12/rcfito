import { Monitor, Moon, Sun } from 'lucide-react'
import { useAppearance } from '@/data/appearance-context'
import { isAppearance } from '@/domain/appearance'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
export function AppearanceMenu(){
  const {value,busy,error,save,retry}=useAppearance()
  const Icon=value==='system'?Monitor:value==='dark'?Moon:Sun
  return <div className="appearance-control"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Apariencia: ${value==='system'?'Sistema':value==='dark'?'Oscuro':'Claro'}${busy?', guardando o consultando':''}`} disabled={busy}><Icon aria-hidden="true"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Apariencia</DropdownMenuLabel><DropdownMenuRadioGroup value={value} onValueChange={selected=>{if(isAppearance(selected))void save(selected)}}><DropdownMenuRadioItem value="system">Sistema</DropdownMenuRadioItem><DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem><DropdownMenuRadioItem value="dark">Oscuro</DropdownMenuRadioItem></DropdownMenuRadioGroup><DropdownMenuSeparator/><p className="appearance-help">Se guarda en tu usuario. Sistema sigue la apariencia de este equipo.</p></DropdownMenuContent></DropdownMenu>{error&&<div className="appearance-error" role="alert"><span>{error}</span><Button size="sm" variant="outline" onClick={retry}>Reintentar</Button></div>}</div>
}
