# Catálogos: mantenimiento y consulta

Fuente de negocio: [PRODUCT](../PRODUCT.md#catálogos).
Contrato visual: [CATALOGS](../../.project-standards/CATALOGS.md).
Estado de verificación: código y reglas revisados; recorridos demo, backend
aislado y alta/relectura real de una agrícola comprobados. La ficha precede a
la primera implementación. Los casos restantes se indican en la matriz.

## Usuario, entrada y recorrido

El administrador consulta, crea y mantiene catálogos. El usuario normal consulta
los datos de las agrícolas asignadas; sus permisos se comprueban también en
servidor. Las opciones globales de cultivo/producto no conceden acceso a campos,
proyectos, nombres o conteos de agrícolas ajenas.

Recorrido principal: abrir catálogo → buscar/filtrar → Ver o Crear/Editar →
validar/guardar → volver al listado conservando búsqueda, filtros, orden y página.
Ver presenta detalle legible sin mutar. El usuario autorizado puede pasar de Ver
a Editar manteniendo la identidad del registro.

## Registros de esta entrega

| Entidad | Captura y relaciones |
| --- | --- |
| Agrícola | Identidad y nombre; estado activo/inactivo. |
| Campo | Identidad/nombre y agrícola válida; estado. |
| Cultivo | Nombre y estado. |
| Variedad | Nombre y cultivo válido; estado. |
| Producto | Nombre comercial, unidad fija g o ml y dosis sugerida por ha; marca/familia opcionales; uno o varios ingredientes relacionados. |
| Ingrediente activo | Nombre y estado. La concentración opcional corresponde a cada relación producto-ingrediente. |
| Marca/familia | Nombre y estado; relación opcional del producto. |
| Infraestructura | Nombre y estado; selección por lote completo. |
| Medio de aplicación | Nombre y estado; dron/tractor/bomba manual son opciones configurables. |
| Usuario/asignaciones | Administración de rol y agrícolas permitidas; credenciales se gestionan con Auth, no como texto ordinario del catálogo. |

Los lotes, subdivisiones y etapas se mantienen en su proyecto de temporada,
conforme a la ficha de [proyectos](sowing-projects.md). No existe catálogo de
equipos. Las concentraciones deben admitir su unidad o formato explícito sin
asumir que todas expresan porcentaje. Vacío significa «no registrada», no cero.

## Controles, permisos y validación

- Reutilizar `CatalogPage`, `CatalogToolbar`, `DataTable`, `RecordDialog`,
  `RecordDetails` y estados comunes sobre los controles shadcn instalados.
- Cada fila consultable muestra **Ver**; cada fila editable añade **Editar**,
  con texto visible y nombre accesible que incluya el registro. El lector no
  obtiene Crear/Editar/Eliminar ni puede invocar una mutación directamente.
- Formularios con FieldGroup/Field/FieldLabel y errores próximos al control.
  Mostrar relaciones por nombre; conservar IDs estables y validarlos en servidor.
- Una variedad corresponde al cultivo elegido. La relación de ingredientes no
  puede duplicar el mismo ingrediente dentro de un producto.
- Baja lógica conserva el historial. La eliminación física solo está disponible
  cuando el registro no ha sido utilizado y el servidor confirma la operación.
  Una relación bloqueada ofrece dar de baja; no eliminar referencias en cascada.
- Una opción inactiva no se añade a relaciones nuevas; una referencia histórica
  existente sigue visible e identificada. Cambiar el nombre de un catálogo no
  debe reescribir los datos históricos de una siembra cerrada.

## Consulta y estado

### Edición válida e historial

Solicitud del Propietario del 2026-10-31: implementar edición en los diez
catálogos, explicar los bloqueos y conservar el historial. Criterios de esta
intervención:

| Catálogos | Campos editables | Bloqueo por uso |
| --- | --- | --- |
| Agrícolas | Nombre, clave y estado. | Identidad interna y fecha de creación se conservan. |
| Campos | Nombre, clave, estado y agrícola. | La agrícola no cambia si existe un lote relacionado, incluso histórico. |
| Cultivos | Nombre y estado. | Se conservan los snapshots de las etapas. |
| Variedades | Nombre, estado y cultivo. | El cultivo no cambia si existe una etapa relacionada, incluso planeada o cerrada. |
| Productos | Nombre, dosis predeterminada, marca, familia, ingredientes, concentraciones, estado y unidad. | La unidad no cambia si aparece en indicación o realización; incluye aplicaciones canceladas. |
| Ingredientes, marcas, familias, infraestructura y medios | Nombre y estado. | Los registros históricos conservan las referencias y copias utilizadas. |

Los campos bloqueados permanecen visibles, deshabilitados y con el motivo
al lado, asociado mediante `aria-describedby`. El resto del formulario permite
guardar. Las referencias inactivas previamente guardadas se pueden conservar;
no se ofrecen como relaciones nuevas. Los códigos no expuestos por el formulario
se conservan al editar. Cancelar/reabrir recupera lo persistido y los permisos
de lector permanecen de consulta.

Verificar edición/relectura en los diez catálogos; bloqueo y edición de los
demás campos en campo/variedad/producto usados; relaciones libres antes de uso;
referencias inactivas existentes; nombres duplicados; conservación de snapshots;
lector sin escritura; foco, teclado y móvil. La evidencia de cierre se registra
en esta misma ficha después de ejecutar los controles.

El buscador lleva etiqueta visible, lupa decorativa y `type="search"` sobre
InputGroup/InputGroupInput/InputGroupAddon. Filtra al escribir o pegar sin Enter;
conserva el texto capturado. La normalización de acentos/caso/espacios solo se
aplica a la comparación o consulta. Cambiar filtros reinicia la página.

Filtrar antes de paginar un conjunto de demostración acotado. En Supabase la
búsqueda y paginación deben abarcar el catálogo autorizado completo; descargar
una página y filtrarla no constituye búsqueda global. Si cambian consultas
rápidamente, una respuesta anterior no sustituye a la vigente.

Conservar filtros y captura frente a errores recuperables. Distinguir carga,
vacío, sin coincidencias, error, actualización y guardado. Un guardado confirmado
con relectura fallida informa «Guardado; no se pudo actualizar el listado» y
ofrece actualizar sin repetir la escritura. Bloquear doble envío; una respuesta
de creación desconocida requiere reconciliar identidad antes de reintentar.

## Diálogos y recuperación

Dialog compartido, título y descripción, portal fuera del shell, scroll interno,
foco inicial/retorno y Escape manejados por la primitiva. El fondo cubre también
la navegación. Cancelar sin guardar descarta el borrador; reabrir inicia con la
fuente persistida. Durante guardado evitar descarte accidental o doble envío.
Selectores dentro del modal conservan interacción y capas accesibles.

## Evidencia que debe completarse

| Caso | Resultado |
| --- | --- |
| Ver/Editar por fila, desde detalle y lector sin escritura | Ver y lector sin controles de escritura probados en demo a 1440 px. Recorrido completo de Editar desde detalle pendiente. |
| Alta, edición, baja, eliminación libre y eliminación bloqueada | Alta demo de «Cultivo de verificación» y descarte de edición probados. Guardas de relación probadas en dominio/SQL; baja/eliminación visual pendientes. |
| Producto con varios ingredientes y concentración vacía/con unidad | Dominio y backend SQL verificados; recorrido UI específico pendiente. |
| Variedad ligada a cultivo y referencia histórica inactiva | Regla de relación/histórico verificada en dominio/SQL; UI de edición histórica pendiente. |
| Búsqueda sin Enter, pegado, acentos, ceros y texto largo intacto | Búsqueda `verificacion` encuentra el nombre con acento en demo. Pegado, ceros y texto muy largo pendientes. |
| Sin coincidencias, filtros y página conservados al cerrar modal | Pendiente de casos de navegador específicos. |
| Error de captura, consulta fallida, doble envío y relectura fallida | Comportamiento revisado en código; inyección de fallos de red pendiente. |
| Alta y relectura en operación local | Login administrador real, guardado de una agrícola y conservación tras recargar comprobados; SQL corroboró el registro. Sin fixtures ni datos operativos identificables en esta ficha. |
| RLS: lector asignado/no asignado y acceso directo | SQL/HTTP reales aprobados en stack aislado. Demo lector oculta Culiacán. No acredita navegador conectado a operación. |
| 375/1440 px, texto 200 %, teclado, foco, Escape y portales | Recorridos de navegador a 1440 px y ancho móvil 375 px probados; buscador móvil corregido. Teclado/200 %/matriz completa de portales pendientes. |

## Mapa de implementación

| Contrato | Implementación y controles |
| --- | --- |
| CatalogPage/coordinación | [CatalogsPage y CatalogController](../../src/features/catalogs.tsx), compartidos por los diez catálogos mediante su `CatalogKind`. |
| CatalogToolbar | [CatalogToolbar](../../src/features/catalogs.tsx) compone SearchField, FormSelect y Button. |
| DataTable | [DataTable](../../src/features/catalogs.tsx) usa Table y sus partes, Button de orden/acciones y paginación mediante Button. |
| RecordDialog | [RecordDialog](../../src/features/shared.tsx) usa Dialog/Content/Header/Title/Description. |
| RecordDetails | [RecordDetails](../../src/features/shared.tsx), composición semántica `dl`; CatalogDetails añade Badge, Separator y acciones. |
| Captura | [CatalogEditor](../../src/features/catalogs.tsx), con ramas de campos por entidad, FieldGroup/FieldSet, FormInput y FormSelect compartidos. El producto tiene renglones propios de ingredientes/concentración. |
| Estados | [LoadingState, EmptyState, ErrorAlert y SaveButton](../../src/features/shared.tsx) sobre Skeleton, Empty, Alert y Button. |
| Datos y casos de uso | [WorkspaceProvider](../../src/data/workspace-context.tsx), [adaptador Supabase](../../src/data/supabase.ts) y [reglas de demostración](../../src/domain/rules.ts). La presentación no importa el cliente Supabase. |

La revisión de código confirmó texto visible Ver/Editar por fila, detalle
semántico, composición compartida y captura separada del adaptador. Aún falta
completar la matriz de interacciones del árbol final en navegador. Las pruebas
de dominio de [test/domain.test.ts](../../test/domain.test.ts) cubren relaciones,
baja lógica, concentración opcional y rechazo de escritura del lector; no
certifican RLS del servidor ni comportamiento del modal. La evidencia SQL/HTTP
independiente y sus límites están en [TESTING](../TESTING.md).

### Evidencia de esta intervención

Verificación del 2026-10-31: 17 pruebas nuevas; 51 pruebas puras de la revisión
publicable y 71 del árbol integrado con aplicaciones; 65 comprobaciones SQL
aisladas; tipos/build/check documental aprobados. Navegador demo comprobó
editar/guardar/recargar en los diez catálogos, bloqueos de campo y variedad,
clave de producto conservada, descarte/reapertura, Escape/retorno de foco y lector
sin escritura. Móvil 375 px sin desbordamiento, motivo visible y scroll interno.
Detalles y límites: [TESTING](../TESTING.md#edición-válida-de-catálogos-2026-10-31).

La marca de unidad bloqueada se consulta en servidor mediante solo IDs de uso,
con paginación y RLS, independientemente de las pantallas de aplicaciones. Un
esquema anterior sin aplicaciones se admite; otros errores impiden confirmar
la carga en lugar de desbloquear silenciosamente. No se modifican snapshots ni
se crean fixtures en operación. Quedan fuera de esta evidencia la edición real
de registros operativos, zoom/contraste y los casos anteriores aún pendientes.
