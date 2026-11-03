import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { History, Package, X } from 'lucide-react'
import { buildLotUsage, type LotUsageSummary } from '@/domain/lot-usage'
import type { ProductUsageFilters } from '@/domain/product-usage'
import type { WorkspaceData } from '@/domain/model'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, formatDate } from './shared'
import { PAGE_SIZE, number, quantity, dose, PageControls, ProductHistory } from './product-usage-shared'

function LotProducts({ lot, id, onClose }: { lot: LotUsageSummary; id: string; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const [requestedPage, setPage] = useState(1)
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(lot.products.length / PAGE_SIZE)))
  const products = lot.products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedProduct = lot.products.find(product => product.key === selectedProductKey)
  const context = `${lot.name} · ${lot.season} · ${lot.fieldName}`

  return <Card id={id} role="region" aria-labelledby={titleId}>
    <CardHeader><div className="section-header"><div>
      <CardTitle><h3 id={titleId} ref={heading} tabIndex={-1}>Productos de {lot.name}</h3></CardTitle>
      <CardDescription>{lot.agriculturalUnitName} · {lot.fieldName} · {lot.projectName} · {lot.season}</CardDescription>
    </div><Button variant="outline" onClick={onClose}><X data-icon="inline-start" />Cerrar productos del lote</Button></div></CardHeader>
    <CardContent>
      <p className="usage-lot-note">{lot.applicationCount} aplicaciones por destino · Productos de mayor a menor cantidad, sin separar líquidos y sólidos.</p>
      <Table className="usage-lot-products-table">
        <TableCaption>Cantidad registrada calculada con dosis × superficie. Cada fila conserva su unidad. El historial se limita a este lote y a los filtros seleccionados.</TableCaption>
        <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Aplicaciones</TableHead><TableHead aria-sort="descending">Cantidad calculada ↓</TableHead><TableHead>Dosis promedio</TableHead><TableHead>Última fecha</TableHead><TableHead><span className="sr-only">Historial</span></TableHead></TableRow></TableHeader>
        <TableBody>{products.map(product => <TableRow key={product.key}>
          <TableCell><span className="record-name">{product.name}</span><div className="record-secondary muted">{product.unit} · {product.destinationCount} {product.destinationCount === 1 ? 'etapa distinta' : 'etapas distintas'}</div></TableCell>
          <TableCell className="usage-numeric">{product.applicationCount}</TableCell>
          <TableCell className="usage-numeric">{quantity(product.totalQuantity, product.unit)}</TableCell>
          <TableCell className="usage-numeric">{dose(product.averageDose, product.unit)}</TableCell>
          <TableCell>{formatDate(product.lastRecordedDate)}</TableCell>
          <TableCell><Button variant="outline" onClick={() => setSelectedProductKey(product.key)} aria-label={`Ver historial de ${product.name} en ${lot.name}, unidad ${product.unit}`}><History data-icon="inline-start" />Ver historial</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      {lot.products.length > PAGE_SIZE && <PageControls page={page} count={lot.products.length} onPage={setPage} label="Páginas de productos del lote" />}
    </CardContent>
    {selectedProduct && <ProductHistory key={selectedProduct.key} product={selectedProduct} context={context} onClose={() => setSelectedProductKey(null)} />}
  </Card>
}

export function LotUsagePanel({ data, agriculturalUnitId, lotId, cropId, stageNumber, status }: { data: WorkspaceData } & ProductUsageFilters) {
  const result = useMemo(() => buildLotUsage(data, { agriculturalUnitId, lotId, cropId, stageNumber, status }), [data, agriculturalUnitId, lotId, cropId, stageNumber, status])
  const [requestedPage, setPage] = useState(1)
  const [selectedLotKey, setSelectedLotKey] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const sectionId = useId()
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(result.lots.length / PAGE_SIZE)))
  const lots = result.lots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedLot = result.lots.find(lot => lot.key === selectedLotKey)
  function closeProducts() {
    setSelectedLotKey(null)
    requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); else heading.current?.focus() })
  }

  return <section className="usage-lots-section" aria-label="Resumen por lote">
    <Card><CardHeader><CardTitle><h2 ref={heading} tabIndex={-1}>Resumen por lote</h2></CardTitle><CardDescription>Aplicaciones por destino y productos de cada lote, con los mismos filtros. Cada temporada conserva sus lotes.</CardDescription></CardHeader><CardContent>
      {result.incompleteCount > 0 && <Alert><AlertTitle>Registros fuera del resumen por lote</AlertTitle><AlertDescription>{result.incompleteCount} destinos tienen datos o relaciones incompletas. Revisa sus registros en Aplicaciones y Proyectos.</AlertDescription></Alert>}
      {!result.lots.length ? <EmptyState title="Sin lotes con aplicaciones en esta selección" description="Cambia o limpia los filtros. Solo aparecen lotes con registros guardados dentro de tu ámbito de consulta." /> : <>
        <Table className="usage-lot-table">
          <TableCaption>Aplicaciones por destino: una mezcla cuenta una vez por subdivisión/etapa. La superficie es la configurada del lote, sin multiplicarla por aplicaciones ni productos.</TableCaption>
          <TableHeader><TableRow><TableHead>Lote y campo</TableHead><TableHead>Temporada</TableHead><TableHead>Superficie</TableHead><TableHead>Aplicaciones</TableHead><TableHead>Productos</TableHead><TableHead>Última fecha</TableHead><TableHead><span className="sr-only">Productos del lote</span></TableHead></TableRow></TableHeader>
          <TableBody>{lots.map(lot => <TableRow key={lot.key} data-state={selectedLotKey === lot.key ? 'selected' : undefined}>
            <TableCell><span className="record-name">{lot.name}</span><div className="record-secondary muted">{lot.agriculturalUnitName} · {lot.fieldName}</div></TableCell>
            <TableCell>{lot.season}<div className="record-secondary muted">{lot.projectName}</div></TableCell>
            <TableCell className="usage-numeric">{number.format(lot.areaHa)} ha</TableCell>
            <TableCell className="usage-numeric">{lot.applicationCount}</TableCell>
            <TableCell className="usage-numeric">{lot.productCount}</TableCell>
            <TableCell>{formatDate(lot.lastRecordedDate)}</TableCell>
            <TableCell><Button variant="outline" aria-label={`Ver productos de ${lot.name}, ${lot.fieldName}, ${lot.season}`} aria-expanded={selectedLotKey === lot.key} aria-controls={sectionId} onClick={event => { opener.current = event.currentTarget; setSelectedLotKey(lot.key) }}><Package data-icon="inline-start" />Ver productos</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {result.lots.length > PAGE_SIZE && <PageControls page={page} count={result.lots.length} onPage={page => { setPage(page); setSelectedLotKey(null) }} label="Páginas del resumen por lote" />}
      </>}
    </CardContent></Card>
    {selectedLot && <LotProducts key={selectedLot.key} lot={selectedLot} id={sectionId} onClose={closeProducts} />}
  </section>
}
