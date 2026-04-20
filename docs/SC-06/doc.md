# SC-06: Lista de la compra

## Resumen

La funcionalidad permite consultar la lista de la compra asociada a la planificacion semanal activa.

Desde el calendario, el usuario pulsa **Lista de la compra**. La aplicacion comprueba si existe una lista guardada en `localStorage` y si esa lista pertenece a la planificacion actual. Si la lista es valida, se abre una pantalla completa con los ingredientes y sus cantidades. Si no existe una lista valida, el calendario se mantiene visible y aparece un recuadro centrado indicando que primero debe generarse la lista.

La generacion no se reimplementa. El flujo reutiliza la funcion existente `generarListaCompra()` y despues vuelve a leer la lista guardada con `getSavedListaCompra()`.

Tambien se permite marcar ingredientes como comprados. Estos tachados se guardan aparte, sin modificar la lista original generada.

## Criterios Cubiertos

- `SC-06-1`: si existe una lista generada con ingredientes, se muestra cada ingrediente junto con la cantidad total necesaria.
- `SC-06-2`: si existe una lista generada pero esta vacia, se muestra `No hay ingredientes en esta lista.`
- `SC-06-3`: si no existe lista generada para la planificacion actual, se muestra un recuadro con mensaje y boton `Generar`; al pulsarlo se genera la lista y se abre la pantalla de lista.

## Archivos Modificados

- `src/App.tsx`
- `src/components/planning/CalendarView.tsx`
- `src/components/planning/states/NoPlanGeneratedState.tsx`
- `src/components/shopping/ShoppingListScreen.tsx`
- `src/components/shopping/ShoppingListMissingDialog.tsx`
- `src/lib/shopping.constants.ts`
- `src/lib/shopping.storage.ts`
- `src/types/planning.ts`
- `src/App.css`
- `src/App.test.tsx`

## Archivos Nuevos

### `src/components/shopping/ShoppingListScreen.tsx`

Pantalla completa de consulta de la lista de la compra.

Responsabilidades:

- Mostrar el titulo `Lista de la compra`.
- Mostrar el boton `Volver`.
- Mostrar el contador `X de Y comprados`.
- Mostrar cada ingrediente en una lista plana.
- Mostrar el nombre del ingrediente como texto principal.
- Mostrar cantidad y unidad debajo.
- Mostrar `No hay ingredientes en esta lista.` cuando `lista.items.length === 0`.
- Permitir marcar y desmarcar ingredientes como comprados.
- Guardar los ingredientes comprados mediante las funciones de `shopping.storage.ts`.

La pantalla no agrupa por categorias. Aunque `ItemCompra` puede contener `categoria`, esa informacion no se usa para organizar visualmente la lista. La lista se muestra como una compra normal y directa.

El formateo de cantidad se hace en `formatCantidad(item)`. Si existe unidad, devuelve:

```text
cantidad unidad
```

Si no existe unidad, devuelve solo la cantidad.

### `src/components/shopping/ShoppingListMissingDialog.tsx`

Recuadro centrado que aparece cuando el usuario intenta abrir la lista de la compra y no existe una lista valida para la planificacion actual.

Contenido visible:

```text
No hay lista generada
Primero debe generarse la lista de la compra.
Generar
```

Usa:

```tsx
role="dialog"
aria-modal="false"
```

`aria-modal="false"` refleja que no se trata de una pantalla modal completa que sustituya el contexto. La planificacion sigue visible detras del recuadro.

## Cambios en `CalendarView`

Antes, el boton inferior generaba directamente la lista desde el propio calendario llamando a `generarListaCompra()`. Tambien mostraba un dialogo de exito local al componente.

Ahora `CalendarView` ya no genera la lista, no lee `localStorage` y no decide si una lista es valida.

Se ha anadido una prop:

```ts
onShoppingListOpen: () => void;
```

El boton inferior ahora muestra:

```text
Lista de la compra
```

Al pulsarlo llama a `onShoppingListOpen`.

Esto deja el calendario como componente visual y traslada la coordinacion de la funcionalidad a `App.tsx`.

### Posicion de los botones inferiores

La botonera inferior se mantiene fija con:

```tsx
bottom-[max(env(safe-area-inset-bottom),0.75rem)]
```

Esto evita que quede pegada al borde inferior en dispositivos con area segura, manteniendola cerca de la parte baja de la pantalla.

## Cambios en `App.tsx`

`App.tsx` coordina el flujo completo.

Se han anadido dos estados:

```ts
const [shoppingList, setShoppingList] = useState<ListaCompra | null>(null);
const [shoppingListMissingOpen, setShoppingListMissingOpen] = useState(false);
```

`shoppingList` contiene la lista que se renderiza en `ShoppingListScreen`.

`shoppingListMissingOpen` controla si se muestra el recuadro de lista no generada sobre el calendario.

### Nuevo estado de aplicacion

Se ha anadido el estado:

```ts
"shopping-list"
```

Este estado representa la pantalla completa de la lista de la compra.

