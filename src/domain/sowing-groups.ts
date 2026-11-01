// A variety filter changes only the visible candidates, never the saved membership.
export function updateVisibleGroupMembers(selected: readonly string[], visibleIds: readonly string[], nextVisible: readonly string[]): string[] {
  const visible = new Set(visibleIds)
  return [...new Set([...selected.filter(id => !visible.has(id)), ...nextVisible.filter(id => visible.has(id))])]
}
