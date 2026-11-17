# Clasificaciones múltiples y sinónimos de ingredientes — RCF-047

Autorizado por el Propietario el 2026-11-17. Estado: implementado y publicado en Sites 48; Docker actualizado.
El agente principal asume diseño, desarrollo, QA y autorrevisión.

## Reglas y recorrido

Clasificaciones de uso reemplaza el nombre visible Usos de ingredientes; conserva
su tabla, claves y permisos. Ingredientes activos y Productos permiten seleccionar
varias clasificaciones, hasta 100, con una principal opcional entre las elegidas.
Sin principal conserva todas las relaciones. Cada producto tiene selección propia;
no hereda automáticamente la de sus ingredientes. El listado y el detalle muestran
todas, distinguen la principal y permiten buscar y filtrar por cualquier clasificación.
Una referencia inactiva existente puede conservarse o destacarse como principal;
no se ofrece para nuevas relaciones. Desactivación conserva referencias e historial;
eliminación física bloqueada si cualquier ingrediente o producto la relaciona.

Ingredientes permite agregar/quitar hasta 20 sinónimos de 2 a 80 caracteres.
Se buscan en el catálogo del ingrediente. Comparación exacta compacta como en
productos: NFD, sin diacríticos U0300–036F, minúsculas y solo a-z/0-9. Se rechaza
repetición propia, nombre/código propio y equivalencia a nombre/código/sinónimo
de otro ingrediente, incluso inactivo. También se bloquea renombrar con un alias
ajeno. No se aplica similitud aproximada entre ingredientes: nombres químicos
cercanos pueden ser distintos. Los ámbitos de alias de productos e ingredientes
son independientes; no se resuelven productos de IA usando aliases de ingredientes.
La regla anterior de sinónimos de productos sigue vigente.

## Persistencia, historial y compatibilidad

Una migración aditiva conserva el principal existente dentro de classification_ids;
productos y sinónimos de ingredientes empiezan vacíos, sin clasificaciones inventadas.
Los conjuntos acotados permanecen con su padre para conservar REST/RPC atómicos.
Triggers con bloqueo de referencias y GIN verifican existencia, actividad, duplicados,
principal y eliminación; no se depende solo de UI. El lock de términos de ingrediente
es por sentencia y serializa las reservas concurrentes de alias antes de filas.
Omitir campos nuevos conserva sus valores en clientes previos; una principal nueva
se añade al conjunto. Retirar la principal no borra otras clasificaciones.

Historial desde la habilitación: nombres, estado, selección, principal y sinónimos
antes/después, autor de sesión y fecha; etiquetas históricas copiadas. Se agrupan
cambios del mismo registro/transacción. Solo administración consulta el historial;
clientes no insertan, editan ni eliminan eventos. DELETE conserva el evento sin FK
al registro eliminado. Historial previo de productos y aplicaciones permanece intacto;
no se inventan eventos retrospectivos. Ningún cambio reescribe snapshots de siembra,
indicación o realización. Referencias mínimas por permiso incluyen clasificaciones
secundarias necesarias; no exponen sinónimos ni catálogos completos ocultos.

## Aceptación y verificación

Crear/editar/releer ambos catálogos, dos usos, principal opcional, búsqueda/filtro,
retención de inactivos, bloqueo de eliminación, alias duplicados/ajenos/inactivos,
concurrencia, permisos de lector/anónimo, autor real e historial inmutable.
Pruebas de dominio, SQL con actualización de datos previos y Auth/REST aislados;
tipos/build/checker y QA visual escritorio/móvil con datos ficticios.
Antes de operación: respaldo privado validado, ledger coherente y comparación
privada de registros y snapshots. Publicar la revisión verificada conservando audiencia.


2026-11-17: 406 pruebas cliente aprobadas; tipos/build/checker válidos.
QA demo: dos clasificaciones, principal/ninguna, sinónimo, búsqueda tras recarga,
filtro secundario en productos, error duplicado conservando formulario, historial
de ambas versiones y descarte. Móvil 375 px: diálogo 329.8 px, documento 375 px;
viewport restaurado. Evidencia ficticia privada en .artifacts/multiple-classifications.
La demo acredita UX; seguridad/persistencia se verifica con SQL y HTTP reales aislados.
Auditoría de dependencias de producción sin vulnerabilidades; npm ci informa cinco
alertas altas de tooling previo, sin cambios de dependencias en esta entrega.

574 controles SQL aprobados, incluida actualización de principales previas sin
alterar recetas/destinos, rollback de nombre/composición ante error y auditoría
inmutable. 315 comprobaciones Auth/REST/Edge/RLS aprobadas en stack aislado;
reserva concurrente de sinónimo con exactamente una aceptación. Advisors sin
WARN/ERROR. El entorno ficticio quedó detenido y sus datos retirados.


Cierre: fuente `573fd414a3d065b84ca75206b608d96e791330ef` enviada a GitHub,
Docker y Sites 48 succeeded. Respaldo privado custom validado (644,583 bytes),
ledger SHA-256 16/0 y comparación de todas las tablas de negocio y auditoría previa
idéntica, excluyendo solo las columnas aditivas verificadas. Principales existentes
conservadas, sinónimos/productos sin inferencias e historial nuevo vacío al migrar.
37 recursos estáticos exactos por destino, entrada y seis controles de configuración/
Auth/rechazo anónimo por destino (88 en total); 20 controles HTTPS adicionales.
Audiencia pública, R2 y entorno revisión 1 conservados. Sin fixtures operativos,
sin tocar secretos, volúmenes ni el .env preexistente.
[Publicación y recuperación](../OPERATIONS.md#clasificaciones-múltiples-y-sinónimos--rcf-047).
