import { useEffect, useId, useRef, useState, type ClipboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FilePenLine, LoaderCircle, Sparkles, X } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { validateExtractedApplication, type ExtractedApplication } from '@/domain/application-import'
import type { ImageExtraction } from '@/domain/application-image'
import { readCaptureImage, captureImageUrl, type CaptureImage } from '@/data/application-image'
import { nextStageApplicationNumber } from '@/domain/applications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState, ErrorAlert, errorMessage } from './shared'
import { NewApplicationDialog } from './applications'

type CaptureDraft = { extracted: ExtractedApplication; source_text: string; image?: ImageExtraction; imagePreview?: string }
export function ApplicationAiPage() {
  const { isAdmin, mode, data, interpretApplication, interpretImage } = useWorkspace()
  const inputId = useId(), fileId = useId()
  const [inputMode, setInputMode] = useState('text')
  const [message, setMessage] = useState('')
  const [image, setImage] = useState<CaptureImage | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null), fileVersion = useRef(0)
  const working = busy || reading
  useEffect(() => () => { controller.current?.abort(); fileVersion.current++ }, [])
  useEffect(() => {
    if (!message.trim() && !image) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [message, image])
  async function acceptImage(file: File) {
    if (busy) return
    const version = ++fileVersion.current
    setReading(true); setError(null)
    try { const next = await readCaptureImage(file); if (version === fileVersion.current) { setImage(next); setFileName(file.name); setInputMode('image') } }
    catch (cause) { if (version === fileVersion.current) setError(errorMessage(cause)) }
    finally { if (version === fileVersion.current) { setReading(false); setFileInputVersion(value => value + 1) } }
  }
  function pasteImage(event: ClipboardEvent) {
    if (working) return
    const file = Array.from(event.clipboardData.files).find(item => item.type.startsWith('image/'))
    if (file) { event.preventDefault(); void acceptImage(file) }
  }
  function reviewImage(extractedImage: ImageExtraction, preview?: string) {
    const { products, source_text, ...context } = extractedImage
    const sourceText = [source_text, message.trim() ? `Contexto escrito:\n${message}` : ''].filter(Boolean).join('\n\n')
    if (sourceText.length > 20_000) throw new Error('El texto leído y el contexto superan 20,000 caracteres. Reduce el contexto o usa una imagen más corta.')
    const extracted = validateExtractedApplication({ ...context, products: products.map(product => ({ name: product.name, dose: null, unit: product.unit === 'kg' ? 'g' : product.unit === 'L' ? 'ml' : product.unit })) })
    setDraft({ extracted, image: extractedImage, imagePreview: preview, source_text: sourceText })
  }
  async function generate() {
    if (working) return
    setError(null)
    if (message.length > 20_000 || inputMode === 'text' && !message.trim()) { setError('Pega el mensaje de la aplicación, con un máximo de 20,000 caracteres.'); return }
    if (inputMode === 'image' && !image) { setError('Sube o pega una imagen para interpretar sus cantidades totales.'); return }
    const request = new AbortController(); controller.current = request; setBusy(true)
    try {
      if (inputMode === 'image' && image) { const result = await interpretImage(message, image, request.signal); if (!request.signal.aborted) reviewImage(result, captureImageUrl(image)) }
      else { const extracted = await interpretApplication(message, request.signal); if (!request.signal.aborted) setDraft({ extracted, source_text: message }) }
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
    if (inputMode === 'image') {
      const context = validateExtractedApplication({ agricultural_unit: unit.name, destinations: [lot.name], application_number: applicationNumber, water_l_ha: 660, note: 'Reparto ficticio de cantidades totales.' })
      const source = `${product.name} · presentación ficticia 12 × 1 · cantidad total 24 ${product.unit === 'g' ? 'kg' : 'L'}`
      reviewImage({ ...context, source_text: source, products: [{ name:product.name,presentation:'Caja ficticia de 12 × 1',quantity:24,unit:product.unit === 'g' ? 'kg' : 'L' }] })
    } else {
      const source = `${unit.name}\n${lot.name}\nAplicación ${applicationNumber}\n500 ${product.unit} de ${product.name}\nDosis / ha\nGasto de agua / ha 660 litros\nNota:\nNota ficticia para revisar la captura.`
      setMessage(source)
      setDraft({ source_text: source, extracted: validateExtractedApplication({ agricultural_unit: unit.name, destinations: [lot.name], application_number: applicationNumber, water_l_ha: 660, note: 'Nota ficticia para revisar la captura.', products: [{ name: product.name, dose: 500, unit: product.unit }] }) })
    }
  }
  if (!isAdmin) return <EmptyState title="Captura reservada a administración" description="Puedes consultar las aplicaciones de las agrícolas que tienes asignadas." action={<Button asChild variant="outline"><Link to="/aplicaciones">Consultar aplicaciones</Link></Button>} />
  return <section className="workspace-page flex flex-col gap-6">
    <div><Button asChild variant="ghost"><Link to="/aplicaciones"><ArrowLeft data-icon="inline-start" />Aplicaciones</Link></Button></div>
    <header className="page-header"><div><p className="eyebrow">CAPTURA ASISTIDA</p><h1 className="page-title">Captura con IA</h1><p className="muted">Usa texto o una imagen, completa los datos pendientes y revisa las dosis antes de aprobar.</p></div></header>
    <ErrorAlert message={error} />
    {mode === 'demo' && <Alert><AlertTitle>Revisión de demostración</AlertTitle><AlertDescription>La IA requiere sesión real. Los ejemplos ficticios se guardan solo en este navegador.</AlertDescription></Alert>}
    <Tabs value={inputMode} onValueChange={setInputMode}><TabsList aria-label="Origen de la captura"><TabsTrigger value="text" disabled={working}>Texto</TabsTrigger><TabsTrigger value="image" disabled={working}>Imagen · cantidades totales</TabsTrigger></TabsList></Tabs>
    <Card>
      <CardHeader><CardTitle>{inputMode === 'image' ? 'Imagen de productos y cantidades' : 'Mensaje de la aplicación'}</CardTitle><CardDescription>{inputMode === 'image' ? 'Sube o pega una imagen. Sus cantidades totales se repartirán entre las hectáreas que selecciones.' : 'Incluye agrícola, mallas, número por etapa, productos, dosis, agua y nota.'}</CardDescription></CardHeader>
      <CardContent onPaste={inputMode === 'image' ? pasteImage : undefined}><FieldGroup>
        {inputMode === 'image' && <Field><FieldLabel htmlFor={fileId}>Subir imagen o pegarla con Ctrl+V</FieldLabel><Input key={fileInputVersion} id={fileId} type="file" accept="image/png,image/jpeg,image/webp" disabled={working} onChange={event => { const file = event.target.files?.[0]; if (file) void acceptImage(file) }} aria-describedby={`${fileId}-help`} /><FieldDescription id={`${fileId}-help`}>PNG, JPEG o WebP · hasta 5 MB y 20 megapíxeles. Haz clic en esta sección para pegar una imagen.</FieldDescription>{reading && <p role="status">Abriendo imagen…</p>}{image && <><img src={captureImageUrl(image)} alt="Vista previa de la imagen seleccionada" className="max-h-80 max-w-full rounded-lg object-contain" /><p className="break-words muted">{fileName}</p><Button type="button" variant="outline" disabled={working} onClick={() => { fileVersion.current++; setImage(null); setFileName(''); setFileInputVersion(value=>value+1) }}><X data-icon="inline-start" />Quitar imagen</Button></>}</Field>}
        <Field><FieldLabel htmlFor={inputId}>{inputMode === 'image' ? 'Contexto adicional (opcional)' : 'Mensaje original'}</FieldLabel><Textarea id={inputId} value={message} onChange={event => setMessage(event.target.value)} maxLength={20_000} rows={inputMode === 'image' ? 5 : 12} disabled={working} aria-describedby={`${inputId}-help`} placeholder={inputMode === 'image' ? 'Agrícola, mallas, aplicación, fechas, agua o nota que acompañan la imagen.' : 'Pega aquí el mensaje. Puedes incluir un bloque Nota: al final.'} /><FieldDescription id={`${inputId}-help`}>{message.length.toLocaleString('es-MX')} / 20,000 caracteres. {inputMode === 'image' ? 'La presentación del envase se revisa separada de la cantidad total.' : 'cc equivale a ml; las dosis se expresan por hectárea.'}</FieldDescription></Field>
      </FieldGroup></CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button onClick={() => void generate()} disabled={working || mode === 'demo' || (inputMode === 'image' ? !image : !message.trim())}>{busy ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}{busy ? 'Interpretando…' : inputMode === 'image' ? 'Leer imagen con IA' : 'Generar borrador con IA'}</Button>
        {inputMode === 'text' && <Button variant="outline" disabled={working || !message.trim()} onClick={() => { setError(null); setDraft({ extracted: validateExtractedApplication({}), source_text: message }) }}><FilePenLine data-icon="inline-start" />Completar manualmente</Button>}
        {mode === 'demo' && <Button variant="outline" onClick={reviewDemo}>{inputMode === 'image' ? 'Revisar ejemplo ficticio de totales' : 'Revisar ejemplo ficticio'}</Button>}
      </CardFooter>
    </Card>
    <Alert><AlertTitle>La aprobación está en tus manos</AlertTitle><AlertDescription>Revisa coincidencias del catálogo, unidades, destinos y dosis. La captura desde imagen conserva el texto leído y el reparto original al guardar.</AlertDescription></Alert>
    {draft && <NewApplicationDialog imported={draft} close={() => setDraft(null)} onSaved={() => { setMessage(''); setImage(null); setFileName('') }} />}
  </section>
}
