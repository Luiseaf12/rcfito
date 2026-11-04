import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Copy, GitBranch, Layers3, Leaf, Pencil, Plus, Sprout, Trash2, X } from 'lucide-react'
import { LotCorrectionEditor, LotCorrectionHistory } from './lot-correction-editor'
import { lotCorrectionContext } from '@/domain/lot-corrections'
import { stageApplicationCounts } from '@/domain/applications'
import { useWorkspace } from '@/data/workspace-context'
import type { LotSubdivision, ProjectLot, SowingProject, SowingStage, WorkspaceCommand } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EmptyState, ErrorAlert, errorMessage, FormInput, FormSelect, formatArea, formatDate, LoadingState, normalizeSearch, recordName, RecordDialog, SaveButton, SearchField, StatusBadge, today, useFormClose } from './shared'

export function ProjectsPage() {
  const { data, isAdmin, loading } = useWorkspace()
  const [query, setQuery] = useState('')
  const [agriculturalUnit, setAgriculturalUnit] = useState('all')
  const [status, setStatus] = useState('all')
  const [editor, setEditor] = useState<SowingProject | 'new' | null>(null)
  const filtered = useMemo(() => data.projects.filter(project => (agriculturalUnit === 'all' || project.agricultural_unit_id === agriculturalUnit) && (status === 'all' || project.status === status) && normalizeSearch(`${project.name} ${project.season} ${recordName(data.catalogs.agricultural_units, project.agricultural_unit_id)}`).includes(normalizeSearch(query))).sort((a, b) => b.season.localeCompare(a.season, 'es', { numeric: true }) || a.name.localeCompare(b.name, 'es')), [data.projects, data.catalogs.agricultural_units, query, agriculturalUnit, status])
  if (loading) return <LoadingState />
  return <section className="workspace-page">
    <header className="page-header"><div><p className="eyebrow">Cada temporada, una nueva historia</p><h1 className="page-title">Proyectos de siembra</h1><p className="muted">Planea la distribución del campo y acompaña cada etapa de cultivo.</p></div>{isAdmin && <Button onClick={() => setEditor('new')}><Plus data-icon="inline-start" />Nuevo proyecto</Button>}</header>
    <div className="stat-grid"><article className="metric-card"><span>Temporadas activas</span><strong>{data.projects.filter(project => project.status === 'active').length}</strong><small>Una por cada agrícola</small></article><article className="metric-card"><span>Etapas sembradas</span><strong>{data.stages.filter(stage => stage.status === 'planted').length}</strong><small>En seguimiento</small></article><article className="metric-card"><span>Etapas planeadas</span><strong>{data.stages.filter(stage => stage.status === 'planned').length}</strong><small>Próximas siembras</small></article></div>
    <div className="surface projects-toolbar"><div className="toolbar"><SearchField value={query} onChange={setQuery} placeholder="Buscar proyecto, temporada o agrícola…" /><div className="toolbar-filter"><FormSelect label="Agrícola" value={agriculturalUnit} onChange={setAgriculturalUnit} options={[{ value: 'all', label: 'Todas las agrícolas' }, ...data.catalogs.agricultural_units.map(unit => ({ value: unit.id, label: unit.name }))]} /></div><div className="toolbar-filter"><FormSelect label="Estado" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Todos los estados' }, { value: 'active', label: 'Activas' }, { value: 'draft', label: 'En preparación' }, { value: 'closed', label: 'Cerradas' }]} /></div></div></div>
    {filtered.length ? <div className="projects-grid">{filtered.map(project => {
      const lots = data.lots.filter(lot => lot.project_id === project.id)
      const subdivisions = data.subdivisions.filter(item => lots.some(lot => lot.id === item.lot_id))
      const stages = data.stages.filter(stage => subdivisions.some(item => item.id === stage.subdivision_id))
      return <Card key={project.id} className="project-card"><CardHeader><div className="project-card-heading"><span className="project-season"><CalendarDays aria-hidden="true" />{project.season}</span><StatusBadge status={project.status} /></div><CardTitle>{project.name}</CardTitle><CardDescription>{recordName(data.catalogs.agricultural_units, project.agricultural_unit_id)}</CardDescription></CardHeader><CardContent><div className="project-card-metrics"><div><strong>{formatArea(lots.reduce((sum, lot) => sum + Number(lot.area_ha), 0))}<small> ha</small></strong><span>Superficie</span></div><div><strong>{lots.length}</strong><span>{lots.length === 1 ? 'Lote' : 'Lotes'}</span></div><div><strong>{stages.filter(stage => stage.status === 'planted').length}</strong><span>Etapas sembradas</span></div></div></CardContent><CardFooter><Button variant="outline" asChild><Link to={`/proyectos/${project.id}`}>Ver proyecto<ArrowRight data-icon="inline-end" /></Link></Button>{isAdmin && project.status === 'draft' && <Button variant="ghost" size="icon" onClick={() => setEditor(project)} aria-label={`Editar ${project.name}`}><Pencil /></Button>}</CardFooter></Card>
    })}</div> : <div className="surface"><EmptyState title={data.projects.length ? 'No encontramos proyectos' : 'Empieza una temporada'} description={data.projects.length ? 'Ajusta la búsqueda o los filtros para encontrar una temporada.' : isAdmin ? 'Crea el proyecto de una agrícola y prepara sus campos, lotes y primeras siembras.' : 'Aquí aparecerán los proyectos de las agrícolas que tienes asignadas.'} action={isAdmin && !data.projects.length ? <Button onClick={() => setEditor('new')}><Plus data-icon="inline-start" />Crear proyecto</Button> : data.projects.length ? <Button variant="outline" onClick={() => { setQuery(''); setAgriculturalUnit('all'); setStatus('all') }}>Limpiar filtros</Button> : undefined} /></div>}
    {editor && <ProjectEditor key={editor === 'new' ? 'new' : editor.id} record={editor === 'new' ? undefined : editor} close={() => setEditor(null)} />}
  </section>
}

