import { sortDisplay } from '@/domain/list-order'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { applyLotCorrection, lotCorrectionContext } from '@/domain/lot-corrections'
import type { LotCorrection, LotCorrectionInput, ProjectLot } from '@/domain/model'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorAlert, errorMessage, FormInput, FormSelect, formatArea, formatDate, RecordDialog, SaveButton, useFormClose } from './shared'

export function LotCorrectionEditor({ lot, close }: { lot: ProjectLot; close: () => void }) {
  const { data, profile, mutate } = useWorkspace()
  const [context] = useState(() => lotCorrectionContext(data, lot.id))
  const [id] = useState(() => crypto.randomUUID())
  const [name, setName] = useState(lot.name)
  const [area, setArea] = useState(String(lot.area_ha))
  const [correctArea, setCorrectArea] = useState(false)
  const [stageId, setStageId] = useState(context.current.length === 1 ? context.current[0].id : '')
  const selected = context.current.find(stage => stage.id === stageId)
  const [planned, setPlanned] = useState(selected?.planned_sowing_date ?? '')
  const [actual, setActual] = useState(selected?.actual_sowing_date ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const areaId = useId(), reasonId = useId()
  const dirty = name !== lot.name || correctArea || reason !== '' || planned !== (selected?.planned_sowing_date ?? '') || actual !== (selected?.actual_sowing_date ?? '')
  const { requestClose, onOpenChange, confirmation } = useFormClose(dirty, busy, close)
  const canCorrectArea = context.simple && context.current.length === 1
  function chooseStage(value: string) {
    const stage = context.current.find(row => row.id === value)
    setStageId(value); setPlanned(stage?.planned_sowing_date ?? ''); setActual(stage?.actual_sowing_date ?? '')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const next: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 200) next.name = 'Captura un nombre de hasta 200 caracteres.'
    if (!reason.trim() || reason.trim().length > 4000) next.reason = 'Captura un motivo de hasta 4,000 caracteres.'
    if (correctArea && (!area.trim() || !Number.isFinite(Number(area)) || Number(area) <= 0)) next.area = 'La superficie debe ser mayor que cero.'
    if (selected && !planned) next.planned = 'Captura la fecha planeada.'
    if (selected && !actual) next.actual = 'Captura la fecha real.'
    setErrors(next); if (Object.keys(next).length) return
    const input: LotCorrectionInput = { id, lot_id: lot.id, expected_version: context.lot.correction_version ?? 0, name: name.trim(), reason: reason.trim(),
      ...(correctArea ? { area_ha: Number(area) } : {}),
      ...(selected && (correctArea || planned !== selected.planned_sowing_date || actual !== selected.actual_sowing_date) ? { stage_id: selected.id, planned_sowing_date: planned, actual_sowing_date: actual } : {}),
    }
    setBusy(true); setError(null)
    try {
      if (!data.lotCorrections?.some(change => change.id === id)) applyLotCorrection(structuredClone(data), input, profile)
      await mutate({ type: 'correct_lot', record: input }); close()
    } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={`Corregir ${lot.name}`} description="Los valores anteriores quedan en el historial. Las siembras, aplicaciones y sus números se conservan." onOpenChange={onOpenChange} wide>
    <form noValidate onSubmit={event => { void submit(event) }} className="record-form">
      <FieldGroup>
        <FormInput label="Nombre de la malla" value={name} onChange={setName} error={errors.name} required disabled={busy} help={`Anterior: ${context.lot.name}`} />
        <Field><FieldLabel htmlFor={areaId}><Checkbox id={areaId} checked={correctArea} onCheckedChange={value => setCorrectArea(value === true)} disabled={busy || !canCorrectArea} />Corregir superficie de malla, siembra y recetas</FieldLabel><FieldDescription>{canCorrectArea ? 'Incluye todas las recetas de esta malla y proyecto: indicadas, realizadas y canceladas.' : 'La corrección conjunta requiere una subdivisión única y una siembra vigente. No se ajustan repartos automáticamente.'}</FieldDescription></Field>
        {correctArea && <><FormInput label="Superficie corregida (ha)" value={area} onChange={setArea} type="number" min="0.0001" max="99999999.9999" step="0.0001" error={errors.area} required disabled={busy} help={`Malla: ${formatArea(context.lot.area_ha)} ha · Siembra vigente: ${formatArea(selected?.area_ha ?? 0)} ha`} />
          <Alert><AlertTitle>Se corregirán las cantidades calculadas</AlertTitle><AlertDescription>{context.targets.length} destinos de recetas: {context.targets.filter(row => row.status === 'indicated').length} indicados, {context.targets.filter(row => row.status === 'performed').length} realizados y {context.targets.filter(row => row.status === 'cancelled').length} cancelados. Usarán {area || '—'} ha. Las dosis y el agua por hectárea conservan sus valores. Al guardar se vuelve a verificar el conjunto completo.</AlertDescription></Alert></>}
        {context.current.length > 1 && <FormSelect label="Siembra vigente a corregir" value={stageId} onChange={chooseStage} options={context.current.map(stage => ({ value: stage.id, label: `Etapa ${stage.stage_number} · ${context.subdivisions.find(sub => sub.id === stage.subdivision_id)?.name}` }))} disabled={busy} />}
        {selected ? <><p>Fechas de la etapa {selected.stage_number} · Solo se corrige esta siembra vigente.</p><div className="field-grid">
          <FormInput label="Fecha planeada de siembra" type="date" value={planned} onChange={setPlanned} error={errors.planned} required disabled={busy} help={`Anterior: ${formatDate(selected.planned_sowing_date)}`} />
          <FormInput label="Fecha real de siembra" type="date" value={actual} onChange={setActual} error={errors.actual} required disabled={busy} help={`Anterior: ${formatDate(selected.actual_sowing_date)}`} />
        </div><p className="muted">La fecha real debe respetar el cierre anterior y las fechas de aplicaciones ya registradas.</p></> : <p className="muted">Sin una siembra vigente seleccionada se corrige únicamente el nombre.</p>}
        <Field data-invalid={!!errors.reason}><FieldLabel htmlFor={reasonId}>Motivo de la corrección <span aria-hidden="true">*</span></FieldLabel><Textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} required maxLength={4000} aria-invalid={!!errors.reason} aria-describedby={`${reasonId}-help`} /><FieldDescription id={`${reasonId}-help`}>{errors.reason || 'Quedarán registrados el motivo, los valores anteriores y nuevos, la persona y la fecha.'}</FieldDescription></Field>
      </FieldGroup>
      <ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>Guardar corrección</SaveButton></div>
    </form>
  </RecordDialog>{confirmation}</>
}

