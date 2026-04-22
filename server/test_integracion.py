"""
Tests de integración — API de planificación semanal.

Verifican la cadena completa a través de peticiones HTTP al test client de Flask:
  HTTP request → Flask routing → API_planificacion → datos (JSON / MongoDB) → HTTP response

Diferencia con tests de unidad (test_unidad.py):
  - NO se instancia API_planificacion directamente.
  - Todas las validaciones pasan por el endpoint HTTP.
  - Se simula el flujo del frontend (cleanDiaPlanning: quitar _id/id).
  - No se controla la semilla aleatoria (el algoritmo debe ser robusto con cualquiera).

Diferencia con tests de sistema (test_sistema.py):
  - Se usa el test client in-process de Flask (sin subproceso, sin red TCP).

Ejecutar con:  pytest test_integracion.py -v --tb=short
"""

import json
import os
import uuid
from copy import deepcopy
from pathlib import Path

import pytest

from app import create_app
from API_planificacion import CUOTAS

try:
    from bson import ObjectId
    from pymongo import MongoClient
    HAS_PYMONGO = True
except ModuleNotFoundError:
    HAS_PYMONGO = False


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

SERVER_DIR = Path(__file__).resolve().parent
DATASET_PATH = SERVER_DIR / "datasets" / "smartCook.recetas.json"
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
TEST_DB = f"smartCook_integration_test_{uuid.uuid4().hex}"
TEST_COLLECTION = "recetas"

ITERACIONES = 20  # iteraciones para tests de esfuerzo
DIAS_PREVIOS_VALUES = [1, 2, 3, 4, 5, 6, 7]


# ============================================================================
# SIMULACIÓN DEL FRONTEND — cleanDiaPlanning
# ============================================================================

def _clean_receta(receta: dict) -> dict:
    """Replica cleanDiaPlanning del frontend TypeScript.

    Solo conserva: nombre, grupo_principal, ingredientes, pasos, tags.
    Elimina: _id, id, y cualquier otro campo extra.
    """
    return {
        "nombre": receta.get("nombre", ""),
        "grupo_principal": receta.get("grupo_principal", ""),
        "ingredientes": receta.get("ingredientes", []),
        "pasos": receta.get("pasos", []),
        "tags": receta.get("tags", []),
    }


def _clean_dia(dia: dict) -> dict:
    """Limpia un día completo como lo haría el frontend antes de enviarlo."""
    return {
        "dia": dia["dia"],
        "comida": _clean_receta(dia["comida"]),
        "cena": _clean_receta(dia["cena"]),
    }


# ============================================================================
# HELPERS DE VALIDACIÓN
# ============================================================================

def _obtener_id_plato(plato: dict) -> str:
    """Identificador de plato consistente con el algoritmo: prioriza nombre."""
    for clave in ("nombre", "_id", "id"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def _tags_validos(plato: dict) -> list[str]:
    return [t for t in plato.get("tags", []) if t in CUOTAS]


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


def _load_real_recipes(limit: int | None = None, convert_ids: bool = False) -> list[dict]:
    """Carga recetas del fichero JSON real para tests de MongoDB."""
    with DATASET_PATH.open("r", encoding="utf-8") as fh:
        recetas = json.load(fh)
    if limit is not None:
        recetas = recetas[:limit]
    if convert_ids:
        converted = []
        for receta in recetas:
            copia = deepcopy(receta)
            if isinstance(copia.get("_id"), dict) and "$oid" in copia["_id"]:
                copia["_id"] = ObjectId(copia["_id"]["$oid"])
            converted.append(copia)
        return converted
    return deepcopy(recetas)


# ============================================================================
# FIXTURES
# ============================================================================

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


# ============================================================================
# TESTS — GET /api/planificacion/semanal/ (generación desde cero vía HTTP)
# ============================================================================

class TestGetSinHistorial:
    """GET /api/planificacion/semanal/ — generación desde cero.

    Cada test hace una petición GET real al endpoint a través del test client
    de Flask y valida la respuesta HTTP y el contrato del dominio.
    """

    def test_devuelve_200_con_content_type_json(self, flask_client):
        response = flask_client.get("/api/planificacion/semanal/")
        assert response.status_code == 200
        assert "application/json" in response.content_type

    def test_estructura_7_dias_completa(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        _assert_estructura_plan(payload, num_dias=7)

    def test_fuente_datos_json_sin_mongodb(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        assert payload["fuente_datos"] == "json"

    def test_sin_repeticiones_14_dias(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        _assert_sin_repeticiones(payload["dias"])

    def test_cuotas_ventana_7_dias(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        _assert_cuotas_ventanas_7_dias(payload["dias"])

    def test_14_platos_unicos(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        ids = [
            _obtener_id_plato(dia[turno])
            for dia in payload["dias"]
            for turno in ("comida", "cena")
        ]
        assert len(ids) == 14
        assert len(set(ids)) == 14, "Platos duplicados detectados en la respuesta"

    def test_respuesta_json_re_serializable(self, flask_client):
        payload = flask_client.get("/api/planificacion/semanal/").get_json()
        reparsed = json.loads(json.dumps(payload, ensure_ascii=False))
        assert reparsed == payload

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


# ============================================================================
# TESTS — POST con historial (flujo frontend simulado vía HTTP)
# ============================================================================

class TestPostConHistorial:
    """POST /api/planificacion/semanal/ — regeneración con días previos.

    Simula el flujo completo del frontend:
      1. GET primera planificación
      2. Limpiar días con cleanDiaPlanning (quitar _id/id, solo nombre+tags+...)
      3. POST con dias_previos limpios
      4. Validar la respuesta (dias_previos + 7 nuevos, máx 14)
    """

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

    @pytest.mark.parametrize("n_previos", DIAS_PREVIOS_VALUES)
    def test_sin_repeticiones_con_historial(self, flask_client, n_previos):
        inicial = flask_client.get("/api/planificacion/semanal/").get_json()
        dias_previos = [_clean_dia(d) for d in inicial["dias"][:n_previos]]

        payload = flask_client.post(
            "/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
        ).get_json()
        _assert_sin_repeticiones(payload["dias"])

    @pytest.mark.parametrize("n_previos", DIAS_PREVIOS_VALUES)
    def test_cuotas_con_historial(self, flask_client, n_previos):
        inicial = flask_client.get("/api/planificacion/semanal/").get_json()
        dias_previos = [_clean_dia(d) for d in inicial["dias"][:n_previos]]

        payload = flask_client.post(
            "/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
        ).get_json()
        _assert_cuotas_ventanas_7_dias(payload["dias"])

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

    def test_post_sin_dias_previos_funciona_como_get(self, flask_client):
        """POST con body vacío o sin dias_previos se comporta como GET."""
        response = flask_client.post(
            "/api/planificacion/semanal/",
            json={},
        )
        assert response.status_code == 200
        payload = response.get_json()
        _assert_estructura_plan(payload, 7)


# ============================================================================
# TESTS — Manejo de errores HTTP
# ============================================================================

class TestErroresHTTP:
    """Verifica que los errores de API_planificacion se propagan correctamente
    hasta la respuesta HTTP con los códigos de estado adecuados."""

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


# ============================================================================
# TESTS — Integración con MongoDB real (si disponible)
# ============================================================================

@pytest.mark.skipif(not HAS_PYMONGO, reason="PyMongo no instalado")
class TestConMongoDB:
    """Tests que verifican la cadena Flask → API_planificacion → MongoDB real.

    Se saltan automáticamente si MongoDB no está accesible o PyMongo no está
    instalado. Usan una base de datos temporal que se limpia al finalizar.
    """

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
