# Sinónimos de productos y selector de aplicaciones

Autorización: el Propietario solicita sinónimos editables solo por administrador,
validación de conflictos, uso en captura IA, selector ordenado por nombre con
ingredientes activos, commit/push y publicación en el mismo Site. Estado: implementado y verificado; publicación en curso.

## Recorrido y aceptación

Productos → Ver muestra los sinónimos registrados. Productos → Nuevo/Editar
permite al administrador agregar/quitar renglones y guarda producto, composición
y sinónimos de forma atómica. Hasta 20 nombres de 2 a 80 caracteres; errores junto
al campo, captura conservada, descarte protegido y doble envío bloqueado. Buscar
en Productos incluye sinónimos. El lector consulta sin mutaciones.

La captura IA conserva el nombre del mensaje y resuelve por coincidencia exacta
única entre nombre oficial, código y sinónimos de productos activos. Coincidencias
ambiguas o solo parecidas requieren seleccionar el producto; la dosis y unidad
siguen validándose. Mostrar cuándo el nombre capturado es un sinónimo del producto
seleccionado. La IA no inventa aliases, códigos ni ingredientes.

El selector compartido en alta, revisión IA, edición y realización se ordena por
nombre español, con números naturales y desempate estable por ID. Muestra nombre
una vez, seguido de ingredientes configurados separados por +; omitir el sufijo
si no hay ingredientes. Conservar la selección por ID y el código para grabar.
Productos inactivos ya indicados siguen disponibles al editar esa mezcla.

## Conflictos y persistencia

Tabla de sinónimos por producto con clave normalizada única, autor y fecha; RLS
de lectura para cuentas activas y escritura solo por RPC de administrador. La
lista explícita sustituye los sinónimos; omitirla conserva los anteriores para
compatibilidad con clientes previos. Cambiar nombres no modifica aplicaciones
históricas. No crear sinónimos automáticamente en registros existentes.

Comparación idéntica JS/SQL: NFD, quitar diacríticos U0300–036F, minúsculas,
separadores no alfanuméricos a espacios; comparación compacta sin espacios.
Bloquear duplicados propios y equivalentes al nombre/código del mismo producto.
Contra otro producto (también inactivo), bloquear alias equivalente a su nombre,
código o alias. Bloquear similitud si longitud mínima compacta≥4 y uno es prefijo
del otro o distancia Levenshtein≤1; si mínima≥10, distancia≤2. Cadenas más cortas
solo se bloquean por equivalencia. Son reglas explícitas, no garantía de todas
las confusiones semánticas del lenguaje; ninguna coincidencia ambigua se elige
automáticamente. No se considera un ingrediente como alias implícito.

Validar también al crear/renombrar/cambiar código contra aliases ajenos, sin
impedir nombres oficiales heredados parecidos entre sí. Serializar transacciones
del catálogo para impedir carreras entre aliases y nombres; no basta la UI ni
una consulta previa. Fallar atómicamente con el término y producto en conflicto.

## Verificación y publicación

Pruebas de dominio/etiquetas/matching, SQL y HTTP/Auth/RLS aislados, concurrencia,
inactivos, omisión/reemplazo, Unicode y rollback. QA demo de edición, errores,
recarga, captura por alias y selector en escritorio/móvil; lector sin edición.
Antes de migrar operación: respaldo privado validado y ledger coherente; sin
fixtures, cambios de claves, preparación o reset. Publicar el commit validado,
conservando audiencia y configuración. Evidencia: 197 pruebas cliente, 308 SQL y
87 HTTP aislados aprobados. QA demo de alias/conflicto/recarga/captura por alias,
selector móvil e identidad oficial al guardar; lector solo consulta. Respaldo
privado y migración operativa5/0 confirmados. IDs de publicación en OPERATIONS.
