# Pendientes de RCFito

Fecha de revisión: 2026-11-02.

| ID | Trabajo | Estado | Responsable | Próxima acción | Fuente |
| --- | --- | --- | --- | --- | --- |
| RCF-001 | Definir el primer alcance de catálogos y proyectos. | cerrada | Propietario del producto | Requisitos integrados y desarrollo autorizado; conservar contratos al evolucionar. | [PRODUCT](PRODUCT.md#primera-entrega-implementada) |
| RCF-002 | Entregar y publicar catálogos/proyectos v0.1.0. | cerrada | Agente principal | Primera publicación privada confirmada. Nueva revisión operativa en RCF-009; accesibilidad adicional en RCF-006. | [Plan de entrega](implementation-plan.md#evidencia-de-cierre) |
| RCF-003 | Preparar y conectar Supabase de operación local. | cerrada | Agente principal y Propietario | Siete servicios y frontend sanos, migración sin pendientes, primera cuenta/login y captura conservada al recargar confirmados. Conservar datos y respaldos; acceso exterior en RCF-008. | [Backend](backend-deployment.md) y [pruebas](TESTING.md#inicio-real-local-verificado) |
| RCF-004 | Captura de aplicaciones, grupos y conteos por etapa. | cerrada | Agente principal y subagentes | Código, 54 pruebas puras, 116 SQL, 40 HTTP y recorridos demo con reuso/cancelación/móvil comprobados; esquema operativo aplicado con respaldo. Lector UI y Docker comprobados sin fixtures; commit/push, workflow y Sites versión 8 confirmados, con nueve checks HTTPS posteriores aprobados. Conservar historial y audiencia vigente. Reporte completo en RCF-011. | [Ficha de aplicaciones](flows/applications.md) y [despliegue](OPERATIONS.md#despliegue-de-aplicaciones-y-grupos) |
| RCF-005 | Revisar hallazgos de dependencias de desarrollo. | pendiente | Por asignar | Revisar las 6 alertas de tooling y actualizar con pruebas compatibles, sin cambios forzados. | [TESTING](TESTING.md#evidencia-de-primera-entrega-2026-10-31) |
| RCF-006 | Completar revisión de accesibilidad. | pendiente | Por asignar | Verificar recorrido completo de teclado, zoom 200 %, altura reducida y contraste medido. | [TESTING](TESTING.md#navegador-de-demostración) |
| RCF-007 | Resolver falso positivo de secreto en ejemplo Supabase. | cerrada | Agente principal | Ejemplos sustituidos por variables, configuración validada y alerta 1 resuelta como falso positivo. | [Seguridad](SECURITY.md#ejemplos-del-proveedor-y-alerta-de-github) |
| RCF-008 | Habilitar acceso remoto HTTPS a Supabase local. | cerrada | Propietario y Agente principal | Quick Tunnel y login confirmados. Conservar PC/Docker activos; actualización automática en RCF-012 y endpoint de operación continua en RCF-010. Móvil no probado. | [Quick Tunnel](OPERATIONS.md#quick-tunnel-gratuito-para-pruebas) y [evidencia](TESTING.md#quick-tunnel-https) |
| RCF-009 | Publicar la revisión con operación local verificada. | cerrada | Agente principal | Código subido y resultado nativo de publicación privada confirmado. Conservar audiencia y evidencia; conectividad remota separada en RCF-008. | [Publicación operativa](OPERATIONS.md#publicación-de-la-revisión-operativa) |
| RCF-010 | Definir un endpoint estable para operación remota. | cerrada | Propietario | El Propietario confirmó el 2026-11-01 que ya quedó resuelto y solicitó su cierre. Conservar la configuración aceptada y los límites técnicos documentados. | [Cierre confirmado](OPERATIONS.md#cierres-confirmados-por-el-propietario) |
| RCF-011 | Reporte completo de aplicaciones con filtros y agrupaciones. | cerrada | Propietario y Agente principal | El Propietario confirmó el 2026-11-01 que ya quedó terminado y solicitó su cierre. Conservar los requisitos y las entregas de consulta publicadas. | [Reporte](PRODUCT.md#reporte) |
| RCF-012 | Actualizar Sites automáticamente al cambiar el Quick Tunnel. | cerrada | Agente principal | Worker con ruta fija, registro R2 con caducidad y tarea Windows activos; 34 pruebas y nueve comprobaciones HTTPS antes/después de reiniciar el conector aprobadas. Conservar sesión Windows/Docker y credenciales privadas. | [Conexión automática](tunnel-auto-update.md) y [evidencia](TESTING.md#actualización-automática-del-túnel) |
| RCF-013 | Edición válida en los diez catálogos con motivos de bloqueo e historial. | cerrada | Agente principal | Commit 5768f9a publicado en GitHub y Sites; frontend Docker actualizado. Conservar historial y completar accesibilidad general en RCF-006. | [Ficha de catálogos](flows/catalogs.md#edición-válida-e-historial) y [publicación](OPERATIONS.md#publicación-de-edición-de-catálogos) |
| RCF-014 | Captura con IA, número por etapa y Nota de la aplicación. | cerrada | Propietario y Agente principal | Implementación publicada; el Propietario confirmó el 2026-11-01 que el pendiente ya quedó terminado y solicitó su cierre. | [Captura con IA](flows/ai-capture.md) |
| RCF-015 | Corregir selección de cultivo y mostrar variedades en grupos. | cerrada | Agente principal | Commit c10976e publicado en GitHub y Sites versión 12; frontend Docker actualizado y QA demo/móvil aprobado. | [Ficha de grupos](flows/applications.md#selección-de-cultivo-y-variedad-en-grupos) y [publicación](OPERATIONS.md#publicación-de-cultivo-y-variedad-en-grupos) |
| RCF-016 | Configurar IA desde Conexión y preferencias solo para administrador. | cerrada | Agente principal | Commit f83529d en GitHub y Sites versión 13; frontend Docker actualizado. 136 pruebas, QA y 13 verificaciones posteriores aprobadas. RCF-014 cerrado por confirmación del Propietario el 2026-11-01. | [Configuración IA](flows/ai-settings.md) y [operación](OPERATIONS.md#configuración-de-ia-en-el-servidor) |
| RCF-017 | Heredar cultivo de las siembras en captura sin historia previa. | cerrada | Agente principal | Commit 0d33a3f en GitHub y Sites versión 14; frontend Docker actualizado. 140 pruebas, QA demo y nueve comprobaciones posteriores aprobadas. | [Captura](flows/ai-capture.md#cultivo-registrado-en-primeras-aplicaciones) y [publicación](OPERATIONS.md#corrección-de-cultivo-en-la-captura) |
| RCF-018 | Completar contexto conocido y explicar pendientes para aprobar captura IA. | cerrada | Agente principal y revisión independiente | Commit 6b0bd2c en GitHub y Sites versión 15; frontend Docker actualizado. 161 pruebas, QA demo/guardado/móvil y once comprobaciones posteriores aprobadas. | [Captura](flows/ai-capture.md#autocompletado-y-pendientes-de-aprobación) y [publicación](OPERATIONS.md#autocompletado-y-pendientes-de-aprobación) |
| RCF-019 | Editar aplicaciones con productos, dosis, fechas e historial. | cerrada | Agente principal y revisión independiente | Commit 7942b85 en GitHub y Sites versión 16; frontend Docker actualizado. 181 pruebas, 244 SQL, 71 HTTP y 14 verificaciones posteriores aprobadas. Respaldo y migración operativa 4/0 confirmados, sin cambiar conteos. | [Ficha de edición](flows/application-editing.md) y [operación](OPERATIONS.md#edición-de-aplicaciones-e-historial) |
| RCF-020 | Sinónimos de productos, conflictos y selector por nombre/ingredientes. | cerrada | Agente principal y revisión independiente | Commit cf245f9 en GitHub y Sites versión17; frontend Docker actualizado. 197 pruebas, 308 SQL, 87 HTTP y 16 verificaciones posteriores aprobadas. Respaldo/migración operativa5/0 confirmados. | [Ficha](flows/product-synonyms.md) y [operación](OPERATIONS.md#sinónimos-y-selector-de-productos) |
| RCF-021 | Catálogo de usos/clasificaciones y relación principal de ingredientes. | cerrada | Agente principal | Commit a98f662 en GitHub y Sites versión 18; frontend Docker actualizado. 211 pruebas integradas, 327 SQL, 99 HTTP y 12 comprobaciones posteriores aprobadas. Respaldo y migración operativa 6/0; historial conservado. | [Ficha](flows/ingredient-classifications.md) y [operación](OPERATIONS.md#usos-de-ingredientes) |
| RCF-022 | Dashboard de productos registrados: tabla, ranking e historial. | cerrada | Agente principal y revisión independiente | Commit 5266322 en GitHub y Sites versión 19; Todas por defecto, estado y temporadas anteriores. 215 pruebas, tipos/build, QA demo/móvil y tres comprobaciones HTTP aprobadas. | [Ficha](flows/product-dashboard.md) y [publicación](OPERATIONS.md#dashboard-de-uso-de-productos) |
| RCF-023 | Resumen por lote, productos e historial y orden por cantidad. | cerrada | Agente principal y revisión independiente | Commit ce7ed07 en GitHub y Sites versión 20; 224 pruebas, tipos/build, QA demo/móvil/lector y tres comprobaciones HTTP aprobadas. Todas por defecto y orden ascendente mixto conservados. | [Ficha](flows/product-dashboard.md#ampliación-resumen-por-lote) y [publicación](OPERATIONS.md#publicación-del-resumen-por-lote) |
| RCF-024 | Conservar capturas al confirmar o renovar sesión al volver a la ventana. | cerrada | Agente principal | Causa reproducida y corregida; QA de catálogo/aplicación, fallo de consulta y cierre de sesión aprobado con datos ficticios. 224 pruebas y tipos/build aprobados; Docker sano y Sites versión 21 publicados, con conexión y bundle comprobados. | [Contrato](FRONTEND.md#captura-al-recuperar-el-foco) y [regresión](TESTING.md#regresión-de-captura-al-volver-a-la-ventana) |
| RCF-026 | Filtro global por lote para productos, ranking e historial. | cerrada | Agente principal y revisión independiente | Commit 20c8ca6 en GitHub y Sites versión 23; revisión limpia con 228 pruebas, tipos/build/checker, QA demo/móvil y tres comprobaciones HTTP aprobados. Todas y audiencia conservadas. | [Ficha](flows/product-dashboard.md#filtro-global-por-lote) y [operación](OPERATIONS.md#publicación-del-filtro-global-por-lote) |
| RCF-027 | Documentar y aplicar dos decimales en reportes. | cerrada | Agente principal | Commit 672dd1b en GitHub y Sites versión 24; 228 pruebas, ocho comprobaciones de formato, tipos/build/checker, QA demo/móvil y tres checks HTTP aprobados. Cálculos y conteos conservados. | [Regla](FRONTEND.md#decimales-en-reportes) y [verificación](TESTING.md#decimales-en-reportes) |
| RCF-028 | Consultas de aplicaciones por chat, audio y CLI compartido. | cerrada | Agente principal y especialistas frontend/backend | Fuente integrada 2e530ff en GitHub y Sites versión 25; Docker actualizado. 265 pruebas, 75 SQL, 19 HTTP nuevas, QA ficticio de texto/audio/homónimos y nueve HTTPS aprobados; migración operativa 7/0 con respaldo. Voz/proveedor reales no ejercidos. | [Ficha](flows/application-chat.md) y [publicación](OPERATIONS.md#consultas-por-chat-audio-y-cli) |
| RCF-029 | Conservar origen de grupo y pertenencias históricas de aplicaciones. | cerrada | Agente principal | Publicado en Sites 29 y Docker. Corrección histórica única del 2026-11-02: 23 aplicaciones/92 destinos vinculados al grupo completo por confirmación del Propietario, con respaldo, auditoría privada y 11 comprobaciones aisladas. Valores originales y guardas conservados; registro 9/0. | [Contrato y evidencia](flows/application-group-origin.md#corrección-histórica-confirmada-por-el-propietario) |
| RCF-030 | Captura unificada con última receta activa, búsqueda de anteriores y captura desde cero. | cerrada | Agente principal | Fuente 32c4937 publicada en GitHub, Docker y Sites 31. 301 pruebas, 167 HTTP y QA demo/móvil/lector aprobados; registro operativo 10/0 conservado, sin nuevas migraciones ni escrituras. | [Flujo](flows/recipe-creation.md) y [publicación](OPERATIONS.md#captura-unificada-de-indicaciones--rcf-030) |
| RCF-031 | Ordenar productos de una malla de mayor a menor por cantidad calculada. | pendiente | Por asignar | Al elegir una malla en el resumen y pulsar Ver productos, presentar sus productos en orden descendente por cantidad calculada. Plantear dudas antes de desarrollar. | [Orden solicitado](PRODUCT.md#orden-descendente-de-productos-de-una-malla) |
| RCF-032 | Exportar a PDF los productos registrados y los filtros aplicados. | pendiente | Por asignar | Incluir todos los productos de los resultados filtrados y mostrar los filtros que originan esos resultados. Plantear dudas antes de desarrollar. | [Exportación solicitada](PRODUCT.md#exportación-de-productos-a-pdf) |

| RCF-033 | Contexto implícito y tabla de productos aplicados por malla en consultas y CLI. | cerrada | Agente principal y especialistas | Corrección8aea36e publicada en Sites versión28 y Docker:286 pruebas,132 HTTP, QA móvil y12 controles posteriores aprobados; revisión independiente cerrada. Productos antes de filtros y consulta explícita de indicados sin sustituir realizadas; sin migraciones/escrituras operativas. | [Ficha](flows/application-chat.md#preguntas-equivalentes-y-ausencia-de-realizadas) |
| RCF-034 | Configurar la combinación de colores con la preferencia del equipo por defecto. | pendiente | Por asignar | Permitir configurar los colores o tema de la aplicación; por defecto seguir la preferencia de apariencia del equipo. Plantear dudas sobre opciones y alcance antes de desarrollar. | [Colores configurables](PRODUCT.md#combinación-de-colores-configurable) |
| RCF-035 | Exportar un borrador PDF de la receta antes de guardar. | cerrada | Agente principal | Fuente 16522f0 en GitHub, Docker healthy y Sites 32. 306 pruebas, PDF de una/cuatro páginas y descargas demo verificadas; nueve checks HTTPS y recursos publicados aprobados. Exportar admite fecha pendiente, sin crear órdenes ni reservar números. | [Flujo y contrato](flows/recipe-draft-pdf.md) y [publicación](OPERATIONS.md#pdf-del-borrador-de-receta--rcf-035) |

Estados y cierre: [DOCUMENTATION](../.project-standards/DOCUMENTATION.md#planes-decisiones-y-deuda).
Una tarea registrada no autoriza implementarla. Conservar su ID y actualizar su
fuente e índice juntos. Cerrar con evidencia, distinguiendo código, pruebas,
instalación y publicación.

Antes de desarrollar un pendiente se aplica la
[regla de dudas previas](../AGENTS.md#antes-de-desarrollar-un-pendiente).

## Revisión del grupo guardado en la aplicación

RCF-029, registrado el 2026-11-01. Revisar si el registro de una aplicación
conserva el grupo al que pertenece el lote cuando existe esa pertenencia.
Comprobar qué se guarda, dónde persiste y si se recupera al volver a consultar
la aplicación. Entregar la conclusión y, si falta información, el ajuste
propuesto. Registrar esta revisión no equivale a afirmar que ya está resuelta.

### Propuesta de solución para RCF-029

Solicitud del Propietario el 2026-11-02: «como resolverias rcf-029».
Diagnóstico por inspección de código, sin consultar datos de operación:

- [Captura](../src/features/applications.tsx): `groupId` selecciona etapas, pero
  el comando de creación envía destinos sin la identidad del grupo.
- [Modelo](../src/domain/model.ts) y [adaptador](../src/data/supabase.ts): la orden
  no contiene ni recupera grupo de origen o pertenencias históricas por destino.
- [Esquema](../supabase/migrations/20261101013723_applications_and_groups.sql)
  y [RPC vigente de creación](../supabase/migrations/20261101022356_application_capture_source_and_stage_number.sql):
  las aplicaciones persisten destinos y sus snapshots, mientras que las
  pertenencias se guardan aparte en `sowing_group_members`. Las migraciones
  revisadas no vinculan ese grupo con la aplicación emitida.

Propuesta del agente, autorizada por el Propietario el 2026-11-02 mediante
«adelatne». Implementación y evidencia en [la ficha](flows/application-group-origin.md):

1. Guardar en la orden el **grupo elegido para emitirla**, con ID y nombre al
   registrar. Conservar su identidad aunque el grupo se renombre o cambie.
2. Conservar por destino las **pertenencias a grupos al momento del registro**,
   calculadas por el servidor. La relación real es con etapas, no con el nombre
   del lote, y puede haber más de un grupo. Esta información no convierte una
   captura individual en una receta emitida para un grupo.
3. Distinguir selección de grupo, selección manual y origen histórico desconocido.
   La ausencia del dato en una orden antigua no acredita selección manual ni
   ausencia de pertenencia. Si se modifican los destinos del grupo en la captura,
   volver a selección manual, como hace hoy el formulario.
4. Validar grupo activo, ámbito y destinos vigentes en la RPC, guardar la orden y
   sus referencias en una sola transacción y conservar la protección de reintentos.
   Los nombres históricos se obtienen en servidor; no se confía en snapshots
   enviados por el navegador. Una migración nueva y compatible no reescribe
   migraciones aplicadas ni modifica las mezclas o números existentes.
5. Recuperar estos datos en el adaptador y mostrarlos en el detalle después de
   recargar. RCF-030 usa el grupo de origen confirmado para encontrar la última
   receta emitida para ese grupo; las pertenencias actuales no sustituyen ese dato.
6. Para órdenes antiguas, mostrar **Grupo de origen no registrado**. No completar
   automáticamente comparando destinos o pertenencias actuales. Una eventual
   vinculación retrospectiva requiere evidencia y un registro de quién la confirmó.

Los casos de origen grupal/individual, renombre, varias pertenencias, lector,
reintentos y recarga quedaron comprobados en QA aislado/demo. Migración operativa
aplicada con respaldo y sin modificar valores originales; GitHub, Docker y Sites
versión 29 publicados. Solo se acreditan escrituras nuevas en QA aislado/demo.
El cierre se conserva en [OPERATIONS](OPERATIONS.md#origen-de-grupo-en-aplicaciones).

## Cierres confirmados el 2026-11-01

El Propietario indicó «rcf-014, rcf-010, rcf-011 ya quedaron ciérralas».
Los tres registros quedan cerrados por esa confirmación directa. Se conserva
la evidencia técnica histórica; esta actualización documental no ejecutó una
nueva prueba de proveedor IA ni cambió conectividad o reportes.
También se registraron RCF-029 y RCF-030 y la regla de dudas previas en AGENTS.

## Registro de decisiones y entregas

2026-10-31: adopción local del estándar 4.3.0, con copia íntegra del bundle,
configuración, documentación y workflow. Evidencia histórica en
[STANDARDS](STANDARDS.md#evidencia-de-adopción).

2026-10-31: el Propietario definió siembras por temporada/agrícola, lotes propios,
subdivisión única por defecto, etapas sucesivas con planeación anticipada,
catálogos de producto/ingredientes y concentración opcional, infraestructura por
lote y consulta por agrícolas asignadas. React y la API de Supabase fueron
seleccionados; equipo utilizado será texto en aplicaciones futuras.

2026-10-31: autorizado el desarrollo de catálogos y proyectos, subagentes,
`.gitignore`, commit/push y publicación Sites. Implementación revisable con
15 pruebas de dominio, build/tipos aprobados, 48 comprobaciones SQL y 12 de
Auth/REST/Edge/RLS en entornos aislados. Navegador demo verificado a 1440/375 px
según [TESTING](TESTING.md); las pruebas de navegador y backend son separadas.
El stack de QA quedó detenido y limpio. La imagen frontend respondió HTTP 200
en un contenedor efímero, después retirado. Código subido a GitHub en
`86711d964da6d943e5553a755e2253aa72b787c4`; Sites confirmó publicación privada
exitosa en [RCFito](https://rcfito.paxxa.chatgpt.site), con evidencia en
[OPERATIONS](OPERATIONS.md#primera-publicación-confirmada).

2026-10-31: el Propietario solicitó iniciar Supabase Docker y conectar datos
reales, sin dominio definido. Se adopta arranque local en loopback:5180, con siete
servicios sanos, secretos/volúmenes persistentes y JSON público del frontend.
Se añaden validación de conexión (17 pruebas totales), migración gestionada y
asistente temporal para que el Propietario elija la contraseña del primer
administrador. El cierre local se registra abajo; HTTPS exterior se conserva
como pendiente independiente RCF-008.

Se confirmó una migración aplicada y cero pendientes, pantalla de acceso real,
salud Auth 200, registro público deshabilitado, rechazo REST anónimo 401 y rutas
ajenas al proxy 404. Antes del alta inicial se consultaron cero usuarios,
agrícolas y proyectos.

El Propietario completó el alta y confirmó que ya entró. Navegador en Supabase
real con rol administrador, captura confirmada y registro conservado al recargar;
SQL corroboró un administrador activo, una agrícola y cero proyectos. Sin
fixtures ni datos operativos identificables en Git. Asistente inicial detenido.
RCF-003 queda cerrado; la actualización privada de Sites de esta revisión está
confirmada en RCF-009, independiente del HTTPS remoto pendiente.

2026-10-31: el Propietario eligió Quick Tunnel gratuito, sin comprar dominio.
Se añadió un proxy API y conector en un grupo Compose separado, sin modificar
datos, secretos ni configuración privada de Supabase. Veinte comprobaciones
HTTPS aprobaron y una revisión independiente confirmó el cierre de dos defectos
en rutas codificadas y recuperación de la dirección desde logs. La conexión se
guardó en el navegador del Site y se publicó como valor inicial, con resultado
nativo `succeeded`. El Propietario confirmó su login desde el Site mediante
«Ya inicié sesión» y `status` confirmó el mismo túnel activo. RCF-008 queda cerrado
para este acceso temporal de prueba; dirección estable separada en RCF-010.

2026-10-31: autorizado desarrollar captura de aplicaciones y grupos con
subagentes. El Propietario precisó que las diferencias de productos/dosis/agua
serán raras: por defecto se confirma lo indicado, y una opción explícita habilita
la copia real editable. Se redactó la ficha antes de implementar UI. RCF-004
pasa a en curso con lista/detalle/conteos; el reporte completo queda separado
como propuesta RCF-011.

Ampliación implementada: 54 pruebas puras totales (20 de aplicaciones), 116 SQL
y 40 HTTP aislados aprobados. Navegador demo verificó indicación, realización
habitual, excepción con ambas mezclas y creación de grupo. Se corrigieron los
hallazgos de historial, bloqueos, formato de dosis y selección táctil. Respaldo
privado generado y migración aditiva aplicada en operación (dos/cero pendientes),
sin fixtures. El frontend Docker se comprobó con sesión administradora y lista
real vacía, sin inserciones. El lector demo a 375 px no ofrece Nueva indicación.
Build, 54 pruebas, tipos y docs aprobaron en el checkout aislado. Publicación de
Sites confirmó la versión 8 desde el commit validado y el workflow aprobó; nueve
checks HTTPS posteriores pasaron sin crear datos. RCF-004 queda cerrado, sin
atribuir al servidor real las escrituras demo. Reporte completo en RCF-011 y
teclado/texto 200 % en RCF-006 permanecen pendientes por separado.

2026-10-31: el Propietario solicitó actualizar automáticamente Sites cuando cambie
el túnel. Se publicó la ruta fija `/supabase` y se instaló el monitor de Windows
con registro R2 limitado a URL/vigencia. La URL cambió al reiniciar solo el
conector y se renovó sin republicar el Site; 34 pruebas y nueve verificaciones
HTTPS antes/después aprobaron. El Site ya figuraba público al desplegar y esa
audiencia se conservó. RCF-012 cerrado; el endpoint continuo sigue en RCF-010.

2026-10-31: el Propietario autorizó edición de campos válidos en todos los catálogos,
con motivo visible de bloqueo y conservación de historial. RCF-013 registra
la implementación y evidencia local; la publicación se confirma por separado.

2026-10-31: RCF-013 cerrado tras integrar y publicar catálogos sobre la revisión
de aplicaciones, con resultado nativo de Sites y frontend Docker actualizado.
La evidencia de publicación está en OPERATIONS.
