# REVISIÓN DEL CICLO DE VIDA — SmartCook Planning

## 1. Visión General

La funcionalidad de planificación genera 7 días de menú (comida + cena = 14 platos) respetando:

- **CUOTAS nutricionales**: cada ventana de 7 días consecutivos debe cumplir los rangos definidos por grupo alimenticio.
- **No repetición en 14 días**: un mismo plato no puede aparecer dos veces en ninguna ventana de 14 días naturales.
- **Historial**: al regenerar, se respetan los días ya consumidos para que los bloques de 7 días solapados (ventana deslizante) también cumplan las cuotas.

---

## 2. Ciclo completo — Primera generación (sin historial)

```
Usuario             App.tsx              planning.api.ts       Flask (app.py)       API_planificacion.py
   │                   │                       │                      │                      │
   │── Get Started ──► │                       │                      │                      │
   │                   │ setAppState("generate")                      │                      │
   │── "Generar" ────► │                       │                      │                      │
   │                   │ handleRequestGenerate()                       │                      │
   │                   │ getPlanificacionHoy() ←→ localStorage         │                      │
   │                   │   ─→ null (sin plan de hoy)                  │                      │
   │                   │ doGenerate()                                  │                      │
   │                   │  cargarPlanificacion() → null                 │                      │
   │                   │  getDiasPrevios(null)  → []                   │                      │
   │                   │──── fetchPlanificacionSemanal(undefined) ────►│                      │
   │                   │       GET /api/planificacion/semanal/         │                      │
   │                   │                                               │── weekly_planning() ─►│
   │                   │                                               │   dias_previos=None   │
   │                   │                                               │                      │── planifica(None)
   │                   │                                               │                      │   __carga_recetas()      [160 recetas del JSON]
   │                   │                                               │                      │   ids_recientes deque(maxlen=28)  ← vacío
   │                   │                                               │                      │   conteo_ventana = {g:0 for g in CUOTAS}
   │                   │                                               │                      │   ventana_dias deque(maxlen=7)     ← vacío
   │                   │                                               │                      │
   │                   │                                               │                      │   for i in 0..6:        [7 días]
   │                   │                                               │                      │     for turno in comida,cena:
   │                   │                                               │                      │       __selecciona_plato_con_cuotas(...)
   │                   │                                               │                      │         clasifica grupos: urgentes/bloqueados/críticos
   │                   │                                               │                      │         filtra disponibles (no en ids_recientes)
   │                   │                                               │                      │         puntúa candidatas (score = bonus_min − penalidad_max)
   │                   │                                               │                      │         elige al azar entre las de mayor score
   │                   │                                               │                      │       ids_recientes.append(id_plato)  [id = str(_id_dict)]
   │                   │                                               │                      │       conteo_ventana[tag] += 1
   │                   │                                               │                      │     ventana_dias.append(dia_nuevo)
   │                   │                                               │                      │
   │                   │                                               │                      │   Retorna {generado_en, fuente_datos, total_recetas_disponibles, dias:[7]}
   │                   │                                               │◄─── jsonify(plan) ───│
   │                   │◄──────── Response 200 JSON ─────────────────│                      │
   │                   │  parsePlanificacionResponse(res)              │                      │
   │                   │  savePlanificacion(data)                      │                      │
   │                   │    clearPlanKeys()                            │                      │
   │                   │    localStorage.setItem(smartcook_plan_dia_0..6, JSON)               │
   │                   │    localStorage.setItem(smartcook_plan_meta, {generado_en,...})       │
   │                   │  setPlanificacion(data)                       │                      │
   │                   │  setAppState("success")                       │                      │
   └── CalendarView ◄──┘                                               │                      │
```

---

## 3. Ciclo completo — Re-generación (con historial)

```
Escenario: Plan generado el día 1 (cubre días 1–7). El día 4 el usuario regenera.
Los días 1, 2, 3 están "en el pasado" (fecha < hoy).
```

