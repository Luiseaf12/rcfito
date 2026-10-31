import { CatalogSaveError, type CatalogRepository } from "../catalog-contract"
import { branchSchema, sameBranch, type BranchCommand, type BranchRecord } from "./branch-model"

/** Synthetic data only. Replace this boundary, not the presentation components. */
export function createMockBranchRepository(canWrite = true): CatalogRepository<BranchRecord, BranchCommand> {
  const records: BranchRecord[] = Array.from({ length: 16 }, (_, index) => ({
    id: `demo-${index + 1}`, code: `DEMO${String(index + 1).padStart(2, "0")}`,
    name: `Sucursal de demostración ${String(index + 1).padStart(2, "0")}`,
    status: index % 5 === 0 ? "inactivo" : "activo",
  }))
  return {
    list: async () => records.map(record => ({ ...record })),
    save: async command => {
      if (!canWrite) throw new CatalogSaveError("Tu acceso permite consultar; no guardar.")
      const values = branchSchema.safeParse(command)
      if (!values.success) throw new CatalogSaveError("Revisa los campos de la sucursal.")
      const existing = records.findIndex(record => record.id === command.id)
      if (command.create && existing >= 0) {
        if (sameBranch(records[existing], { ...values.data, id: command.id })) return { ...records[existing] }
        throw new CatalogSaveError("La identidad ya existe; actualiza el listado.")
      }
      if (!command.create && existing < 0) throw new CatalogSaveError("La sucursal ya no está disponible.")
      const saved = { ...values.data, id: command.id }
      if (existing < 0) records.push(saved); else records[existing] = saved
      return { ...saved }
    },
    reconcile: async command => {
      const record = records.find(record => record.id === command.id)
      if (!record && command.create) return null
      if (record && sameBranch(record, command)) return { ...record }
      throw new CatalogSaveError("Cierra la captura y revisa el registro vigente antes de continuar.", "conflict")
    },
  }
}
