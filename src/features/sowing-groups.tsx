import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Eye, Pencil, Plus } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import type { SowingGroup, WorkspaceData } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { eligibleDestinations, StageDestinationPicker } from './applications'
import { EmptyState, ErrorAlert, errorMessage, FormInput, FormSelect, formatArea, LoadingState, normalizeSearch, recordName, RecordDetails, RecordDialog, SaveButton, SearchField, useFormClose } from './shared'

function groupStageLabel(data: WorkspaceData, stageId: string) {
  const stage = data.stages.find(item => item.id === stageId)
  const subdivision = data.subdivisions.find(item => item.id === stage?.subdivision_id)
  const lot = data.lots.find(item => item.id === subdivision?.lot_id)
  return stage ? `${lot?.name ?? 'Lote'} · ${subdivision?.name ?? 'Subdivisión'} · Etapa ${stage.stage_number}` : 'Etapa conservada en el historial'
}

function membership(data: WorkspaceData, group: SowingGroup) {
  const eligible = eligibleDestinations(data, group.project_id, group.field_id, group.crop_id)
  const current = eligible.filter(option => group.stage_ids.includes(option.stage.id))
  const historical = [...new Set([...(group.historical_stage_ids ?? []), ...group.stage_ids.filter(id => !eligible.some(option => option.stage.id === id))])]
  return { current, historical }
}

export function SowingGroupsPage() {
  const { data, isAdmin, loading } = useWorkspace()
  const [query, setQuery] = useState('')
  const [projectId, setProjectId] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<{ kind: 'create' } | { kind: 'view' | 'edit'; group: SowingGroup } | null>(null)
  const [notice, setNotice] = useState('')
  if (loading) return <LoadingState />
  const groups = data.sowingGroups ?? []
  const filtered = groups.filter(group => {
    const project = data.projects.find(item => item.id === group.project_id)
    const text = [group.name, project?.name, project?.season, recordName(data.catalogs.agricultural_units, project?.agricultural_unit_id), recordName(data.catalogs.fields, group.field_id), recordName(data.catalogs.crops, group.crop_id)].join(' ')
    return (projectId === 'all' || group.project_id === projectId) && (status === 'all' || group.active === (status === 'active')) && normalizeSearch(text).includes(normalizeSearch(query))
  }).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8)
  return <section className="workspace-page flex flex-col gap-6">
    <header className="page-header">
      <div><p className="eyebrow">Planeación agrícola</p><h1 className="page-title">Grupos de siembra</h1><p className="muted">Guarda selecciones de etapas del mismo campo y cultivo para reutilizarlas al indicar aplicaciones.</p></div>
      {isAdmin && <Button onClick={() => setModal({ kind: 'create' })}><Plus data-icon="inline-start" />Nuevo grupo</Button>}
    </header>
    {notice && <Alert role="status"><Check /><AlertTitle>{notice}</AlertTitle></Alert>}
    <Alert><AlertTitle>Los grupos se forman manualmente</AlertTitle><AlertDescription>Una etapa cerrada permanece en el historial del grupo y deja de ser destino de nuevas aplicaciones. La siguiente siembra se agrega expresamente.</AlertDescription></Alert>
    <div className="surface">
      <FieldGroup className="catalog-toolbar field-grid">
        <SearchField label="Buscar grupos" value={query} onChange={value => { setQuery(value); setPage(1) }} placeholder="Nombre, agrícola, campo o cultivo…" />
        <FormSelect label="Proyecto" value={projectId} onChange={value => { setProjectId(value); setPage(1) }} options={[{ value: 'all', label: 'Todos los proyectos' }, ...data.projects.map(project => ({ value: project.id, label: `${project.name} · ${project.season}` }))]} />
        <FormSelect label="Estado del grupo" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: 'all', label: 'Todos los estados' }, { value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }]} />
      </FieldGroup>
      {visible.length ? <div className="table-wrap"><Table>
        <TableHeader><TableRow><TableHead>Grupo y proyecto</TableHead><TableHead>Campo y cultivo</TableHead><TableHead>Etapas vigentes</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
        <TableBody>{visible.map(group => {
          const project = data.projects.find(item => item.id === group.project_id)
          const { current, historical } = membership(data, group)
          return <TableRow key={group.id}>
            <TableCell><strong>{group.name}</strong><div className="muted record-secondary">{project?.name} · {project?.season}</div></TableCell>
            <TableCell>{recordName(data.catalogs.fields, group.field_id)}<div className="muted record-secondary">{recordName(data.catalogs.crops, group.crop_id)}</div></TableCell>
            <TableCell><strong>{current.length}</strong> · {formatArea(current.reduce((sum, option) => sum + Number(option.stage.area_ha), 0))} ha{historical.length > 0 && <div className="muted record-secondary">{historical.length} en historial</div>}{!current.length && <div className="muted record-secondary">Sin candidatos para indicar</div>}</TableCell>
            <TableCell><Badge variant={group.active ? 'default' : 'secondary'}>{group.active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
            <TableCell><div className="section-actions"><Button variant="outline" onClick={() => setModal({ kind: 'view', group })} aria-label={`Ver grupo ${group.name}`}><Eye data-icon="inline-start" />Ver</Button>{isAdmin && project?.status !== 'closed' && <Button variant="outline" onClick={() => setModal({ kind: 'edit', group })} aria-label={`Editar grupo ${group.name}`}><Pencil data-icon="inline-start" />Editar</Button>}</div></TableCell>
          </TableRow>
        })}</TableBody>
      </Table></div> : <EmptyState title={groups.length ? 'No encontramos grupos con esos filtros' : 'Reúne etapas que se aplican juntas'} description={groups.length ? 'Busca otro nombre o cambia los filtros de proyecto y estado.' : 'Crea un grupo con etapas sembradas del mismo campo y cultivo. La selección de sus miembros siempre será manual.'} action={isAdmin && !groups.length ? <Button onClick={() => setModal({ kind: 'create' })}><Plus data-icon="inline-start" />Nuevo grupo</Button> : undefined} />}
      <div className="table-pagination"><p className="muted" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'grupo encontrado' : 'grupos encontrados'}</p><nav aria-label="Paginación de grupos" className="flex items-center gap-2"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></nav></div>
    </div>
    {modal?.kind === 'view' && <GroupDetails group={modal.group} close={() => setModal(null)} />}
    {(modal?.kind === 'create' || modal?.kind === 'edit') && isAdmin && <GroupEditor group={modal.kind === 'edit' ? modal.group : undefined} close={() => setModal(null)} completed={() => { setModal(null); setNotice('El grupo de siembra se guardó correctamente.') }} />}
  </section>
}

