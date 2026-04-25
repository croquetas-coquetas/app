# SC-08 — Propuesta: Restricción de duración en el algoritmo de planificación

## Contexto

Cada receta de la BD tiene un campo `duracion` (entero, minutos). El usuario configura sus franjas horarias en SC-07 (`comida.inicio/fin` y `cena.inicio/fin`). El tiempo disponible por turno es `fin - inicio` en minutos.

**Ejemplo con valores por defecto:**
- Comida: `13:00` → `14:30` = **90 minutos disponibles**
- Cena: `20:00` → `21:00` = **60 minutos disponibles**

El algoritmo debe garantizar que cada plato asignado a un turno cumpla `duracion ≤ minutos_disponibles` para ese turno. Los criterios de aceptación introducen además diagnóstico de conflictos, recuperación ante catálogo insuficiente y comportamiento por defecto sin preferencias guardadas.

---

## SC-08-1 — Filtro estricto por duración

> Cuando el sistema busque platos para la planificación semanal, si el usuario ha definido un rango de tiempo para la comida, entonces el sistema incluye **exclusivamente** recetas cuya duración sea ≤ al tiempo configurado para **todos** los días del periodo.

### Comportamiento
- El filtro de duración es **obligatorio** (no degradación suave) cuando el usuario tiene horarios guardados.
- Se aplica **antes** de los filtros de tags y recencia porque reduce el pool lo antes posible.
- `comida` y `cena` tienen sus propios umbrales independientes.
- Si el campo `duracion` no existe en una receta, se trata como `0` (siempre pasa), para compatibilidad con la BD anterior.

### Cambios

**`server/API_planificacion.py`** — Nuevo helper privado:
```python
def __duracion_receta(self, receta: dict[str, Any]) -> int:
    duracion = receta.get("duracion")
    return int(duracion) if isinstance(duracion, (int, float)) and duracion >= 0 else 0
```

Nuevos parámetros en `planifica()` (retrocompatible: `None` = sin restricción):
```python
def planifica(
    self,
    dias_previos: list[dict[str, Any]] | None = None,
    duracion_max_comida: int | None = None,
    duracion_max_cena:   int | None = None,
) -> dict[str, Any]:
```

Nuevo parámetro en `__selecciona_plato_con_cuotas` y primera criba sobre `disponibles`:
```python
def __selecciona_plato_con_cuotas(
    self,
    recetas: list[dict[str, Any]],
    ids_recientes: deque[str],
    conteo: dict[str, int],
    plato_k: int,
    duracion_max: int | None = None,  # nuevo
) -> dict[str, Any]:

    # 1. Filtro de recencia (ya existente)
    disponibles = [r for r in recetas if self.__identificador_receta(r) not in ids_recientes]
    if not disponibles:
        disponibles = list(recetas)

    # 2. Filtro estricto de duración (SC-08-1)
    if duracion_max is not None:
        disponibles = [r for r in disponibles if self.__duracion_receta(r) <= duracion_max]
        # Si queda vacío, SC-08-2 lo habrá detectado antes de llegar aquí

    # 3. Filtros de tags (sin cambios)
    ...
```

En el bucle de generación de `planifica()`, pasar el límite del turno activo:
```python
for turno in ("comida", "cena"):
    duracion_max = duracion_max_comida if turno == "comida" else duracion_max_cena
    plato = self.__selecciona_plato_con_cuotas(
        recetas, ids_recientes, conteo_ventana, plato_k, duracion_max
    )
```

**`server/app.py`** — Función auxiliar y extracción del body:
```python
def _minutos_disponibles(rango: dict | None) -> int | None:
    if not isinstance(rango, dict):
        return None
    try:
        h1, m1 = map(int, rango["inicio"].split(":"))
        h2, m2 = map(int, rango["fin"].split(":"))
        minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
        return minutos if minutos > 0 else None
    except (KeyError, ValueError, TypeError):
        return None

# En weekly_planning():
horarios = body.get("horarios")
duracion_max_comida = _minutos_disponibles(horarios.get("comida")) if isinstance(horarios, dict) else None
duracion_max_cena   = _minutos_disponibles(horarios.get("cena"))   if isinstance(horarios, dict) else None
```

**`src/lib/planning.api.ts`** — Preservar `duracion` en `cleanDiaPlanning` y enviar `horarios`:
```ts
// En cleanDiaPlanning:
comida: { ..., duracion: dia.comida.duracion },
cena:   { ..., duracion: dia.cena.duracion   },

// En fetchPlanificacionSemanal (nuevo parámetro):
export async function fetchPlanificacionSemanal(
  diasPrevios?: DiaPlanning[] | null,
  horarios?: Horarios | null,
) {
  const body: Record<string, unknown> = {};
  if (diasPrevios?.length) body.dias_previos = diasPrevios.map(cleanDiaPlanning);
  if (horarios)            body.horarios = horarios;
  return fetch(API_URL, { method: "POST", ... body: JSON.stringify(body) });
}
```

