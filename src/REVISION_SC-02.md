# REVISION_SC-02: Planificación Semanal con Regeneración

## Cambios Realizados

### 1. **types/planning.ts**
- `AppState` actualizado: `"empty"` eliminado, añadidos `"landing"` y `"generate"`
  - Estados finales: `"landing" | "generate" | "confirm-overwrite" | "loading" | "success" | "day-detail" | "error"`
- Nueva interfaz `PlanMeta` con campos `generado_en`, `fuente_datos`, `total_recetas_disponibles`, `total_dias`

### 2. **planning.constants.ts**
- `STORAGE_KEY` eliminada
- Nuevas constantes:
  - `STORAGE_PREFIX = "smartcook_plan_"` — prefijo para claves individuales por día
  - `STORAGE_META = "smartcook_plan_meta"` — clave para metadatos del plan
  - `LEGACY_STORAGE_KEY = "smartcook_planificacion"` — clave antigua (solo para migración)

### 3. **planning.storage.ts** (reescrito)
- **Esquema multi-clave**: cada día se guarda individualmente (`smartcook_plan_dia_0`, `_dia_1`...) + objeto meta en `smartcook_plan_meta`
- `savePlanificacion()`: limpia todas las claves con el prefijo, escribe cada día por separado y el meta
- `cargarPlanificacion()`: reconstruye el array de días leyendo `_meta.total_dias` claves individuales
- `getPlanificacionHoy()`: devuelve la planificación solo si `generado_en` es de hoy; si no, devuelve `null`
- `migrateLegacyStorage()`: migración one-shot que lee la clave antigua (`smartcook_planificacion`), la convierte al nuevo formato multi-clave y la borra
- Helper privado `clearPlanKeys()`: elimina todas las claves con `STORAGE_PREFIX` y `STORAGE_META`

### 4. **planning.api.ts**
- `fetchPlanificacionSemanal()` acepta parámetro opcional `diasPrevios: DiaPlanning[]`
- **GET sin argumentos**: nueva planificación (sin `diasPrevios`)
- **POST con body**: regeneración con `{ dias_previos }` en JSON
- `cleanDiaPlanning()` serializa los datos sin referencias circulares
- Validación defensiva: `Array.isArray(diasPrevios)` para evitar errores de tipo

### 5. **planning.utils.ts**
- Nueva función `getDiasPrevios(plan)`: filtra los días de una planificación cuya fecha sea estrictamente anterior a hoy
  - Normaliza horas a medianoche para comparación de fechas pura
  - Devuelve array vacío si `plan` es `null`

### 6. **App.tsx** (reescrito flujo completo)
- Estado inicial siempre `"landing"` (ya no lee localStorage al arrancar)
- `useEffect` al montar ejecuta `migrateLegacyStorage()` una sola vez
- `handleRequestGenerate()` usa `getPlanificacionHoy()` — solo muestra confirm-overwrite si el plan es de hoy
- `doGenerate()`:
  1. Carga planificación completa con `cargarPlanificacion()`
  2. Filtra días previos con `getDiasPrevios()`
  3. Llama a `fetchPlanificacionSemanal(previos)` (POST si hay previos, GET si no)
- En `"error"`, el botón "Volver" lleva a `"generate"` (antes iba a `"empty"`)
- Imports actualizados: `LandingState` y `GenerateState` en lugar de `EmptyState`; `cargarPlanificacion`, `getPlanificacionHoy`, `migrateLegacyStorage` en lugar de `getSavedPlanificacion`

### 7. **LandingState.tsx** (nuevo)
- Pantalla de bienvenida con icono 🍽️, título "SmartCook" y botón "Get Started"
- Al pulsar navega al estado `"generate"`

### 8. **GenerateState.tsx** (nuevo)
- Pantalla intermedia con botón "Generar planificación" y "← Volver"
- "Volver" regresa a `"landing"`, "Generar" dispara `handleRequestGenerate`

### 9. **ConfirmOverwriteState.tsx**
- Título cambiado: ~~"Ya tienes una planificación guardada"~~ → **"Ya tienes una planificación de hoy"**
- Prop `onGenerateNew` simplificada: ya no recibe `diasPrevios` (la lógica de días previos se gestiona en `doGenerate`)

### 10. **EmptyState.tsx**
- Ya no se usa en `App.tsx` (reemplazado por `LandingState` + `GenerateState`). Fichero conservado por compatibilidad.

## Flujos

| Caso | Pantallas | Request | Headers |
|------|-----------|---------|---------|
| 🆕 Primera vez | landing → generate → loading → success | `GET /api/planificacion/semanal/` | Accept: application/json |
| 🔄 Regenerar (con días pasados) | generate → loading → success | `POST /api/planificacion/semanal/` | Content-Type: application/json |
| ⚠️ Ya hay plan de hoy | generate → confirm-overwrite → loading → success | POST (con días previos automáticos) | Content-Type: application/json |
| ❌ Error | loading → error → generate | — | — |

## Esquema de Storage

| Clave | Contenido |
|-------|-----------|
| `smartcook_plan_meta` | `{ generado_en, fuente_datos, total_recetas_disponibles, total_dias }` |
| `smartcook_plan_dia_0` | JSON del primer día (`DiaPlanning`) |
| `smartcook_plan_dia_1` | JSON del segundo día |
| ... | Un registro por día hasta `total_dias - 1` |

## Caducidad
- `getPlanificacionHoy()` comprueba que `generado_en` sea de hoy (comparación año/mes/día)
- Si el plan es de un día anterior, se trata como si no existiera a efectos de confirm-overwrite

## Migración
- `migrateLegacyStorage()` (ejecutada una vez al montar `App`):
  1. Lee clave antigua `smartcook_planificacion`
  2. Si es válida, la convierte al formato multi-clave con `savePlanificacion()`
  3. Borra la clave antigua
  4. En caso de error de parseo, borra la clave antigua igualmente

## Fixes de Errores
- ✅ Error circular JSON: Limpieza de datos con `cleanDiaPlanning()`
- ✅ Error `.map is not a function`: Validación defensiva + eliminación de `void`
- ✅ Datos antiguos perdidos: Migración one-shot automática
