export async function verifyThemePreferences({request,check,adminToken,readerToken,adminId,readerId}) {
  check((await request('/rest/v1/user_preferences?select=theme')).status===401,'Apariencia: anónimo rechazado');
  check((await request('/rest/v1/user_preferences',adminToken,{user_id:adminId,theme:'dark'})).status===201,'Apariencia: administrador guarda Oscuro');
  const restored=await request('/rest/v1/user_preferences?select=user_id,theme',adminToken);
  check(restored.status===200&&restored.data.length===1&&restored.data[0].theme==='dark','Apariencia: otra consulta recupera preferencia de la cuenta');
  check((await request('/rest/v1/user_preferences?select=theme',readerToken)).data.length===0,'Apariencia: lector no ve preferencia del administrador');
  check((await request('/rest/v1/user_preferences',readerToken,{user_id:readerId,theme:'light'})).status===201,'Apariencia: lector guarda Claro');
  check((await request('/rest/v1/user_preferences',readerToken,{user_id:adminId,theme:'light'})).status===403,'Apariencia: lector no escribe identidad ajena');
  check((await request('/rest/v1/user_preferences',adminToken,{user_id:readerId,theme:'dark'})).status===403,'Apariencia: administrador no escribe identidad ajena');
  check((await request(`/rest/v1/user_preferences?user_id=eq.${readerId}`,readerToken,{theme:'system'},'PATCH')).status===204,'Apariencia: lector vuelve a Sistema');
  const result=await request('/rest/v1/user_preferences?select=user_id,theme',readerToken);
  check(result.status===200&&result.data.length===1&&result.data[0].theme==='system','Apariencia: nueva consulta conserva Sistema');
  check((await request(`/rest/v1/user_preferences?user_id=eq.${readerId}`,readerToken,{theme:'inventado'},'PATCH')).status===400,'Apariencia: valor inválido rechazado');
  check((await request('/rest/v1/user_preferences?select=theme',adminToken)).data[0].theme==='dark','Apariencia: cuenta ajena permanece intacta');
}
