import { randomUUID } from 'node:crypto';
import { createApplicationChatService } from '../server/application-chat.mjs';
import { runQueryCli } from './query-cli.mjs';

// Recibe únicamente el cliente del proyecto aislado rcfito-local-test.
// No prepara operación, no persiste tokens y no imprime respuestas con datos.
export async function verifyApplicationQueries({ request, check, adminToken, readerToken, noAccessToken, readerId, unitA, unitB, projectA, base, publicKey }) {
  const query = (p_query, token = adminToken) => request('/rest/v1/rpc/application_query', token, { p_query });
  const stamp = (token = adminToken) => request('/rest/v1/rpc/application_query_stamp', token, {});
  const resolve = (p_query, p_last_unit_id = null, token = adminToken) => request('/rest/v1/rpc/application_query_resolve', token, { p_query, p_last_unit_id });
  const anonQuery = await request('/rest/v1/rpc/application_query', undefined, { p_query: { operation: 'historial' } });
  const anonStamp = await request('/rest/v1/rpc/application_query_stamp', undefined, {});
  check([401, 403].includes(anonQuery.status) && [401, 403].includes(anonStamp.status), 'Consultas: RPC y sello rechazan anónimo con Auth/REST real');
  const adminResolve = await resolve({ operation: 'uso_producto' });
  const publicResolve = await request('/rest/v1/rpc/application_query_resolve', undefined, { p_query: { operation: 'uso_producto' }, p_last_unit_id: null });
  check([401, 403].includes(publicResolve.status), 'Contexto: resolver rechaza anónimo por HTTP');
  const invalidSession = await query({ operation: 'historial' }, 'invalid-token');
  check(invalidSession.status === 401, 'Consultas: sesión inválida rechazada antes de consultar');
  const adminStamp = await stamp();
  const adminQuery = await query({ operation: 'historial', project_id: projectA });
  check(adminStamp.status === 200 && typeof adminStamp.data?.revision === 'string' && adminQuery.status === 200 && adminQuery.data?.summary?.destination_count > 0,
    'Consultas: administrador obtiene revisión y destinos autorizados por HTTP');
  check(adminQuery.data.revision === adminStamp.data.revision && adminQuery.data.rows.every(row => row.agricultural_unit_id === unitA),
    'Consultas: filtro de proyecto y revisión del mismo corte se conservan en REST');
  check(adminResolve.status === 200, 'Contexto: administrador puede resolver contexto por HTTP');
  const context = await resolve({ operation: 'uso_producto', project_id: projectA });
  check(context.status === 200 && context.data.query.project_id === projectA && context.data.query.agricultural_unit_id === unitA
    && context.data.revision === adminStamp.data.revision && context.data.filters.some(filter => filter.key === 'project_id'),
    'Contexto: resolver conserva proyecto explícito, filtros y sello del mismo corte');
  const readerQuery = await query({ operation: 'historial' }, readerToken);
  check(readerQuery.status === 200 && readerQuery.data.summary.destination_count > 0 && readerQuery.data.rows.every(row => row.agricultural_unit_id === unitA),
    'Consultas: lector obtiene solamente destinos de su agrícola asignada');
  const foreignQuery = await query({ operation: 'historial', agricultural_unit_id: unitB }, readerToken);
  check(foreignQuery.status === 200 && foreignQuery.data.summary.destination_count === 0 && foreignQuery.data.rows.length === 0 && foreignQuery.data.sources.length === 0,
    'Consultas: UUID de agrícola ajena no revela destinos ni fuentes');
  const foreignName = await query({ operation: 'historial', agricultural_unit: 'Agrícola B ficticia' }, readerToken);
  check(foreignName.status === 200 && typeof foreignName.data.clarification === 'string' && foreignName.data.choices.length === 0,
    'Consultas: resolver nombres no revela agrícola ajena');
  const foreignLast = await resolve({ operation: 'uso_producto' }, unitB, readerToken);
  check(foreignLast.status === 200 && foreignLast.data.clarification && foreignLast.data.choices.length === 1
    && foreignLast.data.choices.every(choice => choice.id === unitA), 'Contexto: última agrícola ajena exige aclarar y solo muestra opciones autorizadas');
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

  await verifyQueryContextPipeline({ request, check, adminToken, readerToken, projectA, unitA, base, publicKey });

  const access = (p_active, p_agricultural_unit_ids) => request('/rest/v1/rpc/set_user_access', adminToken, { p_user_id: readerId, p_role: 'viewer', p_active, p_agricultural_unit_ids });
  try {
    check((await access(true, [])).status === 204, 'Consultas: se revoca asignación por RPC autenticada');
    const revokedStamp = await stamp(readerToken);
    const revokedQuery = await query({ operation: 'historial' }, readerToken);
    check(revokedStamp.status === 200 && revokedStamp.data.revision !== afterReaderStamp.data.revision && revokedQuery.status === 200 && revokedQuery.data.summary.destination_count === 0,
      'Consultas: revocar asignación cambia sello y bloquea datos con JWT ya emitido');
    const revokedContext = await resolve({ operation: 'uso_producto' }, unitA, readerToken);
    check(revokedContext.status === 200 && revokedContext.data.clarification && revokedContext.data.choices.length === 0,
      'Contexto: revocar última agrícola retira nombres y opciones con el mismo JWT');
    check((await access(false, [])).status === 204, 'Consultas: se desactiva lector ficticio por RPC');
    const disabledStamp = await stamp(readerToken);
    const disabledQuery = await query({ operation: 'historial' }, readerToken);
    check(disabledStamp.status === 403 && disabledQuery.status === 403, 'Consultas: perfil desactivado pierde sello y consulta aunque conserve JWT válido');
    check((await resolve({ operation: 'uso_producto' }, unitA, readerToken)).status === 403, 'Contexto: perfil desactivado pierde resolver con JWT previo');
  } finally {
    // El resto del harness comprueba catálogos con este lector activo.
    const restored = await access(true, [unitA]);
    if (restored.status !== 204) throw new Error('No se pudo restaurar el fixture de permisos del lector de QA.');
  }
  console.log('Integración de consultas: Auth, REST, RLS, correcciones, fuentes y revocación comprobados con datos ficticios.');
}

