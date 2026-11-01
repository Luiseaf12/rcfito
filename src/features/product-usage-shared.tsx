import { useState } from 'react'
import { reportNumber as number } from '@/lib/report-format'
import type { ProductUsageSummary } from '@/domain/product-usage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, RecordDialog } from './shared'

export const PAGE_SIZE = 10
const historyStatusLabels = { indicated: 'Indicada', performed: 'Realizada', cancelled: 'Cancelada' }
export { number }
export const quantity = (value: number, unit: 'g' | 'ml') => `${number.format(value / 1000)} ${unit === 'ml' ? 'L' : 'kg'}`
export const dose = (value: number, unit: 'g' | 'ml') => `${number.format(value)} ${unit}/ha`

export function PageControls({ page, count, onPage, label }: { page: number; count: number; onPage: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  return <nav className="usage-pagination" aria-label={label}>
    <span className="muted">Página {page} de {pages} · {count} registros</span>
    <div className="section-actions">
      <Button variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>Anterior</Button>
      <Button variant="outline" disabled={page === pages} onClick={() => onPage(page + 1)}>Siguiente</Button>
    </div>
  </nav>
}

export function ProductHistory({ product, onClose, context }: { product: ProductUsageSummary; onClose: () => void; context?: string }) {
  const [requestedPage, setPage] = useState(1)
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(product.history.length / PAGE_SIZE)))
  const rows = product.history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  return <RecordDialog wide title={`Historial de ${product.name}${context ? ` · ${context}` : ''}`} description={context ? `Solo aplicaciones de ${context}, con los filtros del dashboard. Más recientes primero.` : 'Aplicaciones guardadas con los mismos filtros del dashboard, incluidas las temporadas anteriores. Más recientes primero.'} open onOpenChange={open => { if (!open) onClose() }}>
    <dl className="usage-history-summary">
      <div><dt>Aplicaciones</dt><dd>{product.applicationCount}</dd></div>
      <div><dt>Cantidad calculada</dt><dd>{quantity(product.totalQuantity, product.unit)}</dd></div>
      <div><dt>Dosis promedio ponderada</dt><dd>{dose(product.averageDose, product.unit)}</dd></div>
    </dl>
    <Table>
      <TableCaption>Realizadas: datos y fecha reales. Indicadas y canceladas: datos y fecha de su indicación histórica. Cantidad calculada = dosis × superficie.</TableCaption>
      <TableHeader><TableRow><TableHead>Fecha del registro</TableHead><TableHead>Estado</TableHead><TableHead>Destino</TableHead><TableHead>Superficie</TableHead><TableHead>Dosis</TableHead><TableHead>Cantidad calculada</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.targetId}>
        <TableCell>{formatDate(row.recordDate)}<div className="record-secondary muted">{row.folio}</div><div className="record-secondary muted">{row.source === 'actual' ? 'Realización' : 'Indicación'}</div></TableCell><TableCell><Badge variant="secondary">{historyStatusLabels[row.status]}</Badge></TableCell>
        <TableCell><span className="record-name">{row.lotName} · {row.subdivisionName}</span><div className="record-secondary muted">Etapa {row.stageNumber} · {row.cropName}</div><div className="record-secondary muted">{row.agriculturalUnitName} · {row.fieldName}</div><div className="record-secondary muted">{row.projectName} · {row.season}</div></TableCell>
        <TableCell className="numeric">{number.format(row.areaHa)} ha</TableCell><TableCell className="numeric">{dose(row.dose, product.unit)}</TableCell><TableCell className="numeric">{quantity(row.quantity, product.unit)}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
    {product.history.length > PAGE_SIZE && <PageControls page={page} count={product.history.length} onPage={setPage} label="Páginas del historial del producto" />}
    <div className="section-actions"><Button variant="outline" onClick={onClose}>Cerrar historial</Button></div>
  </RecordDialog>
}
