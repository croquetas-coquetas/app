# REVISION.md — SC-08: Restricción de duración en el algoritmo de planificación

> **Fecha de revisión:** 2026-04-28  
> **Revisado por:** Antigravity (asistente de código)  
> **Propuesta base:** `propuesta-restriccion-duracion.md`  
> **Archivos inspeccionados:** `server/API_planificacion.py`, `server/app.py`, `src/lib/planning.api.ts`, `src/types/planning.ts`, `src/App.tsx`, `server/test_unidad.py`, `server/datasets/smartCook.recetas.json`

---

## Resumen ejecutivo

La propuesta SC-08 está **parcialmente implementada**. El backend (Python) tiene todos los cambios propuestos correctamente codificados. El frontend (TypeScript/React) tiene **pendientes críticos**: no se ha añadido el tipo `Horarios`, no se envían horarios al backend, y `App.tsx` no gestiona los nuevos `error_code`. El dataset activo (`smartCook.recetas.json`) tampoco tiene el campo `duracion`, lo que hace que el filtro siempre se comporte como si todas las recetas duraran 0 minutos.

---

## Estado por archivo

### ✅ `server/API_planificacion.py` — COMPLETAMENTE IMPLEMENTADO

Todos los cambios propuestos están presentes y son correctos.

| Elemento propuesto | Estado | Observaciones |
|---|---|---|
| Clase `NoCompatibleRecipesError` con `error_code` y `turno` | ✅ | Líneas 29–35 |
| Clase `InsufficientRecipesAfterDurationFilterError` | ✅ | Líneas 38–39 |
| Helper `__duracion_receta` | ✅ | Líneas 184–187. Devuelve `0` si el campo no existe — correcto para retrocompatibilidad |
| Parámetros `duracion_max_comida` y `duracion_max_cena` en `planifica()` | ✅ | Líneas 357–358 |
| Parámetro `duracion_max` en `__selecciona_plato_con_cuotas` | ✅ | Línea 195 |
| Filtro estricto de duración dentro de `__selecciona_plato_con_cuotas` | ✅ | Líneas 241–242 |
| SC-08-3: Verificación temprana de catálogo insuficiente | ✅ | Líneas 383–397 |
| SC-08-2: Comprobación preventiva de pool vacío en el bucle | ✅ | Líneas 448–454 |
| `__diagnostica_conflicto` con los 4 códigos de error | ✅ | Líneas 307–352 |
| Paso de `duracion_max` por turno en el bucle `planifica()` | ✅ | Líneas 444–458 |

#### ⚠️ Problema menor — `pool_test` incompleto (SC-08-2)

La comprobación preventiva del pool vacío (líneas 448–452) aplica el filtro de recencia y el de duración, pero **no aplica el filtro de tags**. Esto significa que puede llegar al `__selecciona_plato_con_cuotas` y encontrar un pool vacío igualmente (si los tags lo bloquean todo), con lo que la excepción se lanzaría desde dentro del selector en lugar de desde la comprobación preventiva.

```python
# Actual (líneas 448-452):
pool_test = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
    and (duracion_max is None or self.__duracion_receta(r) <= duracion_max)
]
```

La propuesta también excluye tags del `pool_test` (y eso es aceptable, porque el TAG_CONFLICT se diagnostica igualmente en `__diagnostica_conflicto`). Sin embargo, si el pool queda vacío **solo por tags**, el código actual **no lanza** la excepción preventiva y en cambio `__selecciona_plato_con_cuotas` devolvería `candidatas = disponibles` (línea 269), eligiendo una receta aunque viole cuotas. Esto no es un bug nuevo de SC-08 — ya existía antes — pero conviene documentarlo.

---

### ✅ `server/app.py` — COMPLETAMENTE IMPLEMENTADO

| Elemento propuesto | Estado | Observaciones |
|---|---|---|
| Helper `_minutos_disponibles` | ✅ | Líneas 19–29 |
| Extracción de `horarios` e `ignorar_duracion` del body | ✅ | Líneas 40–41 |
| Lógica `ignorar_duracion` para anular restricción | ✅ | Línea 47: `not ignorar_duracion` en la condición |
| Llamada a `planifica()` con `duracion_max_comida/cena` | ✅ | Líneas 52–56 |
| Captura de `NoCompatibleRecipesError` → HTTP 409 con `error_code` | ✅ | Líneas 57–65 |
| Captura de `InsufficientRecipesAfterDurationFilterError` → HTTP 400 con `error_code` | ✅ | Líneas 66–73 |
| Orden correcto de los `except` (específico antes que genérico) | ✅ | `InsufficientRecipesAfterDurationFilterError` capturado antes de `InsufficientRecipesError` |
| Import de las nuevas excepciones | ✅ | Líneas 8–10 |