type DetailModal = { type: 'project' } | { type: 'lot'; record?: ProjectLot } | { type: 'lot-correction'; record: ProjectLot } | { type: 'subdivisions'; lot: ProjectLot } | { type: 'stage'; subdivision: LotSubdivision; record?: SowingStage } | { type: 'copy' } | { type: 'operation'; title: string; description: string; command: WorkspaceCommand; dateField?: 'actual_sowing_date' | 'closed_at'; dateLabel?: string } | null

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const { data, isAdmin, loading, mutate } = useWorkspace()
  const [modal, setModal] = useState<DetailModal>(null)
  const [query, setQuery] = useState('')
  const [field, setField] = useState('all')
  const project = data.projects.find(item => item.id === projectId)
  if (loading) return <LoadingState />
  if (!project) return <section className="workspace-page"><EmptyState title="Proyecto no disponible" description="El proyecto no existe o no tienes acceso a su agrícola." action={<Button asChild variant="outline"><Link to="/proyectos">Volver a proyectos</Link></Button>} /></section>
  const lots = data.lots.filter(lot => lot.project_id === project.id)
  const activeSubdivisions = data.subdivisions.filter(item => item.active && lots.some(lot => lot.id === item.lot_id))
  const allSubdivisions = data.subdivisions.filter(item => lots.some(lot => lot.id === item.lot_id))
  const stages = data.stages.filter(stage => allSubdivisions.some(item => item.id === stage.subdivision_id))
  const currentStages = stages.filter(stage => activeSubdivisions.some(item => item.id === stage.subdivision_id))
  const filteredLots = lots.filter(lot => (field === 'all' || lot.field_id === field) && normalizeSearch(`${lot.name} ${lot.code ?? ''} ${recordName(data.catalogs.fields, lot.field_id)}`).includes(normalizeSearch(query)))
  const editable = isAdmin && project.status !== 'closed'
  const openStages = stages.filter(stage => stage.status !== 'closed')
  const hasOtherActive = data.projects.some(item => item.id !== project.id && item.agricultural_unit_id === project.agricultural_unit_id && item.status === 'active')
  const totalArea = lots.reduce((sum, lot) => sum + Number(lot.area_ha), 0)
  const plantedArea = currentStages.filter(stage => stage.status === 'planted').reduce((sum, stage) => sum + Number(stage.area_ha), 0)
  const closeModal = () => setModal(null)
  const operation = (title: string, description: string, command: WorkspaceCommand, dateField?: 'actual_sowing_date' | 'closed_at', dateLabel?: string) => setModal({ type: 'operation', title, description, command, dateField, dateLabel })
  return <section className="workspace-page">
    <Button variant="ghost" className="back-link" asChild><Link to="/proyectos"><ArrowLeft data-icon="inline-start" />Proyectos de siembra</Link></Button>
    <header className="page-header"><div><p className="eyebrow">{recordName(data.catalogs.agricultural_units, project.agricultural_unit_id)} · Temporada {project.season}</p><h1 className="page-title">{project.name}</h1><p className="muted">La distribución y las siembras pertenecen a esta temporada.</p></div><div className="section-actions"><StatusBadge status={project.status} />{editable && project.status === 'draft' && <Button onClick={() => operation('Activar temporada', 'Esta será la temporada activa de la agrícola. La siguiente temporada podrá capturarse cuando esta se cierre.', { type: 'activate_project', id: project.id })} disabled={hasOtherActive}><Check data-icon="inline-start" />Activar temporada</Button>}{editable && project.status === 'active' && <Button variant="outline" disabled={openStages.length > 0} title={openStages.length ? 'Cierra las etapas sembradas o retira las planeaciones pendientes antes de cerrar.' : undefined} onClick={() => operation('Cerrar temporada', 'El proyecto y sus siembras se conservarán como histórico de consulta. Después podrás crear una nueva temporada.', { type: 'close_project', id: project.id })}>Cerrar temporada</Button>}{isAdmin && project.status === 'closed' && <Button disabled={hasOtherActive} onClick={() => setModal({ type: 'copy' })}><Copy data-icon="inline-start" />Copiar distribución</Button>}</div></header>
    {project.status === 'closed' && <Alert><Layers3 aria-hidden="true" /><AlertTitle>Histórico de temporada</AlertTitle><AlertDescription>Esta distribución conserva los lotes y las siembras de su temporada. Para trabajar un ciclo nuevo puedes copiar la distribución a otro proyecto.</AlertDescription></Alert>}
    <div className="stat-grid"><article className="metric-card"><span>Superficie del proyecto</span><strong>{formatArea(totalArea)}<small> ha</small></strong><small>{lots.length} {lots.length === 1 ? 'lote registrado' : 'lotes registrados'}</small></article><article className="metric-card"><span>Etapas sembradas</span><strong>{currentStages.filter(stage => stage.status === 'planted').length}</strong><small>{formatArea(plantedArea)} ha con siembra activa</small></article><article className="metric-card"><span>Próximas etapas</span><strong>{currentStages.filter(stage => stage.status === 'planned').length}</strong><small>Planeadas en esta temporada</small></article></div>
    <section className="flex flex-col gap-5" aria-labelledby="lots-heading"><div className="section-header"><div><h2 id="lots-heading">Distribución de lotes</h2><p className="muted">Cada lote comienza con una subdivisión que cubre toda su superficie.</p></div>{editable && <Button onClick={() => setModal({ type: 'lot' })}><Plus data-icon="inline-start" />Agregar lote</Button>}</div>{lots.length > 0 && <div className="surface"><div className="toolbar"><SearchField value={query} onChange={setQuery} placeholder="Buscar lote o campo…" label="Buscar lotes" /><div className="toolbar-filter"><FormSelect label="Campo" value={field} onChange={setField} options={[{ value: 'all', label: 'Todos los campos' }, ...data.catalogs.fields.filter(item => item.agricultural_unit_id === project.agricultural_unit_id).map(item => ({ value: item.id, label: item.name }))]} /></div></div></div>}
    {filteredLots.length ? <div className="lots-stack">{filteredLots.map(lot => <LotCard key={lot.id} lot={lot} editable={editable} projectStatus={project.status} edit={() => setModal(lotCorrectionContext(data, lot.id).stages.length ? { type: 'lot-correction', record: lot } : { type: 'lot', record: lot })} divide={() => setModal({ type: 'subdivisions', lot })} addStage={subdivision => setModal({ type: 'stage', subdivision })} editStage={(subdivision, stage) => setModal({ type: 'stage', subdivision, record: stage })} plantStage={stage => operation('Registrar siembra', 'Captura la fecha en que se sembró realmente. La etapa anterior de esta subdivisión debe estar cerrada.', { type: 'plant_stage', id: stage.id, actual_sowing_date: '' }, 'actual_sowing_date', 'Fecha real de siembra')} closeStage={stage => operation('Cerrar etapa de siembra', 'El cultivo, la superficie y las fechas quedarán conservados para consulta histórica.', { type: 'close_stage', id: stage.id, closed_at: '' }, 'closed_at', 'Fecha de término')} discardStage={stage => operation('Retirar planeación', 'Se retirará esta última etapa planeada. Las siembras realizadas y su numeración histórica permanecerán intactas.', { type: 'discard_stage', id: stage.id })} remove={() => operation('Eliminar lote sin uso', 'Solo se puede eliminar si sus subdivisiones no tienen etapas registradas. Para preservar la historia, los lotes utilizados permanecen en su temporada.', { type: 'delete_lot', id: lot.id })} />)}</div> : <div className="surface"><EmptyState title={lots.length ? 'No encontramos ese lote' : 'Dale forma a esta temporada'} description={lots.length ? 'Prueba con otro nombre o selecciona todos los campos.' : 'Agrega el primer lote con su campo, superficie e infraestructura. Su subdivisión inicial se creará automáticamente.'} action={editable && !lots.length ? <Button onClick={() => setModal({ type: 'lot' })}><Plus data-icon="inline-start" />Agregar primer lote</Button> : undefined} /></div>}</section>
    {modal?.type === 'project' && <ProjectEditor record={project} close={closeModal} />}
    {modal?.type === 'lot' && <LotEditor project={project} record={modal.record} close={closeModal} />}
    {modal?.type === 'subdivisions' && <SubdivisionEditor lot={modal.lot} close={closeModal} />}
    {modal?.type === 'lot-correction' && <LotCorrectionEditor lot={modal.record} close={closeModal} />}
    {modal?.type === 'stage' && <StageEditor subdivision={modal.subdivision} record={modal.record} close={closeModal} />}
    {modal?.type === 'copy' && <CopyProjectEditor project={project} close={closeModal} />}
    {modal?.type === 'operation' && <OperationDialog title={modal.title} description={modal.description} dateLabel={modal.dateLabel} close={closeModal} execute={async date => { const command = modal.dateField ? { ...modal.command, [modal.dateField]: date } as WorkspaceCommand : modal.command; await mutate(command) }} />}
  </section>
}

