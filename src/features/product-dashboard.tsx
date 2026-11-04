import { compareDisplayText, compareIdentity } from '@/domain/list-order'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardList, History } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { buildProductUsage, compareProductQuantity, type ProductUsageFilters } from '@/domain/product-usage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LotUsagePanel } from './lot-usage-panel'
import { PAGE_SIZE, number, quantity, dose, PageControls, ProductHistory } from './product-usage-shared'
import { EmptyState, FormSelect, formatDate, type SelectOption } from './shared'

const ALL = 'all'
const statusLabels = { all: 'Todas las aplicaciones', indicated: 'Indicadas', performed: 'Realizadas', cancelled: 'Canceladas' }
type SortKey = 'name' | 'applicationCount' | 'totalQuantity' | 'averageDose' | 'lastRecordedDate'
type Sort = { key: SortKey; direction: 'asc' | 'desc' }

function SortHead({ label, column, sort, onSort }: { label: string; column: SortKey; sort: Sort; onSort: (key: SortKey) => void }) {
  const active = sort.key === column
  const Icon = active ? sort.direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown
  return <TableHead aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
    <Button variant="ghost" onClick={() => onSort(column)} aria-label={`Ordenar por ${label.toLocaleLowerCase('es-MX')}${column === 'averageDose' ? ', dentro de cada unidad' : ''}`}>
      {label}<Icon data-icon="inline-end" aria-hidden="true" />
    </Button>
  </TableHead>
}

