# Dashboard de uso de productos

Autorizado por el Propietario el 2026-11-01: tabla de productos, ranking por
aplicaciones e historial al seleccionar, solo realizadas; filtros de agrícola,
cultivo y etapa. Incluye commit/push a GitHub y publicación en el Site existente
con su audiencia conservada. No sustituye el reporte completo RCF-011.

## Flujo

- Usuario y objetivo: administrador o lector autorizado que necesita conocer uso,
  cantidades, dosis y fechas por producto.
- Entrada: Resumen (`/`), tras cargar el workspace autorizado. Se consultan las
  temporadas activas de las agrícolas disponibles, incluidas sus etapas cerradas.
- Recorrido: elegir agrícola/cultivo/etapa → consultar resumen, ranking y tabla →
  seleccionar Ver historial en un producto → revisar sus realizaciones y cerrar,
  conservando filtros y orden.
- Alternativas: sin temporada activa, sin aplicaciones realizadas o filtros sin
  coincidencias muestran vacío explicativo; los datos incompletos se identifican
  y no se convierten en cero ni toman valores indicados.
- Recuperación: limpiar filtros; ante error de carga usar Actualizar del shell.
  El error de servidor se conserva visible y no acredita información actualizada.
- Éxito observable: métricas, ranking e historial concuerdan con los destinos
  realizados seleccionados. No hay escritura ni comparación programado/ejecutado.
- Evidencia: pruebas puras y navegador pendientes hasta completar la entrega.

## Cálculos y filtros

Solo `performed`, con fecha real y productos reales propios del destino. La
consulta usa las correcciones reales vigentes hidratadas por el adaptador. Nunca
recurre a la mezcla indicada, fecha programada ni dosis del catálogo.

- Aplicaciones por producto: destinos realizados que lo contienen. Una mezcla
  con varios productos contribuye una vez a cada producto y una vez al conteo
  general. El número capturado de aplicación no sustituye un conteo.
- Cantidad: suma de dosis real × superficie histórica del destino. Se identifica
  como calculada, no como medición de consumo; ml se presentan en L y g en kg.
- Superficie acumulada: suma de hectáreas de sus aplicaciones, con repetición de
  superficie cuando hubo aplicaciones sucesivas; no es superficie física única.
- Dosis promedio: cantidad en unidad base / superficie acumulada, sin redondeos
  intermedios. Unidad ml/ha o g/ha; no se mezclan unidades.
- Última aplicación: máximo de fecha real. Historial descendente por esa fecha.
- Destinos: número de etapas distintas que recibieron el producto.
- Producto: identidad y unidad propias, conservando el nombre histórico real;
  productos inactivos y etapas cerradas siguen apareciendo si fueron utilizados.
- Agrícola y cultivo son identidades, etapa es el número local de siembra de
  cada subdivisión. Elegir Etapa 1 puede reunir varias subdivisiones. Cambiar
  agrícola/cultivo retira filtros dependientes incompatibles. Las tres selecciones
  permanecen en la URL, sin guardar datos de negocio.

## Presentación y permisos

Reutiliza shell, Card, FieldGroup/FormSelect, Table, Button, Alert, Empty y
RecordDialog sobre shadcn/Radix. Tabla ordenable y paginada, ranking de diez
productos por conteo e historial paginado en diálogo con título, Escape y retorno
de foco. Cantidades separadas por unidad, fechas reales y unidades visibles.
Scroll horizontal contenido a las tablas en móvil; no hay gráficos financieros.

El dominio recibe el workspace ya autorizado. Demo usa scopeWorkspace y datos
ficticios; Supabase mantiene Auth/RLS/asignaciones. No hay endpoint privilegiado,
migración ni consultas nuevas que amplíen el acceso. QA nunca carga fixtures en
operación ni modifica el `.env` preexistente.

## Verificación y publicación

Estado: en implementación. Registrar aquí resultados y límites antes del cierre;
evidencia nativa de Sites en [OPERATIONS](../OPERATIONS.md).
