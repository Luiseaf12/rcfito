# Interfaz de RCFito

## Perfil implementado

React + TypeScript + Vite 8, HashRouter, Tailwind 4 y shadcn/Radix nova.
[components.json](../components.json) registra instalación y aliases.
Geist Variable se sirve como dependencia local; los iconos son Lucide.

La hoja base de shadcn 4.23.0 se conserva sin cambios en
[styles/vendor](../src/styles/vendor/README.md), con licencia MIT distribuida
en el frontend. `index.css` importa esa copia local y no requiere instalar
la CLI. [Revisión y evidencia](SECURITY.md#dependencias-de-desarrollo--rcf-005).

El tema canónico está en [index.css](../src/index.css): fondo cálido `#f6f7f2`,
texto `#233a30`, superficies blancas, sidebar `#173e33` y acción principal lima
`#d2e9a0` con texto oscuro. Los tokens semánticos comparten superficie, borde,
foco, acción y estado. Lectura base 16/24 px y controles de al menos 44 px.
Esta entrega ofrece tema claro; no hay selector de tema oscuro acreditado.

## Composición y flujos

| Función | Fuente local y contrato |
| --- | --- |
| Shell y navegación | [App](../src/App.tsx), Sidebar y Sheet compartidos; [ficha](flows/navigation.md) y [NAVIGATION](../.project-standards/NAVIGATION.md). |
| Catálogos | [Catalogs](../src/features/catalogs.tsx), Toolbar/DataTable y [shared](../src/features/shared.tsx); [ficha](flows/catalogs.md). |
| Proyectos | [Projects](../src/features/projects.tsx): distribución, subdivisiones, etapas y transiciones; [ficha](flows/sowing-projects.md). |
| Aplicaciones y grupos | [Applications](../src/features/applications.tsx) y [SowingGroups](../src/features/sowing-groups.tsx): indicación histórica, realización por destino, cancelación, comparación y selección manual; [ficha](flows/applications.md). |
| Usuarios y conexión | [Users](../src/features/users.tsx) y [Connection](../src/features/connection.tsx), sobre los mismos formularios/diálogos. |

Ver es detalle semántico; Editar usa captura con errores por campo. Guardar
bloquea doble envío y conserva borradores frente a errores. El diálogo protege
descartes y devuelve el foco al disparador; la consulta inicia en su título.
El buscador conserva lo escrito y normaliza solo para comparar; filtra antes de
paginar el conjunto cargado autorizado.

La demostración identifica sus datos ficticios y almacenamiento local. Conectar
Supabase requiere URL accesible, clave pública y sesión real. La simulación de
roles no equivale a seguridad de servidor.

Realizar abre con la excepción desmarcada y la mezcla indicada de lectura;
confirmar guarda su copia. Marcar cambios habilita los productos/dosis/agua reales.
La comparación conserva ambas mezclas. Las dosis muestran hasta seis decimales,
la selección en tabla tiene área táctil de 44 px y grupos de proyecto cerrado no
ofrecen Editar. Las rutas son `/aplicaciones`, `/aplicaciones/:orderId` y
`/grupos-siembra`.

## Evidencia y límites

[TESTING](TESTING.md) registra el recorrido demo del 2026-10-31 a 1440 px:
captura/búsqueda/detalle, descarte, temporada duplicada, lote/subdivisión,
planeación/siembra y lector limitado. A 375 px se comprobó ausencia de
desbordamiento horizontal general y se ajustó el buscador. Teclado completo,
contraste medido y texto al 200 % siguen pendientes hasta su evidencia final.
La primera entrega sí se verificó contra Supabase de operación. Para la ampliación
se probaron en demo alta, realización habitual/excepcional, comparación y grupo
manual; los 40 checks HTTP se ejecutaron en un backend aislado. El frontend
Docker actualizado del módulo ya muestra lista real vacía y sesión administradora
en 5180, sin inserciones. En demo a 375 px se comprobó el lector sin Nueva
indicación. La publicación en Sites y sus nueve comprobaciones HTTPS posteriores
aprobaron; no se equiparan esas pruebas a captura
real de aplicaciones.

El [estándar FRONTEND](../.project-standards/FRONTEND.md) sigue vigente.
MoneyInput no aplica: este producto no captura importes. El reporte completo de
aplicaciones no forma parte de esta ampliación.

## Captura con IA

`/captura-ia` añade un enlace de administrador al mismo AppNavigation de
escritorio/móvil. Usa Card/Field/Textarea/Button para el mensaje y el
RecordDialog de aplicaciones para revisar, completar selectores y aprobar. Los
productos muestran código y nombre, conservan la dosis del mensaje y exigen
aclarar unidades incompatibles. Nota de la aplicación es multilínea y editable;
el origen se consulta con Collapsible sin modificarlo.

La aprobación se habilita al completar los campos y revisiones. Los cambios de
contexto/grupo/destinos reinician sus confirmaciones. Se usa calendario para
fechas ausentes y se conserva el borrador frente a errores. En demo se ofrece
un ejemplo de revisión expresamente ficticio, sin simular una inferencia real.

QA: enlace y alta/relectura en escritorio; a 375 px se revisaron menú, selectores,
sugerencia histórica, Escape/descarte y ausencia de overflow de página/diálogo.
Se corrigió la grilla móvil con columnas minmax(0,1fr). Teclado completo y texto
200 % siguen en el pendiente general RCF-006. [Ficha](flows/ai-capture.md).

## Preferencias de inteligencia artificial

La sección de [configuración de IA](flows/ai-settings.md) aparece solo para
administrador. En modo gestionado permite clave password, modelo, probar y guardar;
demo muestra la indisponibilidad explícita. La clave permanece solo en memoria
durante la edición y se limpia al guardar. Cambiar entradas invalida la prueba;
estado, carga, error y éxito conservan controles accesibles y diseño móvil.

## Pendientes visibles al aprobar captura

La revisión IA usa FieldError junto a los campos y Alert con la lista de
pendientes antes del botón. La misma función pura controla botón y submit;
cuando no hay pendientes anuncia Captura lista para aprobar y guardar. Conservar
las selecciones resueltas, los valores del mensaje y la protección de descarte.
Se verificaron errores recuperables, habilitación/guardado demo y 375 px.
[Ficha](flows/ai-capture.md#autocompletado-y-pendientes-de-aprobación).

## Edición de aplicaciones e historial

El detalle ofrece **Editar indicación** al administrador con pendientes y
**Corregir realización** en cada destino realizado. Reutiliza los campos y editor
de mezcla existentes; motivo obligatorio, lista de pendientes, guardado protegido
y confirmación de descarte. La vista distingue última revisión de la indicación
histórica de cada destino, conserva la original y compara eventos antes/después.
Validación de versiones evita aplicar cambios que el usuario no vio. El lector
solo consulta su historial. [Ficha y evidencia](flows/application-editing.md).

## Sinónimos y selector de productos

Productos conserva Ver/Editar y añade renglones de sinónimos al formulario de
administrador, detalle de consulta y búsqueda por alias. Guardado único,
validación visible y descarte protegido con componentes existentes. El editor de
mezcla compartido usa opciones ordenadas por nombre español/números: nombre e
ingredientes configurados, código como identidad interna y ayuda separada.
La revisión IA identifica alias y conserva el texto/unidad/dosis del mensaje.
[Flujo y aceptación](flows/product-synonyms.md).

## Dashboard de productos registrados

Resumen (`/`) usa [product-dashboard](../src/features/product-dashboard.tsx):
Card, FieldGroup/FormSelect, Table, Button y RecordDialog existentes. Tabla
principal ordenable/paginada, ranking de diez productos e historial paginado con
estado y origen de fecha; al cerrar conserva filtros, orden y foco. Estado inicia
en Todas las aplicaciones, sobre todas las temporadas autorizadas. Agrícola,
lote, cultivo, etapa y estado quedan en la URL. Lote muestra campo, temporada y
agrícola; Todos los lotes conserva el ámbito completo. Cambiar agrícola limpia
lote y sus dependencias; los otros filtros se cruzan con el lote seleccionado.
Las métricas, tabla general, ranking e historiales reciben el mismo lote. Dosis se ordena por unidad; cantidad sigue el orden numérico solicitado,
con leyenda que distingue valores registrados y consumo real. El móvil contiene
el scroll en cada tabla. [Contrato y QA](flows/product-dashboard.md).

## Resumen por lote y orden por cantidad

[LotUsagePanel](../src/features/lot-usage-panel.tsx) añade tabla de lotes, Ver
productos y detalle en la misma página. El historial reutiliza ProductHistory
con contexto del lote; Escape/retorno de foco y filtros se conservan. Tabla y
detalles paginados; foco en el título de productos al abrir y retorno al botón
al cerrar. Card/Table/Button/Alert/Empty existentes, scroll de tablas contenido.
Por solicitud expresa, cantidad ascendente numérica en la tabla global y por
lote, sin agrupar por unidad; g/ml se siguen mostrando como kg/L. Dosis ordenada
por unidad y ranking por aplicaciones. [Contrato y QA](flows/product-dashboard.md#ampliación-resumen-por-lote).

## Captura al recuperar el foco

La confirmación o renovación de la sesión del mismo usuario actualiza los datos
en segundo plano y mantiene montados la ruta, los formularios y su foco. La
pantalla de carga bloqueante queda reservada al inicio de conexión y al cambio
real de identidad. Cerrar sesión sigue retirando los datos de la cuenta.

Corrección del 2026-11-01: el efecto dependía del objeto de sesión, que Supabase
puede volver a emitir al regresar a una ventana. Activar el estado de carga en
cada aviso sustituía la ruta por el skeleton de `App` y destruía su estado local.
Se retiró únicamente esa activación repetida; las consultas, tokens y controles
de acceso continúan funcionando. Esto no incorpora recuperación de borradores
tras una recarga manual o cierre completo del navegador.

## Decimales en reportes

Regla solicitada por el Propietario el 2026-11-01: los valores decimales de los
reportes se presentan redondeados a dos posiciones, con formato es-MX y ceros
finales (12.345 → 12.35; 8 → 8.00). Aplica a cantidades, dosis, promedios y
superficies en métricas, tablas generales, resúmenes por lote e historiales. Los
conteos de aplicaciones, productos y etapas permanecen enteros; fechas y códigos
no son medidas decimales. Los nuevos reportes deben reutilizar el mismo formato.

El redondeo se realiza únicamente al presentar, después de convertir a la unidad
mostrada (ml a L o g a kg). No redondear dosis guardadas, snapshots, resultados
intermedios, sumas ni promedios; ordenar con el valor numérico original. Un valor
positivo menor que 0.005 se muestra como 0.00 en esa unidad y conserva su valor
interno. Los campos de captura mantienen su precisión y validaciones vigentes.

El [PDF de borrador](flows/recipe-draft-pdf.md) es una copia de captura para
confirmar la receta: dosis hasta seis decimales y agua hasta cuatro; superficies
conservan dos. Su botón junto a Guardar descarga sin persistir y admite la fecha
programada pendiente. Si se edita la mezcla hay que exportar esa nueva versión.

El detalle guardado incorpora **Exportar receta PDF** con el mismo formato,
precisión y preparación diferida; muestra folio/revisión y seguimiento por
destino. Disponible para consulta autorizada, incluido lector asignado, también
en proyectos cerrados. [Contrato](flows/saved-recipe-pdf.md).

Implementación compartida en [report-format](../src/lib/report-format.ts), usada
por [product-usage-shared](../src/features/product-usage-shared.tsx). Aceptación:
comprobar un redondeo hacia arriba/abajo, ceros finales, conversión L/kg y dosis
ponderada; verificar todos los reportes existentes y que los conteos sigan
enteros. Evidencia en [verificación](TESTING.md#decimales-en-reportes).

## Consultas por texto y audio

`/consultas` reutiliza el shell y carga diferida. Compone primitivas oficiales
shadcn MessageScroller, Message, Bubble y Attachment, junto a Field, Textarea,
Button, Select, Alert, Badge y Collapsible. La dependencia `@shadcn/react` se fija
para el control de scroll; las superficies conservan tokens locales.

Audio ofrece grabación, adjunto, preescucha, descarte y transcripción editable;

## Origen de grupo en aplicaciones

La captura anuncia el grupo elegido y vuelve a selección manual al ajustar
sus destinos. El detalle muestra Origen de la aplicación y Destinos al indicar;
cada destino muestra su pertenencia histórica, separada de su estado real.
Los nombres proceden del registro guardado, sin consultar la pertenencia actual
para reinterpretar el origen. La grilla de contexto usa FieldGroup sin
contención de tamaño para evitar que se colapse al aparecer los destinos.

QA demo: creación grupal e individual del mismo lote, recarga de ambos detalles
y vista móvil de 375 px aprobadas. [Contrato y límites](flows/application-group-origin.md).
libera pistas/URLs al cancelar o desmontar. Una grabación dura como máximo 120
segundos; adjuntos hasta 10 MB, con comprobación de duración cuando el navegador
la informa. Fuentes parciales se identifican como muestra; detalle accesible
expone agua/equipo/aplicador/notas y cambios. [Ficha](flows/application-chat.md).


RCF-030 incorpora una sola entrada **Nueva indicación** desde Aplicaciones, en
`/aplicaciones/nueva` (enlace anterior compatible), con ToggleGroup de shadcn y
editores compartidos. Última activa por defecto, buscador de anteriores y captura
desde cero usan el mismo formulario; el buscador reutiliza RecordDialog/SearchField
y pagina diez resultados después de filtrar el conjunto autorizado.
Base histórica y copia editable permanecen separadas. Cambiar base o destinos
confirma el reemplazo de una mezcla editada; menú, Cancelar y Atrás protegen el
borrador. [Flujo, estados y evidencia](flows/recipe-creation.md).

## Accesibilidad — RCF-006

El foco de teclado usa contorno opaco, con color propio en la navegación oscura.
Los botones compuestos conservan un área mínima de 44×44 px. Confirmaciones y
editores largos desplazan su contenido dentro de la altura visible. El descarte
cancelado devuelve al campo anterior; cerrar el menú devuelve a su botón, mientras
que navegar conserva el foco en el contenido nuevo. Las tablas que desbordan
ofrecen una región enfocada con Tab y desplazamiento con flechas; las que caben
no agregan esa parada. [Matriz, contraste y límites](accessibility-review.md).


## Correcciones de malla — RCF-038

Editar en un lote usado abre LotCorrectionEditor. Nombre, fechas separadas y
corrección conjunta de superficie muestran valores anteriores y exigen motivo;
el alcance de superficie se activa explícitamente y anuncia destinos por estado.
RecordDialog, Field, Checkbox, Alert, Table y Collapsible reutilizan los controles
existentes. Error conserva captura; useFormClose protege descarte y foco.

LotCorrectionHistory permite a lectores autorizados consultar versiones y destinos
por folio/etapa, estado y hectáreas anteriores/nuevas. Aplicaciones enlaza a ese
historial y el PDF guardado identifica superficies corregidas. [Reglas y QA](flows/lot-corrections.md).


## Orden general de listados — RCF-039

Regla obligatoria para todos los listados de registros de RCFito, existentes y
nuevos, autorizada por el Propietario el 2026-11-04: mostrar por defecto nombres
visibles en orden alfabético ascendente. Incluye tablas, tarjetas, selectores,
listas de casillas, relaciones en detalles y resultados de búsqueda.

- Comparación en español de México, sin distinguir mayúsculas ni acentos y con
  números naturales: Malla 2 precede a Malla 10. La eñe conserva su lugar español.
- Ordenar el conjunto autorizado completo después de filtrar y antes de paginar
  o limitar su presentación. Desempatar nombres equivalentes por identidad
  estable, conservando nombres, valores seleccionados y etiquetas originales.
- Aplicar el mismo criterio al cargar, buscar, filtrar, guardar y actualizar.
  Ordenar copias para presentación; no reescribir registros, snapshots ni firmas.
- Opciones de alcance o ausencia (Todos, Sin asignar y selección manual) pueden
  fijarse al principio; los registros siguientes mantienen A-Z. Las referencias
  inactivas que deban conservarse siguen disponibles y ordenadas.
- Las excepciones deben constar en la ficha del recorrido. Se conservan fechas
  de aplicaciones/recetas e historiales, numeración de etapas, cantidades y ranking
  del reporte, y la ordenación elegida explícitamente por el usuario. También se
  conserva la secuencia funcional de estados, navegación, campos y acciones.
- Los renglones de una captura editable conservan su posición durante la edición;
  sus selectores sí usan A-Z. Así se mantienen foco, dosis, errores y vínculos por
  fila. Las listas de lectura de sus registros usan el orden general. Los PDF
  siguen su contrato de copia de receta y no se modifican por esta entrega.

Implementación compartida en [list-order](../src/domain/list-order.ts):
FormSelect ordena por etiqueta de forma predeterminada, admite opciones fijadas
y exige order="provided" para las excepciones del inventario. Las vistas que
usan Select directamente aplican las mismas utilidades. Los datos paginados en
servidor conservan el orden especial definido por su consulta completa.

Criterio de aceptación: **todos los listados de la pantalla, incluidos los
selectores dentro de formularios, cumplen el orden general o su excepción
expresa; una recarga o un cambio de página no altera ese criterio**.
[Inventario, excepciones y evidencia](flows/list-order.md).


## Captura desde imagen — RCF-040

Captura con IA ofrece Texto e Imagen · cantidades totales. La revisión conserva
la vista previa, permite aclarar cada producto y total y muestra superficie,
dosis, total reconstruido y diferencia por redondeo. Recalcular invalida la
confirmación del reparto. Los impedimentos comparten la validación de guardar
y se enumeran antes del botón. Recorrido en [la ficha](flows/image-capture.md).