```
Usuario             App.tsx              planning.utils.ts    planning.api.ts      Flask / API_planificacion
   │                   │                       │                    │                       │
   │── "Generar" ────► │                       │                    │                       │
   │                   │ doGenerate()           │                    │                       │
   │                   │  cargarPlanificacion() │                    │                       │
   │                   │    ← {dias:[7], generado_en:dia1}          │                       │
   │                   │  getDiasPrevios(plan)  │                    │                       │
   │                   │───────────────────────►│                    │                       │
   │                   │                        │ filtra plan.dias donde fecha < hoy         │
   │                   │                        │  → [dia1, dia2, dia3]  (3 días pasados)    │
   │                   │◄────────── [dia1, dia2, dia3] ─────────────│                       │
   │                   │  fetchPlanificacionSemanal([dia1,dia2,dia3])│                       │
   │                   │───────────────────────────────────────────►│                       │
   │                   │  cleanDiaPlanning(dia) por cada día         │                       │
   │                   │    { dia, comida:{nombre,grupo_principal,   │                       │
   │                   │      ingredientes,pasos,tags}, cena:{...} } │                       │
   │                   │  POST /api/planificacion/semanal/           │                       │
   │                   │  Body: { "dias_previos": [dia1clean, dia2clean, dia3clean] }         │
   │                   │                                             │── weekly_planning() ──►│
   │                   │                                             │   dias_previos = [3 días]
   │                   │                                             │                       │── planifica(dias_previos)
   │                   │                                             │                       │   __carga_recetas()   [160 recetas]
   │                   │                                             │                       │   ids_recientes (maxlen=28) ← vacío
   │                   │                                             │                       │   conteo_ventana = {g:0 ...}
   │                   │                                             │                       │   ventana_dias (maxlen=7)  ← vacío
   │                   │                                             │                       │
   │                   │                                             │                       │   # Carga historial
   │                   │                                             │                       │   for dia in dias_previos [3]:
   │                   │                                             │                       │     ids_recientes.append( __identificador_receta(plato) )
   │                   │                                             │                       │     # identificador = nombre  (sin _id en previos)
   │                   │                                             │                       │
   │                   │                                             │                       │   # Carga últimos min(3,7)=3 días en ventana
   │                   │                                             │                       │   for dia in dias_previos[-7:] [3]:
   │                   │                                             │                       │     ventana_dias.append(dia)
   │                   │                                             │                       │     conteo_ventana[tag] += 1
   │                   │                                             │                       │
   │                   │                                             │                       │   plato_k = 1
   │                   │                                             │                       │   for i in 0..6:
   │                   │                                             │                       │     [si ventana llena (len==7): expulsa el más antiguo, resta sus tags]
   │                   │                                             │                       │     for turno comida, cena:
   │                   │                                             │                       │       __selecciona_plato_con_cuotas(recetas, ids_recientes, conteo_ventana, plato_k)
   │                   │                                             │                       │         disponibles = [r for r in recetas if id(r) NOT IN ids_recientes]
   │                   │                                             │                       │         # id(r) = str({"$oid":"..."})  ← identifier de receta JSON
   │                   │                                             │                       │         # id(previo) = nombre          ← identifier de plato previo
   │                   │                                             │                       │         # → MISMATCH: platos previos NO se excluyen del pool
   │                   │                                             │                       │       ids_recientes.append( id(nuevo_plato) )  [= str({_id dict})]
   │                   │                                             │                       │       conteo_ventana[tag] += 1
   │                   │                                             │                       │     ventana_dias.append(dia_nuevo)
   │                   │                                             │                       │     planificacion["dias"].append(dia_nuevo)
   │                   │                                             │                       │
   │                   │                                             │                       │   # Combina previos + nuevos, recorta a 14 días
   │                   │                                             │                       │   todos = list(dias_previos) + planificacion["dias"]
   │                   │                                             │                       │   if len(todos) > 14: todos = todos[-14:]
   │                   │                                             │                       │   planificacion["dias"] = todos  [= 10 días: 3 + 7]
   │                   │                                             │                       │   return planificacion
   │                   │                                          200 JSON {dias:[10 días]} ◄─│
   │                   │  savePlanificacion(data)  → localStorage total_dias=10             │
   │                   │  setPlanificacion(data)                     │                       │
   └── CalendarView (10 días) ◄────────────────────────────────────┘                       │
```