function GroupDetails({ group, close }: { group: SowingGroup; close: () => void }) {
  const { data } = useWorkspace()
  const { current, historical } = membership(data, group)
  const project = data.projects.find(item => item.id === group.project_id)
  return <RecordDialog title={group.name} description="Miembros vigentes e historial de esta selección manual de siembras." open onOpenChange={open => { if (!open) close() }} wide>
    <RecordDetails items={[
      { label: 'Agrícola', value: recordName(data.catalogs.agricultural_units, project?.agricultural_unit_id) },
      { label: 'Proyecto', value: `${project?.name ?? 'Proyecto'} · ${project?.season ?? ''}` },
      { label: 'Campo', value: recordName(data.catalogs.fields, group.field_id) },
      { label: 'Cultivo', value: recordName(data.catalogs.crops, group.crop_id) },
      { label: 'Estado', value: group.active ? 'Activo' : 'Inactivo' },
      { label: 'Superficie vigente', value: `${formatArea(current.reduce((sum, option) => sum + Number(option.stage.area_ha), 0))} ha` },
    ]} />
    <section className="flex flex-col gap-3"><h3 className="section-title">Etapas disponibles para nuevas indicaciones</h3>{current.length ? <ul className="list-disc pl-6">{current.map(option => <li key={option.stage.id}>{groupStageLabel(data, option.stage.id)} · {option.varietyName} · {formatArea(option.stage.area_ha)} ha</li>)}</ul> : <p className="muted">Este grupo no tiene etapas sembradas disponibles.</p>}</section>
    {historical.length > 0 && <section className="flex flex-col gap-3"><h3 className="section-title">Historial de miembros</h3><p className="muted">Estas etapas se conservan para consulta. No se incluirán en una nueva indicación.</p><ul className="list-disc pl-6">{historical.map(id => <li key={id}>{groupStageLabel(data, id)}</li>)}</ul></section>}
    <div className="dialog-actions"><Button variant="outline" onClick={close}>Cerrar</Button></div>
  </RecordDialog>
}

