# Intervalo entre fechas programadas — RCF-041

Estado: cerrada el 2026-11-05, con implementación, QA y publicación verificadas.
Solicitado y autorizado por el Propietario el 2026-11-05, con commit, push y
publicación condicionados a que las comprobaciones aprueben.

## Recorrido y reglas confirmadas

En `/aplicaciones`, debajo de la fecha programada se muestra **«N días desde la
anterior»**. Abrir esa segunda línea revela la fecha y el folio utilizado como
referencia; el folio permite consultar la receta anterior. La comparación usa
fechas programadas, sin relacionarlas con hoy, la fecha indicada o la realización.

- La anterior es la inmediatamente precedente por número de receta (folio) del
  mismo proyecto/campo/cultivo, origen y selección histórica de etapas. El grupo
  usa su identidad guardada; las selecciones individuales/manuales conservan su
  propio ámbito. No se infiere origen a partir de la pertenencia actual.
- Se exige la misma selección de destinos y etapas para expresar un único
  intervalo conjunto. Un cambio de siembra, grupo o selección inicia otra serie;
  no se reutilizan etapas retiradas ni se inventa una cifra común entre destinos.
- Las recetas totalmente canceladas no participan como referencia ni reciben
  intervalo; muestran «Receta cancelada». Las realizadas y parcialmente canceladas
  sí participan, conservando sus destinos históricos completos.
- La primera de cada serie muestra «Sin receta anterior». Si falta origen,
  identidad del grupo, destinos o una fecha válida, «Sin referencia comparable».
- Mismo día: cero días; día siguiente: un día. Si la fecha programada retrocede
  respecto a la receta anterior, se muestra «N días antes de la anterior», con
  diferencia firmada conservada en el cálculo. Las fechas no se corrigen.
- El listado se ordena por folio numérico descendente antes de paginar. El cálculo
  recorre esa misma secuencia en sentido ascendente, con identidad de desempate;
  la fecha programada no determina cuál receta es la anterior.
- Se usan fechas de la última versión indicada y todo el historial autorizado,
  antes de búsqueda, filtros y paginación. Una revisión o cancelación vuelve a
  calcular las referencias al actualizar los datos.
- La diferencia se calcula en días calendario usando fechas UTC, sin fracciones
  por hora local o cambios horarios. Ejemplo: 4 → 9 → 25 → 30 de septiembre produce
  primera receta → 5 → 16 → 5 días.

## Implementación

[application-schedule](../../src/domain/application-schedule.ts) construye un
índice por origen/destinos sobre las órdenes con indicación vigente. Agrupa destinos
una vez y recorre los folios, sin consultas por fila ni mutaciones del workspace.
[ScheduledDate](../../src/features/application-schedule.tsx) usa Button,
Collapsible y Link existentes para acceso por teclado y toque. El listado conserva
orden por folio descendente, filtros, páginas, selección y acceso al detalle.

No requiere migraciones, dependencias ni permisos nuevos. Los lectores reciben el
mismo cálculo sobre sus datos autorizados. No se modifican recetas, fechas, dosis,
folios o historial; el cálculo es de presentación.

## Verificación

374 pruebas aprobadas, incluidas siete regresiones nuevas de intervalos, ámbitos,
cancelación total/parcial, mismo día, meses/años y año bisiesto, fechas inválidas,
revisiones, referencias fuera del filtro y conservación de datos. Tipos/build y
checker aprobados. Autorrevisión de React, cálculo y aislamiento de ámbitos;
sin revisión independiente ni nueva suite aislada de backend o PDF.

QA demo: cinco días respecto a la receta anterior, cero días en una misma fecha,
primera receta y cancelación total; filtro por folio conserva referencia no visible.
Abrir/cerrar con Enter y toque, enlace al detalle anterior, recarga y recalcular
tras revisar la fecha aprobados. Se corrigió el contraste del texto durante QA
usando la variante ghost existente. Lector demo puede consultar la referencia sin
opciones de escritura. Móvil 375×812 px con tabla desplazable y sin overflow global
(documento 360 px); consola sin avisos/errores. Fecha ficticia restaurada al final,
con sus eventos de revisión conservados únicamente en demo.

Entrega y comprobaciones posteriores:
[OPERATIONS](../OPERATIONS.md#intervalo-programado-de-aplicaciones--rcf-041).


## Corrección de secuencia — RCF-042

Estado: cerrada y publicada en Sites 42 y frontend Docker el 2026-11-05.
El Propietario aclaró el 2026-11-05 que anterior significa
la receta previa por número y solicitó ordenar el listado de mayor a menor receta.
Esta decisión reemplaza la cronología programada de la entrega original RCF-041.

La implementación original elegía la fecha precedente y podía saltarse folios
intermedios con fechas programadas anteriores. La corrección usa un comparador
numérico único para el listado y el cálculo; filtrar/paginar conserva la referencia
del historial completo. Cancelación total y ámbitos de origen/destinos/etapas se
conservan. Se añaden regresiones ficticias de fechas no consecutivas, valores
negativos, singular/plural y orden natural en dos páginas. Sin cambios de datos,
permisos, migraciones ni dependencias.


Verificación de RCF-042: 376 pruebas, incluidos casos ficticios con fechas que
retroceden, folios naturales en dos páginas, signo y singular/plural; tipos y
checker aprobados. Comparación privada de solo lectura contra el caso reportado
aprobada; sin guardar datos reales en el repositorio ni cambiar fechas de operación.
QA demo: folios descendentes con fechas fuera de secuencia, apertura por teclado,
referencia anterior, mensaje de fecha adelantada, búsqueda y recarga aprobados.
Móvil 375×812 px sin overflow global (documento 360 px); consola limpia. Fecha de
prueba restaurada. Autorrevisión; sin revisión independiente ni nuevas suites de
backend/PDF. Fuente `eddc923` publicada en GitHub; entrada y 38 recursos exactos,
Auth y rechazo anónimo aprobados en ambos destinos. Nueve controles HTTPS y
registro de migraciones 12/0 aprobados, sin escrituras de operación.
[Publicación](../OPERATIONS.md#secuencia-descendente-de-recetas--rcf-042).
