---
name: project-standards
description: Revisar o mantener la coherencia documental y de normas entre Vales, Apoyosing y FI, o actualizar su estándar compartido. No sustituye la implementación ordinaria ni aprueba cambios de negocio.
---

# Revisión del estándar compartido

Leer `.project-standards/CORE.md`, `docs/STANDARDS.md` y `standards.config.json`
desde la raíz del proyecto actual. Consultar solo el tema compartido afectado.
Respetar el stack y las decisiones locales enlazadas; distinguir una diferencia
justificada de una contradicción o desviación nueva.

Ejecutar `npm run standards:check`. Para una auditoría de los tres, si está
disponible el checkout hermano `estandares-proyectos`, ejecutar desde él
`npm run audit -- --json`; compara copias originales sin tocar aplicaciones.

Revisar también significado: reglas repetidas/contradictorias, documentación
obsoleta, preferencias convertidas en obligaciones y ausencia de evidencia.
Comparar con el último informe. Para cada hallazgo nuevo: proyecto, archivo,
regla, evidencia, impacto y acción. Un check estructural no certifica UI o negocio.

No editar copias compartidas para acomodar un proyecto. Cambiar la fuente central
con nueva versión y distribuir mediante `npm run sync -- --root <checkout>`
tras revisar impacto y diff. El sync conserva documentación y reglas locales.
Nunca renovar la fecha de una excepción sin registrar su revisión y motivo.

La auditoría no autoriza fórmulas, datos, dependencias, servicios, publicación o
mensajes a otros chats. Un conflicto de política se entrega como propuesta con
fuentes. Conservar cambios ajenos y documentar checks imposibles de ejecutar.