type LotCardProps = { lot: ProjectLot; editable: boolean; projectStatus: SowingProject['status']; edit: () => void; divide: () => void; addStage: (subdivision: LotSubdivision) => void; editStage: (subdivision: LotSubdivision, stage: SowingStage) => void; plantStage: (stage: SowingStage) => void; closeStage: (stage: SowingStage) => void; discardStage: (stage: SowingStage) => void; remove: () => void }
function LotCard({ lot, editable, projectStatus, edit, divide, addStage, editStage, plantStage, closeStage, discardStage, remove }: LotCardProps) {
  const { data } = useWorkspace()
  const subdivisions = data.subdivisions.filter(item => item.lot_id === lot.id && item.active)
  const historical = data.subdivisions.filter(item => item.lot_id === lot.id && !item.active)
  const stagesForLot = data.stages.filter(stage => data.subdivisions.some(item => item.id === stage.subdivision_id && item.lot_id === lot.id))
  const plantedArea = stagesForLot.filter(stage => stage.status === 'planted').reduce((sum, stage) => sum + Number(stage.area_ha), 0)
  const freeArea = Math.max(0, Number(lot.area_ha) - plantedArea)
  const fieldName = lot.field_name_snapshot || recordName(data.catalogs.fields, lot.field_id)
  const infrastructureName = lot.infrastructure_name_snapshot || recordName(data.catalogs.infrastructure_types, lot.infrastructure_type_id)
  return <Card className="lot-card"><CardHeader><div className="lot-heading"><div className="lot-identity"><span className="lot-icon"><Layers3 aria-hidden="true" /></span><div><CardTitle>{lot.name}</CardTitle><CardDescription>{fieldName} · {infrastructureName}</CardDescription></div></div><div className="lot-actions"><span className="area-label">{formatArea(lot.area_ha)} ha</span>{editable && <Button variant="outline" onClick={edit} disabled={lot.active === false} aria-label={`Editar ${lot.name}`}><Pencil data-icon="inline-start" />Editar</Button>}</div></div></CardHeader><CardContent className="flex flex-col gap-5">{projectStatus !== 'closed' && freeArea > 0.0001 && <div className="area-notice"><Leaf aria-hidden="true" /><span><strong>{formatArea(freeArea)} ha sin siembra activa.</strong> Esta superficie queda identificada en el proyecto.</span></div>}{subdivisions.map(subdivision => <SubdivisionSection key={subdivision.id} subdivision={subdivision} compact={subdivisions.length === 1} editable={editable} canPlant={projectStatus === 'active'} add={() => addStage(subdivision)} editStage={stage => editStage(subdivision, stage)} plantStage={plantStage} closeStage={closeStage} discardStage={discardStage} />)}{historical.length > 0 && <Collapsible><CollapsibleTrigger asChild><Button variant="ghost"><Layers3 data-icon="inline-start" />Distribuciones anteriores ({historical.length})<ChevronDown data-icon="inline-end" /></Button></CollapsibleTrigger><CollapsibleContent className="flex flex-col gap-5 pt-4">{historical.map(subdivision => <SubdivisionSection key={subdivision.id} subdivision={subdivision} compact={false} editable={false} canPlant={false} add={() => undefined} editStage={() => undefined} plantStage={() => undefined} closeStage={() => undefined} discardStage={() => undefined} />)}</CollapsibleContent></Collapsible>}<LotCorrectionHistory lotId={lot.id} /></CardContent>{editable && <CardFooter className="lot-footer">{stagesForLot.length > 0 && <p className="muted">La superficie y los datos del lote conservan su historial de siembra.</p>}<Button variant="ghost" onClick={divide} disabled={stagesForLot.some(stage => stage.status !== 'closed')} title={stagesForLot.some(stage => stage.status !== 'closed') ? 'Finaliza las etapas o retira su planeación antes de cambiar la distribución.' : undefined}><GitBranch data-icon="inline-start" />Configurar subdivisiones</Button>{stagesForLot.length === 0 && <Button variant="ghost" onClick={remove}><Trash2 data-icon="inline-start" />Eliminar lote</Button>}</CardFooter>}</Card>
}

