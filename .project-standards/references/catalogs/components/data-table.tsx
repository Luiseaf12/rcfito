import { flexRender, type Column, type RowData, type Table as TableInstance } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type DataTableProps<T extends RowData> = {
  table: TableInstance<T>
  labelForColumn: Readonly<Record<string, string>>
  caption: string
  noResultsId?: string
  emptyTitle?: string
  emptyMessage?: string
  busy?: boolean
}

function toggleSort<T extends RowData>(column: Column<T>) {
  column.toggleSorting(column.getIsSorted() === "asc")
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUpIcon data-icon="inline-end" aria-hidden="true" />
  if (direction === "desc") return <ArrowDownIcon data-icon="inline-end" aria-hidden="true" />
  return <ArrowUpDownIcon data-icon="inline-end" aria-hidden="true" />
}

function sortLabel(label: string, direction: false | "asc" | "desc") {
  const current = direction === "asc" ? "ascendente" : direction === "desc" ? "descendente" : "sin orden"
  const next = direction === "asc" ? "descendente" : "ascendente"
  return `${label}: ${current}. Ordenar ${next}`
}

/** The caller configures row identity, sorting, pagination and local/server mode. */
export function DataTable<T extends RowData>({
  table,
  labelForColumn,
  caption,
  noResultsId,
  emptyTitle = "Sin coincidencias",
  emptyMessage = "Ajusta la búsqueda o limpia los filtros para ver más registros.",
  busy = false,
}: DataTableProps<T>) {
  const rows = table.getRowModel().rows
  const sortableColumns = table.getVisibleLeafColumns().filter((column) => column.getCanSort())
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const visibleColumnCount = Math.max(1, table.getVisibleLeafColumns().length)

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4" aria-busy={busy}>
      <div className="catalog-sort-mobile tw:flex tw:flex-wrap tw:gap-2" role="group" aria-label="Orden del catálogo">
        {sortableColumns.map((column) => {
          const label = labelForColumn[column.id] ?? column.id
          const direction = column.getIsSorted()
          return (
            <Button key={column.id} type="button" variant="outline" onClick={() => toggleSort(column)} aria-label={sortLabel(label, direction)}>
              {label}<SortIcon direction={direction} />
            </Button>
          )
        })}
      </div>
      <Table className="catalog-table">
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const column = header.column
                const direction = column.getIsSorted()
                const sortable = !header.isPlaceholder && column.getCanSort()
                const label = labelForColumn[column.id] ?? column.id
                return (
                  <TableHead key={header.id} colSpan={header.colSpan} scope={header.colSpan > 1 ? "colgroup" : "col"} aria-sort={sortable ? direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none" : undefined}>
                    {header.isPlaceholder ? null : sortable ? (
                      <Button type="button" variant="ghost" onClick={() => toggleSort(column)} aria-label={sortLabel(label, direction)}>
                        {flexRender(column.columnDef.header, header.getContext())}<SortIcon direction={direction} />
                      </Button>
                    ) : flexRender(column.columnDef.header, header.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row) => (
            <TableRow key={row.id} data-catalog-row={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} data-label={labelForColumn[cell.column.id] ?? cell.column.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          )) : null}
            <TableRow id={noResultsId} hidden={rows.length > 0}>
              <TableCell colSpan={visibleColumnCount}>
                <Empty role="status">
                  <EmptyHeader>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyMessage}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
        </TableBody>
      </Table>
      <nav aria-label="Paginación del catálogo" className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
        <span>{pageCount < 0 ? `Página ${pageIndex + 1}` : `Página ${pageCount > 0 ? pageIndex + 1 : 0} de ${pageCount}`}</span>
        <Button type="button" variant="outline" disabled={busy || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>Anterior</Button>
        <Button type="button" variant="outline" disabled={busy || !table.getCanNextPage()} onClick={() => table.nextPage()}>Siguiente</Button>
      </nav>
    </div>
  )
}
