# Consultas de aplicaciones por chat, audio y CLI

## Contexto implícito y tabla de consumo por malla

2026-11-01: el Propietario solicita probar «cuánto de cada producto se ha
aplicado en malla 5». El caso autorizado usa la última agrícola utilizada por
el usuario (Ensenada en su ejemplo), su temporada activa y el lote único que
corresponda a esa malla. No se fija una agrícola por nombre en el código.

La agrícola explícita prevalece sobre el contexto recordado; la temporada
explícita prevalece sobre el proyecto activo. El último uso se conserva por
usuario/instalación y se vuelve a validar contra RLS. Sin contexto recordado se
acepta una única agrícola autorizada o la única con temporada activa entre las
autorizadas; varias candidatas con temporada activa exigen elección. La tabla
identifica esa procedencia. No se presenta una temporada cerrada como actual.

«Malla» busca primero un lote coincidente. Si corresponde a un campo con un
solo lote en la temporada, se usa ese lote y se explica su procedencia. Varias
coincidencias conservan los botones de aclaración. El número 5 no coincide con15.

«Aplicado» consulta realizadas, con correcciones y superficies históricas. La
pregunta habitual tiene una interpretación determinista sin inferencia; tanto
chat como CLI reutilizan la misma rutina. La respuesta muestra tablas de filtros
aplicados/procedencia y de productos/total aplicado, separando L y kg. La lista
se pagina internamente sin omitir productos silenciosamente; el límite de 300
productos informa que se deben acotar filtros, sin ofrecer una página repetida.
Las elecciones conservan el alcance explícito de «todas las temporadas» cuando
ese sea el pedido del usuario.

Estado: publicado en Sites versión26 y frontend Docker actualizado. La prueba inicia con
Ensenada ficticia como último contexto usado y ejecuta después solo la pregunta
literal, incluyendo otra agrícola, temporada cerrada y aplicaciones no realizadas
para detectar mezclas incorrectas. El pipeline CLI→handler→Auth/REST→SQL pasó con
dos productos corregidos, tablas de filtros/resultados y cero tokens. 281 pruebas
integradas,124 SQL de consultas y129 HTTP acumuladas aprobadas; advisors sin
WARN/ERROR. La migración operativa quedó aplicada con respaldo, ocho aplicadas y
cero pendientes. La prueba usa datos ficticios, sin escrituras de aplicaciones
en operación. Sites confirmó succeeded para la fuente4b0a400; se conservaron
audiencia y configuración. Once comprobaciones posteriores de Sites/Docker
aprobaron bundle, tablas y protección de rutas. La verificación visual adicional
de estas tablas todavía no está registrada.

## Contrato general del chat y audio

Fecha: 2026-11-01. El Propietario autorizó implementar la propuesta de chat y
CLI, reutilizando la configuración de IA existente. Commit/push y publicación
conservan el destino y audiencia de OPERATIONS. Estado: implementado y publicado en Sites versión 25; frontend Docker actualizado.

## Usuario, entrada y objetivo

Administrador o lector activo consulta únicamente las agrícolas que puede leer
en Supabase. La ruta `/consultas` acepta texto y notas de voz; el CLI ejecuta las
mismas rutinas con filtros explícitos. La configuración de IA sigue reservada a
administración. Las consultas no modifican aplicaciones ni recomiendan dosis.

## Recorrido principal

1. Abrir Consultas y elegir, opcionalmente, agrícola/proyecto para acotar el ámbito.
2. Escribir una pregunta o grabar/adjuntar una nota de voz. Escuchar o descartar
   el archivo; transcribirlo y revisar el texto antes de enviar la pregunta.
3. El servidor valida sesión y perfil activo; el caso habitual se interpreta
   directamente y otros mensajes usan IA para preparar una consulta estructurada.
   Una rutina de lectura filtra y calcula bajo RLS, con límites.
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
y dos consultas, sin inferencia al elegir. Suite final: 265 pruebas aprobadas.
Sites confirmó succeeded para la versión 25; frontend Docker actualizado desde la misma revisión limpia 2e530ff. Nueve comprobaciones HTTPS posteriores aprobaron. Evidencia de publicación en [operación](../OPERATIONS.md#consultas-por-chat-audio-y-cli).
