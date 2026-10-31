export type CatalogKind = 'agricultural_units' | 'fields' | 'crops' | 'varieties' | 'products' | 'active_ingredients' | 'brands' | 'product_families' | 'infrastructure_types' | 'application_methods'
export type ProductIngredient = { ingredient_id: string; concentration: string | null }
export type CatalogRecord = {
  id: string; name: string; code?: string; active: boolean;
  agricultural_unit_id?: string; crop_id?: string; brand_id?: string | null;
  family_id?: string | null; unit?: 'g' | 'ml'; default_dose?: number;
  ingredients?: ProductIngredient[]; created_at?: string;
}
export type SowingProject = { id: string; agricultural_unit_id: string; name: string; season: string; start_date?: string; status: 'draft' | 'active' | 'closed'; created_at?: string }
export type ProjectLot = { id: string; project_id: string; field_id: string; name: string; code?: string; area_ha: number; infrastructure_type_id: string; active?: boolean; created_at?: string; field_name_snapshot?: string; infrastructure_name_snapshot?: string }
export type LotSubdivision = { id: string; lot_id: string; name: string; area_ha: number; active: boolean; created_at?: string }
export type SowingStage = { id: string; subdivision_id: string; stage_number: number; crop_id: string; variety_id: string; area_ha: number; planned_sowing_date: string; actual_sowing_date: string | null; closed_at: string | null; status: 'planned' | 'planted' | 'closed'; crop_name_snapshot?: string; variety_name_snapshot?: string }
export type UserProfile = { id: string; full_name: string; email?: string; role: 'admin' | 'reader' }
export type UserAssignment = { user_id: string; agricultural_unit_id: string }
export type WorkspaceData = { catalogs: Record<CatalogKind, CatalogRecord[]>; projects: SowingProject[]; lots: ProjectLot[]; subdivisions: LotSubdivision[]; stages: SowingStage[]; profiles: UserProfile[]; assignments: UserAssignment[] }
export type WorkspaceCommand =
  | { type: 'save_catalog'; kind: CatalogKind; record: Partial<CatalogRecord> & Pick<CatalogRecord, 'name' | 'active'> }
  | { type: 'delete_catalog'; kind: CatalogKind; id: string }
  | { type: 'save_project'; record: Partial<SowingProject> & Pick<SowingProject, 'agricultural_unit_id' | 'name' | 'season'> }
  | { type: 'activate_project' | 'close_project'; id: string }
  | { type: 'copy_project'; id: string; name: string; season: string; start_date?: string }
  | { type: 'save_lot'; record: Partial<ProjectLot> & Pick<ProjectLot, 'project_id' | 'field_id' | 'name' | 'area_ha' | 'infrastructure_type_id'> }
  | { type: 'delete_lot'; id: string }
  | { type: 'replace_subdivisions'; lot_id: string; subdivisions: { name: string; area_ha: number }[] }
  | { type: 'save_stage'; record: Partial<SowingStage> & Pick<SowingStage, 'subdivision_id' | 'crop_id' | 'variety_id' | 'area_ha' | 'planned_sowing_date'> }
  | { type: 'plant_stage'; id: string; actual_sowing_date: string }
  | { type: 'discard_stage'; id: string }
  | { type: 'close_stage'; id: string; closed_at: string }
  | { type: 'set_user_access'; user_id: string; role: UserProfile['role']; agricultural_unit_ids: string[] }
export const catalogKinds: CatalogKind[] = ['agricultural_units','fields','crops','varieties','products','active_ingredients','brands','product_families','infrastructure_types','application_methods']
export function emptyWorkspace(): WorkspaceData { return { catalogs: Object.fromEntries(catalogKinds.map(key => [key, []])) as unknown as WorkspaceData['catalogs'], projects: [], lots: [], subdivisions: [], stages: [], profiles: [], assignments: [] } }
