# Acabado visual del menú

## Alcance y criterio

Complemento de [NAVIGATION.md](NAVIGATION.md) para diseñar o intervenir el aspecto
de la navegación. Convierte en una receta reutilizable la jerarquía, densidad y
composición observadas en Apoyosing. Conservar la identidad, paleta, fuente,
iconos y temas del consumidor; no copiar marcas ni introducir otro preset.

La receta concreta las obligaciones existentes de [FRONTEND.md](FRONTEND.md):
tokens, escala, componentes compartidos, estados, accesibilidad y evidencia.
Los valores de la tabla son el punto de partida visual; se pueden mapear a los
tokens existentes del perfil local y registrar los valores resultantes en su
ficha. No convierten un ancho, tipografía o color de Apoyosing en regla universal.
La adopción documental no cambia automáticamente la apariencia de una aplicación.

## Jerarquía, densidad y alineación

| Rol | Base de composición | Resultado que revisar |
| --- | --- | --- |
| Barra expandida | Ancho orientativo 16.5 rem; ajustar al perfil y etiquetas. Fondo sólido del token de navegación. | Identidad, grupos y cuenta forman una columna legible; sin recortar destinos. |
| Cabecera | Padding horizontal 12 px, superior 16 px; separación de 12 px entre bloques existentes. | Marca y control de colapso alineados; no competir con el listado. |
| Identidad | Fuente del proyecto; texto orientativo 18/24 px, peso 600 o el de la marca aprobada. | Logo e identidad con proporción estable; no añadir un segundo título de producto. |
| Área de destinos | Padding horizontal de 8 px; 12 px entre secciones y 4 px entre destinos. | Ritmo constante, sin huecos distintos por módulo ni enlaces pegados. |
| Encabezado de sección | 14/20 px, peso 500, texto secundario; altura interactiva mínima 44 px cuando sea trigger. | Menor protagonismo que los destinos; botón a todo el ancho y chevron al extremo. |
| Enlace de destino | 14/20 px, peso 500; padding horizontal 12 px, vertical 10 px y min-height 44 px. | Lectura uniforme; la altura crece si la etiqueta ocupa varias líneas. |
| Icono y etiqueta | Caja de icono 20 px, gap de 8–12 px elegido una vez por perfil. | Misma columna para iconos y otra para textos, también en etiquetas multilínea. |
| Forma del control | Radio orientativo 10 px, dentro del perfil de controles de FRONTEND. | Hover, activo y foco siguen la misma geometría sin saltos de tamaño. |
| Pie, si existe | Separador tenue, padding de 12 px y separación superior de 12 px. | Cuenta y salida se leen como zona propia; no añadir un bloque vacío o información ficticia. |

Implementar en rem/clases y tokens del proyecto, con referencia de raíz 16 px.
La altura mínima de 44 px y el crecimiento del contenido prevalecen sobre la
aritmética de padding. En barra compacta reservar espacio para controles de
44 px y sus márgenes: no reducirlos por usar una variante de icono pequeña.

El encabezado de grupo alinea su texto con el borde inicial de los iconos del
listado; las etiquetas de destinos comparten su propia columna. Reservar una
columna estable para el chevron y la señal del grupo activo cerrado. Evitar que
el largo de un título desplace flechas o empuje el texto de otros grupos.

Usar la biblioteca de iconos existente con tamaño y grosor coherentes. Elegir
iconos que ayuden a distinguir tareas cuando haya una correspondencia clara;
compartirlos es válido para el mismo concepto. No cambiar nombres de producto ni
inventar símbolos para forzar un icono diferente por ruta. El texto sigue siendo
la identificación principal y los iconos decorativos se ocultan a lectores.

## Estados y énfasis

| Estado | Tratamiento de la receta |
| --- | --- |
| Normal | Texto principal e icono legible sobre superficie neutra; enlaces del menú sin subrayado permanente. |
| Hover | Fondo tenue según el token de interacción; sin mover contenido, cambiar ancho o añadir bordes que alteren el layout. |
| Página actual | Fondo de acento tenue y marca lateral interior de referencia 3 px; texto de contraste suficiente. El peso puede subir a 600 si el perfil lo necesita. |
| Foco de teclado | Indicador de FRONTEND, visible incluso en el enlace activo. Es distinto de la selección y no se suprime para simplificar la estética. |
| Sección colapsable | Texto secundario, superficie neutra y chevron según apertura. La etiqueta conserva su jerarquía al ser un botón. |
| Grupo activo cerrado | Señal de forma y descripción accesible de NAVIGATION; no pintarlo como si fuera el enlace de la página actual. |
| Acción global opcional | Variante principal aprobada del proyecto; separada de los destinos. No imponer un gradiente ni añadir una acción nueva para decorar. |
| Cuenta y salida | Identidad principal legible, metadatos secundarios y salida con la variante existente. Evitar que todos los textos tengan el mismo peso. |