function GroupEditor({ group, close, completed }: { group?: SowingGroup; close: () => void; completed: () => void }) {
  const { data, mutate } = useWorkspace()
  const [groupId] = useState(() => group?.id ?? crypto.randomUUID())
  const [initial] = useState(() => ({ name: group?.name ?? '', project_id: group?.project_id ?? '', field_id: group?.field_id ?? '', crop_id: group?.crop_id ?? '', active: group?.active ?? true }))
  const [form, setForm] = useState(initial)
  const [selected, setSelected] = useState(() => group ? membership(data, group).current.map(option => option.stage.id) : [])
  const [initialSelected] = useState(selected)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextChange, setContextChange] = useState<{ key: 'project_id' | 'field_id' | 'crop_id'; value: string } | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || JSON.stringify(selected) !== JSON.stringify(initialSelected)
  const dismissal = useFormClose(dirty, busy, close)
  const projects = data.projects.filter(project => project.status === 'active' || project.id === group?.project_id)
  const fields = data.catalogs.fields.filter(field => data.lots.some(lot => lot.project_id === form.project_id && lot.field_id === field.id))
  const candidates = eligibleDestinations(data, form.project_id, form.field_id || undefined)
  const cropIds = new Set(candidates.map(option => option.stage.crop_id))
  if (group?.crop_id) cropIds.add(group.crop_id)
  const options = form.field_id && form.crop_id ? eligibleDestinations(data, form.project_id, form.field_id, form.crop_id) : []
  const historical = group ? membership(data, group).historical : []
  const update = (key: keyof typeof form, value: string | boolean) => setForm(current => ({ ...current, [key]: value }))
  const applyContextChange = (key: 'project_id' | 'field_id' | 'crop_id', value: string) => {
    setForm(current => ({ ...current, [key]: value, ...(key === 'project_id' ? { field_id: '', crop_id: '' } : key === 'field_id' ? { crop_id: '' } : {}) }))
    setSelected([])
  }
  const changeContext = (key: 'project_id' | 'field_id' | 'crop_id', value: string) => {
    if (value === form[key]) return
    if (selected.length) setContextChange({ key, value })
    else applyContextChange(key, value)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (!form.name.trim()) { setError('Captura el nombre del grupo.'); return }
    if (!form.project_id || !form.field_id || !form.crop_id) { setError('Selecciona proyecto, campo y cultivo.'); return }
    const currentIds = options.filter(option => selected.includes(option.stage.id)).map(option => option.stage.id)
    if (form.active && !currentIds.length) { setError('Un grupo activo necesita al menos una etapa sembrada vigente. Selecciona sus miembros o desactiva el grupo.'); return }
    if (selected.length !== currentIds.length) { setError('Algunas etapas dejaron de estar disponibles. Revisa la selección antes de guardar.'); return }
    setBusy(true)
    try {
      await mutate({ type: 'save_sowing_group', record: { ...form, id: groupId, name: form.name.trim(), stage_ids: currentIds } })
      completed()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <>
    <RecordDialog title={group ? `Editar ${group.name}` : 'Nuevo grupo de siembra'} description="Selecciona manualmente etapas sembradas del mismo proyecto, campo y cultivo." open onOpenChange={dismissal.onOpenChange} wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <ErrorAlert message={error} />
        <fieldset disabled={busy} className="min-w-0 flex flex-col gap-6">
          <FieldGroup>
            <FormInput label="Nombre del grupo" value={form.name} onChange={value => update('name', value)} required placeholder="Por ejemplo: Pepino · siembras de octubre" />
            <FieldGroup className="field-grid">
              <FormSelect label="Proyecto de temporada" value={form.project_id} onChange={value => changeContext('project_id', value)} required disabled={!!group} options={projects.map(project => ({ value: project.id, label: `${recordName(data.catalogs.agricultural_units, project.agricultural_unit_id)} · ${project.name} (${project.season})` }))} />
              <FormSelect label="Campo" value={form.field_id} onChange={value => changeContext('field_id', value)} required disabled={!!group || !form.project_id} options={fields.map(field => ({ value: field.id, label: field.name }))} />
              <FormSelect label="Cultivo" value={form.crop_id} onChange={value => changeContext('crop_id', value)} required disabled={!!group || !form.field_id} options={data.catalogs.crops.filter(crop => cropIds.has(crop.id)).map(crop => ({ value: crop.id, label: crop.name }))} />
            </FieldGroup>
            {group && <p className="muted">El proyecto, campo y cultivo conservan la identidad del grupo. Para usar otra combinación, crea un grupo nuevo.</p>}
            {form.field_id && form.crop_id && <StageDestinationPicker title="Miembros vigentes del grupo" options={options} selected={selected} onChange={setSelected} />}
            {!projects.length && <Alert><AlertTitle>Se necesita un proyecto activo</AlertTitle><AlertDescription>Activa el proyecto y registra la siembra real de las etapas antes de agruparlas. <Link to="/proyectos">Consultar proyectos</Link></AlertDescription></Alert>}
            {historical.length > 0 && <Alert><AlertTitle>El historial se conserva</AlertTitle><AlertDescription>{historical.length} etapas anteriores permanecen en el historial y no se incluirán en nuevas órdenes. Los miembros que retires también conservarán su referencia histórica.</AlertDescription></Alert>}
            <Field orientation="horizontal"><Checkbox id={`group-active-${groupId}`} checked={form.active} onCheckedChange={value => update('active', value === true)} /><div><FieldLabel htmlFor={`group-active-${groupId}`}>Grupo activo</FieldLabel><FieldDescription>Los grupos activos con miembros vigentes pueden reutilizarse al indicar aplicaciones.</FieldDescription></div></Field>
          </FieldGroup>
        </fieldset>
        <div className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={dismissal.requestClose}>Volver</Button><SaveButton busy={busy}>Guardar grupo</SaveButton></div>
      </form>
    </RecordDialog>
    {dismissal.confirmation}
    <AlertDialog open={!!contextChange} onOpenChange={open => { if (!open) setContextChange(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Cambiar los miembros del grupo?</AlertDialogTitle><AlertDialogDescription>Al cambiar proyecto, campo o cultivo se quitará la selección de etapas. El nombre del grupo se conservará.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar miembros</AlertDialogCancel><AlertDialogAction onClick={() => { if (contextChange) applyContextChange(contextChange.key, contextChange.value); setContextChange(null) }}>Cambiar selección</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
