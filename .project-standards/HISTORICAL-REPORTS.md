# Reporte histórico

## Alcance

Patrón de consulta para comparar una misma métrica mensual entre años. Aplicar
a reportes nuevos o intervenidos que se definan como **Histórico** en Vales,
Apoyosing o FI. Completar [templates/historical-report.md](templates/historical-report.md)
en la fuente local de producto o flujo, conservando sus requisitos y aprobaciones.
Usar también [FRONTEND.md](FRONTEND.md) y [ENGINEERING.md](ENGINEERING.md).

## Matriz fija

- Exactamente doce renglones: enero, febrero, marzo, abril, mayo, junio, julio,
  agosto, septiembre, octubre, noviembre y diciembre, en ese orden.
- La primera columna identifica el mes; las columnas de datos son los años
  consultados, únicos y en orden cronológico ascendente.
- Cada celda corresponde a una sola combinación mes/año y a la misma métrica,
  unidad y contexto de filtros aplicados que el resto de la matriz.
- Conservar los doce meses y los años consultados aunque falten valores.
  Los filtros cambian el contenido y el rango de años según la consulta; los
  ejes conservan su significado y orden.
- Totales, promedios o comparativos adicionales se presentan fuera de la matriz,
  cuando el producto los contemple y tenga una regla aprobada para calcularlos.

Forma de referencia; «valor» representa el resultado definido por cada proyecto:

| Mes | 2024 | 2025 |
| --- | ---: | ---: |
| Enero | valor | valor |
| Febrero | valor | valor |
| Marzo | valor | valor |
| Abril | valor | valor |
| Mayo | valor | valor |
| Junio | valor | valor |
| Julio | valor | valor |
| Agosto | valor | valor |
| Septiembre | valor | valor |
| Octubre | valor | valor |
| Noviembre | valor | valor |
| Diciembre | valor | valor |

## Configuración local

Cada variante declara:

| Dato | Definición requerida |
| --- | --- |
| Métrica | Identificador, nombre visible y significado. «Préstamos» precisa si cuenta registros o expresa un monto. |
| Cálculo y fuente | Contrato aprobado, datos incluidos y regla mensual: conteo, suma u otra definida por el dominio. |
| Periodo | Fecha que determina mes/año, zona horaria, corte y años consultados. |
| Formato | Unidad, moneda cuando corresponda, precisión, redondeo y tratamiento de negativos según el contrato local. |
| Filtros y permisos | Controles, valores iniciales y ámbito autorizado propios del proyecto. |

Préstamos, utilidad y ventas son ejemplos de métricas; el estándar no les asigna
fórmulas ni filtros comunes. La regla de agrupación temporal pertenece al producto.

## Valores y estados

| Situación | Presentación y significado |
| --- | --- |
| Valor informado | Mostrar el resultado con el formateador de su unidad. |
| Cero real | Mostrar cero formateado; representa un resultado confirmado. |
| Sin dato | Mostrar «—», con leyenda o nombre accesible que explique «Sin datos». |
| Periodo no aplicable | Identificar «No aplica» según la regla local. |
| Periodo parcial | Mostrar el valor disponible con indicador de parcialidad y corte. |
| Carga o consulta fallida | Mostrar progreso o error recuperable; nunca representarlos como cero o ausencia de datos confirmada. |

La fuente declara el significado de periodos ausentes, parciales o todavía no
aplicables. La vista conserva esos estados; no convierte automáticamente un valor
ausente en cero ni deduce el estado de un periodo usando la fecha del dispositivo.
Un resultado vacío se explica conservando la estructura del rango consultado.

## Consulta y composición

El título identifica la métrica; unidad, años, filtros efectivamente aplicados
y corte cuando corresponda quedan visibles. Distinguir filtros en edición de
los que produjeron el resultado. Todas las celdas pertenecen a la misma consulta
autorizada; una respuesta anterior no debe sustituir el contexto vigente.

Las reglas de cálculo permanecen en la capa de negocio. El adaptador entrega los
resultados y estados por mes/año, como matriz o celdas identificadas; garantiza
un resultado único por periodo. La presentación ordena y formatea esos resultados;
no suma duplicados ni reconstruye fórmulas financieras para llenar la tabla.
Consultar y aplicar filtros son operaciones de lectura; la frontera de datos
comprueba los permisos del actor.

Reutilizar una composición compartida por proyecto, identificada en la referencia
como `HistoricalReport`, con los filtros locales y el adaptador de datos.
Conservar tabla, controles, estados y formateadores existentes, configurados para
mantener los ejes fijos. El nombre identifica la composición de referencia; sus
APIs se adaptan al stack local. La documentación no instala dependencias.

## Presentación y exportación

- Cifras alineadas a la derecha, tipografía numérica estable y precisión local.
- Encabezados semánticos de mes y año; cada valor debe poder asociarse con ambos.
- En móvil, conservar la matriz con desplazamiento horizontal dentro de su
  contenedor; mantener legibles las etiquetas y accesibles los filtros y estados.
- Aplicar tokens, temas, contraste, foco y teclado de FRONTEND. La marca se
  conserva en cada proyecto.
- Si hay exportación, reproducir meses, años, valores, estados, unidades y filtros
  aplicados. Identificar los periodos parciales y el corte también en la salida.

## Verificación y adopción

Comprobar con datos ficticios los doce meses, uno y varios años, su orden, valores
en el mes/año correcto, cero, ausencia, periodos parciales/no aplicables y errores.
Verificar los límites de mes/año según la fecha y zona declaradas, los filtros
aplicados, cambios rápidos de consulta y permisos. Contrastar contra resultados
esperados de la regla local; una tabla bien formada no acredita el cálculo.

Para una UI implementada, registrar evidencia de FRONTEND: 375/1440 px, zoom
200 %, teclado, temas y estados relevantes; comprobar scroll interno y etiquetas.
Contrastar exportaciones cuando existan. Conservar comandos, pasos, resultado y
límites en la ficha; indicar «pendiente» hasta ejecutar cada comprobación.

Revisar impacto y adoptar desde cada proyecto con su alcance autorizado. El
checker verifica estructura e integridad, no los resultados mensuales ni su UI.