---

## 4. Detalle de funciones clave

### 4.1 Frontend — `getDiasPrevios` (`planning.utils.ts`)

```typescript
export function getDiasPrevios(plan: Planificacion | null): DiaPlanning[] {
  if (!plan) return [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return plan.dias.filter((d) => new Date(d.dia).setHours(0,0,0,0) < hoy.getTime());
}
```

- Filtra días cuya fecha UTC (interpretada en zona local) es estrictamente anterior a hoy a medianoche.
- **No limita a 14 días explícitamente**, pero el plan almacenado nunca supera 14 días (la API lo recorta), así que en práctica se pasan ≤ 13 días pasados máximo.
- Los días de _hoy_ y futuros no se incluyen como `dias_previos`. Si el usuario regenera el mismo día que generó, `previos = []` → se hace GET y la planificación es completamente nueva.

### 4.2 Frontend — `cleanDiaPlanning` (`planning.api.ts`)

```typescript
function cleanDiaPlanning(dia: DiaPlanning): DiaPlanning {
  return {
    dia: dia.dia,
    comida: { nombre, grupo_principal, ingredientes, pasos, tags },
    cena:   { nombre, grupo_principal, ingredientes, pasos, tags },
  };
}
```

- Envía solo los campos del tipo `Receta` de TypeScript: **no se incluye `_id` ni `id`**.
- Esto hace que los platos previos lleguen al backend SIN identificador de base de datos.

### 4.3 Backend — `__identificador_receta` (`API_planificacion.py`)

```python
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    for clave in ("_id", "id", "nombre"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)
```

- Para recetas del JSON: `_id = {"$oid": "69b14..."}` (dict) → `str({"$oid":"..."})` = `"{'$oid': '69b14...'}"`.
- Para platos previos del frontend: `_id = None`, `id = None`, `nombre = "Paella valenciana"` → `"Paella valenciana"`.
- **Los identificadores de los dos tipos de objeto son incompatibles.**

### 4.4 Backend — `planifica()` — Inicialización con historial

```python
if dias_previos:
    for dia in dias_previos:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                ids_recientes.append(self.__identificador_receta(plato))
                # ↑ añade "Paella valenciana" (nombre)

    for dia in dias_previos[-7:]:
        ventana_dias.append(dia)
        for turno in ...:
            for tag in self.__tags_nutricionales(plato):
                conteo_ventana[tag] += 1
```

- `ids_recientes` queda con identificadores tipo `nombre` (string).

### 4.5 Backend — `planifica()` — Bucle de generación

```python
disponibles = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
]
# __identificador_receta(r) = "{'$oid': '...'}"   (clave de receta JSON)
# ids_recientes contiene  = "Paella valenciana"    (nombre de previo)
# → NUNCA hay match → todos los platos previos siguen en el pool
```

- El filtro de no-repetición **no funciona** para platos que provienen de `dias_previos`.

### 4.6 Backend — Ventana deslizante (`conteo_ventana`)

La ventana de 7 días se gestiona con un `deque(maxlen=7)`:

```
Antes del día i:
  if len(ventana_dias) == 7:
      dia_expulsado = ventana_dias[0]   # el más antiguo
      conteo_ventana[tag] -= 1 por cada tag del expulsado

[genera comida y cena del día i, suma sus tags a conteo_ventana]

ventana_dias.append(dia_nuevo)  # auto-expulsa ventana_dias[0] si full
```

- Funciona correctamente para el conteo de cuotas.
- No está afectado por el bug de identificadores.

### 4.7 Backend — Respuesta combinada

