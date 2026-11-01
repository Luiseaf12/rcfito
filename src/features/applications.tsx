import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Droplets, Eye, Layers3, Plus, X } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { matchImportedProducts, resolveImportContext, type ExtractedApplication } from '@/domain/application-import'
import { nextStageApplicationNumber, stageApplicationNumber } from '@/domain/applications'
import type {
  ApplicationOrder, ApplicationTarget, CatalogRecord, LotSubdivision,
  ProductLine, ProjectLot, SowingStage, WorkspaceData,
} from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  EmptyState, ErrorAlert, errorMessage, FormInput, FormSelect, formatArea,
  formatDate, LoadingState, normalizeSearch, recordName, RecordDetails,
  RecordDialog, SaveButton, SearchField, useFormClose,
} from './shared'

export type DestinationOption = {
  stage: SowingStage
  lot: ProjectLot
  subdivision: LotSubdivision
  cropName: string
  varietyName: string
}

export function eligibleDestinations(data: WorkspaceData, projectId: string, fieldId?: string, cropId?: string): DestinationOption[] {
  const project = data.projects.find(item => item.id === projectId)
  if (!project || project.status !== 'active') return []
  const lots = new Map(data.lots.filter(lot => lot.project_id === projectId && lot.active !== false && (!fieldId || lot.field_id === fieldId)).map(lot => [lot.id, lot]))
  const subdivisions = new Map(data.subdivisions.filter(subdivision => subdivision.active && lots.has(subdivision.lot_id)).map(subdivision => [subdivision.id, subdivision]))
  return data.stages
    .filter(stage => stage.status === 'planted' && subdivisions.has(stage.subdivision_id) && (!cropId || stage.crop_id === cropId))
    .map(stage => {
      const subdivision = subdivisions.get(stage.subdivision_id)!
      return {
        stage, subdivision, lot: lots.get(subdivision.lot_id)!,
        cropName: stage.crop_name_snapshot || recordName(data.catalogs.crops, stage.crop_id),
        varietyName: stage.variety_name_snapshot || recordName(data.catalogs.varieties, stage.variety_id),
      }
    })
    .sort((a, b) => a.lot.name.localeCompare(b.lot.name, 'es', { numeric: true }) || a.subdivision.name.localeCompare(b.subdivision.name, 'es') || a.stage.stage_number - b.stage.stage_number)
}

export function StageDestinationPicker({ options, selected, onChange, disabled = false, error, title = 'Destinos de la indicación' }: {
  options: DestinationOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  error?: string
  title?: string
}) {
  const prefix = useId()
  const chosen = options.filter(option => selected.includes(option.stage.id))
  return (
    <FieldSet>
      <FieldLegend>{title}</FieldLegend>
      <div className="section-header">
        <div>
          <FieldDescription>Selecciona etapas sembradas del mismo campo y cultivo. Cada destino se incluye completo.</FieldDescription>
        </div>
        <div className="section-actions">
          <Button type="button" variant="outline" disabled={disabled || !options.length} onClick={() => onChange(options.map(option => option.stage.id))}>Seleccionar todos</Button>
          <Button type="button" variant="ghost" disabled={disabled || !chosen.length} onClick={() => onChange([])}>Limpiar</Button>
        </div>
      </div>
      {options.length ? (
        <div className="application-destination-list">
          {options.map(option => (
            <Field orientation="horizontal" key={option.stage.id} className="application-destination" data-disabled={disabled}>
              <Checkbox id={`${prefix}-${option.stage.id}`} disabled={disabled} checked={selected.includes(option.stage.id)} onCheckedChange={checked => onChange(checked === true ? [...selected, option.stage.id] : selected.filter(id => id !== option.stage.id))} />
              <FieldLabel htmlFor={`${prefix}-${option.stage.id}`}>
                <span className="destination-copy">
                  <strong>{option.lot.name} · {option.subdivision.name}</strong>
                  <span>Etapa {option.stage.stage_number} · Cultivo: {option.cropName} · Variedad: {option.varietyName}</span>
                  <small>Sembrada el {formatDate(option.stage.actual_sowing_date)}</small>
                </span>
                <span className="destination-area">{formatArea(option.stage.area_ha)} ha</span>
              </FieldLabel>
            </Field>
          ))}
        </div>
      ) : <p className="muted">No hay etapas sembradas disponibles con esta selección de proyecto, campo y cultivo.</p>}
      <p className="muted" aria-live="polite">{chosen.length} {chosen.length === 1 ? 'destino seleccionado' : 'destinos seleccionados'} · {formatArea(chosen.reduce((sum, option) => sum + Number(option.stage.area_ha), 0))} ha</p>
      {error && <FieldError>{error}</FieldError>}
    </FieldSet>
  )
}

type ProductDraft = { key: string; product_id: string; dose: string; sourceName?: string; importUnit?: 'g' | 'ml' | null }
const newProductRow = (): ProductDraft => ({ key: crypto.randomUUID(), product_id: '', dose: '' })
const dosage = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(Number(value))

function businessToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validateProducts(rows: ProductDraft[]) {
  if (!rows.length) return 'Agrega al menos un producto a la mezcla.'
  if (rows.some(row => !row.product_id)) return 'Selecciona un producto en cada renglón.'
  if (new Set(rows.map(row => row.product_id)).size !== rows.length) return 'Cada producto solo puede aparecer una vez en la mezcla.'
  if (rows.some(row => !row.dose.trim() || !Number.isFinite(Number(row.dose)) || Number(row.dose) <= 0)) return 'Completa todas las dosis con un valor mayor que cero.'
  return ''
}

