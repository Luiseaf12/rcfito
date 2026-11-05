import { createApplicationChatService } from '../server/application-chat.mjs';

// Only receives credentials/IDs from the dedicated Supabase integration stack.
export async function verifyMenuPermissions({request,check,adminToken,readerToken,readerId,unitA,base,publicKey}) {
  const succeeded=response=>response.status>=200&&response.status<300;
  const profile=async()=>request(`/rest/v1/profiles?id=eq.${readerId}&select=menu_permissions,access_version`,adminToken);
  const assignments=(await request(`/rest/v1/user_agricultural_units?user_id=eq.${readerId}&select=agricultural_unit_id`,adminToken)).data.map(row=>row.agricultural_unit_id);
  const previous=(await profile()).data[0];let version=previous.access_version;
  const save=(menus,expected=version)=>request('/rest/v1/rpc/set_user_menu_access',adminToken,{p_user_id:readerId,p_role:'viewer',p_active:true,p_agricultural_unit_ids:assignments,p_menu_permissions:menus,p_expected_version:expected});
  const history=()=>request(`/rest/v1/user_access_changes?user_id=eq.${readerId}&select=id,before,after,changed_by_name`,adminToken);
  const countBefore=(await history()).data.length;
  try {
    check(succeeded(await save(['applications'])),'Menús: administrador guarda selección por RPC');version++;
    const saved=(await profile()).data[0];check(saved.access_version===version&&JSON.stringify(saved.menu_permissions)==='["applications"]','Menús: relectura conserva permisos y versión');
    check((await request('/rest/v1/rpc/application_query_stamp',readerToken,{})).status===403,'Menús: misma sesión pierde Consultas inmediatamente');
    check((await request('/rest/v1/rpc/application_query',readerToken,{p_query:{operation:'historial'}})).status===403,'Menús: URL RPC directa rechaza sección oculta');
    const catalog=await request('/rest/v1/products?select=id',readerToken);check(catalog.status===200&&catalog.data.length===0,'Menús: catálogo oculto no entrega registros por REST');
    const applications=await request('/rest/v1/application_orders?select=id',readerToken);check(applications.status===200&&applications.data.length>0,'Menús: Aplicaciones sigue disponible en su ámbito');
    const references=await request('/rest/v1/rpc/menu_reference_catalogs',readerToken,{});check(references.status===200&&references.data.products?.length>0&&references.data.products.every(row=>!('default_dose' in row)),'Menús: filtros reciben referencias mínimas sin abrir catálogo');
    const audit=(await history()).data;check(audit.length===countBefore+1&&audit.some(row=>row.changed_by_name&&JSON.stringify(row.after.menus)==='["applications"]'),'Menús: cambio registra autor y antes/después');
    check((await request('/rest/v1/user_access_changes?select=id',readerToken)).data.length===0,'Menús: lector no consulta historial administrativo');
    check((await request(`/rest/v1/profiles?id=eq.${readerId}`,readerToken,{menu_permissions:['queries']},'PATCH')).status===403,'Menús: lector no cambia sus permisos por PATCH');
    check((await request(`/rest/v1/profiles?id=eq.${readerId}`,adminToken,{menu_permissions:['queries']},'PATCH')).status===403,'Menús: administrador tampoco evita auditoría por PATCH');
    check((await save(['queries'],version-1)).status>=400,'Menús: versión desactualizada conserva cambios ajenos');
    check((await save(['users'])).status>=400,'Menús: selección no concede administración a lector');
    check((await save(['no-existe'])).status>=400,'Menús: claves desconocidas se rechazan');
    let providerReads=0;
    const service=createApplicationChatService({fetch:globalThis.fetch,key:publicKey,backendUrl:async()=>base,configuration:async()=>{providerReads++;return {};}});
    for(const path of ['/api/application-chat','/api/application-query','/api/application-transcription']) {
      const response=await service.handle(new Request('https://qa.invalid'+path,{method:'POST',headers:{authorization:`Bearer ${readerToken}`,'content-type':'application/json'},body:'{}'}),{});
      check(response.status===403,'Menús: Worker rechaza chat/CLI/audio antes de usar proveedor');
    }
    check(providerReads===0,'Menús: revocación evita configuración y consumo de IA');
    check(succeeded(await save(['queries'])),'Menús: administrador puede habilitar Consultas');version++;
    const stamp=await request('/rest/v1/rpc/application_query_stamp',readerToken,{});
    const query=await request('/rest/v1/rpc/application_query',readerToken,{p_query:{operation:'historial'}});
    check(stamp.status===200&&query.status===200&&query.data.rows.length>0,'Menús: autorización nueva funciona con el JWT anterior');
    check((await request('/rest/v1/products?select=id',readerToken)).data.length===0,'Menús: RPC autorizada no deja abierto el catálogo');
    check((await request('/rest/v1/rpc/menu_reference_catalogs',undefined,{})).status===401,'Menús: anónimo no consulta referencias');
  } finally {
    const current=(await profile()).data?.[0];if(current) {version=current.access_version;const restored=await save(previous.menu_permissions);if(!succeeded(restored))throw Error(`Restauración del fixture rechazada con HTTP ${restored.status}: ${restored.data?.message??''}`);}
  }
}
