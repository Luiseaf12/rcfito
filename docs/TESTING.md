# Verificación y evidencia

## Comandos

Node.js 24 y npm. Ejecutar `npm ci` antes de checks de aplicación.

| Comando | Alcance |
| --- | --- |
| `npm test` | Reglas puras: permisos demo, relaciones, historial y transiciones. |
| `npm run typecheck` | Tipos de la aplicación TypeScript. |
| `npm run build` | Tipos y build Vite de producción a `dist/`. |
| `npm run docs:check` | Versión, hashes, mapa, enlaces de entradas y excepciones del estándar. |
| `node scripts/backend-test.mjs` | SQL, RLS y transacciones en PostgreSQL efímero, sin puertos. |
| `node scripts/backend-integration.mjs --fresh --cleanup` | Auth, REST, RPC, Edge y RLS reales en stack Supabase aislado. |

Los scripts backend requieren Docker. Solo usan su proyecto/carpeta de QA y
fixtures ficticios; nunca leen el `.env` de la raíz. `--fresh` recrea el entorno
exclusivo de prueba y `--cleanup` lo detiene y retira sus datos. Detalles en
[backend-deployment](backend-deployment.md#pruebas-reproducibles).

## Evidencia de primera entrega: 2026-10-31

| Control | Resultado y límite |
| --- | --- |
| Dominio | 15/15 en [domain.test.ts](../test/domain.test.ts). Reglas puras con fixtures; no acredita servidor. |
| Tipos/build | `npm run typecheck` y `npm run build` aprobados por el agente principal. |
| SQL | 48 comprobaciones aprobadas: áreas, secuencia, copia, histórico, permisos y atomicidad. |
| HTTP real | 12 comprobaciones Auth/REST/Edge/RLS aprobadas con cuentas ficticias. |
| Aislamiento | Integración final detenida y sus datos ficticios retirados; contenedores ajenos conservados. |
| Compose | Composición Supabase validada con `docker compose config --quiet` y configuración ficticia; no inició operación. |
| Imagen frontend | `docker build -t rcfito-web:0.1.0 .` aprobado; imágenes base fijadas por digest. No acredita publicación ni ejecución de operación. |
| Dependencias | `npm audit --omit=dev`: cero vulnerabilidades. Auditoría total: 6 de tooling (2 bajas y 4 moderadas), pendientes de revisión; no se aplicó actualización forzada. |

## Navegador de demostración

Casos ejecutados por el agente principal a 1440 px en el frontend local:

- Crear «Cultivo de verificación», buscar `verificacion` sin depender de acentos,
  consultar Ver y abrir confirmación de descarte de un borrador modificado.
- Rechazar una temporada duplicada conservando la captura.
- Crear lote de 5 ha con subdivisión automática de superficie completa.
- Planear etapa 1 con cultivo, variedad y fecha; activar proyecto y registrar
  su siembra real.
- Simular lector de Ensenada: Culiacán fuera de su ámbito y sin controles de
  escritura.
- A 375 px, comprobar ausencia de desbordamiento horizontal general y ajustar
  el buscador para ese ancho.
- Cerrar el menú móvil con Escape.

Se corrigió el foco inicial de Ver para iniciar en el título del detalle. La
revisión completa de teclado, texto/zoom 200 %, altura reducida y contraste
medido sigue pendiente hasta registrar la evidencia final. Fichas detalladas:
[catálogos](flows/catalogs.md), [proyectos](flows/sowing-projects.md) y
[navegación](flows/navigation.md).

## Límites de cobertura

El navegador probó la demostración. El backend HTTP se probó en un entorno
independiente; no se acredita navegador → instalación de operación → respuesta.
No hay endpoint HTTPS de operación configurado. La publicación Sites requiere
su resultado nativo antes de declararla exitosa; tener identidad de Site no
equivale a despliegue.

El checker documental comprueba destinos locales, no anchors ni URLs externas.
No certifica UX, RLS ni cálculos. Las referencias TS/TSX del bundle del estándar
no forman parte del código compilado de la aplicación.