function ProductMixtureEditor({ rows, onChange, products, original = [], error, imported = false }: {
  rows: ProductDraft[]
  onChange: (rows: ProductDraft[]) => void
  products: CatalogRecord[]
  original?: ProductLine[]
  error?: string
  imported?: boolean
}) {
  const originalIds = new Set(original.map(product => product.product_id))
  const options = products.filter(product => product.active || originalIds.has(product.id))
  const updateRow = (key: string, change: Partial<ProductDraft>) => onChange(rows.map(row => row.key === key ? { ...row, ...change } : row))
  return (
    <FieldSet>
      <FieldLegend>Productos y dosis por hectárea</FieldLegend>
      <FieldDescription>La mezcla es común a todos los destinos seleccionados. La dosis no cambia la predeterminada del catálogo.</FieldDescription>
      <div className="flex flex-col gap-4">
        {rows.map((row, index) => {
          const product = products.find(item => item.id === row.product_id)
          const indicated = original.find(item => item.product_id === row.product_id)
          const unit = indicated?.unit || product?.unit
          return (
            <FieldGroup className="application-mixture-row" key={row.key}>
              <FormSelect label={row.sourceName ? `Producto ${index + 1}: ${row.sourceName}` : `Producto ${index + 1}`} value={row.product_id} onChange={id => {
                const chosen = products.find(item => item.id === id)
                const previous = original.find(item => item.product_id === id)
                updateRow(row.key, { product_id: id, dose: imported ? row.dose : String(previous?.dose ?? chosen?.default_dose ?? '') })
              }} options={options.map(item => ({ value: item.id, label: `${item.code || item.id} · ${item.name}${!item.active ? ' (inactivo, indicado)' : ''}`, disabled: rows.some(other => other.key !== row.key && other.product_id === item.id) }))} required help={product ? `Código: ${product.code || product.id} · Unidad del catálogo: ${unit}/ha` : 'Selecciona un producto del catálogo.'} />
              <FormInput label={unit ? `Dosis (${unit}/ha)` : 'Dosis por hectárea'} value={row.dose} onChange={dose => updateRow(row.key, { dose })} type="number" min="0.0001" step="any" required />
              <Button type="button" variant="outline" size="icon" aria-label={`Quitar producto ${index + 1}`} onClick={() => onChange(rows.filter(item => item.key !== row.key))}><X /></Button>
              {imported && row.sourceName && <div className="col-span-full flex flex-col gap-2">
                <FormSelect label={`Unidad del mensaje para ${row.sourceName}`} value={row.importUnit || ''} onChange={value => updateRow(row.key, { importUnit: value as 'g' | 'ml', dose: '' })} options={[{ value: 'g', label: 'g/ha' }, { value: 'ml', label: 'ml/ha' }]} required help="Si corriges la unidad, vuelve a capturar la dosis confirmada. Masa y volumen requieren aclaración." />
                {product && row.importUnit !== unit && <FieldError>El mensaje y el catálogo tienen unidades diferentes o pendientes. Confirma la unidad y la dosis antes de aprobar.</FieldError>}
              </div>}
            </FieldGroup>
          )
        })}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div><Button type="button" variant="outline" onClick={() => onChange([...rows, newProductRow()])}><Plus data-icon="inline-start" />Agregar producto</Button></div>
    </FieldSet>
  )
}

