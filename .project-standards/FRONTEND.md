# Interfaz compartida

## Lenguaje visual

La base común fija roles y comportamiento. La marca local asigna su fuente,
paleta y shell en `docs/FRONTEND.md`; no copiar logos ni introducir un tema o
preset nuevo por una tarea aislada. Reutilizar shadcn/ui y los componentes
existentes; el adaptador y la librería instalada dependen del proyecto.

Usar tokens semánticos para fondo, texto, superficie, borde, foco, acción y estado.
Colores de marca y gráficos no son niveles de riesgo. Un token nuevo compartido
se define antes de usarse; no añadir valores aislados por pantalla.

## Escala y composición

- Espaciado base de 4 px: 4, 8, 12, 16, 24, 32; usar rem/clases del proyecto.
- Texto de lectura: 16/24 px; controles/tablas: 14/20; ayuda: 12/16 como mínimo.
- Página: 24/32 px móvil, 30/36 escritorio; sección: 20/28; tarjeta: 16/24.
- Un `h1`, encabezados semánticos ordenados, pesos 400/500/600 por rol.
- Controles táctiles de al menos 44 × 44 px; no encogerlos para hacer caber tablas.
- Una acción principal por bloque; título, explicación, filtros, resultados y
  acciones en orden consistente. Alinear al contenedor del proyecto.
- Control con label asociado; ayuda y error junto al campo. Placeholder es ejemplo.
- Tablas financieras: cifras a la derecha, `tabular-nums`, formateador del dominio,
  encabezado legible, unidades y contexto del filtro visibles.
- Scroll horizontal dentro de la tabla, nunca en toda la página; acciones con wrap.
- Radios por rol: controles 8–12 px, tarjetas 14–20, diálogos hasta 24. Valores
  concretos en el perfil de marca; evitar variantes arbitrarias por pantalla.

## Comportamiento

Al crear o cambiar el comportamiento de un flujo importante, aplicar la ficha
de [DOCUMENTATION.md](DOCUMENTATION.md#flujos-de-usuario) antes de programar.
Implementar el recorrido con componentes y validaciones existentes; cada pantalla
permite entender qué hacer, qué está pasando y cómo continuar. Comprobar el
recorrido y registrar evidencia en la misma ficha.

Carga inicial, actualización, vacío, error y éxito son estados distintos. Mostrar
progreso en operaciones lentas, impedir doble envío y conservar captura en error.
Un error explica qué falló y cómo continuar; una notificación no sustituye un
error junto al campo. Estados de permisos/bloqueo conservan la regla del producto.

Selectores buscables cuando el catálogo lo requiere: teclado, sin coincidencias,
limpieza cuando sea válida y conservación del valor real. Ordenar por tipo de
dato y mostrar la dirección cuando la tabla ofrece ordenación. Paginación no
debe descargar una cartera completa para aparentar un límite de servidor.

Diálogos con título, foco inicial/retorno, Escape y acciones accesibles; la
confirmación destructiva explica el efecto. Datos y cálculos no cambian para
acomodar el diseño. Fechas, moneda y decimales conservan su contrato local.

## Menús y navegación

Navegación principal nueva o intervenida aplica [NAVIGATION.md](NAVIGATION.md):
mapa compartido por escritorio/móvil, agrupación por tareas, ruta activa,
encabezado, permisos locales y panel accesible. Sus controles shadcn aplicables y
composiciones compartidas son obligatorios; reutilizar el mismo shell, mapa,
renderers y dueño del estado, sin duplicarlos por pantalla o viewport.
Los grupos laterales pueden activar secciones colapsables mediante
NavigationSection sobre Collapsible/Trigger/Content; apertura independiente,
orientación de ruta, teclado y preferencias siguen el contrato de navegación.
El [acabado visual del menú](NAVIGATION-VISUAL.md) concreta jerarquía, ritmo,
alineación y selección sobre esos controles, con valores iniciales adaptables
al perfil de cada proyecto y evidencia de la apariencia renderizada.
Registrar imports, sitios de uso y evidencia con
[templates/navigation.md](templates/navigation.md). Se conservan
marca, stack y módulos locales; no se exige copiar el menú de otro producto.

## Catálogos

Catálogos nuevos o cuyo recorrido se intervenga aplican [CATALOGS.md](CATALOGS.md):
composición de listado, filtros, detalle/captura y estados sobre los componentes
del proyecto. Cada entidad conserva su formulario y reglas. Guardado y actualización
posterior son resultados distintos; conservar el contexto y la captura ante errores.
Documentar el adaptador y la evidencia con [templates/catalog.md](templates/catalog.md).

## Reporte histórico

Reportes nuevos o intervenidos de tipo Histórico aplican
[HISTORICAL-REPORTS.md](HISTORICAL-REPORTS.md): doce renglones de meses, columnas
de años y una métrica por matriz. Cada proyecto conserva cálculo, periodo,
formato y filtros locales. Reutilizar una composición compartida con sus
adaptadores y registrar la configuración y evidencia en
[templates/historical-report.md](templates/historical-report.md).

## Captura de dinero

**Todo campo de moneda usa `MoneyInput`**, tanto para capturar y editar como para
mostrar un input de solo lectura. Es el componente monetario del proyecto sobre
`Input` de shadcn; el nombre obligatorio es `MoneyInput` en los tres proyectos.
Su implementación se adapta al stack local. Porcentajes, tasas, plazos y cantidades
de personas no son moneda; tablas, textos y exportaciones usan el formateador local.

`MoneyInput` debe:

- Mostrar moneda, miles y decimales según el contrato local; permitir escritura
  parcial y completar el formato al salir. Vacío y cero son valores distintos.
- Usar texto con teclado decimal (`type="text"`, `inputMode="decimal"`), sin
  flechas de incremento/decremento ni cambios por rueda, incluso con foco.
  Conservar el foco y el scroll de la página; ocultar las flechas con CSS no basta.
- Entregar el valor sin formato para cálculos/envío y conservar unidades,
  precisión, redondeo, límites, negativos y validación de servidor del dominio.
- Conservar etiquetas, ayuda, errores y estados accesibles del control existente.

Documentar `MoneyInput` en `docs/FRONTEND.md` o su contrato enlazado. Los campos
heredados con otros controles deben migrarse a `MoneyInput`; registrar su migración
y evidencia pendientes hasta completarlas. La adopción documental no acredita UI.
Al adaptar un campo, comprobar con datos ficticios carga, vacío, cero, decimales,
miles, escribir, borrar, pegar, desenfoque, restablecimiento y valor enviado con sus
unidades; verificar rueda con foco, teclado decimal móvil, temas y estados, y
registrar evidencia en la ficha del flujo.

## Accesibilidad y evidencia

Teclado completo, foco visible, nombres accesibles en iconos y etiquetas visibles.
Estados con texto/icono además de color. Medir contraste final: 4.5:1 texto normal,
3:1 texto grande, controles y foco; considerar transparencias. Respetar movimiento
reducido. Nuevas transiciones no esenciales: 150–200 ms; las heredadas distintas
se registran como deuda y se ajustan cuando se interviene el componente.

Antes de cerrar una UI afectada, comprobar 375 y 1440 px, zoom 200 %, temas
soportados, teclado y estados relevantes con datos ficticios. Registrar ruta,
viewport, pasos, resultado y capturas cuando aporten evidencia. El checker
documental no reemplaza navegador ni garantiza que toda UI heredada cumpla.