**`src/types/planning.ts`** — Añadir campo:
```ts
export interface Receta {
  ...
  duracion?: number;  // minutos
}
```

---

## SC-08-2 — Diagnóstico de conflicto

> Si la combinación de restricciones no produce ningún plato compatible, el sistema identifica cuál restricción es la bloqueante y muestra un mensaje específico.

### Comportamiento
- Cuando el pool de candidatas para un turno queda **vacío tras aplicar todos los filtros**, se lanza un error con diagnóstico antes de intentar elegir.
- El diagnóstico prueba cada restricción por separado para identificar cuál (o cuáles combinadas) provoca el bloqueo.
- El error incluye un `error_code` legible por máquina para que el frontend muestre mensajes específicos.

### Nueva excepción — `server/API_planificacion.py`

```python
class NoCompatibleRecipesError(PlanningError):
    """No hay recetas compatibles con las restricciones activas para un turno concreto."""
    def __init__(self, message: str, error_code: str, turno: str):
        super().__init__(message)
        self.error_code = error_code  # "DURATION_CONFLICT" | "TAG_CONFLICT" | "RECENCY_CONFLICT" | "COMBINED_CONFLICT"
        self.turno = turno            # "comida" | "cena"
```

### Nuevo método de diagnóstico privado — `server/API_planificacion.py`

```python
def __diagnostica_conflicto(
    self,
    recetas: list[dict[str, Any]],
    ids_recientes: deque[str],
    conteo: dict[str, int],
    duracion_max: int | None,
    turno: str,
) -> NoCompatibleRecipesError:
    # ¿La duración sola bloquea?
    if duracion_max is not None:
        por_duracion = [r for r in recetas if self.__duracion_receta(r) <= duracion_max]
        if not por_duracion:
            return NoCompatibleRecipesError(
                f"No hay recetas con duración ≤ {duracion_max} min para la {turno}. "
                "Amplía tu franja horaria o genera sin límite de tiempo.",
                error_code="DURATION_CONFLICT",
                turno=turno,
            )

    # ¿La recencia sola bloquea?
    sin_recencia = [r for r in recetas if self.__identificador_receta(r) not in ids_recientes]
    if not sin_recencia:
        return NoCompatibleRecipesError(
            f"Todos los platos disponibles para la {turno} han sido usados recientemente.",
            error_code="RECENCY_CONFLICT",
            turno=turno,
        )

    # ¿Los tags solos bloquean?
    bloqueados = {g for g, c in CUOTAS.items() if conteo.get(g, 0) >= c["max"]}
    sin_tags = [r for r in recetas if not all(t in bloqueados for t in self.__tags_nutricionales(r))]
    if not sin_tags:
        return NoCompatibleRecipesError(
            f"Las cuotas nutricionales no permiten más platos para la {turno}.",
            error_code="TAG_CONFLICT",
            turno=turno,
        )

    # Conflicto combinado
    return NoCompatibleRecipesError(
        f"La combinación de franja horaria, historial reciente y cuotas nutricionales "
        f"no deja ningún plato disponible para la {turno}.",
        error_code="COMBINED_CONFLICT",
        turno=turno,
    )
```

### Dónde se llama — `planifica()`, antes de `__selecciona_plato_con_cuotas`

```python
# Comprobación preventiva de pool vacío (SC-08-2)
pool_test = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
    and (duracion_max is None or self.__duracion_receta(r) <= duracion_max)
]
if not pool_test:
    raise self.__diagnostica_conflicto(recetas, ids_recientes, conteo_ventana, duracion_max, turno)

plato = self.__selecciona_plato_con_cuotas(recetas, ids_recientes, conteo_ventana, plato_k, duracion_max)
```

### Respuesta HTTP — `server/app.py`

```python
except NoCompatibleRecipesError as exc:
    return jsonify({
        "error": str(exc),
        "error_code": exc.error_code,
        "turno": exc.turno,
    }), 409
```

### Reacción en el frontend

`App.tsx` (o quien gestione el error): leer `error_code` de la respuesta y renderizar un mensaje contextualizado en lugar del texto genérico.

---

## SC-08-3 — Catálogo insuficiente con restricción de duración

> Si el catálogo de recetas compatibles se agota antes de cubrir los 7 días, informar al usuario y permitir generar **sin restricciones de tiempo**.

### Comportamiento
- Ocurre cuando hay recetas que cumplen la restricción de duración, pero **no hay suficientes** para cubrir 14 platos sin repetir.
- Distinto a SC-08-2 (donde no hay ninguna receta para un turno concreto) y al `InsufficientRecipesError` genérico (BD vacía).
- El frontend muestra el mensaje y un botón **"Generar sin límite de tiempo"** que repite la petición con `ignorar_duracion: true`.

### Nueva excepción — `server/API_planificacion.py`

```python
class InsufficientRecipesAfterDurationFilterError(InsufficientRecipesError):
    """Hay recetas en la BD pero no las suficientes tras aplicar el filtro de duración."""
```

