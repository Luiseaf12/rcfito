# Referencia de catálogos React

Referencia 3.0.0 del [contrato común](../../CATALOGS.md). Código de composición,
coordinación y ejemplo de Sucursales; no se ejecuta por adoptar el bundle. El
ejemplo usa datos ficticios y no contiene URL, credenciales ni cliente de base.

## Piezas y dirección de dependencias

`components/` presenta datos y eventos sobre shadcn: CatalogPage, CatalogToolbar,
DataTable, RecordDialog, RecordDetails, CatalogFeedback y CatalogSelect.
`catalog-contract.ts` define tipos y errores puros, sin React ni librería de consultas.
`use-catalog.ts` coordina consulta, mutación y reconciliación; recibe un repositorio.
`examples/branch-model.ts`, `branch-form.tsx` y `branch-catalog.tsx` definen una
entidad concreta con sus campos y columnas. Los límites 50/150 y estados son
del ejemplo basado en Sucursales, no obligaciones para otras entidades.
`adapters/branch-repository.ts` recibe un puerto de datos, comprueba capacidades y
traduce errores; no importa Supabase ni componentes visuales.

`examples/mock-branch-repository.ts` mantiene 16 registros ficticios en memoria.
`examples/branch-demo.tsx` monta el ejemplo con QueryClientProvider. Remontarlo
al cambiar identidad o rol; el caché pertenece a ese montaje. Usar el tema del
consumidor y suministrar un contenedor de portal del tema por encima del shell,
según la receta siguiente.

## Controles y acciones obligatorios

El contrato exige reutilizar las composiciones compartidas y sus controles
shadcn. Esta referencia muestra el mapa: CatalogPage, CatalogToolbar, DataTable,
RecordDialog, RecordDetails, CatalogFeedback y CatalogSelect en `components/`;
BranchForm usa FieldGroup/Field/FieldLabel/FieldError, Input, CatalogSelect y
Button. El consumidor registra sus rutas equivalentes y diferencias técnicas.
No basta conservar los nombres con una implementación ajena al contrato.

En `examples/branch-catalog.tsx`, la columna Acciones usa Button con textos Ver
y Editar, etiquetas accesibles por nombre, ordenación/búsqueda deshabilitadas y
la identidad `row.original.id`. Ver abre RecordDialog/RecordDetails; Editar abre
BranchForm con el mismo registro. El detalle también ofrece Editar Sucursal.
`canWrite` controla las acciones de escritura y `open()` rechaza edición sin
permiso; el repositorio vuelve a autorizarla. La lectura conserva Ver para el
actor sin permiso de edición, sin convertirlo en un editor.

Las piezas y acciones ya existen; el estado del detalle de Sucursales usa Badge
como el listado y los otros catálogos del piloto. Al integrarla, verificar su uso efectivo, permisos,
recorrido, teclado y contexto con datos ficticios. Una adaptación sin controles
aplicables o sin Ver/Editar autorizados funcionales no puede declararse conforme.
El contrato no obliga a copiar TanStack/RHF/Zod a otro stack ni migra por sync
la UI de los consumidores.

## Buscador reutilizable

