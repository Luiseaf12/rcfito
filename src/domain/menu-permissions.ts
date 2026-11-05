import { catalogKinds, type CatalogKind, type UserProfile } from './model'

export type MenuKey = 'summary' | 'projects' | 'applications' | 'queries' | 'ai_capture' | 'groups' | 'users' | 'connection' | `catalog:${CatalogKind}`
const catalogNames: Record<CatalogKind, string> = { agricultural_units: 'Agrícolas', fields: 'Campos', crops: 'Cultivos', varieties: 'Variedades', products: 'Productos', active_ingredients: 'Ingredientes activos', ingredient_classifications: 'Usos de ingredientes', brands: 'Marcas', product_families: 'Familias de productos', infrastructure_types: 'Infraestructura', application_methods: 'Medios de aplicación' }
export const menuDefinitions: { key: MenuKey; label: string; path: string; group: 'workspace' | 'catalogs' | 'administration'; adminOnly?: boolean }[] = [
  { key: 'summary', label: 'Resumen', path: '/', group: 'workspace' },
  { key: 'projects', label: 'Proyectos de siembra', path: '/proyectos', group: 'workspace' },
  { key: 'applications', label: 'Aplicaciones', path: '/aplicaciones', group: 'workspace' },
  { key: 'queries', label: 'Consultas', path: '/consultas', group: 'workspace' },
  { key: 'ai_capture', label: 'Captura con IA', path: '/captura-ia', group: 'workspace', adminOnly: true },
  { key: 'groups', label: 'Grupos de siembra', path: '/grupos-siembra', group: 'workspace' },
  ...catalogKinds.map(kind => ({ key: `catalog:${kind}` as MenuKey, label: catalogNames[kind], path: `/catalogos/${kind}`, group: 'catalogs' as const })),
  { key: 'users', label: 'Usuarios y accesos', path: '/usuarios', group: 'administration', adminOnly: true },
  { key: 'connection', label: 'Conexión y preferencias', path: '/conexion', group: 'administration', adminOnly: true },
]
export const readerMenus = menuDefinitions.filter(menu => !menu.adminOnly).map(menu => menu.key)
export const menuTemplates = [
  { key: 'reports', label: 'Consulta de reportes', menus: ['summary', 'applications', 'queries'] as MenuKey[] },
  { key: 'field', label: 'Consulta de campo', menus: ['projects', 'applications', 'groups', 'queries'] as MenuKey[] },
  { key: 'all', label: 'Consulta completa', menus: readerMenus },
  { key: 'none', label: 'Sin secciones', menus: [] as MenuKey[] },
]
export function normalizeMenus(value: unknown): MenuKey[] {
  if (!Array.isArray(value)) return []
  return readerMenus.filter(key => value.includes(key))
}
export function effectiveMenus(profile: UserProfile): MenuKey[] {
  if (profile.active === false) return []
  return profile.role === 'admin' ? menuDefinitions.map(menu => menu.key) : profile.menu_permissions === undefined ? readerMenus : normalizeMenus(profile.menu_permissions)
}
export function canViewMenu(profile: UserProfile, key: MenuKey): boolean { return effectiveMenus(profile).includes(key) }
export function menuForPath(path: string) { return menuDefinitions.find(menu => menu.path === path || menu.path !== '/' && path.startsWith(`${menu.path}/`)) }
export function firstAllowedPath(profile: UserProfile): string | null { return menuDefinitions.find(menu => canViewMenu(profile, menu.key))?.path ?? null }
export function hasScopedData(profile: UserProfile): boolean { return (['summary', 'projects', 'applications', 'queries', 'groups'] as MenuKey[]).some(key => canViewMenu(profile, key)) }
export function hasApplicationData(profile: UserProfile): boolean { return (['summary', 'applications', 'queries'] as MenuKey[]).some(key => canViewMenu(profile, key)) }
