import type { ApplicationRoute, ApplicationTarget, WorkspaceData } from './model'

/** Missing values occur only in legacy browser demos; their history is Foliar. */
export const applicationRoute = (value?: { application_route?: ApplicationRoute }): ApplicationRoute => value?.application_route ?? 'foliar'
export const routeLabel = (route: ApplicationRoute) => route === 'irrigation' ? 'Riego' : 'Foliar'
export const methodRoute = (data: Pick<WorkspaceData, 'catalogs'>, methodId: string) => applicationRoute(data.catalogs.application_methods.find(method => method.id === methodId))
export const targetRoute = (data: Pick<WorkspaceData, 'applicationOrders'>, target: ApplicationTarget) => target.application_route ?? applicationRoute(data.applicationOrders.find(order => order.id === target.order_id))
export const waterInput = (value: string): number | null => value.trim() ? Number(value) : null
export const waterText = (value: number | null | undefined): string => value == null ? '' : String(value)

export function validateApplicationWater(value: number | null | undefined, route: ApplicationRoute): void {
  if (value == null && route === 'irrigation') return
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error('El gasto de agua debe ser mayor que cero; solo es opcional en riego.')
}
