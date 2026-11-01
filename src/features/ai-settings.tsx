import { useEffect, useId, useState } from 'react'
import { Check, KeyRound, LoaderCircle, RefreshCw } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import type { AiSettingsStatus, AiSettingsInput, AiSettingsSaveInput, AiSettingsTestResult } from '@/data/ai-settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorAlert, errorMessage, SaveButton } from './shared'

export function AiSettingsCard() {
  const { isAdmin, mode, connection, loadAiSettings, testAiSettings, saveAiSettings } = useWorkspace()
  if (!isAdmin) return null
  return <AiSettingsForm available={mode === 'supabase' && !!connection?.managed} loadAiSettings={loadAiSettings} testAiSettings={testAiSettings} saveAiSettings={saveAiSettings} />
}

type AiSettingsFormProps = {
  available: boolean
  loadAiSettings: (signal?: AbortSignal) => Promise<AiSettingsStatus>
  testAiSettings: (input: AiSettingsInput, signal?: AbortSignal) => Promise<AiSettingsTestResult>
  saveAiSettings: (input: AiSettingsSaveInput, signal?: AbortSignal) => Promise<AiSettingsStatus>
}
export function AiSettingsForm({ available, loadAiSettings, testAiSettings, saveAiSettings }: AiSettingsFormProps) {
  const formId = useId()
  const [status, setStatus] = useState<AiSettingsStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [proof, setProof] = useState('')
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'test' | 'save' | 'load' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ apiKey?: string; model?: string }>({})
  const busy = loading || action !== null
  const dirty = !!apiKey || model !== (status?.model ?? '')
  useEffect(() => {
    if (!available) return
    const request = new AbortController()
    setLoading(true); setError(null)
    void loadAiSettings(request.signal).then(next => {
      if (request.signal.aborted) return
      setStatus(next); setModel(next.model); setApiKey(''); setProof(''); setSuccess(null)
    }).catch(cause => { if (!request.signal.aborted) setError(errorMessage(cause)) })
      .finally(() => { if (!request.signal.aborted) setLoading(false) })
    return () => request.abort()
  }, [available, loadAiSettings])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function changed() { setProof(''); setError(null); setSuccess(null); setFieldErrors({}) }
  function input() {
    const next: typeof fieldErrors = {}
    if (!apiKey.trim() && !status?.configured) next.apiKey = 'Ingresa la clave del proveedor.'
    if (apiKey.trim() && (apiKey.trim().length < 20 || apiKey.trim().length > 2048 || /\s/.test(apiKey.trim()))) next.apiKey = 'Revisa la clave completa, sin espacios.'
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model.trim())) next.model = 'Escribe el identificador del modelo, sin espacios.'
    setFieldErrors(next)
    if (Object.keys(next).length) return null
    return { ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), model: model.trim(), revision: status?.revision ?? null }
  }
  async function test() {
    if (busy || !available || !status?.storageReady) return
    const values = input(); if (!values) return
    setAction('test'); setProof(''); setError(null); setSuccess(null)
    try { const tested = await testAiSettings(values); setProof(tested.testToken); setSuccess('La clave y el modelo respondieron correctamente. Guarda para aplicar esta configuración.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setAction(null) }
  }
  async function save() {
    if (busy || !available || !proof) return
    const values = input(); if (!values) return
    setAction('save'); setError(null); setSuccess(null)
    try {
      const next = await saveAiSettings({ ...values, testToken: proof })
      setStatus(next); setApiKey(''); setModel(next.model); setProof('')
      setSuccess('La configuración se guardó en el servidor. Captura con IA utilizará esta clave y este modelo.')
    } catch (cause) {
      setProof(''); setError(errorMessage(cause))
    } finally { setAction(null) }
  }
  async function refresh() {
    if (busy || !available) return
    setAction('load'); setError(null); setSuccess(null); setProof('')
    try { const next = await loadAiSettings(); setStatus(next); if (!dirty) setModel(next.model) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setAction(null) }
  }
  return <Card>
    <CardHeader><div className="section-header"><CardTitle className="flex items-center gap-2"><KeyRound aria-hidden="true" />Inteligencia artificial</CardTitle><Badge variant={status?.configured ? 'default' : 'secondary'}>{loading ? 'Consultando…' : status?.configured ? 'Activa' : 'Pendiente de configurar'}</Badge></div><CardDescription>La configuración es común a esta instalación y solo puede cambiarla la administración.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-5">
      {!available && <Alert><AlertTitle>Se requiere conexión real de administración</AlertTitle><AlertDescription>Ingresa a Supabase con una cuenta administradora y usa la conexión gestionada para configurar la IA del servidor.</AlertDescription></Alert>}
      {available && status && !status.storageReady && <Alert><AlertTitle>El almacenamiento seguro no está listo</AlertTitle><AlertDescription>La administración del servidor debe habilitar el almacenamiento de configuración antes de probar o guardar.</AlertDescription></Alert>}
      <form id={formId} onSubmit={event => { event.preventDefault(); void save() }} noValidate>
        <fieldset disabled={busy || !available || !status?.storageReady} className="min-w-0">
          <FieldGroup className="field-grid">
            <Field data-invalid={!!fieldErrors.apiKey}><FieldLabel htmlFor={`${formId}-key`}>Clave API</FieldLabel><Input id={`${formId}-key`} type="password" value={apiKey} onChange={event => { changed(); setApiKey(event.target.value) }} autoComplete="off" maxLength={2048} spellCheck={false} aria-invalid={!!fieldErrors.apiKey} aria-describedby={`${formId}-key-help${fieldErrors.apiKey ? ` ${formId}-key-error` : ''}`} placeholder={status?.configured ? 'Vacío conserva la clave guardada' : 'Ingresa la clave del proveedor'} /><FieldDescription id={`${formId}-key-help`}>{status?.keySuffix ? `Clave guardada: ••••••••${status.keySuffix}. Vacío conserva la clave existente.` : 'La clave se guardará cifrada en el servidor.'}</FieldDescription>{fieldErrors.apiKey && <FieldError id={`${formId}-key-error`}>{fieldErrors.apiKey}</FieldError>}</Field>
            <Field data-invalid={!!fieldErrors.model}><FieldLabel htmlFor={`${formId}-model`}>Modelo</FieldLabel><Input id={`${formId}-model`} value={model} onChange={event => { changed(); setModel(event.target.value) }} autoComplete="off" maxLength={200} spellCheck={false} aria-invalid={!!fieldErrors.model} aria-describedby={`${formId}-model-help${fieldErrors.model ? ` ${formId}-model-error` : ''}`} placeholder="Identificador del modelo" /><FieldDescription id={`${formId}-model-help`}>Usa un modelo disponible en tu cuenta que admita la captura estructurada.</FieldDescription>{fieldErrors.model && <FieldError id={`${formId}-model-error`}>{fieldErrors.model}</FieldError>}</Field>
          </FieldGroup>
        </fieldset>
      </form>
      <p className="muted">Probar conexión envía una solicitud mínima al proveedor. La prueba no guarda la configuración; cualquier cambio requiere probar nuevamente.</p>
      {status?.testedAt && <p className="muted">Última prueba guardada: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mazatlan' }).format(new Date(status.testedAt))}.</p>}
      <ErrorAlert message={error} />
      {success && <Alert role="status"><Check aria-hidden="true" /><AlertTitle>{proof ? 'Conexión comprobada' : 'Configuración guardada'}</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}
    </CardContent>
    <CardFooter className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" onClick={() => void test()} disabled={busy || !available || !status?.storageReady}>{action === 'test' && <LoaderCircle className="animate-spin" data-icon="inline-start" />}{action === 'test' ? 'Probando conexión…' : 'Probar conexión'}</Button>
      <SaveButton busy={action === 'save'} disabled={busy || !available || !proof} form={formId}>Guardar configuración</SaveButton>
      <Button type="button" variant="ghost" onClick={() => void refresh()} disabled={busy || !available}><RefreshCw data-icon="inline-start" />Actualizar estado</Button>
    </CardFooter>
  </Card>
}
