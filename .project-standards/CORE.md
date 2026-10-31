# Estándar compartido — 4.3.0

Ámbito: Vales, Apoyosing y FI. Autorización: Propietario, 2026-10-11.
Metodología de flujos 1.1.0 aprobada mediante «adelante» el 2026-10-11.
Captura monetaria reutilizable 1.2.0 aprobada mediante «adelante» el 2026-10-11.
Nombre obligatorio `MoneyInput` para todo campo de moneda, solicitado por el
Propietario el 2026-10-11; reemplaza los nombres alternativos de 1.2.0.
Contrato de catálogos por composición 2.1.0 autorizado mediante «adelante» el
2026-10-12: nuevos/intervenidos, adaptadores locales y referencia reutilizable.
Modal y portales de catálogos 2.2.0 aprobados por el Propietario el 2026-10-12
tras aceptar el piloto publicado de Sucursales y pedir incorporarlo al estándar.
Índices comunes de pendientes 2.3.0 autorizados mediante «adelante» el 2026-10-13;
conservan las fuentes, IDs y aprobaciones locales.
Búsqueda de catálogos 2.4.0 solicitada mediante «haz que el estandar de catalogos
lo incorpore asi» el 2026-10-14: lupa, filtrado al escribir, sugerencias opcionales
y captura intacta; normalización exclusiva de comparación/consulta.
Controles de catálogos y acciones Ver/Editar obligatorios en 3.0.0 por solicitud
del Propietario del 2026-10-14: «haz que el estandar obligue usar los controles
definidos en el estandar y asegurate de que tengan opcion editar y ver».
Aplican a catálogos nuevos/intervenidos, con los permisos y contratos locales.
Roles y colaboración de agentes 3.1.0 solicitados por el Propietario el 2026-10-14,
con prácticas de OpenAI adaptadas al alcance, permisos y evidencia del proyecto.
Menús y navegación reutilizables 3.2.0 solicitados por el Propietario el
2026-10-14 a partir de la revisión de Apoyosing: organización, mapa de destinos,
orientación, permisos locales, móvil accesible y ficha de evidencia.
Controles shadcn y composiciones reutilizables de navegación obligatorios en
4.0.0, por solicitud del Propietario del 2026-10-14; aplican según función en
navegación nueva/intervenida, con mapa de imports, estado único y evidencia.
Secciones colapsables 4.1.0 autorizadas mediante «adelante» el 2026-10-15:
NavigationSection compartido con Collapsible/Trigger/Content, apertura por grupo,
ruta y preferencia; aplicación posterior desde cada proyecto por decisión del
Propietario. Esta entrega se limita al estándar y su commit central.
Acabado visual del menú 4.2.0 solicitado el 2026-10-15: receta de jerarquía,
espacios, alineación, estados y estilos compartidos sobre los controles existentes;
valores iniciales adaptables a la marca local. Sin aplicación a consumidores.
Reporte histórico 4.3.0 autorizado mediante «Adelante documéntalo» el 2026-10-16:
los doce meses en renglones y los años en columnas, con métrica y filtros locales.
Se documenta en la fuente central; adopción y verificación por proyecto pendientes.

## Uso y autoridad

Leer este archivo al comenzar trabajo en uno de los tres proyectos. Para cambios
documentales consultar `DOCUMENTATION.md`; para interfaz `FRONTEND.md`; para
implementación, pruebas o publicación `ENGINEERING.md`, en esta misma carpeta.
Para menús/navegación consultar `NAVIGATION.md` desde `FRONTEND.md`.
Para reportes de tipo Histórico consultar `HISTORICAL-REPORTS.md`.
El mapa y las particularidades están en `../docs/STANDARDS.md`.

Las instrucciones explícitas del Propietario gobiernan el alcance. Esta base
define el mínimo común; las decisiones y contratos del producto gobiernan su
negocio. Una diferencia técnica justificada se registra en `standards.config.json`
y en el complemento local, con motivo, alcance, responsable y fecha de revisión.
Una contradicción real se explica con sus dos fuentes antes de implementar la
parte afectada. No convertir silencio, código heredado o una auditoría en una
aprobación de reglas financieras, servicios o publicación.

## Evolución

La fuente central es `estandares-proyectos`, repositorio hermano de los tres.
Cada checkout conserva una copia fijada por versión y manifiesto SHA-256; no
depende de rutas absolutas ni de tener el repositorio central para sus checks.
No editar la copia compartida para añadir preferencias locales. Proponer cambios
en la fuente central, registrar motivo/impacto y distribuir una nueva versión.
Patch corrige sin cambiar obligaciones; minor añade criterios compatibles;
major cambia obligaciones o requiere migración. La actualización se valida en
los tres proyectos y deja evidencia antes de adoptarse.

## Revisión

Ejecutar `npm run standards:check` al cambiar normas/documentación y antes de
cerrar una entrega. El control verifica estructura, entradas documentales,
integridad, scripts y excepciones. La auditoría central compara además con la
fuente original. Ninguno certifica reglas de negocio o apariencia visual.

La revisión semanal compara con los hallazgos anteriores: contradicciones,
normas nuevas sin justificación, copias divergentes y deuda vencida. Informar
archivo, regla, evidencia, impacto y propuesta; evitar repetir hallazgos iguales.
Corregir enlaces y errores mecánicos dentro del alcance autorizado. Cambios de
política, arquitectura o producto se proponen con evidencia; no modificar reglas
ni publicar aplicaciones como efecto de una revisión.
