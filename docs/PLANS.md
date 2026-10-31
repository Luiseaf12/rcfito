# Pendientes de RCFito

Fecha de revisión: 2026-10-31.

| ID | Trabajo | Estado | Responsable | Próxima acción | Fuente |
| --- | --- | --- | --- | --- | --- |
| RCF-001 | Definir el primer alcance de catálogos y proyectos. | cerrada | Propietario del producto | Requisitos integrados y desarrollo autorizado; conservar contratos al evolucionar. | [PRODUCT](PRODUCT.md#primera-entrega-implementada) |
| RCF-002 | Entregar y publicar catálogos/proyectos v0.1.0. | en verificación | Agente principal | Cerrar QA restante, commit/push y publicación privada Sites sobre el árbol validado. | [Plan de entrega](implementation-plan.md#evidencia-de-cierre) |
| RCF-003 | Preparar Supabase de operación y acceso HTTPS. | pendiente | Por asignar | Definir URLs reales, preparar secretos/migraciones/primera cuenta y probar navegador conectado. | [Backend](backend-deployment.md) y [operación](OPERATIONS.md) |
| RCF-004 | Órdenes de aplicación, grupos guardados y reporte. | propuesta | Por asignar | Aclarar si realización asume lo indicado o registra diferencias; definir el flujo de esa entrega. | [Pendientes de producto](PRODUCT.md#por-definir-antes-de-la-propuesta) |
| RCF-005 | Revisar hallazgos de dependencias de desarrollo. | pendiente | Por asignar | Revisar las 6 alertas de tooling y actualizar con pruebas compatibles, sin cambios forzados. | [TESTING](TESTING.md#evidencia-de-primera-entrega-2026-10-31) |

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
El stack de QA quedó detenido y limpio. Operación HTTPS y publicación final
permanecen pendientes de sus propios resultados.
