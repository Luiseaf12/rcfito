import { CatalogSaveError, type CatalogRepository } from "../catalog-contract"
import { branchSchema, sameBranch, type BranchCommand, type BranchRecord } from "../examples/branch-model"

export interface BranchDataSource {
  getBranchesForCatalog: () => Promise<BranchRecord[]>
  getBranchCatalogRecord: (id: string) => Promise<BranchRecord | null>
  saveBranchCatalog: (record: BranchRecord, create: boolean) => Promise<BranchRecord>
}

/** Inject the local data layer. This module never imports a database client. */
export function createBranchRepository(source: BranchDataSource, canWrite: () => boolean): CatalogRepository<BranchRecord, BranchCommand> {
  const reconcile = async (command: BranchCommand) => {
    const record = await source.getBranchCatalogRecord(command.id)
    if (!record && command.create) return null
    if (record && sameBranch(record, command)) return record
    throw new CatalogSaveError("Los datos actuales son diferentes o el registro ya no está disponible. Cierra la captura y revisa el listado actualizado.", "conflict")
  }
  return {
    list: () => source.getBranchesForCatalog(),
    reconcile,
    save: async command => {
      if (!canWrite()) throw new CatalogSaveError("Tu acceso permite consultar; no guardar.")
      const parsed = branchSchema.safeParse(command)
      if (!parsed.success || !command.id) throw new CatalogSaveError("Revisa los campos de la sucursal.")
      const record = { ...parsed.data, id: command.id }
      try {
        const saved = await source.saveBranchCatalog(record, command.create)
        if (!sameBranch(saved, record)) throw new CatalogSaveError("No se confirmó el registro esperado.", "unknown")
        return saved
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
        if (/^[0-9A-Z]{5}$/.test(code) && code !== "23505") {
          throw new CatalogSaveError("No se pudo guardar la sucursal. Revisa tu acceso y vuelve a intentar.")
        }
        // A lost response or repeat of a confirmed UUID is reconciled by read.
        try {
          const persisted = await reconcile({ ...command, ...parsed.data })
          if (persisted) return persisted
          throw new CatalogSaveError("No se creó la sucursal. Puedes volver a guardar.")
        } catch (reconciliationError) {
          if (reconciliationError instanceof CatalogSaveError) throw reconciliationError
          throw new CatalogSaveError("No pudimos confirmar el guardado.", "unknown")
        }
      }
    },
  }
}