```python
if dias_previos:
    todos_los_dias = list(dias_previos) + planificacion["dias"]
    max_dias = self.__DIAS_TOTALES * 2  # = 14
    if len(todos_los_dias) > max_dias:
        todos_los_dias = todos_los_dias[-max_dias:]
    planificacion["dias"] = todos_los_dias
```

- El plan devuelto incluye los días previos (tal como los envió el frontend) **más** los 7 nuevos generados.
- Se recorta a 14 días máximo.
- Los días previos devueltos no tienen `_id` (los nuevos sí en formato `{"$oid":"..."}`).

### 4.8 Frontend — `savePlanificacion` (`planning.storage.ts`)

```typescript
clearPlanKeys();
planificacion.dias.forEach((dia, i) => {
    localStorage.setItem(`smartcook_plan_dia_${i}`, JSON.stringify(dia));
});
localStorage.setItem("smartcook_plan_meta", JSON.stringify({
    generado_en, fuente_datos:"api",
    total_recetas_disponibles: dias.length * 2,
    total_dias: dias.length
}));
```

- Borra todas las claves del plan anterior.
- Guarda cada día por índice.
- `total_recetas_disponibles` se calcula como `dias.length * 2`, que en realidad guarda el número de platos generados (no el número de recetas disponibles, que son 160). Es incorrecto semánticamente pero no afecta a la lógica de la app.

### 4.9 Flujo de confirmación (overwrite guard)

Antes de regenerar, `handleRequestGenerate()` llama a `getPlanificacionHoy()`, que compara `generado_en` con la fecha local de hoy. Si la planificación fue generada hoy (mismo día), muestra `ConfirmOverwriteState` pidiendo confirmación. Si fue generada en un día anterior, llama directamente a `doGenerate()`.

---

## 5. Cuotas y ventana deslizante — Comportamiento esperado

```
CUOTAS = {
    "verdura":    {"min": 7, "max": 14},
    "lácteo":     {"min": 2, "max": 5},
    "cereal":     {"min": 3, "max": 7},
    "legumbre":   {"min": 1, "max": 4},
    "fruto seco": {"min": 0, "max": 3},
    "pescado":    {"min": 2, "max": 5},
    "huevo":      {"min": 1, "max": 4},
    "carne":      {"min": 2, "max": 6},
}
```

Para toda ventana de 7 días consecutivos (ventana deslizante) que incluya días generados, el conteo de cada grupo debe estar dentro de `[min, max]`.

Si el usuario generó el día 1 (cubre 1–7) y el día 4 regenera:
- La ventana [1–7] ya cumplía al haberse generado.
- Las nuevas ventanas [2–8], [3–9], [4–10] deben también cumplir.
- El algoritmo construye la ventana deslizante con `conteo_ventana` y la actualiza día a día.

---

## 6. No repetición en 14 días

El algoritmo mantiene `ids_recientes = deque(maxlen=28)` (28 platos = 14 días × 2 comidas/día). Antes de seleccionar cada nuevo plato se filtran las recetas que ya están en este deque. Al añadir un nuevo plato, si el deque estaba lleno (28), el más antiguo se elimina.

En una generación **sin previos**: el deque empieza vacío. Los 14 platos nuevos se van añadiendo y el deque crece hasta 14. No hay oportunidad de repetición intra-semana.

En una regeneración **con previos**: los platos de `dias_previos` llenan parcialmente el deque. Al generar los 7 nuevos días (14 platos), los más antiguos del deque empiezan a caer si la suma supera 28.

---

## 7. Fallos encontrados

### FALLO 1 — CRÍTICO: Identificadores incompatibles en regeneración

**Archivo**: `server/API_planificacion.py` → `__identificador_receta`
**También afecta**: `server/prueba_regen.py` → `obtener_id_plato`

**Descripción**:

`__identificador_receta` usa `_id` como primera clave. Para recetas del JSON local, `_id` es un dict `{"$oid": "..."}` (formato MongoDB Extended JSON), cuyo `str()` produce `"{'$oid': '69b147433c726bcbda04d474'}"`. Para platos previos enviados por el frontend, no viene `_id` (porque `cleanDiaPlanning` no lo incluye y el tipo `Receta` de TypeScript no lo define), así que el identificador cae a `nombre` → `"Paella valenciana"`.

