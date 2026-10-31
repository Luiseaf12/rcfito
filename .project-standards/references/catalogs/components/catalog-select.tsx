import { useRef, useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"

export type CatalogSelectOption = { value: string; label: string }

export type CatalogSelectProps = {
  id: string
  name?: string
  label: string
  options: readonly CatalogSelectOption[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  portalContainer?: ComponentProps<typeof ComboboxContent>["container"]
  required?: boolean
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  /** Explicit valid reset target. Omit for required or non-clearable selectors. */
  clearValue?: string
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim()
}

/** Search text never replaces the selected identifier submitted to the domain. */
export function CatalogSelect({
  id,
  name,
  label,
  options,
  value,
  onChange,
  onBlur,
  portalContainer,
  required = false,
  invalid = false,
  describedBy,
  disabled = false,
  clearValue,
}: CatalogSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState<{ forValue: string; text: string } | null>(null)
  const selected = options.find((option) => option.value === value) ?? null
  const searchText = search?.forValue === value ? search.text : null
  const canClear = !required && clearValue !== undefined && options.some((option) => option.value === clearValue)

  function clearSelection() {
    if (!canClear || clearValue === undefined) return
    onChange(clearValue)
    setSearch(null)
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <Field data-invalid={invalid} data-disabled={disabled} className="tw:min-w-0">
      <FieldLabel htmlFor={`${id}-input`}>{label}</FieldLabel>
      <select
        id={id}
        name={name}
        hidden
        data-shadcn-select
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {!selected ? <option value={value}>Sin selección</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Combobox<CatalogSelectOption>
        items={options}
        value={selected}
        disabled={disabled}
        required={required}
        itemToStringLabel={(option) => option.label}
        itemToStringValue={(option) => option.value}
        isItemEqualToValue={(item, current) => item.value === current.value}
        filter={(option, query) => normalize(option.label).includes(normalize(query))}
        open={open}
        inputValue={searchText ?? selected?.label ?? ""}
        onInputValueChange={(text, details) => {
          if (details.reason === "input-change") setSearch({ forValue: value, text })
        }}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearch(null)
        }}
        onValueChange={(option, details) => {
          if (details.reason === "input-clear" || details.reason === "escape-key") return
          if (option) onChange(option.value)
          setSearch(null)
          setOpen(false)
        }}
      >
        <ComboboxInput
          ref={inputRef}
          id={`${id}-input`}
          disabled={disabled}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onBlur={onBlur}
          triggerLabel={`Mostrar opciones de ${label}`}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            event.preventBaseUIHandler()
            if (open) {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
            }
            setSearch(null)
          }}
        />
        <ComboboxContent container={portalContainer}>
          {canClear && (value !== clearValue || searchText !== null) ? (
            <div className="tw:p-1">
              <Button
                type="button"
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearSelection}
                aria-label={`Limpiar selección y búsqueda de ${label}`}
              >Limpiar selección y búsqueda</Button>
            </div>
          ) : null}
          <ComboboxEmpty>Sin coincidencias</ComboboxEmpty>
          <ComboboxList>
            {(option: CatalogSelectOption) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
