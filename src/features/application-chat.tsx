import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, ArrowUp, ChevronDown, ClipboardList, FileAudio, LoaderCircle, MessageCircle, Mic, Paperclip, Square, Trash2, X } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { APPLICATION_AUDIO_MAX_BYTES, APPLICATION_AUDIO_MAX_SECONDS, applicationQueryFilterSourceLabel, buildQueryFromChoice, formatApplicationProductTotal, validateApplicationAudio, type ApplicationChatResponse, type ApplicationQueryChoice, type ApplicationQueryFilters, type ApplicationQueryOptions } from '@/data/application-chat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller'
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { errorMessage } from './shared'
import { reportNumber } from '@/lib/report-format'
import './application-chat.css'

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; response?: ApplicationChatResponse; demo?: boolean; contextKey?: string }
const statusLabels = { indicated: 'Indicadas', performed: 'Realizadas', cancelled: 'Canceladas', all: 'Todos los estados' }
const suggestions = ['¿Qué aplicaciones están pendientes?', '¿Qué productos hemos usado?', 'Muéstrame el historial de aplicaciones']
const number = (value: number, digits = 2) => digits === 0 ? value.toLocaleString('es-MX', { maximumFractionDigits: 0 }) : reportNumber.format(value)
const timestamp = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Fecha no disponible'
const recordText = (value: unknown) => typeof value === 'string' ? value : ''
const recordObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function SnapshotDetails({ snapshot }: { snapshot: Record<string, unknown> }) {
  const fields: { label: string; value: string }[] = []
  for (const [key, label] of [['indicated_date', 'Fecha indicada'], ['scheduled_date', 'Fecha programada'], ['actual_date', 'Fecha real'], ['method_name', 'Medio de aplicación'], ['applicator', 'Aplicador'], ['equipment', 'Equipo'], ['observations', 'Nota']] as const) {
    const value = recordText(snapshot[key])
    if (value) fields.push({ label, value })
  }
  if (typeof snapshot.water_l_ha === 'number' && Number.isFinite(snapshot.water_l_ha)) fields.push({ label: 'Agua por hectárea', value: `${number(snapshot.water_l_ha, 6)} L/ha` })
  const products = Array.isArray(snapshot.products) ? snapshot.products.filter(recordObject).slice(0, 40) : []
  return <div className="flex flex-col gap-3">
    {fields.length > 0 && <dl className="chat-result-fields">{fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
    {products.length > 0 && <div><p className="muted">Productos y dosis registradas</p><ul className="chat-product-lines">{products.map((product, index) => <li key={index}>{recordText(product.product_name) || 'Producto registrado'}{typeof product.dose === 'number' && Number.isFinite(product.dose) ? ` · ${number(product.dose, 6)} ${product.unit === 'g' || product.unit === 'ml' ? product.unit : '(unidad no disponible)'}/ha` : ''}</li>)}</ul></div>}
  </div>
}

function ResponseRows({ response }: { response: ApplicationChatResponse }) {
  const result = response.result
  if (!result || result.rows.length === 0 || !['detalle', 'cambios'].includes(result.query.operation ?? '')) return null
  const changes = result.query.operation === 'cambios'
  return <Collapsible><CollapsibleTrigger asChild><Button variant="outline">Ver detalle de los resultados ({number(result.rows.length, 0)})<ChevronDown data-icon="inline-end" aria-hidden="true" /></Button></CollapsibleTrigger><CollapsibleContent className="chat-result-list">
    {result.rows.map((row, index) => <article className="chat-result" key={index}>
      <p><strong>{recordText(row.folio) || `Resultado ${index + 1}`}</strong>{changes ? ` · ${row.kind === 'performance' ? 'Corrección real' : 'Revisión de indicación'} ${typeof row.version === 'number' ? row.version : ''}` : ` · ${[recordText(row.lot_name), recordText(row.subdivision_name)].filter(Boolean).join(' / ')}`}</p>
      {changes ? <>
        <dl className="chat-result-fields"><div><dt>Fecha del cambio</dt><dd>{recordText(row.changed_at) ? timestamp(recordText(row.changed_at)) : 'Sin registro'}</dd></div><div><dt>Registrado por</dt><dd>{recordText(row.changed_by_name) || 'Sin registro'}</dd></div><div><dt>Motivo</dt><dd>{recordText(row.reason) || 'Sin registro'}</dd></div></dl>
        {recordObject(row.difference) && <div className="chat-change-snapshots">{(['before', 'after'] as const).map(side => recordObject(row.difference) && recordObject(row.difference[side]) ? <div key={side}><p><strong>{side === 'before' ? 'Antes' : 'Después'}</strong></p><SnapshotDetails snapshot={row.difference[side]} /></div> : null)}</div>}
      </> : <>
        <dl className="chat-result-fields"><div><dt>Estado</dt><dd>{statusLabels[row.status as keyof typeof statusLabels] ?? 'Registrada'}</dd></div>{typeof row.application_number === 'number' && <div><dt>Número de aplicación por etapa</dt><dd>{row.application_number}</dd></div>}{typeof row.stage_number === 'number' && <div><dt>Etapa</dt><dd>{row.stage_number}</dd></div>}{typeof row.area_ha === 'number' && Number.isFinite(row.area_ha) && <div><dt>Superficie del destino</dt><dd>{number(row.area_ha, 6)} ha</dd></div>}{row.status === 'performed' && <><div><dt>Aplicador</dt><dd>{recordText(row.applicator) || 'Sin registro'}</dd></div><div><dt>Equipo</dt><dd>{recordText(row.equipment) || 'Sin registro'}</dd></div></>}</dl>
        <SnapshotDetails snapshot={{ ...row, applicator: undefined, equipment: undefined }} />
      </>}
    </article>)}
  </CollapsibleContent></Collapsible>
}

function AppliedQueryFilters({ response }: { response: ApplicationChatResponse }) {
  const result = response.result
  if (!result?.filters?.length && !result?.assumptions?.length) return null
  return <div className="flex min-w-0 flex-col gap-3">
    {Boolean(result.filters?.length) && <Table className="chat-data-table" aria-label="Filtros aplicados a esta respuesta" tabIndex={0}><TableCaption className="caption-top">Filtros aplicados a esta respuesta</TableCaption><TableHeader><TableRow><TableHead scope="col">Filtro</TableHead><TableHead scope="col">Valor</TableHead><TableHead scope="col">Procedencia</TableHead></TableRow></TableHeader><TableBody>{result.filters!.map((filter, index) => <TableRow key={`${filter.key}:${index}`}><TableCell>{filter.label}</TableCell><TableCell>{filter.value}</TableCell><TableCell>{applicationQueryFilterSourceLabel(filter.source)}</TableCell></TableRow>)}</TableBody></Table>}
    {Boolean(result.assumptions?.length) && <ul className="chat-product-lines muted" aria-label="Criterios asumidos de la consulta">{result.assumptions!.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>}
  </div>
}

function ProductUsageTable({ response }: { response: ApplicationChatResponse }) {
  const result = response.result
  if (!result || result.query.operation !== 'uso_producto' || result.clarification) return null
  const heading = result.query.status === 'performed' ? 'Total aplicado' : result.query.status === 'indicated' ? 'Cantidad indicada' : result.query.status === 'cancelled' ? 'Cantidad cancelada' : 'Cantidad calculada'
  const showDestinations = result.rows.some(row => typeof row.destination_count === 'number' && Number.isSafeInteger(row.destination_count) && row.destination_count >= 0)
  return <Table className="chat-data-table" aria-label="Cantidades por producto" tabIndex={0}><TableCaption className="caption-top">Cantidades por producto{result.truncated ? ' · Resultado parcial' : ''}</TableCaption><TableHeader><TableRow><TableHead scope="col">Producto</TableHead><TableHead scope="col" className="text-right">{heading}</TableHead>{showDestinations && <TableHead scope="col" className="text-right">Destinos</TableHead>}</TableRow></TableHeader><TableBody>{result.rows.length === 0 ? <TableRow><TableCell colSpan={showDestinations ? 3 : 2}>No hay cantidades válidas para mostrar con estos filtros.</TableCell></TableRow> : result.rows.map((row, index) => <TableRow key={`${recordText(row.product_id)}:${recordText(row.unit)}:${index}`}><TableCell>{recordText(row.product_name) || recordText(row.name) || 'Producto registrado'}</TableCell><TableCell className="text-right tabular-nums">{formatApplicationProductTotal(row.quantity, row.unit)}</TableCell>{showDestinations && <TableCell className="text-right tabular-nums">{typeof row.destination_count === 'number' && Number.isSafeInteger(row.destination_count) && row.destination_count >= 0 ? number(row.destination_count, 0) : 'No disponible'}</TableCell>}</TableRow>)}</TableBody></Table>
}

function ResponseEvidence({ response, choiceDisabled, onChoose }: { response: ApplicationChatResponse; choiceDisabled: boolean; onChoose: (query: ApplicationQueryFilters, choice: ApplicationQueryChoice, options: ApplicationQueryOptions) => void }) {
  const result = response.result
  if (!result) return null
  const query = response.query ?? result.query
  const sources = [...new Map(result.sources.map(source => [source.order_id, source])).values()]
  const metrics: { label: string; value: string }[] = []
  const add = (key: string, label: string, divisor = 1, unit = '') => {
    const value = result.summary[key]
    if (typeof value === 'number' && Number.isFinite(value)) metrics.push({ label, value: `${number(value / divisor, ['destination_count', 'order_count', 'event_count'].includes(key) ? 0 : 2)}${unit}` })
  }
  add('destination_count', 'Destinos')
  add('order_count', 'Órdenes')
  add('liquid_ml', 'Cantidad líquida', 1000, ' L')
  add('solid_g', 'Cantidad sólida', 1000, ' kg')
  add('event_count', 'Cambios registrados')
  return <div className="chat-evidence flex flex-col gap-3">
    <div className="flex flex-wrap gap-2">
      {query.status && <Badge variant="outline">{statusLabels[query.status]}</Badge>}
      {query.from && <Badge variant="outline">Desde {query.from}</Badge>}
      {query.to && <Badge variant="outline">Hasta {query.to}</Badge>}
      {query.stage_number && <Badge variant="outline">Etapa {query.stage_number}</Badge>}
    </div>
    {Boolean(result.choices?.length) && <div role="group" aria-label="Elegir una coincidencia de la consulta" className="chat-choice-list"><p className="muted">Selecciona la coincidencia que deseas consultar.</p>{result.choices!.map((choice, index) => <Button key={`${choice.kind}:${choice.id}`} type="button" variant="outline" disabled={choiceDisabled} className="chat-choice-button" title={`Identificador completo: ${choice.id}`} onClick={() => onChoose(result.query, choice, response.queryOptions ?? { resolveContext: Boolean(result.filters), completeProducts: query.operation === 'uso_producto' && query.limit === 30 })}><span className="flex min-w-0 flex-col items-start gap-1"><strong>Opción {index + 1}: {choice.name}</strong><span>{[choice.project_name, choice.season, `ID ${choice.id.slice(-8)}`].filter(Boolean).join(' · ')}</span></span></Button>)}</div>}
    <AppliedQueryFilters response={response} />
    <ProductUsageTable response={response} />
    {metrics.length > 0 && <dl className="chat-metrics">{metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>}
    {result.incomplete_count > 0 && <p className="muted">Se omitieron {number(result.incomplete_count, 0)} registros incompletos. No se estimaron sus cantidades.</p>}
    {result.truncated && <p className="muted">{response.queryOptions?.completeProducts ? 'La lista alcanzó el límite de 300 productos. Acota los filtros para consultar los restantes.' : 'Hay más registros. Acota el periodo o pide la siguiente página para revisar el detalle.'}</p>}
    <ResponseRows response={response} />
    {result.sources_truncated && <p className="muted">Muestra de fuentes{result.sources_scope === 'displayed_products' ? ' para los productos de esta página' : ''}: se incluyen {number(result.sources.length, 0)} referencias{result.source_count !== undefined ? ` de ${number(result.source_count, 0)}` : ''}. Los enlaces agrupan las referencias de una misma orden.</p>}
    {sources.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Aplicaciones usadas como fuente">{sources.map(source => <Button asChild variant="outline" key={source.order_id}><Link to={`/aplicaciones/${encodeURIComponent(source.order_id)}`}><ClipboardList data-icon="inline-start" aria-hidden="true" />Ver {source.folio || 'aplicación'}</Link></Button>)}</div>}
    <p className="muted">Consultado el {timestamp(result.as_of)}. {response.cached ? 'Resultado reutilizado tras comprobar su vigencia.' : 'Datos del ámbito autorizado.'}</p>
  </div>
}

export function ApplicationChatPage() {
  const { data, mode, profile, connection, queryApplications, executeApplicationQuery, transcribeApplicationAudio } = useWorkspace()
  const inputId = useId()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const textInput = useRef<HTMLTextAreaElement | null>(null)
  const request = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [agriculturalUnitId, setAgriculturalUnitId] = useState('all')
  const [projectId, setProjectId] = useState('all')
  const [previousQuery, setPreviousQuery] = useState<ApplicationQueryFilters | null>(null)
  const [busy, setBusy] = useState<'query' | 'transcription' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [audio, setAudio] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioTooLong, setAudioTooLong] = useState(false)
  const [recording, setRecording] = useState<'requesting' | 'recording' | null>(null)
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const recordingEpoch = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)
  const authorizationScope = data.catalogs.agricultural_units.map(unit => unit.id).sort().join(',')
  const available = mode === 'supabase' && connection?.managed === true
  const projects = data.projects.filter(project => agriculturalUnitId === 'all' || project.agricultural_unit_id === agriculturalUnitId)
  const context: ApplicationQueryFilters = {
    ...(agriculturalUnitId === 'all' ? {} : { agricultural_unit_id: agriculturalUnitId }),
    ...(projectId === 'all' ? {} : { project_id: projectId }),
  }
  const contextKey = JSON.stringify(context)

  function releaseMicrophone() {
    if (recordingTimer.current) clearInterval(recordingTimer.current)
    recordingTimer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  function cancelRecording() {
    recordingEpoch.current++
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current = null
    releaseMicrophone()
    setRecording(null)
    setRecordedSeconds(0)
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
      recordingEpoch.current++
      if (recorder.current?.state === 'recording') recorder.current.stop()
      releaseMicrophone()
    }
  }, [])
  useEffect(() => {
    request.current?.abort()
    request.current = null
    busyRef.current = false
    cancelRecording()
    setBusy(null)
    setMessages([])
    setPreviousQuery(null)
    setAgriculturalUnitId('all')
    setProjectId('all')
    setMessage('')
    setAudio(null)
    setError(null)
    setNotice('')
  }, [profile.id, profile.role, connection?.url, authorizationScope])
  useEffect(() => {
    setAudioTooLong(false)
    if (!audio) { setAudioUrl(null); return }
    const url = URL.createObjectURL(audio)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [audio])
  useEffect(() => {
    if (!message && !audio && !recording) return
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [message, audio, recording])

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (busyRef.current || recording) return
    setError(null)
    if (!message.trim() || message.length > 4000) { setError('Escribe una pregunta de hasta 4,000 caracteres.'); return }
    if (!available) { setError('El chat requiere una sesión real en la conexión gestionada de esta instalación.'); return }
    await runConversationQuery(message.trim(), signal => queryApplications(message.trim(), context, previousQuery, signal), true)
  }
  async function chooseQuery(query: ApplicationQueryFilters, choice: ApplicationQueryChoice, options: ApplicationQueryOptions) {
    if (busyRef.current || recording) return
    setError(null)
    if (!available) { setError('La consulta requiere una sesión real en la conexión gestionada.'); return }
    try {
      const selected = buildQueryFromChoice(query, choice)
      const label = [choice.name, choice.project_name, choice.season, `ID ${choice.id.slice(-8)}`].filter(Boolean).join(' · ')
      await runConversationQuery(`Seleccioné: ${label}.`, signal => executeApplicationQuery(selected, signal, options), false)
    } catch (cause) { setError(errorMessage(cause)) }
  }
  async function runConversationQuery(question: string, run: (signal: AbortSignal) => Promise<ApplicationChatResponse>, clearComposer: boolean) {
    const questionId = crypto.randomUUID()
    const controller = new AbortController()
    request.current = controller
    busyRef.current = true
    setBusy('query')
    setNotice('')
    setMessages(current => [...current, { id: questionId, role: 'user', text: question }])
    try {
      const response = await run(controller.signal)
      if (!controller.signal.aborted && mounted.current) {
        setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: response.answer, response, contextKey }])
        setPreviousQuery(response.query ?? response.result?.query ?? null)
        if (clearComposer) setMessage('')
        setNotice('Respuesta recibida.')
      }
    } catch (cause) {
      if (mounted.current) {
        setMessages(current => current.filter(item => item.id !== questionId))
        if (!controller.signal.aborted) setError(errorMessage(cause))
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        busyRef.current = false
        if (mounted.current) setBusy(null)
      }
    }
  }
  async function transcribe() {
    if (!audio || busyRef.current || recording || audioTooLong) return
    setError(null)
    if (!available) { setError('La transcripción requiere una sesión real en la conexión gestionada.'); return }
    if (message.trim()) { setError('Envía o borra el texto de la pregunta antes de transcribir, para conservar lo que escribiste.'); return }
    const controller = new AbortController()
    request.current = controller
    busyRef.current = true
    setBusy('transcription')
    setNotice('')
    try {
      const text = await transcribeApplicationAudio(audio, controller.signal)
      if (!controller.signal.aborted && mounted.current) {
        setMessage(text)
        setNotice('Audio transcrito. Revisa el texto y envía tu pregunta cuando esté listo.')
      }
    } catch (cause) { if (!controller.signal.aborted && mounted.current) setError(errorMessage(cause)) }
    finally {
      if (request.current === controller) {
        request.current = null
        busyRef.current = false
        if (mounted.current) {
          setBusy(null)
          requestAnimationFrame(() => textInput.current?.focus())
        }
      }
    }
  }
  function selectAudio(file: File | undefined) {
    if (!file || busyRef.current || recording) return
    setError(null)
    setNotice('')
    try { validateApplicationAudio(file); setAudio(file) }
    catch (cause) { setError(errorMessage(cause)) }
  }
  async function startRecording() {
    if (busyRef.current || recording || recorder.current) return
    setError(null)
    setNotice('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar aquí. Adjunta un archivo de audio o escribe tu pregunta.')
      return
    }
    const epoch = ++recordingEpoch.current
    setRecording('requesting')
    let media: MediaStream | null = null
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (epoch !== recordingEpoch.current || !mounted.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
      const capture = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      recorder.current = capture
      const chunks: Blob[] = []
      let bytes = 0
      capture.ondataavailable = event => {
        if (epoch !== recordingEpoch.current || !event.data.size) return
        bytes += event.data.size
        if (bytes > APPLICATION_AUDIO_MAX_BYTES) { cancelRecording(); setError('La grabación alcanzó 10 MB. Graba una pregunta más corta.'); return }
        chunks.push(event.data)
      }
      capture.onerror = () => {
        if (epoch !== recordingEpoch.current) return
        cancelRecording()
        setError('No se pudo completar la grabación. Revisa el micrófono o adjunta un audio.')
      }
      capture.onstop = () => {
        if (epoch !== recordingEpoch.current || !mounted.current) return
        releaseMicrophone()
        recorder.current = null
        setRecording(null)
        const type = capture.mimeType || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File(chunks, `pregunta.${extension}`, { type })
        try { validateApplicationAudio(file); setAudio(file); setNotice('Grabación lista. Escúchala y después transcribe.'); }
        catch (cause) { setError(errorMessage(cause)) }
      }
      setRecordedSeconds(0)
      setRecording('recording')
      capture.start(1000)
      const startedAt = Date.now()
      recordingTimer.current = setInterval(() => {
        if (epoch !== recordingEpoch.current) return
        const seconds = Math.min(APPLICATION_AUDIO_MAX_SECONDS, Math.floor((Date.now() - startedAt) / 1000))
        setRecordedSeconds(seconds)
        if (seconds >= APPLICATION_AUDIO_MAX_SECONDS && capture.state === 'recording') capture.stop()
      }, 250)
    } catch (cause) {
      media?.getTracks().forEach(track => track.stop())
      if (epoch === recordingEpoch.current && mounted.current) {
        cancelRecording()
        const denied = cause instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(cause.name)
        setError(denied ? 'No se concedió acceso al micrófono. Puedes adjuntar un audio o escribir tu pregunta.' : 'No se pudo abrir el micrófono. Revisa el dispositivo o adjunta un audio.')
      }
    }
  }
  function demoExample() {
    const orders = new Map(data.applicationOrders.filter(order => projectId === 'all' || order.project_id === projectId).map(order => [order.id, order]))
    const allowedProjects = new Set(projects.map(project => project.id))
    const pending = data.applicationTargets.filter(target => {
      const order = orders.get(target.order_id)
      return target.status === 'indicated' && order && allowedProjects.has(order.project_id)
    })
    setMessages(current => [...current,
      { id: crypto.randomUUID(), role: 'user', text: 'Mostrar ejemplo de aplicaciones pendientes.', demo: true },
      { id: crypto.randomUUID(), role: 'assistant', text: `Ejemplo calculado con datos ficticios: hay ${number(pending.length, 0)} destinos indicados pendientes en ${number(new Set(pending.map(target => target.order_id)).size, 0)} órdenes dentro del contexto seleccionado. No se utilizó IA ni se consultó el servidor.`, demo: true },
    ])
  }
  const locked = Boolean(busy || recording)
  return <section className="workspace-page application-chat flex flex-col gap-5">
    <header className="page-header"><div><p className="eyebrow">HISTORIAL A TU ALCANCE</p><h1 className="page-title">Consultas de aplicaciones</h1><p className="muted">Pregunta por pendientes, productos, cantidades y cambios. Escribe o prepara una nota de voz.</p></div><Button variant="outline" disabled={locked || messages.length === 0} onClick={() => { setMessages([]); setPreviousQuery(null); setNotice('Conversación vacía. Tu borrador se conserva.'); }}><Trash2 data-icon="inline-start" aria-hidden="true" />Limpiar conversación</Button></header>
    {mode === 'demo' && <Alert><AlertTitle>Ejemplos de demostración</AlertTitle><AlertDescription>Los ejemplos usan los datos ficticios de este navegador. El chat con IA y la transcripción requieren una sesión real.<Button variant="outline" onClick={demoExample} disabled={locked}>Ver ejemplo ficticio de pendientes</Button></AlertDescription></Alert>}
    {mode === 'supabase' && !available && <Alert><AlertTitle>Revisa la conexión</AlertTitle><AlertDescription>El chat utiliza la configuración de IA de esta instalación y necesita su conexión gestionada. <Link to="/conexion">Abrir Conexión y preferencias</Link>.</AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Contexto de la consulta</CardTitle><CardDescription>La pregunta se limita a las agrícolas que tienes asignadas. Elige un contexto para resolver nombres y seguimientos.</CardDescription></CardHeader>
      <CardContent><FieldGroup className="chat-context-grid"><Field><FieldLabel htmlFor={`${inputId}-unit`}>Agrícola</FieldLabel><Select value={agriculturalUnitId} disabled={locked} onValueChange={value => { setAgriculturalUnitId(value); setProjectId('all'); setPreviousQuery(null); }}><SelectTrigger id={`${inputId}-unit`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todas las disponibles</SelectItem>{data.catalogs.agricultural_units.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor={`${inputId}-project`}>Proyecto / temporada</FieldLabel><Select value={projectId} disabled={locked} onValueChange={value => { setProjectId(value); setPreviousQuery(null); }}><SelectTrigger id={`${inputId}-project`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todos los proyectos disponibles</SelectItem>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name} · {project.season}</SelectItem>)}</SelectGroup></SelectContent></Select></Field></FieldGroup></CardContent>
    </Card>
    <Card className="chat-conversation">
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle aria-hidden="true" />Tu conversación</CardTitle><CardDescription>Las respuestas identifican el periodo, el estado y las aplicaciones usadas como fuente.</CardDescription></CardHeader>
      <CardContent className="chat-thread-content">
        <MessageScrollerProvider autoScroll><MessageScroller><MessageScrollerViewport role="log" aria-label="Conversación sobre aplicaciones" aria-live="polite" aria-relevant="additions" aria-busy={busy === 'query'} tabIndex={0}><MessageScrollerContent>
          {messages.length === 0 && <MessageScrollerItem messageId="empty"><Empty><EmptyHeader><EmptyMedia variant="icon"><MessageCircle aria-hidden="true" /></EmptyMedia><EmptyTitle>Consulta lo que ya está registrado</EmptyTitle><EmptyDescription>Puedes preguntar por una agrícola, temporada, lote, producto o folio. Si hay varias coincidencias, el chat te pedirá precisar.</EmptyDescription></EmptyHeader><div className="flex flex-wrap justify-center gap-2">{suggestions.map(suggestion => <Button key={suggestion} variant="outline" disabled={locked} onClick={() => { setMessage(suggestion); textInput.current?.focus(); }}>{suggestion}</Button>)}</div></Empty></MessageScrollerItem>}
          {messages.map(item => <MessageScrollerItem key={item.id} messageId={item.id} scrollAnchor={item.role === 'user'}><Message align={item.role === 'user' ? 'end' : 'start'}><MessageContent><MessageHeader>{item.role === 'user' ? 'Tú' : 'RCFito'}{item.demo && ' · Ejemplo ficticio'}</MessageHeader><Bubble align={item.role === 'user' ? 'end' : 'start'} variant={item.role === 'user' ? 'default' : 'outline'}><BubbleContent className="whitespace-pre-wrap">{item.text}</BubbleContent></Bubble>{item.response && <ResponseEvidence response={item.response} choiceDisabled={locked || !available || item.id !== messages.at(-1)?.id || item.contextKey !== contextKey} onChoose={(query, choice, options) => void chooseQuery(query, choice, options)} />}<MessageFooter>{item.role === 'assistant' && (item.demo ? 'Cálculo local de demostración' : 'Consulta de registros guardados')}</MessageFooter></MessageContent></Message></MessageScrollerItem>)}
          {busy === 'query' && <MessageScrollerItem messageId="pending"><Message><MessageContent><MessageHeader>RCFito</MessageHeader><Bubble variant="muted"><BubbleContent><span className="shimmer">Consultando los registros autorizados…</span></BubbleContent></Bubble></MessageContent></Message></MessageScrollerItem>}
        </MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton /></MessageScroller></MessageScrollerProvider>
      </CardContent>
      <CardFooter className="chat-composer flex flex-col items-stretch gap-4">
        {error && <Alert variant="destructive"><AlertTitle>No se pudo completar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <p role="status" className="muted" aria-live="polite">{notice || (recording === 'requesting' ? 'Esperando permiso del micrófono…' : recording === 'recording' ? `Grabando · ${Math.floor(recordedSeconds / 60)}:${String(recordedSeconds % 60).padStart(2, '0')} / 2:00` : busy === 'transcription' ? 'Transcribiendo el audio…' : '')}</p>
        {audio && <Attachment state={busy === 'transcription' ? 'processing' : audioTooLong ? 'error' : 'done'} className="w-full"><AttachmentMedia variant="icon"><FileAudio aria-hidden="true" /></AttachmentMedia><AttachmentContent><AttachmentTitle>{audio.name}</AttachmentTitle><AttachmentDescription>{number(audio.size / 1024 / 1024)} MB · Audio listo para revisar</AttachmentDescription></AttachmentContent><AttachmentActions><Button variant="ghost" size="icon" aria-label="Descartar audio" disabled={locked} onClick={() => { setAudio(null); setError(null); }}><X aria-hidden="true" /></Button></AttachmentActions>{audioUrl && <audio controls preload="metadata" src={audioUrl} className="w-full min-w-0" aria-label="Escuchar audio seleccionado" onLoadedMetadata={event => { const tooLong = Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > APPLICATION_AUDIO_MAX_SECONDS + 0.5; setAudioTooLong(tooLong); if (tooLong) setError('El audio supera los dos minutos. Selecciona una pregunta más corta.'); }} />}<Button variant="outline" disabled={locked || !available || audioTooLong || Boolean(message.trim())} onClick={() => void transcribe()}><AudioLines data-icon="inline-start" aria-hidden="true" />Transcribir audio</Button></Attachment>}
        <form onSubmit={event => void send(event)} className="flex flex-col gap-3"><FieldGroup><Field><FieldLabel htmlFor={inputId}>Tu pregunta</FieldLabel><Textarea ref={textInput} id={inputId} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }} rows={3} maxLength={4000} disabled={locked} placeholder="Ejemplo: ¿Qué productos usamos en este lote durante octubre?" aria-describedby={`${inputId}-help`} /><FieldDescription id={`${inputId}-help`}>{number(message.length, 0)} / 4,000 caracteres. Revisa la transcripción antes de enviar. Ctrl + Enter envía.</FieldDescription></Field></FieldGroup><div className="chat-composer-actions flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/webm,.mp3,.mp4,.m4a,.wav,.webm" className="sr-only" aria-label="Elegir archivo de audio" tabIndex={-1} disabled={locked} onChange={event => { selectAudio(event.target.files?.[0]); event.target.value = ''; }} />
          {!recording ? <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void startRecording()}><Mic data-icon="inline-start" aria-hidden="true" />Grabar</Button> : <><Button type="button" variant="destructive" disabled={recording === 'requesting'} onClick={() => { if (recorder.current?.state === 'recording') recorder.current.stop(); }}><Square data-icon="inline-start" aria-hidden="true" />Detener</Button><Button type="button" variant="outline" onClick={cancelRecording}>Cancelar grabación</Button></>}
          <Button type="button" variant="outline" disabled={locked} onClick={() => fileInput.current?.click()}><Paperclip data-icon="inline-start" aria-hidden="true" />Adjuntar audio</Button>
          {busy ? <Button type="button" variant="outline" onClick={() => { request.current?.abort(); setNotice('Solicitud cancelada. Tu borrador se conserva.'); }}>Cancelar solicitud</Button> : <Button type="submit" className="chat-send" disabled={locked || !available || !message.trim()}><ArrowUp data-icon="inline-start" aria-hidden="true" />Preguntar</Button>}
          {busy && <LoaderCircle className="animate-spin" aria-label="Solicitud en curso" />}
        </div></form>
        <p className="muted">Audios de hasta 2 minutos y 10 MB. El chat consulta información guardada; las cantidades indicadas o canceladas se identifican por separado.</p>
      </CardFooter>
    </Card>
  </section>
}
