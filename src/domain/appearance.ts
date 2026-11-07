export const appearanceChoices = ['system', 'light', 'dark'] as const
export type Appearance = typeof appearanceChoices[number]
export function isAppearance(value: unknown): value is Appearance { return appearanceChoices.includes(value as Appearance) }
export function readAppearance(value: unknown): Appearance { return isAppearance(value) ? value : 'system' }
export function resolvedAppearance(value: Appearance, systemDark: boolean): 'light' | 'dark' { return value === 'system' ? systemDark ? 'dark' : 'light' : value }
