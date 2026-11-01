# Configuración de IA desde Conexión y preferencias

Fecha: 2026-10-31. Autorizado por el Propietario: implementar la sección,
commit/push y publicar en Sites conservando audiencia. Estado: implementada y publicada en Sites versión 13; frontend Docker actualizado.

## Usuario, entrada y objetivo

Solo el administrador activo configura la IA de esta instalación desde
`/conexion`. El lector y la sesión pendiente no ven la sección ni pueden usar
sus endpoints. La demo puede mostrar el formulario identificado, sin recibir
claves ni simular una configuración del servidor.

## Recorrido principal

1. Consultar estado del servidor: pendiente o configurado, modelo, última prueba
   y terminación enmascarada. La clave completa nunca regresa al navegador.
2. Ingresar clave y modelo. Clave vacía conserva la que ya está guardada; cambiar
   clave o modelo invalida la prueba previa. La captura queda únicamente en memoria
   del formulario y se retira al guardar o abandonar la sección.
3. Probar conexión mediante una solicitud mínima al proveedor. La prueba usa la
   sesión administradora, no guarda la clave y devuelve un comprobante temporal
   ligado a usuario, clave/modelo y revisión vigente.
4. Guardar configuración solo después de esa prueba. El servidor vuelve a
   comprobar permisos, comprobante y revisión, cifra la clave y conserva modelo
   y autor/fecha. Un conflicto conserva el formulario y permite actualizar el
   estado antes de volver a probar.
5. Recargar y comprobar estado enmascarado. La captura con IA utiliza esta
   configuración guardada en las siguientes peticiones sin publicar otra versión.

## Persistencia y permisos

El Worker usa R2 con un objeto exclusivo de configuración y cifrado autenticado
AES-256-GCM. Deriva claves separadas por propósito mediante HKDF desde un secreto
estable del servidor; nunca guarda la clave API en texto plano ni la incluye en
logs, Git, builds, mensajes de error o almacenamiento del navegador.

Auth y el perfil de Supabase se comprueban antes de consultar configuración o
consumir proveedor. Las rutas son `/api/ai-settings` (GET/PUT) y
`/api/ai-settings/test` (POST), con límites de cuerpo/frecuencia y timeout. La
escritura condicional de R2 impide sobrescribir una revisión concurrente. El
registro del túnel conserva su objeto separado y no cambia con este formulario.

La configuración por entorno queda como compatibilidad cuando no hay registro
guardado. Un registro cifrado ilegible falla de forma explícita, sin usar
silenciosamente otra clave. La recuperación y custodia del secreto raíz se
documentan en [OPERATIONS](../OPERATIONS.md).

## Errores y accesibilidad

Carga, prueba, guardado y errores tienen estados separados. Bloquear doble envío;
conservar lo escrito ante fallos, sin presentar un guardado como exitoso hasta
que R2 lo confirme. Actualizar estado invalida la prueba y permite recuperar una
revisión vigente sin reenviar un guardado incierto.

Reutilizar Card, Field, Input password, Button, Badge y Alert de shadcn. Etiquetas
asociadas, foco visible y objetivos de 44 px; comprobar escritorio, 375 px,
teclado básico, lector y descarte de la captura. No introducir un formulario de
clave disponible para usuarios de consulta ni mostrar el secreto en capturas.

## Evidencia

136 pruebas completas, tipos, build y check documental aprobados. Las pruebas
del servicio cubren permisos, cifrado, comprobante, expiración, concurrencia,
errores y uso de la configuración guardada en captura. El adaptador comprueba
respuestas saneadas y separación entre probar y guardar.

QA de navegador: administrador demo con controles deshabilitados, lector y
sesión sin autenticar sin sección, escritorio y 375 px sin desbordamiento. Un
formulario aislado con el mismo componente/adaptador/servicio y Auth/proveedor/R2
en memoria comprobó prueba, invalidación al editar modelo, guardado cifrado,
recarga con clave vacía/terminación enmascarada y cambio de modelo conservando
clave. Revisión independiente sin hallazgos pendientes.

No se crearon claves ni se enviaron peticiones a OpenAI durante QA. El
Propietario confirmó el 2026-11-01 el cierre de RCF-014; la activación dejó de
figurar como pendiente. La evidencia anterior describe las pruebas de esa entrega.
Resultado de publicación en [OPERATIONS](../OPERATIONS.md#configuración-de-ia-en-el-servidor).
