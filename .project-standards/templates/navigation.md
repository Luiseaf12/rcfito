# Ficha de navegación — <proyecto o flujo>

Completar dentro de docs/FRONTEND.md o la fuente local del flujo; enlazar desde
ambos si corresponde, sin duplicar contratos. Aplicar
[NAVIGATION.md](../NAVIGATION.md). Una ficha sin evidencia queda pendiente.

- Alcance: navegación nueva/intervenida, rutas incluidas y heredadas fuera de alcance.
- Fuente de producto/flujo y responsable:
- Mapa canónico: archivo/configuración y equivalencia de campos del contrato.
- Shell elegido: lateral/superior, justificación y breakpoint local.
- Perfil visual: tokens, iconos, capas y componentes existentes.
- Sesión/contexto: fuente de políticas, estados de carga/error y cero destinos.

## Mapa local

Una fila por destino, incluyendo auxiliares cuando afecten el estado activo.
Referenciar políticas reales; los nombres del ejemplo no crean permisos.

| Grupo (ID/etiqueta) | Destino (ID/etiqueta) | URL / route ID y alias | Política de acceso | Activo en listado/detalle/edición | Encabezado/contexto |
| --- | --- | --- | --- | --- | --- |
| Por definir | Por definir | Por definir | Por definir | Por definir | Por definir |

- Acción global opcional: etiqueta, destino/operación, permiso y estado pendiente/error.
- Cuenta/salir, si aplica: comportamiento y recuperación ante error.
- Rutas desconocidas/restringidas y destino autorizado de recuperación:
- Grupos vacíos, opciones deshabilitadas autorizadas y cambios de contexto:
- Captura sin guardar, query/hash, historial y foco tras navegar:

## Secciones colapsables, si se habilitan

| ID de grupo | collapsible | defaultOpen | Contiene destino actual / señal al cerrar | Persistencia y ámbito |
| --- | --- | --- | --- | --- |
| Por definir | Por definir | Por definir | Por definir | Por definir |

- NavigationSection compartido: ruta/imports Collapsible/Trigger/Content y Sidebar.
- Estado openByGroupId: controlador único, callbacks y criterio de destino lógico.
- Apertura automática: inicial, navegación/historial y cambio de identidad/contexto.
- Elección manual: no reabrir por renders, consultas o filtros de la misma vista.
- Política de storage: opcional, clave versionada/aislada y fallback ante error.
- Barra compacta: acceso a todos los destinos y restauración de secciones al expandir.
- Foco al cerrar y estado visible/accesible del encabezado activo:

## Perfil y acabado visual

Aplicar [NAVIGATION-VISUAL.md](../NAVIGATION-VISUAL.md). Registrar los valores
locales de la receta y su motivo; no introducir una segunda fuente o paleta.

| Rol | Token/variante y archivo canónico | Valor resultante / adaptación al perfil |
| --- | --- | --- |
| Superficie, texto y temas | Por definir | Por definir |
| Marca e identidad | Por definir | Por definir |
| Encabezados de sección y trigger real | Por definir | Por definir |
| Enlaces, iconos y columnas de alineación | Por definir | Por definir |
| Padding, gaps, radio y anchura de barra | Por definir | Por definir |
| Normal, hover, activo y foco | Por definir | Por definir |
| Pie, cuenta y acción global si existen | Por definir | Por definir |

- Archivo/variante que comparte los estilos entre rutas y tamaños:
- Cascada de Button/Collapsible: comprobar fuente, color y padding del trigger final.
- Evidencia comparada: mismo tema, viewport, zoom y entorno de navegador.

## Componentes y estado

