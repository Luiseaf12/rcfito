import { useState, type FormEvent } from 'react'
import { History, Pencil } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { currentOrderIndication, indicationForTarget } from '@/domain/application-editing'
import type { ApplicationChange, ApplicationIndicationSnapshot, ApplicationOrder, ApplicationTarget } from '@/domain/model'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FieldGroup } from '@/components/ui/field'
import { RecordDialog, RecordDetails, FormInput, FormSelect, SaveButton, ErrorAlert, errorMessage, formatDate, recordName, useFormClose } from './shared'
import { businessToday, validDate, validateProducts, ProductMixtureEditor, MixtureReadOnly, TextField, type ProductDraft } from './application-fields'

const targetLabel = (target: ApplicationTarget) => `${target.lot_name} · ${target.subdivision_name} · Etapa ${target.stage_number}`
const amountError = (value: string, decimals: number, label: string) => {
  const number = Number(value)
  if (!value.trim() || !Number.isFinite(number) || number <= 0 || number >= 100_000_000) return `${label} debe ser mayor que cero y menor que 100,000,000.`
  return Number(number.toFixed(decimals)) !== number ? `${label} admite hasta ${decimals} decimales.` : ''
}

export function EditApplicationDialog({ order, target, close, completed }: { order: ApplicationOrder; target?: ApplicationTarget; close: () => void; completed: () => void }) {
  const { data, mutate } = useWorkspace()
  const correcting = !!target
  const [seed] = useState(() => {
    const indication = target ? indicationForTarget(data, order, target) : currentOrderIndication(data, order)
    const products = target ? target.actual_products : indication.products
    return { id: crypto.randomUUID(), indication, products, revision: order.revision ?? 0, targetVersion: target?.correction_version ?? 0,
      targetIds: data.applicationTargets.filter(item => item.order_id === order.id && item.status === 'indicated').map(item => item.id).sort(),
      form: { method_id: indication.method_id, indicated_date: indication.indicated_date, scheduled_date: indication.scheduled_date,
        actual_date: target?.actual_date ?? '', water_l_ha: String(target?.actual_water_l_ha ?? indication.water_l_ha),
        observations: target ? target.actual_observations : indication.observations, equipment: target?.equipment ?? '', applicator: target?.applicator ?? '', reason: '' } }
  })
  const [form, setForm] = useState(seed.form)
  const [rows, setRows] = useState<ProductDraft[]>(() => seed.products.map(product => ({ key: crypto.randomUUID(), product_id: product.product_id, dose: String(product.dose) })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = JSON.stringify({ ...form, reason: '' }) !== JSON.stringify(seed.form) || JSON.stringify(rows.map(row => [row.product_id, Number(row.dose)])) !== JSON.stringify(seed.products.map(product => [product.product_id, product.dose]))
  const dismissal = useFormClose(changed || !!form.reason, busy, close)
  const selectedTargets = correcting ? [target!] : data.applicationTargets.filter(item => seed.targetIds.includes(item.id))
  const issues: Record<string, string> = {}
  if (!form.reason.trim()) issues.reason = 'Captura el motivo del cambio para conservarlo en el historial.'
  else if (form.reason.length > 4000) issues.reason = 'El motivo admite hasta 4,000 caracteres.'
  if (form.observations.length > 4000) issues.observations = 'La nota u observaciones admiten hasta 4,000 caracteres.'
  if (!changed) issues.changes = 'Modifica al menos un dato de la aplicación antes de guardar una versión.'
  const mixtureError = validateProducts(rows)
  if (mixtureError) issues.products = mixtureError
  for (const [index, row] of rows.entries()) {
    const previous = seed.products.find(product => product.product_id === row.product_id)
    const product = data.catalogs.products.find(item => item.id === row.product_id)
    if (!previous && !product?.active) issues[`product:${index}`] = `Renglón ${index + 1}: selecciona un producto activo o conserva uno ya registrado.`
    const doseError = amountError(row.dose, 6, `La dosis del renglón ${index + 1}`)
    if (doseError) issues[`dose:${index}`] = doseError
  }
  const waterError = amountError(form.water_l_ha, 4, 'El gasto de agua')
  if (waterError) issues.water_l_ha = waterError
  const earliest = selectedTargets.reduce((value, item) => {
    const sowing = data.stages.find(stage => stage.id === item.stage_id)?.actual_sowing_date
    return sowing && sowing > value ? sowing : value
  }, correcting ? seed.indication.indicated_date : '')
  if (correcting) {
    const current = data.applicationTargets.find(item => item.id === target!.id)
    if (current?.status !== 'performed' || (current.correction_version ?? 0) !== seed.targetVersion) issues.version = 'La realización cambió. Conserva tus datos y vuelve a abrirla después de revisar la versión actual.'
    const end = data.stages.find(stage => stage.id === target!.stage_id)?.closed_at
    if (!validDate(form.actual_date) || form.actual_date < earliest || form.actual_date > businessToday() || end && form.actual_date > end) issues.actual_date = `La fecha real debe estar entre ${formatDate(earliest)} y ${formatDate(end && end < businessToday() ? end : businessToday())}.`
  } else {
    const pendingIds = data.applicationTargets.filter(item => item.order_id === order.id && item.status === 'indicated').map(item => item.id).sort()
    if (!pendingIds.length || JSON.stringify(pendingIds) !== JSON.stringify(seed.targetIds) || (order.revision ?? 0) !== seed.revision) issues.version = 'Los destinos o la indicación cambiaron. Conserva tus datos y vuelve a abrir la edición después de revisar el estado actual.'
    if (data.projects.find(project => project.id === order.project_id)?.status !== 'active') issues.project = 'La temporada debe estar activa para editar una indicación pendiente.'
    if (!data.catalogs.application_methods.some(method => method.id === form.method_id && (method.active || method.id === seed.indication.method_id))) issues.method_id = 'Selecciona un medio de aplicación disponible.'
    if (!validDate(form.indicated_date) || form.indicated_date < earliest) issues.indicated_date = `La fecha de indicación no puede ser anterior a la siembra (${formatDate(earliest)}).`
    if (!validDate(form.scheduled_date) || form.scheduled_date < form.indicated_date) issues.scheduled_date = 'La fecha programada debe ser válida e igual o posterior a la indicación.'
  }
  const update = (key: keyof typeof form, value: string) => { setError(null); setForm(previous => ({ ...previous, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (Object.keys(issues).length) { setError(Object.values(issues)[0]); return }
    setError(null); setBusy(true)
    const products = rows.map(row => ({ product_id: row.product_id, dose: Number(row.dose) }))
    try {
      if (correcting) await mutate({ type: 'correct_application_target', record: { id: seed.id, target_id: target!.id, expected_version: seed.targetVersion, actual_date: form.actual_date, water_l_ha: Number(form.water_l_ha), equipment: form.equipment, applicator: form.applicator, observations: form.observations, reason: form.reason, products } })
      else await mutate({ type: 'revise_application_order', record: { id: seed.id, order_id: order.id, expected_revision: seed.revision, target_ids: seed.targetIds, method_id: form.method_id, indicated_date: form.indicated_date, scheduled_date: form.scheduled_date, water_l_ha: Number(form.water_l_ha), observations: form.observations, reason: form.reason, products } })
      completed()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <>
    <RecordDialog title={correcting ? 'Corregir realización' : 'Editar indicación'} description={`${order.folio} · ${correcting ? 'Conserva la realización anterior y registra el motivo de la corrección.' : 'Los cambios se aplican a todos los destinos pendientes de esta orden.'}`} open onOpenChange={dismissal.onOpenChange} wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <ErrorAlert message={error} />
        <Alert><Pencil aria-hidden="true" /><AlertTitle>{correcting ? targetLabel(target!) : seed.targetIds.length === 1 ? '1 destino pendiente recibirá esta indicación' : `${seed.targetIds.length} destinos pendientes recibirán esta indicación`}</AlertTitle><AlertDescription>{correcting ? 'El folio, número por etapa y estado realizado se conservan.' : 'Los destinos realizados o cancelados conservan su indicación anterior. El folio y los números por etapa no cambian.'}</AlertDescription></Alert>
        {!correcting && <ul className="list-disc pl-5">{selectedTargets.map(item => <li key={item.id}>{targetLabel(item)}</li>)}</ul>}
        <fieldset disabled={busy} className="min-w-0 flex flex-col gap-6">
          {!correcting && <FieldGroup className="field-grid">
            <FormSelect label="Medio de aplicación" value={form.method_id} onChange={value => update('method_id', value)} required error={issues.method_id} options={data.catalogs.application_methods.filter(method => method.active || method.id === seed.indication.method_id).map(method => ({ value: method.id, label: `${method.name}${!method.active ? ' (inactivo, indicado)' : ''}` }))} />
            <FormInput label="Fecha de indicación" type="date" value={form.indicated_date} onChange={value => update('indicated_date', value)} required min={earliest} error={issues.indicated_date} />
            <FormInput label="Fecha programada" type="date" value={form.scheduled_date} onChange={value => update('scheduled_date', value)} required min={form.indicated_date} error={issues.scheduled_date} />
          </FieldGroup>}
          {correcting && <FieldGroup className="field-grid">
            <FormInput label="Fecha real de aplicación" type="date" value={form.actual_date} onChange={value => update('actual_date', value)} required min={earliest} max={businessToday()} error={issues.actual_date} />
            <FormInput label="Equipo utilizado" value={form.equipment} onChange={value => update('equipment', value)} />
            <FormInput label="Aplicador (opcional)" value={form.applicator} onChange={value => update('applicator', value)} />
          </FieldGroup>}
          <ProductMixtureEditor rows={rows} onChange={next => { setError(null); setRows(next) }} products={data.catalogs.products} activeIngredients={data.catalogs.active_ingredients} original={seed.products} error={issues.products} issues={Object.entries(issues).map(([field,message])=>({field,message}))} />
          <FieldGroup>
            <FormInput label={correcting ? 'Gasto de agua real (L/ha)' : 'Gasto de agua (L/ha)'} type="number" min="0.0001" step="any" value={form.water_l_ha} onChange={value => update('water_l_ha', value)} required error={issues.water_l_ha} />
            <TextField label={correcting ? 'Observaciones de la realización' : 'Nota de la aplicación'} value={form.observations} onChange={value => update('observations', value)} error={issues.observations} help="Opcional, hasta 4,000 caracteres." />
            <TextField label="Motivo del cambio" value={form.reason} onChange={value => update('reason', value)} required error={issues.reason} help="Se guarda junto con autor, fecha y valores anteriores. Hasta 4,000 caracteres." />
          </FieldGroup>
        </fieldset>
        {!!Object.keys(issues).length && <Alert role="status"><AlertTitle>Pendientes para guardar cambios</AlertTitle><AlertDescription><ul className="list-disc pl-5">{Object.entries(issues).map(([key,message])=><li key={key}>{message}</li>)}</ul></AlertDescription></Alert>}
        <div className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={dismissal.requestClose}>Volver</Button><SaveButton busy={busy} disabled={!!Object.keys(issues).length}>Guardar cambios</SaveButton></div>
      </form>
    </RecordDialog>{dismissal.confirmation}
  </>
}

function SnapshotDetails({ snapshot, title }: { snapshot: ApplicationChange['before']; title: string }) {
  const performed = 'actual_date' in snapshot
  return <section className="flex min-w-0 flex-col gap-4"><h3 className="section-title">{title}</h3>
    <RecordDetails items={performed ? [{ label: 'Fecha real', value: formatDate(snapshot.actual_date) }, { label: 'Equipo', value: snapshot.equipment || 'Sin especificar' }, { label: 'Aplicador', value: snapshot.applicator || 'Sin especificar' }] : [{ label: 'Medio', value: snapshot.method_name }, { label: 'Indicación', value: formatDate(snapshot.indicated_date) }, { label: 'Programación', value: formatDate(snapshot.scheduled_date) }]} />
    <MixtureReadOnly products={snapshot.products} water={snapshot.water_l_ha} title={performed ? 'Mezcla realizada' : 'Mezcla indicada'} />
    <p className="whitespace-pre-wrap break-words">{snapshot.observations || 'Sin nota u observaciones.'}</p>
  </section>
}

export function ApplicationChangeHistory({ order, target }: { order: ApplicationOrder; target?: ApplicationTarget }) {
  const { data } = useWorkspace()
  const changes = (data.applicationChanges ?? []).filter(change => change.order_id === order.id && (!target || change.target_ids.includes(target.id))).sort((a,b)=>b.changed_at.localeCompare(a.changed_at)||b.version-a.version)
  const original: ApplicationIndicationSnapshot = { method_id: order.method_id, method_name: order.method_name || recordName(data.catalogs.application_methods,order.method_id), indicated_date: order.indicated_date, scheduled_date: order.scheduled_date, water_l_ha: order.water_l_ha, observations: order.observations, products: order.products }
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><History aria-hidden="true" />Historial de cambios</CardTitle><CardDescription>La primera indicación y cada revisión conservan sus valores, destinos, autor y motivo.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <Collapsible><CollapsibleTrigger asChild><Button variant="outline">Ver indicación original</Button></CollapsibleTrigger><CollapsibleContent className="pt-4"><SnapshotDetails snapshot={original} title="Indicación original · versión 0" /></CollapsibleContent></Collapsible>
      {!changes.length && <p className="muted">Todavía no hay ediciones o correcciones registradas.</p>}
      {changes.map(change=><Collapsible key={change.id}><div className="flex flex-col gap-2"><CollapsibleTrigger asChild><Button variant="outline" className="h-auto min-h-11 whitespace-normal text-left">{change.kind==='indication'?'Revisión de indicación':'Corrección de realización'} {change.version} · {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mazatlan'}).format(new Date(change.changed_at))}</Button></CollapsibleTrigger><p className="muted">Por {change.changed_by_name || 'Administración'} · {change.target_ids.length} {change.target_ids.length===1?'destino':'destinos'}</p><p className="whitespace-pre-wrap break-words">{change.reason}</p></div>
        <CollapsibleContent className="pt-4"><ul className="mb-4 list-disc pl-5">{change.target_ids.map(id=><li key={id}>{data.applicationTargets.find(item=>item.id===id)?targetLabel(data.applicationTargets.find(item=>item.id===id)!):'Destino histórico'}</li>)}</ul><div className="application-comparison"><SnapshotDetails snapshot={change.before} title="Antes del cambio" /><SnapshotDetails snapshot={change.after} title="Después del cambio" /></div></CollapsibleContent>
      </Collapsible>)}
    </CardContent>
  </Card>
}