#### ⚠️ Problema — El método GET no admite horarios

La ruta acepta GET y POST. La extracción de `horarios` solo ocurre en la rama `if request.method == "POST" and request.is_json`. Si el usuario no tiene historial (primera generación), el frontend envía un GET (ver `planning.api.ts` línea 27), por lo que **nunca se aplica el filtro de duración en la primera planificación**.

```python
# app.py línea 37
if request.method == "POST" and request.is_json:
    body = request.get_json(silent=True) or {}
    ...
    horarios = body.get("horarios")   # solo en POST
```

La propuesta no menciona este escenario. Si los horarios solo deben aplicarse en la regeneración, está bien documentarlo. Si deben aplicarse también en la primera generación, hay que cambiar el frontend para usar POST siempre (o el backend para admitir horarios por query param en GET).

---

### ❌ `src/lib/planning.api.ts` — NO IMPLEMENTADO

El archivo sigue siendo el original. No se han aplicado ninguno de los cambios de la propuesta.

| Elemento propuesto | Estado | Observaciones |
|---|---|---|
| `duracion` en `cleanDiaPlanning` | ❌ Falta | Las recetas de `dias_previos` se envían sin `duracion` |
| Parámetro `horarios` en `fetchPlanificacionSemanal` | ❌ Falta | Nunca se envían horarios al backend |
| Parámetro `ignorarDuracion` en `fetchPlanificacionSemanal` | ❌ Falta | No existe la opción de reintentar sin filtro |
| Tipo `Horarios` importado o definido | ❌ Falta | El tipo no existe en ningún archivo del frontend |

El código actual siempre hace GET (sin cuerpo) en la primera generación y POST con `{ dias_previos }` en la regeneración, sin ningún campo `horarios`.

---

### ❌ `src/types/planning.ts` — NO IMPLEMENTADO

| Elemento propuesto | Estado | Observaciones |
|---|---|---|
| `duracion?: number` en `Receta` | ❌ Falta | El interface `Receta` no tiene el campo |
| Interface `Horarios` | ❌ Falta | No está definido en ningún archivo de tipos |

---

### ❌ `src/App.tsx` — NO IMPLEMENTADO

El manejo de errores en `doGenerate()` (líneas 88–91) es genérico: llama a `extractApiError` y muestra el string. No se distingue entre los distintos `error_code`. En concreto:

- No detecta `INSUFFICIENT_AFTER_DURATION_FILTER` → no muestra el botón "Generar sin límite de tiempo".
- No detecta `DURATION_CONFLICT`, `RECENCY_CONFLICT`, `TAG_CONFLICT`, `COMBINED_CONFLICT` → no muestra mensajes específicos.

---

### ⚠️ `server/datasets/smartCook.recetas.json` — CAMPO AUSENTE

```
Total recetas: 160
Con campo 'duracion': 0  ← ninguna tiene el campo
Sin campo 'duracion':   160
```

El helper `__duracion_receta` devuelve `0` cuando el campo no existe, lo que significa que **todas las recetas pasarán siempre el filtro** (0 ≤ cualquier duracion_max > 0). El filtro de duración es inoperativo con este dataset.

Existe un segundo dataset (`smartCook.recetas_bien.json`) con **345 recetas, todas con `duracion`**. Este parece ser el dataset "correcto" o de destino. El algoritmo usa `smartCook.recetas.json` por defecto.

> **Acción requerida:** Añadir el campo `duracion` a `smartCook.recetas.json` (migrando datos desde `recetas_bien.json` o añadiéndolo manualmente), o cambiar el path por defecto al dataset correcto.

---

### ⚠️ `server/test_unidad.py` — SIN TESTS PARA SC-08

Los tests existentes son sólidos para las restricciones de tags y recencia, pero **no cubren ningún comportamiento de SC-08**:

