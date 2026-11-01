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
