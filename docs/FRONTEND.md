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
| Usuarios y conexión | [Users](../src/features/users.tsx) y [Connection](../src/features/connection.tsx), sobre los mismos formularios/diálogos. |

Ver es detalle semántico; Editar usa captura con errores por campo. Guardar
bloquea doble envío y conserva borradores frente a errores. El diálogo protege
descartes y devuelve el foco al disparador; la consulta inicia en su título.
El buscador conserva lo escrito y normaliza solo para comparar; filtra antes de
paginar el conjunto cargado autorizado.

La demostración identifica sus datos ficticios y almacenamiento local. Conectar
Supabase requiere URL accesible, clave pública y sesión real. La simulación de
roles no equivale a seguridad de servidor.

## Evidencia y límites

[TESTING](TESTING.md) registra el recorrido demo del 2026-10-31 a 1440 px:
captura/búsqueda/detalle, descarte, temporada duplicada, lote/subdivisión,
planeación/siembra y lector limitado. A 375 px se comprobó ausencia de
desbordamiento horizontal general y se ajustó el buscador. Teclado completo,
contraste medido y texto al 200 % siguen pendientes hasta su evidencia final.
No se acredita navegador conectado a Supabase de operación; las verificaciones
HTTP del backend fueron independientes.

El [estándar FRONTEND](../.project-standards/FRONTEND.md) sigue vigente.
MoneyInput no aplica: este producto no captura importes. Reportes históricos y
órdenes de aplicación todavía no se implementan.
