# Correcciones de malla y siembra vigente — RCF-038

Estado: verificación terminada; instalación y publicación en curso. Solicitud del
Propietario del 2026-11-04.
No se ha aplicado ninguna corrección a datos de operación.

## Decisiones confirmadas

- Permitir corregir el nombre y superficie de la malla sin borrar sus siembras.
- La superficie corregida se aplica a la malla y a su siembra vigente dentro
  del mismo proyecto; las recetas nuevas deben usar la superficie corregida.
- Permitir corregir fecha planeada y fecha real por separado, solo en la etapa
  vigente. Las etapas cerradas conservan sus fechas y datos.
- Conservar valores anteriores, valores corregidos, autor, fecha y motivo de
  cada corrección. Se mantienen identidades, numeración, estados y relaciones.

Confirmación expresa adicional del Propietario: la superficie corregida alcanza
**todas las recetas de esa malla en ese proyecto, incluidas realizadas y
canceladas**, también las de sus etapas históricas. Solo cambian sus hectáreas
vigentes y cantidades calculadas; identidades, estados, números, fechas,
productos, dosis y agua por hectárea permanecen. Las etapas cerradas no se
reescriben: las fechas y la superficie de la siembra se corrigen únicamente
en la vigente. Los valores originales de cada destino quedan en el evento.

## Recorrido implementado

1. Administración abre **Editar** en una malla de un proyecto abierto.
2. Revisa nombre y superficie, y las dos fechas de la siembra vigente.
3. Captura el motivo y revisa los valores anteriores/nuevos y el alcance sobre
   recetas antes de guardar la corrección.
4. El servidor valida y guarda la corrección completa de forma atómica; muestra
   los datos vigentes y permite consultar sus versiones anteriores.

Un error conserva el borrador y explica el campo o conflicto. Cancelar protege
los cambios no guardados. El lector solo consulta el ámbito que tiene asignado.

## Límites técnicos identificados

- La guarda vigente bloquea lotes con cualquier etapa y protege los datos de
  siembras realizadas. Habilitar el botón por sí solo no permite corregirlos.
- Las aplicaciones conservan snapshots de nombre, destino y superficie; dosis
  y gasto de agua se expresan por hectárea. Los reportes calculan cantidades con
  la superficie de cada destino, sin mezclar unidades.
- Una corrección de fecha real debe respetar las aplicaciones existentes y
  la secuencia de etapas. No se cambian sus fechas para hacerla encajar.
- La distribución se valida explícitamente. No se inventan repartos ni ajustes
  proporcionales para una malla subdividida. La comprobación de solo lectura
  confirmó que las mallas actuales usan subdivisión única sin distribuciones
  retiradas; no se consultaron nombres ni se modificaron datos. Corregir solo
  nombre o fechas no exige cambiar una distribución; la corrección conjunta de
  superficie exige subdivisión única y una siembra vigente. Una planeación futura
  que exceda la nueva superficie debe corregirse primero.

## Verificación

320 pruebas puras y 417 comprobaciones PostgreSQL aisladas aprobadas. Cubren los
tres estados de recetas, etapas anteriores, conservación de mezclas/identidades,
validaciones, historial inmutable, permisos, reintento y rollback completo. La
instalación compara conteos y huellas de once tablas antes/después, excluyendo
únicamente los dos campos de metadatos nuevos: no corrige datos al instalar.

QA demo: corrección conjunta persistida tras recargar, segunda versión de solo
nombre, errores sin perder captura, descarte cancelado y lector consultando sin
editar. Móvil 375×450 px sin desbordamiento general; sin avisos ni errores de
consola. Los PDF indican superficie anterior y corregida; archivos ficticios de
una y ocho páginas y descarga real de una página revisados visualmente. Regresión
de PDF sin correcciones de una/seis páginas conservada. Autorrevisión de React,
permisos y guardas, sin revisión independiente. La evidencia HTTP/Auth real y la
entrega se registran en [TESTING](../TESTING.md#correcciones-de-malla--rcf-038) y
[OPERATIONS](../OPERATIONS.md#correcciones-de-malla--rcf-038).
