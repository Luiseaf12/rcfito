/** Pure boundary contracts: services can import these without React or query hooks. */
export class CatalogSaveError extends Error {
  constructor(message: string, public readonly outcome: "rejected" | "unknown" | "conflict" = "rejected") {
    super(message)
    this.name = "CatalogSaveError"
  }
}
export interface CatalogRepository<TRecord, TInput> {
  list: () => Promise<TRecord[]>
  save: (input: TInput) => Promise<TRecord>
  // Only read: confirm persisted values or establish that creation did not occur.
  reconcile: (input: TInput) => Promise<TRecord | null>
}