| Composición / responsabilidad | Archivo canónico e imports shadcn reales | Sitios que la reutilizan | Adaptación o diferencia justificada |
| --- | --- | --- | --- |
| AppShell / proveedores | Por definir | Por definir | Por definir |
| AppNavigation / Sidebar o NavigationMenu | Por definir | Por definir | Por definir |
| NavigationSection / Collapsible por grupo habilitado | Por definir | Por definir | Por definir |
| NavigationItems / NavigationLink / activo | Por definir | Por definir | Por definir |
| PageHeader / Breadcrumb si aplica | Por definir | Por definir | Por definir |
| Colapso / Tooltip si aplica | Por definir | Por definir | Por definir |
| Panel móvil integrado o Sheet compartido | Por definir | Por definir | Por definir |
| AccountMenu / acción global si aplica | Por definir | Por definir | Por definir |
| NavigationFeedback / estados | Por definir | Por definir | Por definir |

- Base instalada, versión, components.json y controles faltantes o no aplicables:
- Fuente única del mapa, evaluación de políticas y resolución de ruta activa:
- Dueño de estado: proveedor/controlador, open/callbacks y separación móvil/escritorio.
- Dueño de foco/Escape/portal: primitiva y retirada de handlers manuales duplicados.
- Semántica de enlace: API local utilizada, elemento/rol accesible final y activo.
- Reutilización: rutas/pantallas que importan la misma composición; sin mapas copiados.
- Eficiencia: imports necesarios, ausencia de doble Sheet/Tooltip/scroll y de remontes
  provocados por definiciones de componentes dentro del render. Sin promesas de
  rendimiento no medidas.

- Preferencias visuales: clave local, ausencia de datos sensibles y fallback de storage.
- Estado móvil: apertura/cierre, botón interior, Escape, navegación y resize.
- Excepciones: ID de standards.config.json, motivo, responsable y revisión, si existen.

## Evidencia

Registrar comando o pasos reproducibles, ruta, actor/capacidades ficticias,
viewport, resultado y captura cuando aporte evidencia. «No aplica» exige motivo.

| Caso | Pasos/comando y contexto | Resultado/evidencia o pendiente |
| --- | --- | --- |
| Grupos/destinos y políticas; acceso directo restringido | Por definir | Pendiente |
| URL directa, alias, recarga, historial, detalle y activo único | Por definir | Pendiente |
| Ruta desconocida/restringida sin falso Inicio | Por definir | Pendiente |
| Escritorio, compacto opcional, móvil, etiquetas largas, zoom 200 % y altura reducida | Por definir | Pendiente |
| Tab/Shift+Tab, Escape, cierre interior, retorno de foco y panel oculto | Por definir | Pendiente |
| Resize, remontajes, diálogo/portales y ausencia de bloqueo residual | Por definir | Pendiente |
| Carga/error/cero destinos, cambio de contexto, storage y captura pendiente | Por definir | Pendiente |
| Salir y recuperación ante error, si aplica | Por definir | Pendiente |
| Imports y composiciones compartidos en pantallas/variantes; estado y listeners únicos | Por definir | Pendiente |
| Controles reales renderizados, enlaces con rol correcto y ausencia de interactividad anidada | Por definir | Pendiente |
| Dos secciones independientes, grupo activo cerrable, señal/chevron, Enter/Espacio y foco fuera del contenido oculto | Por definir | Pendiente |
| Apertura por ruta/recarga/historial sin reabrir por render, cambio de permisos y preferencia válida/corrupta/ausente | Por definir | Pendiente |
| Secciones en barra compacta y móvil: destinos accesibles, mapa compartido y preferencias conservadas | Por definir | Pendiente |
| Acabado: normal/hover/activo/foco, jerarquía de secciones, alineación y cuenta/acción si existen | Por definir | Pendiente |
| Comparación visual entre rutas y tamaños; contraste final, temas, zoom y nombres largos | Por definir | Pendiente |

- Revisión del mapa/componentes y responsable:
- Verificación de navegador (fecha, revisión/árbol, entorno y responsable):
- Límites, defectos y pendientes (enlazar docs/PLANS.md cuando corresponda):
- Estado: pendiente / en verificación / conforme para el alcance comprobado.
