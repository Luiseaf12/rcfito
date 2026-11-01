# Pendientes de RCFito

Fecha de revisión: 2026-10-31.

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
| RCF-010 | Definir un endpoint estable para operación remota. | propuesta | Propietario | Elegir una solución estable cuando se requiera operación continua; el Quick Tunnel actual es temporal y gratuito para pruebas. | [Quick Tunnel](OPERATIONS.md#quick-tunnel-gratuito-para-pruebas) |
| RCF-011 | Reporte completo de aplicaciones con filtros y agrupaciones. | propuesta | Por asignar | Concretar columnas y agrupaciones por las dimensiones confirmadas; la lista/detalle actual no sustituye este reporte. Separado del alcance original de RCF-004. | [Reporte](PRODUCT.md#reporte) |
| RCF-012 | Actualizar Sites automáticamente al cambiar el Quick Tunnel. | cerrada | Agente principal | Worker con ruta fija, registro R2 con caducidad y tarea Windows activos; 34 pruebas y nueve comprobaciones HTTPS antes/después de reiniciar el conector aprobadas. Conservar sesión Windows/Docker y credenciales privadas. | [Conexión automática](tunnel-auto-update.md) y [evidencia](TESTING.md#actualización-automática-del-túnel) |
| RCF-013 | Edición válida en los diez catálogos con motivos de bloqueo e historial. | cerrada | Agente principal | Commit 5768f9a publicado en GitHub y Sites; frontend Docker actualizado. Conservar historial y completar accesibilidad general en RCF-006. | [Ficha de catálogos](flows/catalogs.md#edición-válida-e-historial) y [publicación](OPERATIONS.md#publicación-de-edición-de-catálogos) |
| RCF-014 | Captura con IA, número por etapa y Nota de la aplicación. | pendiente | Propietario y Agente principal | Código/pruebas/migración/Docker y publicación Sites versión 11 completados. El Propietario puede ingresar clave/modelo, probar y guardar desde Conexión y preferencias (RCF-016); inferencia real no ejercida. | [Captura con IA](flows/ai-capture.md) |
| RCF-015 | Corregir selección de cultivo y mostrar variedades en grupos. | cerrada | Agente principal | Commit c10976e publicado en GitHub y Sites versión 12; frontend Docker actualizado y QA demo/móvil aprobado. | [Ficha de grupos](flows/applications.md#selección-de-cultivo-y-variedad-en-grupos) y [publicación](OPERATIONS.md#publicación-de-cultivo-y-variedad-en-grupos) |
| RCF-016 | Configurar IA desde Conexión y preferencias solo para administrador. | cerrada | Agente principal | Commit f83529d en GitHub y Sites versión 13; frontend Docker actualizado. 136 pruebas, QA y 13 verificaciones posteriores aprobadas. Activación real en RCF-014 por el Propietario. | [Configuración IA](flows/ai-settings.md) y [operación](OPERATIONS.md#configuración-de-ia-en-el-servidor) |
| RCF-017 | Heredar cultivo de las siembras en captura sin historia previa. | cerrada | Agente principal | Commit 0d33a3f en GitHub y Sites versión 14; frontend Docker actualizado. 140 pruebas, QA demo y nueve comprobaciones posteriores aprobadas. | [Captura](flows/ai-capture.md#cultivo-registrado-en-primeras-aplicaciones) y [publicación](OPERATIONS.md#corrección-de-cultivo-en-la-captura) |
| RCF-018 | Completar contexto conocido y explicar pendientes para aprobar captura IA. | en curso | Agente principal y revisión independiente | 161 pruebas, QA demo/guardado/móvil aprobados; completar publicación Sites y frontend Docker. | [Captura](flows/ai-capture.md#autocompletado-y-pendientes-de-aprobación) y [publicación](OPERATIONS.md#autocompletado-y-pendientes-de-aprobación) |

Estados y cierre: [DOCUMENTATION](../.project-standards/DOCUMENTATION.md#planes-decisiones-y-deuda).
Una tarea registrada no autoriza implementarla. Conservar su ID y actualizar su
fuente e índice juntos. Cerrar con evidencia, distinguiendo código, pruebas,
instalación y publicación.

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
