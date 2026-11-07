import { sortDisplay } from '@/domain/list-order'
import { useId } from 'react'
import { Droplets, Plus, X } from 'lucide-react'
import type { CatalogRecord, ProductLine } from '@/domain/model'
import type { ApplicationDraftIssue } from '@/domain/application-draft'
import { buildProductOptions, compactProductTerm } from '@/domain/product-synonyms'
import { matchImportedProducts } from '@/domain/application-import'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormInput, FormSelect } from './shared'

export type ProductDraft = { key: string; product_id: string; dose: string; sourceName?: string; importUnit?: 'g' | 'ml' | null }
export const newProductRow = (): ProductDraft => ({ key: crypto.randomUUID(), product_id: '', dose: '' })
export const dosage = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(Number(value))

export function businessToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validateProducts(rows: ProductDraft[]) {
  if (!rows.length) return 'Agrega al menos un producto a la mezcla.'
  if (rows.some(row => !row.product_id)) return 'Selecciona un producto en cada renglón.'
  if (new Set(rows.map(row => row.product_id)).size !== rows.length) return 'Cada producto solo puede aparecer una vez en la mezcla.'
  if (rows.some(row => !row.dose.trim() || !Number.isFinite(Number(row.dose)) || Number(row.dose) <= 0)) return 'Completa todas las dosis con un valor mayor que cero.'
  return ''
}

export function ProductMixtureEditor({ rows, onChange, products, activeIngredients = [], original = [], error, imported = false, issues = [] }: {
  rows: ProductDraft[]
  onChange: (rows: ProductDraft[]) => void
  products: CatalogRecord[]
  activeIngredients?: CatalogRecord[]
  original?: ProductLine[]
  error?: string
  imported?: boolean
  issues?: ApplicationDraftIssue[]
}) {
  const options = buildProductOptions(products, activeIngredients, original)
  const updateRow = (key: string, change: Partial<ProductDraft>) => onChange(rows.map(row => row.key === key ? { ...row, ...change } : row))
  return (
    <FieldSet>
      <FieldLegend>Productos y dosis por hectárea</FieldLegend>
      <FieldDescription>La mezcla es común a todos los destinos seleccionados. La dosis no cambia la predeterminada del catálogo.</FieldDescription>
      <div className="flex flex-col gap-4">
        {rows.map((row, index) => {
          const product = products.find(item => item.id === row.product_id)
          const indicated = original.find(item => item.product_id === row.product_id)
          const unit = indicated?.unit || product?.unit
          const synonym = row.sourceName && product?.synonyms?.find(name => compactProductTerm(name) === compactProductTerm(row.sourceName!))
          const suggestions = imported && row.sourceName && !product ? matchImportedProducts([{name:row.sourceName,unit:row.importUnit ?? null,dose:null}],products)[0].candidates : []
          return (
            <FieldGroup className="application-mixture-row" key={row.key}>
              <FormSelect wrapOptions label={row.sourceName ? `Producto ${index + 1}: ${row.sourceName}` : `Producto ${index + 1}`} value={row.product_id} onChange={id => {
                const chosen = products.find(item => item.id === id)
                const previous = original.find(item => item.product_id === id)
                updateRow(row.key, { product_id: id, dose: imported ? row.dose : String(previous?.dose ?? chosen?.default_dose ?? '') })
              }} options={options.map(item => ({ ...item, disabled: rows.some(other => other.key !== row.key && other.product_id === item.value) }))} required error={issues.find(issue => issue.field === `product:${index}`)?.message} help={product ? `Código: ${product.code || product.id} · Unidad del catálogo: ${unit}/ha${synonym ? ` · El mensaje dice «${row.sourceName}»: sinónimo registrado de ${product.name}.` : ''}` : suggestions.length ? `Posibles coincidencias: ${suggestions.map(item=>item.name).join(', ')}. Selecciona el producto correcto.` : 'Selecciona un producto del catálogo.'} />
              <FormInput label={unit ? `Dosis (${unit}/ha)` : 'Dosis por hectárea'} value={row.dose} onChange={dose => updateRow(row.key, { dose })} type="number" min="0.000001" step="any" required error={issues.find(issue => issue.field === `dose:${index}`)?.message} />
              <Button type="button" variant="outline" size="icon" aria-label={`Quitar producto ${index + 1}`} onClick={() => onChange(rows.filter(item => item.key !== row.key))}><X /></Button>
              {imported && row.sourceName && <div className="col-span-full flex flex-col gap-2">
                <FormSelect label={`Unidad del mensaje para ${row.sourceName}`} value={row.importUnit || ''} onChange={value => updateRow(row.key, { importUnit: value as 'g' | 'ml', dose: '' })} options={[{ value: 'g', label: 'g/ha' }, { value: 'ml', label: 'ml/ha' }]} required error={issues.find(issue => issue.field === `unit:${index}`)?.message} help="Si corriges la unidad, vuelve a capturar la dosis confirmada. Masa y volumen requieren aclaración." />
              </div>}
            </FieldGroup>
          )
        })}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div><Button type="button" variant="outline" onClick={() => onChange([...rows, newProductRow()])}><Plus data-icon="inline-start" />Agregar producto</Button></div>
    </FieldSet>
  )
}

export function MixtureReadOnly({ products, water, title = 'Mezcla indicada' }: { products: ProductLine[]; water: number | null; title?: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      <div className="table-wrap">
        <Table>
          <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Dosis por hectárea</TableHead></TableRow></TableHeader>
          <TableBody>{sortDisplay(products, product => product.product_name ?? '', product => product.product_id).map((product, index) => <TableRow key={`${product.product_id}-${index}`}><TableCell>{product.product_name}</TableCell><TableCell>{dosage(product.dose)} {product.unit}/ha</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <p className="application-water"><Droplets aria-hidden="true" /><strong>Gasto de agua: {water == null ? 'No especificado' : `${dosage(water)} L/ha`}</strong></p>
    </section>
  )
}

export function TextField({ label, value, onChange, required, error, help }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: string; help?: string }) {
  const id = useId()
  return <Field data-invalid={!!error}>
    <FieldLabel htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</FieldLabel>
    <Textarea id={id} value={value} onChange={event => onChange(event.target.value)} rows={3} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined} />
    {help && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </Field>
}
