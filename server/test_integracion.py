import json
import os
import random
import tempfile
import uuid
from copy import deepcopy
from pathlib import Path

import pytest

flask = pytest.importorskip("flask")
from app import create_app
from API_planificacion import API_planificacion, CUOTAS, InsufficientRecipesError, PlanningError

try:
    from bson import ObjectId
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
    HAS_PYMONGO = True
except ModuleNotFoundError:
    HAS_PYMONGO = False

SERVER_DIR = Path(__file__).resolve().parent
DATASET_PATH = SERVER_DIR / "datasets" / "smartCook.recetas.json"
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
TEST_DB = f"smartCook_integration_test_{uuid.uuid4().hex}"
TEST_COLLECTION = "recetas"


def _ensure_json_recipe_file(path: Path) -> None:
    assert path.exists(), f"Fichero de recetas no encontrado: {path}"


def _assert_plan_contract(planificacion: dict[str, object], source: str) -> None:
    assert planificacion["fuente_datos"] == source
    assert planificacion["total_recetas_disponibles"] >= 14
    assert isinstance(planificacion["dias"], list)
    assert len(planificacion["dias"]) == 7

    for dia in planificacion["dias"]:
        assert "dia" in dia
        assert "comida" in dia
        assert "cena" in dia


def _assert_no_repetitions(planificacion: dict[str, object]) -> None:
    receta_ids: set[str] = set()

    for dia in planificacion["dias"]:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            assert plato is not None
            receta_id = _recipe_identity(plato)
            assert receta_id not in receta_ids, f"Plato repetido: {receta_id}"
            receta_ids.add(receta_id)


def _assert_quotas_windows(planificacion: dict[str, object]) -> None:
    dias = planificacion["dias"]
    assert len(dias) >= 7

    for inicio in range(len(dias) - 6):
        ventana = dias[inicio:inicio + 7]
        conteo = {grupo: 0 for grupo in CUOTAS}

        for dia in ventana:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if not plato:
                    continue
                for tag in _valid_tags(plato):
                    conteo[tag] += 1

        for grupo, cuota in CUOTAS.items():
            assert cuota["min"] <= conteo[grupo] <= cuota["max"], (
                f"Ventana [{inicio}:{inicio + 7}] fuera de cuota para '{grupo}': "
                f"{conteo[grupo]} not in [{cuota['min']}, {cuota['max']}]"
            )


def _valid_tags(plato: dict[str, object]) -> list[str]:
    return [tag for tag in plato.get("tags", []) if tag in CUOTAS]


def _recipe_identity(plato: dict[str, object]) -> str:
    for key in ("_id", "id", "nombre"):
        if key in plato and plato[key] is not None:
            return str(plato[key])
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def _load_real_recipes(limit: int | None = None, convert_ids: bool = False) -> list[dict[str, object]]:
    _ensure_json_recipe_file(DATASET_PATH)
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


@pytest.fixture(scope="module")
def flask_app():
    return create_app()


@pytest.fixture(scope="module")
def flask_client(flask_app):
    return flask_app.test_client()


@pytest.fixture
def temp_env_file():
    env_path = SERVER_DIR / ".env"
    original = None
    if env_path.exists():
        original = env_path.read_text(encoding="utf-8")

    try:
        yield env_path, original
    finally:
        if original is None and env_path.exists():
            env_path.unlink()
        elif original is not None:
            env_path.write_text(original, encoding="utf-8")


@pytest.fixture(scope="module")
def mongo_client():
    if not HAS_PYMONGO:
        pytest.skip("PyMongo no instalado, saltando pruebas de integraciÃ³n con MongoDB")

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
    collection = mongo_client[TEST_DB][TEST_COLLECTION]
    collection.drop()
    yield collection
    collection.drop()


def test_api_planificacion_json_integration_lee_fichero_real_y_generar_plan():
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.delenv("RECETAS_JSON_PATH", raising=False)
    try:
        api = API_planificacion(connection_uri=None, recipes_path=DATASET_PATH, rng=random.Random(0))
        plan = api.planifica()
    finally:
        monkeypatch.undo()

    assert plan["fuente_datos"] == "json"
    _assert_plan_contract(plan, source="json")
    _assert_no_repetitions(plan)
    _assert_quotas_windows(plan)


