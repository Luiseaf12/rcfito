# RCFito

Control de siembras por agrícola, campo y temporada. La primera entrega incluye
catálogos, usuarios/asignaciones y proyectos con lotes, subdivisiones y etapas.
La ampliación de aplicaciones y grupos incluye indicaciones,
realización habitual o con cambios, cancelación e historial por etapa. El reporte
completo queda para otra entrega. La captura de aplicaciones y grupos ya está
publicada en Docker y ChatGPT Sites.
Reglas y alcance: [PRODUCT](docs/PRODUCT.md).

[Abrir RCFito en ChatGPT Sites](https://rcfito.paxxa.chatgpt.site).
Su conexión inicial se prepara para Supabase mediante un Quick Tunnel temporal.
La demostración identificada se elige desde Conexión y preferencias.
La instalación real de este equipo se
abre en [RCFito local](http://127.0.0.1:5180), con administrador, acceso y guardado
real comprobados.
El acceso de prueba desde Sites usa HTTPS exterior y una ruta fija; la PC, la
sesión de Windows y Docker deben estar activos. La dirección aleatoria se renueva
con el [actualizador automático](docs/tunnel-auto-update.md).

React + TypeScript + Vite 8, controles shadcn/Radix y API de Supabase. El frontend
puede explorarse con datos ficticios guardados solo en el navegador, o conectarse
a un servidor Supabase configurado. La demostración no acredita autenticación ni
permisos de un servidor real.

## Desarrollo y comprobaciones

Node.js 24 y npm. Docker se necesita para ejecutar el backend o sus pruebas.

```sh
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`. La configuración pública inicial apunta al túnel;
la demostración se puede elegir en Conexión y preferencias.
En **Conexión y preferencias** se captura la URL de Supabase y su clave pública;
las cuentas reales requieren esa instalación.

```sh
npm test
npm run typecheck
npm run build
npm run docs:check
```

## Backend y publicación

[Preparación de Supabase](docs/backend-deployment.md) describe la migración,
primer administrador, función privada de altas y pruebas aisladas. Los siete
servicios Supabase y el frontend Docker están iniciados en este equipo, con datos
persistentes y conexión local mediante `/supabase`. Hay dos migraciones aplicadas
sin pendientes, con respaldo privado previo a la ampliación. En la primera entrega
se verificaron login de administrador, guardado y conservación tras recargar el
navegador. El acceso remoto de prueba usa Cloudflare Quick Tunnel; una dirección
estable para operación sigue pendiente. Publicar Sites y arrancar el túnel son
operaciones separadas.

La ampliación se probó en demo y backend aislado. El frontend Docker actualizado
se comprobó con sesión administradora y lista real de aplicaciones vacía, sin
insertar datos. Sites confirmó la publicación; las nueve comprobaciones HTTPS
posteriores aprobaron. Evidencia y límites
en [TESTING](docs/TESTING.md).

El frontend tiene [Dockerfile](Dockerfile) y [Compose](compose.frontend.yaml)
propios. Los comandos, publicación en Sites y portabilidad están en
[OPERATIONS](docs/OPERATIONS.md). El estándar compartido adoptado es **4.3.0**.

## Mapa del proyecto

- [Guía para agentes](AGENTS.md) y [arquitectura](ARCHITECTURE.md).
- [Interfaz](docs/FRONTEND.md) y [flujos implementados](docs/implementation-plan.md).
- [Seguridad](docs/SECURITY.md) y [pruebas/evidencia](docs/TESTING.md).
- [Pendientes](docs/PLANS.md) y [estándar compartido](docs/STANDARDS.md).

## Consultas de aplicaciones

La pantalla **Consultas** (`/consultas`) acepta preguntas escritas y notas de
voz, con transcripción editable. Reutiliza la configuración de IA existente;
administradores y lectores consultan únicamente su ámbito autorizado. El CLI
ejecuta las mismas rutinas. Las consultas estructuradas y la pregunta habitual
de consumo por malla no consumen IA; otras preguntas pueden usar el modelo:

```sh
npm run consultas -- login
npm run consultas -- pendientes --json
npm run consultas -- preguntar "cuánto de cada producto se ha aplicado en malla 5"
npm run consultas -- uso-producto --producto "Producto de ejemplo" --estado realizadas --json
npm run consultas -- detalle --folio "FOLIO-DE-EJEMPLO"
npm run consultas -- logout
```

`login` solicita la contraseña oculta y guarda la sesión en la carpeta privada
ignorada `.artifacts/query-cli/`. `--help` describe filtros, límites y conexión.
Requiere la migración de consultas instalada en Supabase. Contratos y evidencia:
[ficha de consultas](docs/flows/application-chat.md).
