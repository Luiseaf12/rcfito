import { randomUUID } from 'node:crypto';

// Reuses only the dedicated, fictitious group fixture. No operational connection.
export async function verifyApplicationRecipes({ request, check, adminToken, readerToken, noAccessToken, grouped, stages, mixture }) {
  const source = { order_id: grouped.id, revision: 0 };
  const create = (record, ids = stages, token = adminToken) => request('/rest/v1/rpc/create_application_order', token, { p_data: record, p_stage_ids: ids, p_products: mixture });
  const copies = [];
  const copy = { ...grouped, id: randomUUID(), indicated_date: '2026-01-04', recipe_source: source };
  check((await create(copy)).status === 200, 'Recetas: nueva indicación grupal desde base explícita'); copies.push(copy.id);
  const read = await request(`/rest/v1/application_orders?id=eq.${copy.id}&select=recipe_source_order_id,recipe_source_revision,recipe_source_stage_id`, adminToken);
  check(read.data?.[0]?.recipe_source_order_id === grouped.id && read.data[0].recipe_source_revision === 0 && read.data[0].recipe_source_stage_id === null, 'Recetas: referencia y versión sobreviven relectura REST');
  check((await request(`/rest/v1/application_orders?id=eq.${copy.id}&select=recipe_source_order_id`, readerToken)).data?.[0]?.recipe_source_order_id === grouped.id, 'Recetas: lector asignado consulta trazabilidad');
  check((await request(`/rest/v1/application_orders?id=eq.${copy.id}&select=recipe_source_order_id`, noAccessToken)).data?.length === 0, 'Recetas: RLS oculta vínculo fuera de ámbito');
  check((await create({ ...copy, id: randomUUID() }, stages, readerToken)).status === 403, 'Recetas: lector no crea copias');
  check((await create(copy)).status === 200, 'Recetas: doble envío exacto devuelve la misma indicación');
  check((await create({ ...copy, recipe_source: { ...source, revision: 1 } })).status >= 400, 'Recetas: reintento distinto no altera la referencia');
  check((await create({ ...copy, id: randomUUID(), recipe_source: { ...source, revision: 1 } })).status >= 400, 'Recetas: revisión obsoleta rechazada por servidor');
  const individual = { ...copy, id: randomUUID(), source_group_id: null, recipe_source: { ...source, stage_id: stages[0] } };
  check((await create(individual, [stages[0]])).status === 200, 'Recetas: elegir base anterior aunque exista otra posterior no amplía destinos'); copies.push(individual.id);
  const individualTargets = await request(`/rest/v1/application_targets?order_id=eq.${individual.id}&select=id,stage_id,application_number`, adminToken);
  check(individualTargets.data?.length === 1 && individualTargets.data[0].stage_id === stages[0] && individualTargets.data[0].application_number > 1, 'Recetas: destino y número individual persistidos');
  check((await create({ ...copy, id: randomUUID(), recipe_source: { order_id: individual.id, revision: 0 } })).status >= 400, 'Recetas: receta individual no sustituye emisión grupal');
  check((await request(`/rest/v1/application_orders?id=eq.${copy.id}`, adminToken, { recipe_source_revision: 7 }, 'PATCH')).status === 403, 'Recetas: API directa no cambia trazabilidad');
  for (const id of copies) {
    const targets = await request(`/rest/v1/application_targets?order_id=eq.${id}&select=id`, adminToken);
    check((await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: id, p_target_ids: targets.data.map(row => row.id), p_reason: 'Fin del caso ficticio de recetas' })).status < 300, 'Recetas: fixtures resueltos antes del cierre de etapas');
  }
}
