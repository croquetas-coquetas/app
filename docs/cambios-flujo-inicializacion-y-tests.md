# Cambios de flujo inicial y actualización de tests

## Objetivo
Este documento resume los cambios recientes en el arranque de la app y en la suite de pruebas para reflejar el nuevo comportamiento.

## Cambios funcionales implementados

### 1) Nuevo estado inicial de carga
Se añadió el estado `initializing` al `AppState` para mostrar un spinner mientras la app decide qué vista inicial cargar.

- Archivo: `src/types/planning.ts`
- Archivo: `src/components/planning/states/InitializingState.tsx`
- Uso: `src/App.tsx`

Comportamiento:
- Al abrir la app, primero se muestra `Cargando...`.
- Tras la inicialización, la app navega al estado correspondiente.

### 2) Flujo de primera apertura vs aperturas posteriores
Se incorporó una bandera persistente en storage para diferenciar la primera ejecución de las siguientes:

- Clave: `smartcook_first_time`
- Funciones: `isFirstTime()` y `markAsNotFirstTime()`
- Archivo: `src/lib/planning.storage.ts`

Comportamiento:
- **Primera apertura** (`isFirstTime() === true`):
  - Vista inicial `landing`.
  - Flujo normal: `landing -> generate -> success`.
- **No primera apertura** (`isFirstTime() === false`):
  - Si hay planificación guardada: abre directamente calendario (`success`).
  - Si no hay planificación: abre calendario con popup de aviso (`no-plan-generated`).

### 3) Estado de calendario sin semana generada
Se añadió una vista específica para casos en los que la app no es de primera apertura y no existe planificación para mostrar.

- Archivo: `src/components/planning/states/NoPlanGeneratedState.tsx`
- Integración: `src/App.tsx`

Comportamiento:
- Se muestra el calendario de fondo.
- Aparece un popup con mensaje: "No hay semana generada".
- Acción principal para generar una nueva planificación.

## Ajustes técnicos en `App.tsx`

Archivo principal: `src/App.tsx`

Se actualizó la lógica de estado inicial para:
1. Migrar storage legado (`migrateLegacyStorage`).
2. Evaluar primera apertura (`isFirstTime`).
3. Cargar planificación almacenada (`cargarPlanificacion`).
4. Decidir estado inicial (`landing`, `success`, `no-plan-generated`).
5. Al generar correctamente, marcar que ya no es primera apertura (`markAsNotFirstTime`).

## Actualización de tests

Archivo: `src/App.test.tsx`

Se adaptó la suite para cubrir los nuevos flujos y evitar inestabilidades:

### 1) Helpers nuevos para test
- `advanceInit()` para esperar el tiempo de inicialización.
- `renderAsFirstTime()` para arrancar la app en escenario de primera apertura.
- `clickGenerateButton()` para click robusto por rol del botón.

### 2) Mock de `localStorage` en memoria
Se añadió `installMemoryStorage()` para garantizar un storage consistente en entorno `jsdom`.

### 3) Selectores más robustos
Se sustituyeron búsquedas ambiguas de texto por selectores por rol cuando aplica:
- `getByRole("button", { name: /Generar planificación/i })`
- `getByRole("heading", { name: /Generar planificación/i })`

### 4) Compatibilidad con calendario en tests
Se mockeó `scrollTo` en `HTMLElement.prototype` para evitar errores en `jsdom` por `container.scrollTo`.

## Cobertura de comportamiento verificado

La suite comprueba, entre otros, estos casos:
- Spinner inicial y transición correcta a landing.
- Flujo de primera apertura completo.
- Errores de API y de red.
- Confirmación de sobreescritura si hay plan de hoy.
- Apertura directa al calendario en no primera apertura con plan.
- Popup "No hay semana generada" en no primera apertura sin plan.
- Persistencia en storage (`STORAGE_META`, `STORAGE_PREFIX + dia_*`, `smartcook_first_time`).

## Resumen
Con estos cambios, la app ofrece una entrada más natural:
- La primera vez guía al usuario.
- Las siguientes veces abre directamente donde tiene sentido.
- Si falta planificación, informa y permite generarla desde un popup claro.

Además, los tests quedaron alineados con este nuevo flujo y con mayor robustez en entorno de pruebas.