export function ProductDashboardPage() {
  const { data } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const agriculturalUnitId = params.get('agricola') || undefined
  const lotValue = params.get('lote') || undefined
  const lotId = lotValue === ALL ? undefined : lotValue
  const cropId = params.get('cultivo') || undefined
  const status = (params.get('estado') || ALL) as NonNullable<ProductUsageFilters['status']>
  const statusLabel = Object.hasOwn(statusLabels, status) ? statusLabels[status] : 'Estado no disponible'
  const stageValue = params.get('etapa') || undefined
  const stageNumber = stageValue ? /^[1-9]\d*$/.test(stageValue) && Number.isSafeInteger(Number(stageValue)) ? Number(stageValue) : Number.NaN : undefined
  const lotOptions = useMemo(() => {
    const projects = new Map(data.projects.filter(project => !agriculturalUnitId || project.agricultural_unit_id === agriculturalUnitId).map(project => [project.id, project]))
    const fields = new Map(data.catalogs.fields.map(field => [field.id, field.name]))
    const agriculturalUnits = new Map(data.catalogs.agricultural_units.map(unit => [unit.id, unit.name]))
    return data.lots.filter(lot => projects.has(lot.project_id)).map(lot => {
      const project = projects.get(lot.project_id)!
      return { value: lot.id, label: [lot.name, lot.field_name_snapshot || fields.get(lot.field_id) || 'Campo', project.season, agriculturalUnits.get(project.agricultural_unit_id) || 'Agrícola'].join(' · ') }
    })
  }, [data, agriculturalUnitId])
  const [sort, setSort] = useState<Sort>({ key: 'totalQuantity', direction: 'asc' })
  const [requestedPage, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const scopedProjects = data.projects.filter(project => !agriculturalUnitId || project.agricultural_unit_id === agriculturalUnitId)
  const projectIds = new Set(scopedProjects.map(project => project.id))
  const contextOrders = data.applicationOrders.filter(order => projectIds.has(order.project_id))
  const cropNames = new Map<string, string>()
  contextOrders.forEach(order => cropNames.set(order.crop_id, order.crop_name || data.catalogs.crops.find(crop => crop.id === order.crop_id)?.name || 'Cultivo registrado'))
  const cropOptions = [...cropNames].map(([value, label]) => ({ value, label }))
  const orderIds = new Set(contextOrders.filter(order => !cropId || order.crop_id === cropId).map(order => order.id))
  const stageNumbers = [...new Set(data.applicationTargets.filter(target => orderIds.has(target.order_id) && (status === ALL || target.status === status)).map(target => target.stage_number))].sort((a, b) => a - b)
  const result = useMemo(() => buildProductUsage(data, { agriculturalUnitId, lotId, cropId, stageNumber, status }), [data, agriculturalUnitId, lotId, cropId, stageNumber, status])
  const products = useMemo(() => [...result.products].sort((a, b) => {
    if (sort.key === 'totalQuantity') return compareProductQuantity(a, b) * (sort.direction === 'asc' ? 1 : -1)
    if (sort.key === 'averageDose' && a.unit !== b.unit) return a.unit.localeCompare(b.unit)
    const av = a[sort.key], bv = b[sort.key]
    const comparison = typeof av === 'string' && typeof bv === 'string' ? compareDisplayText(av, bv) : Number(av) - Number(bv)
    return comparison * (sort.direction === 'asc' ? 1 : -1) || compareDisplayText(a.name, b.name) || compareIdentity(a.key, b.key)
  }), [result.products, sort])
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(products.length / PAGE_SIZE)))
  const visibleProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedProduct = result.products.find(product => product.key === selectedKey)
  const ranking = result.products.slice(0, 10)
  const maximum = ranking[0]?.applicationCount || 1
  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value === ALL) next.delete(key); else next.set(key, value)
    if (key === 'agricola') { next.delete('lote'); next.delete('cultivo'); next.delete('etapa') }
    if (key === 'cultivo' || key === 'estado') next.delete('etapa')
    setPage(1); setSelectedKey(null); setParams(next, { replace: true })
  }
  function onSort(key: SortKey) {
    setSort(current => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' })); setPage(1)
  }
  function withUnavailable(options: SelectOption[], value: string | undefined, name: string) {
    return value && !options.some(option => option.value === value) ? [{ value, label: `${name} no disponible`, disabled: true }, ...options] : options
  }
  const agriculturalOptions = data.catalogs.agricultural_units.map(unit => ({ value: unit.id, label: unit.name }))
  const scopeText = lotId ? lotOptions.find(option => option.value === lotId)?.label || 'Lote no disponible en este ámbito' : 'Todas las temporadas · ' + (scopedProjects.length ? [...new Set(scopedProjects.map(project => project.season))].join(' / ') : 'Sin proyectos en este ámbito')
  return <div className="workspace-page usage-dashboard">
    <div className="page-header"><div><p className="eyebrow">ANÁLISIS DE APLICACIONES</p><h1 className="page-title">Uso de productos</h1><p className="muted">Productos, cantidades y dosis registrados en tus aplicaciones.</p></div><Button variant="outline" asChild><Link to="/aplicaciones"><ClipboardList data-icon="inline-start" />Ver aplicaciones</Link></Button></div>
    <Card><CardHeader><CardTitle><h2>Selecciona tu ámbito</h2></CardTitle><CardDescription>Todas las aplicaciones guardadas, incluidas las temporadas anteriores. Filtra por estado cuando lo necesites. Etapa es el número de siembra de cada subdivisión.</CardDescription></CardHeader><CardContent>
      <FieldGroup className="usage-filters">
        <FormSelect label="Agrícola" value={agriculturalUnitId || ALL} onChange={value => updateFilter('agricola', value)} options={[{ pinned: true, value: ALL, label: 'Todas las agrícolas' }, ...withUnavailable(agriculturalOptions, agriculturalUnitId, 'Agrícola')]} />
        <div className="usage-lot-filter"><FormSelect label="Lote" value={lotId || ALL} onChange={value => updateFilter('lote', value)} options={[{ pinned: true, value: ALL, label: 'Todos los lotes' }, ...withUnavailable(lotOptions, lotId, 'Lote')]} wrapOptions /></div>
        <FormSelect label="Cultivo" value={cropId || ALL} onChange={value => updateFilter('cultivo', value)} options={[{ pinned: true, value: ALL, label: 'Todos los cultivos' }, ...withUnavailable(cropOptions, cropId, 'Cultivo')]} />
        <FormSelect label="Etapa" value={stageValue || ALL} onChange={value => updateFilter('etapa', value)} options={[{ pinned: true, value: ALL, label: 'Todas las etapas' }, ...withUnavailable(stageNumbers.map(stage => ({ value: String(stage), label: `Etapa ${stage}` })), stageValue, 'Etapa')]} />
        <FormSelect order="provided" label="Estado" value={status} onChange={value => updateFilter('estado', value)} options={withUnavailable(Object.entries(statusLabels).map(([value, label]) => ({ value, label })), status, 'Estado')} />
      </FieldGroup>
      <div className="usage-scope" aria-live="polite"><Badge variant="secondary">{statusLabel}</Badge><span>{scopeText}</span>{(agriculturalUnitId || lotId || cropId || stageValue || status !== ALL) && <Button variant="ghost" onClick={() => { const next = new URLSearchParams(params); ['agricola', 'lote', 'cultivo', 'etapa', 'estado'].forEach(key => next.delete(key)); setParams(next, { replace: true }); setPage(1); setSelectedKey(null) }}>Limpiar filtros</Button>}</div>
    </CardContent></Card>
    {result.incompleteCount > 0 && <Alert><AlertTitle>Registros con información incompleta</AlertTitle><AlertDescription>{result.incompleteCount} destinos no se incluyeron porque falta su fecha, mezcla histórica o datos válidos de dosis y superficie. Revisa los registros en Aplicaciones.</AlertDescription></Alert>}
    <section className="usage-metrics" aria-label="Resumen de productos registrados" aria-live="polite">
      {[
        { label: 'Productos registrados', value: String(new Set(result.products.map(product => product.productId)).size), note: 'Productos distintos en la selección' },
        { label: 'Aplicaciones registradas', value: String(result.applicationCount), note: 'Una por destino, aunque tenga varios productos' },
        { label: 'Cantidad de líquidos', value: quantity(result.liquidMl, 'ml'), note: 'Cantidad calculada de los estados seleccionados' },
        { label: 'Cantidad de sólidos', value: quantity(result.solidG, 'g'), note: 'Cantidad calculada de los estados seleccionados' },
      ].map(metric => <Card key={metric.label}><CardHeader><CardDescription>{metric.label}</CardDescription></CardHeader><CardContent><strong className="usage-metric-value">{metric.value}</strong><p className="usage-metric-note">{metric.note}</p></CardContent></Card>)}
    </section>
    <LotUsagePanel key={params.toString()} data={data} agriculturalUnitId={agriculturalUnitId} lotId={lotId} cropId={cropId} stageNumber={stageNumber} status={status} />
    {!products.length ? <EmptyState title="Sin productos registrados en esta selección" description="Puedes cambiar o limpiar los filtros. Se muestran aplicaciones guardadas de todas las temporadas autorizadas." /> : <>
      <Card><CardHeader><CardTitle><h2>Productos registrados</h2></CardTitle><CardDescription>{products.length} registros por producto y unidad. Abre el historial para consultar cada aplicación.</CardDescription></CardHeader><CardContent>
        <Table className="usage-table"><TableCaption>Cantidades registradas según el estado: reales en realizadas; indicadas en los demás. No representan consumo real al incluir indicadas o canceladas. La superficie se acumula por aplicación y pondera la dosis promedio. Orden inicial por cantidad ascendente sin agrupar unidades; la dosis se ordena por unidad.</TableCaption>
          <TableHeader><TableRow><SortHead label="Producto" column="name" sort={sort} onSort={onSort} /><SortHead label="Aplicaciones" column="applicationCount" sort={sort} onSort={onSort} /><SortHead label="Cantidad calculada" column="totalQuantity" sort={sort} onSort={onSort} /><TableHead>Superficie acumulada</TableHead><SortHead label="Dosis promedio" column="averageDose" sort={sort} onSort={onSort} /><SortHead label="Última fecha" column="lastRecordedDate" sort={sort} onSort={onSort} /><TableHead><span className="sr-only">Historial</span></TableHead></TableRow></TableHeader>
          <TableBody>{visibleProducts.map(product => <TableRow key={product.key}>
            <TableCell><span className="record-name">{product.name}</span><div className="record-secondary muted">{product.unit} · {product.destinationCount} {product.destinationCount === 1 ? 'etapa distinta' : 'etapas distintas'}</div></TableCell><TableCell className="usage-numeric">{product.applicationCount}</TableCell><TableCell className="usage-numeric">{quantity(product.totalQuantity, product.unit)}</TableCell><TableCell className="usage-numeric">{number.format(product.accumulatedAreaHa)} ha</TableCell><TableCell className="usage-numeric">{dose(product.averageDose, product.unit)}</TableCell><TableCell>{formatDate(product.lastRecordedDate)}</TableCell><TableCell><Button variant="outline" onClick={() => setSelectedKey(product.key)} aria-label={`Ver historial de ${product.name}, unidad ${product.unit}`}><History data-icon="inline-start" />Ver historial</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {products.length > PAGE_SIZE && <PageControls page={page} count={products.length} onPage={setPage} label="Páginas de productos registrados" />}
      </CardContent></Card>
      <Card><CardHeader><CardTitle><h2>Ranking por aplicaciones</h2></CardTitle><CardDescription>Los {ranking.length} productos con más aplicaciones por destino. Selecciona uno para consultar su historial.</CardDescription></CardHeader><CardContent>
        <ol className="usage-ranking">{ranking.map((product, index) => <li key={product.key}><Button variant="ghost" className="usage-ranking-button" onClick={() => setSelectedKey(product.key)} aria-label={`Ver historial de ${product.name}, ${product.applicationCount} aplicaciones, unidad ${product.unit}`}>
          <span className="usage-ranking-label"><span>{index + 1}. {product.name} <span className="muted">({product.unit})</span></span><strong>{product.applicationCount} apl.</strong></span><span className="usage-ranking-track" aria-hidden="true"><span style={{ width: `${product.applicationCount / maximum * 100}%` }} /></span>
        </Button></li>)}</ol>
      </CardContent></Card>
    </>}
    {selectedProduct && <ProductHistory key={selectedProduct.key} product={selectedProduct} onClose={() => setSelectedKey(null)} />}
  </div>
}
