# Consultas de aplicaciones por chat, audio y CLI

Fecha: 2026-11-01. El Propietario autorizó implementar la propuesta de chat y
CLI, reutilizando la configuración de IA existente. Commit/push y publicación
conservan el destino y audiencia de OPERATIONS. Estado: en verificación final.

## Usuario, entrada y objetivo

Administrador o lector activo consulta únicamente las agrícolas que puede leer
en Supabase. La ruta `/consultas` acepta texto y notas de voz; el CLI ejecuta las
mismas rutinas con filtros explícitos. La configuración de IA sigue reservada a
administración. Las consultas no modifican aplicaciones ni recomiendan dosis.

## Recorrido principal

1. Abrir Consultas y elegir, opcionalmente, agrícola/proyecto para acotar el ámbito.
2. Escribir una pregunta o grabar/adjuntar una nota de voz. Escuchar o descartar
   el archivo; transcribirlo y revisar el texto antes de enviar la pregunta.
3. El servidor valida sesión y perfil activo; la IA prepara una consulta
   estructurada. Una rutina de lectura filtra y calcula bajo RLS, con límites.
4. Leer respuesta, filtros, corte de datos y fuentes; abrir la aplicación citada
   o hacer una pregunta de seguimiento conservando solo la consulta previa.

## Contratos de datos y costo

Operaciones iniciales: pendientes, historial, uso de producto, detalle y cambios.
El CLI consulta sin inferencia. El chat utiliza una interpretación estructurada y
una respuesta determinista con las cifras calculadas; no envía tablas completas
ni historiales al proveedor. Audio reutiliza la clave guardada con un modelo de
transcripción específico. No se guardan audios ni conversaciones en el navegador
o repositorio; se conserva la conversación únicamente mientras está montada.

Cantidades usan dosis por superficie histórica, g y ml separados. Realizadas
usan lo real corregido; otros estados usan su indicación histórica. Pendientes
filtran por fecha programada. Se distinguen órdenes, destinos y número de
aplicación de etapa. Temporadas anteriores permanecen consultables. Ambigüedad
de nombres exige aclaración; datos incompletos se cuentan y no se inventan.
Las coincidencias se eligen mediante botones con identidad distinguible; la
elección reemplaza el nombre ambiguo por su ID y ejecuta la rutina sin otra
llamada de IA. El historial identifica el estado y la clase de fecha de cada fila.

La caché solo se entrega después de comprobar autorización y revisión vigente.
Su identidad incluye usuario, consulta y revisión; los cambios de datos/permisos
la invalidan. No se presentan resultados almacenados como actuales si el backend
está desconectado. El presupuesto y los límites del servicio son explícitos.

## Alternativas, recuperación y éxito

Sesión vencida, proveedor sin configurar, archivos inválidos y desconexión
conservan la pregunta para reintentar. Micrófono no disponible permite adjuntar
audio o escribir. La demo se identifica y no consume IA ni acredita RLS real.
Los homónimos se muestran como aclaraciones, sin elegir el primer resultado.

Éxito: respuesta y CLI coinciden con los registros autorizados, incluyen fuentes
y filtros, respetan correcciones/unidades y no permiten operaciones de escritura.
Audio requiere envío explícito para transcribir y revisión previa a consultar.
La UI conserva controles shadcn, objetivos táctiles, foco y lectura móvil.

## Evidencia

Pruebas integradas, tipos/build y check documental aprobados. Las rutinas
aprobaron 75 comprobaciones SQL y 19 HTTP nuevas con Auth/REST reales en entorno
aislado; advisors sin WARN/ERROR. Revisión independiente con hallazgos reparados.

Navegador con servicios ficticios: pregunta de detalle, cifras/fuentes, muestra
de fuentes y desplegable comprobados; viewport móvil de 375 px sin desbordamiento
horizontal (documento 360 px más scrollbar). Archivo WAV sintético, preescucha,
transcripción editable, edición/envío y error con texto/audio conservados
comprobados. CLI contra el mismo servidor HTTP ficticio confirmó consulta sin
inferencia. No se capturó voz del usuario ni se consumió proveedor real. Grabación
con micrófono físico y reconocimiento real quedan como límites de esta evidencia.

Selección de segundo lote homónimo verificada en navegador: una interpretación
y dos consultas, sin inferencia al elegir. Suite final: 261 pruebas aprobadas.
Despliegue de la revisión validada pendiente de confirmación nativa.
