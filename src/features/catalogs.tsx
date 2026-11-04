import { compareNamed, sortDisplay } from '@/domain/list-order'
import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import type { CatalogKind, CatalogRecord, ProductIngredient } from '@/domain/model'
import { catalogEditLocks, catalogRelationOptions, validateCatalogEdit } from '@/domain/catalogs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldGroup, FieldSet, FieldLegend, FieldDescription } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { catalogDefinitions, EmptyState, ErrorAlert, FormInput, FormSelect, LoadingState, normalizeSearch, recordName, RecordDetails, RecordDialog, SaveButton, SearchField, useFormClose, errorMessage } from './shared'

type Selection = { mode: 'view' | 'edit' | 'new'; id?: string } | null
const PAGE_SIZE = 8

export function CatalogsPage({ kind }: { kind: CatalogKind }) {
  return <CatalogController key={kind} kind={kind} />
}

function CatalogController({ kind }: { kind: CatalogKind }) {
  const { data, isAdmin, loading } = useWorkspace()
  const definition = catalogDefinitions[kind]
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [selection, setSelection] = useState<Selection>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const records = data.catalogs[kind]
  const relatedLabel = (record: CatalogRecord) => kind === 'fields' ? recordName(data.catalogs.agricultural_units, record.agricultural_unit_id) : kind === 'varieties' ? recordName(data.catalogs.crops, record.crop_id) : kind === 'active_ingredients' ? record.classification_id ? recordName(data.catalogs.ingredient_classifications, record.classification_id) : 'Sin clasificación' : kind === 'products' ? [recordName(data.catalogs.brands, record.brand_id), recordName(data.catalogs.product_families, record.family_id)].filter(name => name !== 'Sin asignar').join(' · ') : record.code || 'Registro de catálogo'
  const filtered = useMemo(() => {
    const search = normalizeSearch(query)
    return records.filter(record => (status === 'all' || record.active === (status === 'active')) && normalizeSearch(`${record.name} ${record.code ?? ''} ${(record.synonyms ?? []).join(' ')} ${relatedLabel(record)} ${record.ingredients?.map(item => recordName(data.catalogs.active_ingredients, item.ingredient_id)).join(' ') ?? ''}`).includes(search)).sort((a, b) => {
      const comparison = compareNamed(a, b)
      return order === 'asc' ? comparison : -comparison
    })
  }, [records, query, status, order, data.catalogs])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const record = selection?.id ? records.find(item => item.id === selection.id) : undefined
  if (loading) return <LoadingState />

  return <section className="workspace-page">
    <header className="page-header"><div><p className="eyebrow">{definition.eyebrow}</p><h1 className="page-title">{definition.title}</h1><p className="muted">{definition.description}</p></div>{isAdmin && <Button onClick={() => setSelection({ mode: 'new' })}><Plus data-icon="inline-start" aria-hidden="true" />Nuevo registro</Button>}</header>
    {notice && <Alert role="status"><AlertTitle>Registro guardado</AlertTitle><AlertDescription>{notice}<Button type="button" variant="ghost" onClick={() => setNotice(null)}>Entendido</Button></AlertDescription></Alert>}
    <div className="stat-grid catalog-stats" aria-label="Resumen del catálogo"><article className="metric-card"><span>Total de registros</span><strong>{records.length}</strong><small>En este catálogo</small></article><article className="metric-card"><span>Activos</span><strong>{records.filter(item => item.active).length}</strong><small>Disponibles para captura</small></article><article className="metric-card"><span>Inactivos</span><strong>{records.filter(item => !item.active).length}</strong><small>Conservan su historial</small></article></div>
    <div className="surface catalog-surface">
      <CatalogToolbar query={query} onQuery={value => { setQuery(value); setPage(1) }} status={status} onStatus={value => { setStatus(value); setPage(1) }} title={definition.title} resultCount={filtered.length} onReset={() => { setQuery(''); setStatus('all'); setPage(1) }} />
      {visible.length ? <DataTable records={visible} kind={kind} isAdmin={isAdmin} relatedLabel={relatedLabel} order={order} onOrder={() => { setOrder(order === 'asc' ? 'desc' : 'asc'); setPage(1) }} onView={id => setSelection({ id, mode: 'view' })} onEdit={id => setSelection({ id, mode: 'edit' })} /> : <EmptyState title={records.length ? 'No encontramos coincidencias' : `Tu primer registro de ${definition.title.toLocaleLowerCase('es')}`} description={records.length ? 'Prueba otra búsqueda o limpia los filtros para ver todos los registros.' : 'La información que agregues aquí estará disponible para planear las siembras.'} action={records.length ? <Button variant="outline" onClick={() => { setQuery(''); setStatus('all') }}>Limpiar filtros</Button> : isAdmin ? <Button onClick={() => setSelection({ mode: 'new' })}><Plus data-icon="inline-start" />Crear registro</Button> : undefined} />}
      <div className="table-pagination"><p className="muted" aria-live="polite">{filtered.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length} registros` : '0 registros'}</p><nav aria-label="Paginación del catálogo" className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><span className="page-number">{currentPage} / {pages}</span><Button variant="outline" size="icon" aria-label="Página siguiente" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></nav></div>
    </div>
    {selection?.mode === 'view' && record && <CatalogDetails key={record.id} kind={kind} record={record} close={() => setSelection(null)} edit={() => setSelection({ id: record.id, mode: 'edit' })} />}
    {selection && selection.mode !== 'view' && isAdmin && <CatalogEditor key={`${kind}-${selection.id ?? 'new'}`} kind={kind} record={record} close={() => setSelection(null)} saved={() => { setSelection(null); setNotice(query || status !== 'all' ? 'El cambio se confirmó. Conservamos tu búsqueda y filtros; si el registro ya no coincide con ellos, puedes limpiarlos para encontrarlo.' : 'El cambio se confirmó y se conservaron el orden y la página del catálogo.') }} />}
    {!isAdmin && <p className="permission-note">Tienes acceso de consulta. La administración mantiene los registros de este catálogo.</p>}
  </section>
}

export function CatalogToolbar({ query, onQuery, status, onStatus, title, resultCount, onReset }: { query: string; onQuery: (value: string) => void; status: string; onStatus: (value: string) => void; title: string; resultCount: number; onReset: () => void }) {
  return <div className="catalog-toolbar"><div className="toolbar"><SearchField value={query} onChange={onQuery} placeholder={`Buscar en ${title.toLocaleLowerCase('es')}…`} /><div className="toolbar-filter"><FormSelect order="provided" label="Estado" value={status} onChange={onStatus} options={[{ pinned: true, value: 'all', label: 'Todos los estados' }, { value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }]} /></div>{(query || status !== 'all') && <Button type="button" variant="ghost" onClick={onReset}><X data-icon="inline-start" />Limpiar</Button>}</div><p className="catalog-result muted" aria-live="polite">{resultCount} {resultCount === 1 ? 'registro encontrado' : 'registros encontrados'}</p></div>
}

export function DataTable({ records, kind, isAdmin, relatedLabel, order, onOrder, onView, onEdit }: { records: CatalogRecord[]; kind: CatalogKind; isAdmin: boolean; relatedLabel: (record: CatalogRecord) => string; order: 'asc' | 'desc'; onOrder: () => void; onView: (id: string) => void; onEdit: (id: string) => void }) {
  return <div className="table-wrap"><Table><TableHeader><TableRow><TableHead aria-sort={order === 'asc' ? 'ascending' : 'descending'}><Button type="button" variant="ghost" onClick={onOrder}>Nombre{order === 'asc' ? <ArrowUp data-icon="inline-end" /> : <ArrowDown data-icon="inline-end" />}</Button></TableHead><TableHead>{kind === 'fields' ? 'Agrícola' : kind === 'varieties' ? 'Cultivo' : kind === 'active_ingredients' ? 'Clasificación principal' : kind === 'products' ? 'Dosis de referencia' : 'Identificación'}</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{records.map(record => <TableRow key={record.id}><TableCell><div className="record-name">{record.name}</div>{(kind === 'products' || record.code) && <div className="muted record-secondary">{kind === 'products' ? relatedLabel(record) || 'Sin marca ni familia' : record.code}</div>}</TableCell><TableCell>{kind === 'products' ? <><span className="numeric">{new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(Number(record.default_dose ?? 0))} {record.unit}/ha</span><div className="muted record-secondary">{record.ingredients?.length ?? 0} ingrediente(s)</div></> : relatedLabel(record)}</TableCell><TableCell><Badge variant={record.active ? 'default' : 'secondary'}>{record.active ? 'Activo' : 'Inactivo'}</Badge></TableCell><TableCell><div className="row-actions"><Button variant="outline" onClick={() => onView(record.id)} aria-label={`Ver ${record.name}`}><Eye data-icon="inline-start" />Ver</Button>{isAdmin && <Button variant="outline" onClick={() => onEdit(record.id)} aria-label={`Editar ${record.name}`}><Pencil data-icon="inline-start" />Editar</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div>
}

function CatalogDetails({ kind, record, close, edit }: { kind: CatalogKind; record: CatalogRecord; close: () => void; edit: () => void }) {
  const { data, isAdmin, mutate } = useWorkspace()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const extra = kind === 'fields' ? [{ label: 'Agrícola', value: recordName(data.catalogs.agricultural_units, record.agricultural_unit_id) }] : kind === 'varieties' ? [{ label: 'Cultivo', value: recordName(data.catalogs.crops, record.crop_id) }] : kind === 'active_ingredients' ? [{ label: 'Clasificación principal', value: record.classification_id ? recordName(data.catalogs.ingredient_classifications, record.classification_id) : 'Sin clasificación' }] : kind === 'products' ? [{ label: 'Unidad fija', value: record.unit === 'g' ? 'Gramos (g)' : 'Mililitros (ml)' }, { label: 'Dosis predeterminada', value: `${record.default_dose ?? 0} ${record.unit}/ha` }, { label: 'Marca', value: recordName(data.catalogs.brands, record.brand_id) }, { label: 'Familia', value: recordName(data.catalogs.product_families, record.family_id) }] : []
  async function remove() {
    setBusy(true); setError(null)
    try { await mutate({ type: 'delete_catalog', kind, id: record.id }); close() } catch (failure) { setError(errorMessage(failure)); setConfirmDelete(false) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={record.name} description={`Detalle de ${catalogDefinitions[kind].singular}. Consulta su información sin modificarla.`} onOpenChange={open => { if (!open && !busy) close() }}><RecordDetails items={[{ label: 'Nombre', value: record.name }, ...(record.code ? [{ label: 'Clave', value: record.code }] : []), ...extra, { label: 'Estado', value: <Badge variant={record.active ? 'default' : 'secondary'}>{record.active ? 'Activo' : 'Inactivo'}</Badge> }]} />{kind === 'products' && <section className="flex flex-col gap-3"><Separator /><h3 className="section-title">Ingredientes activos</h3>{record.ingredients?.length ? <dl className="ingredient-details">{sortDisplay(record.ingredients, item => recordName(data.catalogs.active_ingredients, item.ingredient_id), item => item.ingredient_id).map(item => <div key={item.ingredient_id}><dt>{recordName(data.catalogs.active_ingredients, item.ingredient_id)}</dt><dd>{item.concentration || 'Concentración no especificada'}</dd></div>)}</dl> : <p className="muted">Sin ingredientes relacionados.</p>}</section>}{kind === 'products' && <section className="flex flex-col gap-3"><Separator /><h3 className="section-title">Sinónimos del producto</h3>{record.synonyms?.length ? <ul className="list-disc pl-5">{sortDisplay(record.synonyms, name => name, name => name).map(name=><li className="break-words" key={name}>{name}</li>)}</ul> : <p className="muted">Sin sinónimos registrados.</p>}</section>}<ErrorAlert message={error} /><div className="dialog-actions">{isAdmin && <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 data-icon="inline-start" />Eliminar</Button>}<div className="dialog-actions-end"><Button variant="outline" onClick={close} disabled={busy}>Cerrar</Button>{isAdmin && <Button onClick={edit} disabled={busy}><Pencil data-icon="inline-start" />Editar registro</Button>}</div></div></RecordDialog><AlertDialog open={confirmDelete} onOpenChange={open => { if (!busy) setConfirmDelete(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar {record.name}?</AlertDialogTitle><AlertDialogDescription>Se eliminará este registro si todavía no tiene relaciones. Si ya se utilizó, conserva su historial cambiando su estado a inactivo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Conservar registro</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Eliminando…' : 'Eliminar registro'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>
}

function CatalogEditor({ kind, record, close, saved }: { kind: CatalogKind; record?: CatalogRecord; close: () => void; saved: () => void }) {
  const { data, mutate, isAdmin } = useWorkspace()
  const [initial] = useState(() => ({ name: record?.name ?? '', code: record?.code ?? '', active: record?.active ?? true, agricultural_unit_id: record?.agricultural_unit_id ?? '', crop_id: record?.crop_id ?? '', classification_id: record?.classification_id ?? '__none', brand_id: record?.brand_id ?? '__none', family_id: record?.family_id ?? '__none', unit: record?.unit ?? 'g', default_dose: String(record?.default_dose ?? 0), synonyms: [...(record?.synonyms ?? [])], ingredients: (record?.ingredients ?? []).map(item => ({ ...item })) }))
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const locks = catalogEditLocks(data, kind, record)
  const { requestClose, onOpenChange, confirmation } = useFormClose(JSON.stringify(initial) !== JSON.stringify(form), busy, close)
  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  const options = (catalog: CatalogKind, existingIds: string[] = []) => catalogRelationOptions(data.catalogs[catalog], existingIds)
  const ingredients = record?.ingredients?.map(item => item.ingredient_id) ?? []

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isAdmin || busy) return
    const values: Partial<CatalogRecord> & Pick<CatalogRecord, 'name' | 'active'> = {
      ...(record ? { id: record.id, code: record.code } : {}), name: form.name.trim(), active: form.active,
    }
    if (kind === 'agricultural_units' || kind === 'fields') values.code = form.code.trim()
    if (kind === 'fields') values.agricultural_unit_id = form.agricultural_unit_id
    if (kind === 'varieties') values.crop_id = form.crop_id
    if (kind === 'active_ingredients') values.classification_id = form.classification_id === '__none' ? null : form.classification_id
    if (kind === 'products') Object.assign(values, {
      unit: form.unit, default_dose: Number(form.default_dose), synonyms: form.synonyms.map(name=>name.trim()),
      brand_id: form.brand_id === '__none' ? null : form.brand_id,
      family_id: form.family_id === '__none' ? null : form.family_id,
      ingredients: form.ingredients.map(item => ({ ingredient_id: item.ingredient_id, concentration: item.concentration?.trim() || null })),
    })
    const nextErrors = validateCatalogEdit(data, kind, values as CatalogRecord)
    if (kind === 'products' && form.default_dose.trim() === '') nextErrors.default_dose = 'Captura una dosis válida mayor o igual a cero.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'save_catalog', kind, record: values }); saved() }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  const updateIngredient = (index: number, change: Partial<ProductIngredient>) => update('ingredients', form.ingredients.map((item, position) => position === index ? { ...item, ...change } : item))

  return <>
    <RecordDialog open title={`${record ? 'Editar' : 'Nuevo registro de'} ${catalogDefinitions[kind].singular}`} description="Los campos con * son obligatorios. La información se conservará al corregir un error." onOpenChange={onOpenChange} wide={kind === 'products'}>
      <form onSubmit={event => { void submit(event) }} noValidate className="record-form">
        {record && <Alert><AlertTitle>El historial se conserva</AlertTitle><AlertDescription>Estos cambios actualizan el catálogo. Las siembras y aplicaciones registradas conservan sus datos originales.</AlertDescription></Alert>}
        <FieldGroup>
          <div className="field-grid">
            <FormInput label="Nombre" value={form.name} onChange={value => update('name', value)} error={errors.name} required disabled={busy} placeholder={kind === 'products' ? 'Nombre comercial del producto' : 'Nombre del registro'} />
            {(kind === 'agricultural_units' || kind === 'fields') && <FormInput label="Clave" value={form.code} onChange={value => update('code', value)} disabled={busy} help="Una referencia breve para identificarlo." />}
            {kind === 'fields' && <FormSelect label="Agrícola" value={form.agricultural_unit_id} onChange={value => update('agricultural_unit_id', value)} options={options('agricultural_units', record?.agricultural_unit_id ? [record.agricultural_unit_id] : [])} error={errors.agricultural_unit_id} required disabled={busy || !!locks.agricultural_unit_id} help={locks.agricultural_unit_id ?? 'Puedes cambiarla mientras el campo no tenga lotes relacionados.'} />}
            {kind === 'varieties' && <FormSelect label="Cultivo" value={form.crop_id} onChange={value => update('crop_id', value)} options={options('crops', record?.crop_id ? [record.crop_id] : [])} error={errors.crop_id} required disabled={busy || !!locks.crop_id} help={locks.crop_id ?? 'Puedes cambiarlo mientras la variedad no se utilice en etapas de siembra.'} />}
            {kind === 'active_ingredients' && <FormSelect label="Clasificación principal (opcional)" value={form.classification_id} onChange={value => update('classification_id', value)} options={[{ pinned: true, value: '__none', label: 'Sin clasificación' }, ...options('ingredient_classifications', record?.classification_id ? [record.classification_id] : [])]} error={errors.classification_id} disabled={busy} help="Elige su uso principal. Puedes mantener las opciones en el catálogo Usos de ingredientes. Una clasificación inactiva existente puede conservarse." />}
            {kind === 'products' && <>
              <FormSelect label="Unidad fija del producto" value={form.unit} onChange={value => update('unit', value as 'g' | 'ml')} options={[{ value: 'g', label: 'Gramos (g)' }, { value: 'ml', label: 'Mililitros (ml)' }]} error={errors.unit} required disabled={busy || !!locks.unit} help={locks.unit ?? 'Puedes cambiarla mientras el producto no se utilice en aplicaciones.'} />
              <FormInput label={`Dosis predeterminada (${form.unit}/ha)`} value={form.default_dose} onChange={value => update('default_dose', value)} type="number" min={0} step="any" error={errors.default_dose} required disabled={busy} help="Se usará como referencia en nuevas aplicaciones; las dosis ya registradas se conservan." />
              <FormSelect label="Marca (opcional)" value={form.brand_id} onChange={value => update('brand_id', value)} options={[{ pinned: true, value: '__none', label: 'Sin marca' }, ...options('brands', record?.brand_id ? [record.brand_id] : [])]} error={errors.brand_id} disabled={busy} />
              <FormSelect label="Familia (opcional)" value={form.family_id} onChange={value => update('family_id', value)} options={[{ pinned: true, value: '__none', label: 'Sin familia' }, ...options('product_families', record?.family_id ? [record.family_id] : [])]} error={errors.family_id} disabled={busy} />
            </>}
            <FormSelect order="provided" label="Estado" value={form.active ? 'active' : 'inactive'} onChange={value => update('active', value === 'active')} options={[{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }]} disabled={busy} help="Un registro inactivo conserva su historial y deja de ofrecerse en relaciones nuevas." />
          </div>
          {kind === 'products' && <FieldSet>
            <FieldLegend>Sinónimos del producto</FieldLegend>
            <FieldDescription>Nombres alternativos para reconocer este producto en la captura con IA. Hasta 20, de 2 a 80 caracteres. Se comprueban duplicados y nombres parecidos en todo el catálogo, incluidos productos inactivos.</FieldDescription>
            {form.synonyms.map((name,index)=><div className="flex items-start gap-3" key={index}>
              <FormInput label={`Sinónimo ${index+1}`} value={name} onChange={value=>update('synonyms',form.synonyms.map((item,position)=>position===index?value:item))} required disabled={busy} error={errors[`synonym:${index}`]} />
              <Button type="button" variant="outline" size="icon" aria-label={`Quitar sinónimo ${index+1}`} disabled={busy} onClick={()=>update('synonyms',form.synonyms.filter((_,position)=>position!==index))}><X /></Button>
            </div>)}
            {errors.synonyms && <p className="field-error" role="alert">{errors.synonyms}</p>}
            <Button type="button" variant="outline" disabled={busy || form.synonyms.length>=20} onClick={()=>update('synonyms',[...form.synonyms,''])}><Plus data-icon="inline-start" />Agregar sinónimo</Button>
          </FieldSet>}
          {kind === 'products' && <FieldSet>
            <FieldLegend>Ingredientes activos</FieldLegend>
            <FieldDescription>Relaciona sus ingredientes. La concentración es opcional y corresponde a este producto. Las aplicaciones registradas conservan su composición original.</FieldDescription>
            {form.ingredients.map((item, index) => <div className="ingredient-form-row" key={index}>
              <FormSelect label={`Ingrediente ${index + 1}`} value={item.ingredient_id} onChange={value => updateIngredient(index, { ingredient_id: value })} options={options('active_ingredients', ingredients).map(option => ({ ...option, disabled: form.ingredients.some((other, position) => position !== index && other.ingredient_id === option.value) }))} required disabled={busy} />
              <FormInput label="Concentración (opcional)" value={item.concentration ?? ''} onChange={value => updateIngredient(index, { concentration: value })} placeholder="Valor y unidad" disabled={busy} />
              <Button type="button" variant="outline" size="icon" aria-label={`Quitar ingrediente ${index + 1}`} disabled={busy} onClick={() => update('ingredients', form.ingredients.filter((_, position) => position !== index))}><X /></Button>
            </div>)}
            {errors.ingredients && <p className="field-error" role="alert">{errors.ingredients}</p>}
            <Button type="button" variant="outline" disabled={busy} onClick={() => update('ingredients', [...form.ingredients, { ingredient_id: '', concentration: null }])}><Plus data-icon="inline-start" />Agregar ingrediente</Button>
          </FieldSet>}
        </FieldGroup>
        <ErrorAlert message={error} />
        <div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>{record ? 'Guardar cambios' : 'Crear registro'}</SaveButton></div>
      </form>
    </RecordDialog>
    {confirmation}
  </>
}
