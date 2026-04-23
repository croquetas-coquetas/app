# ARREGLOS — SmartCook Planning

## Resumen de cambios

Se corrigieron **2 fallos** detectados durante la revisión. Ambos estaban causados por la misma raíz: la función que genera el identificador único de un plato priorizaba la clave `_id` sobre `nombre`, produciendo identificadores incompatibles entre los platos procedentes del frontend y los de la base de datos.

---

## Arreglo 1 — CRÍTICO: `__identificador_receta` en `API_planificacion.py`

### Fichero afectado
`server/API_planificacion.py`

### Problema
La función `__identificador_receta` intentaba las claves `("_id", "id", "nombre")` en ese orden. Para recetas del JSON local, `_id` es un dict `{"$oid": "..."}` (formato MongoDB Extended JSON), y `str()` sobre él produce una cadena como `"{'$oid': '69b147433c726bcbda04d474'}"`. Para los platos que llegan como `dias_previos` desde el frontend, `_id` e `id` son `None` (el frontend no los envía), por lo que el identificador caía a `nombre` → `"Paella valenciana"`.

Esto hacía que el filtro de no-repetición del deque `ids_recientes` fuera inefectivo:

```python
disponibles = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
]
# id(receta JSON) = "{'$oid': '...'}"   →  nunca en ids_recientes que tiene "Paella valenciana"
# → todos los platos previos podían repetirse libremente
```

**Impacto**: ~30 % de las regeneraciones contenían al menos un plato repetido respecto a los días previos.

### Cambio aplicado

```python
# ANTES
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    for clave in ("_id", "id", "nombre"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)

# DESPUÉS
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    # "nombre" se usa como clave primaria porque es el único campo que está
    # garantizado tanto en las recetas del JSON/MongoDB como en los platos
    # que llegan del frontend como dias_previos (donde _id e id no se envían).
    # Todos los nombres son únicos en la base de datos de recetas.
    for clave in ("nombre", "_id", "id"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)
```

**Por qué `nombre` es la clave correcta**:

1. Todas las recetas de la base de datos tienen `nombre`.
2. Los platos enviados por el frontend como `dias_previos` también contienen `nombre` (es parte del tipo `Receta` de TypeScript y se incluye en `cleanDiaPlanning`).
3. El dataset tiene 160 recetas con nombres **todos únicos** (verificado).
4. Cambiar a `nombre` hace que los dos tipos de objetos (recetas completas y platos previos) produzcan el mismo identificador para la misma receta.

---

## Arreglo 2 — DERIVADO: `obtener_id_plato` en `prueba_regen.py`

### Fichero afectado
`server/prueba_regen.py`

### Problema
`obtener_id_plato` tenía la misma lógica de prioridad que el método del algoritmo. Como la planificación devuelta mezcla días previos (sin `_id`, identificados por `nombre`) y nuevos días generados (con `_id` como dict), la función de validación nunca detectaba repeticiones entre platos previos y nuevos.

**Consecuencia**: `prueba_regen.py` reportaba 100 % de éxito cuando la tasa real de repeticiones era del ~30 %. La herramienta de validación era completamente ciega al fallo principal.

### Cambio aplicado

```python
# ANTES
def obtener_id_plato(plato: dict[str, Any]) -> str:
    """Obtiene un identificador único para un plato."""
    for clave in ("_id", "id", "nombre"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)

# DESPUÉS
def obtener_id_plato(plato: dict[str, Any]) -> str:
    """Obtiene un identificador único para un plato.
    
    Se usa 'nombre' como clave primaria para que los platos procedentes del
    frontend (dias_previos, sin _id) y los platos recién generados (con _id)
    se identifiquen de forma consistente. Los nombres son únicos en la BD.
    """
    for clave in ("nombre", "_id", "id"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)
```

---

## Ajuste adicional: `prueba_regen.py` — Configuración de iteraciones

Se actualizaron las constantes de configuración del script para reproducir un escenario más realista:

```python
# ANTES
DIAS_REGEN = 1    # Solo 1 día de historial
REGEN_MODE = "con_historial"

# DESPUÉS
DIAS_REGEN = 3    # Simula regenerar a mitad de semana (días 1–3 en el pasado)
REGEN_MODE = "ambos"  # Prueba ambos modos: sin y con historial
```

Con `DIAS_REGEN=1` el test era poco representativo: en la práctica real el usuario puede tener entre 1 y 13 días de historial. El valor `3` simula el caso más típico (regenerar hacia el día 4 de la semana).

---

## Resultados tras los arreglos

Se ejecutaron las pruebas del script `prueba_regen.py` con `ITERACIONES=1000` en ambos modos:

| Modo | Iteraciones | Válidas | Inválidas | Tasa de éxito |
|------|------------|---------|-----------|---------------|
| Sin historial | 1 000 | 1 000 | 0 | **100 %** |
| Con historial (3 días previos) | 1 000 | 1 000 | 0 | **100 %** |
| **Total** | **2 000** | **2 000** | **0** | **100 %** |

- **0 platos repetidos** en 2 000 planificaciones generadas.
- **0 violaciones de cuotas** en ninguna ventana deslizante de 7 días.

---

## Estado de los fallos

| # | Descripción | Archivo | Severidad | Estado |
|---|-------------|---------|-----------|--------|
| 1 | Identificador incompatible `_id` vs `nombre` en `__identificador_receta` | `API_planificacion.py` | CRÍTICO | ✅ Corregido |
| 2 | La validación `obtener_id_plato` no detectaba repeticiones entre previos y nuevos | `prueba_regen.py` | DERIVADO | ✅ Corregido |
| 3 | `total_recetas_disponibles` guarda número de platos en vez de recetas | `planning.storage.ts` | MENOR | ℹ️ Sin impacto en lógica, no corregido |
| 4 | `DIAS_REGEN=1` infravalora el escenario real en el test | `prueba_regen.py` | MENOR | ✅ Mejorado a 3 |
| 5 | `REGEN_MODE="con_historial"` solo probaba un modo | `prueba_regen.py` | MENOR | ✅ Cambiado a `"ambos"` |

---

## Cómo funciona el ciclo ahora (regeneración corregida)

1. El frontend extrae los días pasados de `localStorage` con `getDiasPrevios`.
2. `cleanDiaPlanning` limpia cada día enviando `{ dia, comida:{nombre,...,tags}, cena:{nombre,...,tags} }`.
3. Se hace `POST /api/planificacion/semanal/` con `{ "dias_previos": [...] }`.
4. El backend carga cada plato previo en `ids_recientes` usando **`nombre`** como identificador.
5. Al generar nuevos platos, el filtro `disponibles = [r for r in recetas if nombre(r) NOT IN ids_recientes]` **ahora sí excluye correctamente** los platos que ya aparecen en los días previos.
6. Los 7 nuevos días se generan sin repetir ningún plato de los días previos.
7. El plan combinado (`dias_previos + 7_nuevos`, recortado a 14 días) se devuelve y guarda.
