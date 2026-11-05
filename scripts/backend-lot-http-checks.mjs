import { randomUUID } from 'node:crypto';

// Only receives the existing isolated rcfito-local-test client and fictitious users.
export async function verifyLotCorrections({ request, check, adminToken, readerToken, noAccessToken, readerId }) {
  const suffix=randomUUID().slice(0,8), ids=Object.fromEntries(['unit','field','crop','variety','infra','method','product'].map(key=>[key,randomUUID()]));
  const post=(path,body,token=adminToken)=>request('/rest/v1/'+path,token,body);
  const read=(path,token=adminToken)=>request('/rest/v1/'+path,token);
  const rpc=(name,body,token=adminToken)=>post('rpc/'+name,body,token);
  const ok=r=>r.status>=200&&r.status<300;
  for(const [table,body] of [
    ['agricultural_units',{id:ids.unit,code:`QA-CORR-${suffix}`,name:`Agrícola de corrección ficticia ${suffix}`}],
    ['fields',{id:ids.field,agricultural_unit_id:ids.unit,code:`QA-CORR-${suffix}`,name:'Campo ficticio de corrección'}],
    ['crops',{id:ids.crop,code:`QA-CORR-${suffix}`,name:`Cultivo ficticio ${suffix}`}],
    ['varieties',{id:ids.variety,crop_id:ids.crop,code:`QA-CORR-${suffix}`,name:`Variedad ficticia ${suffix}`}],
    ['infrastructure_types',{id:ids.infra,code:`QA-CORR-${suffix}`,name:`Infraestructura ficticia ${suffix}`}],
    ['application_methods',{id:ids.method,code:`QA-CORR-${suffix}`,name:`Medio ficticio ${suffix}`}],
    ['products',{id:ids.product,code:`QA-CORR-${suffix}`,name:`Producto ficticio ${suffix}`,unit:'ml',default_dose:10}],
  ]) check(ok(await post(table,body)),`Corrección: fixture ${table} creado solo en QA`);
  const project=await rpc('create_sowing_project',{p_data:{agricultural_unit_id:ids.unit,name:'Temporada ficticia de corrección',season:`QA-${suffix}`}});
  check(project.status===200&&typeof project.data==='string','Corrección: proyecto aislado creado');
  check(ok(await request(`/rest/v1/sowing_projects?id=eq.${project.data}`,adminToken,{status:'active'},'PATCH')),'Corrección: proyecto de QA activado');
  const assigned=(await read(`user_agricultural_units?user_id=eq.${readerId}&select=agricultural_unit_id`)).data;
  check(ok(await rpc('set_user_access',{p_user_id:readerId,p_role:'viewer',p_active:true,p_agricultural_unit_ids:[...assigned.map(row=>row.agricultural_unit_id),ids.unit]})),'Corrección: lector ficticio asignado a agrícola de QA');
  const lots=[],stages=[];
  for(let index=0;index<2;index++){
    const lot=await rpc('create_project_lot',{p_data:{project_id:project.data,field_id:ids.field,code:`CORR-${index}`,name:`Malla ficticia ${index}`,area_ha:5,infrastructure_type_id:ids.infra}});
    check(lot.status===200,'Corrección: malla con identidad propia creada');lots.push(lot.data);
    const sub=await read(`lot_subdivisions?lot_id=eq.${lot.data}&select=id`);check(sub.data?.length===1,'Corrección: subdivisión única identificada');
    const stage=randomUUID();stages.push(stage);
    check(ok(await rpc('save_sowing_stage',{p_data:{id:stage,subdivision_id:sub.data[0].id,crop_id:ids.crop,variety_id:ids.variety,area_ha:5,planned_sowing_date:'2026-01-01'}})),'Corrección: etapa ficticia planeada');
    check(ok(await rpc('transition_sowing_stage',{p_stage_id:stage,p_status:'planted',p_date:'2026-01-02'})),'Corrección: etapa ficticia sembrada');
  }
  const orders=[];
  for(let index=0;index<3;index++){
    const order=randomUUID();orders.push(order);
    check(ok(await rpc('create_application_order',{p_data:{id:order,project_id:project.data,field_id:ids.field,crop_id:ids.crop,method_id:ids.method,indicated_date:'2026-01-03',scheduled_date:'2026-01-04',water_l_ha:100,observations:'Receta ficticia'},p_stage_ids:stages,p_products:[{product_id:ids.product,dose:10}]})),'Corrección: receta común a dos mallas creada por RPC');
  }
  const targets=await read(`application_targets?order_id=in.(${orders.join(',')})&select=id,order_id,stage_id,area_ha,status`);
  const idsFor=order=>targets.data.filter(t=>t.order_id===order).map(t=>t.id);
  check(ok(await rpc('perform_application_targets',{p_order_id:orders[1],p_target_ids:idsFor(orders[1]),p_data:{changed:false,actual_date:'2026-01-04',equipment:'Equipo ficticio'}})),'Corrección: destino realizado de QA');
  check(ok(await rpc('cancel_application_targets',{p_order_id:orders[2],p_target_ids:idsFor(orders[2]),p_reason:'Cancelación ficticia'})),'Corrección: destino cancelado de QA');
  const input={id:randomUUID(),lot_id:lots[0],expected_version:0,name:'Malla corregida por HTTP',area_ha:4,stage_id:stages[0],planned_sowing_date:'2025-12-31',actual_sowing_date:'2026-01-01',reason:'Corrección ficticia por HTTP'};
  const correct=(value,token=adminToken)=>rpc('correct_project_lot',{p_data:value},token);
  const anonymous=await request('/rest/v1/rpc/correct_project_lot',undefined,{p_data:input});
  check([401,403].includes(anonymous.status),'Corrección: anónimo rechazado antes de RPC');
  check((await correct(input,readerToken)).status>=400&&(await correct(input,noAccessToken)).status>=400,'Corrección: lectores no tienen mutación');
  const invalid=await correct({...input,actual_sowing_date:'2026-01-05'});
  check(invalid.status>=400,'Corrección: fecha incompatible rechazada por servidor');
  const before=await read(`lot_corrections?lot_id=eq.${lots[0]}&select=id`);check(before.data?.length===0,'Corrección: error no agrega auditoría parcial');
  const result=await correct(input);check(result.status===200&&result.data===input.id,'Corrección: administrador guarda transacción real por HTTP');
  const lot=await read(`project_lots?id=eq.${lots[0]}&select=id,name,area_ha,correction_version`);
  const stage=await read(`sowing_stages?id=eq.${stages[0]}&select=id,area_ha,planned_sowing_date,actual_sowing_date,status`);
  const after=await read(`application_targets?order_id=in.(${orders.join(',')})&select=id,order_id,stage_id,area_ha,status,area_correction_id`);
  const ours=after.data.filter(t=>t.stage_id===stages[0]), other=after.data.filter(t=>t.stage_id===stages[1]);
  check(lot.data?.[0]?.name===input.name&&Number(lot.data[0].area_ha)===4&&lot.data[0].correction_version===1,'Corrección: relectura conserva nombre superficie y versión');
  check(Number(stage.data?.[0]?.area_ha)===4&&stage.data[0].planned_sowing_date===input.planned_sowing_date&&stage.data[0].actual_sowing_date===input.actual_sowing_date&&stage.data[0].status==='planted','Corrección: siembra conserva identidad y estado con fechas corregidas');
  check(ours.length===3&&ours.every(t=>Number(t.area_ha)===4&&t.area_correction_id===input.id)&&new Set(ours.map(t=>t.status)).size===3,'Corrección: aplica a indicadas realizadas y canceladas');
  check(other.length===3&&other.every(t=>Number(t.area_ha)===5&&!t.area_correction_id),'Corrección: otra malla de las mismas órdenes permanece intacta');
  const history=await read(`lot_corrections?lot_id=eq.${lots[0]}&select=id,version,before,after,changed_by,reason`,readerToken);
  check(history.status===200&&history.data.length===1&&Number(history.data[0].before.lot.area_ha)===5&&Number(history.data[0].after.lot.area_ha)===4&&history.data[0].before.targets.length===3,'Corrección: lector asignado consulta originales y corregidos');
  check((await read(`lot_corrections?lot_id=eq.${lots[0]}&select=id`,noAccessToken)).data?.length===0,'Corrección: RLS oculta historial a lector sin asignación');
  check((await read('lot_corrections?select=request_signature')).status>=400&&(await read('lot_corrections?select=write_set')).status>=400,'Corrección: columnas privadas no se exponen por REST');
  check((await request(`/rest/v1/lot_corrections?id=eq.${input.id}`,adminToken,{reason:'Atajo'},'PATCH')).status>=400,'Corrección: auditoría no se edita por REST');
  check((await request(`/rest/v1/project_lots?id=eq.${lots[0]}`,adminToken,{area_ha:3},'PATCH')).status>=400,'Corrección: REST directo no evade guarda histórica');
  check((await correct(input)).status===200&&(await read(`lot_corrections?lot_id=eq.${lots[0]}&select=id`)).data.length===1,'Corrección: reintento real no duplica versiones');
  check((await correct({...input,id:randomUUID(),name:'Versión obsoleta'})).status>=400,'Corrección: versión obsoleta rechazada');
  const query=await rpc('application_query',{p_query:{operation:'historial',project_id:project.data}});
  check(query.status===200&&query.data.rows.filter(r=>r.stage_id===stages[0]).every(r=>Number(r.area_ha)===4),'Corrección: consulta compartida usa superficie corregida');
  const a={...input,id:randomUUID(),expected_version:1,name:'Corrección concurrente A',area_ha:3},b={...input,id:randomUUID(),expected_version:1,name:'Corrección concurrente B',area_ha:2};
  const race=await Promise.all([correct(a),correct(b)]);
  check(race.filter(ok).length===1&&race.filter(r=>!ok(r)).length===1,'Corrección: carrera HTTP tiene un único ganador');
  const winner=ok(race[0])?a:b;
  const final=await read(`application_targets?order_id=in.(${orders.join(',')})&stage_id=eq.${stages[0]}&select=area_ha,area_correction_id`);
  check(final.data.every(t=>Number(t.area_ha)===winner.area_ha&&t.area_correction_id===winner.id),'Corrección: carrera no mezcla superficies entre recetas');
  check((await correct(winner)).status===200&&(await read(`lot_corrections?lot_id=eq.${lots[0]}&select=id`)).data.length===2,'Corrección: reintento del ganador mantiene dos versiones');
  console.log('Corrección de malla: Auth/REST/RLS reales, historial, alcance y concurrencia comprobados solo en QA aislado.');
}
