# Tests de Sistema — `tests_sistema.py`

## Qué son

Pruebas de **caja negra** que verifican el sistema completo desplegado. El servidor Flask se levanta como un **proceso independiente** y los tests interactúan con él exclusivamente mediante **peticiones HTTP reales** con la librería `requests`. No se importa ningún módulo del servidor.

## Principio fundamental

El código de test **no conoce la implementación interna**. Solo conoce:
- La URL del servidor
- El contrato HTTP (endpoints, métodos, formato de respuesta)
- Las restricciones del dominio (cuotas, no repetición)

Las cuotas se definen como constante local en el fichero de tests, copiadas del contrato público — no se importan de `API_planificacion`.

## Cómo se levanta el servidor

La fixture `servidor` (scope `module`) hace lo siguiente:

1. **Comprueba** que el puerto 18765 está libre
2. **Lanza** `python app.py` como subproceso con variables de entorno controladas (`FLASK_HOST`, `FLASK_PORT`, `FLASK_DEBUG=0`, sin `MONGODB_URI`)
3. **Espera** a que `/health` devuelva 200 (polling cada 300ms, timeout 15s)
4. **Devuelve** la URL base al test
5. **Al terminar** el módulo, envía señal de terminación al proceso y lo mata si no responde en 5s

## Tests implementados

### `TestHealthCheck` — Servidor vivo

| Test | Qué comprueba |
|------|---------------|
| `test_health_devuelve_200_ok` | GET `/health` → 200, body `{"status": "ok"}` |
| `test_content_type_es_json` | Header `Content-Type` contiene `application/json` |

### `TestPlanificacionGET` — Generación desde cero

| Test | Qué comprueba |
|------|---------------|
| `test_devuelve_200` | Status code 200 |
| `test_content_type_json` | Content-Type JSON |
| `test_estructura_7_dias_completa` | 7 días, cada uno con `dia`, `comida`, `cena`, metadatos presentes |
| `test_fuente_datos_informada` | `fuente_datos` es `"json"` o `"mongodb"` |
| `test_generado_en_es_iso_valido` | `generado_en` es un datetime ISO parseable |
| `test_sin_repeticiones_14_dias` | Ningún plato repetido en ventana de 14 días |
| `test_cuotas_ventana_7_dias` | Cada ventana de 7 días cumple las cuotas de todos los tags |
| `test_14_platos_unicos` | Los 14 platos (7×2) son todos distintos |
| `test_respuesta_json_re_serializable` | `json.dumps(json.loads(...))` produce el mismo resultado |

### `TestPlanificacionPOSTConHistorial` — Con días previos

| Test | Qué comprueba |
|------|---------------|
| `test_post_con_dias_previos_devuelve_200` | POST con `dias_previos` → 200 |
| `test_post_devuelve_dias_previos_mas_7` | Respuesta tiene `N_previos + 7` días (máx 14) |
| `test_post_sin_repeticiones` | Sin repeticiones en planificación completa |
| `test_post_cuotas_todas_las_ventanas` | Cuotas válidas en todas las ventanas de la respuesta extendida |
| `test_post_cadena_3_regeneraciones` | Encadena genera → regenera ×3 validando restricciones en cada paso |

### `TestNoDeterminismo`

| Test | Qué comprueba |
|------|---------------|
| `test_dos_get_producen_planes_diferentes` | Dos GET consecutivos devuelven planificaciones distintas |

### `TestRendimiento`

| Test | Qué comprueba |
|------|---------------|
| `test_respuesta_en_menos_de_5_segundos` | El endpoint responde en < 5s |

### `TestRutasInvalidas`

| Test | Qué comprueba |
|------|---------------|
| `test_ruta_inexistente_devuelve_404` | Ruta que no existe → 404 |
| `test_metodo_no_permitido` | DELETE en endpoint que no lo soporta → 405 |

## Validación de restricciones

Las funciones helper replican la lógica de validación sin importar nada del servidor:

- **`_assert_sin_repeticiones_14_dias`**: para cada plato, busca hacia atrás si hay otro con el mismo identificador a menos de 14 días de distancia.
- **`_assert_cuotas_ventanas_7_dias`**: ventana deslizante real — precalcula tags por día, inicializa la ventana [0:7], y para cada paso resta el día que sale y suma el que entra. Comprueba que cada grupo esté en `[min, max]`.

## Ejecución

```bash
cd app/server
pytest tests_sistema.py -v --tb=short
```

Requisitos: `pip install requests pytest`

## Diferencia con integración

| Aspecto | Integración (`test_integracion.py`) | Sistema (`tests_sistema.py`) |
|---------|-------------------------------------|------------------------------|
| Servidor | In-process (test client Flask) | Proceso independiente real |
| Red | Sin red, llamadas internas | HTTP real por TCP |
| Imports | Importa `API_planificacion`, `create_app` | No importa nada del servidor |
| Enfoque | Interacción entre módulos | Caja negra completa |
