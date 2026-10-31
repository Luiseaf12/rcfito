# Menús y navegación reutilizables

## Alcance

Contrato para navegación principal nueva o intervenida. Extrae la organización
de Apoyosing y la adapta a cualquier aplicación web: estructura, orientación,
permisos, estados y evidencia. Los nombres, destinos, marca, stack y capacidades
son del proyecto. No obliga a añadir módulos inexistentes ni migra menús heredados
por instalar el bundle. En proyectos externos puede adoptarse como contrato local;
la auditoría central solo cubre los consumidores registrados.

Aplicar [FRONTEND.md](FRONTEND.md) y completar la
[ficha de navegación](templates/navigation.md) dentro de la documentación local
del flujo o frontend. Una diferencia justificada sigue [CORE.md](CORE.md).
Para el aspecto del menú, aplicar la receta de
[acabado visual](NAVIGATION-VISUAL.md): jerarquía, densidad, alineación, estados
y estilos compartidos, conservando la identidad local.

## Organización de la información

- Mantener una fuente compartida del mapa de navegación para escritorio, móvil,
  estado activo y encabezado. Evitar listas de destinos duplicadas por pantalla.
- Agrupar por tareas que el usuario reconoce, con nombres breves y estables.
  Ordenar por frecuencia y secuencia del trabajo; mantener ese orden entre rutas.
  No agrupar según tablas de base de datos ni carpetas de código.