`CatalogToolbar` compone `InputGroup`, `InputGroupInput` y `InputGroupAddon`
del consumidor. La etiqueta se asocia por `id`; el addon va después del input
en el DOM, con `align="inline-start"` y lupa decorativa `aria-hidden`.
La referencia usa `SearchIcon` de Lucide; conservar la biblioteca de iconos
del adaptador. Reutilizar componentes ya instalados o incorporar Input Group
según el perfil shadcn local; no copiar su implementación ni cambiar el preset.
Consultar [Input Group oficial](https://ui.shadcn.com/docs/components/base/input-group).

El campo nativo `type="search"` entrega `event.target.value` sin transformarlo.
`query` pertenece al controlador; el ejemplo deriva resultados mientras se
escribe, sin Enter, normalizando solo para comparar. Ignorar caso y acentos es
una decisión del ejemplo, no una regla de unicidad o búsqueda para otros productos.
`suggestions` admite valores opcionales para un `datalist` nativo con opciones
deduplicadas; no requiere seleccionar una opción para buscar. Si no hay opciones,
no se crea el listado. No hay backend de sugerencias en esta referencia.

Escribir no restablece otros filtros. El control nativo permite cancelar el texto
y el botón existente «Limpiar búsqueda y filtros» delega el restablecimiento
completo en `onClear`. El consumidor define valores iniciales y retorno de foco.
Conservar los props/callbacks permite adaptar la presentación sin mover reglas
de consulta ni persistencia a la toolbar. Para modo servidor, implementar
debounce/cancelación y metadatos en el controlador/adaptador.

Verificar captura intacta, filtrado vivo, limpieza, filtros, teclado, texto largo
y ampliado; usar datos ficticios y demostrar ausencia de mutaciones. La evidencia
de otro consumidor no certifica el buscador local.

## Portal del diálogo

El adaptador del consumidor entrega `portalContainer` a `BranchDemo/BranchCatalog`.
Ese elemento debe pertenecer al nivel modal del shell y conservar sus tokens.
Puede reutilizarse el contenedor de overlays existente. Si el shell requiere un
host propio, crearlo bajo `document.body`, fuera del contenido desplazable, y
aplicarle la clase de tema local. Una receta de CSS para ese host es:

```css
.catalog-overlay-host {
  position: relative;
  z-index: var(--layer-modal);
  flex: none;
  width: 0;
  height: 0;
  overflow: visible;
}
```

`--layer-modal` lo define el consumidor por encima de su navegación; la referencia
no fija un número ni una marca. No añadir transform/filter/contain al host sin
verificar las coordenadas del popup. Pasar el host a `RecordDialog`, conservarlo
durante el montaje y retirarlo después de `root.unmount()` y la limpieza del
caché de ese montaje. Si ocurre un error al montar, retirar también el host creado.

`BranchForm` no recibe ese contenedor por defecto: su `CatalogSelect` permite
que Base UI anide automáticamente el portal dentro del portal del diálogo.
Un contenedor explícito para el selector requiere comprobar anidamiento,
visibilidad, ámbito accesible, foco y Escape. Adaptar estas APIs si el consumidor
usa Radix o React Aria; conservar la primitiva instalada y sus garantías.

Comprobar Ver → Editar, menú abierto/cerrado, Tab/Shift+Tab, Escape y retorno de
foco. Repetir montajes y desmontar con el diálogo abierto para detectar hosts
huérfanos. En la verificación visual, la navegación debe quedar detrás del fondo
modal y las opciones delante del diálogo, también en móvil y texto ampliado.
Documentación de las primitivas:
[Dialog](https://base-ui.com/react/components/dialog) y
[Combobox](https://base-ui.com/react/components/combobox).

## Integración explícita

1. Revisar ficha local y contratos de datos/permisos, incluyendo el modo de consulta.
2. Adaptar alias `@/components/ui`, prefijo `tw:`, primitivas Base UI y `catalog.css`
   al consumidor. Los componentes shadcn provienen de su instalación oficial;
   esta referencia no los reemplaza ni distribuye una marca.
3. Copiar las piezas necesarias a la aplicación conservando la estructura de
   imports, o mapear `examples/` a una carpeta de funcionalidad y ajustar el import
   de su modelo en el adaptador. El sync del estándar no copia nada a `src/`.
4. Inyectar repositorio y capacidades; volver a autorizar escrituras en servidor.
   En modo local, `list()` debe devolver el conjunto completo y acotado. Para
   servidor, controlar filtros/orden/página y metadatos en la consulta y configurar
   TanStack Table en modo manual; no reutilizar el filtrado local de este ejemplo.
5. Completar [la ficha](../../templates/catalog.md), ejecutar tipos, compilación y
   flujo en navegador con mocks, y registrar versiones y evidencia local.

## Versiones comprobadas

| Dependencia | Versión de la referencia |
| --- | --- |
| React / React DOM | 19.3.0 |
| @base-ui/react | 1.9.0 |
| @tanstack/react-table | 8.21.3 |
| @tanstack/react-query | 5.104.2 |
| react-hook-form | 7.90.0 |
| @hookform/resolvers | 5.9.1 |
| zod | 4.6.7 |

Los nombres de paquetes/versions no obligan a migrar otros proyectos. La referencia
usa TanStack Table **v8**; la documentación general de shadcn puede mostrar una
major posterior con otra API. Consultar [Table v8](https://tanstack.com/table/v8/docs/guide/sorting)
antes de modificarla y fijar versiones en el lock del consumidor.
La implementación local de componentes shadcn es también parte del adaptador:
DialogContent admite `container` y `finalFocus`; Combobox usa `render`/Base UI.

## Garantías y límites

- Un propietario por consulta, captura y selección. Ordenar/filtrar no escribe.
- Guardado confirmado y actualización fallida son resultados distintos. No hay
  reintento automático de mutaciones ni actualización optimista de altas.
- Una creación recibe UUID estable antes de enviarse. Si se pierde la respuesta,
  el adaptador comprueba por ID y valores; mientras no se confirme el resultado
  la captura queda bloqueada y ofrece **Comprobar guardado** de solo lectura.
- Errores SQL conocidos permiten corrección/reintento; mensajes internos no llegan
  al usuario. Lecturas imposibles no autorizan reenvío ciego. Si la lectura
  devuelve valores diferentes o una edición ya no tiene registro, la captura
  permite **Cerrar y revisar listado**, sin presentar éxito ni reenviar valores
  anteriores. El formulario se reabre después con los datos vigentes.
- El ejemplo conserva el esquema y la política de concurrencia del producto. Una
  operación con relaciones necesita su propio caso de uso/transacción; no copiar
  este guardado sencillo como si resolviera Clientes o expedientes completos.
- Búsqueda sin acentos/mayúsculas, orden inicial por nombre, columnas ordenables,
  controles de orden móviles y página de 10 registros son decisiones del ejemplo.
- La consulta local paginada no es una instantánea transaccional. Evaluar consultas
  de servidor/cursor cuando crezca el catálogo o la concurrencia lo requiera.

Verificación de referencia y piloto: tipos y pruebas del consumidor Apoyosing,
con red interceptada y sin persistencia remota. El informe de entrega central
documenta comandos y resultados; la adopción documental por otro proyecto no
constituye evidencia de que su UI cumple.
