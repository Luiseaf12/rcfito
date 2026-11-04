/** Default display order. Never apply to persisted arrays or request signatures. */
const collator = new Intl.Collator('es-MX', { numeric: true, sensitivity: 'base' })

export const compareDisplayText = (left: string, right: string) => collator.compare(left.trim(), right.trim())
export const compareIdentity = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

export function sortDisplay<T>(rows: readonly T[], label: (row: T) => string, identity: (row: T) => string): T[] {
  return [...rows].sort((a, b) => compareDisplayText(label(a), label(b)) || compareIdentity(identity(a), identity(b)))
}

export function compareNamed(left: { id: string; name: string }, right: { id: string; name: string }): number {
  return compareDisplayText(left.name, right.name) || compareIdentity(left.id, right.id)
}

export const sortNamed = <T extends { id: string; name: string }>(rows: readonly T[]): T[] => [...rows].sort(compareNamed)

export type DisplayOption = { value: string; label: string; pinned?: boolean }
export function sortOptions<T extends DisplayOption>(options: readonly T[]): T[] {
  return [...options].sort((a, b) => a.pinned && b.pinned ? 0 : a.pinned ? -1 : b.pinned ? 1
    : compareDisplayText(a.label, b.label) || compareIdentity(a.value, b.value))
}
