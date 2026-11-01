# Interfaz de RCFito

## Perfil implementado

React + TypeScript + Vite 8, HashRouter, Tailwind 4 y shadcn/Radix nova.
[components.json](../components.json) registra instalación y aliases.
Geist Variable se sirve como dependencia local; los iconos son Lucide.

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
cultivo, etapa y estado quedan en la URL. Dosis se ordena por unidad; cantidad sigue el orden numérico solicitado,
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
