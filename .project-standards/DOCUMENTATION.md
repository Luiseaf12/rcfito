# Documentación común

## Mapa

Todos los proyectos exponen estas entradas. Pueden enlazar una fuente existente
en lugar de duplicar contenido o mover especificaciones con referencias vivas.

| Entrada | Responsabilidad |
| --- | --- |
| `AGENTS.md` | Mapa operativo breve; comandos, invariantes y lectura por tarea. |
| `README.md` | Propósito, stack, requisitos, configuración y comandos vigentes. |
| `ARCHITECTURE.md` | Módulos, dirección de dependencias y fronteras de confianza. |
| `docs/PRODUCT.md` | Vocabulario, flujos, reglas y enlaces a requisitos. |
| `docs/FRONTEND.md` | Tokens, componentes, composición y verificación visual. |
| `docs/SECURITY.md` | Autenticación, autorización, secretos y entornos de prueba. |
| `docs/TESTING.md` | Comandos, alcance de pruebas y límites de evidencia. |
| `docs/OPERATIONS.md` | Entornos, ejecución, publicación y recuperación. |
| `docs/PLANS.md` | Planes, decisiones y deuda con siguiente acción. |
| `docs/STANDARDS.md` | Versión adoptada, mapa a fuentes y diferencias locales. |

## Escritura y mantenimiento

- Español claro para documentación y producto; identificadores según el stack.
- Una fuente normativa por tema. Índices y resúmenes enlazan esa fuente.
- Enlaces relativos dentro del repositorio; no rutas personales como contrato.
- Cada norma expresa cuándo aplica y cómo comprobarla. Diferenciar obligación,
  recomendación, comportamiento observado y propuesta pendiente.
- Una afirmación de cumplimiento incluye comando/evidencia y límites. No marcar
  como verificado lo que solo está documentado.
- Actualizar documentación junto con comandos, rutas, entornos, permisos, reglas
  o responsabilidades. Historial cerrado va al registro/plan, no al mapa activo.
- Leer únicamente los temas afectados; `AGENTS.md` apunta al detalle.

Objetivo para `AGENTS.md`: máximo 120 líneas, sin cronología extensa. Una guía
heredada más larga requiere excepción temporal con una acción para compactarla.
No eliminar invariantes al acortarla: trasladar detalle y exigir su lectura en
las tareas correspondientes.

## Flujos de usuario

Antes de implementar un flujo importante nuevo o cambiar su comportamiento,
registrar una ficha breve en `docs/PRODUCT.md` o en su fuente local enlazada,
usando [templates/flow.md](templates/flow.md). Conservar requisitos y aprobaciones
locales; actualizar la ficha cuando cambie el recorrido.

Describir usuario/objetivo, entrada y precondiciones, recorrido, alternativas,
recuperación, éxito observable y evidencia. Procurar un camino principal de tres
a cinco pasos, sin convertir esa orientación en un límite. Cada paso aporta
información, una decisión o una confirmación necesaria. Reutilizar la documentación
existente y aplicar la ficha al flujo intervenido, sin inventariar toda la UI.

Revisar la ficha manualmente: recorrer el camino principal, un error con
recuperación y los permisos relevantes, con los controles de `FRONTEND.md`.
Registrar ruta, pasos y resultado; mientras falte verificación, indicar
«pendiente». El checker comprueba estructura e integridad; la ficha y su evidencia
se revisan en la entrega.

Catálogos nuevos o intervenidos completan ese recorrido con la ficha de
[templates/catalog.md](templates/catalog.md), bajo [CATALOGS.md](CATALOGS.md).
Puede formar parte de la ficha de flujo existente; enlazar reglas locales y
evidencia para evitar fuentes contradictorias.

Reportes de tipo Histórico nuevos o intervenidos declaran su métrica, cálculo,
periodo, filtros y evidencia con [templates/historical-report.md](templates/historical-report.md),
bajo [HISTORICAL-REPORTS.md](HISTORICAL-REPORTS.md). Puede completar la ficha de
flujo y enlazar los contratos de producto existentes.

## Planes, decisiones y deuda

`docs/PLANS.md` es la entrada breve a los pendientes vigentes de cada proyecto.
Mantener fecha de revisión y una tabla con estas seis columnas:

| ID | Trabajo | Estado | Responsable | Próxima acción | Fuente |
| --- | --- | --- | --- | --- | --- |

Una fila representa una unidad de trabajo importante. Conservar IDs locales;
si la fuente no tiene ID, usar su clave o nombre estable, sin renumerar historia.
El detalle permanece en el plan, especificación, tasks, registro de deuda o
preguntas existente. Para una tarea pequeña puede ser una sección del mismo
PLANS. El índice enlaza esa fuente y resume su estado; no replica sus pasos.

Estados comunes: **propuesta** (por evaluar), **pendiente** (sin iniciar),
**en curso**, **bloqueada** (requiere una dependencia o decisión),
**en verificación** y **cerrada**. Adaptar etiquetas locales con equivalencia
explícita cuando corresponda. Registrar una tarea o cambiar su estado no autoriza
implementarla: alcance y aprobaciones permanecen en su fuente y protocolo local.
Indicar «Por asignar» cuando no haya responsable comprobado. Una tarea bloqueada
identifica qué falta y la acción de salida; la próxima acción no concede permisos.

Actualizar fuente y resumen en la misma entrega cuando cambie el estado. Cerrar
solo con evidencia enlazada y distinguir implementación local, instalación y
publicación según el alcance. Una tarea sustituida conserva ID, motivo y enlace
al reemplazo, sin marcarla ejecutada. Los cierres y decisiones históricas conservan
su fuente; el índice deja una referencia breve cuando sea útil.

Revisar manualmente concordancia de estado, próxima acción, autorización y
evidencia al cerrar la entrega. El checker estructural no certifica esa concordancia.

Cambio pequeño: alcance y verificación en la entrega. Trabajo de varios dominios,
migración delicada o varias sesiones: plan versionado con resultado deseado,
criterios observables, decisiones, riesgos/recuperación y evidencia. Puede usar
la estructura local existente de `specs/` o `docs/exec-plans/`.

Una decisión registra fecha, autoridad, contexto, alternativa elegida, motivo,
alcance y decisión reemplazada. Una deuda registra evidencia, impacto,
responsable, próxima acción y estado. Una excepción registra además regla
afectada y fecha de revisión; esa fecha no autoriza una migración automática.

Plantillas reutilizables: `templates/plan.md`, `templates/decision.md` y
`templates/exception.md`, además de la ficha `templates/flow.md`, en esta carpeta.
Completarlas solo cuando correspondan;
no generar documentos vacíos para cada tarea sencilla.
