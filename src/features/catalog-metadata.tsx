import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import type { CatalogMetadataChange, CatalogRecord } from '@/domain/model'
import { catalogRelationOptions } from '@/domain/catalogs'
import { sortNamed } from '@/domain/list-order'
import { FormSelect } from './shared'

export function ClassificationEditor({ ids, primary, records, existing, disabled, errors, onChange }: { ids: string[]; primary: string; records: CatalogRecord[]; existing: string[]; disabled: boolean; errors: Record<string, string>; onChange: (ids: string[], primary: string) => void }) {
  const prefix = useId()
  const available = catalogRelationOptions(records, existing)
  return <FieldSet><FieldLegend>Clasificaciones de uso</FieldLegend><FieldDescription>Selecciona todas las que correspondan. Los productos que contengan este ingrediente heredarán sus clasificaciones.</FieldDescription>
    <div className="assignment-options">{available.map(option => <Field orientation="horizontal" key={option.value} data-disabled={disabled} data-invalid={!!errors.classification_ids}><Checkbox id={`${prefix}-${option.value}`} checked={ids.includes(option.value)} disabled={disabled} aria-invalid={!!errors.classification_ids} onCheckedChange={checked => onChange(checked === true ? [...ids, option.value] : ids.filter(id => id !== option.value), checked !== true && primary === option.value ? '__none' : primary)} /><FieldLabel htmlFor={`${prefix}-${option.value}`}>{option.label}</FieldLabel></Field>)}</div>
    {!available.length && <p className="muted">Todavía no hay clasificaciones disponibles. Puedes guardar sin clasificación.</p>}
    {errors.classification_ids && <FieldError>{errors.classification_ids}</FieldError>}
    <FormSelect label="Clasificación principal (opcional)" value={primary} onChange={value => onChange(ids, value)} options={[{ value: '__none', label: 'Sin principal', pinned: true }, ...available.filter(option => ids.includes(option.value))]} disabled={disabled} error={errors.classification_id} help="Puedes destacar una de las seleccionadas o dejar todas sin principal. Una referencia inactiva ya relacionada puede conservarse." />
  </FieldSet>
}

export function ClassificationBadges({ record, records }: { record: CatalogRecord; records: CatalogRecord[] }) {
  const ids = record.classification_ids ?? (record.classification_id ? [record.classification_id] : [])
  return <div className="flex flex-wrap gap-2">{sortNamed(records.filter(item => ids.includes(item.id))).map(item => <Badge variant="secondary" key={item.id}>{item.name}{item.id === record.classification_id ? ' · Principal' : ''}{item.active ? '' : ' · Inactiva'}</Badge>)}{record.inherited_classifications?.complete === false && <Badge variant="outline">Clasificación incompleta</Badge>}{!ids.length && <span className="muted">Sin clasificaciones</span>}</div>
}

export function CatalogMetadataHistory({ changes, kind, recordId }: { changes: CatalogMetadataChange[]; kind: string; recordId: string }) {
  const history = changes.filter(change => change.kind === kind && change.record_id === recordId).sort((a, b) => b.changed_at.localeCompare(a.changed_at))
  const describe = (snapshot: CatalogMetadataChange['after']) => snapshot ? `${snapshot.name} · ${snapshot.active ? 'Activo' : 'Inactivo'}${kind === 'products' ? '' : ` · ${(snapshot.classifications ?? []).map(item => `${item.name}${item.id === snapshot.classification_id ? ' (principal)' : ''}`).join(', ') || 'Sin clasificaciones'}`} · Sinónimos: ${snapshot.synonyms.join(', ') || 'Ninguno'}` : 'Registro inexistente'
  return <FieldSet><FieldLegend>Historial de cambios</FieldLegend><FieldDescription>Conserva los cambios del catálogo, con autor y fecha.</FieldDescription>{history.map(change => <article className="surface p-3 flex flex-col gap-2" key={change.id}><p>{change.changed_by_name} · {new Date(change.changed_at).toLocaleString('es-MX')}</p><p className="muted break-words">Antes: {describe(change.before)}</p><p className="break-words">Después: {describe(change.after)}</p></article>)}{!history.length && <p className="muted">Sin cambios registrados desde que se habilitó este historial.</p>}</FieldSet>
}
