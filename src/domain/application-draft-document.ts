import { methodRoute, waterInput } from './application-routes.ts'
import { applicationDraftIssues, type ApplicationDraftForm, type ApplicationDraftIssue, type ApplicationDraftProduct } from './application-draft.ts'
import { applicationGroupOrigin } from './application-groups.ts'
import { validateRecipeSource } from './application-recipes.ts'
import type { ApplicationOrderInput, ApplicationRecipeSource, UserProfile, WorkspaceData } from './model'

export type DraftRecipeDocument = {
  draft_id: string
  generated_at: string
  prepared_by: string
  agricultural_unit: string
  project: string
  season: string
  field: string
  crop: string
  application_route?: import('./model').ApplicationRoute; method: string
  indicated_date: string
  scheduled_date: string
  observations: string
  water_l_ha: number | null
  requested_number: number | null
  selection: string
  source: { folio: string; revision: number } | null
  targets: { stage_id: string; lot_id: string; lot: string; subdivision: string; stage_number: number; variety: string; area_ha: number }[]
  products: { product_id: string; code: string; name: string; dose: number; unit: 'g' | 'ml' }[]
}

export type DraftRecipeDocumentInput = {
  id: string
  profile: UserProfile
  generated_at: string
  form: ApplicationDraftForm
  products: ApplicationDraftProduct[]
  stage_ids: string[]
  source_group_id?: string | null
  recipe_source?: ApplicationRecipeSource
  review: Parameters<typeof applicationDraftIssues>[4]
}

/** Only the missing scheduled date is optional for a review PDF; saving keeps its validation. */
export function draftPdfIssues(form: ApplicationDraftForm, issues: ApplicationDraftIssue[]): ApplicationDraftIssue[] {
  return form.scheduled_date ? issues : issues.filter(issue => issue.field !== 'scheduled_date')
}

/** Snapshot of the editable indication only. It neither creates nor reserves anything. */
export function snapshotDraftRecipe(data: WorkspaceData, input: DraftRecipeDocumentInput): DraftRecipeDocument {
  if (input.profile.role !== 'admin') throw new Error('Solo la administración prepara borradores de indicaciones.')
  const issues = draftPdfIssues(input.form, applicationDraftIssues(data, input.form, input.products, input.stage_ids, input.review))
  if (issues.length) throw new Error(issues.map(issue => issue.message).join('\n'))
  if (!input.id || !Number.isFinite(Date.parse(input.generated_at))) throw new Error('No se pudo identificar la versión del borrador.')
  const record: ApplicationOrderInput = {
    ...input.form, id: input.id, stage_ids: [...input.stage_ids], source_group_id: input.source_group_id,
    recipe_source: input.recipe_source, water_l_ha: waterInput(input.form.water_l_ha),
    application_number: input.form.application_number.trim() ? Number(input.form.application_number) : undefined,
    products: input.products.map(row => ({ product_id: row.product_id, dose: Number(row.dose) })),
  }
  const origin = applicationGroupOrigin(data, record)
  validateRecipeSource(data, record)
  const project = data.projects.find(item => item.id === input.form.project_id)!
  const name = (kind: keyof WorkspaceData['catalogs'], id: string) => data.catalogs[kind].find(item => item.id === id)?.name ?? 'Sin referencia'
  const source = input.recipe_source ? data.applicationOrders.find(item => item.id === input.recipe_source!.order_id)! : null
  const targets = input.stage_ids.map(id => {
    const stage = data.stages.find(item => item.id === id)!
    const subdivision = data.subdivisions.find(item => item.id === stage.subdivision_id)!
    const lot = data.lots.find(item => item.id === subdivision.lot_id)!
    return { stage_id: id, lot_id: lot.id, lot: lot.name, subdivision: subdivision.name, stage_number: stage.stage_number, variety: stage.variety_name_snapshot || name('varieties', stage.variety_id), area_ha: stage.area_ha }
  }).sort((a, b) => a.lot.localeCompare(b.lot, 'es', { numeric: true }) || a.subdivision.localeCompare(b.subdivision, 'es', { numeric: true }) || a.stage_number - b.stage_number || a.stage_id.localeCompare(b.stage_id))
  return {
    draft_id: input.id, generated_at: new Date(input.generated_at).toISOString(), prepared_by: input.profile.full_name,
    agricultural_unit: name('agricultural_units', project.agricultural_unit_id), project: project.name, season: project.season,
    field: name('fields', input.form.field_id), crop: name('crops', input.form.crop_id), application_route: methodRoute(data, input.form.method_id), method: name('application_methods', input.form.method_id),
    indicated_date: input.form.indicated_date, scheduled_date: input.form.scheduled_date, observations: input.form.observations,
    water_l_ha: record.water_l_ha, requested_number: record.application_number ?? null,
    selection: origin.selection_origin === 'group' ? `Grupo: ${origin.source_group_name}` : origin.selection_origin === 'individual' ? 'Un lote' : 'Selección manual',
    source: source ? { folio: source.folio, revision: input.recipe_source!.revision } : null,
    targets,
    products: record.products.map(row => {
      const product = data.catalogs.products.find(item => item.id === row.product_id)!
      return { product_id: product.id, code: product.code ?? '', name: product.name, dose: row.dose, unit: product.unit as 'g' | 'ml' }
    }),
  }
}

/** A changed recipe gets a different visible reference, even before persistence. */
export async function draftRecipeReference(snapshot: DraftRecipeDocument): Promise<{ reference: string; hash: string }> {
  const { generated_at: _generatedAt, ...content } = snapshot
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const id = snapshot.draft_id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'RECETA'
  return { reference: `BR-${id}-${hash.slice(0, 12).toUpperCase()}`, hash }
}
