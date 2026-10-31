import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusIcon } from "lucide-react"
import { CatalogPage } from "../components/catalog-page"
import { CatalogToolbar } from "../components/catalog-toolbar"
import { CatalogFeedback } from "../components/catalog-feedback"
import { DataTable } from "../components/data-table"
import { RecordDialog } from "../components/record-dialog"
import { RecordDetails } from "../components/record-details"
import { useCatalog } from "../use-catalog"
import { type CatalogRepository } from "../catalog-contract"
import { BranchForm } from "./branch-form"
import { normalizeSearch, type BranchCommand, type BranchRecord, type BranchValues } from "./branch-model"

export type BranchCatalogHandle = { open: (mode: "create" | "edit" | "view", id?: string) => void }
type Selection = { mode: "create" | "edit" | "view"; record: BranchRecord; session: number } | null
const labels = { code: "Código", name: "Nombre de Sucursal", status: "Estado", actions: "Acciones" }
const localeSort = (left: { getValue: (id: string) => unknown }, right: { getValue: (id: string) => unknown }, id: string) =>
  String(left.getValue(id) ?? "").localeCompare(String(right.getValue(id) ?? ""), "es-MX")

export const BranchCatalog = forwardRef<BranchCatalogHandle, {
  repository: CatalogRepository<BranchRecord, BranchCommand>; canWrite: boolean; scope: string
  portalContainer: HTMLElement; confirmDiscard: () => boolean
}>(function BranchCatalog({ repository, canWrite, scope, portalContainer, confirmDiscard }, ref) {
  const catalog = useCatalog(repository, scope)
  const [query, setQuery] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [selection, setSelection] = useState<Selection>(null)
  const [dirty, setDirty] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
  const session = useRef(0)
  const search = useRef<HTMLDivElement>(null)
  const open = (mode: "create" | "edit" | "view", id?: string) => {
    if (catalog.busy || catalog.needsReconciliation || catalog.needsReview || (mode !== "view" && !canWrite)) return
    if (dirty && !confirmDiscard()) return
    const record = mode === "create" ? { id: crypto.randomUUID(), code: "", name: "", status: "activo" as const }
      : catalog.records.find(item => item.id === id)
    if (!record) return
    if (!selection) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDirty(false)
    catalog.clearSaveError()
    setSelection({ mode, record, session: ++session.current })
  }
  useImperativeHandle(ref, () => ({ open }))
  const close = () => {
    if (catalog.busy || catalog.needsReconciliation || (!catalog.needsReview && dirty && !confirmDiscard())) return
    setDirty(false)
    setSelection(null)
    catalog.clearSaveError()
  }
  const columns = useMemo<ColumnDef<BranchRecord>[]>(() => [
    { accessorKey: "code", header: labels.code, sortingFn: localeSort, sortUndefined: "last" },
    { accessorKey: "name", header: labels.name, sortingFn: localeSort, sortUndefined: "last" },
    { accessorKey: "status", header: labels.status, sortingFn: localeSort,
      cell: ({ row }) => <Badge variant={row.original.status === "activo" ? "success" : "destructive"}>
        {row.original.status === "activo" ? "Activo" : "Inactivo"}</Badge> },
    { id: "actions", header: labels.actions, enableSorting: false, enableGlobalFilter: false,
      cell: ({ row }) => <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="button" variant="secondary" onClick={() => open("view", row.original.id)} aria-label={`Ver ${row.original.name}`}>Ver</Button>
        {canWrite ? <Button type="button" variant="secondary" onClick={() => open("edit", row.original.id)} aria-label={`Editar ${row.original.name}`}>Editar</Button> : null}
      </div> },
  // Actions need current open handler; use React state through the handler above.
  ], [canWrite, catalog.records, catalog.busy, catalog.needsReconciliation, catalog.needsReview, dirty, selection, confirmDiscard])
  const table = useReactTable({
    data: catalog.records, columns, getRowId: row => row.id,
    state: { globalFilter: query, sorting, pagination },
    onSortingChange: setSorting, onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false, enableSortingRemoval: false,
    globalFilterFn: (row, _columnId, value: string) => normalizeSearch(`${row.original.code} ${row.original.name} ${row.original.status}`).includes(normalizeSearch(value)),
  })
  const changeQuery = (value: string) => { setQuery(value); setPagination(previous => ({ ...previous, pageIndex: 0 })) }
  const count = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount()
  useEffect(() => {
    setPagination(previous => {
      const pageIndex = Math.min(previous.pageIndex, Math.max(0, pageCount - 1))
      return pageIndex === previous.pageIndex ? previous : { ...previous, pageIndex }
    })
  }, [pageCount])
  const detail = selection?.mode === "view" ? catalog.records.find(record => record.id === selection.record.id) ?? selection.record : null
  const onSaved = () => { setDirty(false); setSelection(null) }
  const submit = async (values: BranchValues) => {
    if (!selection || selection.mode === "view") return
    await catalog.save({ ...values, id: selection.record.id, create: selection.mode === "create" }, onSaved)
  }
  const feedback = catalog.feedback || (catalog.updating ? "Actualizando listado…" : "")
  return <CatalogPage id="branch" headingLevel={2} title="Catálogo de Sucursales" busy={catalog.updating}
    action={canWrite ? <Button type="button" onClick={() => open("create")} disabled={catalog.loading || catalog.loadError}>
      <PlusIcon data-icon="inline-start" aria-hidden="true" />Agregar Sucursal</Button> : undefined}
    toolbar={<div ref={search}><CatalogToolbar id="catalog-search-branch" clearButtonId="catalog-search-clear-branch" query={query} onQueryChange={changeQuery}
      onClear={() => { changeQuery(""); search.current?.querySelector<HTMLInputElement>("input")?.focus() }}
      searchLabel="Buscar sucursales" placeholder="Código, nombre o estado" suggestions={catalog.records.flatMap(record => [record.code, record.name])} /></div>}
    resultsSummary={`${count} de ${catalog.records.length} registros${query ? " coinciden" : ""}`}
    feedback={feedback ? <p role="status">{feedback}</p> : undefined}>
    {catalog.loading ? <CatalogFeedback kind="loading" /> : null}
    {catalog.loadError ? <CatalogFeedback kind="error" message={catalog.records.length ? "No se pudo actualizar el listado. Los datos anteriores siguen visibles." : "No se pudieron cargar las sucursales."} onRetry={() => void catalog.refresh()} /> : null}
    {!catalog.loading ? <>
      <Button type="button" variant="secondary" onClick={() => void catalog.refresh()} disabled={catalog.updating}>Actualizar listado</Button>
      {!catalog.loadError || catalog.records.length ? <DataTable table={table} labelForColumn={labels}
        emptyTitle={query ? "Sin coincidencias" : "Aún no hay registros"}
        noResultsId="catalog-no-results-branch" caption="Sucursales"
        emptyMessage={query ? "No se encontraron sucursales que coincidan con la búsqueda." : "No hay sucursales registradas."} /> : null}
    </> : null}
    <RecordDialog open={Boolean(selection)} title={selection?.mode === "view" ? "Detalle de Sucursal" : selection?.mode === "edit" ? "Editar Sucursal" : "Agregar Sucursal"}
      description={selection?.mode === "view" ? "Datos registrados de la sucursal." : "Captura el código, nombre y estado de la sucursal."}
      busy={catalog.busy || catalog.needsReconciliation} onClose={close} portalContainer={portalContainer}
      contentId="branch-record-dialog" initialFocus={selection?.mode !== "view" ? () => portalContainer.querySelector<HTMLInputElement>("#catalog-code") ?? false : undefined}
      finalFocus={() => trigger.current?.isConnected ? trigger.current : search.current?.querySelector<HTMLInputElement>("input") ?? false}>
      {detail ? <>
        <RecordDetails items={[{ key: "code", label: "Código", value: detail.code }, { key: "name", label: "Nombre de Sucursal", value: detail.name }, { key: "status", label: "Estado", value: <Badge variant={detail.status === "activo" ? "success" : "destructive"}>{detail.status === "activo" ? "Activo" : "Inactivo"}</Badge> }]} />
        <div className="catalog-form-actions tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <Button type="button" variant="secondary" onClick={close}>Cerrar</Button>
          {canWrite ? <Button type="button" onClick={() => open("edit", detail.id)}>Editar Sucursal</Button> : null}
        </div>
      </> : selection ? <BranchForm key={selection.session} initialValues={selection.record}
        editing={selection.mode === "edit"} busy={catalog.busy} error={catalog.saveError} needsReconciliation={catalog.needsReconciliation} needsReview={catalog.needsReview}
        onSubmit={submit} onClose={close} onDirtyChange={setDirty}
        onReconcile={() => catalog.reconcile(onSaved)} /> : null}
    </RecordDialog>
  </CatalogPage>
})
