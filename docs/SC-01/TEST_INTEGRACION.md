# Tests de Integración — `test_integracion.py`

## Qué son

Pruebas que verifican la **cadena completa** a través de peticiones HTTP al test client de Flask:

```
HTTP request → Flask routing → API_planificacion → datos (JSON / MongoDB) → HTTP response
```

Cada test cruza al menos la frontera HTTP → lógica. Ninguno instancia `API_planificacion` directamente.

## Principio fundamental

- A diferencia de las pruebas **unitarias** (que aíslan la clase con mocks y semilla controlada), aquí toda petición pasa por el endpoint HTTP y el algoritmo corre sin semilla fija.
- A diferencia de las de **sistema** (que levantan un subproceso y usan `requests` por TCP), aquí se usa el **test client in-process** de Flask.
- Se **simula el flujo del frontend**: `cleanDiaPlanning` elimina `_id`/`id` antes de enviar `dias_previos`, replicando exactamente lo que hace la app TypeScript.

## Módulos integrados

```
┌──────────────┐     ┌────────────────────┐     ┌─────────────┐
│  Flask HTTP  │ ──► │  API_planificacion  │ ──► │  JSON File  │
│ (test client)│     │    (algoritmo)      │     │  (datasets) │
└──────────────┘     └────────────────────┘     └─────────────┘
                              │
                              ▼
                      ┌─────────────┐
                      │   MongoDB   │
                      │  (PyMongo)  │
                      └─────────────┘
```

## Simulación del frontend

Funciones `_clean_receta` y `_clean_dia` replican `cleanDiaPlanning` del TypeScript:

```python
def _clean_receta(receta: dict) -> dict:
    return {
        "nombre": receta.get("nombre", ""),
        "grupo_principal": receta.get("grupo_principal", ""),
        "ingredientes": receta.get("ingredientes", []),
        "pasos": receta.get("pasos", []),
        "tags": receta.get("tags", []),
    }
```

Así los POST envían recetas **sin `_id` ni `id`**, como lo haría el frontend real.

## Helpers de validación

| Helper | Qué valida |
|--------|-----------|
| `_obtener_id_plato` | Identificador consistente con `__identificador_receta`: prioriza `nombre` → `_id` → `id` |
| `_assert_estructura_plan(payload, num_dias)` | Claves obligatorias, fuente datos, nº de días (flexible, no fijo a 7) |
| `_assert_sin_repeticiones(dias)` | Ningún plato repetido en ventana de 14 días (pares de días) |
| `_assert_cuotas_ventanas_7_dias(dias)` | Ventana deslizante de 7 días: cada tag dentro de `[min, max]` de `CUOTAS` |
| `_check_ventana(ventana, inicio, fin)` | Comprobación individual de una ventana |

## Tests implementados

### Clase `TestGetSinHistorial` — GET desde cero

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | `test_devuelve_200_con_content_type_json` | Status 200, Content-Type JSON |
| 2 | `test_estructura_7_dias_completa` | Estructura de 7 días con todos los campos |
| 3 | `test_fuente_datos_json_sin_mongodb` | `fuente_datos == "json"` cuando `MONGODB_URI=""` |
| 4 | `test_sin_repeticiones_14_dias` | No hay platos repetidos en la semana |
| 5 | `test_cuotas_ventana_7_dias` | Cuotas nutricionales dentro de rango |
| 6 | `test_14_platos_unicos` | 14 platos distintos (7 días × 2 turnos) |
| 7 | `test_respuesta_json_re_serializable` | Respuesta serializable sin pérdida |
| 8 | `test_multiples_get_cumplen_restricciones` | 20 iteraciones GET, todas válidas |

### Clase `TestPostConHistorial` — POST con días previos (flujo frontend)

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | `test_estructura_con_dias_previos` | Parametrizado ×7 (`n_previos` 1–7): estructura correcta con `min(n+7, 14)` días |
| 2 | `test_sin_repeticiones_con_historial` | Parametrizado ×7: sin repeticiones considerando previos + nuevos |
| 3 | `test_cuotas_con_historial` | Parametrizado ×7: cuotas respetadas en todo el rango |
| 4 | `test_cadena_regeneraciones` | Encadena 5 regeneraciones: GET → POST(3) → POST(3) → ... |
| 5 | `test_multiples_regeneraciones_validan_restricciones` | Parametrizado ×3 (`n_previos` 1,3,7): 20 iteraciones encadenadas |
| 6 | `test_post_sin_dias_previos_funciona_como_get` | POST con body `{}` devuelve 7 días como GET |

