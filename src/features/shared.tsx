import { useId, useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, Search, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { CatalogKind, CatalogRecord } from '@/domain/model'

export const catalogDefinitions: Record<CatalogKind, { title: string; singular: string; description: string; eyebrow: string }> = {
  agricultural_units: { title: 'Agrícolas', singular: 'agrícola', description: 'Las unidades de la empresa y el origen de cada temporada.', eyebrow: 'Estructura de la operación' },
  fields: { title: 'Campos', singular: 'campo', description: 'Organiza los campos de cada agrícola. Los lotes se definen por temporada.', eyebrow: 'Estructura de la operación' },
  crops: { title: 'Cultivos', singular: 'cultivo', description: 'Los cultivos que dan identidad a cada etapa de siembra.', eyebrow: 'Planeación agrícola' },
  varieties: { title: 'Variedades', singular: 'variedad', description: 'Relaciona cada variedad con el cultivo al que pertenece.', eyebrow: 'Planeación agrícola' },
  products: { title: 'Productos', singular: 'producto', description: 'Productos, dosis de referencia e ingredientes activos, en un solo lugar.', eyebrow: 'Insumos de aplicación' },
  active_ingredients: { title: 'Ingredientes activos', singular: 'ingrediente activo', description: 'Ingredientes que se relacionan con uno o varios productos.', eyebrow: 'Insumos de aplicación' },
  brands: { title: 'Marcas', singular: 'marca', description: 'Identifica las marcas de los productos. Su asignación es opcional.', eyebrow: 'Insumos de aplicación' },
  product_families: { title: 'Familias de productos', singular: 'familia', description: 'Una clasificación compartida para encontrar y organizar productos.', eyebrow: 'Insumos de aplicación' },
  infrastructure_types: { title: 'Infraestructura', singular: 'tipo de infraestructura', description: 'Mallasombra, invernadero, campo abierto y otras condiciones del lote.', eyebrow: 'Configuración del campo' },
  application_methods: { title: 'Medios de aplicación', singular: 'medio de aplicación', description: 'Dron, tractor, bomba manual y los medios que utiliza tu operación.', eyebrow: 'Configuración del campo' },
}

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim()
export const formatArea = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value))
export const recordName = (items: CatalogRecord[], id: string | null | undefined) => items.find(item => item.id === id)?.name ?? 'Sin asignar'
export function formatDate(value: string | null | undefined) {
  if (!value) return 'Pendiente'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'No fue posible completar la operación. Intenta de nuevo.' }

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { active: 'Activa', inactive: 'Inactiva', draft: 'En preparación', closed: 'Cerrada', planned: 'Planeada', planted: 'Sembrada' }
  return <Badge variant={status === 'active' || status === 'planted' ? 'default' : 'secondary'} className="status-badge" data-state={status}>{labels[status] ?? status}</Badge>
}

export function ErrorAlert({ message, retry }: { message: string | null; retry?: () => void }) {
  if (!message) return null
  return <Alert variant="destructive" role="alert"><AlertTitle>No se pudo completar la operación</AlertTitle><AlertDescription>{message}{retry && <Button type="button" variant="outline" onClick={retry}>Reintentar</Button>}</AlertDescription></Alert>
}

export function SearchField({ value, onChange, placeholder = 'Buscar…', label = 'Buscar registros' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  const id = useId()
  return <Field className="min-w-0 flex-1"><FieldLabel htmlFor={id}>{label}</FieldLabel><InputGroup><InputGroupInput id={id} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" /><InputGroupAddon align="inline-start"><Search aria-hidden="true" /></InputGroupAddon></InputGroup></Field>
}

export function FormInput({ label, value, onChange, error, help, required, type = 'text', min, max, step, placeholder, autoComplete, minLength, disabled }: { label: string; value: string; onChange: (value: string) => void; error?: string; help?: string; required?: boolean; type?: string; min?: string | number; max?: string | number; step?: string | number; placeholder?: string; autoComplete?: string; minLength?: number; disabled?: boolean }) {
  const id = useId()
  return <Field data-invalid={!!error} data-disabled={disabled}><FieldLabel htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</FieldLabel><Input id={id} disabled={disabled} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} min={min} max={max} step={step} placeholder={placeholder} autoComplete={autoComplete} minLength={minLength} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined} />{help && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}{error && <FieldError id={`${id}-error`}>{error}</FieldError>}</Field>
}

export type SelectOption = { value: string; label: string; disabled?: boolean }
export function FormSelect({ label, value, onChange, options, placeholder = 'Seleccionar', error, help, required, disabled }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; placeholder?: string; error?: string; help?: string; required?: boolean; disabled?: boolean }) {
  const id = useId()
  return <Field data-invalid={!!error} data-disabled={disabled}><FieldLabel htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</FieldLabel><Select value={value} onValueChange={onChange} disabled={disabled} required={required}><SelectTrigger id={id} aria-required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select>{help && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}{error && <FieldError id={`${id}-error`}>{error}</FieldError>}</Field>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon"><Sprout aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{action}</Empty>
}

export function LoadingState() { return <div className="flex flex-col gap-5" role="status" aria-label="Cargando registros"><Skeleton className="h-12 w-64" /><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /><span className="sr-only">Cargando registros…</span></div> }

export function RecordDialog({ title, description, open, onOpenChange, children, wide = false }: { title: string; description: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; wide?: boolean }) {
  const [opener] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const contentRef = useRef<HTMLDivElement>(null)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent ref={contentRef} className={wide ? 'record-dialog record-dialog-wide' : 'record-dialog'} onOpenAutoFocus={event => {
    const content = contentRef.current
    const input = content?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])')
    if (input) { event.preventDefault(); input.focus(); return }
    const heading = content?.querySelector<HTMLElement>('[data-slot="dialog-title"]')
    if (heading) { event.preventDefault(); heading.tabIndex = -1; heading.focus() }
  }} onCloseAutoFocus={event => {
    event.preventDefault()
    if (document.querySelector('[role="dialog"][data-state="open"]')) return
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus()
    else {
      const heading = document.querySelector<HTMLElement>('main h1')
      if (heading) { heading.tabIndex = -1; heading.focus() }
    }
  }}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>
}

export function SaveButton({ busy, children = 'Guardar cambios', form }: { busy: boolean; children?: ReactNode; form?: string }) { return <Button type="submit" form={form} disabled={busy}>{busy && <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />}{busy ? 'Guardando…' : children}</Button> }

export function RecordDetails({ items }: { items: { label: string; value: ReactNode }[] }) { return <dl className="record-details">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value ?? 'Sin especificar'}</dd></div>)}</dl> }

export function useFormClose(dirty: boolean, busy: boolean, onClose: () => void) {
  const [confirm, setConfirm] = useState(false)
  const requestClose = () => { if (busy) return; if (dirty) setConfirm(true); else onClose() }
  const confirmation = <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle><AlertDialogDescription>Los cambios que capturaste todavía no se han guardado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={onClose}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  return { requestClose, onOpenChange: (open: boolean) => { if (!open) requestClose() }, confirmation }
}
