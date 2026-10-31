# Proyectos de siembra: temporada, distribución y etapas

Fuente normativa local: [PRODUCT](../PRODUCT.md#temporadas-subdivisiones-y-etapas).
Estado: implementación y reglas verificadas; matriz de navegador en curso.

## Usuario y objetivo

El administrador prepara y mantiene el proyecto de temporada de una agrícola.
El usuario normal consulta únicamente las agrícolas asignadas. La interfaz
debe dejar visibles agrícola, temporada y estado para evitar operar el ciclo
equivocado. Las consultas históricas conservan la distribución de su temporada.

## Recorrido principal

1. Seleccionar agrícola autorizada y crear su proyecto de temporada cuando no
   exista otra temporada activa para esa agrícola. También se puede copiar la
   distribución de una temporada anterior cerrada como punto de partida.
2. Incorporar lotes del campo de esa agrícola, con superficie e infraestructura.
   Al guardar un lote se genera una subdivisión que abarca toda su superficie.
   Agregar más subdivisiones es una acción explícita para el caso especial.
3. Seleccionar subdivisión y planear su siembra: cultivo, variedad, superficie,
   fecha planeada y observaciones aplicables. Puede planearse la siguiente etapa
   de esa subdivisión mientras la anterior sigue activa, dentro de la misma
   temporada.
4. Registrar fecha real de siembra e iniciar la etapa correspondiente cuando la
   anterior ya terminó. Al finalizarla, cerrar el proceso de ese lote/subdivisión
   y conservar su historia; continuar con otra siembra incrementa el número.
5. Cerrar la temporada cuando sus procesos lo permitan. La siguiente temporada
   crea un proyecto independiente; copiar distribución no arrastra etapas,
   aplicaciones ni conteos.

## Convenciones de implementación

Los nombres técnicos de estados pueden adaptarse al contrato del backend; en
pantalla debe distinguirse proyecto editable/activo de histórico cerrado, y
etapa planeada, sembrada y cerrada. No confundir fecha planeada con fecha real.
Las etapas son siembras sucesivas, no subdivisiones espaciales ni aplicaciones.

El control de cierre de futuras órdenes de aplicación se incorporará cuando
exista ese módulo. Esta primera entrega no debe inventar aplicaciones o conteos
para aparentar su cobertura.

## Invariantes y criterios observables

| Regla | Resultado requerido |
| --- | --- |
| Proyecto y agrícola | Un proyecto pertenece a una sola agrícola; los campos de sus lotes pertenecen a esa agrícola. |
| Temporada activa | Solo una temporada activa/capturable por agrícola. Otra agrícola puede operar la suya simultáneamente. |
| Siguiente temporada | No se cargan datos de la siguiente temporada mientras siga activa la actual de esa agrícola. |
| Distribución por temporada | Los lotes y sus superficies pertenecen al proyecto; se pueden cambiar en la próxima temporada conservando las versiones anteriores. |
| Subdivisión inicial | Crear lote y su subdivisión única de área completa es una operación atómica. |
| Infraestructura | Se asigna al lote completo y aplica a sus subdivisiones. |
| Superficies | Superficies positivas; la suma de las áreas de subdivisiones no excede el lote y cada siembra cabe en su subdivisión. Una parte sin sembrar es permitida y queda señalada de manera visible. |
| Secuencia de etapas | Primera siembra de cada subdivisión en la temporada = etapa 1; siembra posterior = siguiente número, aun repitiendo cultivo/variedad. |
| Planeación anticipada | Se puede planear etapa siguiente con la actual activa, pero no tener dos etapas sembradas simultáneas en una misma subdivisión. |
| Cultivo y variedad | La variedad elegida pertenece al cultivo. Diferentes subdivisiones pueden tener cultivos y fechas diferentes. |
| Configuración usada | Cambios al terminar un proceso crean/conservan la versión necesaria; no reescriben áreas o cultivo de siembras anteriores. |
| Cierre | Los registros cerrados son de consulta; no se destruye su historial. Una modificación futura se hace en la configuración permitida. |
| Copia | Nuevas identidades de proyecto/lotes/subdivisiones, misma distribución base, cero siembras copiadas; si falla, no queda copia parcial. |
| Permisos | Lector puede Ver en su agrícola asignada; no Crear/Editar/Cerrar/Copiar. El backend rechaza mutaciones directas. |

La advertencia de superficie sin sembrar explica el área restante. Es una
advertencia informativa, no un bloqueo de un caso permitido. No sustituir una
fecha real ausente por la fecha del dispositivo ni completar etapas realizadas
como efecto de guardar una planeación.

## Alternativas y recuperación

- Agrícola sin proyecto: explicar el estado y ofrecer creación solo al administrador.
- Faltan catálogos: identificar cuál falta y enlazar su mantenimiento autorizado.
- Registro inválido: conservar captura y señalar los campos involucrados.
- Proyecto o etapa cerrados: detalle legible e identificación de histórico.
- Error de guardado: conservar captura y recuperar según el resultado; tras éxito
  confirmado y fallo de actualización, ofrecer recargar sin duplicar la operación.
- Concurrencia: una segunda creación/activación/cierre que viola el estado vigente
  se rechaza y solicita actualizar; no confiar únicamente en botones deshabilitados.

## Éxito y evidencia

La persistencia devuelve identidad y datos guardados, la vista conserva el
contexto y los cambios permitidos aparecen en la configuración correspondiente.
La demostración local identifica su almacenamiento ficticio; sus pruebas no
acreditan transacciones ni permisos de un servidor Supabase. Las pruebas SQL/HTTP
del backend fueron independientes y usaron otro entorno aislado.

| Caso | Resultado |
| --- | --- |
| Crear proyecto; rechazo de segunda temporada con activa; otra agrícola independiente | Dominio/SQL aprobados. Rechazo de temporada duplicada con captura conservada probado en demo. |
| Lote/subdivisión por defecto atómicos y áreas mostradas | Dominio/SQL aprobados y lote de 5 ha con default completo probado en navegador demo. |
| Dividir excepcionalmente; área excesiva rechazada y parte sin sembrar señalada | Dominio/SQL aprobados; recorrido completo de redistribución en navegador pendiente. |
| Planear etapa siguiente con actual activa; impedir sembrarla hasta cierre | Dominio/SQL aprobados; matriz completa de etapas posteriores en navegador pendiente. |
| Cultivos/variedades y fechas planeada/real diferenciadas | Reglas de dominio/SQL aprobadas. Planeación y registro de siembra etapa 1 probados en demo. |
| Etapa 1 → cierre → etapa 2 y nueva temporada reinicia secuencia | Dominio/SQL aprobados; recorrido completo de cierre/etapa 2 en navegador pendiente. |
| Copiar distribución; identidades nuevas; sin siembras ni copia parcial | Dominio/SQL aprobados; recorrido de copia en navegador pendiente. |
| Cambio en nueva temporada no modifica histórico anterior | Snapshots conservados en dominio/SQL; comparación visual del historial pendiente. |
| Lector y acceso directo de agrícola no asignada | Dominio/RLS/HTTP aprobados por separado y lector demo limitado a Ensenada. Navegador contra operación pendiente. |
| 375/1440 px, texto 200 %, teclado, diálogos y recuperación de errores | 1440/375 px revisados en demo sin overflow general; teclado completo y 200 % pendientes. |

Evidencia ejecutada el 2026-10-31: `npm test`, 15 pruebas correctas en
[test/domain.test.ts](../../test/domain.test.ts). La primera ejecución detectó
temporada duplicada de la misma agrícola; se corrigió y la regresión pasó en la
segunda ejecución. Las pruebas de reglas puras usan datos ficticios; no acreditan
persistencia, Auth, permisos de Supabase ni el comportamiento visual. La evidencia
independiente de 48 comprobaciones SQL y 12 HTTP se registra en
[TESTING](../TESTING.md).
