# Estándar compartido de rcfito

Versión adoptada: **4.3.0**. Fecha: 2026-10-31.

Autoridad para esta adopción: solicitud del Propietario «aplica los estandares de
los proyectos a este proyecto». Se aplica la base compartida a rcfito, incluidos
los contratos de UI cuando se implementen los recorridos correspondientes.

## Fuente y alcance

Fuente: bundle del checkout hermano `estandares-proyectos`, cuyo remoto es
[Luiseaf12/estandares-proyectos](https://github.com/Luiseaf12/estandares-proyectos).
La versión local 4.3.0 incluye cambios aún sin commit sobre la revisión base
`8be059d` (4.2.0); esta adopción conserva sus archivos y manifiesto íntegros, sin
atribuir su publicación al remoto.

El bundle se conserva en `.project-standards/`, junto con la skill de revisión y
el workflow gestionados. [standards.config.json](../standards.config.json) fija
la identidad, versión, entradas, enlaces comprobados y excepciones locales.
Los checks funcionan sin el checkout central.

El proyecto estaba vacío antes de esta adopción, que incorporó gobernanza y
documentación. Los requisitos actuales se mantienen en [PRODUCT](PRODUCT.md)
y el estado de implementación en [ARCHITECTURE](../ARCHITECTURE.md).
Las referencias React del bundle son ejemplos, no una aplicación instalada.

## Fuentes normativas

| Tema | Fuente compartida | Complemento local |
| --- | --- | --- |
| Autoridad y evolución | [CORE](../.project-standards/CORE.md) | Este documento. |
| Documentación y pendientes | [DOCUMENTATION](../.project-standards/DOCUMENTATION.md) | [PLANS](PLANS.md). |
| Implementación y roles de agentes | [ENGINEERING](../.project-standards/ENGINEERING.md) | [ARCHITECTURE](../ARCHITECTURE.md). |
| Interfaz y MoneyInput | [FRONTEND](../.project-standards/FRONTEND.md) | [FRONTEND local](FRONTEND.md). |
| Catálogos | [CATALOGS](../.project-standards/CATALOGS.md) | [PRODUCT](PRODUCT.md). |
| Navegación y secciones colapsables | [NAVIGATION](../.project-standards/NAVIGATION.md) y [acabado visual](../.project-standards/NAVIGATION-VISUAL.md) | [FRONTEND local](FRONTEND.md). |
| Reportes históricos | [HISTORICAL-REPORTS](../.project-standards/HISTORICAL-REPORTS.md) | [PRODUCT](PRODUCT.md). |

Las menciones a Vales, Apoyosing y FI en el bundle describen los consumidores de
origen. La solicitud actual extiende su aplicación a rcfito; sus reglas de negocio
y marcas siguen siendo propias de cada producto. No hay excepciones locales
registradas. Una diferencia futura se documenta conforme a CORE, con motivo,
alcance, responsable, acción y fecha de revisión.

## Mapa documental

| Tema | Entrada |
| --- | --- |
| Guía operativa | [AGENTS.md](../AGENTS.md) |
| Propósito y comandos | [README.md](../README.md) |
| Arquitectura | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Producto | [PRODUCT.md](PRODUCT.md) |
| Interfaz | [FRONTEND.md](FRONTEND.md) |
| Seguridad | [SECURITY.md](SECURITY.md) |
| Verificación | [TESTING.md](TESTING.md) |
| Operación | [OPERATIONS.md](OPERATIONS.md) |
| Pendientes | [PLANS.md](PLANS.md) |

## Evidencia de adopción

Revisión local del 2026-10-31: controles con Node.js 24.19.0 y npm 11.17.0.

- `npm run standards:check`: estructura, integridad, mapa y enlaces válidos;
  cero excepciones locales.
- `npm run docs:check`: válido sobre las diez entradas documentales.
- Contraste SHA-256 de los 35 archivos gestionados y comparación del
  manifiesto con el bundle central local: coincidentes.
- `npm test` en la fuente central: ocho pruebas del checker y sync aprobadas.
- Revisión semántica: se distinguen las normas adoptadas de las decisiones de
  producto y stack pendientes; no hay interfaz ni negocio que acreditar.

El checker no certifica UI, permisos ni cálculos. El workflow queda preparado
localmente; ejecución remota y protección de rama no están verificadas.
rcfito todavía no figura en `projects.json` de la fuente central; su auditoría
registrada cubre los consumidores originales. `npm run audit -- --json` no detectó
problemas de integridad en la fuente, pero reportó versiones anteriores en Vales
(4.2.0), Apoyosing (4.1.0) y FI (4.1.0). Esos proyectos no se modificaron en esta
entrega. El contraste directo anterior verifica rcfito sin modificar ese registro.

## Actualización

No editar los archivos gestionados ni regenerar su manifiesto local para
acomodar preferencias del proyecto. Revisar primero la nueva versión central y
las diferencias locales; después, desde el checkout central:

```sh
npm run sync -- --root ../rcfito
```

El sync conserva la documentación local y rechaza modificaciones del bundle.
Actualizar la versión visible y evidencia de este documento, revisar el diff y
ejecutar ambos controles de [TESTING](TESTING.md). Conservar los cambios ajenos
y una revisión recuperable. Los cambios del estándar se proponen en la fuente
central; el destino de publicación sigue [OPERATIONS](OPERATIONS.md).