El recuadro de lista no generada no tiene estado propio en `AppState`; se controla con `shoppingListMissingOpen` para que el calendario siga siendo la pantalla activa.

### Validacion de pertenencia de lista

La app comprueba si una lista pertenece a la planificacion actual comparando:

```ts
lista.planificacion_generada_en
```

con:

```ts
planificacion.generado_en
```

Esto evita abrir una lista creada para una planificacion anterior.

### `handleShoppingListOpen`

Se ejecuta al pulsar **Lista de la compra**.

Flujo:

1. Si no hay planificacion cargada, no hace nada.
2. Lee la lista guardada con `getSavedListaCompra()`.
3. Comprueba si la lista pertenece a la planificacion actual.
4. Si pertenece, guarda la lista en `shoppingList`, cierra el recuadro y cambia a `shopping-list`.
5. Si no existe lista valida, limpia `shoppingList` y abre `shoppingListMissingOpen`.

### `handleShoppingListGenerate`

Se ejecuta al pulsar **Generar** dentro del recuadro.

Flujo:

1. Si no hay planificacion cargada, no hace nada.
2. Llama a `generarListaCompra()`.
3. Lee la lista guardada con `getSavedListaCompra()`.
4. Comprueba que pertenece a la planificacion actual.
5. Guarda la lista en `shoppingList`.
6. Cierra el recuadro.
7. Cambia a `shopping-list`.

Si despues de generar no se puede recuperar una lista valida, se lanza un error y se registra en consola.

### Renderizado

Cuando hay planificacion y el estado es `success`, se muestra el calendario.

Cuando `shoppingListMissingOpen` es `true`, se renderiza:

```tsx
<ShoppingListMissingDialog onGenerate={handleShoppingListGenerate} />
```

Cuando `appState === "shopping-list"` y existe `shoppingList`, se renderiza:

```tsx
<ShoppingListScreen
  lista={shoppingList}
  onBack={handleBackToCalendar}
/>
```

## Cambios en `NoPlanGeneratedState`

`NoPlanGeneratedState` reutiliza `CalendarView`. Como `CalendarView` ahora requiere `onShoppingListOpen`, se le pasa una funcion vacia.

Motivo:

- En ese estado no hay planificacion real generada para consultar.
- El objetivo de la pantalla sigue siendo guiar al usuario a generar una planificacion.
- No se debe intentar abrir lista de compra sin planificacion.

## Cambios en Storage

### `src/lib/shopping.constants.ts`

Se mantiene:

```ts
export const SHOPPING_KEY = "smartcook_lista_compra";
```

Se anade:

```ts
export const SHOPPING_CHECKED_PREFIX = "smartcook_lista_compra_tachados_";
```

Esta constante se usa para guardar los ingredientes marcados como comprados sin modificar la lista generada.

### `src/lib/shopping.storage.ts`

Se mantienen las funciones de lista generada:

```ts
getSavedListaCompra()
saveListaCompra(lista)
clearListaCompra()
```

Se anaden funciones para tachados:

```ts
getListaCompraItemKey(item)
getCheckedListaCompraItems(lista)
saveCheckedListaCompraItems(lista, checkedItems)
```

### Clave estable de ingrediente

`getListaCompraItemKey(item)` genera una clave estable usando:

- nombre normalizado
- unidad normalizada
- categoria normalizada

Formato:

```text
nombre|unidad|categoria
```

La normalizacion:

- elimina espacios laterales
- pasa a minusculas
- elimina diacriticos

Esto permite reconocer el mismo ingrediente aunque haya diferencias pequenas de escritura.

### Clave de tachados por lista

Los tachados se guardan usando:

```ts
lista.planificacion_generada_en ?? lista.generado_en
```

Esto separa los marcados de distintas planificaciones.

Ejemplo conceptual:

```text
smartcook_lista_compra_tachados_2026-04-20T10:00:00.000Z
```

### Persistencia de tachados

`localStorage` solo guarda strings, asi que el `Set<string>` de tachados se guarda como array JSON.

Al leer:

- si no existe la clave, se devuelve `new Set()`
- si el JSON no es valido, se devuelve `new Set()`
- si la estructura no es un array de strings, se devuelve `new Set()`

## Cambio en Lectura de Planificacion para Generar Lista

La funcion `cargarPlanificacion()` dentro de `shopping.storage.ts` se ha ajustado para leer como maximo los ultimos 7 dias, pero sin asumir que siempre existen 7.

Antes el bucle podia empezar en un indice negativo si la planificacion tenia menos de 7 dias.

Ahora empieza en:

```ts
Math.max(0, num_dias - 7)
```

Tambien usa `STORAGE_PREFIX` para construir la clave:

```ts
`${STORAGE_PREFIX}dia_${i}`
```

Esto evita duplicar a mano el prefijo `smartcook_plan_`.

## Estilos

Los estilos principales se han anadido en `src/App.css`.

### Pantalla de lista

Clases:

