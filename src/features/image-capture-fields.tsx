import { Plus, X } from 'lucide-react'
import type { CatalogRecord, ApplicationOrder } from '@/domain/model'
import { buildProductOptions } from '@/domain/product-synonyms'
import type { ImageTotalRow, ImageAllocationLine, ApplicationImageIssue } from '@/domain/application-image'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldGroup, FieldSet, FieldLegend, FieldDescription, FieldError } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormInput, FormSelect } from './shared'

const amount = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 13 }).format(value)
export function ImageProductEditor({ rows, onChange, products, ingredients, allocations, area, errors }: {
  rows: ImageTotalRow[]; onChange: (rows: ImageTotalRow[]) => void; products: CatalogRecord[]; ingredients: CatalogRecord[]; allocations: ImageAllocationLine[]; area: number; errors: ApplicationImageIssue[]
}) {
  const options = buildProductOptions(products, ingredients)
  const update = (index: number, change: Partial<ImageTotalRow>) => onChange(rows.map((row, position) => position === index ? { ...row, ...change } : row))
  const issue = (field: string) => errors.find(item => item.field === field)?.message
  return <FieldSet>
    <FieldLegend>Cantidades totales de la imagen</FieldLegend>
    <FieldDescription>Revisa productos, cantidades y unidades. La presentación describe el envase. Cada total se reparte proporcionalmente entre las hectáreas seleccionadas.</FieldDescription>
    <Alert><AlertTitle>Superficie para repartir: {amount(area)} ha</AlertTitle><AlertDescription>Dosis por ha = cantidad total ÷ superficie seleccionada. Cambiar los destinos recalcula todas las dosis.</AlertDescription></Alert>
    {rows.map((row, index) => <FieldGroup key={row.key} className="rounded-lg border p-4">
      {row.sourceName && <p className="break-words muted">Leído: {row.sourceName}</p>}
      <FormSelect wrapOptions label={`Producto de la imagen ${index + 1}`} value={row.product_id} onChange={value => update(index, { product_id: value })} options={options.map(option => ({ ...option, disabled: rows.some((other, position) => position !== index && other.product_id === option.value) }))} required error={issue(`product:${index}`)} />
      <FormInput label={`Presentación ${index + 1} (opcional)`} value={row.presentation} onChange={value => update(index, { presentation: value })} error={issue(`presentation:${index}`)} help="Por ejemplo: caja de 12 × 1 L. No multiplica la cantidad total." />
      <FieldGroup className="field-grid">
        <FormInput label={`Cantidad total ${index + 1}`} value={row.quantity} type="number" min="0.000001" step="any" onChange={value => update(index, { quantity: value })} required error={issue(`quantity:${index}`)} />
        <FormSelect label={`Unidad total ${index + 1}`} value={row.totalUnit ?? ''} onChange={value => update(index, { totalUnit: value as ImageTotalRow['totalUnit'] })} options={[{ value: 'g', label: 'Gramos (g)' }, { value: 'kg', label: 'Kilogramos (kg)' }, { value: 'ml', label: 'Mililitros (ml)' }, { value: 'L', label: 'Litros (L)' }]} required error={issue(`unit:${index}`)} />
      </FieldGroup>
      <Button type="button" variant="outline" onClick={() => onChange(rows.filter((_, position) => position !== index))}><X data-icon="inline-start" />Quitar renglón {index + 1}</Button>
    </FieldGroup>)}
    <Button type="button" variant="outline" disabled={rows.length >= 40} onClick={() => onChange([...rows, { key: crypto.randomUUID(), product_id: '', sourceName: '', presentation: '', quantity: '', totalUnit: null }])}><Plus data-icon="inline-start" />Agregar producto a los totales</Button>
    {issue('products') && <FieldError>{issue('products')}</FieldError>}
    {!!allocations.length && <div className="table-wrap"><Table>
      <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Total revisado</TableHead><TableHead>Dosis calculada por ha</TableHead><TableHead>Total con esa dosis</TableHead><TableHead>Diferencia por redondeo</TableHead></TableRow></TableHeader>
      <TableBody>{allocations.map(line => <TableRow key={line.key}><TableCell>{products.find(product => product.id === line.product_id)?.name || line.source_name}</TableCell><TableCell>{amount(line.original_total)} {line.unit}</TableCell><TableCell>{line.dose} {line.base_unit}/ha</TableCell><TableCell>{amount(line.reconstructed_total)} {line.unit}</TableCell><TableCell>{amount(line.delta)} {line.unit}</TableCell></TableRow>)}</TableBody>
    </Table></div>}
  </FieldSet>
}

export function ImageSourceDetails({ order }: { order: ApplicationOrder }) {
  const source = order.source_capture
  if (!source) return null
  return <Collapsible><CollapsibleTrigger asChild><Button variant="outline">Cantidades de la imagen al crear</Button></CollapsibleTrigger><CollapsibleContent className="flex flex-col gap-4 pt-4">
    <p>Superficie utilizada al crear: {amount(source.area_ha)} ha. Estos datos conservan el reparto original.</p>
    <div className="table-wrap"><Table><TableHeader><TableRow><TableHead>Producto y presentación</TableHead><TableHead>Cantidad total</TableHead><TableHead>Dosis inicial</TableHead></TableRow></TableHeader><TableBody>
      {source.products.map(line => { const product = order.products.find(item => item.product_id === line.product_id); return <TableRow key={line.product_id}><TableCell>{product?.product_name || line.source_name}<p className="muted break-words">{line.source_name}{line.presentation && ` · ${line.presentation}`}</p></TableCell><TableCell>{amount(line.quantity)} {line.unit}</TableCell><TableCell>{product ? `${amount(product.dose)} ${product.unit}/ha` : 'Consultar indicación original'}</TableCell></TableRow> })}
    </TableBody></Table></div>
  </CollapsibleContent></Collapsible>
}
