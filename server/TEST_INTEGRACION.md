# Tests de Integración — `test_integracion.py`

## Qué son

Pruebas que verifican la **interacción real entre dos o más módulos** del sistema sin mockear las interfaces entre ellos. Cada test cruza al menos una frontera real (HTTP → lógica, lógica → fichero, lógica → BD, configuración → inicialización).

## Principio fundamental

A diferencia de las pruebas unitarias (que aíslan métodos con mocks), aquí los módulos se conectan de verdad. A diferencia de las de sistema (que levantan el servidor como proceso), aquí se usa el **test client in-process** de Flask y se instancian los módulos directamente.

## Módulos integrados

```
┌─────────┐     ┌────────────────────┐     ┌─────────────┐
│  Flask   │ ──► │  API_planificacion  │ ──► │  JSON File  │
│ (HTTP)   │     │    (algoritmo)      │     │  (datasets) │
└─────────┘     └────────────────────┘     └─────────────┘
                        │                         
                        ▼                         
                 ┌─────────────┐     ┌──────────┐
                 │   MongoDB   │     │  dotenv   │
                 │  (PyMongo)  │     │  (.env)   │
                 └─────────────┘     └──────────┘
```

## Tests implementados

### 1. `test_api_planificacion_json_integration_lee_fichero_real_y_generar_plan`

**Integración**: `API_planificacion` ↔ Sistema de ficheros

Instancia `API_planificacion` con la ruta al JSON real de recetas (`datasets/smartCook.recetas.json`). Sin mocks de fichero ni de `json.load`. Comprueba que carga las recetas, genera una planificación válida, con la fuente `"json"`, sin repeticiones y con cuotas correctas.

### 2. `test_flask_api_json_chain_sin_mongodb_devuelve_200_y_json_valido`

**Integración**: Flask ↔ `API_planificacion` ↔ JSON

Usa el test client de Flask para hacer un GET real a `/api/planificacion/semanal/`. La petición atraviesa Flask → deserialización → `API_planificacion` → lectura de fichero → planificación → serialización → respuesta HTTP. Verifica status 200, estructura, no repetición y cuotas.

### 3. `test_flask_api_post_con_dias_previos_transmite_la_lista_json`

**Integración**: Flask (POST + JSON body) ↔ `API_planificacion` (con historial)

Primero obtiene una planificación por GET. Después hace un POST con `dias_previos` tomados de esa planificación. Verifica que Flask deserializa el body correctamente, lo pasa al algoritmo, y la respuesta tiene `dias_previos + 7` días con restricciones cumplidas.

### 4. `test_dotenv_integra_configuracion_y_api_planificacion`

**Integración**: dotenv ↔ `API_planificacion`

Escribe un fichero `.env` temporal con `RECETAS_JSON_PATH` apuntando al dataset real y `MONGODB_URI` vacía. Instancia `API_planificacion()` sin parámetros explícitos y comprueba que lee la configuración del `.env` y genera una planificación válida. Al terminar, restaura el `.env` original.

### 5. `test_flask_api_devuelve_400_con_recetas_insuficientes`

**Integración**: Flask ↔ `API_planificacion` (error handling)

Crea un JSON temporal con solo 1 receta. Configura la variable de entorno para que apunte a ese fichero. Hace GET y comprueba que Flask devuelve **400** con un JSON de error (no un 500 genérico). Verifica que `InsufficientRecipesError` se propaga correctamente hasta la respuesta HTTP.

### 6. `test_flask_api_devuelve_503_con_mongodb_inaccesible`

**Integración**: Flask ↔ `API_planificacion` ↔ MongoDB (fallo de conexión)

Configura `MONGODB_URI` apuntando a `127.0.0.1:1` (puerto cerrado) con timeout de 100ms. Hace GET y comprueba que Flask devuelve **503** con JSON de error. Verifica que el fallo de MongoDB se propaga como `PlanningError` hasta HTTP.

### 7. `test_api_planificacion_con_mongodb_real_carga_recetas_y_planifica`

**Integración**: `API_planificacion` ↔ MongoDB (PyMongo real)

Se salta automáticamente si MongoDB no está disponible. Inserta 40 recetas reales (del JSON, con ObjectId convertidos) en una colección de test. Instancia `API_planificacion` con la URI real de MongoDB. Comprueba `fuente_datos == "mongodb"`, estructura válida, sin repeticiones y cuotas correctas. Al terminar, limpia la BD de test.

### 8. `test_api_planificacion_con_mongodb_vacia_lanza_planning_error`

**Integración**: `API_planificacion` ↔ MongoDB (colección vacía)

Verifica que si la colección existe pero está vacía, se lanza `PlanningError` indicando que no hay recetas.

## Helpers de validación

- **`_assert_plan_contract`**: estructura del plan (7 días, turnos, metadatos)
- **`_assert_no_repetitions`**: sin platos con mismo identificador
- **`_assert_quotas_windows`**: ventana deslizante de 7 días, cada tag en `[min, max]`

## Fixtures

| Fixture | Scope | Descripción |
|---------|-------|-------------|
| `flask_app` | module | Crea la app Flask |
| `flask_client` | module | Test client in-process |
| `temp_env_file` | function | Guarda/restaura `.env` original |
| `mongo_client` | module | Conexión MongoDB real (skip si no disponible) |
| `mongo_collection` | function | Colección limpia por test |

## Ejecución

```bash
cd app/server
pytest test_integracion.py -v --tb=short
```

Los tests de MongoDB se saltan automáticamente si no hay un servidor MongoDB accesible.

## Diferencia con unitarias y sistema

| Aspecto | Unitarias | **Integración** | Sistema |
|---------|-----------|-----------------|---------|
| Mocks | Sí (MongoDB, dotenv) | No entre módulos | No (caja negra) |
| Servidor | No | Test client in-process | Proceso independiente |
| Fichero JSON | Temporal sintético | **Real** (`datasets/`) | Real (producción) |
| MongoDB | Mockeado | **Real** (si disponible) | Real |
| Imports | Sí (internals) | Sí (interfaces públicas) | **Ninguno** |