Consecuencia: cuando el algoritmo filtra `disponibles = [r for r in recetas if id(r) NOT IN ids_recientes]`, las claves de `recetas` son del tipo `"{'$oid': '...'}"` y las de `ids_recientes` (cargadas desde previos) son del tipo `nombre`. **Nunca coinciden**, por lo que todos los platos previos permanecen disponibles en el pool y se pueden repetir.

**Impacto medido**: ~30 % de las regeneraciones contienen al menos un plato repetido respecto a los días previos.

**Detalle técnico**:

```
Identifier de "Paella valenciana" en receta JSON:
  receta["_id"] = {"$oid": "69b147433c726bcbda04d474"}  (dict)
  str({"$oid": "..."}) = "{'$oid': '69b147433c726bcbda04d474'}"

Identifier del mismo plato enviado como dia_previo por el frontend:
  plato["_id"] = None   (no viene)
  plato["id"]  = None   (no viene)
  plato["nombre"] = "Paella valenciana"
  → identifier = "Paella valenciana"
```

Los dos strings son distintos → el filtro no actúa.

---

### FALLO 2 — DERIVADO: La validación de `prueba_regen.py` no detecta el fallo anterior

**Archivo**: `server/prueba_regen.py` → `obtener_id_plato`

**Descripción**:

`obtener_id_plato` tiene la misma lógica de prioridad de claves que `__identificador_receta`. La planificación devuelta por el API incluye días previos (sin `_id`, con identificador `nombre`) y nuevos días (con `_id` dict, identificador `"{'$oid':'...'}""`). Al comparar un plato previo con un plato nuevo, los identificadores nunca coinciden aunque sean la misma receta.

**Impacto medido**: `prueba_regen.py` reporta **100 % de éxito** en modo con historial cuando la tasa real de repeticiones es ~30 %. La validación es completamente ciega a este tipo de fallo.

---

### FALLO 3 — MENOR: `total_recetas_disponibles` en metadatos de almacenamiento

**Archivo**: `src/lib/planning.storage.ts` → `savePlanificacion`

```typescript
total_recetas_disponibles: planificacion.dias.length * 2,
```

Guarda el número de platos generados (ej. 14 o 20) en vez del número de recetas disponibles en la base de datos (160). Es semánticamente incorrecto aunque no afecta a ninguna lógica de la aplicación. El campo solo se usa en `PlanMeta` para reconstruir `total_dias` (que era el literal `dias.length`).

---

### FALLO 4 — MENOR: `DIAS_REGEN=1` en `prueba_regen.py` infravalora el escenario real

**Archivo**: `server/prueba_regen.py`

La constante `DIAS_REGEN = 1` hace que el script de prueba siempre pase un único día como historial, cuando en la aplicación real el usuario puede generar con hasta 13 días de historial. Esto hace que el test de regeneración no cubra los escenarios con más días previos donde el impacto del Fallo 1 es aún mayor.

---

### FALLO 5 — MENOR: `prueba_regen.py` pasa los primeros días (más antiguos) en lugar de simular comportamiento real del frontend

**Archivo**: `server/prueba_regen.py` → `prueba_con_historial`

```python
dias_a_pasar = planificacion_anterior["dias"][:dias_regen]
```

El script guarda `planificacion_anterior = planificacion_nueva["dias"][-7:]` (los 7 últimos días del nuevo plan) y luego pasa los primeros `dias_regen` de esos 7. En la app real, el frontend filtra días con `fecha < hoy`; los días pasados son los del inicio del plan, lo cual coincide accidentalmente con `[:dias_regen]` en este test. Sin embargo, simula siempre una regeneración "inmediata" (solo 1 día pasado con el defecto), sin representar escenarios intermedios ni el uso acumulado de hasta 14 días de historial.
