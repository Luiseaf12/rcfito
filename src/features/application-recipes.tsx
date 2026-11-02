import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Search } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { currentApplicationDestinations } from '@/domain/application-import'
import { applicationDraftIssues, type ApplicationDraftForm } from '@/domain/application-draft'
import { recipeCandidates, recipeHistory, recipeSource, validateRecipeSource, type RecipeCandidate } from '@/domain/application-recipes'
import { draftPdfIssues, snapshotDraftRecipe } from '@/domain/application-draft-document'
import { DraftRecipePdfButton, useDraftRecipePdf } from './application-draft-pdf'
import { currentOrderIndication } from '@/domain/application-editing'
import { applicationOriginLabel, eligibleGroupStages } from '@/domain/application-groups'
import { nextStageApplicationNumber } from '@/domain/applications'
import type { ApplicationIndicationSnapshot, ApplicationOrderInput } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ApplicationRecipePicker } from './application-recipe-picker'
import { eligibleDestinations, StageDestinationPicker } from './applications'
import { businessToday, MixtureReadOnly, newProductRow, ProductMixtureEditor, TextField, type ProductDraft } from './application-fields'
import { EmptyState, ErrorAlert, errorMessage, FormInput, FormSelect, formatArea, formatDate, recordName, SaveButton } from './shared'

type Selection = { project_id: string; field_id: string; crop_id: string; kind: 'lot' | 'group' | 'manual'; id: string; stage_ids: string[] }
type Base = { candidate: RecipeCandidate; indication: ApplicationIndicationSnapshot }
const blank = (): ApplicationDraftForm => ({ project_id: '', field_id: '', crop_id: '', method_id: '', indicated_date: businessToday(), scheduled_date: '', water_l_ha: '', observations: '', application_number: '' })

