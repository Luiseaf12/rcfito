import { z } from "zod"

export const branchSchema = z.object({
  code: z.string().trim().min(1, "Captura el código.").max(50, "El código admite hasta 50 caracteres."),
  name: z.string().trim().min(1, "Captura el nombre.").max(150, "El nombre admite hasta 150 caracteres."),
  status: z.enum(["activo", "inactivo"]),
})
export type BranchValues = z.infer<typeof branchSchema>
export type BranchRecord = BranchValues & { id: string }
export type BranchCommand = BranchRecord & { create: boolean }
export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim()
}

export function sameBranch(left: BranchRecord, right: BranchRecord) {
  return left.id === right.id && left.code === right.code && left.name === right.name && left.status === right.status
}
