import { type ReactNode } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export type CatalogToolbarProps = {
  id: string
  clearButtonId?: string
  query: string
  onQueryChange: (query: string) => void
  onClear: () => void
  searchLabel?: string
  placeholder?: string
  suggestions?: readonly string[]
  children?: ReactNode
}

/** Accepts the raw query; normalization/filtering belongs to the controller. */
export function CatalogToolbar({
  id,
  clearButtonId,
  query,
  onQueryChange,
  onClear,
  searchLabel = "Buscar",
  placeholder = "Escribe para buscar",
  suggestions,
  children,
}: CatalogToolbarProps) {
  const suggestionsId = `${id}-suggestions`

  return (
    <div role="search" aria-label="Búsqueda y filtros del catálogo" className="catalog-toolbar tw:flex tw:flex-col tw:gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={id}>{searchLabel}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={id}
              type="search"
              autoComplete="off"
              value={query}
              placeholder={placeholder}
              list={suggestions?.length ? suggestionsId : undefined}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
          </InputGroup>
          {suggestions?.length ? (
            <datalist id={suggestionsId}>
              {[...new Set(suggestions)].map((value) => <option key={value} value={value} />)}
            </datalist>
          ) : null}
        </Field>
        {children}
      </FieldGroup>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button id={clearButtonId} type="button" variant="outline" onClick={onClear}>Limpiar búsqueda y filtros</Button>
      </div>
    </div>
  )
}
