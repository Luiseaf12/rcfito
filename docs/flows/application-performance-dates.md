# Fecha real e intervalo de aplicaciones — RCF-043

Estado: cerrada y publicada el 2026-11-05 en Sites 43 y frontend Docker.
Solicitud y publicación autorizadas por el Propietario
el 2026-11-05. Sustituye la fecha programada en el listado y el cálculo de
[RCF-041/042](application-schedule.md); conserva su secuencia por folio.

## Objetivo y recorrido

Administrador o lector consulta Aplicaciones con su historial autorizado,
ordenado por receta de mayor a menor. La columna **Fecha real de aplicación**
presenta la realización registrada por destino, sin modificar recetas ni fechas.
Abrir su segunda línea permite consultar fechas e intervalos por lote/subdivisión
y acceder a la receta anterior. La fecha programada sigue disponible en el detalle.

- Una fecha real común se muestra una sola vez. Fechas distintas muestran
  **Varias fechas** y el detalle por destino al desplegar.
- Si existen destinos pendientes y otros realizados, se indica **Aplicación
  parcial** y el número de destinos pendientes, junto con las fechas disponibles.
- Sin realizaciones: **Pendiente de aplicación**. Cancelación total:
  **Cancelada**. Un destino realizado sin fecha válida muestra la ausencia,
  sin sustituirla por la fecha programada ni inventar un intervalo.
- La receta anterior se elige por folio dentro del mismo proyecto/campo/cultivo,
  origen y selección histórica de etapas. Las totalmente canceladas se excluyen;
  las parciales conservan todos sus destinos históricos.
- Los días comparan fechas reales del mismo destino/etapa entre ambas recetas.
  Una receta pendiente, parcialmente cancelada o con fecha inválida sigue siendo
  la anterior; no se salta a una más antigua para obtener una cifra.
- Si falta una fecha real: **Sin fecha para comparar**. Primera receta:
  **Sin receta anterior**. Sin contexto histórico fiable:
  **Sin referencia comparable**. Destino cancelado: **Cancelada**.
- Intervalos iguales y fechas comunes se resumen en la fila. Si difieren las
  fechas o los intervalos, se consultan por destino, sin promedios ni elegir una
  fecha representativa. Se conservan cero, singular/plural y diferencias negativas.
- Se usan días calendario UTC y la realización vigente, incluidas correcciones.
  Se calcula con todo el historial autorizado antes de filtrar o paginar.
- Los filtros **Aplicada desde/hasta** incluyen una receta cuando algún destino
  realizado tiene fecha real válida dentro de ambos límites inclusivos. Sin rango,
  pendientes y canceladas siguen visibles. No se filtra por la programación.

Button y Collapsible existentes conservan teclado, foco y toque; el detalle
ordena lotes/subdivisiones A–Z. La tabla sigue desplazable en móvil. No cambia
realización, revisión, historial, persistencia ni permisos; no requiere migraciones
ni dependencias. Un error de carga conserva el tratamiento existente del workspace.

## Aceptación y evidencia

Comprobar fecha común, fechas distintas, parcial, pendiente, cancelada, anterior
sin fecha, cancelación parcial, corrección de realización, ámbitos históricos,
fechas inválidas, calendario y rango inclusivo. Verificar orden descendente,
referencias fuera de filtros/páginas, recarga, teclado y móvil con datos ficticios.
383 pruebas aprobadas, incluidas 16 de fechas/intervalos reales; tipos y build
aprobados. Autorrevisión de cálculo, ámbitos históricos y React, sin revisión
independiente ni nuevas suites aisladas de backend/PDF, pues no cambia persistencia.

QA en demostración: realización, corrección de fecha y recálculo, intervalo con
receta anterior fuera del filtro, rango real inclusivo, fecha común, varias fechas,
parcial, pendiente, cancelada, detalle por destino A–Z, teclado, enlace y recarga
aprobados. Móvil 375×812 px con documento de 360 px, tabla desplazable y apertura
táctil; consola sin avisos/errores. Realizaciones y corrección ficticias conservadas
con su historial únicamente en la demo del navegador. Sin escrituras en operación.
Fuente `041a926` publicada en GitHub, Docker healthy y Sites 43. Entrada y 38
recursos estáticos exactos con la funcionalidad, Auth y rechazo anónimo aprobados
en ambos destinos; nueve controles HTTPS y ledger 12/0 comprobados. Tipos/build
y checker aprobados; advertencia previa de tamaño de chunk conservada.
[Publicación](../OPERATIONS.md#fecha-real-e-intervalo-de-aplicaciones--rcf-043).
