# PDF del borrador de receta — RCF-035

Solicitud del Propietario del 2026-11-02, posterior a RCF-030. Dudas resueltas:
incluir solo dosis y agua por hectárea; permitir exportar sin fecha programada,
mostrando «Fecha programada por confirmar». Guardar conserva la fecha obligatoria.

## Flujo

- Usuario y objetivo: la administración prepara una receta y descarga una copia
  para enviarla por su cuenta y confirmar destinos, productos y dosis antes de guardar.
- Entrada: **Nueva indicación**, desde receta anterior o desde cero; también la
  revisión de captura con IA. Requiere destinos vigentes y datos válidos, salvo la
  fecha programada vacía. No se consulta ni escribe una orden nueva al exportar.
- Recorrido: elegir destinos y completar mezcla → pulsar **Exportar borrador PDF**
  → revisar/compartir el archivo descargado → incorporar correcciones y volver a
  exportar si cambian datos → completar fecha y guardar cuando corresponda.
- Alternativas: un dato inválido, producto inactivo, unidad del mensaje sin
  resolver, destino ambiguo o receta base obsoleta bloquea la exportación y muestra
  el motivo. Lector no dispone de creación ni de este botón.
- Recuperación: corregir campos o volver a exportar; un fallo de descarga,
  tipografía o generación conserva la captura. Durante la preparación se evita
  guardar o iniciar otra exportación. Se mantiene la protección al salir.
- Éxito observable: descarga de un PDF identificado como **PARA REVISIÓN - NO
  GUARDADO**; el formulario permanece abierto sin crear aplicaciones ni reservar
  numeración. La confirmación externa no se registra como aprobación en el sistema.
- Evidencia: pruebas y recorridos descritos en [TESTING](../TESTING.md#pdf-del-borrador-de-receta--rcf-035).

## Contenido y precisión

El PDF incluye agrícola, proyecto/temporada, campo, cultivo, medio, fecha de
indicación, fecha programada o texto pendiente, responsable, origen de selección,
receta y revisión base si corresponde, número propuesto si se capturó y nota.
Detalla cada lote/subdivisión/etapa, variedad y superficie. La numeración
automática se asigna al guardar; el PDF no anticipa ni reserva esos números.

La mezcla contiene código y nombre comercial, dosis en g/ha o ml/ha y agua en
L/ha. No calcula cantidades totales de producto ni agua para los destinos.
Conserva la precisión de captura: hasta seis decimales en dosis y cuatro en agua,
sin convertir una dosis pequeña en cero. Superficies usan dos decimales.
Es una copia de captura para revisión; la regla de dos decimales de los reportes
agregados sigue vigente. Se exportan los datos editados de la nueva indicación.

La referencia BR combina el identificador transitorio con una huella del
contenido. Si cambia un destino, dosis, fecha u otro dato de la copia, cambia
la referencia; repetir sin cambios conserva esa referencia aunque cambie la
hora de generación. Se imprime en cada página con fecha/hora de Mazatlán y
numeración de páginas. No constituye firma, folio guardado ni autorización.

## Fronteras y verificación

El dominio construye un snapshot independiente y reutiliza las validaciones de
captura, origen y versión. La única excepción del PDF es la fecha programada
vacía. No modifica `mutate`, RPC, esquema, permisos ni estados de aplicaciones.
El renderizador recibe texto/tablas y no inserta HTML ni envía información a
servicios externos. jsPDF/AutoTable y las fuentes locales se cargan al exportar.
Bitstream Vera se distribuye sin modificaciones y con su licencia pública en
`/licenses/bitstream-vera.txt`; caracteres no representables producen un error
explícito en lugar de sustituir nombres silenciosamente.

QA del 2026-11-02: 306 pruebas, tipos y build aprobados; fixtures PDF de una y
cuatro páginas renderizados e inspeccionados, con encabezados/pies repetidos,
28 destinos, ocho productos, dosis mínima 0.000001 y nota extensa. Descargas
reales del navegador en demo verificadas desde receta anterior, tras editar
0.123456 ml/ha y 120.1234 L/ha, y desde revisión ficticia de IA sin fecha
programada. Guardar sin fecha sigue bloqueado. Móvil 375 px sin desbordamiento.
No se usa proveedor de IA ni se crean datos operativos en estas pruebas.

Fuente `16522f0` publicada en GitHub, Docker healthy y Sites versión 32 con
resultado `succeeded`. Nueve controles HTTPS de conexión y verificación de bundle
exacto, módulo PDF, fuentes, licencia, Auth y rechazo anónimo tanto en Docker como
en Sites aprobados. Audiencia conservada, sin nuevas migraciones ni escrituras
operativas. [Registro](../OPERATIONS.md#pdf-del-borrador-de-receta--rcf-035).
