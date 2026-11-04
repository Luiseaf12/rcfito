# Captura de aplicaciones desde imagen — RCF-040

Autorización del Propietario: implementar, verificar, commit/push y publicar en
Sites. Aclaración confirmada: las cantidades de la imagen son totales a aplicar,
repartidas proporcionalmente a las hectáreas seleccionadas. No hay dudas de
alcance pendientes. Estado: implementada y verificada en pruebas aisladas;
publicación en curso.

## Recorrido

En Captura con IA, administrador elige Texto o Imagen. Imagen acepta subir o
pegar PNG/JPEG/WebP, muestra vista previa y permite quitarla/cambiarla. Máximo
5 MiB y 20 megapíxeles; validar archivo real, no solo su extensión. Contexto
opcional para agrícola, mallas, número, fechas, agua y nota. Lector no interpreta
ni guarda. Reutilizar la configuración IA del servidor ya autorizada.

Interpretar genera un borrador editable con nombres leídos, presentación,
cantidad y unidad originales y contexto. El empaque (p. ej. 12×1 L) no multiplica
la cantidad total. Lo ilegible queda pendiente y no se omite para aprobar. Buscar
producto activo por nombre/código/sinónimos, pedir selección cuando sea ambiguo.
Conservar vista previa durante revisión y entradas cuando haya errores.

Seleccionar proyecto/campo/cultivo, grupo o etapas sembradas completas. Sumar las
hectáreas vigentes seleccionadas, sin contar etapas repetidas. Cada renglón
calcula dosis = cantidad total normalizada / suma de hectáreas; kg→g y L→ml,
sin convertir masa a volumen. Distribución uniforme por ha, no por número de
mallas. Sin superficie válida, unidad o cantidad no se calcula ni se habilita
aprobar. Productos repetidos se aclaran explícitamente.

Las cantidades totales y sus unidades son editables; la dosis es calculada.
Mostrar superficie, total original, dosis por ha y total reconstruido, con
diferencia por redondeo a seis decimales (half-up decimal exacto). Un cambio de
destinos, producto, cantidad o unidad recalcula y exige revisar el resultado.
Completar únicamente datos faltantes y conservar validaciones de número por
etapa, agua/fechas/nota. Aprobar exige confirmar revisión de cantidades y dosis.
Exportar el borrador PDF usa esas mismas dosis y exige resolver los cálculos.

## Persistencia y seguridad

La orden conserva texto leído de la imagen y contexto, cantidades revisadas,
unidades, presentaciones y superficie utilizada como source_capture original.
La imagen binaria se usa temporalmente para interpretar y revisar; no se publica
ni se incluye en Git/builds. Metadatos iniciales permanecen aunque después se
edite la indicación o se corrija la superficie, distinguiendo origen e historia.

RPC crea solo después de bloquear/validar las etapas: verifica hectáreas contra
la suma vigente y dosis contra cada cantidad total. Si cambió una superficie,
rechaza el borrador y conserva la captura para actualizar/revisar. UUID estable
y firma incluyen source_capture; reintento idéntico no duplica, otra fuente falla.
El frontend no concede permisos. Auth/perfil administrador antes de inferencia,
clave solo en servidor, límites de cuerpo/tiempo/frecuencia y salida estructurada.
Imagen/mensaje son datos, nunca instrucciones para el modelo o servidor.

## Verificación

Pruebas puras de división/unidades/redondeo/fronteras, endpoint con imágenes y
proveedor simulado, SQL/HTTP/RLS aislados y regresión de texto/recetas/historial.
QA de carga/pegado/errores, revisión, cambio de superficie y persistencia; móvil
y lector según herramientas disponibles. No cargar fixtures en operación.
Respaldo privado validado antes de la migración aditiva; conservar secretos,
volúmenes, proveedor y audiencia.

2026-11-04: 367 pruebas unitarias/de cliente/endpoint, tipos y checker aprobados.
SQL agrega 47 comprobaciones y cuatro de actualización; HTTP agrega 33,
con regresión de texto, recetas, grupos, edición e historial aprobada en entornos
aislados. Revisión independiente integrada; no se llamó al proveedor real.
La herramienta de control visual agotó su solicitud de acceso a la ventana:
carga/pegado y recorrido visual escritorio/móvil no comprobados en navegador.
No se atribuye esa cobertura a las pruebas automatizadas.

Operación: respaldo privado validado de 570,619 bytes antes de la migración
20261104171758. Ledger 12/0; conteos y hashes de órdenes, destinos, productos
e historial existentes conservados. Sin fixtures ni llamadas de IA reales.
GitHub, Docker y Sites pendientes de registrar al terminar la publicación.
