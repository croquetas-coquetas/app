# SC-07 - Bottom NavBar (estado actual)

## Resumen
La navegación principal de la app móvil se hace mediante `BottomNavBar` (`src/components/planning/BottomNavBar.tsx`), con tres acciones:
- calendario,
- lista de la compra,
- menú de perfil.

Sustituye el patrón anterior de acciones flotantes inferiores.

## Componente `BottomNavBar`

### Props públicas
- `onCalendarClick(): void`
- `onShoppingListClick(): void`
- `onProfileClick?(action: "mi-perfil" | "configurar-horario"): void`
- `activeTab?: "calendar" | "shopping" | "profile"`

### Comportamiento UI
- `position: fixed` en parte inferior y soporte `safe-area-inset-bottom`.
- overlay con blur cuando el dropdown de perfil está abierto (`isProfileOpen`).
- menú de perfil con Radix (`DropdownMenu`) en `side="top"` y `align="end"`.
- `aria-label` estables para testing/QA:
  - `Ver calendario`
  - `Generar lista de la compra`
  - `Abrir menú del perfil`

### Acciones del menú de perfil
- `Mi perfil` (placeholder funcional, sin pantalla dedicada).
- `Configurar horario` (abre modal de configuración en `App.tsx`).

## Integración en `App.tsx`

### Visibilidad por estado
La navbar se oculta en:
- `initializing`
- `landing`
- `schedule-onboarding`
- `generate`
- `loading`
- `error`
- `confirm-overwrite`

Y se muestra en los estados de uso normal (calendario / no-plan / detalle día).

### Callbacks conectados
- `onCalendarClick` -> `setAppState("success")`
- `onShoppingListClick` -> `handleGenerarLista()` (abre diálogo de éxito con cantidad de ingredientes)
- `onProfileClick` -> `handleNavBarProfileClick(action)`
  - si `action === "configurar-horario"`, abre modal `Configurar mi horario`.

## Relación con el onboarding de horarios
- En primera ejecución, el usuario configura horario en pantalla dedicada (`schedule-onboarding`) antes de generar planificación.
- Después, la misma configuración queda accesible desde la navbar (perfil -> `Configurar horario`).
- Ambos caminos reutilizan la misma UI (`HorarioConfigFields`) y el mismo almacenamiento (`STORAGE_HORARIOS`).

## Notas de mantenimiento
- El botón de regenerar del calendario se mantiene en cabecera (`CalendarView`) y no forma parte de la navbar.
- Si se añaden nuevas opciones de perfil, mantener `aria-labels` y textos estables para no romper tests de `src/App.test.tsx`.