function CorrectedTargets({ change }: { change: LotCorrection }) {
  const { data } = useWorkspace()
  const [count, setCount] = useState(50)
  const targets = useMemo(() => new Map(data.applicationTargets.map(row => [row.id, row])), [data.applicationTargets])
  const orders = useMemo(() => new Map(data.applicationOrders.map(row => [row.id, row])), [data.applicationOrders])
  const corrected = useMemo(() => new Map(change.after.targets.map(row => [row.id, row])), [change.after.targets])
  return <><Table><TableHeader><TableRow><TableHead>Folio / etapa</TableHead><TableHead>Estado al corregir</TableHead><TableHead>Antes</TableHead><TableHead>Después</TableHead></TableRow></TableHeader><TableBody>
    {sortDisplay(change.before.targets, before => { const target = targets.get(before.id); return `${target ? orders.get(target.order_id)?.folio ?? '' : ''} / Etapa ${target?.stage_number ?? ''}` }, before => before.id).slice(0, count).map(before => {
      const target = targets.get(before.id)
      const order = target ? orders.get(target.order_id) : undefined
      const after = corrected.get(before.id)
      return <TableRow key={before.id}><TableCell>{order?.folio ?? 'Aplicación conservada'} · Etapa {target?.stage_number ?? '—'}</TableCell><TableCell>{({ indicated: 'Indicada', performed: 'Realizada', cancelled: 'Cancelada' })[before.status]}</TableCell><TableCell>{formatArea(before.area_ha)} ha</TableCell><TableCell>{formatArea(after?.area_ha ?? before.area_ha)} ha</TableCell></TableRow>
    })}
  </TableBody></Table>{count < change.before.targets.length && <Button variant="outline" onClick={() => setCount(value => value + 50)}>Ver más destinos ({Math.min(count, change.before.targets.length)} de {change.before.targets.length})</Button>}</>
}

export function LotCorrectionHistory({ lotId }: { lotId: string }) {
  const { data } = useWorkspace()
  const changes = (data.lotCorrections ?? []).filter(change => change.lot_id === lotId).sort((a, b) => b.version - a.version)
  if (!changes.length) return null
  return <Collapsible><CollapsibleTrigger asChild><Button variant="outline"><History data-icon="inline-start" />Historial de correcciones ({changes.length})<ChevronDown data-icon="inline-end" /></Button></CollapsibleTrigger><CollapsibleContent>
    {changes.map(change => <article key={change.id} className="surface p-4 mt-3"><h3>Corrección {change.version}</h3><p className="muted">{change.changed_by_name} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(change.changed_at))}</p><p>{change.reason}</p>
      <dl className="record-details"><div><dt>Nombre anterior → nuevo</dt><dd>{change.before.lot.name} → {change.after.lot.name}</dd></div><div><dt>Superficie de malla anterior → nueva</dt><dd>{formatArea(change.before.lot.area_ha)} → {formatArea(change.after.lot.area_ha)} ha</dd></div>
        {change.before.stages.map(stage => { const after = change.after.stages.find(row => row.id === stage.id); return <div key={stage.id}><dt>Fechas de siembra anteriores → nuevas</dt><dd>Superficie: {formatArea(stage.area_ha)} → {formatArea(after?.area_ha ?? stage.area_ha)} ha<br />Planeada: {formatDate(stage.planned_sowing_date)} → {formatDate(after?.planned_sowing_date ?? stage.planned_sowing_date)}<br />Real: {formatDate(stage.actual_sowing_date)} → {formatDate(after?.actual_sowing_date ?? stage.actual_sowing_date)}</dd></div> })}
      </dl>
      {!!change.before.targets.length && <Collapsible><CollapsibleTrigger asChild><Button variant="outline">Ver {change.before.targets.length} destinos corregidos<ChevronDown data-icon="inline-end" /></Button></CollapsibleTrigger><CollapsibleContent><CorrectedTargets change={change} /></CollapsibleContent></Collapsible>}
    </article>)}
  </CollapsibleContent></Collapsible>
}
