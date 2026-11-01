import { randomUUID } from 'node:crypto';

// Recibe únicamente el cliente del proyecto aislado rcfito-local-test.
// No prepara operación, no persiste tokens y no imprime respuestas con datos.
export async function verifyApplicationQueries({ request, check, adminToken, readerToken, noAccessToken, readerId, unitA, unitB, projectA }) {
  const query = (p_query, token = adminToken) => request('/rest/v1/rpc/application_query', token, { p_query });
  const stamp = (token = adminToken) => request('/rest/v1/rpc/application_query_stamp', token, {});
  const anonQuery = await request('/rest/v1/rpc/application_query', undefined, { p_query: { operation: 'historial' } });
  const anonStamp = await request('/rest/v1/rpc/application_query_stamp', undefined, {});
  check([401, 403].includes(anonQuery.status) && [401, 403].includes(anonStamp.status), 'Consultas: RPC y sello rechazan anónimo con Auth/REST real');
  const invalidSession = await query({ operation: 'historial' }, 'invalid-token');
  check(invalidSession.status === 401, 'Consultas: sesión inválida rechazada antes de consultar');
  const adminStamp = await stamp();
  const adminQuery = await query({ operation: 'historial', project_id: projectA });
  check(adminStamp.status === 200 && typeof adminStamp.data?.revision === 'string' && adminQuery.status === 200 && adminQuery.data?.summary?.destination_count > 0,
    'Consultas: administrador obtiene revisión y destinos autorizados por HTTP');
  check(adminQuery.data.revision === adminStamp.data.revision && adminQuery.data.rows.every(row => row.agricultural_unit_id === unitA),
    'Consultas: filtro de proyecto y revisión del mismo corte se conservan en REST');
  const readerQuery = await query({ operation: 'historial' }, readerToken);
  check(readerQuery.status === 200 && readerQuery.data.summary.destination_count > 0 && readerQuery.data.rows.every(row => row.agricultural_unit_id === unitA),
    'Consultas: lector obtiene solamente destinos de su agrícola asignada');
  const foreignQuery = await query({ operation: 'historial', agricultural_unit_id: unitB }, readerToken);
  check(foreignQuery.status === 200 && foreignQuery.data.summary.destination_count === 0 && foreignQuery.data.rows.length === 0 && foreignQuery.data.sources.length === 0,
    'Consultas: UUID de agrícola ajena no revela destinos ni fuentes');
  const foreignName = await query({ operation: 'historial', agricultural_unit: 'Agrícola B ficticia' }, readerToken);
  check(foreignName.status === 200 && typeof foreignName.data.clarification === 'string' && foreignName.data.choices.length === 0,
    'Consultas: resolver nombres no revela agrícola ajena');
  const foreignAdmin = await query({ operation: 'historial', agricultural_unit_id: unitB });
  check(foreignAdmin.status === 200 && foreignAdmin.data.summary.destination_count > 0, 'Consultas: administrador sí consulta la segunda agrícola preparada');
  const foreignOrder = foreignAdmin.data.rows[0].order_id;
  const foreignDetail = await query({ operation: 'detalle', order_id: foreignOrder }, readerToken);
  const foreignChanges = await query({ operation: 'cambios', order_id: foreignOrder }, readerToken);
  check(foreignDetail.status === 200 && foreignDetail.data.rows.length === 0 && foreignChanges.status === 200 && foreignChanges.data.rows.length === 0,
    'Consultas: detalle y cambios de orden ajena quedan ocultos por RLS');
  const unassigned = await query({ operation: 'historial' }, noAccessToken);
  check(unassigned.status === 200 && unassigned.data.summary.destination_count === 0, 'Consultas: lector sin asignaciones no obtiene aplicaciones');
  const forbidden = await query({ operation: 'historial', sql: 'select * from application_orders' });
  check(forbidden.status >= 400, 'Consultas: REST rechaza filtros fuera del contrato y SQL arbitrario');

  const actual = await query({ operation: 'historial', project_id: projectA, status: 'performed', limit: 30 });
  const destination = actual.data?.rows?.[0];
  if (actual.status !== 200 || !destination?.target_id || !destination.products?.length) throw new Error('Falta un destino ficticio realizado para comprobar invalidación de consultas.');
  const current = await request(`/rest/v1/application_targets?id=eq.${destination.target_id}&select=correction_version`, adminToken);
  const beforeReaderStamp = await stamp(readerToken);
  const products = destination.products.map((product, index) => ({ product_id: product.product_id, dose: Number(product.dose) + (index === 0 ? 1 : 0) }));
  const corrected = await request('/rest/v1/rpc/correct_application_target', adminToken, {
    p_data: { id: randomUUID(), target_id: destination.target_id, expected_version: current.data[0].correction_version,
      actual_date: destination.actual_date, water_l_ha: Number(destination.water_l_ha) + 1, equipment: 'Equipo QA consultas',
      applicator: 'Aplicador QA consultas', observations: 'Corrección ficticia para verificar consulta vigente', reason: 'QA de invalidación de consulta' },
    p_products: products,
  });
  check(corrected.status === 200, 'Consultas: corrección ficticia se guarda mediante RPC autenticada');
  const afterAdminStamp = await stamp();
  const afterReaderStamp = await stamp(readerToken);
  check(afterAdminStamp.status === 200 && afterAdminStamp.data.revision !== adminStamp.data.revision && afterReaderStamp.data.revision !== beforeReaderStamp.data.revision,
    'Consultas: corrección cambia revisiones del administrador y lector');
  const afterQuery = await query({ operation: 'detalle', order_id: destination.order_id, stage_id: destination.stage_id, status: 'performed' }, readerToken);
  check(afterQuery.status === 200 && afterQuery.data.rows.length === 1 && afterQuery.data.rows[0].equipment === 'Equipo QA consultas'
    && afterQuery.data.rows[0].products.some(product => product.product_id === products[0].product_id && Number(product.dose) === products[0].dose),
    'Consultas: mismo JWT de lector recibe corrección y equipo vigentes');
  const changes = await query({ operation: 'cambios', order_id: destination.order_id }, readerToken);
  check(changes.status === 200 && changes.data.rows.some(row => row.reason === 'QA de invalidación de consulta')
    && changes.data.sources.every(source => source.target_id === undefined || typeof source.target_id === 'string'),
    'Consultas: historial auditado y fuentes de revisiones tienen contrato HTTP válido');

  const access = (p_active, p_agricultural_unit_ids) => request('/rest/v1/rpc/set_user_access', adminToken, { p_user_id: readerId, p_role: 'viewer', p_active, p_agricultural_unit_ids });
  try {
    check((await access(true, [])).status === 204, 'Consultas: se revoca asignación por RPC autenticada');
    const revokedStamp = await stamp(readerToken);
    const revokedQuery = await query({ operation: 'historial' }, readerToken);
    check(revokedStamp.status === 200 && revokedStamp.data.revision !== afterReaderStamp.data.revision && revokedQuery.status === 200 && revokedQuery.data.summary.destination_count === 0,
      'Consultas: revocar asignación cambia sello y bloquea datos con JWT ya emitido');
    check((await access(false, [])).status === 204, 'Consultas: se desactiva lector ficticio por RPC');
    const disabledStamp = await stamp(readerToken);
    const disabledQuery = await query({ operation: 'historial' }, readerToken);
    check(disabledStamp.status === 403 && disabledQuery.status === 403, 'Consultas: perfil desactivado pierde sello y consulta aunque conserve JWT válido');
  } finally {
    // El resto del harness comprueba catálogos con este lector activo.
    const restored = await access(true, [unitA]);
    if (restored.status !== 204) throw new Error('No se pudo restaurar el fixture de permisos del lector de QA.');
  }
  console.log('Integración de consultas: Auth, REST, RLS, correcciones, fuentes y revocación comprobados con datos ficticios.');
}
