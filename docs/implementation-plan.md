# Primera entrega: catálogos y proyectos de siembra

Fecha: 2026-10-31. Estado: primera entrega publicada y operación local verificada;
publicación privada de la revisión operativa confirmada.
Fuente: [PRODUCT](PRODUCT.md). El Propietario autorizó «Adelante», el uso de
subagentes, la preparación de `.gitignore`, commit/push y publicación en ChatGPT
Sites. La entrega implementa catálogos y proyectos de siembra; el módulo de
aplicaciones permanece fuera de esta primera entrega. Su regla de diferencias
entre indicación y realización ya fue confirmada en [PRODUCT](PRODUCT.md#decisión-sobre-indicación-y-realización).

## Resultado observable

Una interfaz React permite recorrer catálogos con Ver/Editar conforme a permisos,
administrar una temporada por agrícola y mantener sus lotes, subdivisiones y
siembras sucesivas sin alterar el historial. La aplicación utiliza un adaptador
de Supabase Auth/Data API/RPC para el entorno configurado. Una demostración con
datos ficticios incluida para la revisión publicada se identifica como tal
y conserva sus datos únicamente en ese navegador.

## Responsabilidades

| Responsable | Archivos y entrega |
| --- | --- |
| Agente principal | Scaffold, UI compartida, shell, autenticación/adaptadores, integración, verificaciones, Git y Sites. |
| Subagente de backend | Migraciones, contratos RPC/RLS, pruebas de fronteras y guía de Supabase. |
| Subagente de interfaz | Pantallas de catálogos y proyectos sobre contratos y controles compartidos. |
| Subagente de diseño/revisión | Fichas de flujo previas, criterios UX y revisión independiente del resultado. |

Cada archivo tiene un responsable de escritura. Las revisiones regresan al autor
para corregir; no se atribuye conformidad a una delegación sin inspeccionar su
resultado integrado.

## Secuencia y criterios de aceptación

1. Registrar fichas de [catálogos](flows/catalogs.md),
   [proyectos](flows/sowing-projects.md) y [navegación](flows/navigation.md).
   Preparar contratos de datos y separar presentación, coordinación y persistencia.
2. Instalar React y controles shadcn aplicables; definir tema local de lectura
   clara, navegación compartida y estados accesibles. No copiar marca o datos de
   mdron.
3. Implementar catálogos con búsqueda al escribir, filtros, páginas, Ver, Editar,
   captura propia, baja lógica y eliminación protegida de registros sin uso.
4. Implementar temporada por agrícola, lotes propios, subdivisión única por defecto,
   planeación/realización/cierre de siembras, copia de distribución e historial.
5. Probar guardado y recuperación, relaciones y superficies, secuencia de etapas,
   bloqueo de temporada siguiente y acceso del lector solo a agrícolas asignadas.
6. Revisar tipos/build/estándares y el recorrido en navegador a 375/1440 px,
   teclado y texto 200 %. Registrar límites de la evidencia de Supabase real.
7. Revisar secretos/artefactos excluidos, confirmar el árbol validado y subirlo a
   `Luiseaf12/rcfito`. Preparar versión del mismo código para ChatGPT Sites y
   verificar el resultado nativo de publicación. Conservar la audiencia privada
   predeterminada del Site.

## Integración local y publicación

Supabase permanecerá en el equipo del Propietario según la arquitectura elegida.
Publicar el frontend en Sites no hace accesible por sí mismo un endpoint local.
La entrega debe distinguir entre demostración ficticia y conexión configurada;
no anunciar persistencia remota, autenticación ni RLS verificados si falta el
endpoint de Supabase accesible y la prueba correspondiente.

La ampliación autorizada inicia ahora Supabase real en este equipo y el frontend
Docker en `http://127.0.0.1:5180`. La conexión local usa JSON público en ejecución
y proxy `/supabase`; no requiere dominio. La primera cuenta se habilita mediante
un asistente loopback temporal donde el Propietario elige la contraseña. La
migración está aplicada; primera cuenta, login administrador y guardado/relectura
tras recargar están comprobados con confirmación SQL. El asistente quedó detenido.
Otros dispositivos siguen pendientes del
endpoint HTTPS exterior; Sites contra loopback en el mismo equipo no se probó.

No se utilizará D1 ni otra base como sustitución del backend elegido. Las claves
privilegiadas solo se usan en servidor; nunca entran al bundle, capturas, fuente
publicada o Git. El `.gitignore` protege `.env`, archivos locales, dependencias,
builds y respaldos, manteniendo únicamente ejemplos ficticios de configuración.

## Riesgos y recuperación

- Una copia de temporada crea identidades nuevas de lotes/subdivisiones y no
  copia siembras ni conteos. Si falla, la operación no deja una temporada parcial.
- Después de confirmar un guardado, una relectura fallida ofrece actualizar;
  no repite una creación ya persistida.
- Etapas cerradas y configuración usada conservan sus datos históricos. Cambiar
  un catálogo o una temporada nueva no debe modificar la vista anterior.
- La publicación conserva versiones. Recuperar una versión anterior del frontend
  no revierte por sí mismo datos ni migraciones de la base.

## Evidencia de cierre

| Control | Estado |
| --- | --- |
| Fichas y criterios previos | Redactados antes de implementar; mapa real de componentes y alcance registrados. |
| Tipos y build de React | `npm run typecheck` y `npm run build` aprobados. |
| Build Docker y dependencias | Imagen `rcfito-web:0.1.0` construida con bases fijadas por digest. Audit producción: 0; tooling: 6 alertas pendientes de revisión. |
| Integridad y enlaces documentales | `npm run docs:check` aprobado; repetir ante cambios documentales finales. |
| Pruebas de dominio | `npm test`: 15/15 aprobadas el 2026-10-31. |
| RLS, transacciones y migraciones en Supabase aislado | 48 comprobaciones SQL y 12 Auth/REST/Edge/RLS aprobadas; stack de QA detenido y datos retirados. No acredita operación. |
| Navegador demo | A 1440 px: alta/búsqueda/detalle/descarte de catálogo, temporada duplicada, lote de 5 ha/default, planeación y siembra real; lector limitado. A 375 px: sin overflow general y buscador ajustado. |
| Teclado, texto 200 % y contraste | Escape cierra menú móvil; resto de teclado completo, zoom 200 % y contraste medido pendientes. |
| Revisión independiente de seguridad y flujo | Código revisado y defectos comunicados/corregidos; permisos/transacciones además probados en backend aislado. En operación se verifican rechazos sin sesión, login administrador y una captura persistente con confirmación SQL. |
| Commit/push y versión desplegada en Sites | Commit `86711d964da6d943e5553a755e2253aa72b787c4` subido a GitHub; despliegue privado exitoso y abierto en navegador. [Registro](OPERATIONS.md#primera-publicación-confirmada). |
| Ampliación: arranque real local | Siete servicios y frontend en 5180 sanos; una migración aplicada/cero pendientes, Auth 200 y rechazos 401/404. `npm test`: 17/17; helper inicial: 18 casos simulados y 15 de regresión. Propietario completó cuenta y confirmó acceso; guardado/recarga/SQL corroboran persistencia sin fixtures. Asistente detenido; HTTPS exterior pendiente. |
| Publicación de revisión operativa | Código operativo subido a GitHub y publicación privada confirmada con resultado nativo `succeeded`. [Registro](OPERATIONS.md#publicación-de-la-revisión-operativa). |

Los resultados se completan solo después de ejecutar el control. El índice de
pendientes del proyecto permanece en [PLANS](PLANS.md).

## Ampliación: aplicaciones y grupos

Fecha: 2026-10-31. Estado: diseño previo e implementación verificados por capas;
frontend Docker comprobado y publicación de Sites confirmada.
Autoridad: el Propietario solicitó implementar la captura con subagentes y
aclaró que cambiar productos, dosis o agua será excepcional. Contrato de producto
en [PRODUCT](PRODUCT.md#aplicaciones-alcance-confirmado); recorrido y matriz en
la [ficha previa](flows/applications.md).

Resultado: indicar una mezcla común para destinos completos del mismo proyecto
activo/campo/cultivo; realizar o cancelar cada destino por separado; consultar
indicación histórica frente a valores reales y conteos por etapa. El caso
habitual confirma lo indicado. Una casilla inicialmente apagada habilita la
copia editable de productos/dosis/agua reales. Grupos manuales reutilizables
conservan etapas cerradas en historial y las excluyen de nuevas órdenes.

Quedan fuera el reporte completo con agrupaciones, finanzas, inventario y cálculo
de totales de agua/productos. Las modificaciones ajenas de infraestructura,
Quick Tunnel y proxy se preservan; ninguna prueba carga fixtures en operación.

| Frente | Responsable y criterio de aceptación |
| --- | --- |
| Modelo y coordinación | Agente principal: DTO, reglas, adaptador y cierre integrado; indicación inmutable, realización propia por destino, conteos y transición terminal sin duplicados. |
| Backend | Subagente backend: nueva migración/RPC/RLS y pruebas SQL/HTTP aisladas; destinos válidos, grupos históricos, cierre bloqueado por pendientes, snapshots y operaciones atómicas. |
| Presentación | Subagente interfaz: rutas de aplicaciones y grupos-siembra sobre shell/componentes existentes; caso habitual corto y excepción explícita, comparación, estados/errores/móvil. |
| Documentación y revisión | Subagente revisión: ficha previa y fuentes coherentes; revisar diferencias de contrato, permisos, historial, errores y accesibilidad, reportando defectos al autor. |

Secuencia: acordar contrato del modelo/API, integrar dominio y persistencia,
componer los recorridos de la ficha, revisar reglas/roles y probar el resultado
integrado. Identificar por separado pruebas puras, backend aislado y navegador;
ninguna acredita automáticamente las otras capas. Conservar la instalación real
y secretos sin modificarlos como efecto de QA.

| Evidencia de la ampliación | Estado |
| --- | --- |
| Ficha previa y aclaración de excepcionalidad | Redactadas; [criterios](flows/applications.md#invariantes-y-criterios-observables). |
| Dominio y adaptador: destinos, copia habitual, excepción, conteos y cierres | 54/54 pruebas puras totales, incluidas 20/20 en [applications.test.ts](../test/applications.test.ts): snapshots, reintentos tras inactivar producto agregado, grupos/historial y lector. Adaptador implementado; navegador de operación consultó la lista real vacía con sesión administradora, sin insertar datos. |
| SQL/HTTP/RLS: anónimo, lector, agrícolas ajenas, atomicidad e historial | 116 SQL (48 regresión + 68 nuevas) y 40 HTTP reales (12 previas + 28 de aplicaciones) aprobadas en entornos aislados, después retirados. Revisión independiente y hallazgos corregidos. |
| UI: orden, realización habitual/excepcional, comparación, cancelación y grupos | Demo en 5174: indicación de un destino, realización normal, excepción de producto A a 1 ml/ha frente a B a 2 g/ha y agua de 1 a 2 L/ha; ambas mezclas conservadas, grupo creado/reutilizado y cancelación con rechazo de motivo vacío comprobados. Lector demo a 375 px sin Nueva indicación comprobado. |
| Recuperación: doble envío, fallo de relectura, concurrencia y borrador | Pendiente. |
| Escritorio/móvil, teclado, foco y texto 200 % | Recorridos demo de escritorio y ancho 375 px sin desbordamiento general aprobados. Teclado/foco/200 % completos pendientes. |
| Tipos/build/estándares y revisión independiente | Typecheck y revisión de código aprobados; dosis hasta seis decimales, selector de 44 px y grupos cerrados sin Editar corregidos. Build/tipos/docs aprobados en checkout aislado y frontend Docker sano; Sites versión 8 confirmado y nueve checks HTTPS posteriores aprobados. |
| Esquema de operación | Respaldo privado PostgreSQL previo, migración aditiva aplicada: dos aplicadas/cero pendientes, sin fixtures en operación. No acredita frontend actualizado. |
| Commit/push/publicación de esta ampliación | Commit `03b661b1bfaafd2031fe7c3de4e46324cae22d67` subido; workflow aprobado y Sites versión 8 con `succeeded`, audiencia pública/R2 conservados. [Registro](OPERATIONS.md#despliegue-de-aplicaciones-y-grupos). |

Actualizar estos estados solo con evidencia ejecutada. El cierre de la primera
entrega no acredita esta ampliación ni el reporte completo de RCF-011.