```css
.shopping-list-screen
.shopping-list-header
.shopping-list-back-button
.shopping-list-title-wrap
.shopping-list-title
.shopping-list-progress
.shopping-list-empty
.shopping-list-items
.shopping-list-item
.shopping-list-row
.shopping-list-check
.shopping-list-copy
.shopping-list-name
.shopping-list-subtitle
```

La pantalla es sobria, plana y centrada en lectura rapida.

Los ingredientes marcados como comprados aparecen tachados mediante estilos asociados al checkbox.

### Recuadro de lista no generada

Clases:

```css
.shopping-list-missing-layer
.shopping-list-missing-card
.shopping-list-generate-button
```

La capa usa `pointer-events: none` y la tarjeta usa `pointer-events: auto`.

Esto permite que el recuadro capture interaccion, pero la capa completa no funcione como una superficie opaca visual.

## Flujo Funcional

### Caso 1: existe lista con ingredientes

1. El usuario esta en la planificacion.
2. Pulsa **Lista de la compra**.
3. `App` lee `smartcook_lista_compra`.
4. La lista existe y pertenece a `planificacion.generado_en`.
5. `App` guarda la lista en estado.
6. `App` cambia a `shopping-list`.
7. `ShoppingListScreen` muestra los ingredientes.
8. Cada ingrediente muestra nombre y cantidad.

### Caso 2: existe lista vacia

1. El usuario pulsa **Lista de la compra**.
2. `App` recupera una lista valida.
3. La lista pertenece a la planificacion actual.
4. Se abre `ShoppingListScreen`.
5. `ShoppingListScreen` detecta `lista.items.length === 0`.
6. Se muestra `No hay ingredientes en esta lista.`

### Caso 3: no existe lista generada

1. El usuario pulsa **Lista de la compra**.
2. `App` intenta leer la lista guardada.
3. No existe lista o no pertenece a la planificacion actual.
4. El calendario sigue visible.
5. Se muestra `ShoppingListMissingDialog`.
6. El usuario pulsa **Generar**.
7. `App` llama a `generarListaCompra()`.
8. La generacion guarda la lista en `localStorage`.
9. `App` vuelve a leer con `getSavedListaCompra()`.
10. `App` valida la pertenencia.
11. Se cierra el recuadro.
12. Se abre `ShoppingListScreen`.

### Caso 4: ingredientes comprados

1. El usuario abre una lista.
2. Marca un ingrediente como comprado.
3. `ShoppingListScreen` calcula la clave con `getListaCompraItemKey(item)`.
4. La clave se guarda en el `Set`.
5. El ingrediente se muestra tachado.
6. El contador se actualiza.
7. El `Set` se persiste en `localStorage`.
8. Al volver a abrir la lista, se recuperan los tachados asociados a esa planificacion.

## Decisiones Tecnicas

### No generar automaticamente al pulsar el boton principal

El boton **Lista de la compra** no genera la lista si falta. Solo intenta abrirla.

Si no existe, se pide confirmacion mediante el recuadro y el boton **Generar**.

### No abrir ventana externa

La lista se muestra dentro de la aplicacion. No se usa `window.open`.

### No sustituir la planificacion cuando falta lista

El aviso aparece encima de la planificacion. El calendario sigue visible detras.

### No agrupar ingredientes

La lista no agrupa por categoria, tipo ni grupo alimentario.

### No modificar la lista generada al tachar

Los tachados se guardan aparte. `smartcook_lista_compra` permanece intacta.

### Validar pertenencia de la lista

La lista guardada solo se abre si `planificacion_generada_en` coincide con la planificacion activa. Esto evita mezclar listas antiguas con planes nuevos.

## Pruebas

Se anadieron pruebas en `src/App.test.tsx` para cubrir:

- Lista guardada con ingredientes y cantidades.
- Lista guardada vacia.
- Recuadro de generacion cuando no hay lista.
- Apertura automatica tras generar desde el recuadro.
- Persistencia de ingredientes marcados como comprados.

Comandos ejecutados:

```bash
bun run test -- --run
```

Resultado:

```text
2 archivos de test superados
33 tests superados
```

```bash
bun run build
```

Resultado:

```text
Build correcto
```

## Nota Sobre Unidades `ml` y `mL`

La pantalla de lista muestra la unidad tal como llega en `item.unidad`.

Actualmente `formatCantidad()` no normaliza la unidad antes de pintarla. Por eso pueden aparecer ingredientes con `ml` y otros con `mL` si los datos originales contienen ambas variantes.

Existe una funcion `formatUnidad()` en `planning.utils.ts` que normaliza unidades, pero no se usa en `ShoppingListScreen`.

No se modifico este comportamiento en esta documentacion; solo se deja registrado como observacion tecnica.

## Estado Final

SC-06 queda implementado como un flujo completo:

- acceso desde planificacion
- validacion de lista guardada
- pantalla de lista
- mensaje para lista vacia
- recuadro de generacion si falta lista
- reutilizacion de `generarListaCompra()`
- persistencia independiente de ingredientes comprados