export function ApplicationCreationPage() {
  const { data, profile, isAdmin, mutate, refresh } = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [selection, setSelection] = useState<Selection>(() => {
    const eligible = currentApplicationDestinations(data)
    const unique = (values: string[], requested: string | null) => requested && values.includes(requested) ? requested : new Set(values).size === 1 ? values[0] : ''
    const scoped = eligible.filter(item => (!params.get('unit') || data.projects.some(project => project.id === item.lot.project_id && project.agricultural_unit_id === params.get('unit'))) && (!params.get('field') || item.lot.field_id === params.get('field')) && (!params.get('crop') || item.stage.crop_id === params.get('crop')))
    const project_id = unique((scoped.length ? scoped : eligible).map(item => item.lot.project_id), params.get('project'))
    const field_id = unique(eligible.filter(item => item.lot.project_id === project_id).map(item => item.lot.field_id), params.get('field'))
    const crop_id = unique(eligible.filter(item => item.lot.project_id === project_id && item.lot.field_id === field_id).map(item => item.stage.crop_id), params.get('crop'))
    return { project_id, field_id, crop_id, kind: 'lot', id: '', stage_ids: [] }
  })
  const [mode, setMode] = useState<'previous' | 'blank'>('previous')
  const [picking, setPicking] = useState(false)
  const [numberReviewed, setNumberReviewed] = useState(false)
  const [form, setForm] = useState(blank)
  const [rows, setRows] = useState<ProductDraft[]>([newProductRow()])
  const [base, setBase] = useState<Base | null>(null)
  const [edited, setEdited] = useState(false)
  const [datesEdited, setDatesEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const pdf = useDraftRecipePdf()
  const working = busy || pdf.busy
  const [lastAttempt, setLastAttempt] = useState<'save' | 'pdf'>('save')
  const saving = useRef(false)
  const [orderId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ action: () => void; leaving: boolean } | null>(null)
  const [attempted, setAttempted] = useState(false)
  const destinations = currentApplicationDestinations(data, selection.project_id, selection.field_id, selection.crop_id)
    .filter(item => selection.project_id && selection.field_id && selection.crop_id)
  const groups = data.sowingGroups.filter(group => group.active && group.project_id === selection.project_id && group.field_id === selection.field_id && group.crop_id === selection.crop_id && eligibleGroupStages(data, group).length)
  const group = selection.kind === 'group' ? groups.find(item => item.id === selection.id) : undefined
  const stageIds = selection.stage_ids
  const expectedIds = destinations.filter(item => selection.kind === 'manual' ? stageIds.includes(item.stage.id) : selection.kind === 'lot' ? item.lot.id === selection.id : group && eligibleGroupStages(data, group).includes(item.stage.id)).map(item => item.stage.id).sort()
  const chosen = destinations.filter(item => stageIds.includes(item.stage.id))
  const destinationsChanged = (!!selection.id || stageIds.length > 0) && JSON.stringify([...stageIds].sort()) !== JSON.stringify(expectedIds)
  const candidates = useMemo(() => recipeCandidates(data, stageIds, selection.kind === 'group' ? selection.id : undefined), [data, stageIds, selection.kind, selection.id])
  const history = useMemo(() => recipeHistory(data, stageIds, selection.kind === 'group' ? selection.id : undefined), [data, stageIds, selection.kind, selection.id])
  const sourceOrder = data.applicationOrders.find(item => item.id === base?.candidate.order_id)
  const source = base ? recipeSource(base.candidate, group?.id) : undefined
  const record: ApplicationOrderInput = { ...form, project_id: selection.project_id, field_id: selection.field_id, crop_id: selection.crop_id, id: orderId, stage_ids: stageIds, products: rows.map(row => ({ product_id: row.product_id, dose: Number(row.dose) })), water_l_ha: Number(form.water_l_ha), application_number: form.application_number.trim() ? Number(form.application_number) : undefined, ...(group ? { source_group_id: group.id } : {}), ...(source ? { recipe_source: source } : {}) }
  let stale = ''
  try { validateRecipeSource(data, record) } catch (err) { stale = errorMessage(err) }
  const issues = applicationDraftIssues(data, { ...form, ...selection }, rows, stageIds, { imported: false, unresolvedDestinations: [], destinationsReviewed: true, numberReviewed })
  if (mode === 'previous' && stageIds.length && !base) issues.unshift({ field: 'base', message: 'Elige la receta que servirá de base.' })
  if (destinationsChanged) issues.unshift({ field: 'destinations', message: 'Los destinos cambiaron. Vuelve a seleccionar el lote o grupo para revisar la base y los destinos; tu captura se conserva hasta que aceptes reemplazarla.' })
  if (stale) issues.unshift({ field: 'base', message: stale })
  const pdfIssues = draftPdfIssues(form, issues)
  const visibleIssues = lastAttempt === 'pdf' ? pdfIssues : issues
  const issue = (field: string) => attempted ? visibleIssues.find(item => item.field === field)?.message : undefined
  const unusualNumber = form.application_number.trim() && Number.isInteger(Number(form.application_number)) && Number(form.application_number) > 0 && !issues.some(item => item.field === 'application_number') && chosen.some(item => nextStageApplicationNumber(data, item.stage.id) !== Number(form.application_number))
  const dirty = edited || datesEdited
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !saving.current && (dirty || pdf.busy) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  const request = (action: () => void, leaving = false) => {
    if (saving.current || pdf.busy) return
    if (!leaving && edited) setPending({ action, leaving })
    else action()
  }
  // Router blocking covers shell links, Cancel and browser Back; native close/reload is separate.
  useEffect(() => {
    if (!dirty && !working) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [dirty, working])

  function load(candidate: RecipeCandidate | undefined) {
    const order = data.applicationOrders.find(item => item.id === candidate?.order_id)
    const indication = order ? structuredClone(currentOrderIndication(data, order)) : null
    setBase(candidate && indication ? { candidate, indication } : null)
    setRows(indication ? indication.products.map(product => ({ key: crypto.randomUUID(), product_id: product.product_id, dose: String(product.dose) })) : [newProductRow()])
    setForm(previous => ({ ...previous, method_id: indication?.method_id ?? '', water_l_ha: indication ? String(indication.water_l_ha) : '', observations: indication?.observations ?? '' }))
    setEdited(false); setError(''); setAttempted(false)
  }
  function change(next: Selection) {
    const options = currentApplicationDestinations(data, next.project_id, next.field_id, next.crop_id)
    const selected = next.kind === 'manual' ? next.stage_ids.filter(id => options.some(item => item.stage.id === id)) : next.kind === 'lot' ? options.filter(item => item.lot.id === next.id).map(item => item.stage.id) : (data.sowingGroups.find(item => item.id === next.id) ? eligibleGroupStages(data, data.sowingGroups.find(item => item.id === next.id)!) : [])
    setSelection({ ...next, stage_ids: selected }); setNumberReviewed(false)
    const bases = recipeCandidates(data, selected, next.kind === 'group' ? next.id : undefined)
    load(mode === 'previous' && bases.length === 1 ? bases[0] : undefined)
  }
  function changeMode(next: 'previous' | 'blank') {
    request(() => { setMode(next); load(next === 'previous' && candidates.length === 1 ? candidates[0] : undefined) })
  }
  function update(field: keyof ApplicationDraftForm, value: string) {
    setForm(previous => ({ ...previous, [field]: value }))
    if (field === 'application_number') setNumberReviewed(false)
    if (field === 'indicated_date' || field === 'scheduled_date' || field === 'application_number') setDatesEdited(true)
    else setEdited(true)
  }
  function exportPdf() {
    if (working) return
    setLastAttempt('pdf'); setAttempted(true); setError('')
    if (pdfIssues.length || !isAdmin) return
    try {
      const snapshot = snapshotDraftRecipe(data, { id: orderId, profile, generated_at: new Date().toISOString(), form: { ...form, project_id: selection.project_id, field_id: selection.field_id, crop_id: selection.crop_id }, products: rows, stage_ids: stageIds, source_group_id: group?.id, recipe_source: source, review: { imported: false, unresolvedDestinations: [], destinationsReviewed: true, numberReviewed } })
      void pdf.exportDocument(snapshot)
    } catch (err) { setError(errorMessage(err)) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setLastAttempt('save'); setAttempted(true)
    if (saving.current || pdf.busy || issues.length || !isAdmin) return
    saving.current = true; setBusy(true); setError('')
    try { await mutate({ type: 'create_application_order', record }); setEdited(false); setDatesEdited(false); navigate(`/aplicaciones/${orderId}`) }
    catch (err) { setError(errorMessage(err)) }
    finally { saving.current = false; setBusy(false) }
  }

  if (!isAdmin) return <div className="workspace-page"><EmptyState title="Solo consulta" description="La administración crea las nuevas indicaciones." action={<Button asChild variant="outline"><Link to="/aplicaciones">Volver a aplicaciones</Link></Button>} /></div>
  const projects = data.projects.filter(project => project.status === 'active' && data.catalogs.agricultural_units.some(unit => unit.id === project.agricultural_unit_id && unit.active))
  const project = projects.find(item => item.id === selection.project_id)
  const lots = [...new Map(destinations.map(item => [item.lot.id, item.lot])).values()]
  const suggested = selection.kind === 'lot' && sourceOrder?.source_group_id ? groups.find(item => item.id === sourceOrder.source_group_id) : undefined
  const methods = data.catalogs.application_methods.filter(method => method.active || method.id === form.method_id)
  return <div className="workspace-page">
    <header className="page-header"><div><Button type="button" variant="ghost" onClick={() => request(() => navigate('/aplicaciones'), true)}><ArrowLeft data-icon="inline-start" />Aplicaciones</Button><h1 className="page-title">Nueva indicación</h1><p className="muted">Usa una receta anterior o comienza desde cero en el mismo formulario.</p></div></header>
    <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
      <fieldset disabled={working} className="flex min-w-0 flex-col gap-6">
        <Card><CardHeader><CardTitle>Destino de la indicación</CardTitle><CardDescription>Solo etapas sembradas vigentes del mismo campo y cultivo.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">
          <FieldGroup className="field-grid [container-type:normal]">
            <FormSelect label="Proyecto de temporada" value={selection.project_id} required options={projects.map(item => ({ value: item.id, label: `${recordName(data.catalogs.agricultural_units, item.agricultural_unit_id)} · ${item.name}` }))} onChange={value => request(() => change({ ...selection, project_id: value, field_id: '', crop_id: '', id: '' }))} error={issue('project_id')} />
            <FormSelect label="Campo" value={selection.field_id} required disabled={!project} options={data.catalogs.fields.filter(item => item.active && item.agricultural_unit_id === project?.agricultural_unit_id).map(item => ({ value: item.id, label: item.name }))} onChange={value => request(() => change({ ...selection, field_id: value, crop_id: '', id: '' }))} error={issue('field_id')} />
            <FormSelect label="Cultivo" value={selection.crop_id} required disabled={!selection.field_id} options={data.catalogs.crops.filter(item => item.active && currentApplicationDestinations(data, selection.project_id, selection.field_id, item.id).length).map(item => ({ value: item.id, label: item.name }))} onChange={value => request(() => change({ ...selection, crop_id: value, id: '' }))} error={issue('crop_id')} />
          </FieldGroup>
          <ToggleGroup type="single" variant="outline" value={selection.kind} aria-label="Tipo de destino" className="max-w-full flex-wrap" onValueChange={value => { if (value) request(() => change({ ...selection, kind: value as Selection['kind'], id: '', stage_ids: [] })) }}><ToggleGroupItem value="lot" className="min-h-11">Un lote</ToggleGroupItem><ToggleGroupItem value="group" className="min-h-11">Un grupo</ToggleGroupItem><ToggleGroupItem value="manual" className="min-h-11">Manual</ToggleGroupItem></ToggleGroup>
          {selection.kind !== 'manual' && <FormSelect label={selection.kind === 'lot' ? 'Lote' : 'Grupo de siembra'} value={selection.id} required disabled={!selection.crop_id} options={(selection.kind === 'lot' ? lots : groups).map(item => ({ value: item.id, label: item.name }))} onChange={id => request(() => change({ ...selection, id }))} help={selection.kind === 'group' && !groups.length && selection.crop_id ? 'No hay grupos activos con destinos vigentes en este contexto.' : undefined} error={issue('destinations')} />}
          {selection.kind === 'manual' && <StageDestinationPicker options={eligibleDestinations(data, selection.project_id, selection.field_id, selection.crop_id).filter(() => !!selection.project_id && !!selection.field_id && !!selection.crop_id)} selected={stageIds} onChange={ids => request(() => change({ ...selection, stage_ids: ids }))} error={issue('destinations')} />}
          {group && [...new Set([...group.stage_ids, ...(group.historical_stage_ids ?? [])])].some(id => !stageIds.includes(id)) && <p className="muted">Las etapas retiradas o cerradas permanecen en el historial del grupo y no reciben esta nueva indicación.</p>}
          {chosen.length > 0 && <div className="flex flex-col gap-3" aria-label="Destinos y numeración">{chosen.map(({ stage, lot, subdivision }) => <div key={stage.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><strong>{lot.name} · {subdivision.name}</strong><p className="muted">Etapa {stage.stage_number} · {stage.variety_name_snapshot || recordName(data.catalogs.varieties, stage.variety_id)} · {formatArea(stage.area_ha)} ha</p></div><strong>Siguiente #{nextStageApplicationNumber(data, stage.id)}</strong></div>)}<p className="muted">{chosen.length} destinos · {formatArea(chosen.reduce((sum, item) => sum + item.stage.area_ha, 0))} ha. El número definitivo se asigna al guardar.</p></div>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>¿Cómo quieres comenzar?</CardTitle><CardDescription>La última receta activa se propone por defecto; puedes elegir otra o capturar desde cero.</CardDescription></CardHeader><CardContent>
          <ToggleGroup type="single" variant="outline" value={mode} aria-label="Cómo iniciar la indicación" className="w-full flex-col items-stretch sm:w-fit sm:flex-row" onValueChange={value => { if (value) changeMode(value as 'previous' | 'blank') }}><ToggleGroupItem value="previous" className="min-h-11">Usar receta anterior</ToggleGroupItem><ToggleGroupItem value="blank" className="min-h-11">Empezar desde cero</ToggleGroupItem></ToggleGroup>
        </CardContent></Card>
        {mode === 'previous' && stageIds.length > 0 && <Card><CardHeader><CardTitle>Receta base</CardTitle><CardDescription>{selection.kind === 'group' ? 'Recetas emitidas para este grupo, con destinos vigentes activos.' : 'Recetas activas de las etapas vigentes seleccionadas.'}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
          <div className="section-actions"><Button type="button" variant="outline" disabled={!history.length} onClick={() => setPicking(true)}><Search data-icon="inline-start" />Buscar otra receta</Button>{base && <p className="muted">{candidates.some(item => item.order_id === base.candidate.order_id) ? 'Última activa seleccionada' : 'Receta anterior seleccionada'}</p>}</div>
          {candidates.length > 1 && !base && <FormSelect label="Elige la receta base" value="" options={candidates.map(candidate => { const order = data.applicationOrders.find(item => item.id === candidate.order_id)!; return { value: order.id, label: `${order.folio} · ${formatDate(candidate.indicated_date)} · ${candidate.stage_ids.map(id => { const item = chosen.find(destination => destination.stage.id === id); return item ? `${item.subdivision.name}, etapa ${item.stage.stage_number}` : ''; }).join('; ')}` } })} onChange={id => request(() => load(candidates.find(item => item.order_id === id)))} help="Hay empates de fecha o historias distintas por subdivisión. Elige una sola mezcla." error={issue('base')} />}
          {!history.length && !base && <Alert><AlertTitle>Sin receta anterior activa</AlertTitle><AlertDescription>No hay recetas activas de estas etapas. Puedes capturar la primera indicación.<Button type="button" variant="outline" onClick={() => changeMode('blank')}>Continuar desde cero</Button></AlertDescription></Alert>}
          {base && sourceOrder && <><p><strong>{sourceOrder.folio}</strong> · {formatDate(base.indication.indicated_date)} · Versión {base.candidate.revision}</p><p className="muted">{applicationOriginLabel(sourceOrder)}</p><Collapsible><CollapsibleTrigger asChild><Button type="button" variant="outline" className="min-h-11">Ver receta anterior<ChevronDown data-icon="inline-end" /></Button></CollapsibleTrigger><CollapsibleContent className="flex flex-col gap-3 pt-4"><MixtureReadOnly products={base.indication.products} water={base.indication.water_l_ha} /><p>Medio: {base.indication.method_name || recordName(data.catalogs.application_methods, base.indication.method_id)}</p><p className="whitespace-pre-wrap">{base.indication.observations || 'Sin nota'}</p><Button asChild variant="outline"><Link to={`/aplicaciones/${sourceOrder.id}`} target="_blank" rel="noreferrer">Consultar receta e historial</Link></Button></CollapsibleContent></Collapsible></>}
          {suggested && <Alert><AlertTitle>La receta provino del grupo {suggested.name}</AlertTitle><AlertDescription>La nueva indicación cubre solo este lote. Puedes elegir todos los destinos vigentes del grupo.<Button type="button" variant="outline" onClick={() => request(() => change({ ...selection, kind: 'group', id: suggested.id }))}>Usar grupo</Button></AlertDescription></Alert>}
          {stale && <ErrorAlert message={stale} retry={() => request(() => load(candidates.length === 1 ? candidates[0] : undefined))} />}
        </CardContent></Card>}
        {(mode === 'blank' || base) && <Card><CardHeader><CardTitle>Datos de la nueva indicación</CardTitle><CardDescription>{mode === 'previous' ? 'Edita la copia de la mezcla indicada. La receta anterior se conserva.' : 'Captura productos, dosis, agua y fechas para esta nueva indicación.'}</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">
          {(form.method_id && !data.catalogs.application_methods.some(item => item.id === form.method_id && item.active) || rows.some(row => row.product_id && !data.catalogs.products.some(item => item.id === row.product_id && item.active))) && <Alert variant="destructive"><AlertTitle>Hay referencias inactivas en la copia</AlertTitle><AlertDescription>Reemplaza los productos o el medio inactivos antes de guardar. La receta anterior conserva sus valores históricos.</AlertDescription></Alert>}
          <FieldGroup className="field-grid [container-type:normal]">
            <FormInput label="Fecha de indicación" type="date" value={form.indicated_date} onChange={value => update('indicated_date', value)} required error={issue('indicated_date')} />
            <FormInput label="Fecha programada" help="Obligatoria para guardar. En el PDF puede quedar por confirmar." type="date" value={form.scheduled_date} onChange={value => update('scheduled_date', value)} required error={issue('scheduled_date')} />
            <FormSelect label="Medio de aplicación" value={form.method_id} onChange={value => update('method_id', value)} options={methods.map(method => ({ value: method.id, label: `${method.name}${method.active ? '' : ' (inactivo; reemplazar)'}`, disabled: !method.active }))} required error={issue('method_id')} />
            <FormInput label="Gasto de agua (L/ha)" type="number" min="0.0001" step="any" value={form.water_l_ha} onChange={value => update('water_l_ha', value)} required error={issue('water_l_ha')} />
          </FieldGroup>
          <ProductMixtureEditor rows={rows} onChange={value => { setRows(value); setEdited(true) }} products={data.catalogs.products} activeIngredients={data.catalogs.active_ingredients} original={base?.indication.products} issues={attempted ? visibleIssues : []} error={issue('products')} />
          <TextField label="Nota de la aplicación" value={form.observations} onChange={value => update('observations', value)} error={issue('observations')} />
          <Collapsible><CollapsibleTrigger asChild><Button type="button" variant="outline" className="min-h-11">Numeración de la aplicación<ChevronDown data-icon="inline-end" /></Button></CollapsibleTrigger><CollapsibleContent className="flex flex-col gap-4 pt-4"><FormInput label="Número de aplicación en la etapa" type="number" min="1" max="2147483647" step="1" value={form.application_number} onChange={value => update('application_number', value)} help="Vacío: asigna el siguiente número disponible en cada etapa." error={issue('application_number')} />{unusualNumber && <Field orientation="horizontal"><Checkbox id="new-application-number-reviewed" checked={numberReviewed} onCheckedChange={value => setNumberReviewed(value === true)} /><FieldLabel htmlFor="new-application-number-reviewed">Revisé el historial y confirmo este número, aunque difiera del siguiente disponible.</FieldLabel></Field>}{issue('number_review') && <FieldDescription>{issue('number_review')}</FieldDescription>}</CollapsibleContent></Collapsible>
        </CardContent></Card>}
      </fieldset>
      {destinationsChanged && <ErrorAlert message="Los destinos cambiaron durante la captura. Revisa la selección antes de guardar." retry={() => request(() => change(selection))} />}
      {error && <ErrorAlert message={error} retry={() => void refresh().catch(err => setError(errorMessage(err)))} />}
      {pdf.error && <ErrorAlert message={pdf.error} />}
      {attempted && visibleIssues.length > 0 && <Alert variant="destructive"><AlertTitle>Revisa la nueva indicación</AlertTitle><AlertDescription><ul className="list-disc pl-5">{visibleIssues.map(item => <li key={item.field}>{item.message}</li>)}</ul></AlertDescription></Alert>}
      <FieldDescription>El PDF es un borrador para revisión. Si cambias datos, vuelve a exportarlo para confirmar esa versión.</FieldDescription>
      <div className="section-actions"><Button type="button" variant="outline" disabled={working} onClick={() => request(() => navigate('/aplicaciones'), true)}>Cancelar</Button><DraftRecipePdfButton busy={pdf.busy} disabled={busy || !stageIds.length || destinationsChanged || !!stale || mode === 'previous' && !base} onClick={exportPdf} /><SaveButton busy={busy} disabled={pdf.busy || !stageIds.length || destinationsChanged || !!stale || mode === 'previous' && !base}>Guardar indicación</SaveButton></div>
    </form>
    {picking && <ApplicationRecipePicker data={data} history={history} latest={candidates} selectedId={base?.candidate.order_id} close={() => setPicking(false)} choose={candidate => { setPicking(false); request(() => load(candidate)) }} />}
    <AlertDialog open={!!pending || blocker.state === 'blocked'} onOpenChange={open => { if (!open) { setPending(null); if (blocker.state === 'blocked') blocker.reset() } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{blocker.state === 'blocked' ? '¿Descartar los cambios?' : '¿Reemplazar la mezcla editada?'}</AlertDialogTitle><AlertDialogDescription>{blocker.state === 'blocked' ? 'La nueva indicación todavía no se ha guardado.' : 'Se cargará la base del nuevo destino o receta. Las fechas que capturaste se conservan.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); else pending?.action(); setPending(null) }}>{blocker.state === 'blocked' ? 'Descartar cambios' : 'Reemplazar mezcla'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
