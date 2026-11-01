import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FilePenLine, LoaderCircle, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { validateExtractedApplication, type ExtractedApplication } from '@/domain/application-import'
import { nextStageApplicationNumber } from '@/domain/applications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState, ErrorAlert, errorMessage } from './shared'
import { NewApplicationDialog } from './applications'

export function ApplicationAiPage() {
  const { isAdmin, mode, data, interpretApplication } = useWorkspace()
  const inputId = useId()
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<{ extracted: ExtractedApplication; source_text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!message.trim()) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [message])
  if (!isAdmin) return <EmptyState title="Captura reservada a administración" description="Puedes consultar las aplicaciones de las agrícolas que tienes asignadas." action={<Button asChild variant="outline"><Link to="/aplicaciones">Consultar aplicaciones</Link></Button>} />

  async function generate() {
    if (busy) return
    setError(null)
    if (!message.trim() || message.length > 20_000) { setError('Pega el mensaje de la aplicación, con un máximo de 20,000 caracteres.'); return }
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    try {
      const extracted = await interpretApplication(message, request.signal)
      if (!request.signal.aborted) setDraft({ extracted, source_text: message })
    } catch (cause) { if (!request.signal.aborted) setError(errorMessage(cause)) }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  function reviewDemo() {
    const stage = data.stages.find(item => item.status === 'planted')
    const subdivision = data.subdivisions.find(item => item.id === stage?.subdivision_id)
    const lot = data.lots.find(item => item.id === subdivision?.lot_id)
    const project = data.projects.find(item => item.id === lot?.project_id)
    const unit = data.catalogs.agricultural_units.find(item => item.id === project?.agricultural_unit_id)
    const product = data.catalogs.products.find(item => item.active)
    if (!unit || !lot || !product) { setError('El ejemplo necesita una siembra y un producto en la demostración.'); return }
    const applicationNumber = stage ? nextStageApplicationNumber(data, stage.id) : 1
    const source = `${unit.name}\n${lot.name}\nAplicación ${applicationNumber}\n500 ${product.unit} de ${product.name}\nDosis / ha\nGasto de agua / ha 660 litros\nNota:\nNota ficticia para revisar la captura.`
    setMessage(source)
    setDraft({ source_text: source, extracted: validateExtractedApplication({ agricultural_unit: unit.name, destinations: [lot.name], application_number: applicationNumber, water_l_ha: 660, note: 'Nota ficticia para revisar la captura.', products: [{ name: product.name, dose: 500, unit: product.unit }] }) })
  }
  return <section className="workspace-page flex flex-col gap-6">
    <div><Button asChild variant="ghost"><Link to="/aplicaciones"><ArrowLeft data-icon="inline-start" />Aplicaciones</Link></Button></div>
    <header className="page-header"><div><p className="eyebrow">CAPTURA ASISTIDA</p><h1 className="page-title">Captura con IA</h1><p className="muted">Pega el mensaje, completa los datos pendientes y aprueba la indicación.</p></div></header>
    <ErrorAlert message={error} />
    {mode === 'demo' && <Alert><AlertTitle>Revisión de demostración</AlertTitle><AlertDescription>La IA requiere sesión real. El ejemplo permite revisar datos ficticios y se guarda solo en este navegador.</AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Mensaje de la aplicación</CardTitle><CardDescription>Incluye agrícola, mallas o lotes, número por etapa, productos y dosis, agua y la nota que deseas conservar.</CardDescription></CardHeader>
      <CardContent><FieldGroup><Field><FieldLabel htmlFor={inputId}>Mensaje original</FieldLabel><Textarea id={inputId} value={message} onChange={event => setMessage(event.target.value)} maxLength={20_000} rows={12} disabled={busy} aria-describedby={`${inputId}-help`} placeholder="Pega aquí el mensaje. Puedes incluir un bloque Nota: al final." /><FieldDescription id={`${inputId}-help`}>{message.length.toLocaleString('es-MX')} / 20,000 caracteres. cc equivale a ml; las dosis se expresan por hectárea.</FieldDescription></Field></FieldGroup></CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button onClick={() => void generate()} disabled={busy || !message.trim() || mode === 'demo'}>{busy ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}{busy ? 'Interpretando mensaje…' : 'Generar borrador con IA'}</Button>
        <Button variant="outline" disabled={busy || !message.trim()} onClick={() => { setError(null); setDraft({ extracted: validateExtractedApplication({}), source_text: message }) }}><FilePenLine data-icon="inline-start" />Completar manualmente</Button>
        {mode === 'demo' && <Button variant="outline" onClick={reviewDemo}>Revisar ejemplo ficticio</Button>}
      </CardFooter>
    </Card>
    <Alert><AlertTitle>La aprobación está en tus manos</AlertTitle><AlertDescription>El borrador vincula coincidencias únicas del catálogo. Revisa selecciones, unidades, fechas y Nota de la aplicación antes de aprobar. El texto original se conserva con la orden.</AlertDescription></Alert>
    {draft && <NewApplicationDialog imported={draft} close={() => setDraft(null)} onSaved={() => setMessage('')} />}
  </section>
}
