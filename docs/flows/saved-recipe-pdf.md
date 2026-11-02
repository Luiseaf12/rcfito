# PDF de recetas guardadas — RCF-036

Solicitado por el Propietario el 2026-11-02: incorporar en las recetas ya
guardadas una opción de exportación con formato similar al
[PDF del borrador](recipe-draft-pdf.md).

## Flujo

- Usuario y objetivo: quien puede consultar la receta necesita descargarla
  para compartir una copia legible de sus datos guardados.
- Entrada: detalle de una orden de aplicación accesible al usuario.
- Recorrido: abrir la receta → pulsar Exportar receta PDF → descargar la copia.
- Alternativas: conservar el acceso de consulta y mostrar errores de generación
  sin modificar la receta. La impresión identifica el folio guardado y sus
  versiones; no se etiqueta como borrador sin guardar.
- Recuperación: reintentar la descarga o actualizar los datos consultados.
- Éxito observable: PDF descargado con el mismo lenguaje visual de RCF-035,
  sin crear, editar ni aprobar aplicaciones.
- Evidencia: [pruebas y recorridos](../TESTING.md#pdf-de-recetas-guardadas--rcf-036).

## Alcance confirmado

El Propietario confirmó «la ultima version indicada». El PDF muestra la misma
última indicación que encabeza el detalle de la orden, con folio y revisión,
contexto, productos y dosis hasta seis decimales, agua hasta cuatro y nota.
No incorpora mezclas reales ni calcula cantidades totales de producto/agua.

Se incluyen los destinos originales con sus snapshots de lote/subdivisión,
etapa, variedad y superficie; además número de aplicación, estado y revisión
indicada recibida por destino. Si algunos conservan una revisión anterior,
se advierte expresamente: la mezcla impresa corresponde a la última revisión
de la orden, no sustituye lo indicado anteriormente a esos destinos.

La consulta histórica sigue disponible aunque se cierre el proyecto o se
retiren productos, etapas o grupos. No se reconstruyen nombres/unidades desde
el catálogo vigente cuando existe snapshot guardado. Puede descargar quien
puede consultar esa agrícola, incluido el lector asignado; RLS mantiene la
frontera del servidor. Exportar no crea ni modifica registros.

La plantilla común de tipografía, encabezados, tablas y paginación se extrajo
sin cambiar el contenido de los borradores. Tipos y generación ficticia de
una/cuatro páginas aprobados; primera página renderizada e inspeccionada.

311 pruebas aprobadas: última indicación frente a mezcla real diferente,
revisiones por destino, snapshots históricos, lector asignado, historial faltante
y referencia estable sin mutaciones. Tipos, build y checker aprobados.
PDF guardados de una/seis páginas con 28 destinos, ocho productos y nota extensa
extraídos y renderizados, con encabezados/pies repetidos y sin texto cortado.
Navegador demo: descargas antes y después de una revisión ficticia, recarga,
lector asignado, agrícola ajena no disponible, móvil 375 px y regresión del
borrador sin fecha. Archivos descargados inspeccionados. Autorrevisión de React,
contratos y permisos; no se atribuye revisión independiente.

Fuente `cd165f8` publicada en GitHub, Docker healthy y Sites versión 33 con
resultado `succeeded`. Nueve verificaciones HTTPS de conexión y comprobaciones
del bundle exacto, botón, módulo PDF, fuentes, licencia, Auth y rechazo anónimo
en Docker/Sites aprobadas. Sin nuevas migraciones ni cambios en datos de operación.
[Registro](../OPERATIONS.md#pdf-de-recetas-guardadas--rcf-036).