function MixtureReadOnly({ products, water, title = 'Mezcla indicada' }: { products: ProductLine[]; water: number; title?: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      <div className="table-wrap">
        <Table>
          <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Dosis por hectárea</TableHead></TableRow></TableHeader>
          <TableBody>{products.map((product, index) => <TableRow key={`${product.product_id}-${index}`}><TableCell>{product.product_name}</TableCell><TableCell>{dosage(product.dose)} {product.unit}/ha</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <p className="application-water"><Droplets aria-hidden="true" /><strong>Gasto de agua: {dosage(water)} L/ha</strong></p>
    </section>
  )
}

function TargetStatus({ status }: { status: ApplicationTarget['status'] }) {
  const text = { indicated: 'Indicada', performed: 'Realizada', cancelled: 'Cancelada' }
  return <Badge variant={status === 'performed' ? 'default' : status === 'cancelled' ? 'outline' : 'secondary'} data-state={status}>{text[status]}</Badge>
}

function TargetCounts({ targets }: { targets: ApplicationTarget[] }) {
  return <div className="application-status-counts">
    <Badge variant="secondary">{targets.filter(target => target.status === 'indicated').length} indicadas</Badge>
    <Badge variant="default">{targets.filter(target => target.status === 'performed').length} realizadas</Badge>
    <Badge variant="outline">{targets.filter(target => target.status === 'cancelled').length} canceladas</Badge>
  </div>
}

function TextField({ label, value, onChange, required, error, help }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: string; help?: string }) {
  const id = useId()
  return <Field data-invalid={!!error}>
    <FieldLabel htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</FieldLabel>
    <Textarea id={id} value={value} onChange={event => onChange(event.target.value)} rows={3} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined} />
    {help && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </Field>
}

export function ApplicationsPage() {
  const { data, isAdmin, loading } = useWorkspace()
  const [query, setQuery] = useState('')
  const [unitId, setUnitId] = useState('all')
  const [fieldId, setFieldId] = useState('all')
  const [cropId, setCropId] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const orders = data.applicationOrders ?? []
  const targets = data.applicationTargets ?? []
  const badRange = !!from && !!to && from > to
  const filtered = useMemo(() => {
    const search = normalizeSearch(query)
    return orders.filter(order => {
      const project = data.projects.find(item => item.id === order.project_id)
      const destinations = targets.filter(target => target.order_id === order.id)
      return (!badRange)
        && (unitId === 'all' || project?.agricultural_unit_id === unitId)
        && (fieldId === 'all' || order.field_id === fieldId)
        && (cropId === 'all' || order.crop_id === cropId)
        && (status === 'all' || destinations.some(target => target.status === status))
        && (!from || order.scheduled_date >= from)
        && (!to || order.scheduled_date <= to)
        && normalizeSearch(`${order.folio} ${order.project_name || project?.name || ''} ${order.field_name || recordName(data.catalogs.fields, order.field_id)} ${order.crop_name || recordName(data.catalogs.crops, order.crop_id)} ${order.observations} ${destinations.map(target => `${target.lot_name} ${target.subdivision_name}`).join(' ')}`).includes(search)
    }).sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date) || String(b.folio).localeCompare(String(a.folio), 'es', { numeric: true }))
  }, [orders, targets, data.projects, data.catalogs, query, unitId, fieldId, cropId, status, from, to, badRange])
  const filteredIds = new Set(filtered.map(order => order.id))
  const filteredTargets = targets.filter(target => filteredIds.has(target.order_id))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8)
  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1) }
  if (loading) return <LoadingState />
  return (
    <section className="workspace-page">
      <header className="page-header">
        <div><p className="eyebrow">Del campo a su historial</p><h1 className="page-title">Aplicaciones</h1><p className="muted">Indica una mezcla y da seguimiento a su realización por lote y etapa.</p></div>
        <div className="section-actions"><Button variant="outline" asChild><Link to="/grupos-siembra"><Layers3 data-icon="inline-start" />Grupos de siembra</Link></Button>{isAdmin && <Button onClick={() => setCreating(true)}><Plus data-icon="inline-start" />Nueva indicación</Button>}</div>
      </header>
      <div className="stat-grid" aria-label="Destinos de las órdenes filtradas">
        <article className="metric-card"><span>Aplicaciones indicadas</span><strong>{filteredTargets.filter(target => target.status === 'indicated').length}</strong><small>Destinos pendientes en el filtro actual</small></article>
        <article className="metric-card"><span>Aplicaciones realizadas</span><strong>{filteredTargets.filter(target => target.status === 'performed').length}</strong><small>Realización registrada por destino</small></article>
        <article className="metric-card"><span>Aplicaciones canceladas</span><strong>{filteredTargets.filter(target => target.status === 'cancelled').length}</strong><small>Con motivo de cancelación</small></article>
      </div>
      <div className="surface">
        <div className="catalog-toolbar flex flex-col gap-4">
          <SearchField value={query} onChange={value => setFilter(setQuery, value)} label="Buscar órdenes" placeholder="Folio, proyecto, campo, cultivo o lote…" />
          <div className="application-filter-grid">
            <FormSelect label="Agrícola" value={unitId} onChange={value => { setFilter(setUnitId, value); setFieldId('all') }} options={[{ value: 'all', label: 'Todas las agrícolas' }, ...data.catalogs.agricultural_units.map(unit => ({ value: unit.id, label: unit.name }))]} />
            <FormSelect label="Campo" value={fieldId} onChange={value => setFilter(setFieldId, value)} options={[{ value: 'all', label: 'Todos los campos' }, ...data.catalogs.fields.filter(field => unitId === 'all' || field.agricultural_unit_id === unitId).map(field => ({ value: field.id, label: field.name }))]} />
            <FormSelect label="Cultivo" value={cropId} onChange={value => setFilter(setCropId, value)} options={[{ value: 'all', label: 'Todos los cultivos' }, ...data.catalogs.crops.map(crop => ({ value: crop.id, label: crop.name }))]} />
            <FormSelect label="Estado de los destinos" value={status} onChange={value => setFilter(setStatus, value)} options={[{ value: 'all', label: 'Todos los estados' }, { value: 'indicated', label: 'Indicadas' }, { value: 'performed', label: 'Realizadas' }, { value: 'cancelled', label: 'Canceladas' }]} />
            <FormInput label="Programada desde" type="date" value={from} onChange={value => setFilter(setFrom, value)} />
            <FormInput label="Programada hasta" type="date" value={to} onChange={value => setFilter(setTo, value)} error={badRange ? 'La fecha final debe ser igual o posterior a la inicial.' : undefined} />
          </div>
          {(query || unitId !== 'all' || fieldId !== 'all' || cropId !== 'all' || status !== 'all' || from || to) && <div><Button type="button" variant="ghost" onClick={() => { setQuery(''); setUnitId('all'); setFieldId('all'); setCropId('all'); setStatus('all'); setFrom(''); setTo(''); setPage(1) }}><X data-icon="inline-start" />Limpiar filtros</Button></div>}
        </div>
        {visible.length ? <div className="table-wrap"><Table>
          <TableHeader><TableRow><TableHead>Orden</TableHead><TableHead>Campo y cultivo</TableHead><TableHead>Fecha programada</TableHead><TableHead>Destinos</TableHead><TableHead>Seguimiento</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader>
          <TableBody>{visible.map(order => {
            const orderTargets = targets.filter(target => target.order_id === order.id)
            return <TableRow key={order.id}>
              <TableCell><div className="record-name">{order.folio}</div><div className="muted record-secondary">{order.project_name || data.projects.find(project => project.id === order.project_id)?.name}</div></TableCell>
              <TableCell><div>{order.field_name || recordName(data.catalogs.fields, order.field_id)}</div><div className="muted record-secondary">{order.crop_name || recordName(data.catalogs.crops, order.crop_id)}</div></TableCell>
              <TableCell>{formatDate(order.scheduled_date)}</TableCell>
              <TableCell><strong>{orderTargets.length}</strong><div className="muted record-secondary">{formatArea(orderTargets.reduce((sum, target) => sum + Number(target.area_ha), 0))} ha</div></TableCell>
              <TableCell><TargetCounts targets={orderTargets} /></TableCell>
              <TableCell><Button asChild variant="outline"><Link to={`/aplicaciones/${order.id}`} aria-label={`Ver orden ${order.folio}`}><Eye data-icon="inline-start" />Ver</Link></Button></TableCell>
            </TableRow>
          })}</TableBody>
        </Table></div> : <EmptyState title={orders.length ? 'No encontramos órdenes con esos filtros' : 'La primera indicación comienza aquí'} description={orders.length ? 'Prueba otro folio, cambia el rango de fechas o limpia los filtros.' : 'Selecciona etapas sembradas del mismo campo y cultivo para indicar productos, dosis y gasto de agua.'} action={isAdmin && !orders.length ? <Button onClick={() => setCreating(true)}><Plus data-icon="inline-start" />Nueva indicación</Button> : undefined} />}
        <div className="table-pagination">
          <p className="muted" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'orden encontrada' : 'órdenes encontradas'}</p>
          <nav aria-label="Paginación de órdenes" className="flex items-center gap-2"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></nav>
        </div>
      </div>
      {creating && isAdmin && <NewApplicationDialog close={() => setCreating(false)} />}
    </section>
  )
}