def test_flask_api_json_chain_sin_mongodb_devuelve_200_y_json_valido(monkeypatch, flask_client):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.setenv("RECETAS_JSON_PATH", str(DATASET_PATH))

    response = flask_client.get("/api/planificacion/semanal/")
    assert response.status_code == 200

    payload = response.get_json()
    assert payload is not None
    assert payload["fuente_datos"] == "json"
    _assert_plan_contract(payload, source="json")
    _assert_no_repetitions(payload)
    _assert_quotas_windows(payload)


def test_flask_api_post_con_dias_previos_transmite_la_lista_json(monkeypatch, flask_client):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.setenv("RECETAS_JSON_PATH", str(DATASET_PATH))

    initial = flask_client.get("/api/planificacion/semanal/").get_json()
    dias_previos = initial["dias"][:2]

    response = flask_client.post(
        "/api/planificacion/semanal/",
        json={"dias_previos": dias_previos},
    )
    assert response.status_code == 200

    payload = response.get_json()
    assert payload is not None
    assert len(payload["dias"]) == 9
    assert payload["fuente_datos"] == "json"
    _assert_no_repetitions(payload)
    _assert_quotas_windows(payload)


def test_dotenv_integra_configuracion_y_api_planificacion(tmp_path, temp_env_file, monkeypatch):
    env_path, original = temp_env_file
    env_contents = f"RECETAS_JSON_PATH={DATASET_PATH}\nMONGODB_URI=\n"
    env_path.write_text(env_contents, encoding="utf-8")

    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.delenv("RECETAS_JSON_PATH", raising=False)

    api = API_planificacion()
    plan = api.planifica()

    assert plan["fuente_datos"] == "json"
    _assert_plan_contract(plan, source="json")


def test_flask_api_devuelve_400_con_recetas_insuficientes(tmp_path, monkeypatch):
    temp_file = tmp_path / "pocas_recetas.json"
    receitas = [{"nombre": "Solo plato", "tags": ["verdura"]}]
    temp_file.write_text(json.dumps(receitas, ensure_ascii=False), encoding="utf-8")

    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.setenv("RECETAS_JSON_PATH", str(temp_file))

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 400
    assert response.get_json().get("error") is not None


def test_flask_api_devuelve_503_con_mongodb_inaccesible(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://127.0.0.1:1")
    monkeypatch.setenv("MONGODB_TIMEOUT_MS", "100")

    app = create_app()
    client = app.test_client()
    response = client.get("/api/planificacion/semanal/")

    assert response.status_code == 503
    assert response.get_json().get("error") is not None


@pytest.mark.skipif(not HAS_PYMONGO, reason="PyMongo no instalado")
def test_api_planificacion_con_mongodb_real_carga_recetas_y_planifica(mongo_collection):
    recetas = _load_real_recipes(limit=40, convert_ids=True)
    mongo_collection.insert_many(recetas)

    api = API_planificacion(
        connection_uri=MONGODB_URI,
        db_name=TEST_DB,
        collection_name=TEST_COLLECTION,
        rng=random.Random(0),
    )

    plan = api.planifica()
    assert plan["fuente_datos"] == "mongodb"
    _assert_plan_contract(plan, source="mongodb")
    _assert_no_repetitions(plan)
    _assert_quotas_windows(plan)


@pytest.mark.skipif(not HAS_PYMONGO, reason="PyMongo no instalado")
def test_api_planificacion_con_mongodb_vacia_lanza_planning_error(mongo_collection):
    mongo_collection.delete_many({})
    api = API_planificacion(
        connection_uri=MONGODB_URI,
        db_name=TEST_DB,
        collection_name=TEST_COLLECTION,
        rng=random.Random(0),
    )

    with pytest.raises(PlanningError):
        api.planifica()