import { sortDisplay } from '@/domain/list-order'
import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { currentOrderIndication } from '@/domain/application-editing'
import { searchRecipes, type RecipeCandidate } from '@/domain/application-recipes'
import type { WorkspaceData } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { dosage } from './application-fields'
import { EmptyState, formatDate, recordName, RecordDialog, SearchField } from './shared'

export function ApplicationRecipePicker({ data, history, latest, selectedId, close, choose }: {
  data: WorkspaceData
  history: RecipeCandidate[]
  latest: RecipeCandidate[]
  selectedId?: string
  close: () => void
  choose: (candidate: RecipeCandidate) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => searchRecipes(data, history, query), [data, history, query])
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  return <RecordDialog title="Buscar receta anterior" description="Solo recetas activas de los destinos seleccionados en sus etapas vigentes. Se copiará la última versión indicada." open onOpenChange={open => { if (!open) close() }} wide>
    <SearchField label="Buscar recetas" placeholder="Folio, fecha, producto, medio o nota…" value={query} onChange={value => { setQuery(value); setPage(1) }} />
    <p className="muted" role="status">{filtered.length} {filtered.length === 1 ? 'receta encontrada' : 'recetas encontradas'}</p>
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(candidate => {
        const order = data.applicationOrders.find(item => item.id === candidate.order_id)!
        const indication = currentOrderIndication(data, order)
        return <Card key={order.id}>
          <CardHeader><div className="section-header"><CardTitle>{order.folio} · {formatDate(candidate.indicated_date)}</CardTitle><div className="section-actions">{latest.some(item => item.order_id === order.id) && <Badge variant="secondary">Última activa</Badge>}{selectedId === order.id && <Badge variant="outline"><Check aria-hidden="true" />Base actual</Badge>}</div></div></CardHeader>
          <CardContent className="flex flex-col gap-2"><p>{sortDisplay(indication.products, product => product.product_name ?? '', product => product.product_id).map(product => `${product.product_name} · ${dosage(product.dose)} ${product.unit}/ha`).join('; ')}</p><p className="muted">Versión {candidate.revision} · {indication.method_name || recordName(data.catalogs.application_methods, indication.method_id)} · {dosage(indication.water_l_ha)} L/ha</p>{indication.observations && <p className="whitespace-pre-wrap">{indication.observations}</p>}</CardContent>
          <CardFooter><Button type="button" variant="outline" aria-label={`Usar ${order.folio}`} onClick={() => choose(candidate)}>Usar esta receta</Button></CardFooter>
        </Card>
      })}
      {!filtered.length && <EmptyState title="Sin coincidencias" description="Prueba con otro folio, fecha, producto, medio o nota." />}
    </div>
    {pages > 1 && <nav aria-label="Paginación de recetas" className="section-actions"><Button type="button" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button type="button" variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></nav>}
  </RecordDialog>
}
