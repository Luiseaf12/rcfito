export type CatalogKind = 'agricultural_units' | 'fields' | 'crops' | 'varieties' | 'products' | 'active_ingredients' | 'ingredient_classifications' | 'brands' | 'product_families' | 'infrastructure_types' | 'application_methods'
export type ProductIngredient = { ingredient_id: string; concentration: string | null }
export type CatalogRecord = {
  id: string; name: string; code?: string; active: boolean;
  agricultural_unit_id?: string; crop_id?: string; brand_id?: string | null;
  classification_id?: string | null; family_id?: string | null; unit?: 'g' | 'ml'; default_dose?: number;
  ingredients?: ProductIngredient[]; created_at?: string; unit_locked?: boolean; synonyms?: string[];
}
export type SowingProject = { id: string; agricultural_unit_id: string; name: string; season: string; start_date?: string; status: 'draft' | 'active' | 'closed'; created_at?: string }
export type ProjectLot = { id: string; project_id: string; field_id: string; name: string; code?: string; area_ha: number; infrastructure_type_id: string; active?: boolean; created_at?: string; field_name_snapshot?: string; infrastructure_name_snapshot?: string }
export type LotSubdivision = { id: string; lot_id: string; name: string; area_ha: number; active: boolean; created_at?: string }
export type SowingStage = { id: string; subdivision_id: string; stage_number: number; crop_id: string; variety_id: string; area_ha: number; planned_sowing_date: string; actual_sowing_date: string | null; closed_at: string | null; status: 'planned' | 'planted' | 'closed'; crop_name_snapshot?: string; variety_name_snapshot?: string }
export type UserProfile = { id: string; full_name: string; email?: string; role: 'admin' | 'reader' }
export type UserAssignment = { user_id: string; agricultural_unit_id: string }
export type ProductLine = { product_id: string; dose: number; product_name: string; unit: 'g' | 'ml' }
export type ApplicationProductInput = Pick<ProductLine, 'product_id' | 'dose'>
export type ApplicationOrder = {
  id: string; folio: string; project_id: string; field_id: string; crop_id: string; method_id: string;
  indicated_date: string; scheduled_date: string; water_l_ha: number; observations: string;
  source_text?: string; application_number?: number;
  products: ProductLine[]; project_name?: string; field_name?: string; crop_name?: string; method_name?: string; revision?: number;
}
export type ApplicationTarget = {
  id: string; order_id: string; stage_id: string; status: 'indicated' | 'performed' | 'cancelled';
  application_number?: number;
  lot_name: string; subdivision_name: string; stage_number: number; crop_name: string; variety_name: string; area_ha: number;
  actual_date: string | null; actual_water_l_ha: number | null; actual_products: ProductLine[];
  equipment: string; applicator: string; actual_observations: string; cancellation_reason: string; has_changes: boolean;
  indication_change_id?: string | null; correction_version?: number;
}
export type ApplicationIndicationSnapshot = { method_id: string; method_name: string; indicated_date: string; scheduled_date: string; water_l_ha: number; observations: string; products: ProductLine[] }
export type ApplicationActualSnapshot = { actual_date: string; water_l_ha: number; equipment: string; applicator: string; observations: string; products: ProductLine[]; has_changes: boolean }
export type ApplicationChange = {
  id: string; order_id: string; target_id: string | null; kind: 'indication' | 'performance'; version: number; target_ids: string[];
  reason: string; changed_by: string; changed_by_name: string; changed_at: string;
  before: ApplicationIndicationSnapshot | ApplicationActualSnapshot; after: ApplicationIndicationSnapshot | ApplicationActualSnapshot;
}
export type SowingGroup = { id: string; project_id: string; field_id: string; crop_id: string; name: string; active: boolean; stage_ids: string[]; historical_stage_ids?: string[] }
export type ApplicationOrderInput = Pick<ApplicationOrder, 'id' | 'project_id' | 'field_id' | 'crop_id' | 'method_id' | 'indicated_date' | 'scheduled_date' | 'water_l_ha' | 'observations' | 'source_text' | 'application_number'> & { stage_ids: string[]; products: ApplicationProductInput[] }
export type ApplicationPerformanceInput = { actual_date: string; equipment: string; applicator: string; observations: string; changed: boolean; water_l_ha?: number; products?: ApplicationProductInput[]; expected_revision?: number }
export type ApplicationRevisionInput = { id: string; order_id: string; expected_revision: number; target_ids: string[]; method_id: string; indicated_date: string; scheduled_date: string; water_l_ha: number; observations: string; reason: string; products: ApplicationProductInput[] }
export type ApplicationCorrectionInput = { id: string; target_id: string; expected_version: number; actual_date: string; water_l_ha: number; equipment: string; applicator: string; observations: string; reason: string; products: ApplicationProductInput[] }
export type SowingGroupInput = Omit<SowingGroup, 'id' | 'historical_stage_ids'> & { id?: string }
export type WorkspaceData = { catalogs: Record<CatalogKind, CatalogRecord[]>; projects: SowingProject[]; lots: ProjectLot[]; subdivisions: LotSubdivision[]; stages: SowingStage[]; profiles: UserProfile[]; assignments: UserAssignment[]; applicationOrders: ApplicationOrder[]; applicationTargets: ApplicationTarget[]; applicationChanges: ApplicationChange[]; sowingGroups: SowingGroup[] }
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
  | { type: 'create_application_order'; record: ApplicationOrderInput }
  | { type: 'perform_application_targets'; order_id: string; target_ids: string[]; data: ApplicationPerformanceInput }
  | { type: 'cancel_application_targets'; order_id: string; target_ids: string[]; reason: string }
  | { type: 'revise_application_order'; record: ApplicationRevisionInput }
  | { type: 'correct_application_target'; record: ApplicationCorrectionInput }
  | { type: 'save_sowing_group'; record: SowingGroupInput }
export const catalogKinds: CatalogKind[] = ['agricultural_units','fields','crops','varieties','products','active_ingredients','ingredient_classifications','brands','product_families','infrastructure_types','application_methods']
export function completeCatalogs(catalogs: Partial<Record<CatalogKind, CatalogRecord[]>> = {}): WorkspaceData['catalogs'] { return Object.fromEntries(catalogKinds.map(kind => [kind, catalogs[kind] ?? []])) as WorkspaceData['catalogs'] }
export function emptyWorkspace(): WorkspaceData { return { catalogs: completeCatalogs(), projects: [], lots: [], subdivisions: [], stages: [], profiles: [], assignments: [], applicationOrders: [], applicationTargets: [], applicationChanges: [], sowingGroups: [] } }
