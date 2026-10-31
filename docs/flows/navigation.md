# Navegación de la primera entrega

Fuente: [NAVIGATION](../../.project-standards/NAVIGATION.md) y
[acabado visual](../../.project-standards/NAVIGATION-VISUAL.md).
Estado: mapa implementado y revisión parcial de navegador; casos restantes
explícitos en la tabla de evidencia.

## Alcance y perfil

La navegación facilita los dos trabajos de esta entrega: mantenimiento de
catálogos y proyectos de siembra. Las rutas futuras de aplicaciones y reportes
no deben aparentar funcionalidad terminada con enlaces sin destino.

Perfil propuesto: fondo cálido claro, superficies de lectura blancas, navegación
verde bosque y acento lima limitado a acciones principales. Los colores finales
se definen en tokens semánticos del tema local; no hay marca copiada de mdron.
Lectura 16/24 px, controles 14/20 px, objetivos interactivos mínimos 44 px, foco
visible y una sola acción principal por bloque. La adopción visual exige medir
contraste final sobre los colores realmente renderizados.

## Mapa lógico compartido

| Grupo | Destinos | Acceso y orientación |
| --- | --- | --- |
| Operación | Resumen de trabajo; proyectos de siembra; detalle del proyecto | Lectura autorizada por agrícola, edición solo al administrador. El detalle conserva contexto del proyecto. |
| Catálogos | Agrícolas, campos, cultivos, variedades, productos, ingredientes, marcas, familias, infraestructura y medios | Ver para actor autorizado; mantenimiento solo al administrador. |
| Administración | Usuarios/asignaciones y conexión cuando correspondan | Cuenta/usuarios privilegiados solo al administrador; conexión no concede permisos de datos. |

La implementación utiliza HashRouter para publicación estática: `/#/`,
`/#/proyectos`, `/#/proyectos/:projectId`, `/#/catalogos/:kind`, `/#/usuarios` y
`/#/conexion`. URL directa, recarga y Atrás/Adelante deben conservar destino. Una ruta desconocida
o restringida muestra su estado real y salida autorizada, sin activar Inicio.

## Controles y estado

- Un AppShell/AppNavigation compartido sobre Sidebar y los controles shadcn
  aplicables. El mismo mapa filtrado y renderer sirven escritorio y móvil.
- Enlaces reales con rol de enlace, texto y `aria-current="page"` único cuando
  corresponda. No usar botones de cambio de estado como sustitución de URLs.
- Panel móvil mediante Sheet con título, cierre interior visible, foco, Escape
  y fondo inerte a cargo de la primitiva. Al navegar se cierra y lleva el foco al
  contenido/título. El panel cerrado no participa del teclado ni árbol accesible.
- Secciones colapsables, si se utilizan, compuestas con Collapsible/Trigger/Content
  compartidos, estado único por grupo y apertura independiente. La ruta abre su
  grupo; un toggle manual no se revierte por un render de la misma pantalla.
- Enlace para saltar al contenido, encabezados semánticos y nombres accesibles
  en controles de icono. Los iconos decorativos no repiten etiquetas.
- Cambiar agrícola o sesión actualiza datos autorizados y retira destinos/estado
  anteriores; preferencias de apariencia nunca contienen ni restauran permisos.

## Mapa de implementación y evidencia

| Responsabilidad | Archivo y composición |
| --- | --- |
| Shell y mapa | [WorkspaceShell y AppNavigation](../../src/App.tsx), `catalogNav` como mapa canónico de catálogos. |
| Enlaces y activo | Función `item` de AppNavigation con Link, SidebarMenuButton y `aria-current`. |
| Grupo colapsable | Collapsible/Trigger/Content dentro de AppNavigation, con un dueño de `catalogsOpen`. |
| Escritorio y móvil | [Sidebar/SidebarProvider](../../src/components/ui/sidebar.tsx), con Sheet en móvil y el mismo AppNavigation. |
| Contexto y cuenta | WorkspaceShell representa perfil y modo desde [WorkspaceProvider](../../src/data/workspace-context.tsx); usuarios y conexión son rutas reales. |
| Tema | [index.css](../../src/index.css), tokens semánticos y estilos compartidos de navegación. |

Mapa inspeccionado en código; la conformidad del árbol renderizado y del foco
requiere los casos siguientes. No se atribuye una revisión visual solo por
verificar los imports y componentes.

| Caso | Resultado |
| --- | --- |
| Mismo mapa y controles compartidos en dos pantallas y ambos tamaños | Pendiente. |
| URL directa, recarga, historial, activo único y ruta desconocida | Pendiente. |
| Destinos filtrados; lector sin mantenimiento y agrícola no asignada | Lector demo sin controles de escritura y Culiacán fuera de su ámbito, probado a 1440 px. Backend HTTP/RLS verificado por separado. |
| Móvil: abrir/cerrar, botón interior, Escape, foco y panel cerrado inaccesible | Cierre con Escape comprobado por el agente principal; resto de la matriz de foco y accesibilidad pendiente. |
| Catálogo modal sobre navegación y selectores anidados sin bloqueo residual | Pendiente. |
| 375/1440 px, texto 200 %, altura reducida y nombres largos | Demo a 1440/375 px revisada sin overflow general; buscador móvil corregido. Texto 200 %, altura reducida y nombres largos pendientes. |
| Contraste final, normal/hover/activo/foco y movimiento reducido | Pendiente. |
