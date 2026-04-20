# Implementación de Bottom NavBar

## Descripción General

Se ha implementado una barra de navegación horizontal en la parte inferior de la aplicación, siguiendo el patrón estándar de aplicaciones móviles. Esta navbar aparece en todas las pantallas principales de la aplicación (excepto en landing, generación, carga y pantallas de error).

## Componentes Creados

### 1. **BottomNavBar.tsx** (`src/components/planning/BottomNavBar.tsx`)

Componente principal que renderiza la barra de navegación inferior con tres elementos:

#### Características:
- **Posicionamiento**: Fixed en la parte inferior de la pantalla
- **Z-index**: 40 para asegurar que está encima de otros elementos
- **Responsive**: Soporta safe-area-inset para dispositivos con notches
- **Backdrop blur**: Efecto de vidrio esmerilado (backdrop-filter) para un look moderno

#### Estructura:

```
┌───────────────────────────────────┐
│Calendario │ Lista Compra │ Perfil │
└───────────────────────────────────┘
```

#### Props:
- `onCalendarClick(): void` - Callback cuando se hace clic en calendario
- `onShoppingListClick(): void` - Callback cuando se hace clic en lista de compra
- `onProfileClick?(action: "mi-perfil" | "configurar-horario"): void` - Callback del menú de perfil
- `activeTab?: "calendar" | "shopping" | "profile"` - Indica qué tab está activo (opcional)

#### Estados Visuales:
- **Activo**: Fondo con color primario (10% opacity) + texto en primario
- **Inactivo**: Texto en muted-foreground con hover
- **Botones**: Tamaño 12x12 (h-12 w-12) con bordes redondeados (rounded-xl)

#### Menú de Perfil (Dropdown):
El menú aparece justo encima del botón de perfil con las opciones:
1. **Mi perfil** - Con ícono de usuario
2. **Configurar horario** - Con ícono de reloj

Características del dropdown:
- Alineado al final (align="end")
- Aparece hacia arriba (side="top")
- Cierra automáticamente al seleccionar una opción
- Tiene un overlay oscuro de fondo (z-index: 30)

#### Espaciador:
Se incluye un `<div>` spacer al final para evitar que el contenido se superponga con la navbar.

## Cambios en App.tsx

### Nuevos Estados:
```typescript
const [successListaDialogOpen, setSuccessListaDialogOpen] = useState(false);
const [listaItemsCount, setListaItemsCount] = useState<number | null>(null);
```

### Nuevas Funciones:
1. **`handleGenerarLista()`** - Genera la lista de compra y muestra un diálogo de éxito
2. **`handleNavBarProfileClick()`** - Maneja acciones del menú de perfil (actualmente solo loguea en consola)

### Lógica de Visibilidad:
```typescript
const showNavBar = !["initializing", "landing", "generate", "loading", "error", "confirm-overwrite"].includes(appState);
const currentNavTab = appState === "day-detail" ? "calendar" : appState === "success" ? "calendar" : undefined;
```

La navbar se muestra en todos los estados excepto:
- `initializing` - Pantalla de carga inicial
- `landing` - Landing page
- `generate` - Pantalla de generación
- `loading` - Cargando
- `error` - Pantalla de error
- `confirm-overwrite` - Confirmación de sobrescritura

### Diálogo de Éxito:
Se movió el diálogo de "Lista generada correctamente" del CalendarView al App.tsx, permitiendo que la navbar dispare este evento desde cualquier lugar.

## Cambios en CalendarView.tsx

### Botón de Regenerar (Reubicado):
- **Antes**: Estaba en un floating container en la parte media-inferior junto con el botón de lista
- **Ahora**: Ubicado en la parte superior derecha del encabezado del calendario
- **Estilo**: `variant="outline"` con `size="icon-sm"`

### Código Removido:
1. Función `handleGenerarLista()` - Ahora en App.tsx
2. Estados `successDialogOpen` y `listaItemsCount` - Ahora en App.tsx
3. Diálogo de éxito - Ahora en App.tsx
4. Botones flotantes en la parte inferior - Reemplazados por navbar

### Padding Ajustado:
Se eliminó el padding inferior que compensaba los botones flotantes:
```typescript
// Antes:
pb-[calc(6.5rem+env(safe-area-inset-bottom))]

// Ahora:
// No se especifica, usa el espaciador de la navbar
```

## Flujo de Interacción

### Botón Calendario:
1. Usuario hace clic en ícono de calendario
2. Se ejecuta `onCalendarClick()` → `setAppState("success")`
3. Se muestra la vista del calendario

### Botón Lista de Compra:
1. Usuario hace clic en ícono de carrito
2. Se ejecuta `onShoppingListClick()` → `handleGenerarLista()`
3. Se genera la lista de compra
4. Se abre diálogo de confirmación mostrando cantidad de ingredientes

### Menú de Perfil:
1. Usuario hace clic en ícono de usuario
2. Se abre dropdown menu hacia arriba (side="top")
3. Usuario selecciona opción:
   - **Mi perfil**: Ejecuta `handleNavBarProfileClick("mi-perfil")`
   - **Configurar horario**: Ejecuta `handleNavBarProfileClick("configurar-horario")`
4. El menú se cierra automáticamente