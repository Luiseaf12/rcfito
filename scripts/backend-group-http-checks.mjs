import { randomUUID } from 'node:crypto';

export async function verifyApplicationGroups({ request, check, adminToken, readerToken, noAccessToken, data, mixture, varietyId, infrastructureId }) {
  const stages = [], groupId = randomUUID(), groupName = 'Grupo de origen ficticio';
  for (let i = 0; i < 2; i++) {
    const lot = await request('/rest/v1/rpc/create_project_lot', adminToken, { p_data: { project_id: data.project_id, field_id: data.field_id, code: `ORIGIN-${randomUUID()}`, name: `Lote de origen ${i}`, area_ha: 2, infrastructure_type_id: infrastructureId } });
    const subdivision = await request(`/rest/v1/lot_subdivisions?lot_id=eq.${lot.data}&select=id`, adminToken);
    const id = randomUUID();
    check(lot.status === 200 && subdivision.data?.length === 1 && (await request('/rest/v1/rpc/save_sowing_stage', adminToken, { p_data: { id, subdivision_id: subdivision.data[0].id, crop_id: data.crop_id, variety_id: varietyId, area_ha: 2, planned_sowing_date: '2026-01-01' } })).status === 200 && (await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: id, p_status: 'planted', p_date: '2026-01-02' })).status < 300, 'Origen: destino exclusivo para prueba HTTP');
    stages.push(id);
  }
  const groupData = { id: groupId, project_id: data.project_id, field_id: data.field_id, crop_id: data.crop_id, name: groupName, active: true };
  check((await request('/rest/v1/rpc/save_sowing_group', adminToken, { p_data: groupData, p_stage_ids: stages })).status === 200, 'Origen: grupo exclusivo de prueba HTTP');
  const create = (record, stageIds = stages) => request('/rest/v1/rpc/create_application_order', adminToken, { p_data: record, p_stage_ids: stageIds, p_products: mixture });
  const { application_number: _number, ...automatic } = data;
  const grouped = { ...automatic, id: randomUUID(), source_group_id: groupId };
  check((await create(grouped)).status === 200, 'Origen: aplicación para todo el grupo creada por RPC HTTP');
  const orderPath = `/rest/v1/application_orders?id=eq.${grouped.id}&select=selection_origin,source_group_id,source_group_name`;
  const targetPath = `/rest/v1/application_targets?order_id=eq.${grouped.id}&select=id,stage_id,status,group_memberships_snapshot`;
  const order = await request(orderPath, adminToken), targets = await request(targetPath, adminToken);
  check(order.data?.[0]?.selection_origin === 'group' && order.data[0].source_group_id === groupId && order.data[0].source_group_name === groupName, 'Origen: relectura REST conserva ID y nombre histórico de grupo');
  check(targets.data?.length === stages.length && targets.data.every(row => row.group_memberships_snapshot?.some(group => group.id === groupId)), 'Origen: relectura conserva pertenencias por destino');
  const individual = { ...automatic, id: randomUUID() };
  check((await create(individual, [stages[0]])).status === 200, 'Origen: captura individual de lote perteneciente a grupo');
  const singleRead = await request(`/rest/v1/application_orders?id=eq.${individual.id}&select=selection_origin,source_group_id`, adminToken);
  check(singleRead.data?.[0]?.selection_origin === 'individual' && singleRead.data[0].source_group_id === null, 'Origen: pertenencia no convierte receta individual en receta de grupo');
  const incomplete = { ...grouped, id: randomUUID() };
  check((await create(incomplete, [stages[0]])).status >= 400, 'Origen: servidor rechaza captura grupal incompleta');
  check((await request(`/rest/v1/application_orders?id=eq.${incomplete.id}&select=id`, adminToken)).data?.length === 0, 'Origen: rechazo atómico sin orden parcial');
  check((await create({ ...grouped, source_group_id: null })).status >= 400, 'Origen: reintento no cambia grupo por selección individual');
  check((await request(orderPath, readerToken)).data?.[0]?.source_group_id === groupId, 'Origen: lector asignado consulta el dato histórico');
  check((await request(orderPath, noAccessToken)).data?.length === 0 && (await request(targetPath, noAccessToken)).data?.length === 0, 'Origen: RLS oculta órdenes y pertenencias fuera del ámbito');
  check((await request('/rest/v1/rpc/create_application_order', readerToken, { p_data: { ...grouped, id: randomUUID() }, p_stage_ids: stages, p_products: mixture })).status === 403, 'Origen: lector no crea una aplicación de grupo');
  check((await request(`/rest/v1/application_orders?id=eq.${grouped.id}`, adminToken, { source_group_name: 'Nombre falsificado' }, 'PATCH')).status === 403, 'Origen: API directa no modifica nombre histórico');
  groupData.name = 'Grupo de origen renombrado';
  check((await request('/rest/v1/rpc/save_sowing_group', adminToken, { p_data: groupData, p_stage_ids: stages })).status === 200, 'Origen: renombre del grupo actual');
  check((await request(orderPath, adminToken)).data?.[0]?.source_group_name === groupName, 'Origen: nombre de emisión permanece tras renombrar grupo');
  const reloadedTargets = await request(targetPath, adminToken);
  check(reloadedTargets.data?.every(row => row.group_memberships_snapshot?.some(group => group.name === groupName)), 'Origen: snapshots permanecen tras actualizar grupo');
  // Resolve these additional orders so the existing closure regression retains its scope.
  check((await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: grouped.id, p_target_ids: targets.data.map(row => row.id), p_reason: 'Fin del caso ficticio de origen' })).status < 300, 'Origen: destinos de prueba resueltos');
  const singleTargets = await request(`/rest/v1/application_targets?order_id=eq.${individual.id}&select=id`, adminToken);
  await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: individual.id, p_target_ids: singleTargets.data.map(row => row.id), p_reason: 'Fin del caso ficticio individual' });
  for (const id of stages) check((await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: id, p_status: 'closed', p_date: '2026-01-10' })).status < 300, 'Origen: cierre de etapa exclusiva tras resolver destinos');
}
