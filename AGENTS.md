# Guía de trabajo de RCFito

Leer el [Estándar compartido](docs/STANDARDS.md) y
[CORE](.project-standards/CORE.md) al comenzar; consultar después solo el tema
afectado y su complemento local.

## Estado y alcance

Primera entrega implementada: React + TypeScript + Vite 8, shadcn/Radix,
catálogos, usuarios/asignaciones y proyectos de siembra. Hay demostración local
identificada y adaptador real de Supabase Auth/REST/RPC. La instalación de
operación y su endpoint HTTPS están pendientes; publicar Sites no publica la BD.

[PRODUCT](docs/PRODUCT.md) conserva los contratos de negocio. Las aplicaciones
y su reporte no forman parte de esta entrega. No asumir resuelta su aclaración
pendiente sobre indicación/ejecución.

## Lectura por tarea

| Tarea | Fuentes |
| --- | --- |
| Documentación | [DOCUMENTATION](.project-standards/DOCUMENTATION.md) y [mapa local](docs/STANDARDS.md). |
| Implementación | [ENGINEERING](.project-standards/ENGINEERING.md) y [arquitectura](ARCHITECTURE.md). |
| Interfaz | [FRONTEND](docs/FRONTEND.md) y [fichas](docs/implementation-plan.md). |
| Permisos y datos | [SECURITY](docs/SECURITY.md) y [contrato del backend](docs/backend-api.md). |
| Verificación | [TESTING](docs/TESTING.md). |
| Ejecución y publicación | [OPERATIONS](docs/OPERATIONS.md) y [Supabase](docs/backend-deployment.md). |
| Pendientes | [PLANS](docs/PLANS.md). |

## Comandos

Node.js 24 y npm; Docker para pruebas/operación del backend.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run docs:check
```

## Invariantes

- Español claro, una fuente normativa por tema y bundle gestionado intacto.
- Separar presentación, coordinación y adaptador; el frontend no concede permisos.
- Proyectos/lotes/subdivisiones pertenecen a su temporada; conservar snapshots
  usados. Solo una temporada abierta por agrícola y una etapa sembrada por
  subdivisión; se permite planear etapas siguientes.
- Lector solo consulta agrícolas asignadas; RLS y RPC lo comprueban en servidor.
- Secretos y datos reales quedan fuera de Git, builds, capturas y ejemplos.
  No leer, modificar ni sobrescribir el `.env` preexistente del usuario.
- Las pruebas de backend usan su carpeta aislada y nunca alteran otros stacks.
- Distinguir demo, pruebas aisladas y operación. No atribuir seguridad o
  persistencia real a una simulación en localStorage.
- Conservar cambios ajenos y ejecutar checks afectados. Actualizar
  [PLANS](docs/PLANS.md) y su fuente al cambiar de estado.
- Publicar sigue [OPERATIONS](docs/OPERATIONS.md). La solicitud actual autoriza
  commit, push a GitHub y publicación en ChatGPT Sites; no cambia su audiencia.