function SubdivisionSection({ subdivision, compact, editable, canPlant, add, editStage, plantStage, closeStage, discardStage }: { subdivision: LotSubdivision; compact: boolean; editable: boolean; canPlant: boolean; add: () => void; editStage: (stage: SowingStage) => void; plantStage: (stage: SowingStage) => void; closeStage: (stage: SowingStage) => void; discardStage: (stage: SowingStage) => void }) {
  const { data } = useWorkspace()
  const stages = data.stages.filter(stage => stage.subdivision_id === subdivision.id).sort((a, b) => a.stage_number - b.stage_number)
  const planted = stages.some(stage => stage.status === 'planted')
  const lastNumber = stages.at(-1)?.stage_number
  return <section className="subdivision-section"><div className="section-header"><div><h3>{compact ? 'Etapas de siembra' : subdivision.name}</h3><p className="muted">{formatArea(subdivision.area_ha)} ha{compact ? ' · Subdivisión única del lote' : !subdivision.active ? ' · Distribución histórica' : ' · Subdivisión del lote'}</p></div>{editable && <Button variant="outline" onClick={add}><Plus data-icon="inline-start" />Planear etapa</Button>}</div>{stages.length ? <div className="stage-list">{stages.map(stage => <article key={stage.id} className="stage-card" data-state={stage.status}><div className="stage-marker"><Sprout aria-hidden="true" /><span>{stage.stage_number}</span></div><div className="stage-body"><div className="stage-title"><div><p className="eyebrow">Etapa {stage.stage_number}</p><h4>{stage.crop_name_snapshot || recordName(data.catalogs.crops, stage.crop_id)} <span className="muted">/ {stage.variety_name_snapshot || recordName(data.catalogs.varieties, stage.variety_id)}</span></h4></div><StatusBadge status={stage.status} /></div><dl className="stage-dates"><div><dt>Superficie</dt><dd>{formatArea(stage.area_ha)} ha</dd></div><div><dt>Siembra planeada</dt><dd>{formatDate(stage.planned_sowing_date)}</dd></div><div><dt>Siembra real</dt><dd>{formatDate(stage.actual_sowing_date)}</dd></div>{stage.closed_at && <div><dt>Término</dt><dd>{formatDate(stage.closed_at)}</dd></div>}</dl>{stage.status !== 'planned' && <StageApplicationSummary stageId={stage.id}/>} {editable && stage.status !== 'closed' && <div className="stage-actions">{stage.status === 'planned' ? <><Button variant="outline" onClick={() => editStage(stage)} aria-label={`Editar planeación de etapa ${stage.stage_number}`}><Pencil data-icon="inline-start" />Editar planeación</Button><Button onClick={() => plantStage(stage)} disabled={!canPlant || planted || stages.some(item => item.stage_number < stage.stage_number && item.status !== 'closed')} title={!canPlant ? 'Activa la temporada para registrar siembras.' : planted ? 'Primero cierra la etapa que está sembrada.' : undefined}><Check data-icon="inline-start" />Registrar siembra</Button>{stage.stage_number === lastNumber && <Button variant="ghost" onClick={() => discardStage(stage)}><X data-icon="inline-start" />Retirar planeación</Button>}</> : <Button variant="outline" onClick={() => closeStage(stage)}>Cerrar etapa</Button>}</div>}</div></article>)}</div> : <div className="stage-placeholder"><Sprout aria-hidden="true" /><div><strong>La primera etapa está por comenzar</strong><p className="muted">Define el cultivo, su variedad y la fecha planeada de siembra.</p></div></div>}</section>
}

