// Privileged operation. The caller is verified against Auth and server-controlled
// profiles before the service key is used. No client metadata grants access.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim()).filter(Boolean);

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const cors: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && allowedOrigins.includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
  const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
  if (origin && !allowedOrigins.includes(origin)) return respond({ error: 'Origen no autorizado.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);

  const base = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!base || !publicKey || !serviceKey) return respond({ error: 'Servidor de usuarios no configurado.' }, 503);
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Inicia sesión como administrador.' }, 401);

  const request = (path: string, headers: Record<string, string>, method = 'GET', body?: unknown) => fetch(`${base}${path}`, {
    method, headers: { ...headers, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  const callerHeaders = { apikey: publicKey, authorization };
  let createdId: string | undefined;
  const privateHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
  try {
    const identityResponse = await request('/auth/v1/user', callerHeaders);
    if (!identityResponse.ok) return respond({ error: 'Sesión inválida o vencida.' }, 401);
    const identity = await identityResponse.json();
    if (!uuid.test(identity.id ?? '')) return respond({ error: 'Sesión inválida.' }, 401);
    const profileResponse = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(identity.id)}&select=role,active`, callerHeaders);
    const profiles = profileResponse.ok ? await profileResponse.json() : [];
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0].role !== 'admin' || profiles[0].active !== true) {
      return respond({ error: 'Esta operación requiere un administrador activo.' }, 403);
    }

    const raw = await req.text();
    if (raw.length > 20000) return respond({ error: 'La solicitud es demasiado grande.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return respond({ error: 'Solicitud JSON inválida.' }, 400); }
    if (typeof body?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || typeof body.password !== 'string' || body.password.length < 8 || typeof body.display_name !== 'string' || !body.display_name.trim() || !['admin', 'viewer'].includes(body.role) || !Array.isArray(body.agricultural_unit_ids) || body.agricultural_unit_ids.length > 500 || body.agricultural_unit_ids.some((id: unknown) => typeof id !== 'string' || !uuid.test(id))) {
      return respond({ error: 'Revisa nombre, correo, contraseña de al menos ocho caracteres, rol y agrícolas.' }, 400);
    }
    if(body.menu_permissions!==undefined&&(!Array.isArray(body.menu_permissions)||body.menu_permissions.length>50||body.menu_permissions.some((key:unknown)=>typeof key!=='string')))return respond({error:'Revisa los permisos de menú.'},400);
    const createdResponse = await request('/auth/v1/admin/users', privateHeaders, 'POST', {
      email: body.email.trim(), password: body.password, email_confirm: true,
      user_metadata: { display_name: body.display_name.trim() },
    });
    if (!createdResponse.ok) return respond({ error: 'No se pudo crear la cuenta. Comprueba si el correo ya está registrado.' }, 409);
    const created = await createdResponse.json();
    createdId = created.id;
    if (typeof createdId !== 'string' || !uuid.test(createdId)) throw new Error('Unexpected Auth response');
    const assign = await request('/rest/v1/rpc/set_user_menu_access', callerHeaders, 'POST', {
      p_user_id: createdId, p_role: body.role, p_active: true,
      p_agricultural_unit_ids: [...new Set(body.agricultural_unit_ids)],
      p_menu_permissions:body.menu_permissions??['summary','projects','applications','queries','groups','catalog:agricultural_units','catalog:fields','catalog:crops','catalog:varieties','catalog:products','catalog:active_ingredients','catalog:ingredient_classifications','catalog:brands','catalog:product_families','catalog:infrastructure_types','catalog:application_methods'],p_expected_version:0,
    });
    if (!assign.ok) throw new Error('Access assignment failed');
    return respond({ id: createdId, email: body.email.trim(), display_name: body.display_name.trim(), role: body.role }, 201);
  } catch {
    if (createdId) {
      try {
        const cleanup = await request(`/auth/v1/admin/users/${encodeURIComponent(createdId)}`, privateHeaders, 'DELETE');
        if (!cleanup.ok) return respond({ error: 'La cuenta se creó sin completar permisos. Requiere revisión administrativa.', partial_user_id: createdId }, 500);
      } catch {
        return respond({ error: 'La cuenta se creó sin completar permisos. Requiere revisión administrativa.', partial_user_id: createdId }, 500);
      }
    }
    return respond({ error: 'No se pudo completar el alta de usuario. No se confirmó el guardado.' }, 500);
  }
});
