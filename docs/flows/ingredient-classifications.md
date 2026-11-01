# Usos y clasificación principal de ingredientes

Solicitud del Propietario, 2026-11-01: administrar los usos/clasificaciones en un
catálogo y relacionarlos desde Ingredientes activos. Estado: implementación en
verificación. Negocio: [PRODUCT](../PRODUCT.md#catálogos); controles:
[catálogos](catalogs.md). El agente principal asume desarrollo, QA y autorrevisión.

## Recorrido y reglas

El administrador abre **Usos de ingredientes**, crea una opción con nombre y
estado, y la elige en **Clasificación principal (opcional)** al crear/editar un
ingrediente. Ver/Editar, búsqueda, paginación y baja lógica reutilizan el catálogo
común. El listado y el detalle del ingrediente muestran su clasificación;
buscar por ese nombre encuentra los ingredientes relacionados.

Cada ingrediente tiene una clasificación principal opcional. Los registros
actuales permanecen Sin clasificación hasta que el administrador los relacione.
No se precargan categorías ni se clasifican datos reales automáticamente.
La clasificación no modifica la concentración producto-ingrediente.

El formulario ofrece opciones activas y conserva la inactiva previamente
guardada, identificada como tal. Se puede cambiar o retirar la relación. El
servidor valida UUID/actividad y permisos incluso por REST directo. Las opciones
con ingredientes relacionados no se eliminan físicamente; pueden desactivarse.
Los cambios del catálogo no reescriben nombres, dosis, composición ni snapshots
de las aplicaciones anteriores. No se cambia el contrato de esas copias.

## Compatibilidad, errores y permisos

La migración aditiva se aplica antes del frontend, tras respaldo privado validado.
Crear una tabla y una FK nullable conserva los ingredientes y productos existentes.
Las demos guardadas añaden el catálogo vacío sin reemplazar los datos del navegador.

Nombre vacío/duplicado o referencia inválida conserva el formulario y muestra el
error. Sin opciones se ofrece Sin clasificación y se indica el catálogo donde
mantenerlas. Una baja conserva la relación existente. El lector consulta el
catálogo común y los ingredientes; no obtiene Crear/Editar/Eliminar ni puede
escribir por API. Anónimo y usuario desactivado no consultan los datos.

## Verificación

Criterios: alta/edición/relectura de clasificación e ingrediente, búsqueda por
clasificación, relación opcional, opción inactiva existente/nueva, eliminación
protegida/libre, demo anterior intacta, lector y REST directo, móvil, foco y
cancelación. Ejecutar pruebas cliente, SQL y Auth/REST aislados, tipos/build y
control documental. Los resultados y la publicación se registran aquí al terminar.

2026-11-01: 202 pruebas de cliente, 327 comprobaciones SQL y 99 HTTP en
Supabase aislado aprobadas; seis migraciones, RLS y Auth reales. El control de
seguridad del entorno de prueba no emitió advertencias. Tipos, build y checker
documental aprobados. UI demo: crear/relacionar/recargar/buscar, conservar relación
inactiva al editar y excluirla en altas nuevas; lector sin acciones de escritura.
Formulario a 375 px sin desbordamiento; cancelación y retorno comprobados. Evidencia
ficticia local en `.artifacts/ingredient-classifications/relacion-ingrediente.png`.
Autorrevisión de contratos, FK, permisos y compatibilidad; no revisión independiente.

Operación: respaldo privado custom de PostgreSQL validado antes de aplicar la
migración; registro SHA-256 con seis aplicadas y cero pendientes. Comparación
privada de las tablas de productos/aplicaciones e historial idéntica antes/después;
catálogo nuevo vacío e ingredientes existentes sin clasificación. Sin fixtures ni
cambios al `.env` del usuario. Publicación del frontend pendiente de confirmación.

