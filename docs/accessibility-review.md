# Revisión de accesibilidad — RCF-006

Alcance autorizado: teclado completo, zoom/texto al 200 %, ventanas de poca
altura y contraste medido. Se conserva el tema claro vigente y las reglas de
negocio. No constituye una certificación completa de WCAG ni inicia RCF-034.

## Criterios y recorrido

- Usuario y objetivo: administradores y lectores deben poder consultar y
  completar sus tareas sin ratón, con contenido ampliado y foco perceptible.
- Entrada: frontend local aislado con datos ficticios y los roles de demostración.
- Recorrido: navegar desde el shell → filtrar/abrir detalle → capturar o revisar
  información → corregir errores o cancelar/guardar → volver al contexto anterior.
- Alternativas: conservar permisos, estados vacíos/errores y protección del
  borrador; los controles relevantes deben quedar visibles y alcanzables.
- Recuperación: Escape en selectores/diálogos, confirmación de descarte cuando
  corresponda y retorno del foco al disparador; ningún diálogo debe atrapar al
  usuario sin salida ni perder sus acciones fuera del área desplazable.
- Éxito observable: recorrido operativo con Tab/Shift+Tab, Enter/Espacio,
  flechas y Escape; campos/errores con nombres accesibles, foco visible,
  acciones alcanzables al ampliar o reducir la altura y contraste suficiente.
- Evidencia: recorridos de demostración y mediciones del 2026-11-02 descritos abajo.

El estándar local exige 4.5:1 para texto normal y 3:1 para texto grande,
controles y foco; se consideran transparencias y superficies adyacentes.
Referencias: [contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
[teclado](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) y
[texto al 200 %](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).

## Matriz de revisión

| Área | Casos | Estado |
| --- | --- | --- |
| Shell/navegación | Salto al contenido activado por teclado; Escape devuelve al botón del menú móvil; elegir ruta enfoca el nuevo contenido. | aprobada |
| Catálogos | Alta ficticia con Enter/Tab/Espacio/flechas, validación asociada, guardado, búsqueda y detalle; Escape restaura su botón. Edición larga de producto y selectores. | aprobada |
| Proyectos | Detalle con historial, apertura de Planear etapa, elección de cultivo, protección de borrador y descarte con retorno al disparador. | aprobada |
| Aplicaciones/grupos | Destino grupal por teclado, búsqueda y elección de receta, mezcla y error de fecha; detalle, selección con Espacio, realización/cancelación revisadas sin confirmar; editor de grupo. | aprobada |
| Captura/consultas | Revisión ficticia con pendientes etiquetados; ejemplo de chat sin IA; compositor y controles de audio con nombres. Reportes: región de tabla enfocada y flechas desplazan 80 px. | aprobada |
| Usuarios/conexión | Rol y asignaciones etiquetadas, errores de conexión vacía; lector recibe explicación y enlace de retorno. Sin cuentas ni permisos reales modificados. | aprobada |
| Adaptación | 1440×900, 1440×450, 375×812, 375×450 y confirmación a 375×200. Sin desbordamiento de página; tablas con scroll propio. | aprobada salvo zoom real al 200 % |
| Contraste | 20 pares del tema claro; estilos renderizados de navegación, formularios, proyectos, aplicaciones y reportes; transparencias incluidas. | aprobada |

Las pruebas de escritura se limitan a demo; no se utilizan proveedor de IA,
micrófono ni cuentas/datos de operación para estas comprobaciones.

## Correcciones verificadas

- Campos y botones de contorno usan borde `#75836e`: 4.017:1 sobre tarjeta
  blanca y 3.731:1 sobre el fondo. El borde anterior ofrecía 1.398:1 sobre blanco.
- Foco con contorno opaco: 4.316:1 sobre blanco, 4.009:1 sobre fondo y
  3.269:1 sobre la acción principal. La sombra anterior al 50 % daba 1.902:1.
  La navegación oscura usa su propio foco claro, 8.968:1.
- El pie y el separador de ruta usan texto secundario con contraste 4.874:1
  sobre fondo; el pie anterior daba 4.224:1. Los enlaces de navegación realmente
  renderizados dan 7.766:1 y sus títulos 6.480:1.
- Los botones de cierre compuestos con Radix conservan un área de 44×44 px;
  antes el cierre del editor de producto medía 28 px de alto. Checkbox/radio
  conservan su control visual y su etiqueta interactiva.
- La confirmación de descarte queda dentro de una ventana de 200 px de alto
  (16–184 px), con desplazamiento propio. Antes sobresalía del área visible.
  «Seguir editando» devuelve el foco al campo y conserva su captura.
- Cerrar el menú móvil con Escape devuelve al botón; elegir una ruta conserva
  el foco en el nuevo `main-content`, sin que el cierre lo robe después.
- Las tablas que desbordan añaden región con nombre y parada de Tab; las que
  caben no añaden una parada innecesaria. ResizeObserver actualiza el estado
  al cambiar tamaño/contenido y se desconecta al desmontar.

`npm run a11y:contrast` mide los colores actuales y falla por debajo del umbral
sin redondearlo para decidir. Es una comprobación de pares de colores, no una
auditoría automática de todas las pantallas. El recorrido en navegador comprueba
los estilos renderizados y el comportamiento. No se detectaron errores ni avisos
de consola durante los casos revisados.

## Verificación pendiente

La herramienta de control nativo necesita reconocer una URL web visible en
Edge; con la ventana en «Nueva pestaña» no permite iniciar el control. Se solicitó
abrir `http://127.0.0.1:5195/#/` para completar el zoom real al 200 %.
Los tamaños reducidos anteriores no se presentan como sustituto de esa prueba.
RCF-006 permanece en curso hasta contar con esa evidencia y su publicación.
