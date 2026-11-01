import { useState, type FormEvent } from 'react'
import { Check, Database, FlaskConical, RotateCcw, ShieldCheck, Unplug } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import { AiSettingsCard } from './ai-settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ErrorAlert, errorMessage, FormInput, FormSelect, SaveButton } from './shared'

export function ConnectionPage() {
  const { connection, mode, profile, isAdmin, authenticated, configure, signOut, setDemoRole, resetDemo } = useWorkspace()
  const [url, setUrl] = useState(connection?.url ?? '')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    setError(null); setSuccess(null)
    const next: Record<string, string> = {}
    const publicKey = key.trim() || connection?.key || ''
    try {
      const address = new URL(url.trim())
      if (!['http:', 'https:'].includes(address.protocol)) next.url = 'Usa una dirección HTTP o HTTPS válida.'
      if (address.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)) next.url = 'El servidor externo debe tener una dirección HTTPS.'
    } catch { next.url = 'Escribe la dirección completa de tu servidor Supabase.' }
    if (!publicKey) next.key = 'Captura la clave pública publishable o anon.'
    if (publicKey.startsWith('sb_secret_')) next.key = 'Esta es una clave privada. Utiliza únicamente la clave pública.'
    try { const claims = JSON.parse(atob(publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (claims.role === 'service_role') next.key = 'La clave service_role es privada y no debe utilizarse en el navegador.' } catch { /* Publishable keys are not JWTs. */ }
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true)
    try {
      if (mode === 'supabase' && authenticated) await signOut()
      configure({ url: url.trim(), key: publicKey })
      setKey(''); setSuccess('Conexión guardada en este navegador. Inicia sesión con una cuenta del servidor configurado.')
    } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  async function useDemo() {
    setBusy(true); setError(null)
    try { if (mode === 'supabase' && authenticated) await signOut(); configure(null); setConfirmDemo(false); setSuccess('Estás usando la demostración local con datos ficticios.') } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <section className="workspace-page connection-page">
    <header className="page-header"><div><p className="eyebrow">Tu espacio de trabajo</p><h1 className="page-title">Conexión y preferencias</h1><p className="muted">Identifica dónde se guardan los datos y configura el servidor de tu operación.</p></div><Badge variant={mode === 'supabase' ? 'default' : 'secondary'}>{mode === 'supabase' ? 'Servidor Supabase' : 'Demostración local'}</Badge></header>
    <div className="connection-grid"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Database aria-hidden="true" />Servidor de la operación</CardTitle><CardDescription>Conecta la interfaz con la API de tu instalación de Supabase.</CardDescription></CardHeader><CardContent><form id="connection-form" noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><FormInput label="URL de Supabase" value={url} onChange={value => { setUrl(value); setErrors(current => ({ ...current, url: '' })) }} error={errors.url} type="url" placeholder="https://supabase.tu-dominio.mx" required autoComplete="url" /><FormInput label="Clave pública publishable o anon" value={key} onChange={value => { setKey(value); setErrors(current => ({ ...current, key: '' })) }} error={errors.key} type="password" autoComplete="off" placeholder={connection ? 'Dejar vacío para conservar la clave guardada' : 'Clave pública del proyecto'} required={!connection} help={connection ? `Clave guardada: ••••••••${connection.key.slice(-6)}. La clave pública identifica el proyecto; tus permisos dependen de la sesión.` : 'Utiliza la clave pública del proyecto. Las claves secretas y service_role permanecen exclusivamente en el servidor.'} /></FieldGroup><ErrorAlert message={error} />{success && <Alert><Check aria-hidden="true" /><AlertTitle>Configuración actualizada</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}</form></CardContent><CardFooter className="flex flex-wrap gap-2"><SaveButton busy={busy} form="connection-form">Guardar conexión</SaveButton></CardFooter></Card>
    <div className="flex flex-col gap-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck aria-hidden="true" />Dónde se guardan los datos</CardTitle><CardDescription>{mode === 'supabase' ? 'El servidor configurado autentica las cuentas y comprueba los permisos.' : 'Los datos de ejemplo se conservan únicamente en este navegador.'}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><dl className="record-details"><div><dt>Modo actual</dt><dd>{mode === 'supabase' ? 'Supabase' : 'Demostración con datos ficticios'}</dd></div><div><dt>Servidor</dt><dd className="break-all">{connection?.url ?? 'Almacenamiento local del navegador'}</dd></div><div><dt>Cuenta o vista</dt><dd>{mode === 'demo' ? `Simulación de ${profile.role === 'admin' ? 'administración' : 'consulta'}` : authenticated ? profile.full_name : 'Sesión pendiente'}</dd></div></dl><Separator /><p className="muted">Esta preferencia de conexión se guarda solo en tu navegador. Para entrar desde otro dispositivo, configura también su conexión.</p></CardContent></Card><Alert><Database aria-hidden="true" /><AlertTitle>Acceso desde Sites o celulares</AlertTitle><AlertDescription>Tu servidor local necesita una dirección HTTPS accesible desde el dispositivo que abre la aplicación. Una dirección localhost apunta al propio dispositivo; publicar la interfaz no publica automáticamente la base de datos.</AlertDescription></Alert></div></div>
    {isAdmin && <AiSettingsCard key={`${mode}:${profile.id}:${connection?.url || "demo"}`} />}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical aria-hidden="true" />Demostración local</CardTitle><CardDescription>Explora el recorrido con información ficticia. La simulación de permisos no equivale a autenticación ni a seguridad del servidor.</CardDescription></CardHeader><CardContent>{mode === 'demo' ? <div className="demo-controls"><FormSelect label="Vista de la demostración" value={profile.role} onChange={value => setDemoRole(value as 'admin' | 'reader')} options={[{ value: 'admin', label: 'Simular administrador' }, { value: 'reader', label: 'Simular usuario de consulta' }]} help="El usuario de consulta de ejemplo solo ve sus agrícolas asignadas." /><Button variant="outline" onClick={() => setConfirmReset(true)}><RotateCcw data-icon="inline-start" />Restablecer datos de ejemplo</Button></div> : <div className="flex flex-col gap-4"><p className="muted">Puedes cerrar la conexión del navegador y volver a los ejemplos. Los datos de Supabase permanecerán en su servidor.</p><div><Button variant="outline" disabled={busy} onClick={() => setConfirmDemo(true)}><Unplug data-icon="inline-start" />Volver a la demostración</Button></div></div>}</CardContent><CardFooter><p className="muted">Los ejemplos no contienen datos reales de tu operación.</p></CardFooter></Card>
    <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Restablecer la demostración?</AlertDialogTitle><AlertDialogDescription>Se reemplazarán los cambios de ejemplo guardados en este navegador por los datos iniciales. Esta acción no modifica ningún servidor Supabase.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar mis ejemplos</AlertDialogCancel><AlertDialogAction onClick={() => { resetDemo(); setSuccess('Demostración restablecida con los datos iniciales.'); setConfirmReset(false) }}>Restablecer ejemplos</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmDemo} onOpenChange={open => { if (!busy) setConfirmDemo(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Volver a la demostración?</AlertDialogTitle><AlertDialogDescription>Se cerrará tu sesión de Supabase y se quitará su conexión de este navegador. Tu información del servidor permanecerá intacta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Mantener conexión</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void useDemo() }}>{busy ? 'Cerrando sesión…' : 'Usar demostración'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}