function ProjectEditor({ record, close }: { record?: SowingProject; close: () => void }) {
  const { data, mutate, isAdmin } = useWorkspace()
  const initial = { name: record?.name ?? '', season: record?.season ?? '', agricultural_unit_id: record?.agricultural_unit_id ?? '', start_date: record?.start_date ?? today() }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { requestClose, onOpenChange, confirmation } = useFormClose(JSON.stringify(form) !== JSON.stringify(initial), busy, close)
  const update = (key: keyof typeof form, value: string) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  const hasActive = data.projects.some(project => project.id !== record?.id && project.agricultural_unit_id === form.agricultural_unit_id && project.status === 'active')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!isAdmin || busy) return
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Escribe un nombre para el proyecto.'
    if (!form.season.trim()) next.season = 'Identifica la temporada.'
    if (!form.start_date) next.start_date = 'Captura la fecha de inicio de la temporada.'
    if (!form.agricultural_unit_id) next.agricultural_unit_id = 'Selecciona una agrícola.'
    if (hasActive) next.agricultural_unit_id = 'Esta agrícola tiene una temporada activa. Ciérrala antes de capturar la siguiente.'
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'save_project', record: { ...(record ? { id: record.id } : {}), ...form, name: form.name.trim(), season: form.season.trim() } }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={record ? 'Editar proyecto' : 'Nuevo proyecto de siembra'} description="Una temporada pertenece a una sola agrícola. Su distribución se conserva como parte del historial." onOpenChange={onOpenChange}><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><FormSelect label="Agrícola" value={form.agricultural_unit_id} onChange={value => update('agricultural_unit_id', value)} options={data.catalogs.agricultural_units.filter(item => item.active || item.id === record?.agricultural_unit_id).map(item => ({ value: item.id, label: `${item.name}${!item.active ? ' (inactiva)' : ''}` }))} error={errors.agricultural_unit_id} disabled={!!record} required /><FormInput label="Nombre del proyecto" value={form.name} onChange={value => update('name', value)} error={errors.name} placeholder="Ej. Siembra de otoño" required /><FormInput label="Temporada" value={form.season} onChange={value => update('season', value)} error={errors.season} placeholder="Ej. Otoño 2026" required help="Usa una referencia que distinga este ciclo de los anteriores." /><FormInput label="Fecha de inicio de temporada" value={form.start_date} onChange={value => update('start_date', value)} type="date" error={errors.start_date} required /></FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>{record ? 'Guardar cambios' : 'Crear proyecto'}</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function LotEditor({ project, record, close }: { project: SowingProject; record?: ProjectLot; close: () => void }) {
  const { data, mutate } = useWorkspace()
  const initial = { name: record?.name ?? '', code: record?.code ?? '', field_id: record?.field_id ?? '', area_ha: record ? String(record.area_ha) : '', infrastructure_type_id: record?.infrastructure_type_id ?? '' }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { requestClose, onOpenChange, confirmation } = useFormClose(JSON.stringify(form) !== JSON.stringify(initial), busy, close)
  const update = (key: keyof typeof form, value: string) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  const fields = data.catalogs.fields.filter(item => item.agricultural_unit_id === project.agricultural_unit_id && (item.active || item.id === record?.field_id))
  const infrastructures = data.catalogs.infrastructure_types.filter(item => item.active || item.id === record?.infrastructure_type_id)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Escribe el nombre del lote.'
    if (!form.field_id) next.field_id = 'Selecciona un campo de esta agrícola.'
    if (!form.infrastructure_type_id) next.infrastructure_type_id = 'Selecciona la infraestructura del lote.'
    if (!form.area_ha.trim() || !Number.isFinite(Number(form.area_ha)) || Number(form.area_ha) <= 0) next.area_ha = 'La superficie debe ser mayor que cero.'
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'save_lot', record: { ...(record ? { id: record.id } : {}), project_id: project.id, ...form, name: form.name.trim(), area_ha: Number(form.area_ha) } }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={record ? 'Editar lote de temporada' : 'Agregar lote'} description="Este lote pertenece a la distribución de esta temporada. Al crearlo se genera una subdivisión de su superficie completa." onOpenChange={onOpenChange} wide><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><div className="field-grid"><FormInput label="Nombre del lote" value={form.name} onChange={value => update('name', value)} error={errors.name} required placeholder="Ej. Lote Norte" /><FormInput label="Clave (opcional)" value={form.code} onChange={value => update('code', value)} /><FormSelect label="Campo" value={form.field_id} onChange={value => update('field_id', value)} options={fields.map(item => ({ value: item.id, label: item.name }))} error={errors.field_id} required /><FormInput label="Superficie (ha)" value={form.area_ha} onChange={value => update('area_ha', value)} type="number" min="0.0001" step="any" error={errors.area_ha} required /><FormSelect label="Infraestructura del lote" value={form.infrastructure_type_id} onChange={value => update('infrastructure_type_id', value)} options={infrastructures.map(item => ({ value: item.id, label: item.name }))} error={errors.infrastructure_type_id} required /></div>{!fields.length && <Alert><AlertTitle>Esta agrícola todavía no tiene campos</AlertTitle><AlertDescription>Agrega un campo en <Link to="/catalogos/fields" onClick={requestClose}>Catálogos → Campos</Link> para incorporarlo al proyecto.</AlertDescription></Alert>}</FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>{record ? 'Guardar cambios' : 'Crear lote y subdivisión'}</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function SubdivisionEditor({ lot, close }: { lot: ProjectLot; close: () => void }) {
  const { data, mutate } = useWorkspace()
  const existing = data.subdivisions.filter(item => item.lot_id === lot.id && item.active)
  const initial = existing.map(item => ({ name: item.name, area_ha: String(item.area_ha) }))
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { requestClose, onOpenChange, confirmation } = useFormClose(JSON.stringify(rows) !== JSON.stringify(initial), busy, close)
  const total = rows.reduce((sum, row) => sum + (Number(row.area_ha) || 0), 0)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    if (!rows.length || rows.some(row => !row.name.trim() || !row.area_ha.trim() || !Number.isFinite(Number(row.area_ha)) || Number(row.area_ha) <= 0)) { setError('Cada subdivisión necesita nombre y superficie mayor que cero.'); return }
    if (total > Number(lot.area_ha) + 0.00001) { setError('La suma de subdivisiones no puede superar la superficie del lote.'); return }
    if (new Set(rows.map(row => normalizeSearch(row.name))).size !== rows.length) { setError('Usa un nombre diferente para cada subdivisión.'); return }
    setBusy(true); setError(null)
    try { await mutate({ type: 'replace_subdivisions', lot_id: lot.id, subdivisions: rows.map(row => ({ name: row.name.trim(), area_ha: Number(row.area_ha) })) }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={`Subdivisiones de ${lot.name}`} description="La subdivisión única es el caso habitual. Cambia esta distribución solo cuando sea necesario; las distribuciones usadas se conservan en el historial." onOpenChange={onOpenChange} wide><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup>{rows.map((row, index) => <div className="subdivision-form-row" key={index}><FormInput label={`Nombre de subdivisión ${index + 1}`} value={row.name} onChange={value => setRows(current => current.map((item, position) => position === index ? { ...item, name: value } : item))} required /><FormInput label="Superficie (ha)" value={row.area_ha} onChange={value => setRows(current => current.map((item, position) => position === index ? { ...item, area_ha: value } : item))} type="number" min="0.0001" max={lot.area_ha} step="any" required /><Button type="button" variant="outline" size="icon" disabled={rows.length === 1} aria-label={`Quitar subdivisión ${index + 1}`} onClick={() => setRows(current => current.filter((_, position) => position !== index))}><X /></Button></div>)}<Button type="button" variant="outline" onClick={() => setRows(current => [...current, { name: '', area_ha: '' }])}><Plus data-icon="inline-start" />Agregar subdivisión</Button><p className="muted">Superficie distribuida: <strong>{formatArea(total)} / {formatArea(lot.area_ha)} ha</strong>.{total < Number(lot.area_ha) && ` Quedarán ${formatArea(Number(lot.area_ha) - total)} ha sin distribuir.`}</p></FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>Guardar distribución</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function StageEditor({ subdivision, record, close }: { subdivision: LotSubdivision; record?: SowingStage; close: () => void }) {
  const { data, mutate } = useWorkspace()
  const [newStageId] = useState(() => crypto.randomUUID())
  const initial = { crop_id: record?.crop_id ?? '', variety_id: record?.variety_id ?? '', area_ha: String(record?.area_ha ?? subdivision.area_ha), planned_sowing_date: record?.planned_sowing_date ?? '' }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { requestClose, onOpenChange, confirmation } = useFormClose(JSON.stringify(form) !== JSON.stringify(initial), busy, close)
  const update = (key: keyof typeof form, value: string) => { setForm(current => ({ ...current, [key]: value, ...(key === 'crop_id' ? { variety_id: '' } : {}) })); setErrors(current => ({ ...current, [key]: '' })) }
  const crops = data.catalogs.crops.filter(item => item.active || item.id === record?.crop_id)
  const varieties = data.catalogs.varieties.filter(item => item.crop_id === form.crop_id && (item.active || item.id === record?.variety_id))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const next: Record<string, string> = {}
    if (!form.crop_id) next.crop_id = 'Selecciona el cultivo de esta siembra.'
    if (!form.variety_id) next.variety_id = 'Selecciona una variedad del cultivo.'
    if (!form.planned_sowing_date) next.planned_sowing_date = 'Captura la fecha planeada de siembra.'
    if (!form.area_ha.trim() || !Number.isFinite(Number(form.area_ha)) || Number(form.area_ha) <= 0 || Number(form.area_ha) > Number(subdivision.area_ha)) next.area_ha = `La superficie debe ser mayor que cero y no exceder ${formatArea(subdivision.area_ha)} ha.`
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'save_stage', record: { id: record?.id ?? newStageId, subdivision_id: subdivision.id, ...form, area_ha: Number(form.area_ha) } }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={record ? `Editar planeación de etapa ${record.stage_number}` : 'Planear etapa de siembra'} description="Puedes preparar la siguiente etapa mientras la actual sigue activa. La fecha real se registrará cuando se realice la siembra." onOpenChange={onOpenChange} wide><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><div className="field-grid"><FormSelect label="Cultivo" value={form.crop_id} onChange={value => update('crop_id', value)} options={crops.map(item => ({ value: item.id, label: `${item.name}${!item.active ? ' (inactivo)' : ''}` }))} error={errors.crop_id} required /><FormSelect label="Variedad" value={form.variety_id} onChange={value => update('variety_id', value)} options={varieties.map(item => ({ value: item.id, label: `${item.name}${!item.active ? ' (inactiva)' : ''}` }))} disabled={!form.crop_id} error={errors.variety_id} required /><FormInput label="Superficie a sembrar (ha)" type="number" min="0.0001" max={subdivision.area_ha} step="any" value={form.area_ha} onChange={value => update('area_ha', value)} error={errors.area_ha} required /><FormInput label="Fecha planeada de siembra" type="date" value={form.planned_sowing_date} onChange={value => update('planned_sowing_date', value)} error={errors.planned_sowing_date} required /></div>{Number(form.area_ha) > 0 && Number(form.area_ha) < Number(subdivision.area_ha) && <Alert><Leaf aria-hidden="true" /><AlertTitle>Superficie sin sembrar</AlertTitle><AlertDescription>Esta planeación deja {formatArea(Number(subdivision.area_ha) - Number(form.area_ha))} ha de la subdivisión sin sembrar. La diferencia quedará visible.</AlertDescription></Alert>}</FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>{record ? 'Guardar planeación' : 'Crear etapa planeada'}</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function CopyProjectEditor({ project, close }: { project: SowingProject; close: () => void }) {
  const { mutate } = useWorkspace()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [season, setSeason] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { requestClose, onOpenChange, confirmation } = useFormClose(!!name || !!season, busy, close)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Escribe el nombre del nuevo proyecto.'
    if (!season.trim()) next.season = 'Identifica la nueva temporada.'
    if (!startDate) next.start_date = 'Captura la fecha de inicio de la nueva temporada.'
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'copy_project', id: project.id, name: name.trim(), season: season.trim(), start_date: startDate }); close(); navigate('/proyectos') } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title="Copiar distribución a otra temporada" description={`Usa los lotes y subdivisiones de ${project.name} como punto de partida. Las etapas y sus conteos comenzarán de nuevo.`} onOpenChange={onOpenChange}><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><FormInput label="Nombre del nuevo proyecto" value={name} onChange={setName} error={errors.name} required /><FormInput label="Nueva temporada" value={season} onChange={setSeason} error={errors.season} placeholder="Ej. Primavera 2027" required /><FormInput label="Fecha de inicio de la nueva temporada" value={startDate} onChange={setStartDate} type="date" error={errors.start_date} required /></FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>Crear copia independiente</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function OperationDialog({ title, description, dateLabel, execute, close }: { title: string; description: string; dateLabel?: string; execute: (date: string) => Promise<void>; close: () => void }) {
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    if (dateLabel && !date) { setError('Selecciona la fecha para continuar.'); return }
    setBusy(true); setError(null)
    try { await execute(date); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <RecordDialog open title={title} description={description} onOpenChange={open => { if (!open && !busy) close() }}><form onSubmit={event => { void submit(event) }} className="record-form">{dateLabel && <FieldGroup><FormInput label={dateLabel} type="date" value={date} onChange={setDate} required /></FieldGroup>}<ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button><SaveButton busy={busy}>Confirmar</SaveButton></div></form></RecordDialog>
}

function StageApplicationSummary({stageId}:{stageId:string}) {
  const {data}=useWorkspace()
  const counts=stageApplicationCounts(data,stageId)
  return <div className="stage-application-summary" aria-label="Conteo de aplicaciones de esta etapa"><span className="muted text-sm">Aplicaciones</span><Badge variant="secondary">{counts.indicated} indicadas</Badge><Badge variant="outline">{counts.performed} realizadas</Badge><Badge variant="outline">{counts.cancelled} canceladas</Badge><Link to="/aplicaciones" className="text-link">Consultar aplicaciones</Link></div>
}
