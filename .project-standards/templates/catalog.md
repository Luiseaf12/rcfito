### Catálogo: [nombre]

- Usuario/objetivo y fuente de reglas: [quién consulta o administra qué; enlace al contrato local].
- Entrada y permisos: [ruta, precondiciones, capacidades de Ver/Crear/Editar y autorización de servidor].
- Recorrido: [listado → búsqueda/filtros → detalle/captura → validación → guardado → actualización].
- Controles obligatorios: [mapa de CatalogPage/Toolbar/DataTable/RecordDialog/RecordDetails/estados a archivos compartidos; controles shadcn usados por función; formulario específico; diferencias registradas con motivo/responsable/revisión].
- Acciones Ver/Editar: [Button visibles por fila y etiquetas accesibles; detalle → Editar; identidad del registro; roles/capacidades, bloqueos y fuente si el producto admite solo consulta].
- Modal/portales: [host y tema, nivel modal del shell, selector anidado, límites/scroll, foco/Escape y retirada al desmontar].
- Registro y captura: [identidad estable, campos, valores iniciales, validaciones y errores por campo].
- Consulta: [local o servidor, campos buscables, normalización, filtros iniciales, orden, página/cursor y total/continuidad].
- Buscador: [control compartido con lupa/etiqueta, filtrado al escribir/pegar sin Enter, texto intacto, normalización solo al comparar, sugerencias opcionales y alcance de limpieza].
- Estado/contexto: [propietarios de consulta/borrador/selección; conservación, ajuste de página y cancelación/reapertura].
- Persistencia: [operación única o resultado parcial permitido; permisos, atomicidad, concurrencia y respuesta desconocida].
- Guardado y actualización: [confirmación persistida, conjuntos afectados y recuperación si falla la relectura].
- Alternativas: [carga, vacío, sin coincidencias, consulta fallida, captura inválida y falta de permiso].
- Éxito observable: [qué confirma persistencia y cómo vuelve al contexto del listado].
- Adaptación local: [stack/versiones, diferencia justificada o enlace a registro; responsable y revisión si aplica].
- Evidencia: [entorno ficticio/aislado, ruta, viewport, teclado, pasos, resultado y comandos; «pendiente» hasta comprobar].

Comprobar recorrido principal, error recuperable, permisos, contexto conservado,
cancelación/reapertura, doble envío y guardado confirmado con fallo de actualización.
Verificar búsqueda en vivo, espacios/mayúsculas/acentos/ceros y texto largo sin
alterar la captura, sin coincidencias, limpieza/foco y filtros conservados; buscar no escribe.
Verificar Ver → Editar, fondo sobre navegación, título/acciones sin recortes,
opciones visibles y accesibles, texto al 200 % y remontajes sin portales huérfanos.
Comprobar Ver y Editar desde fila en escritorio/móvil y teclado; actor autorizado
y actor de solo consulta, incluida llamada directa al controlador sin permiso.
No declarar conforme sin los controles aplicables y ambas acciones autorizadas
funcionales. Un checker documental no sustituye revisión de imports/uso y navegador.
Si existe operación compuesta, incluir evidencia de persistencia y recuperación.
Puede completar una ficha de flujo existente; enlazar sus reglas y evidencia para
evitar duplicación. Contrato: [CATALOGS.md](../CATALOGS.md).