### Dónde se lanza — `planifica()`, antes del bucle principal

```python
# Si hay restricciones de duración, comprobar que queden suficientes recetas únicas
if duracion_max_comida is not None or duracion_max_cena is not None:
    ids_viables = {
        self.__identificador_receta(r)
        for r in recetas
        if self.__duracion_receta(r) <= (duracion_max_comida or float("inf"))
        or self.__duracion_receta(r) <= (duracion_max_cena   or float("inf"))
    }
    if len(ids_viables) < self.__TOTAL_PLATOS:
        raise InsufficientRecipesAfterDurationFilterError(
            "No hay suficiente variedad de recetas dentro de tu franja horaria para completar "
            "los 7 días. Puedes ampliar tu disponibilidad o generar sin límite de tiempo."
        )
```

### Parámetro de escape — `server/app.py`

```python
ignorar_duracion = body.get("ignorar_duracion", False)
if ignorar_duracion:
    duracion_max_comida = None
    duracion_max_cena   = None
```

### Respuesta HTTP — `server/app.py`

```python
except InsufficientRecipesAfterDurationFilterError as exc:
    return jsonify({
        "error": str(exc),
        "error_code": "INSUFFICIENT_AFTER_DURATION_FILTER",
    }), 400
```

### Reacción en el frontend

Al recibir `error_code == "INSUFFICIENT_AFTER_DURATION_FILTER"`:
- Mostrar el mensaje recibido.
- Mostrar botón **"Generar sin límite de tiempo"** que reenvía la misma petición añadiendo `ignorar_duracion: true` al body.

**`src/lib/planning.api.ts`** — Añadir parámetro `ignorarDuracion`:
```ts
export async function fetchPlanificacionSemanal(
  diasPrevios?: DiaPlanning[] | null,
  horarios?: Horarios | null,
  ignorarDuracion?: boolean,
) {
  const body: Record<string, unknown> = {};
  if (diasPrevios?.length)  body.dias_previos     = diasPrevios.map(cleanDiaPlanning);
  if (horarios)             body.horarios          = horarios;
  if (ignorarDuracion)      body.ignorar_duracion  = true;
  ...
}
```

---

## SC-08-4 — Valores por defecto sin preferencias guardadas

> Si el sistema detecta la ausencia de datos de preferencias, aplica los valores por defecto (7 días y sin límite de tiempo) para procesar la solicitud.

### Comportamiento
- Si `localStorage` no contiene `STORAGE_HORARIOS` o el JSON no es válido → `horarios` no se incluye en la petición.
- Si el backend recibe el body sin `horarios` → `duracion_max_comida = None`, `duracion_max_cena = None` → sin filtro de duración.
- Los 7 días son el valor fijo `DIAS_TOTALES` ya existente, no cambia nada.

### Cambios

**`src/lib/planning.api.ts`**: la ausencia de `horarios` en el body ya es el comportamiento natural del código propuesto en SC-08-1 (`if (horarios) body.horarios = horarios`). Si `horarios` es `null`/`undefined`, no se añade al body y el backend opera sin restricción de duración.

**`server/app.py`**: ningún cambio adicional — `body.get("horarios")` devuelve `None` si no viene, lo que ya da `duracion_max_* = None`.

---

## Resumen de cambios por archivo

| Archivo | Cambios |
|---|---|
| `src/types/planning.ts` | `duracion?: number` en `Receta` |
| `src/lib/planning.api.ts` | `duracion` en `cleanDiaPlanning`; parámetros `horarios` e `ignorarDuracion` en `fetchPlanificacionSemanal` |
| `server/app.py` | Helper `_minutos_disponibles`; extracción de `horarios` e `ignorar_duracion`; captura de `NoCompatibleRecipesError` e `InsufficientRecipesAfterDurationFilterError` con `error_code` |
| `server/API_planificacion.py` | Nuevas excepciones; parámetros `duracion_max_*` en `planifica()`; comprobación temprana SC-08-3; verificación preventiva SC-08-2 con diagnóstico; helper `__duracion_receta`; filtro en `__selecciona_plato_con_cuotas` |
| `src/App.tsx` (gestión de errores) | Leer `error_code`; mensajes específicos por tipo; botón "Generar sin límite de tiempo" para `INSUFFICIENT_AFTER_DURATION_FILTER` |

---

## Qué NO cambia

- La lógica de restricción de tags (ventana deslizante de 7 días) permanece intacta.
- La restricción de repetición de platos (14 días) permanece intacta.
- La firma de `planifica()` es completamente retrocompatible: sin `duracion_max_*` el comportamiento es idéntico al actual.
- Las nuevas excepciones heredan de las existentes (`PlanningError`, `InsufficientRecipesError`), por lo que cualquier `except PlanningError` existente sigue capturándolas.
- Recetas sin campo `duracion` en la BD reciben `duracion = 0` → siempre pasan el filtro.