### Clase `TestErroresHTTP` — Manejo de errores

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | `test_recetas_insuficientes_devuelve_400` | JSON con 1 receta → HTTP 400 con `{"error": ...}` |
| 2 | `test_mongodb_inaccesible_devuelve_503` | MongoDB en puerto cerrado → HTTP 503 con `{"error": ...}` |

### Clase `TestConMongoDB` — MongoDB real (skip automático)

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | `test_get_con_mongodb_real_devuelve_plan_valido` | GET → `fuente_datos="mongodb"`, estructura, cuotas, no repeticiones |
| 2 | `test_post_con_mongodb_real_respeta_historial` | POST con 3 previos limpios → 10 días válidos |
| 3 | `test_mongodb_vacia_devuelve_503` | Colección vacía → HTTP 503 |

**Total: ~40 tests** (contando parametrizaciones: 8 + 21 + 6 + 2 + 3).

## Fixtures

| Fixture | Scope | Descripción |
|---------|-------|-------------|
| `flask_client` | module | Test client de Flask con `MONGODB_URI=""` (modo JSON). Restaura env al terminar |
| `mongo_client` | module | Conexión MongoDB real. Skip si PyMongo no instalado o MongoDB inaccesible |
| `mongo_collection` | function | Colección limpia por test (drop antes y después) |

## Ejecución

```bash
cd app/server
pytest test_integracion.py -v --tb=short
```

Los tests de MongoDB (`TestConMongoDB`) se saltan automáticamente si no hay un servidor MongoDB accesible o PyMongo no está instalado.

Para ejecutar solo los tests sin MongoDB:

```bash
pytest test_integracion.py -v --tb=short -k "not MongoDB"
```

## Diferencia con unitarias y sistema

| Aspecto | Unitarias | **Integración** | Sistema |
|---------|-----------|-----------------|---------|
| Instancia directa | Sí (`API_planificacion()`) | **No** (todo vía HTTP) | No (caja negra) |
| Servidor | No | Test client in-process | Subproceso + TCP |
| Semilla controlada | Sí (`random.seed`) | **No** (robustez real) | No |
| Simula frontend | No | **Sí** (`_clean_dia`) | No |
| Mocks | Sí (MongoDB, fichero) | No entre módulos | No |
| Fichero JSON | Temporal sintético | **Real** (`datasets/`) | Real |
| MongoDB | Mockeado | **Real** (si disponible) | Real |
| Stress/iteraciones | 100 iter × 10 seeds | **20 iter** × parámetros | 1 iteración |

## Cambios respecto a la versión anterior

1. **Todos los tests pasan por HTTP**: se eliminaron los tests que instanciaban `API_planificacion` directamente (eran pruebas unitarias disfrazadas de integración).
2. **Simulación del frontend**: `_clean_receta`/`_clean_dia` replican exactamente `cleanDiaPlanning` del TypeScript, enviando días sin `_id`/`id`.
3. **`_obtener_id_plato` corregido**: prioriza `nombre` → `_id` → `id`, consistente con `__identificador_receta` del algoritmo (antes usaba el orden invertido `_id` → `id` → `nombre`).
4. **`_assert_estructura_plan` flexible**: acepta `num_dias` variable (antes hardcodeaba 7), necesario para validar POST con previos.
5. **`_assert_sin_repeticiones` rigurosa**: comprueba por pares en ventana de 14 días (antes usaba un set simple).
6. **Tests parametrizados**: `DIAS_PREVIOS_VALUES = [1,2,3,4,5,6,7]` prueba todas las combinaciones posibles de días previos.
7. **Tests de esfuerzo (stress)**: 20 iteraciones encadenadas para detectar fallos intermitentes.
8. **Cadena de regeneraciones**: simula uso real (GET → POST → POST → ...) verificando que el estado no se corrompe entre regeneraciones.
