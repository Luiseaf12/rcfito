import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CatalogSelect } from "../components/catalog-select"
import { branchSchema, type BranchValues } from "./branch-model"

const statusOptions = [{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }]

export function BranchForm({ initialValues, editing, busy, error, needsReconciliation, needsReview, portalContainer,
  onSubmit, onClose, onDirtyChange, onReconcile }: {
  initialValues: BranchValues; editing: boolean; busy: boolean; error: string; needsReconciliation: boolean; needsReview: boolean
  portalContainer?: HTMLElement; onSubmit: (values: BranchValues) => Promise<void>; onClose: () => void
  onDirtyChange: (dirty: boolean) => void; onReconcile: () => Promise<void>
}) {
  const form = useForm<BranchValues>({ resolver: zodResolver(branchSchema), defaultValues: initialValues })
  const { errors, isDirty } = form.formState
  useEffect(() => { onDirtyChange(isDirty) }, [isDirty, onDirtyChange])
  const blocked = busy || needsReconciliation || needsReview
  return <form id="branch-catalog-form" onSubmit={form.handleSubmit(onSubmit)}>
    <FieldGroup>
      <Field data-invalid={Boolean(errors.code)}>
        <FieldLabel htmlFor="catalog-code">Código</FieldLabel>
        <Input id="catalog-code" {...form.register("code")} required maxLength={50} autoComplete="off"
          disabled={blocked} aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? "catalog-code-error" : undefined} />
        {errors.code ? <FieldError id="catalog-code-error" errors={[errors.code]} /> : null}
      </Field>
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="catalog-name">Nombre de Sucursal</FieldLabel>
        <Input id="catalog-name" {...form.register("name")} required maxLength={150} autoComplete="organization"
          disabled={blocked} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "catalog-name-error" : undefined} />
        {errors.name ? <FieldError id="catalog-name-error" errors={[errors.name]} /> : null}
      </Field>
      <Controller name="status" control={form.control} render={({ field, fieldState }) =>
        <CatalogSelect id="catalog-status" name={field.name} label="Estado" options={statusOptions}
          value={field.value} onChange={field.onChange} onBlur={field.onBlur} portalContainer={portalContainer} disabled={blocked}
          required invalid={fieldState.invalid} />
      } />
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="catalog-form-actions tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy || needsReconciliation}>{needsReview ? "Cerrar y revisar listado" : "Cancelar"}</Button>
        {needsReview ? null : needsReconciliation ? <Button key="reconcile" type="button" onClick={event => { event.preventDefault(); void onReconcile() }} disabled={busy}>
          {busy ? "Comprobando…" : "Comprobar guardado"}
        </Button> : <Button key="save" type="submit" disabled={busy}>
          {busy ? "Guardando…" : editing ? "Guardar Cambios" : "Guardar Registro"}
        </Button>}
      </div>
      {busy || needsReconciliation ? <p role="status">{needsReconciliation ? "La captura se conserva hasta confirmar el resultado." : "Espera mientras se confirma el guardado."}</p> : null}
    </FieldGroup>
  </form>
}
