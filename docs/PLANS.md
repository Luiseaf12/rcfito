# Pendientes de RCFito

Fecha de revisión: 2026-10-31.

| ID | Trabajo | Estado | Responsable | Próxima acción | Fuente |
| --- | --- | --- | --- | --- | --- |
| RCF-001 | Definir el primer alcance de catálogos y proyectos. | cerrada | Propietario del producto | Requisitos integrados y desarrollo autorizado; conservar contratos al evolucionar. | [PRODUCT](PRODUCT.md#primera-entrega-implementada) |
| RCF-002 | Entregar y publicar catálogos/proyectos v0.1.0. | cerrada | Agente principal | Código en GitHub y publicación privada confirmada; operación y verificaciones adicionales siguen en RCF-003/006. | [Plan de entrega](implementation-plan.md#evidencia-de-cierre) |
| RCF-003 | Preparar y conectar Supabase de operación local. | en curso | Agente principal y Propietario | Servicios, migración y acceso real en 5180 verificados; completar primera cuenta en asistente privado y probar login/captura/relectura. Acceso exterior separado en RCF-008. | [Backend](backend-deployment.md) y [pruebas](TESTING.md#inicio-real-local-verificación-en-curso) |
| RCF-004 | Órdenes de aplicación, grupos guardados y reporte. | propuesta | Por asignar | Aclarar si realización asume lo indicado o registra diferencias; definir el flujo de esa entrega. | [Pendientes de producto](PRODUCT.md#por-definir-antes-de-la-propuesta) |
| RCF-005 | Revisar hallazgos de dependencias de desarrollo. | pendiente | Por asignar | Revisar las 6 alertas de tooling y actualizar con pruebas compatibles, sin cambios forzados. | [TESTING](TESTING.md#evidencia-de-primera-entrega-2026-10-31) |
| RCF-006 | Completar revisión de accesibilidad. | pendiente | Por asignar | Verificar recorrido completo de teclado, zoom 200 %, altura reducida y contraste medido. | [TESTING](TESTING.md#navegador-de-demostración) |
| RCF-007 | Resolver falso positivo de secreto en ejemplo Supabase. | cerrada | Agente principal | Ejemplos sustituidos por variables, configuración validada y alerta 1 resuelta como falso positivo. | [Seguridad](SECURITY.md#ejemplos-del-proveedor-y-alerta-de-github) |
| RCF-008 | Habilitar acceso remoto HTTPS a Supabase local. | pendiente | Propietario y Agente principal | Definir dominio o endpoint HTTPS, proxy y orígenes; verificar Site/celular contra la misma base. El arranque local no resuelve acceso desde otros dispositivos. | [Operación](OPERATIONS.md#docker-y-supabase) |

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
administrador. Cuenta/login/captura siguen en verificación en RCF-003; HTTPS
exterior se conserva como pendiente independiente RCF-008.

Se confirmó una migración aplicada y cero pendientes, pantalla de acceso real,
salud Auth 200, registro público deshabilitado, rechazo REST anónimo 401 y rutas
ajenas al proxy 404. Antes del alta inicial se consultaron cero usuarios,
agrícolas y proyectos. La contraseña y el alta siguen a cargo del Propietario;
las pruebas del helper no sustituyen esa verificación.
