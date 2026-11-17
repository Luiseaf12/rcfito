import { randomUUID } from 'node:crypto';
export async function verifyCatalogMetadata({request,check,adminToken,readerToken}) {
  const c1=randomUUID(),c2=randomUUID(),i1=randomUUID(),i2=randomUUID(); let p;
  const suffix=c1.slice(0,8), alias=`Alias ingrediente ${suffix}`;
  const ok=r=>r.status>=200&&r.status<300;
  check(ok(await request('/rest/v1/ingredient_classifications',adminToken,[{id:c1,code:`MC1-${suffix}`,name:`Insecticida ${suffix}`},{id:c2,code:`MC2-${suffix}`,name:`Acaricida ${suffix}`}])),'Metadatos HTTP: crea clasificaciones');
  check(ok(await request('/rest/v1/active_ingredients',adminToken,{id:i1,code:`MCI-${suffix}`,name:`Ingrediente múltiple ${suffix}`,classification_ids:[c1,c2],classification_id:c2,synonyms:[alias]})),'Metadatos HTTP: ingrediente con dos usos y alias');
  let row=(await request(`/rest/v1/active_ingredients?id=eq.${i1}`,readerToken)).data[0];
  check(row.classification_ids.length===2&&row.synonyms[0]===alias,'Metadatos HTTP: relectura por lector');
  check(ok(await request(`/rest/v1/active_ingredients?id=eq.${i1}`,adminToken,{classification_id:null},'PATCH')),'Metadatos HTTP: retira principal sin retirar usos');
  check((await request(`/rest/v1/ingredient_classifications?id=eq.${c2}`,adminToken,undefined,'DELETE')).status===409,'Metadatos HTTP: secundaria protege eliminación');
  const saved=await request('/rest/v1/rpc/save_product',adminToken,{p_data:{code:`MCP-${suffix}`,name:`Producto múltiple ${suffix}`,unit:'ml',classification_ids:[c1],classification_id:c1,synonyms:[]},p_ingredients:[{active_ingredient_id:i1,concentration:'1 g/L'}]}); p=saved.data; check(ok(saved),'Metadatos HTTP: RPC producto con selección propia');
  row=(await request(`/rest/v1/products?id=eq.${p}`,readerToken)).data[0];
  check(row.classification_ids.length===1&&row.classification_id===c1,'Metadatos HTTP: no hereda usos de ingrediente');
  check((await request(`/rest/v1/active_ingredients?id=eq.${i1}`,adminToken,{classification_ids:[c1],classification_id:c2},'PATCH')).status>=400,'Metadatos HTTP: principal fuera del conjunto rechazada');
  check(ok(await request('/rest/v1/active_ingredients',adminToken,{id:i2,code:`MCI2-${suffix}`,name:`Segundo ingrediente ${suffix}`})),'Metadatos HTTP: segundo ingrediente');
  check((await request(`/rest/v1/active_ingredients?id=eq.${i2}`,adminToken,{synonyms:[alias.toUpperCase()]},'PATCH')).status>=400,'Metadatos HTTP: alias equivalente de otro ingrediente rechazado');
  const raceAlias=`Concurrente ${suffix}`;
  const races=await Promise.all([i1,i2].map(id=>request(`/rest/v1/active_ingredients?id=eq.${id}`,adminToken,{synonyms:[raceAlias]},'PATCH')));
  check(races.filter(ok).length===1,'Metadatos HTTP: concurrencia reserva alias en un solo ingrediente');
  const history=await request(`/rest/v1/catalog_metadata_changes?record_id=eq.${i1}`,adminToken);
  check(ok(history)&&history.data.length>=2&&history.data.some(change=>change.after?.synonyms.includes(alias)),'Metadatos HTTP: historial conserva alias y autor');
  check((await request(`/rest/v1/catalog_metadata_changes?record_id=eq.${i1}`,readerToken)).data.length===0,'Metadatos HTTP: historial reservado al administrador');
  check((await request('/rest/v1/catalog_metadata_changes',adminToken,{kind:'products',record_id:p,changed_by_name:'Inventado'})).status===403,'Metadatos HTTP: cliente no falsifica historial');
  await request(`/rest/v1/active_ingredients?id=eq.${i1}`,readerToken,{synonyms:['No permitido']},'PATCH');
  row=(await request(`/rest/v1/active_ingredients?id=eq.${i1}`,adminToken)).data[0];
  check(!row.synonyms.includes('No permitido'),'Metadatos HTTP: lector no modifica sinónimos');
  check((await request('/rest/v1/catalog_metadata_changes?select=id')).status===401,'Metadatos HTTP: anónimo rechazado');
}