- No hay test que verifique que recetas con `duracion > duracion_max` son descartadas.
- No hay test para `NoCompatibleRecipesError` / `DURATION_CONFLICT`.
- No hay test para `InsufficientRecipesAfterDurationFilterError`.
- No hay test para el parámetro `ignorar_duracion`.

---

## Tabla resumen de hallazgos

| # | Archivo | Hallazgo | Severidad |
|---|---|---|---|
| 1 | `smartCook.recetas.json` | Campo `duracion` ausente en las 160 recetas del dataset activo | 🔴 Crítico |
| 2 | `src/lib/planning.api.ts` | No se envían `horarios` ni `ignorarDuracion` al backend | 🔴 Crítico |
| 3 | `src/types/planning.ts` | Faltan `duracion?: number` en `Receta` e interface `Horarios` | 🔴 Crítico |
| 4 | `src/App.tsx` | No se gestionan los nuevos `error_code` ni el botón de fallback | 🟠 Alto |
| 5 | `app.py` | GET no admite horarios → primera generación nunca filtra por duración | 🟡 Medio |
| 6 | `API_planificacion.py` | `pool_test` no aplica filtro de tags → TAGs bloqueantes no activan diagnóstico preventivo | 🟡 Medio (pre-existente) |
| 7 | `test_unidad.py` | Sin tests para ningún comportamiento de SC-08 | 🟡 Medio |

---

## Pendientes concretos

### Backend (Python)

- [ ] **Añadir `duracion` al dataset** `smartCook.recetas.json` (o cambiar el path al `recetas_bien.json`). Sin esto el filtro es inoperativo.
- [ ] **Decidir si el GET también aplica horarios** y, si procede, convertir el primer fetch en POST o aceptar horarios como query param.

### Frontend (TypeScript)

- [ ] **`src/types/planning.ts`**: añadir `duracion?: number` a `Receta` y definir el interface `Horarios`:
  ```ts
  export interface Horarios {
    comida?: { inicio: string; fin: string };
    cena?:   { inicio: string; fin: string };
  }
  ```
- [ ] **`src/lib/planning.api.ts`**: añadir `duracion` en `cleanDiaPlanning` y los parámetros `horarios` e `ignorarDuracion` en `fetchPlanificacionSemanal`. Leer los horarios de `localStorage` (clave `STORAGE_HORARIOS`) antes de llamar al API.
- [ ] **`src/App.tsx`**: en `doGenerate()`, leer `error_code` de la respuesta de error y ramificar:
  - `INSUFFICIENT_AFTER_DURATION_FILTER` → mostrar mensaje + botón "Generar sin límite de tiempo" que reenvíe con `ignorarDuracion: true`.
  - `DURATION_CONFLICT` / `COMBINED_CONFLICT` → mensaje específico sugiriendo ampliar la franja horaria.
- [ ] **`src/lib/planning.constants.ts`**: definir y exportar `STORAGE_HORARIOS` para persistir los horarios del usuario (clave de localStorage de SC-07).

### Tests

- [ ] **`server/test_unidad.py`**: añadir una clase `TestDuracion` que cubra:
  - Recetas con `duracion > max` son excluidas de la planificación.
  - `NoCompatibleRecipesError` con `DURATION_CONFLICT` cuando todas las recetas superan el límite.
  - `InsufficientRecipesAfterDurationFilterError` cuando el catálogo filtrado es insuficiente.
  - `planifica()` sin `duracion_max_*` es idéntico al comportamiento actual (retrocompatibilidad).

---

## Lo que está bien

- La jerarquía de excepciones es correcta y retrocompatible (`InsufficientRecipesAfterDurationFilterError` hereda de `InsufficientRecipesError`, que hereda de `PlanningError`). Los `except` genéricos existentes siguen capturando las nuevas.
- El helper `__duracion_receta` con fallback a `0` es la estrategia correcta para compatibilidad con recetas sin el campo.
- El orden de `except` en `app.py` es correcto (específico → genérico).
- La lógica de SC-08-3 en `planifica()` es correcta: usa `or` (no `and`) al comprobar si una receta es viable para alguno de los dos turnos, lo cual es más permisivo y evita falsos positivos.
- El flag `ignorar_duracion` en `app.py` está bien implementado: anula ambos umbrales antes de pasarlos al algoritmo.
