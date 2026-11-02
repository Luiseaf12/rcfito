# Origen de grupo y pertenencia histórica de aplicaciones

RCF-029. Desarrollo autorizado por el Propietario mediante «adelatne» el
2026-11-02, después de revisar la propuesta y confirmar que debe distinguirse
una indicación para todo el grupo de una individual de un lote que pertenezca
a ese grupo. La pantalla propuesta de recetas se mantiene en RCF-030.

## Contrato

- **Todo el grupo:** el usuario eligió un grupo guardado y la aplicación incluye
  todos sus destinos sembrados vigentes del mismo proyecto, campo y cultivo.
  Etapas retiradas/cerradas conservan su historial y quedan excluidas.
- **Individual:** selección manual de destinos de un solo lote, incluso cuando
  tenga varias subdivisiones o pertenezca a uno o varios grupos.
- **Selección manual:** destinos de varios lotes elegidos sin emitir para un
  grupo guardado. Coincidir con sus integrantes no acredita origen grupal.
- **Origen no registrado:** órdenes anteriores que carecen de evidencia del
  grupo utilizado. No se reconstruyen a partir de pertenencias actuales.

La orden conserva ID y nombre del grupo elegido al emitirla. Cada destino
conserva por separado los IDs y nombres de sus grupos activos al registrar.
Estas pertenencias no convierten una indicación individual en una grupal.
Un arreglo vacío significa ausencia de grupos activos; `null` significa
pertenencia histórica no registrada. Cambios posteriores del grupo no
reescriben ninguno de esos datos.

La identidad de los destinos sigue siendo lote/subdivisión/etapa. El origen se
conserva al editar la indicación, realizar, corregir o cancelar destinos. Una
orden emitida para el grupo no acredita realización completa: sus estados y
fechas reales siguen siendo independientes por destino.

## Recorrido y recuperación

- Usuario/objetivo: administrador que indica una aplicación y necesita conservar
  si la emitió para el grupo o para destinos elegidos manualmente.
- Entrada: Nueva indicación, con proyecto activo, campo, cultivo y etapas vigentes.
- Recorrido: elegir grupo o destinos → revisar mezcla y datos → guardar por RPC →
  consultar origen y pertenencias en el detalle, también después de recargar.
- Al elegir un grupo se anuncia el origen. Ajustar su lista de destinos vuelve
  a selección manual. Un cambio concurrente de integrantes obliga a revisar el
  grupo completo; el servidor rechaza una emisión grupal parcial.
- Errores: se conserva el borrador y se muestran los errores del guardado. El
  reintento idéntico conserva identidad, origen y snapshots originales, incluso
  tras renombrar, retirar miembros o desactivar el grupo.
- Consulta: administrador y lector autorizado ven el mismo dato histórico dentro
  del ámbito existente. El lector no puede crearlo ni modificarlo.
- Éxito observable: nueva orden y destinos con origen/pertenencias persistidos;
  la recarga no los sustituye por la configuración actual del grupo.

## Implementación

[Migración aditiva](../../supabase/migrations/20261102152713_application_group_origin.sql):
`selection_origin`, `source_group_id` y `source_group_name` en la orden;
`group_memberships_snapshot` en el destino. Los registros anteriores quedan
desconocidos, sin backfill por coincidencia. La RPC valida grupo activo, ámbito
y conjunto completo, deriva nombres/pertenencias en servidor y los guarda junto
a la aplicación. Conserva la firma anterior cuando no se envía grupo y mantiene
los bloqueos ordenados de etapas y la asignación de números.

Las guardas impiden reescribir los campos históricos. Se reutilizan RLS y los
grants existentes, sin agregar tablas expuestas. El adaptador recupera y valida
los campos; el dominio demo implementa el mismo recorrido como simulación.
El formulario y el detalle usan los controles existentes de shadcn. La grilla
de contexto evita contención de tamaño para conservar visibles sus campos al
aparecer los destinos; ver [FRONTEND](../FRONTEND.md).

## Evidencia y límites

2026-11-02: 290 pruebas de aplicación, 351 SQL aisladas y 153 comprobaciones
HTTP/Auth/REST/RLS aprobadas; estas últimas incluyen 21 del origen de grupo.
Advisors de seguridad del stack aislado: cero WARN/ERROR. Tipos/build aprobados.

Navegador demo: crear grupo, indicar para ese grupo, indicar individualmente
para el mismo lote y recargar ambos detalles; origen distinto y pertenencia
conservados. Validación de dosis con captura conservada; contexto visible tras
seleccionar cultivo/grupo. Revisión de detalle a 1440/375 px y sin desbordamiento
horizontal general a 375 px. Teclado completo, zoom 200 % y contraste medido
permanecen en RCF-006. Hubo autorrevisión, sin revisión independiente.

Aplicación operativa y publicación: pendientes de registrar en
[OPERATIONS](../OPERATIONS.md#origen-de-grupo-en-aplicaciones).