async function verifyQueryContextPipeline({ request, check, adminToken, readerToken, projectA, unitA, base, publicKey }) {
  const suffix = randomUUID().slice(0, 8);
  const [crops, infrastructure, methods] = await Promise.all([
    request('/rest/v1/crops?active=eq.true&select=id&limit=1', adminToken),
    request('/rest/v1/infrastructure_types?active=eq.true&select=id&limit=1', adminToken),
    request('/rest/v1/application_methods?active=eq.true&select=id&limit=1', adminToken),
  ]);
  const crop = crops.data[0].id;
  const varieties = await request(`/rest/v1/varieties?crop_id=eq.${crop}&active=eq.true&select=id&limit=1`, adminToken);
  const productG = randomUUID(), productMl = randomUUID();
  const nameG = `Producto sólido de consultas ${suffix}`, nameMl = `Producto líquido de consultas ${suffix}`;
  for (const [id, unit, name] of [[productG, 'g', nameG], [productMl, 'ml', nameMl]]) {
    const result = await request('/rest/v1/products', adminToken, { id, unit, name, code: `Q-${unit}-${suffix}`, default_dose: 1, active: true });
    if (result.status !== 201) throw new Error('No se pudo preparar el catálogo ficticio del pipeline de consultas.');
  }
  const fields = [];
  for (const number of [5, 15]) {
    const field = randomUUID(), stage = randomUUID();
    const createdField = await request('/rest/v1/fields', adminToken, { id: field, agricultural_unit_id: unitA, code: `QM${number}-${suffix}`, name: number === 5 ? 'Campo principal ficticio' : `Malla ${number}`, active: true });
    const lot = await request('/rest/v1/rpc/create_project_lot', adminToken, { p_data: { project_id: projectA, field_id: field,
      code: `QL${number}-${suffix}`, name: number === 5 ? 'Malla 5' : `Lote único de malla ${number}`, area_ha: 4, infrastructure_type_id: infrastructure.data[0].id } });
    if (createdField.status !== 201 || lot.status !== 200) throw new Error('No se pudo preparar campo y lote ficticios del pipeline.');
    const subdivisions = await request(`/rest/v1/lot_subdivisions?lot_id=eq.${lot.data}&select=id`, adminToken);
    const saved = await request('/rest/v1/rpc/save_sowing_stage', adminToken, { p_data: { id: stage, subdivision_id: subdivisions.data[0].id,
      crop_id: crop, variety_id: varieties.data[0].id, area_ha: 4, planned_sowing_date: '2026-01-01' } });
    const planted = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: stage, p_status: 'planted', p_date: '2026-01-02' });
    if (saved.status !== 200 || ![200, 204].includes(planted.status)) throw new Error('No se pudo sembrar el destino ficticio del pipeline.');
    fields.push({ field, lot: lot.data, stage });
  }
  async function createOrder(destination, doseG, doseMl, state) {
    const id = randomUUID();
    const products = [{ product_id: productG, dose: doseG }, { product_id: productMl, dose: doseMl }];
    const created = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: { id, project_id: projectA, field_id: destination.field,
      crop_id: crop, method_id: methods.data[0].id, indicated_date: '2026-01-03', scheduled_date: '2026-01-06', water_l_ha: 100, observations: 'QA de contexto' },
      p_stage_ids: [destination.stage], p_products: products });
    if (created.status !== 200) throw new Error('No se pudo indicar la aplicación ficticia del pipeline.');
    const targets = await request(`/rest/v1/application_targets?order_id=eq.${id}&select=id`, adminToken);
    const target = targets.data[0].id;
    if (state === 'performed') {
      const performed = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: id, p_target_ids: [target], p_data: { changed: false, actual_date: '2026-01-04' } });
      if (![200, 204].includes(performed.status)) throw new Error('No se pudo realizar la aplicación ficticia del pipeline.');
    } else if (state === 'cancelled') {
      const cancelled = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: id, p_target_ids: [target], p_reason: 'Cancelación QA de contexto' });
      if (![200, 204].includes(cancelled.status)) throw new Error('No se pudo cancelar la aplicación ficticia del pipeline.');
    }
    return { id, target, products };
  }
  const actual = await createOrder(fields[0], 10, 5, 'performed');
  const corrected = await request('/rest/v1/rpc/correct_application_target', adminToken, { p_data: { id: randomUUID(), target_id: actual.target, expected_version: 0,
    actual_date: '2026-01-05', water_l_ha: 150, equipment: 'Equipo vigente M5', applicator: 'Aplicador QA', observations: 'Realización corregida M5', reason: 'QA pipeline corregido' },
    p_products: [{ product_id: productG, dose: 20 }, { product_id: productMl, dose: 10 }] });
  if (corrected.status !== 200) throw new Error('No se pudo corregir el resultado ficticio del pipeline.');
  await createOrder(fields[0], 999, 999, 'indicated');
  await createOrder(fields[0], 888, 888, 'cancelled');
  await createOrder(fields[1], 50, 50, 'performed');

  const objects = new Map();
  const env = { BUCKET: {
    async get(name) { const value = objects.get(name); return value === undefined ? null : { size: Buffer.byteLength(value), json: async () => JSON.parse(value) }; },
    async put(name, value) { objects.set(name, value); },
  } };
  const site = 'https://query-fixture.invalid';
  let lastUnitSeen = null, lastReport;
  const service = createApplicationChatService({ key: publicKey, backendUrl: async () => base,
    configuration: async () => { throw new Error('El pipeline literal no debe consumir proveedor IA.'); },
    fetch: async (url, init) => {
      if (!String(url).startsWith(base + '/')) throw new Error('El pipeline de prueba solo permite el backend aislado.');
      if (String(url).endsWith('/application_query_resolve')) lastUnitSeen = JSON.parse(init.body).p_last_unit_id;
      return fetch(url, init);
    },
  });
  const call = async (body, path = '/api/application-query') => service.handle(new Request(site + path, { method: 'POST',
    headers: { authorization: `Bearer ${readerToken}`, origin: site, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
  const first = await call({ query: { operation: 'uso_producto', agricultural_unit_id: unitA, project_id: projectA, lot_id: fields[0].lot }, resolveContext: true, completeProducts: true });
  const firstReport = await first.json();
  check(first.status === 200 && firstReport.result.summary.solid_g === 80 && firstReport.result.summary.liquid_ml === 40,
    'Pipeline contexto: consulta explícita inicial usa realizadas corregidas del lote y recuerda la agrícola');
  const output = [];
  await runQueryCli(['preguntar', 'cuánto de cada producto se ha aplicado en malla 5', '--url', site], {
    env: {}, readSession: async () => ({ site, access_token: readerToken }), output: text => output.push(text),
    fetch: async (url, init) => {
      const response = await service.handle(new Request(url, init), env);
      lastReport = await response.clone().json();
      return response;
    },
  });
  check(lastUnitSeen === unitA && lastReport.result.query.project_id === projectA && lastReport.result.query.lot_id === fields[0].lot,
    'Pipeline contexto: CLI literal usa última agrícola persistida y temporada activa vía RPC real');
  check(lastReport.result.summary.solid_g === 80 && lastReport.result.summary.liquid_ml === 40 && lastReport.result.rows.length === 2,
    'Pipeline contexto: CLI→handler→Auth/REST→resolver→consulta excluye indicadas, canceladas y Malla 15');
  check(output.join('\n').includes(nameG) && output.join('\n').includes(nameMl) && output.join('\n').includes('Malla 5')
    && lastReport.result.filters.some(filter => filter.source === 'last_used'), 'Pipeline contexto: salida CLI presenta tabla de cada producto y filtros aplicados con procedencia');
  check(lastReport.usage.inputTokens === 0 && lastReport.usage.outputTokens === 0 && objects.size > 0,
    'Pipeline contexto: pregunta literal consulta datos reales de QA sin inferencia ni archivos de credenciales');
  const captured = await call({ message: 'Que productos hemos usado en malla 5 ?', context: { agricultural_unit_id: unitA, project_id: projectA } }, '/api/application-chat');
  const capturedReport = await captured.json();
  check(captured.status === 200 && !capturedReport.result.clarification && capturedReport.query.lot_id === fields[0].lot,
    'Pregunta de captura: Malla 5 se resuelve como nombre de lote de un campo distinto, con contexto seleccionado');
  check(capturedReport.result.rows.length === 2 && capturedReport.answer.includes(nameG) && capturedReport.answer.includes(nameMl)
    && capturedReport.result.summary.solid_g === 80 && capturedReport.result.summary.liquid_ml === 40,
    'Pregunta de captura: devuelve nombres de los productos y totales realizados corregidos');
  check(capturedReport.usage.inputTokens === 0 && capturedReport.usage.outputTokens === 0 && capturedReport.queryOptions.completeProducts,
    'Pregunta de captura: sin IA y lista completa de productos');
}