export function NewApplicationDialog({ close, imported, onSaved }: { close: () => void; imported?: { extracted: ExtractedApplication; source_text: string }; onSaved?: () => void }) {
  const { data, mutate } = useWorkspace()
  const navigate = useNavigate()
  const [orderId] = useState(() => crypto.randomUUID())
  const [seed] = useState(() => imported ? { context: resolveImportContext(data, imported.extracted), rows: matchImportedProducts(imported.extracted.products, data.catalogs.products) } : null)
  const [initial] = useState(() => ({ project_id: seed?.context.projectId || '', field_id: seed?.context.fieldId || '', crop_id: seed?.context.cropId || '', method_id: seed?.context.methodId || '', indicated_date: imported ? imported.extracted.indicated_date || '' : businessToday(), scheduled_date: imported ? imported.extracted.scheduled_date || '' : businessToday(), water_l_ha: imported?.extracted.water_l_ha == null ? '' : String(imported.extracted.water_l_ha), observations: imported?.extracted.note || '', application_number: imported?.extracted.application_number == null ? '' : String(imported.extracted.application_number) }))
  const [form, setForm] = useState(initial)
  const [rows, setRows] = useState<ProductDraft[]>(() => seed?.rows.length ? seed.rows.map(row => ({ key: crypto.randomUUID(), product_id: row.productId, dose: row.dose, sourceName: row.sourceName, importUnit: row.unit })) : [newProductRow()])
  const [selected, setSelected] = useState<string[]>(() => seed?.context.selectedStageIds || [])
  const [destinationsReviewed, setDestinationsReviewed] = useState(false)
  const [numberReviewed, setNumberReviewed] = useState(false)
  const [groupId, setGroupId] = useState('manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productError, setProductError] = useState('')
  const [targetError, setTargetError] = useState('')
  const [contextChange, setContextChange] = useState<{ key: 'project_id' | 'field_id' | 'crop_id'; value: string } | null>(null)
  const dirty = !!imported || JSON.stringify(form) !== JSON.stringify(initial) || selected.length > 0 || rows.length !== 1 || rows.some(row => row.product_id || row.dose)
  const dismissal = useFormClose(!!dirty, busy, close)
  const projects = data.projects.filter(project => project.status === 'active')
  const fields = data.catalogs.fields.filter(field => data.lots.some(lot => lot.project_id === form.project_id && lot.field_id === field.id && lot.active !== false))
  const fieldOptions = eligibleDestinations(data, form.project_id, form.field_id || undefined)
  const cropIds = new Set(fieldOptions.map(option => option.stage.crop_id))
  const options = form.field_id && form.crop_id ? eligibleDestinations(data, form.project_id, form.field_id, form.crop_id) : []
  const importContext = imported ? resolveImportContext(data, imported.extracted, { agriculturalUnitId: data.projects.find(project => project.id === form.project_id)?.agricultural_unit_id, projectId: form.project_id, fieldId: form.field_id || undefined, cropId: form.crop_id || undefined }) : null
  const chosenOptions = options.filter(option => selected.includes(option.stage.id))
  const unusualNumbers = form.application_number ? chosenOptions.filter(option => nextStageApplicationNumber(data, option.stage.id) !== Number(form.application_number)) : []
  const importIncomplete = !!imported && (!form.project_id || !form.field_id || !form.crop_id || !form.method_id || !validDate(form.indicated_date) || !validDate(form.scheduled_date) || !form.application_number || !Number.isSafeInteger(Number(form.application_number)) || Number(form.application_number) < 1 || Number(form.application_number) > 2_147_483_647 || !chosenOptions.length || chosenOptions.length !== selected.length || !!validateProducts(rows) || !Number.isFinite(Number(form.water_l_ha)) || Number(form.water_l_ha) <= 0 || form.observations.length > 4000 || rows.some(row => row.sourceName && (!row.importUnit || row.importUnit !== data.catalogs.products.find(product => product.id === row.product_id)?.unit)) || !!importContext?.unresolvedDestinations.length && !destinationsReviewed || !!unusualNumbers.length && !numberReviewed)
  const groups = (data.sowingGroups ?? []).filter(group => group.active && group.project_id === form.project_id && group.field_id === form.field_id && group.crop_id === form.crop_id)
  const currentGroup = groups.find(group => group.id === groupId)
  const staleMembers = currentGroup ? new Set([...(currentGroup.historical_stage_ids ?? []), ...currentGroup.stage_ids.filter(id => !options.some(option => option.stage.id === id))]).size : 0
  const update = (key: keyof typeof form, value: string) => { setForm(current => ({ ...current, [key]: value })); if (key === 'application_number') setNumberReviewed(false) }
  const clearDestinations = () => { setSelected([]); setGroupId('manual'); setTargetError('') }
  const applyContextChange = (key: 'project_id' | 'field_id' | 'crop_id', value: string) => {
    const next = { ...form, [key]: value, ...(key === 'project_id' ? { field_id: '', crop_id: '' } : key === 'field_id' ? { crop_id: '' } : {}) }
    clearDestinations()
    setDestinationsReviewed(false); setNumberReviewed(false)
    if (imported) {
      const context = resolveImportContext(data, imported.extracted, { agriculturalUnitId: data.projects.find(project => project.id === next.project_id)?.agricultural_unit_id, projectId: next.project_id, fieldId: next.field_id || undefined, cropId: next.crop_id || undefined })
      setForm({ ...next, field_id: context.fieldId, crop_id: context.cropId })
      setSelected(context.selectedStageIds)
    } else setForm(next)
  }
  const changeContext = (key: 'project_id' | 'field_id' | 'crop_id', value: string) => {
    if (value === form[key]) return
    if (selected.length && form[key]) setContextChange({ key, value })
    else applyContextChange(key, value)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError(null)
    const mixtureError = validateProducts(rows)
    setProductError(mixtureError)
    const chosen = options.filter(option => selected.includes(option.stage.id))
    const destinationError = !chosen.length ? 'Selecciona al menos una etapa sembrada.' : chosen.length !== selected.length ? 'La selección cambió. Revisa los destinos disponibles antes de guardar.' : ''
    setTargetError(destinationError)
    if (!projects.some(project => project.id === form.project_id) || !form.field_id || !form.crop_id || !data.catalogs.application_methods.some(method => method.id === form.method_id && method.active)) { setError('Completa proyecto activo, campo, cultivo y medio de aplicación.'); return }
    if (mixtureError || destinationError) { setError('Revisa los productos y destinos señalados.'); return }
    if (imported && rows.some(row => row.sourceName && (!row.importUnit || row.importUnit !== data.catalogs.products.find(product => product.id === row.product_id)?.unit))) { setError('Aclara las unidades del mensaje y del catálogo y confirma sus dosis antes de aprobar.'); return }
    if (importContext?.unresolvedDestinations.length && !destinationsReviewed) { setError('Revisa los destinos del mensaje sin coincidencia única y confirma que la selección los representa.'); return }
    if (form.application_number && (!Number.isSafeInteger(Number(form.application_number)) || Number(form.application_number) < 1 || Number(form.application_number) > 2_147_483_647)) { setError('El número de aplicación debe ser un entero positivo.'); return }
    if (imported && !form.application_number) { setError('Completa el número de aplicación de la etapa.'); return }
    if (chosen.some(option => data.applicationTargets.some(target => target.stage_id === option.stage.id && stageApplicationNumber(data, target) === Number(form.application_number)))) { setError('Ese número de aplicación ya está registrado en alguna etapa seleccionada. Revisa su historial.'); return }
    if (unusualNumbers.length && !numberReviewed) { setError('Confirma el número solicitado después de revisar el consecutivo de cada etapa.'); return }
    if (form.observations.length > 4000) { setError('La Nota de la aplicación admite hasta 4,000 caracteres.'); return }
    if (!validDate(form.indicated_date) || !validDate(form.scheduled_date)) { setError('Captura fechas válidas para la indicación y su programación.'); return }
    if (form.scheduled_date < form.indicated_date) { setError('La fecha programada debe ser igual o posterior a la fecha de indicación.'); return }
    if (chosen.some(option => !option.stage.actual_sowing_date || form.indicated_date < option.stage.actual_sowing_date)) { setError('La indicación no puede ser anterior a la siembra real de ninguno de los destinos.'); return }
    if (!form.water_l_ha.trim() || !Number.isFinite(Number(form.water_l_ha)) || Number(form.water_l_ha) <= 0) { setError('El gasto de agua debe ser mayor que cero, en litros por hectárea.'); return }
    setBusy(true)
    try {
      const { application_number, ...values } = form
      await mutate({ type: 'create_application_order', record: { ...values, id: orderId, ...(application_number ? { application_number: Number(application_number) } : {}), ...(imported ? { source_text: imported.source_text } : {}), water_l_ha: Number(form.water_l_ha), stage_ids: chosen.map(option => option.stage.id), products: rows.map(row => ({ product_id: row.product_id, dose: Number(row.dose) })) } })
      onSaved?.()
      close()
      navigate(`/aplicaciones/${orderId}`, { state: { notice: 'La indicación se guardó correctamente.' } })
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <>
    <RecordDialog title={imported ? 'Revisar y aprobar la captura' : 'Nueva indicación'} description="Completa los datos y revisa productos, destinos, número por etapa y nota antes de guardar la indicación." open onOpenChange={dismissal.onOpenChange} wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <ErrorAlert message={error} />
        <fieldset disabled={busy} className="min-w-0 flex flex-col gap-6">
          {imported && <Collapsible><CollapsibleTrigger asChild><Button type="button" variant="outline">Mensaje original</Button></CollapsibleTrigger><CollapsibleContent><p className="whitespace-pre-wrap break-words">{imported.source_text}</p></CollapsibleContent></Collapsible>}
          {importContext && (importContext.cropSuggestionReason || importContext.warnings.length > 0) && <Alert><AlertTitle>Revisa las referencias del mensaje</AlertTitle><AlertDescription>{importContext.cropSuggestionReason && <p>{importContext.cropSuggestionReason}</p>}{importContext.warnings.filter(warning => warning !== importContext.cropSuggestionReason).map(warning => <p key={warning}>{warning}</p>)}</AlertDescription></Alert>}
          {!projects.length && <Alert><AlertTitle>Activa un proyecto de siembra</AlertTitle><AlertDescription>Necesitas un proyecto activo con etapas sembradas para indicar aplicaciones. <Link to="/proyectos">Consultar proyectos</Link></AlertDescription></Alert>}
          <FieldGroup className="field-grid">
            <FormSelect label="Proyecto de temporada" value={form.project_id} required onChange={value => changeContext('project_id', value)} options={projects.map(project => ({ value: project.id, label: `${recordName(data.catalogs.agricultural_units, project.agricultural_unit_id)} · ${project.name} (${project.season})` }))} />
            <FormSelect label="Campo" value={form.field_id} required disabled={!form.project_id} onChange={value => changeContext('field_id', value)} options={fields.map(field => ({ value: field.id, label: field.name }))} />
            <FormSelect label="Cultivo" value={form.crop_id} required disabled={!form.field_id} onChange={value => changeContext('crop_id', value)} options={data.catalogs.crops.filter(crop => cropIds.has(crop.id)).map(crop => ({ value: crop.id, label: crop.name }))} help="Se muestran los cultivos de las etapas sembradas en este campo." />
            <FormSelect label="Medio de aplicación" value={form.method_id} required onChange={value => update('method_id', value)} options={data.catalogs.application_methods.filter(method => method.active).map(method => ({ value: method.id, label: method.name }))} />
          </FieldGroup>
          {form.field_id && form.crop_id && <FieldGroup>
            <FormSelect label="Usar un grupo de siembra" value={groupId} onChange={id => {
              setGroupId(id)
              setDestinationsReviewed(false); setNumberReviewed(false)
              const group = groups.find(item => item.id === id)
              setSelected(group ? group.stage_ids.filter(stageId => options.some(option => option.stage.id === stageId)) : [])
            }} options={[{ value: 'manual', label: 'Seleccionar destinos manualmente' }, ...groups.map(group => ({ value: group.id, label: `${group.name} · ${group.stage_ids.filter(id => options.some(option => option.stage.id === id)).length} vigentes` }))]} help="Los grupos son una selección manual guardada. Puedes ajustar los destinos para esta indicación." />
            {staleMembers > 0 && <Alert><AlertTitle>Este grupo conserva etapas anteriores</AlertTitle><AlertDescription>{staleMembers} {staleMembers === 1 ? 'etapa ya no está disponible y quedó excluida' : 'etapas ya no están disponibles y quedaron excluidas'}. Solo se seleccionan sus siembras vigentes.</AlertDescription></Alert>}
            <StageDestinationPicker options={options} selected={selected} onChange={ids => { setSelected(ids); setGroupId('manual'); setDestinationsReviewed(false); setNumberReviewed(false) }} error={targetError} />
          </FieldGroup>}
          {!!importContext?.unresolvedDestinations.length && <Field orientation="horizontal"><Checkbox id={`${orderId}-destinations-reviewed`} checked={destinationsReviewed} onCheckedChange={checked => setDestinationsReviewed(checked === true)} /><FieldLabel htmlFor={`${orderId}-destinations-reviewed`}>Revisé {importContext.unresolvedDestinations.join(', ')} y confirmé que la selección incluye todos los destinos del mensaje.</FieldLabel></Field>}
          <FieldGroup>
            <FormInput label="Número de aplicación en la etapa" value={form.application_number} onChange={value => update('application_number', value)} type="number" min="1" max="2147483647" step="1" required={!!imported} help={imported ? 'Número del mensaje, independiente del folio de la orden.' : 'Vacío: asigna el siguiente número disponible en cada etapa.'} />
            {!!chosenOptions.length && <p className="muted">{chosenOptions.map(option => `${option.lot.name} · Etapa ${option.stage.stage_number}: siguiente ${nextStageApplicationNumber(data, option.stage.id)}`).join('; ')}</p>}
            {!!unusualNumbers.length && <Field orientation="horizontal"><Checkbox id={`${orderId}-number-reviewed`} checked={numberReviewed} onCheckedChange={checked => setNumberReviewed(checked === true)} /><FieldLabel htmlFor={`${orderId}-number-reviewed`}>Revisé el historial y confirmo el número {form.application_number} para estas etapas, aunque difiera del siguiente disponible. Los conteos conservarán solo las aplicaciones registradas.</FieldLabel></Field>}
          </FieldGroup>
          <Separator />
          <FieldGroup>
            <ProductMixtureEditor rows={rows} onChange={setRows} products={data.catalogs.products} error={productError} imported={!!imported} />
            <FieldGroup className="field-grid">
              <FormInput label="Gasto de agua (L/ha)" value={form.water_l_ha} onChange={value => update('water_l_ha', value)} type="number" min="0.0001" step="any" required />
              <FormInput label="Fecha de indicación" type="date" value={form.indicated_date} onChange={value => update('indicated_date', value)} required />
              <FormInput label="Fecha programada" type="date" value={form.scheduled_date} onChange={value => update('scheduled_date', value)} min={form.indicated_date} required />
            </FieldGroup>
            <TextField label="Nota de la aplicación" value={form.observations} onChange={value => update('observations', value)} help="Opcional, hasta 4,000 caracteres. Se conserva para todos los destinos de esta indicación." />
          </FieldGroup>
          <Alert><AlertTitle>La indicación se conserva como historial</AlertTitle><AlertDescription>Una vez emitida, registra su realización o cancela los destinos pendientes. Para corregirla, cancela e indica nuevamente.</AlertDescription></Alert>
        </fieldset>
        {importIncomplete && <p className="muted" role="status">Completa los campos obligatorios y las revisiones señaladas para habilitar la aprobación.</p>}
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={dismissal.requestClose} disabled={busy}>Volver</Button><SaveButton busy={busy} disabled={importIncomplete}>{imported ? 'Aprobar y guardar indicación' : 'Guardar indicación'}</SaveButton></div>
      </form>
    </RecordDialog>
    {dismissal.confirmation}
    <AlertDialog open={!!contextChange} onOpenChange={open => { if (!open) setContextChange(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Cambiar la selección de siembras?</AlertDialogTitle><AlertDialogDescription>Al cambiar proyecto, campo o cultivo se quitarán los destinos seleccionados. La mezcla, fechas y observaciones que capturaste se conservarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar destinos</AlertDialogCancel><AlertDialogAction onClick={() => { if (contextChange) applyContextChange(contextChange.key, contextChange.value); setContextChange(null) }}>Cambiar selección</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}

function targetLabel(target: ApplicationTarget) {
  return `${target.lot_name} · ${target.subdivision_name} · Etapa ${target.stage_number}`
}

export function ApplicationDetailPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const { data, isAdmin, loading } = useWorkspace()
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<{ kind: 'perform' | 'cancel'; ids: string[] } | { kind: 'view'; targetId: string } | null>(null)
  const [notice, setNotice] = useState(() => typeof location.state?.notice === 'string' ? location.state.notice : '')
  const order = (data.applicationOrders ?? []).find(item => item.id === orderId)
  const targets = (data.applicationTargets ?? []).filter(target => target.order_id === orderId)
  const pending = targets.filter(target => target.status === 'indicated')
  const chosen = pending.filter(target => selected.includes(target.id))
  if (loading) return <LoadingState />
  if (!order) return <EmptyState title="La indicación no está disponible" description="Puede que no tengas acceso a su agrícola o que la consulta todavía deba actualizarse." action={<Button asChild variant="outline"><Link to="/aplicaciones">Volver a aplicaciones</Link></Button>} />
  const project = data.projects.find(item => item.id === order.project_id)
  const completed = (message: string) => { setModal(null); setSelected([]); setNotice(message) }
  return <section className="workspace-page flex flex-col gap-6">
    <div><Button asChild variant="ghost"><Link to="/aplicaciones"><ArrowLeft data-icon="inline-start" />Aplicaciones</Link></Button></div>
    <header className="page-header">
      <div><p className="eyebrow">Indicación de aplicación</p><h1 className="page-title">{order.folio}</h1><p className="muted">{order.field_name || recordName(data.catalogs.fields, order.field_id)} · {order.crop_name || recordName(data.catalogs.crops, order.crop_id)}</p></div>
      <TargetCounts targets={targets} />
    </header>
    {notice && <Alert role="status"><Check /><AlertTitle>{notice}</AlertTitle></Alert>}
    <Card>
      <CardHeader><CardTitle>Lo indicado</CardTitle><CardDescription>Esta información conserva la instrucción original de todos los destinos.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-6">
        <RecordDetails items={[
          { label: 'Agrícola', value: recordName(data.catalogs.agricultural_units, project?.agricultural_unit_id) },
          { label: 'Proyecto', value: order.project_name || project?.name },
          { label: 'Medio de aplicación', value: order.method_name || recordName(data.catalogs.application_methods, order.method_id) },
          { label: 'Fecha de indicación', value: formatDate(order.indicated_date) },
          { label: 'Fecha programada', value: formatDate(order.scheduled_date) },
          { label: 'Superficie indicada', value: `${formatArea(targets.reduce((sum, target) => sum + Number(target.area_ha), 0))} ha` },
        ]} />
        <MixtureReadOnly products={order.products} water={order.water_l_ha} />
        <div><h3 className="section-title">Nota de la aplicación</h3><p className="whitespace-pre-wrap">{order.observations || 'Sin nota.'}</p></div>
        {order.source_text && <Collapsible><CollapsibleTrigger asChild><Button type="button" variant="outline">Mensaje original de la captura</Button></CollapsibleTrigger><CollapsibleContent><p className="whitespace-pre-wrap break-words">{order.source_text}</p></CollapsibleContent></Collapsible>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Seguimiento por destino</CardTitle><CardDescription>Cada lote o subdivisión se realiza completo. Puedes registrar varios destinos pendientes a la vez.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isAdmin && pending.length > 0 && <div className="toolbar flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setSelected(chosen.length === pending.length ? [] : pending.map(target => target.id))}>{chosen.length === pending.length ? 'Quitar selección' : 'Seleccionar pendientes'}</Button>
          <span className="muted" aria-live="polite">{chosen.length} destinos seleccionados</span>
          <Button disabled={!chosen.length} onClick={() => setModal({ kind: 'perform', ids: chosen.map(target => target.id) })}><Check data-icon="inline-start" />Registrar realización</Button>
          <Button variant="outline" disabled={!chosen.length} onClick={() => setModal({ kind: 'cancel', ids: chosen.map(target => target.id) })}><X data-icon="inline-start" />Cancelar destinos</Button>
        </div>}
        <div className="table-wrap"><Table>
          <TableHeader><TableRow>{isAdmin && <TableHead>Seleccionar</TableHead>}<TableHead>Destino</TableHead><TableHead>Superficie</TableHead><TableHead>Estado</TableHead><TableHead>Realización</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader>
          <TableBody>{targets.map(target => <TableRow key={target.id}>
            {isAdmin && <TableCell>{target.status === 'indicated' ? <Checkbox className="application-target-check" aria-label={`Seleccionar ${targetLabel(target)}`} checked={selected.includes(target.id)} onCheckedChange={checked => setSelected(current => checked === true ? [...current, target.id] : current.filter(id => id !== target.id))} /> : <span className="muted">—</span>}</TableCell>}
            <TableCell><strong>{target.lot_name}</strong><div>{target.subdivision_name} · Etapa {target.stage_number}</div><div>Aplicación {stageApplicationNumber(data, target)}</div><div className="muted record-secondary">{target.crop_name} / {target.variety_name}</div></TableCell>
            <TableCell>{formatArea(target.area_ha)} ha</TableCell>
            <TableCell><TargetStatus status={target.status} /></TableCell>
            <TableCell>{target.actual_date ? formatDate(target.actual_date) : target.status === 'cancelled' ? 'No se realizó' : 'Pendiente'}{target.status === 'performed' && <div className="muted record-secondary">{target.has_changes ? 'Con cambios registrados' : 'Conforme a lo indicado'}</div>}</TableCell>
            <TableCell><Button variant="outline" onClick={() => setModal({ kind: 'view', targetId: target.id })} aria-label={`Ver ${targetLabel(target)}`}><Eye data-icon="inline-start" />Ver</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
        {!pending.length && <p className="muted">Todos los destinos tienen su seguimiento registrado.</p>}
      </CardContent>
    </Card>
    {modal?.kind === 'perform' && isAdmin && <PerformDialog order={order} targets={targets.filter(target => modal.ids.includes(target.id) && target.status === 'indicated')} close={() => setModal(null)} completed={() => completed('La realización se guardó correctamente.')} />}
    {modal?.kind === 'cancel' && isAdmin && <CancelTargetsDialog order={order} targets={targets.filter(target => modal.ids.includes(target.id) && target.status === 'indicated')} close={() => setModal(null)} completed={() => completed('La cancelación se guardó correctamente.')} />}
    {modal?.kind === 'view' && <TargetDetailsDialog order={order} target={targets.find(target => target.id === modal.targetId)!} close={() => setModal(null)} />}
  </section>
}

function PerformDialog({ order, targets, close, completed }: { order: ApplicationOrder; targets: ApplicationTarget[]; close: () => void; completed: () => void }) {
  const { data, mutate } = useWorkspace()
  const changedId = useId()
  const [initial] = useState(() => ({ actual_date: businessToday(), equipment: '', applicator: '', observations: '' }))
  const [form, setForm] = useState(initial)
  const [changed, setChanged] = useState(false)
  const [water, setWater] = useState(String(order.water_l_ha))
  const [rows, setRows] = useState<ProductDraft[]>(() => order.products.map(product => ({ key: crypto.randomUUID(), product_id: product.product_id, dose: String(product.dose) })))
  const [error, setError] = useState<string | null>(null)
  const [productError, setProductError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = changed || JSON.stringify(form) !== JSON.stringify(initial)
  const dismissal = useFormClose(dirty, busy, close)
  const earliest = targets.reduce((date, target) => {
    const sowing = data.stages.find(stage => stage.id === target.stage_id)?.actual_sowing_date
    return sowing && sowing > date ? sowing : date
  }, order.indicated_date)
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (!targets.length) { setError('Ya no hay destinos pendientes en esta selección. Cierra y actualiza la consulta.'); return }
    if (!validDate(form.actual_date) || form.actual_date < earliest || form.actual_date > businessToday()) { setError(`La realización debe estar entre el ${formatDate(earliest)} y hoy. Puede ser anterior a la fecha programada.`); return }
    if (changed) {
      const mixtureError = validateProducts(rows)
      setProductError(mixtureError)
      if (mixtureError) { setError('Revisa la mezcla realmente aplicada.'); return }
      if (!water.trim() || !Number.isFinite(Number(water)) || Number(water) <= 0) { setError('El gasto de agua real debe ser mayor que cero.'); return }
    }
    setBusy(true)
    try {
      await mutate({ type: 'perform_application_targets', order_id: order.id, target_ids: targets.map(target => target.id), data: { ...form, changed, ...(changed ? { water_l_ha: Number(water), products: rows.map(row => ({ product_id: row.product_id, dose: Number(row.dose) })) } : {}) } })
      completed()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <>
    <RecordDialog title="Registrar realización" description={`${order.folio} · ${targets.length} ${targets.length === 1 ? 'destino completo' : 'destinos completos'}. Confirma lo realizado y captura cualquier cambio excepcional.`} open onOpenChange={dismissal.onOpenChange} wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <ErrorAlert message={error} />
        <fieldset disabled={busy} className="min-w-0 flex flex-col gap-6">
          <div className="flex flex-col gap-2"><h3 className="section-title">Destinos seleccionados</h3><ul className="list-disc pl-6">{targets.map(target => <li key={target.id}>{targetLabel(target)} · {formatArea(target.area_ha)} ha</li>)}</ul></div>
          <MixtureReadOnly products={order.products} water={order.water_l_ha} />
          <FieldGroup>
            <FieldGroup className="field-grid">
              <FormInput label="Fecha real de aplicación" type="date" value={form.actual_date} onChange={value => update('actual_date', value)} required min={earliest} max={businessToday()} help="No puede ser anterior a la indicación o a la siembra real, ni posterior a hoy." />
              <FormInput label="Equipo utilizado" value={form.equipment} onChange={value => update('equipment', value)} placeholder="Identificación o descripción del equipo" help="Captura libre; no se utiliza un catálogo de equipos." />
              <FormInput label="Aplicador (opcional)" value={form.applicator} onChange={value => update('applicator', value)} />
            </FieldGroup>
            <TextField label="Observaciones de la realización" value={form.observations} onChange={value => update('observations', value)} />
            <Field orientation="horizontal"><Checkbox id={changedId} checked={changed} onCheckedChange={value => setChanged(value === true)} /><div><FieldLabel htmlFor={changedId}>Hubo cambios en productos, dosis o agua</FieldLabel><FieldDescription>Activa esta opción solo si lo aplicado fue diferente. La indicación original siempre se conserva.</FieldDescription></div></Field>
            {changed ? <FieldSet className="flex flex-col gap-5"><FieldLegend>Lo realmente aplicado</FieldLegend><FieldDescription>Estos valores se guardarán para todos los destinos seleccionados.</FieldDescription><ProductMixtureEditor rows={rows} onChange={setRows} products={data.catalogs.products} original={order.products} error={productError} /><FormInput label="Gasto de agua real (L/ha)" type="number" value={water} onChange={setWater} min="0.0001" step="any" required /></FieldSet> : <Alert><AlertTitle>Confirmación de lo indicado</AlertTitle><AlertDescription>Al registrar la realización, confirmas que se aplicaron exactamente los productos, dosis y gasto de agua mostrados arriba.</AlertDescription></Alert>}
          </FieldGroup>
        </fieldset>
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={dismissal.requestClose} disabled={busy}>Volver</Button><SaveButton busy={busy}>Confirmar realización</SaveButton></div>
      </form>
    </RecordDialog>
    {dismissal.confirmation}
  </>
}

function CancelTargetsDialog({ order, targets, close, completed }: { order: ApplicationOrder; targets: ApplicationTarget[]; close: () => void; completed: () => void }) {
  const { mutate } = useWorkspace()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dismissal = useFormClose(!!reason, busy, close)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!reason.trim()) { setError('Captura el motivo de la cancelación.'); return }
    if (!targets.length) { setError('Esta selección ya no tiene destinos pendientes.'); return }
    setError(null)
    setBusy(true)
    try { await mutate({ type: 'cancel_application_targets', order_id: order.id, target_ids: targets.map(target => target.id), reason: reason.trim() }); completed() } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <>
    <RecordDialog title="Cancelar destinos pendientes" description={`${order.folio} · Se conservarán la indicación original y el motivo de cancelación.`} open onOpenChange={dismissal.onOpenChange}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <ErrorAlert message={error} />
        <ul className="list-disc pl-6">{targets.map(target => <li key={target.id}>{targetLabel(target)}</li>)}</ul>
        <fieldset disabled={busy}><FieldGroup><TextField label="Motivo de cancelación" value={reason} onChange={setReason} required /></FieldGroup></fieldset>
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={dismissal.requestClose} disabled={busy}>Volver</Button><SaveButton busy={busy}>Confirmar cancelación</SaveButton></div>
      </form>
    </RecordDialog>
    {dismissal.confirmation}
  </>
}

function TargetDetailsDialog({ order, target, close }: { order: ApplicationOrder; target: ApplicationTarget; close: () => void }) {
  if (!target) return null
  return <RecordDialog title={targetLabel(target)} description={`${order.folio} · Compara la instrucción original con el seguimiento de este destino.`} open onOpenChange={open => { if (!open) close() }} wide>
    <TargetStatus status={target.status} />
    <RecordDetails items={[
      { label: 'Cultivo y variedad', value: `${target.crop_name} / ${target.variety_name}` },
      { label: 'Superficie', value: `${formatArea(target.area_ha)} ha` },
      { label: 'Fecha programada', value: formatDate(order.scheduled_date) },
      { label: 'Fecha real', value: target.status === 'performed' ? formatDate(target.actual_date) : 'Sin realización' },
    ]} />
    <div className="application-comparison">
      <MixtureReadOnly products={order.products} water={order.water_l_ha} />
      {target.status === 'performed' && target.actual_water_l_ha !== null && <MixtureReadOnly title="Mezcla aplicada" products={target.actual_products} water={target.actual_water_l_ha} />}
    </div>
    {target.status === 'performed' && <>
      <Alert><AlertTitle>{target.has_changes ? 'Se registraron cambios respecto a la indicación' : 'Se aplicó conforme a lo indicado'}</AlertTitle></Alert>
      <RecordDetails items={[{ label: 'Equipo utilizado', value: target.equipment || 'Sin especificar' }, { label: 'Aplicador', value: target.applicator || 'Sin especificar' }, { label: 'Observaciones reales', value: <span className="whitespace-pre-wrap">{target.actual_observations || 'Sin observaciones.'}</span> }]} />
    </>}
    {target.status === 'cancelled' && <Alert><AlertTitle>Motivo de cancelación</AlertTitle><AlertDescription className="whitespace-pre-wrap">{target.cancellation_reason}</AlertDescription></Alert>}
    {target.status === 'indicated' && <p className="muted">La realización de este destino sigue pendiente.</p>}
    <div className="dialog-actions"><Button variant="outline" onClick={close}>Cerrar</Button></div>
  </RecordDialog>
}