Para la selección, preferir fondo + marca lateral frente a acumular fondo intenso,
subrayado, borde completo, sombra y aumento de peso. Una alternativa del perfil
puede usar otro indicador de forma verificable; no depender solo del color.
El foco sigue siendo visible junto al activo. Hover no debe hacer que otro
destino parezca la página seleccionada. aria-current y permisos no cambian con CSS.

Limitar la eliminación de subrayado a enlaces de navegación; los enlaces de texto
del contenido conservan su contrato. No quitar outlines globalmente. Los estados
de carga/error/vacío siguen las composiciones comunes, con espacio de lectura y
acciones que no alteren la alineación del resto del shell.

## Tokens y controles compartidos

| Rol visual | Fuente local que mapear |
| --- | --- |
| Superficie y texto | sidebar / sidebar-foreground o equivalentes existentes. |
| Selección y hover | sidebar-accent / sidebar-accent-foreground y acento de navegación local. |
| Sección y metadatos | muted-foreground o equivalente, con contraste final verificado. |
| Borde y foco | sidebar-border / sidebar-ring o border / ring del perfil. |
| Tipografía, espacios y radio | font-sans, escala y variantes canónicas del proyecto. |

Los nombres son roles de mapeo, no nuevos tokens CSS que deban duplicarse.
Asignar la paleta existente a estos roles en el lugar canónico del tema; evitar
valores de color/espacio por página. La superficie de navegación debe mantener
legibilidad; no exige transparencia o blur. Los temas claro y oscuro tienen
sus propios valores de contraste, conservando la misma jerarquía y geometría.

Aplicar el acabado en las composiciones ya definidas: AppShell/AppNavigation,
NavigationSection, NavigationItems/Link y AccountMenu cuando exista. Mapear estilos
a SidebarHeader/Content/Footer, SidebarGroupLabel, SidebarMenuButton y triggers
Collapsible del consumidor. Un wrapper visual adicional necesita responsabilidad
real; no crear un segundo menú o un componente por pantalla para aplicar la receta.

Los encabezados colapsables requieren atención al componer Button: sus variantes
pueden aportar tipografía, color y padding de acción. Definir el rol de sección
en una variante/clase compartida del componente local; comprobar el estilo final
del trigger y su texto, no solo el contenedor h2. Conservar semántica, API y foco.
La ficha indica qué regla prevalece en la cascada. No recurrir a sobrescrituras
dispersas o !important por pantalla para corregir herencias.

En NavigationMenu superior se conservan jerarquía, tokens y estados; las medidas
de columna lateral no se trasladan literalmente. En móvil usar el mismo mapa,
renderer y roles tipográficos dentro de Sheet, con textos completos y cierre
visible. La barra compacta sigue el acceso a destinos y preferencias de NAVIGATION.

## Evidencia visual de la adopción

Completar la [ficha de navegación](templates/navigation.md) con tokens/valores
elegidos, variantes y archivos que poseen los estilos. Comparar en el mismo
entorno de navegador, tema, viewport y zoom; no atribuir al código una apariencia
que no se haya comprobado renderizada. Antes de cerrar una adaptación visual:

- Mostrar normal, hover, activo y foco; encabezados abiertos/cerrados, grupo activo
  cerrado y cuenta/acción si existen. Diferenciar cuál es destino y cuál sección.
- Verificar contraste real según FRONTEND, incluidos textos secundarios, iconos
  funcionales, foco y selección sobre los fondos finales. Respetar movimiento reducido.
- Revisar a 375 y 1440 px, temas soportados, zoom 200 %, altura reducida y nombres
  largos; no perder controles, salida o destinos ni provocar scroll de toda la página.
- Comprobar que fuente, peso, alineación, espacios y radios sean consistentes en
  al menos dos rutas y entre escritorio/móvil cuando existan. Probar teclado y
  colapso después de aplicar estilos; el buen acabado no acredita funcionalidad.
- Registrar capturas de los estados relevantes, pasos, resultado y pendientes.
  Componentes/imports correctos y checker aprobado no certifican el acabado visual.
