# DOC_INTEGRACION.md — Documentación de los tests de integración

> **Fichero de tests:** `server/test_integracion.py`  
> **Código fuente probado:** `server/API_planificacion.py` y `server/app.py`

Los tests de integración verifican la cadena completa:

```
HTTP request → Flask routing (app.py) → API_planificacion → datos (JSON / MongoDB) → HTTP response
```

No se instancia `API_planificacion` directamente; todo pasa por el endpoint HTTP usando el test client in-process de Flask.

---

## Índice

1. [Helpers de validación](#1-helpers-de-validación)
2. [Fixtures](#2-fixtures)
3. [TestGetSinHistorial — GET sin historial](#3-testgetsinhistorial--get-sin-historial)
4. [TestPostConHistorial — POST con días previos](#4-testpostconhistorial--post-con-días-previos)
5. [TestErroresHTTP — Manejo de errores](#5-testesroreshttp--manejo-de-errores)
6. [TestConMongoDB — Integración con MongoDB real](#6-testconmongodb--integración-con-mongodb-real)

---

## 1. Helpers de validación

Funciones auxiliares usadas por los tests para validar las respuestas. No son tests en sí mismas, pero son la base de los asserts.

### 1.1 `_assert_estructura_plan`

Comprueba que el JSON devuelto por la API contiene las claves obligatorias, que `fuente_datos` es válida, que hay suficientes recetas disponibles y que cada día incluye comida y cena con nombre.

#### Código del test

```python
def _assert_estructura_plan(payload: dict, num_dias: int) -> None:
    """Valida la estructura completa del plan devuelto por la API."""
    assert "dias" in payload, "Falta clave 'dias'"
    assert "generado_en" in payload, "Falta clave 'generado_en'"
    assert "fuente_datos" in payload, "Falta clave 'fuente_datos'"
    assert "total_recetas_disponibles" in payload, "Falta clave 'total_recetas_disponibles'"
    assert payload["fuente_datos"] in ("json", "mongodb")
    assert payload["total_recetas_disponibles"] >= 14

    dias = payload["dias"]
    assert isinstance(dias, list)
    assert len(dias) == num_dias, (
        f"Esperados {num_dias} días, obtenidos {len(dias)}"
    )

    for i, dia in enumerate(dias):
        assert "dia" in dia, f"Día {i}: falta 'dia'"
        assert "comida" in dia, f"Día {i}: falta 'comida'"
        assert "cena" in dia, f"Día {i}: falta 'cena'"
        assert dia["comida"].get("nombre"), f"Día {i}: comida sin nombre"
        assert dia["cena"].get("nombre"), f"Día {i}: cena sin nombre"
```

#### Código fuente correspondiente — `planifica` y `weekly_planning`

El helper valida el contrato de la respuesta construida en `planifica` y serializada por `weekly_planning`:

```python
# app.py
@app.route("/api/planificacion/semanal/", methods=["GET", "POST"])
def weekly_planning():
    dias_previos = None
    if request.method == "POST" and request.is_json:
        body = request.get_json(silent=True) or {}
        dias_previos = body.get("dias_previos") or None

    try:
        planificacion = API_planificacion().planifica(dias_previos=dias_previos)
    except InsufficientRecipesError as exc:
        return jsonify({"error": str(exc)}), 400
    except PlanningError as exc:
        return jsonify({"error": str(exc)}), 503

    return jsonify(planificacion), 200
```

```python
# API_planificacion.py — fragmento de planifica()
planificacion: dict[str, Any] = {
    "generado_en": datetime.now(timezone.utc).isoformat(),
    "fuente_datos": self.__FUENTE_DATOS,
    "total_recetas_disponibles": len(recetas),
    "dias": [],
}

plato_k = 1
for i in range(self.__DIAS_TOTALES):
    ...
    dia: dict[str, Any] = {
        "dia": (datetime.now(timezone.utc) + timedelta(days=i)).isoformat(),
    }
    for turno in ("comida", "cena"):
        plato = self.__selecciona_plato_con_cuotas(
            recetas, ids_recientes, conteo_ventana, plato_k
        )
        ...
        dia[turno] = plato
        plato_k += 1
    ventana_dias.append(dia)
    planificacion["dias"].append(dia)
```

---

### 1.2 `_assert_sin_repeticiones`

Verifica que ningún plato aparece más de una vez dentro de una ventana de 14 días consecutivos.

#### Código del test

```python
def _assert_sin_repeticiones(dias: list[dict]) -> None:
    """Ningún plato repetido dentro de una ventana de 14 días."""
    platos: list[tuple[int, str, str]] = []
    for idx, dia in enumerate(dias):
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                platos.append((idx, turno, _obtener_id_plato(plato)))

    for i, (dia_i, turno_i, id_i) in enumerate(platos):
        for j in range(i):
            dia_j, turno_j, id_j = platos[j]
            if dia_i - dia_j >= 14:
                continue
            assert id_i != id_j, (
                f"Plato repetido '{id_i}' en dia {dia_j}({turno_j}) "
                f"y dia {dia_i}({turno_i}), distancia={dia_i - dia_j} días"
            )
```

#### Código fuente correspondiente — restricción de recencia en `planifica` y `__selecciona_plato_con_cuotas`

La no-repetición se garantiza mediante la deque `ids_recientes` (maxlen = 14):

```python
# API_planificacion.py — planifica()
ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)  # maxlen=14

if dias_previos:
    for dia in dias_previos:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                ids_recientes.append(self.__identificador_receta(plato))

...
for turno in ("comida", "cena"):
    plato = self.__selecciona_plato_con_cuotas(
        recetas, ids_recientes, conteo_ventana, plato_k
    )
    ids_recientes.append(self.__identificador_receta(plato))
    ...
```

```python
# API_planificacion.py — __selecciona_plato_con_cuotas()
# quitamos del pool las recetas que hemos puesto en los últimos 14 días
# para no repetir plato tan pronto
disponibles = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
]

# si por alguna razón todas están bloqueadas por recencia, usamos todas
# mejor repetir que quedarse sin opciones
if not disponibles:
    disponibles = list(recetas)
```

El identificador de receta prioriza `nombre` para ser consistente con el formato limpio que envía el frontend:

```python
# API_planificacion.py
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    for clave in ("nombre", "_id", "id"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)
```

---

### 1.3 `_assert_cuotas_ventanas_7_dias`

Recorre todas las ventanas deslizantes de 7 días y verifica que el conteo de cada grupo nutricional se mantiene dentro de su rango `[min, max]` definido en `CUOTAS`.

#### Código del test

```python
def _assert_cuotas_ventanas_7_dias(dias: list[dict]) -> None:
    """Verifica cuotas nutricionales en cada ventana deslizante de 7 días."""
    assert len(dias) >= 7, "Se necesitan al menos 7 días para validar cuotas"

    tags_por_dia: list[dict[str, int]] = []
    for dia in dias:
        conteo = {g: 0 for g in CUOTAS}
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                for tag in _tags_validos(plato):
                    conteo[tag] += 1
        tags_por_dia.append(conteo)

    ventana = {g: 0 for g in CUOTAS}
    for d in range(7):
        for g in CUOTAS:
            ventana[g] += tags_por_dia[d][g]
    _check_ventana(ventana, 0, 7)

    for inicio in range(1, len(dias) - 6):
        for g in CUOTAS:
            ventana[g] -= tags_por_dia[inicio - 1][g]
            ventana[g] += tags_por_dia[inicio + 6][g]
        _check_ventana(ventana, inicio, inicio + 7)


def _check_ventana(ventana: dict, inicio: int, fin: int) -> None:
    for grupo, cuota in CUOTAS.items():
        c = ventana[grupo]
        assert cuota["min"] <= c <= cuota["max"], (
            f"'{grupo}' fuera de rango en ventana [{inicio}:{fin}]: "
            f"{c} not in [{cuota['min']}, {cuota['max']}]"
        )
```

#### Código fuente correspondiente — `CUOTAS` y `__selecciona_plato_con_cuotas`

Las cuotas nutricionales están definidas como constante del módulo:

```python
# API_planificacion.py
CUOTAS: dict[str, dict[str, int]] = {
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

El algoritmo que hace cumplir esas cuotas es `__selecciona_plato_con_cuotas`. Clasifica cada grupo en `urgente`, `bloqueado` o `crítico` y puntúa las recetas candidatas:

```python
# API_planificacion.py — __selecciona_plato_con_cuotas()
def __selecciona_plato_con_cuotas(
    self,
    recetas: list[dict[str, Any]],
    ids_recientes: deque[str],
    conteo: dict[str, int],
    plato_k: int,
) -> dict[str, Any]:

    platos_restantes = self.__TOTAL_PLATOS - plato_k + 1

    urgentes: set[str] = set()
    bloqueados: set[str] = set()
    criticos: set[str] = set()

    for grupo, cuota in CUOTAS.items():
        ya_tengo = conteo.get(grupo, 0)
        pendiente_min = cuota["min"] - ya_tengo
        exceso = ya_tengo - cuota["max"]

        if pendiente_min > 0 and pendiente_min >= platos_restantes:
            urgentes.add(grupo)

        if ya_tengo >= cuota["max"]:
            bloqueados.add(grupo)
        elif ya_tengo > 0.7 * cuota["max"]:
            criticos.add(grupo)

    disponibles = [
        r for r in recetas
        if self.__identificador_receta(r) not in ids_recientes
    ]
    if not disponibles:
        disponibles = list(recetas)

    if urgentes:
        candidatas = [
            r for r in disponibles
            if any(t in urgentes for t in self.__tags_nutricionales(r))
        ]
    else:
        candidatas = [
            r for r in disponibles
            if not any(t in bloqueados for t in self.__tags_nutricionales(r))
        ]
        if not candidatas or len(candidatas) < len(disponibles) / 3:
            candidatas = [
                r for r in disponibles
                if not self.__tags_nutricionales(r)
                or not all(t in bloqueados for t in self.__tags_nutricionales(r))
            ]

    if not candidatas:
        candidatas = disponibles

    def score(r: dict[str, Any]) -> float:
        bonus_minimos = 0.0
        for tag in self.__tags_nutricionales(r):
            ya = conteo.get(tag, 0)
            cuota = CUOTAS[tag]
            pendiente_min = cuota["min"] - ya
            if pendiente_min > 0:
                bonus_minimos += pendiente_min / cuota["min"]

        penalidad_maximos = 0.0
        for tag in self.__tags_nutricionales(r):
            ya = conteo.get(tag, 0)
            cuota = CUOTAS[tag]
            if ya >= cuota["max"]:
                penalidad_maximos += 10.0
            elif ya >= 0.7 * cuota["max"]:
                riesgo = (ya - 0.7 * cuota["max"]) / (0.3 * cuota["max"])
                penalidad_maximos += 5.0 * riesgo

        return bonus_minimos - penalidad_maximos

    max_score = max(score(r) for r in candidatas)
    candidatas_top = [r for r in candidatas if score(r) >= max_score]
    return deepcopy(self.__RNG.choice(candidatas_top))
```

---

## 2. Fixtures

### 2.1 `flask_client`

Crea un test client de Flask con `MONGODB_URI` forzado a vacío para que todas las pruebas usen el fichero JSON como fuente de datos, independientemente del entorno.

#### Código del test

```python
@pytest.fixture(scope="module")
def flask_client():
    """Test client de Flask con MongoDB desactivado (modo JSON).

    Se fuerza MONGODB_URI="" para que API_planificacion use el fichero JSON,
    incluso si hay un .env con una URI configurada. Al terminar el módulo
    se restaura el valor original.
    """
    saved_uri = os.environ.get("MONGODB_URI")
    os.environ["MONGODB_URI"] = ""
    try:
        app = create_app()
        app.config["TESTING"] = True
        yield app.test_client()
    finally:
        if saved_uri is not None:
            os.environ["MONGODB_URI"] = saved_uri
        else:
            os.environ.pop("MONGODB_URI", None)
```

#### Código fuente correspondiente — `create_app` y `__conectar_mongodb_si_esta_configurado`

Forzar `MONGODB_URI=""` hace que el constructor de `API_planificacion` no intente conectarse a MongoDB:

```python
# app.py
def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.route("/api/planificacion/semanal/", methods=["GET", "POST"])
    def weekly_planning():
        ...
        planificacion = API_planificacion().planifica(dias_previos=dias_previos)
        ...
    return app
```

```python
# API_planificacion.py
def __conectar_mongodb_si_esta_configurado(self) -> None:
    if not self.__CONEXION:   # URI vacía → se usa fichero JSON
        return

    try:
        timeout_ms = int(os.getenv("MONGODB_TIMEOUT_MS", "8000"))
        client = MongoClient(self.__CONEXION, serverSelectionTimeoutMS=timeout_ms)
        client.admin.command("ping")
        self.__CLIENT = client
        self.__RECETAS = client[self.__DB_NAME][self.__COLLECTION_NAME]
        self.__INGREDIENTES = client[self.__DB_NAME][self.__INGREDIENTS_NAME]
        self.__FUENTE_DATOS = "mongodb"
    except (PyMongoError, ValueError):
        self.__CLIENT = None
        self.__RECETAS = None
        self.__FUENTE_DATOS = "json"
```

---

### 2.2 `mongo_client` y `mongo_collection`

Establece una conexión real a MongoDB y provee una colección temporal aislada que se elimina antes y después de cada test para garantizar un estado limpio.

#### Código del test

```python
@pytest.fixture(scope="module")
def mongo_client():
    """Conexión real a MongoDB. Se salta si PyMongo no está instalado
    o MongoDB no es accesible."""
    if not HAS_PYMONGO:
        pytest.skip("PyMongo no instalado, saltando pruebas con MongoDB")

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"MongoDB no disponible en {MONGODB_URI}: {exc}")

    yield client
    client.drop_database(TEST_DB)
    client.close()


@pytest.fixture
def mongo_collection(mongo_client):
    coll = mongo_client[TEST_DB][TEST_COLLECTION]
    coll.drop()
    yield coll
    coll.drop()
```

#### Código fuente correspondiente — `__carga_recetas` (rama MongoDB)

```python
# API_planificacion.py — __carga_recetas()
def __carga_recetas(self) -> list[dict[str, Any]]:
    if self.__CONEXION:
        if self.__RECETAS is None:
            raise PlanningError(
                "Se configuró MONGODB_URI, pero no se pudo conectar a MongoDB. "
                "Revisa URI, red y credenciales."
            )
        try:
            recetas = list(self.__RECETAS.find({}))
        except PyMongoError as exc:
            raise PlanningError("No se pudieron cargar las recetas desde MongoDB.") from exc

        if not recetas:
            raise PlanningError(
                "MongoDB está conectado pero la colección de recetas está vacía."
            )
    else:
        if not self.__RECIPES_PATH.exists():
            raise PlanningError(
                f"No se encontró el fichero de recetas en '{self.__RECIPES_PATH}'."
            )
        with self.__RECIPES_PATH.open("r", encoding="utf-8") as recipes_file:
            recetas = json.load(recipes_file)

        if not isinstance(recetas, list):
            raise PlanningError("El fichero de recetas no contiene una lista válida de recetas.")

    return [self.__normaliza_receta(receta) for receta in recetas]
```

---

## 3. TestGetSinHistorial — GET sin historial

Todas las pruebas de esta clase hacen un GET real a `/api/planificacion/semanal/` y validan la respuesta.

### 3.1 `test_devuelve_200_con_content_type_json`

Comprueba que el endpoint responde con código HTTP 200 y cabecera `Content-Type: application/json`.

#### Código del test

```python
def test_devuelve_200_con_content_type_json(self, flask_client):
    response = flask_client.get("/api/planificacion/semanal/")
    assert response.status_code == 200
    assert "application/json" in response.content_type
```

#### Código fuente correspondiente — `weekly_planning`

```python
# app.py
@app.route("/api/planificacion/semanal/", methods=["GET", "POST"])
def weekly_planning():
    dias_previos = None
    if request.method == "POST" and request.is_json:
        body = request.get_json(silent=True) or {}
        dias_previos = body.get("dias_previos") or None

    try:
        planificacion = API_planificacion().planifica(dias_previos=dias_previos)
    except InsufficientRecipesError as exc:
        return jsonify({"error": str(exc)}), 400
    except PlanningError as exc:
        return jsonify({"error": str(exc)}), 503

    return jsonify(planificacion), 200   # ← devuelve 200 + JSON
```

---

### 3.2 `test_estructura_7_dias_completa`

Verifica que la respuesta contiene exactamente 7 días con todos los campos requeridos en cada día.

#### Código del test

```python
def test_estructura_7_dias_completa(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    _assert_estructura_plan(payload, num_dias=7)
```

#### Código fuente correspondiente — `planifica`

La planificación genera exactamente `DIAS_TOTALES` (7 por defecto) días nuevos:

```python
# API_planificacion.py — planifica()
self.__DIAS_TOTALES = dias_totales  # valor por defecto: 7

...

for i in range(self.__DIAS_TOTALES):
    ...
    planificacion["dias"].append(dia)
```

---

### 3.3 `test_fuente_datos_json_sin_mongodb`

Confirma que cuando no hay MongoDB configurado el campo `fuente_datos` de la respuesta vale `"json"`.

#### Código del test

```python
def test_fuente_datos_json_sin_mongodb(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    assert payload["fuente_datos"] == "json"
```

#### Código fuente correspondiente — `__FUENTE_DATOS` y `__conectar_mongodb_si_esta_configurado`

```python
# API_planificacion.py
self.__FUENTE_DATOS = "json"   # valor por defecto al construir
self.__conectar_mongodb_si_esta_configurado()

def __conectar_mongodb_si_esta_configurado(self) -> None:
    if not self.__CONEXION:   # URI vacía → permanece "json"
        return
    try:
        ...
        self.__FUENTE_DATOS = "mongodb"
    except (PyMongoError, ValueError):
        self.__FUENTE_DATOS = "json"

# planifica() incluye este campo en la respuesta
planificacion: dict[str, Any] = {
    ...
    "fuente_datos": self.__FUENTE_DATOS,
    ...
}
```

---

### 3.4 `test_sin_repeticiones_14_dias`

Asegura que ningún plato de la planificación generada se repite dentro de la ventana de 14 días.

#### Código del test

```python
def test_sin_repeticiones_14_dias(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    _assert_sin_repeticiones(payload["dias"])
```

#### Código fuente correspondiente

Ver [`_assert_sin_repeticiones`](#_assert_sin_repeticiones) y la restricción de recencia explicada allí.

---

### 3.5 `test_cuotas_ventana_7_dias`

Verifica que las cuotas nutricionales se respetan en todas las ventanas deslizantes de 7 días de la planificación generada.

#### Código del test

```python
def test_cuotas_ventana_7_dias(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    _assert_cuotas_ventanas_7_dias(payload["dias"])
```

#### Código fuente correspondiente

Ver [`_assert_cuotas_ventanas_7_dias`](#_assert_cuotas_ventanas_7_dias) y `__selecciona_plato_con_cuotas` explicados arriba.

---

### 3.6 `test_14_platos_unicos`

Confirma que los 14 platos generados (7 días × comida + cena) son todos distintos entre sí.

#### Código del test

```python
def test_14_platos_unicos(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    ids = [
        _obtener_id_plato(dia[turno])
        for dia in payload["dias"]
        for turno in ("comida", "cena")
    ]
    assert len(ids) == 14
    assert len(set(ids)) == 14, "Platos duplicados detectados en la respuesta"
```

#### Código fuente correspondiente

Un GET genera 7 días × 2 turnos = 14 platos. La unicidad la garantiza la deque `ids_recientes` de longitud máxima 14 (ver [`_assert_sin_repeticiones`](#_assert_sin_repeticiones)).

---

### 3.7 `test_respuesta_json_re_serializable`

Comprueba que la respuesta no contiene tipos no serializables verificando que serializar y deserializar el JSON produce exactamente el mismo objeto.

#### Código del test

```python
def test_respuesta_json_re_serializable(self, flask_client):
    payload = flask_client.get("/api/planificacion/semanal/").get_json()
    reparsed = json.loads(json.dumps(payload, ensure_ascii=False))
    assert reparsed == payload
```

#### Código fuente correspondiente — `__normaliza_receta` y `__to_json_compatible`

Toda receta pasa por normalización para eliminar tipos no serializables (`ObjectId`, `datetime`, etc.):

```python
# API_planificacion.py
def __normaliza_receta(self, receta: dict[str, Any]) -> dict[str, Any]:
    return self.__to_json_compatible(deepcopy(receta))

def __to_json_compatible(self, value: Any) -> Any:
    if isinstance(value, dict):
        return {key: self.__to_json_compatible(inner_value) for key, inner_value in value.items()}
    if isinstance(value, list):
        return [self.__to_json_compatible(item) for item in value]
    if isinstance(value, tuple):
        return [self.__to_json_compatible(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)
```

---

### 3.8 `test_multiples_get_cumplen_restricciones`

Repite 20 peticiones GET independientes y valida que todas cumplen las restricciones de estructura, no-repetición y cuotas, garantizando robustez ante la aleatoriedad del algoritmo.

#### Código del test

```python
def test_multiples_get_cumplen_restricciones(self, flask_client):
    """Ejecuta ITERACIONES peticiones GET y valida restricciones en cada una."""
    fallos: list[str] = []
    for i in range(ITERACIONES):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        try:
            _assert_estructura_plan(payload, 7)
            _assert_sin_repeticiones(payload["dias"])
            _assert_cuotas_ventanas_7_dias(payload["dias"])
        except AssertionError as e:
            fallos.append(f"iter={i}: {e}")

    assert not fallos, (
        f"{len(fallos)} fallos en {ITERACIONES} iteraciones:\n"
        + "\n".join(fallos[:10])
    )
```

#### Código fuente correspondiente

Prueba de esfuerzo sobre el algoritmo completo (`planifica` + `__selecciona_plato_con_cuotas`). La aleatoriedad proviene del `random.Random()` sin semilla fija, lo que garantiza que el algoritmo es robusto con cualquier resultado aleatorio.

```python
# API_planificacion.py — constructor
self.__RNG = rng or random.Random()   # sin semilla → variabilidad real

# __selecciona_plato_con_cuotas — elección final
return deepcopy(self.__RNG.choice(candidatas_top))
```

---

## 4. TestPostConHistorial — POST con días previos

### 4.1 `test_estructura_con_dias_previos` (parametrizado con 1..7 días previos)

Verifica que el POST devuelve `min(n_previos + 7, 14)` días con estructura válida al enviar entre 1 y 7 días previos limpios.

#### Código del test

```python
@pytest.mark.parametrize("n_previos", DIAS_PREVIOS_VALUES)
def test_estructura_con_dias_previos(self, flask_client, n_previos):
    inicial = flask_client.get("/api/planificacion/semanal/").get_json()
    dias_previos = [_clean_dia(d) for d in inicial["dias"][:n_previos]]

    response = flask_client.post(
        "/api/planificacion/semanal/",
        json={"dias_previos": dias_previos},
    )
    assert response.status_code == 200

    payload = response.get_json()
    esperados = min(n_previos + 7, 14)
    _assert_estructura_plan(payload, esperados)
```

#### Código fuente correspondiente — `weekly_planning` (rama POST) y `planifica`

```python
# app.py — rama POST
if request.method == "POST" and request.is_json:
    body = request.get_json(silent=True) or {}
    dias_previos = body.get("dias_previos") or None
```

```python
# API_planificacion.py — planifica(), unión de días previos y nuevos
if dias_previos:
    todos_los_dias = list(dias_previos) + planificacion["dias"]
    max_dias = self.__DIAS_TOTALES * 2   # máximo 14
    if len(todos_los_dias) > max_dias:
        todos_los_dias = todos_los_dias[-max_dias:]
    planificacion["dias"] = todos_los_dias
```

La fórmula `min(n_previos + 7, 14)` refleja exactamente este recorte a `DIAS_TOTALES * 2`.

---

### 4.2 `test_sin_repeticiones_con_historial` (parametrizado con 1..7 días previos)

Asegura que los platos generados no repiten ninguno de los días previos enviados en el historial ni entre sí.

#### Código del test

```python
@pytest.mark.parametrize("n_previos", DIAS_PREVIOS_VALUES)
def test_sin_repeticiones_con_historial(self, flask_client, n_previos):
    inicial = flask_client.get("/api/planificacion/semanal/").get_json()
    dias_previos = [_clean_dia(d) for d in inicial["dias"][:n_previos]]

    payload = flask_client.post(
        "/api/planificacion/semanal/",
        json={"dias_previos": dias_previos},
    ).get_json()
    _assert_sin_repeticiones(payload["dias"])
```

#### Código fuente correspondiente — inicialización de `ids_recientes` con historial

```python
# API_planificacion.py — planifica()
ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)

if dias_previos:
    for dia in dias_previos:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                ids_recientes.append(self.__identificador_receta(plato))
```

Los identificadores de los días previos se cargan en `ids_recientes` antes de generar los nuevos días, por lo que el algoritmo los excluye como candidatos.

---

### 4.3 `test_cuotas_con_historial` (parametrizado con 1..7 días previos)

Comprueba que las cuotas nutricionales se cumplen en toda la planificación resultante al tener en cuenta los días previos del historial.

#### Código del test

```python
@pytest.mark.parametrize("n_previos", DIAS_PREVIOS_VALUES)
def test_cuotas_con_historial(self, flask_client, n_previos):
    inicial = flask_client.get("/api/planificacion/semanal/").get_json()
    dias_previos = [_clean_dia(d) for d in inicial["dias"][:n_previos]]

    payload = flask_client.post(
        "/api/planificacion/semanal/",
        json={"dias_previos": dias_previos},
    ).get_json()
    _assert_cuotas_ventanas_7_dias(payload["dias"])
```

#### Código fuente correspondiente — inicialización de la ventana de conteo con historial

```python
# API_planificacion.py — planifica()
conteo_ventana: dict[str, int] = {g: 0 for g in CUOTAS}
ventana_dias: deque[dict[str, Any]] = deque(maxlen=self.__DIAS_TOTALES)

if dias_previos:
    for dia in dias_previos[-self.__DIAS_TOTALES:]:
        ventana_dias.append(dia)
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                for tag in self.__tags_nutricionales(plato):
                    conteo_ventana[tag] += 1
```

Los últimos 7 días previos se cargan en la ventana deslizante para que el conteo de cuotas sea correcto desde el inicio de la nueva generación.

---

### 4.4 `test_cadena_regeneraciones`

Encadena 5 regeneraciones simulando el uso real del frontend (GET → POST → POST → …) y valida restricciones en cada paso.

#### Código del test

```python
def test_cadena_regeneraciones(self, flask_client):
    """Encadena 5 regeneraciones simulando uso real del frontend:
    GET → POST(3 previos) → POST(3 previos) → ..."""
    plan = flask_client.get("/api/planificacion/semanal/").get_json()
    _assert_sin_repeticiones(plan["dias"])
    _assert_cuotas_ventanas_7_dias(plan["dias"])

    for step in range(5):
        n_previos = 3
        dias_previos = [_clean_dia(d) for d in plan["dias"][:n_previos]]

        payload = flask_client.post(
            "/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
        ).get_json()

        _assert_estructura_plan(payload, n_previos + 7)
        _assert_sin_repeticiones(payload["dias"])
        _assert_cuotas_ventanas_7_dias(payload["dias"])

        plan = {"dias": payload["dias"][-7:]}
```

#### Código fuente correspondiente

Simula el uso encadenado real del frontend. Cada iteración pasa los últimos 3 días como historial. La limpieza de `_id`/`id` mediante `_clean_dia` replica la función `cleanDiaPlanning` del frontend TypeScript, y el campo `nombre` actúa de identificador:

```python
# test_integracion.py — _clean_receta (simulación del frontend)
def _clean_receta(receta: dict) -> dict:
    return {
        "nombre": receta.get("nombre", ""),
        "grupo_principal": receta.get("grupo_principal", ""),
        "ingredientes": receta.get("ingredientes", []),
        "pasos": receta.get("pasos", []),
        "tags": receta.get("tags", []),
    }
```

```python
# API_planificacion.py — __identificador_receta() prioriza nombre
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    for clave in ("nombre", "_id", "id"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)
```

---

### 4.5 `test_multiples_regeneraciones_validan_restricciones` (parametrizado con 1, 3, 7 días previos)

Realiza 20 regeneraciones encadenadas por cada tamaño de historial (1, 3 y 7 días) para verificar la robustez del algoritmo ante uso continuado.

#### Código del test

```python
@pytest.mark.parametrize("n_previos", [1, 3, 7])
def test_multiples_regeneraciones_validan_restricciones(self, flask_client, n_previos):
    """ITERACIONES regeneraciones encadenadas para comprobar robustez."""
    plan = flask_client.get("/api/planificacion/semanal/").get_json()
    fallos: list[str] = []

    for i in range(ITERACIONES):
        dias_previos = [_clean_dia(d) for d in plan["dias"][:n_previos]]
        payload = flask_client.post(
            "/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
        ).get_json()

        try:
            _assert_sin_repeticiones(payload["dias"])
            _assert_cuotas_ventanas_7_dias(payload["dias"])
        except AssertionError as e:
            fallos.append(f"iter={i}: {e}")

        plan = {"dias": payload["dias"][-7:]}

    assert not fallos, (
        f"{len(fallos)} fallos en {ITERACIONES} iteraciones "
        f"(n_previos={n_previos}):\n" + "\n".join(fallos[:10])
    )
```

#### Código fuente correspondiente

Prueba de esfuerzo del algoritmo completo (20 regeneraciones encadenadas por tamaño de historial). El código fuente relevante es la totalidad de `planifica` y `__selecciona_plato_con_cuotas` descritos en las secciones anteriores.

---

### 4.6 `test_post_sin_dias_previos_funciona_como_get`

Confirma que un POST con body vacío produce el mismo resultado que un GET: 7 días nuevos sin historial previo.

#### Código del test

```python
def test_post_sin_dias_previos_funciona_como_get(self, flask_client):
    """POST con body vacío o sin dias_previos se comporta como GET."""
    response = flask_client.post(
        "/api/planificacion/semanal/",
        json={},
    )
    assert response.status_code == 200
    payload = response.get_json()
    _assert_estructura_plan(payload, 7)
```

#### Código fuente correspondiente

```python
# app.py
dias_previos = None
if request.method == "POST" and request.is_json:
    body = request.get_json(silent=True) or {}
    dias_previos = body.get("dias_previos") or None  # {} → None

planificacion = API_planificacion().planifica(dias_previos=dias_previos)
```

```python
# API_planificacion.py — planifica()
def planifica(self, dias_previos: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    ...
    if dias_previos:   # None → no se inicializa historial
        ...
```

---

## 5. TestErroresHTTP — Manejo de errores

### 5.1 `test_recetas_insuficientes_devuelve_400`

Verifica que cuando el fichero JSON tiene menos recetas de las necesarias la API responde con HTTP 400 y un cuerpo con clave `"error"`.

#### Código del test

```python
def test_recetas_insuficientes_devuelve_400(self, tmp_path, monkeypatch):
    """Un fichero JSON con pocas recetas produce HTTP 400."""
    pocas = [{"nombre": "Único plato", "tags": ["verdura"]}]
    temp_file = tmp_path / "pocas.json"
    temp_file.write_text(json.dumps(pocas, ensure_ascii=False), encoding="utf-8")

    monkeypatch.setenv("MONGODB_URI", "")
    monkeypatch.setenv("RECETAS_JSON_PATH", str(temp_file))

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 400
    error_body = response.get_json()
    assert error_body is not None
    assert "error" in error_body
```

#### Código fuente correspondiente — `__recetas_suficientes` e `InsufficientRecipesError`

```python
# API_planificacion.py
class InsufficientRecipesError(PlanningError):
    """No hay suficientes recetas únicas para generar la semana completa."""

def __recetas_suficientes(self, total_recetas: int) -> bool:
    return total_recetas >= self.__DIAS_TOTALES * self.__COMIDAS_POR_DIA

# planifica()
if not self.__recetas_suficientes(len(recetas)):
    raise InsufficientRecipesError(
        "No hay suficientes recetas para planificar el menú semanal."
    )
```

```python
# app.py — la excepción se traduce a HTTP 400
except InsufficientRecipesError as exc:
    return jsonify({"error": str(exc)}), 400
```

---

### 5.2 `test_mongodb_inaccesible_devuelve_503`

Comprueba que cuando MongoDB está configurado pero no es alcanzable la API responde con HTTP 503 y un cuerpo con clave `"error"`.

#### Código del test

```python
def test_mongodb_inaccesible_devuelve_503(self, monkeypatch):
    """MongoDB inalcanzable produce HTTP 503."""
    monkeypatch.setenv("MONGODB_URI", "mongodb://127.0.0.1:1")
    monkeypatch.setenv("MONGODB_TIMEOUT_MS", "100")

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 503
    error_body = response.get_json()
    assert error_body is not None
    assert "error" in error_body
```

#### Código fuente correspondiente — conexión fallida y error en `__carga_recetas`

```python
# API_planificacion.py — __conectar_mongodb_si_esta_configurado()
# Si ping falla, la conexión queda en None pero __CONEXION no es vacía
try:
    client = MongoClient(self.__CONEXION, serverSelectionTimeoutMS=timeout_ms)
    client.admin.command("ping")
    ...
    self.__FUENTE_DATOS = "mongodb"
except (PyMongoError, ValueError):
    self.__CLIENT = None
    self.__RECETAS = None
    self.__FUENTE_DATOS = "json"   # fallback a JSON

# __carga_recetas() — pero __CONEXION sigue configurada, así que...
if self.__CONEXION:
    if self.__RECETAS is None:   # ← None por el fallo anterior
        raise PlanningError(
            "Se configuró MONGODB_URI, pero no se pudo conectar a MongoDB. "
            "Revisa URI, red y credenciales."
        )
```

```python
# app.py — PlanningError → HTTP 503
except PlanningError as exc:
    return jsonify({"error": str(exc)}), 503
```

---

## 6. TestConMongoDB — Integración con MongoDB real

> Estas pruebas se saltan automáticamente si PyMongo no está instalado o MongoDB no es accesible.

### 6.1 `test_get_con_mongodb_real_devuelve_plan_valido`

Verifica que con MongoDB real la planificación se genera correctamente, que `fuente_datos` vale `"mongodb"` y que se cumplen todas las restricciones.

#### Código del test

```python
def test_get_con_mongodb_real_devuelve_plan_valido(self, mongo_collection, monkeypatch):
    """GET con MongoDB real carga recetas y devuelve fuente_datos='mongodb'."""
    recetas = _load_real_recipes(limit=40, convert_ids=True)
    mongo_collection.insert_many(recetas)

    monkeypatch.setenv("MONGODB_URI", MONGODB_URI)
    monkeypatch.setenv("MONGODB_DB", TEST_DB)
    monkeypatch.setenv("MONGODB_COLLECTION", TEST_COLLECTION)

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["fuente_datos"] == "mongodb"
    _assert_estructura_plan(payload, 7)
    _assert_sin_repeticiones(payload["dias"])
    _assert_cuotas_ventanas_7_dias(payload["dias"])
```

#### Código fuente correspondiente — `__carga_recetas` rama MongoDB y `__FUENTE_DATOS`

```python
# API_planificacion.py — __carga_recetas(), rama MongoDB
if self.__CONEXION:
    ...
    recetas = list(self.__RECETAS.find({}))
    ...
    if not recetas:
        raise PlanningError("MongoDB está conectado pero la colección de recetas está vacía.")
...
return [self.__normaliza_receta(receta) for receta in recetas]

# planifica() incluye la fuente en la respuesta
planificacion: dict[str, Any] = {
    ...
    "fuente_datos": self.__FUENTE_DATOS,   # "mongodb"
    ...
}
```

---

### 6.2 `test_post_con_mongodb_real_respeta_historial`

Comprueba que el flujo POST con historial funciona sobre MongoDB real: genera 10 días (3 previos + 7 nuevos) respetando no-repetición y cuotas.

#### Código del test

```python
def test_post_con_mongodb_real_respeta_historial(self, mongo_collection, monkeypatch):
    """POST con MongoDB real y dias_previos limpios valida restricciones."""
    recetas = _load_real_recipes(limit=40, convert_ids=True)
    mongo_collection.insert_many(recetas)

    monkeypatch.setenv("MONGODB_URI", MONGODB_URI)
    monkeypatch.setenv("MONGODB_DB", TEST_DB)
    monkeypatch.setenv("MONGODB_COLLECTION", TEST_COLLECTION)

    app = create_app()
    client = app.test_client()

    inicial = client.get("/api/planificacion/semanal/").get_json()
    dias_previos = [_clean_dia(d) for d in inicial["dias"][:3]]

    response = client.post(
        "/api/planificacion/semanal/",
        json={"dias_previos": dias_previos},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["fuente_datos"] == "mongodb"
    _assert_estructura_plan(payload, 10)
    _assert_sin_repeticiones(payload["dias"])
    _assert_cuotas_ventanas_7_dias(payload["dias"])
```

#### Código fuente correspondiente

Combina la rama MongoDB de `__carga_recetas` con la lógica de historial en `planifica` (ya documentada en [`test_estructura_con_dias_previos`](#test_estructura_con_dias_previos-parametrizado-con-17-días-previos)). El resultado esperado es 10 días (3 previos + 7 nuevos ≤ 14).

---

### 6.3 `test_mongodb_vacia_devuelve_503`

Verifica que una colección MongoDB vacía provoca HTTP 503, ya que no hay recetas con las que generar la planificación.

#### Código del test

```python
def test_mongodb_vacia_devuelve_503(self, mongo_collection, monkeypatch):
    """Colección vacía en MongoDB produce HTTP 503."""
    mongo_collection.delete_many({})

    monkeypatch.setenv("MONGODB_URI", MONGODB_URI)
    monkeypatch.setenv("MONGODB_DB", TEST_DB)
    monkeypatch.setenv("MONGODB_COLLECTION", TEST_COLLECTION)

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 503
    assert response.get_json().get("error") is not None
```

#### Código fuente correspondiente — colección vacía en `__carga_recetas`

```python
# API_planificacion.py
recetas = list(self.__RECETAS.find({}))

if not recetas:
    raise PlanningError(
        "MongoDB está conectado pero la colección de recetas está vacía."
    )
```

```python
# app.py — PlanningError → HTTP 503
except PlanningError as exc:
    return jsonify({"error": str(exc)}), 503
```
