import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { useWorkspace } from '@/data/workspace-context'
import type { UserProfile } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorAlert, errorMessage, FormInput, FormSelect, LoadingState, normalizeSearch, RecordDetails, RecordDialog, SaveButton, SearchField, useFormClose } from './shared'

export function UsersPage() {
  const { data, isAdmin, mode, loading } = useWorkspace()
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<{ mode: 'view' | 'edit'; id: string } | 'new' | null>(null)
  const users = useMemo(() => data.profiles.filter(user => normalizeSearch(`${user.full_name} ${user.email ?? ''} ${user.role === 'admin' ? 'administrador' : 'consulta'}`).includes(normalizeSearch(query))).sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')), [data.profiles, query])
  if (!isAdmin) return <section className="workspace-page"><EmptyState title="Administración de usuarios" description="La administración asigna los roles y las agrícolas que cada cuenta puede consultar." action={<Button variant="outline" asChild><Link to="/proyectos">Consultar mis proyectos</Link></Button>} /></section>
  if (loading) return <LoadingState />
  const selected = selection && selection !== 'new' ? data.profiles.find(user => user.id === selection.id) : undefined
  const accessNames = (user: UserProfile) => user.role === 'admin' ? 'Todas las agrícolas' : data.assignments.filter(item => item.user_id === user.id).map(item => data.catalogs.agricultural_units.find(unit => unit.id === item.agricultural_unit_id)?.name).filter(Boolean).join(', ') || 'Sin agrícolas asignadas'
  return <section className="workspace-page"><header className="page-header"><div><p className="eyebrow">Administración y acceso</p><h1 className="page-title">Usuarios</h1><p className="muted">Define quién administra y qué agrícolas puede consultar cada persona.</p></div>{mode === 'supabase' && <Button onClick={() => setSelection('new')}><Plus data-icon="inline-start" />Crear usuario</Button>}</header>
    {mode === 'demo' && <Alert><UserRound aria-hidden="true" /><AlertTitle>Perfiles de demostración</AlertTitle><AlertDescription>Puedes explorar los roles y asignaciones con los perfiles ficticios. Para crear cuentas reales, conecta tu servidor Supabase desde <Link to="/conexion">Conexión</Link>.</AlertDescription></Alert>}
    <div className="stat-grid"><article className="metric-card"><span>Usuarios</span><strong>{data.profiles.length}</strong><small>Cuentas visibles para administración</small></article><article className="metric-card"><span>Administradores</span><strong>{data.profiles.filter(user => user.role === 'admin').length}</strong><small>Captura y mantenimiento</small></article><article className="metric-card"><span>Usuarios de consulta</span><strong>{data.profiles.filter(user => user.role === 'reader').length}</strong><small>Acceso por agrícola asignada</small></article></div>
    <div className="surface"><div className="catalog-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre, correo o rol…" label="Buscar usuarios" /></div>{users.length ? <div className="table-wrap"><Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Agrícolas autorizadas</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{users.map(user => <TableRow key={user.id}><TableCell><div className="record-name">{user.full_name}</div><div className="muted record-secondary">{user.email || 'Cuenta gestionada por Supabase Auth'}</div></TableCell><TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role === 'admin' ? 'Administrador' : 'Consulta'}</Badge></TableCell><TableCell><div className="user-access-summary">{accessNames(user)}</div></TableCell><TableCell><div className="row-actions"><Button variant="outline" aria-label={`Ver ${user.full_name}`} onClick={() => setSelection({ mode: 'view', id: user.id })}><Eye data-icon="inline-start" />Ver</Button><Button variant="outline" aria-label={`Editar acceso de ${user.full_name}`} onClick={() => setSelection({ mode: 'edit', id: user.id })}><Pencil data-icon="inline-start" />Editar</Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="No encontramos usuarios" description="Prueba otro nombre o limpia la búsqueda." action={<Button variant="outline" onClick={() => setQuery('')}>Limpiar búsqueda</Button>} />}</div>
    {selected && selection && selection !== 'new' && selection.mode === 'view' && <RecordDialog open title={selected.full_name} description="Detalle de acceso de la cuenta. Los permisos efectivos se comprueban en el servidor." onOpenChange={open => { if (!open) setSelection(null) }}><RecordDetails items={[{ label: 'Nombre', value: selected.full_name }, { label: 'Rol', value: selected.role === 'admin' ? 'Administrador' : 'Usuario de consulta' }, { label: 'Agrícolas autorizadas', value: accessNames(selected) }]} /><div className="dialog-actions dialog-actions-end"><Button variant="outline" onClick={() => setSelection(null)}>Cerrar</Button><Button onClick={() => setSelection({ mode: 'edit', id: selected.id })}><Pencil data-icon="inline-start" />Editar acceso</Button></div></RecordDialog>}
    {selected && selection && selection !== 'new' && selection.mode === 'edit' && <UserAccessEditor key={selected.id} user={selected} close={() => setSelection(null)} />}
    {selection === 'new' && <CreateUserEditor close={() => setSelection(null)} />}
  </section>
}

function AgriculturalAssignments({ selected, onChange, disabled = false }: { selected: string[]; onChange: (values: string[]) => void; disabled?: boolean }) {
  const { data } = useWorkspace()
  const prefix = useId()
  return <FieldSet><FieldLegend>Agrícolas de consulta</FieldLegend><FieldDescription>La cuenta solo podrá consultar proyectos, campos, lotes y siembras de las agrícolas seleccionadas.</FieldDescription><div className="assignment-options">{data.catalogs.agricultural_units.map(unit => <Field orientation="horizontal" key={unit.id} data-disabled={disabled}><Checkbox id={`${prefix}-${unit.id}`} checked={selected.includes(unit.id)} disabled={disabled} onCheckedChange={checked => onChange(checked === true ? [...selected, unit.id] : selected.filter(id => id !== unit.id))} /><FieldLabel htmlFor={`${prefix}-${unit.id}`}>{unit.name}{!unit.active && ' (inactiva)'}</FieldLabel></Field>)}</div>{!data.catalogs.agricultural_units.length && <p className="muted">Agrega agrícolas antes de asignar acceso a una cuenta de consulta.</p>}{selected.length === 0 && <p className="muted">Sin asignaciones, esta cuenta no podrá consultar información de agrícolas.</p>}</FieldSet>
}

function UserAccessEditor({ user, close }: { user: UserProfile; close: () => void }) {
  const { data, mutate, isAdmin } = useWorkspace()
  const initial = { role: user.role, selected: data.assignments.filter(item => item.user_id === user.id).map(item => item.agricultural_unit_id).sort() }
  const [role, setRole] = useState<UserProfile['role']>(initial.role)
  const [selected, setSelected] = useState(initial.selected)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { requestClose, onOpenChange, confirmation } = useFormClose(role !== initial.role || JSON.stringify([...selected].sort()) !== JSON.stringify(initial.selected), busy, close)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!isAdmin || busy) return
    setBusy(true); setError(null)
    try { await mutate({ type: 'set_user_access', user_id: user.id, role, agricultural_unit_ids: selected }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title={`Acceso de ${user.full_name}`} description="El rol define las operaciones permitidas. Las asignaciones delimitan las agrícolas de los usuarios de consulta." onOpenChange={onOpenChange}><form onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><FormSelect label="Rol" value={role} onChange={value => setRole(value as UserProfile['role'])} options={[{ value: 'reader', label: 'Usuario de consulta' }, { value: 'admin', label: 'Administrador' }]} required />{role === 'reader' ? <AgriculturalAssignments selected={selected} onChange={setSelected} /> : <Alert><ShieldCheck aria-hidden="true" /><AlertTitle>Acceso de administración</AlertTitle><AlertDescription>Puede consultar todas las agrícolas y realizar captura y mantenimiento, incluida la administración de usuarios.</AlertDescription></Alert>}</FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>Guardar acceso</SaveButton></div></form></RecordDialog>{confirmation}</>
}

function CreateUserEditor({ close }: { close: () => void }) {
  const { createUser, mode, isAdmin } = useWorkspace()
  const [form, setForm] = useState({ display_name: '', email: '', password: '', role: 'reader' as UserProfile['role'], selected: [] as string[] })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { requestClose, onOpenChange, confirmation } = useFormClose(!!form.display_name || !!form.email || !!form.password || form.selected.length > 0 || form.role !== 'reader', busy, close)
  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!isAdmin || mode !== 'supabase' || busy) return
    const next: Record<string, string> = {}
    if (!form.display_name.trim()) next.display_name = 'Captura el nombre de la persona.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Escribe un correo válido para la cuenta.'
    if (form.password.length < 8) next.password = 'Usa una contraseña inicial de al menos ocho caracteres.'
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setError(null)
    try { await createUser({ email: form.email.trim(), password: form.password, display_name: form.display_name.trim(), role: form.role === 'admin' ? 'admin' : 'viewer', agricultural_unit_ids: form.selected }); close() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  return <><RecordDialog open title="Crear usuario" description="La cuenta se crea en Supabase Auth mediante una función de servidor autorizada para administradores." onOpenChange={onOpenChange} wide><form noValidate onSubmit={event => { void submit(event) }} className="record-form"><FieldGroup><div className="field-grid"><FormInput label="Nombre de la persona" value={form.display_name} onChange={value => update('display_name', value)} error={errors.display_name} autoComplete="name" required /><FormInput label="Correo de acceso" value={form.email} onChange={value => update('email', value)} type="email" error={errors.email} autoComplete="off" required /><FormInput label="Contraseña inicial" value={form.password} onChange={value => update('password', value)} type="password" minLength={8} error={errors.password} autoComplete="new-password" required /><FormSelect label="Rol" value={form.role} onChange={value => update('role', value as UserProfile['role'])} options={[{ value: 'reader', label: 'Usuario de consulta' }, { value: 'admin', label: 'Administrador' }]} required /></div>{form.role === 'reader' ? <AgriculturalAssignments selected={form.selected} onChange={value => update('selected', value)} /> : <Alert><ShieldCheck aria-hidden="true" /><AlertTitle>Cuenta de administración</AlertTitle><AlertDescription>Tendrá acceso a todas las agrícolas y podrá guardar cambios y administrar usuarios.</AlertDescription></Alert>}</FieldGroup><ErrorAlert message={error} /><div className="dialog-actions dialog-actions-end"><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancelar</Button><SaveButton busy={busy}>Crear cuenta</SaveButton></div></form></RecordDialog>{confirmation}</>
}