- Preferir grupo → destino. Los grupos pueden activar el contrato de
  [secciones colapsables](#secciones-colapsables); ocultar/mostrar sus destinos
  no añade un nivel de navegación. Añadir subniveles solo cuando la cantidad y
  relación de destinos lo justifiquen en la ficha; conservar acceso por teclado.
- Cada destino tiene una ubicación principal. Los accesos contextuales de una
  pantalla pueden enlazarlo sin duplicarlo como otro módulo principal.
- Separar destinos globales, pestañas de la pantalla y acciones sobre registros.
  Ver/Editar pertenecen al recorrido de [catálogos](CATALOGS.md), no al menú global.
- Secciones orientativas: Inicio, Operación, Consultas, Catálogos y Administración.
  Elegir únicamente las útiles. Nómina, Finanzas y cualquier otro dominio son
  decisiones locales; no constituyen un inventario universal.
- Después de filtrar por acceso, retirar grupos vacíos y separadores huérfanos.
  No reordenar el resto de opciones según la página abierta.

## Composición compartida

Los nombres de las piezas describen responsabilidades; se pueden mapear a los
componentes existentes sin renombrar todo el proyecto ni instalar una librería.

| Pieza | Responsabilidad |
| --- | --- |
| Shell | Componer navegación, encabezado y contenido principal sin repetirlos por ruta. |
| Identidad/inicio | Identificar el producto local y enlazar su entrada autorizada. |
| Navegación principal | Renderizar grupos, destinos y estado activo del mapa filtrado. |
| Encabezado de vista | Mostrar título de pantalla y contexto de sección cuando aporte orientación. |
| Acción global opcional | Ofrecer como máximo una acción frecuente y autorizada, separada de los destinos. |
| Cuenta opcional | Identificar sesión/contexto y permitir salir cuando el producto tenga autenticación. |
| Control móvil | Abrir/cerrar el panel y coordinar foco, fondo y capas. |

En aplicaciones con muchos destinos, usar barra lateral y encabezado de vista
como base. Una aplicación pequeña puede usar navegación superior con el mismo
mapa y contrato; registrar la elección. La barra lateral puede colapsar en
escritorio si cada opción sigue siendo identificable. La versión visible y la
acción global son opcionales; no copiar «Nuevo folio» a otros productos.

Por solicitud del Propietario del 2026-10-14, **los controles aplicables y las
composiciones compartidas siguientes son obligatorios** para navegación nueva o
intervenida. No basta con nombrar shadcn o replicar sus clases. La ficha identifica
archivos, imports, controles renderizados y evidencia. Las diferencias técnicas
siguen CORE; un menú heredado no queda migrado por adoptar documentación.

## Controles shadcn por función

Usar las piezas de la instalación local y sus variantes/tokens. No instalar toda
la colección ni incorporar funciones solo para completar la tabla. Si falta un
control aplicable, incorporarlo o preparar su adaptación en la implementación
autorizada, antes de declararla conforme. Un stack incompatible requiere una
diferencia justificada con equivalente y evidencia; no autoriza una copia ad hoc.

| Función presente | Controles exigidos | Reutilización y condición |
| --- | --- | --- |
| Shell lateral | SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter y SidebarTrigger | Un ámbito de estado por shell; contenido desplazable y cabecera/pie según sus zonas. No añadir un pie vacío. SidebarInset solo para la variante inset. |
| Grupos y destinos laterales | SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem y SidebarMenuButton | Una composición común desde el mapa filtrado. Destino como enlace real, activo derivado de la ruta y aria-current. |
| Panel móvil lateral | Sheet, SheetContent, SheetTitle y cierre accesible, normalmente ya usados por Sidebar | Reutilizar el móvil integrado de Sidebar; no envolverlo en otro Sheet/Dialog. Un shell sin Sidebar usa una composición Sheet compartida con su título, disparador y cierre. |
| Acciones globales y salir | Button; Spinner si se muestra progreso gráfico | Variantes existentes; acción pendiente con disabled y texto accesible. Un destino de navegación conserva enlace, aunque tenga apariencia destacada. |
| Etiqueta de iconos en modo compacto | Tooltip, TooltipTrigger, TooltipContent y contexto TooltipProvider | Reutilizar el tooltip integrado de SidebarMenuButton cuando exista; no anidar dos tooltips. Nombre accesible además del tooltip. |
| Sección colapsable | Collapsible, CollapsibleTrigger y CollapsibleContent, compuestos con SidebarGroup/Label/Content | NavigationSection compartido; puede colapsar un grupo plano sin crear submenús. Sin accordion exclusivo ni handlers manuales equivalentes. |
| Destinos realmente anidados | SidebarMenuSub, SidebarMenuSubItem y SidebarMenuSubButton; Collapsible si despliegan contenido | Solo si la jerarquía está justificada. Reutilizar controles y estado; no crear subniveles para colapsar una sección plana. |
| Navegación superior elegida | NavigationMenu, NavigationMenuList, NavigationMenuItem y NavigationMenuLink | Sustituye a la composición lateral según el perfil. Trigger/Content solo para contenido desplegable real. No confundir con un menú de acciones. |
| Ruta jerárquica visible | Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage y BreadcrumbSeparator | En PageHeader compartido y desde los metadatos de ruta; el título h1 sigue siendo HTML semántico. |
| Menú de cuenta con acciones desplegables | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup e items | AccountMenu compartido; Avatar con AvatarFallback solo si se muestra avatar. Una salida directa usa Button sin añadir desplegable. |
| Divisores y estados que se muestren | SidebarSeparator/Separator, SidebarMenuSkeleton/Skeleton, Alert y Empty | Reutilizar los estados comunes; no crear divs estilizados por página. Badge/SidebarMenuBadge solo para indicadores reales autorizados. |

SidebarContent ya ofrece scroll: no envolverlo automáticamente en otro ScrollArea.
El encabezado, nav, listas, h1, enlaces y región main conservan HTML semántico;
no necesitan un componente ficticio para pertenecer a esta composición.

### Semántica y APIs locales

- SidebarMenuButton/NavigationMenuLink/BreadcrumbLink componen el enlace del router
  según la API instalada. Usar `render` para Base UI o `asChild` para Radix cuando
  lo soporte la pieza; verificar el elemento/rol final. No anidar enlaces ni
  botones dentro de otro control interactivo.
- Para un enlace con estilo Button en Base UI, aplicar `buttonVariants` al `<a>`
  o Link real. La documentación oficial advierte que Button con `render={<a />}`
  puede imponer `role="button"`; `nativeButton={false}` no acredita semántica de
  enlace. No confundir `variant="link"` con un enlace de navegación.
- La marca y otros enlaces simples no requieren Button. Las acciones usan Button
  real; los triggers/cierres reutilizan su composición sin crear un segundo botón.
- Confirmar APIs, imports y primitivas en components.json y los archivos locales;
  no copiar props de una base a otra ni imponer un preset. Si el mapa serializable
  guarda claves de icono, resolverlas en un solo adaptador; en React pasar al
  renderer las referencias de componentes correspondientes.

## Reutilización y eficiencia del código

Mantener una implementación compartida por proyecto de estas responsabilidades.
Los nombres pueden conservar los existentes si la ficha mapea sus rutas reales.

| Composición | Responsabilidad y controles |
| --- | --- |
| AppShell | Montar AppNavigation, PageHeader y main una vez por layout; ubicar los proveedores compartidos. En multipágina, cargar la misma implementación desde cada entrada. |
| AppNavigation | Consumir mapa/políticas resueltos y coordinar Sidebar o NavigationMenu con el panel móvil aplicable. No consultar datos ni decidir reglas de negocio. |
| NavigationSection | Componer cada grupo lateral con su label, indicador y destinos; cuando collapsible=true, reutilizar Collapsible/Trigger/Content y el estado por ID del controlador compartido. |
| NavigationItems / NavigationLink | Recorrer grupos/items con IDs estables, etiquetas, iconos, enlaces y activo; componer los controles de la variante elegida sin listas copiadas por viewport o pantalla. |
| PageHeader | Derivar título, contexto y Breadcrumb opcional del contrato de ruta, conservando un h1. |
| AccountMenu y acción global | Composiciones compartidas opcionales; recibir identidad/capacidades y callbacks del controlador. |
| NavigationFeedback | Reutilizar carga/error/vacío del proyecto sin inventar un renderer distinto por pantalla. |

Reglas comprobables:

1. Una fuente de mapa y políticas y un resolver de ruta activa por shell. Calcular
   el mapa permitido una vez por cambio relevante de identidad/contexto/políticas;
   la ruta activa cambia con el router. No consultar permisos por cada enlace ni
   copiar filtros en escritorio y móvil. No es obligatorio memoizar listas pequeñas.
2. Un responsable de apertura/colapso: SidebarProvider/useSidebar o el controlador
   equivalente documentado. Si se controlan desde fuera, comunicar open/callbacks;
   no mantener booleanos independientes que reflejen el mismo estado.
3. Las primitivas accesibles poseen foco, Escape, portal y bloqueo del panel. No
   superponer listeners globales, focus traps ni fondos manuales que repitan ese
   trabajo. La lógica del proyecto conserva navegación, permisos y captura.
4. Reutilizar el renderer del mismo mapa en las variantes necesarias. No mantener
   dos menús interactivos/tabulables simultáneos; cualquier árbol oculto queda
   inaccesible y los IDs del DOM siguen siendo únicos. Los layouts distintos no
   justifican duplicar la configuración ni los handlers.
5. Reutilizar Button/variantes/tokens y controles instalados desde sus rutas
   canónicas. No crear copias por módulo ni capas de wrappers sin responsabilidad.
   No declarar componentes React dentro del render para evitar remontes innecesarios.
6. Importar solo las piezas usadas. Añadir DropdownMenu, Command, ScrollArea o
   componentes adicionales solo por una necesidad del flujo. Limpiar suscripciones
   y raíces del adaptador al desmontar; no conservar listeners de menús anteriores.
7. Justificar optimizaciones con evidencia cuando haya un problema medido. La
   composición reduce duplicación; no demuestra por sí sola menor bundle o latencia.

No son reutilización suficiente: copiar Sidebar en cada página, crear
DesktopMenu/MobileMenu con rutas propias, añadir un Sheet alrededor del móvil de
Sidebar o estilizar botones nativos para parecerse a shadcn. Sin mapa de imports
y revisión de los sitios de uso, la adopción permanece pendiente.

## Mapa y adaptación local

Documentar por destino:

| Campo conceptual | Contrato |
| --- | --- |
| `id` | Identificador único y estable, independiente del texto traducido. |
| `label` | Texto comprensible en el idioma del producto. |
| `href` / ruta | Destino interno válido y enlazable; conservar historial y enlaces profundos. |
| `icon` | Opcional; clave de icono existente, decorativo si el texto ya nombra el destino. |
| `access` | Capacidad/política local referenciada, o acceso público explícito. |
| `activeMatch` | Identidad de ruta y, si corresponde, rutas descendientes que representa. |

Los grupos tienen `id`, `label` e `items` ordenados. Los nombres de campos pueden
adaptarse al stack; la ficha debe mostrar su equivalencia. Las políticas se
resuelven con las fuentes de autorización existentes. El mapa solo las referencia.
Para grupos laterales, `collapsible` y `defaultOpen` siguen el contrato siguiente;
no se aplican automáticamente a NavigationMenu ni cambian la jerarquía de rutas.

Ejemplo declarativo con nombres ficticios; no es un archivo que el checker ejecute
ni crea permisos o rutas automáticamente:

```json
{
  "groups": [
    {
      "id": "home",
      "label": "Inicio",
      "items": [
        { "id": "overview", "label": "Resumen", "href": "/", "access": "resumen.consultar", "activeMatch": { "routeIds": ["overview"] } }
      ]
    },
    {
      "id": "work",
      "label": "Operación",
      "collapsible": true,
      "defaultOpen": true,
      "items": [
        { "id": "tasks", "label": "Tareas", "href": "/tareas", "access": "tareas.consultar", "activeMatch": { "routeIds": ["task-list", "task-detail", "task-edit"] } }
      ]
    }
  ],
  "primaryAction": { "id": "task-create", "label": "Nueva tarea", "href": "/tareas/nueva", "access": "tareas.crear" }
}
```

Resolver sesión/contexto → evaluar políticas → filtrar destinos/grupos → resolver
ruta activa autorizada → renderizar las piezas. Una implementación estática puede
mapear archivos y sus alias; un router puede usar sus IDs y metadatos. No imponer
extensiones `.html`, formato de URL ni framework como norma compartida.

## Secciones colapsables

Capacidad incorporada por solicitud del Propietario del 2026-10-15. Un proyecto
activa el comportamiento en el mapa del grupo. Cada grupo habilitado utiliza la
misma composición `NavigationSection`; no implementar un mecanismo por módulo.
Los grupos sin la opción conservan su presentación abierta para compatibilidad.

| Campo de grupo | Contrato |
| --- | --- |
| `id` | Único, estable y separado de la etiqueta. Clave del estado y de la preferencia. |
| `collapsible` | Booleano; omitido equivale a false. Si es true, el encabezado permite expandir/contraer el contenido. |
| `defaultOpen` | Booleano; true si se omite. Estado inicial sin preferencia válida; solo tiene efecto si collapsible=true. |

### Composición y comportamiento

- `NavigationSection` compone Collapsible con SidebarGroup. Su encabezado combina
  SidebarGroupLabel y CollapsibleTrigger; CollapsibleContent contiene
  SidebarGroupContent y el mismo renderer de destinos ya filtrados. Componer
  mediante render/asChild según la base local, produciendo un único botón real;
  no poner un botón dentro de otro ni convertir el label en enlace de navegación.
- Todo el encabezado es pulsable, con etiqueta y chevron decorativo del sistema
  de iconos local. La dirección refleja el estado y el botón mantiene nombre
  accesible, foco visible y objetivo mínimo de 44 × 44 px. Si hay encabezados
  semánticos de grupo, conservarlos con el botón en una estructura válida.
- Apertura independiente: pueden quedar abiertas varias secciones o ninguna.
  Cerrar una no altera las demás, la ruta actual, la captura ni los permisos.
  No usar un Accordion de apertura exclusiva como sustituto de este contrato.
- El trigger solo abre/cierra. Los destinos conservan enlaces reales y activo;
  no añadir acciones de escritura ni carga remota al abrir una sección.
- Enter/Espacio activan el trigger; Tab/Shift+Tab recorren solo controles visibles.
  aria-expanded y la asociación con el contenido corresponden a la primitiva;
  verificar sus IDs y roles finales. El contenido cerrado no es tabulable ni se
  anuncia como visible, incluso durante la animación de cierre. No duplicar este
  comportamiento con listeners de teclado o alternancia manual de clases.
- Si un cierre programático ocultaría el elemento enfocado, trasladar el foco
  al trigger del grupo antes de ocultarlo. Escape conserva la responsabilidad
  del panel móvil o de la capa superior; no añadir un handler global que cierre
  todas las secciones. Respetar movimiento reducido y transiciones de FRONTEND.
- Si la sección cerrada contiene la página actual, el encabezado ofrece una
  señal además del color y una descripción accesible, por ejemplo «Contiene la
  página actual: Tareas». aria-current="page" sigue en el enlace, no en el botón
  del grupo. No revelar nombres de destinos que no estén autorizados.

### Estado compartido, ruta y preferencias

El controlador de AppNavigation conserva un mapa `openByGroupId`. Cada sección
recibe `open` y `onOpenChange`, o sus equivalentes de la base instalada, desde
ese único dueño. No combinar estado interno independiente con otro mapa espejo.
Derivar el grupo de la ruta del resolver existente, no mediante una segunda
tabla de coincidencias dentro de NavigationSection.

| Evento | Resultado requerido |
| --- | --- |
| Primera carga o recarga del shell | Filtrar permisos; resolver estado por preferencia válida o defaultOpen. Abrir el grupo autorizado de la ruta actual aunque su preferencia estuviera cerrada. |
| Nueva navegación, URL directa o Atrás/Adelante a otro destino lógico | Abrir el grupo del destino autorizado; conservar el estado de los demás. Ruta desconocida/restringida no abre un grupo arbitrario. |
| Toggle manual, incluso del grupo activo | Respetar la elección hasta una nueva navegación relevante; no reabrirlo en cada render, consulta, filtro o refresco de datos. |
| Cambio de usuario/contexto/permisos | Recalcular grupos visibles, retirar estado obsoleto y aplicar preferencias del contexto correcto. No recuperar accesos desde storage. |
| Cambio de viewport o cierre/apertura del panel móvil | Conservar el mismo mapa de secciones; no copiarlo en DesktopMenu y MobileMenu ni restablecerlo por un resize. |

Guardar preferencias de apertura es opcional por proyecto. Si se habilita, usar
una clave versionada aislada por proyecto y ámbito de usuario/contexto, sin datos
personales ni credenciales en la clave o valor. Conservar únicamente IDs válidos
y booleanos de elección manual; ignorar claves desconocidas, JSON inválido,
tipos incorrectos y storage indisponible. Una apertura automática por navegación
no debe sobrescribir la preferencia manual guardada. Si no hay persistencia,
se conserva el estado durante la vida del shell y se usa la política inicial al
recargar; documentar esa elección. Nunca persistir permisos ni el panel móvil abierto.

El cierre por sección, el colapso a iconos del Sidebar y la apertura de Sheet
móvil son tres estados distintos. En la barra compacta, si los encabezados se
ocultan, mantener accesibles todos los destinos autorizados como iconos con sus
etiquetas/Tooltip, sin aplicar visualmente el cierre de sección ni sobrescribir
la preferencia. Al expandir la barra, restaurar el mapa de secciones; en móvil,
mostrar encabezados completos y respetarlo. Una alternativa técnica debe
documentar un acceso equivalente y la diferencia justificada según CORE.

La ficha registra la elección por grupo, archivos/imports del componente y
controlador, persistencia y evidencia. No se considera conforme una adopción
que copie controles por grupo o que mantenga dos fuentes de estado.

## Ruta activa y orientación

- La URL es la fuente del destino actual. Abrir directamente, recargar y usar
  Atrás/Adelante debe conservar pantalla, permisos y orientación.
- Definir alias, barras finales, detalles y edición en el adaptador. Evitar
  coincidencia por texto parcial: `/tareas` no activa `/tareas-archivo`. Query y
  hash solo distinguen destinos cuando el contrato local lo establece.
- Marcar un único destino principal con `aria-current="page"` cuando la ruta
  esté representada en ese menú. El encabezado nombra la pantalla real; en un
  detalle puede indicar su pertenencia al módulo sin fingir que es su listado.
- Una ruta desconocida, prohibida o sin representación no debe activar Inicio
  por defecto. Mostrar el estado real y una salida autorizada. Rutas auxiliares
  pueden conservar contexto del módulo según el mapa documentado.
- Conservar un `h1` y el contexto necesario; usar breadcrumb cuando haya una
  jerarquía real, sin convertir el título de grupo en una cadena de enlaces falsa.
- Navegar o abrir un panel no guarda ni elimina registros. Si hay captura sin
  guardar, seguir el contrato local de conservación/confirmación y documentarlo.

## Permisos y estados

Ocultar destinos y acciones sin acceso según la política local. Una opción
deshabilitada con explicación solo se usa cuando el producto autorice mostrarla;
no revelar etiquetas, contadores ni información de otro contexto restringido.
Acceso de lectura no equivale a acceso de edición. No codificar «administrador»
como único rol universal.

Ocultar un enlace no protege su ruta ni sus operaciones: comprobar autorización
en las fronteras correspondientes según [ENGINEERING.md](ENGINEERING.md).
Durante la carga de sesión/permisos no mostrar opciones privilegiadas de forma
provisional. Un error al resolver permisos no concede acceso: mostrar recuperación
segura y conservar solo las opciones cuyo acceso esté confirmado. Si no hay
destinos autorizados, explicar el estado y ofrecer la salida/ayuda local disponible.

Al cambiar usuario, organización o permisos, recalcular el mapa y validar la ruta
actual. Una preferencia visual persistida no guarda permisos, datos personales ni
accesos antiguos. No persistir el panel móvil abierto. Si se guarda el colapso de
escritorio, usar una clave del proyecto y tolerar almacenamiento no disponible.

## Escritorio, móvil y accesibilidad

- Navegación con `<nav>` y nombre accesible, listas de enlaces y encabezados de
  grupo. No usar `role="menu"`/`menuitem` para una lista normal de rutas.
- Ofrecer un enlace para saltar al contenido principal, visible al recibir foco,
  cuando la navegación se repita entre páginas.
- Usar el breakpoint local que mantenga legibilidad, sin fijar 760 px universal.
  En móvil conservar destinos, orden, permisos y textos del mismo mapa.
- Si el panel móvil bloquea el fondo, darle semántica de diálogo mediante la
  primitiva accesible local y mantener el `<nav>` dentro. Al abrir, mover el foco
  a un elemento útil; contener Tab/Shift+Tab y desactivar el fondo. Al cerrar por
  Escape, botón interior visible o fondo, devolver foco al disparador disponible.
  Al navegar en una SPA, cerrar y llevar foco al contenido/título según el router.
- Panel cerrado fuera del orden de tabulación y del árbol accesible. Escape
  actúa sobre la capa superior; un selector o diálogo anidado no cierra todo a la
  vez. Retirar bloqueo, `inert` y capas al cerrar, desmontar o cambiar de tamaño.
- Un disparador tiene nombre accesible, `aria-controls` que resuelva a un ID real
  y `aria-expanded` sincronizado. Proveer salida visible dentro del panel cuando
  el disparador exterior queda inerte.
- Colapso de escritorio y apertura móvil son estados distintos. En modo compacto,
  mantener nombres accesibles y etiquetas consultables con teclado y puntero;
  `title` por sí solo no es suficiente. Móvil recupera los textos completos.
- Objetivos de 44 × 44 px como mínimo, foco visible, contraste y movimiento según
  FRONTEND. El activo se distingue además del color. Nombres largos, zoom y alto
  reducido no deben ocultar destinos ni salida; permitir scroll interno sin
  desbordamiento horizontal de toda la página.
- Coordinar panel, fondo y diálogos con la escala de capas local y
  [portales](CATALOGS.md#diálogos-y-portales). No copiar anchos, z-index, paleta,
  logo, tipografía ni duración de transiciones de otro proyecto.

## Evidencia para adopción

La ficha incluye mapa de rutas/componentes/políticas, elección de shell y resultado
de los casos aplicables. Antes de declarar conforme una navegación intervenida:

1. Verificar destinos y grupos tras filtrar acceso; ningún grupo vacío o acción
   de escritura visible para quien solo puede consultar. Probar acceso directo
   a la ruta restringida con fixtures, además de su ausencia en el menú.
2. Recorrer enlace, URL directa, recarga y Atrás/Adelante; comprobar activo único,
   detalle/edición, query/hash/alias aplicables y ruta desconocida sin falso Inicio.
3. Comprobar escritorio expandido/compacto si existe, móvil a 375 px y escritorio
   a 1440 px, texto/zoom 200 %, altura reducida y etiquetas largas. Registrar
   dimensiones y ausencia de pérdida de destinos o desbordamiento de página.
4. Usar solo teclado: abrir, recorrer Tab/Shift+Tab, cerrar con botón y Escape,
   retorno de foco, navegación SPA y panel cerrado inaccesible. Revisar nombres,
   `aria-current`, `aria-expanded` y semántica del panel.
5. Probar resize con panel abierto, remontajes y apertura de diálogo desde menú;
   ninguna capa o `inert` permanece bloqueando el contenido. Comprobar que la
   preferencia compacta no oculte etiquetas móviles y que fallar storage no rompa
   la navegación cuando se persiste.
6. Cubrir sesión/permisos pendientes, error y cero destinos, cambio de contexto
   cuando exista y captura pendiente si el flujo la admite. Cerrar sesión debe
   conservar la recuperación local ante error sin fingir una salida exitosa.
7. Con secciones colapsables: abrir/cerrar dos grupos de forma independiente,
   incluyendo el activo; comprobar teclado, chevron, señal del activo oculto y
   ausencia de foco en contenido cerrado. Verificar ruta directa/recarga/historial,
   persistencia válida/corrupta/ausente cuando aplique, cambio de usuario/permisos,
   barra compacta y móvil sin perder destinos o reiniciar elecciones por render.

Registrar «no aplica» con motivo, defectos y pendientes sin acreditar una cobertura
inexistente. Usar datos ficticios y controles de red apropiados. El checker valida
documentación/integridad; no ejecuta el ejemplo ni certifica UI, router o permisos.

La revisión de código también debe mostrar: archivo canónico de cada composición,
imports desde al menos dos pantallas/rutas cuando existan, mapa compartido de ambas
variantes, proveedor/controlador único y ausencia de listeners/trampas duplicados.
En navegador comprobar el rol de enlace, no solo href, además del activo y teclado.
Contar componentes o buscar sus nombres con regex no acredita reutilización real.

## Fuentes de controles

Selección contrastada el 2026-10-14 con documentación oficial de
[Sidebar](https://ui.shadcn.com/docs/components/sidebar),
[Sheet](https://ui.shadcn.com/docs/components/base/sheet),
[Button y enlaces](https://ui.shadcn.com/docs/components/base/button#as-link),
[Tooltip](https://ui.shadcn.com/docs/components/base/tooltip),
[NavigationMenu](https://ui.shadcn.com/docs/components/base/navigation-menu),
[Collapsible](https://ui.shadcn.com/docs/components/base/collapsible),
[Breadcrumb](https://ui.shadcn.com/docs/components/base/breadcrumb) y
[DropdownMenu](https://ui.shadcn.com/docs/components/base/dropdown-menu).
Las reglas de composición/reutilización son el contrato local del estándar;
las APIs se verifican contra la base y versión del consumidor.
