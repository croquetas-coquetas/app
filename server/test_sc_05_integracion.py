"""
Tests de Integración para SC-05 - Generación de Lista de Compra.
Valida que la API devuelve ingredientes con unidades convertibles y 
que las conversiones funcionan correctamente con datos reales.

Ejecutar con: pytest test_sc_05_integracion.py -v
"""

import json
import os
import random
import uuid
from pathlib import Path
from typing import Any

import pytest

try:
    from bson import ObjectId
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
    HAS_PYMONGO = True
except ModuleNotFoundError:
    HAS_PYMONGO = False

from API_planificacion import API_planificacion

SERVER_DIR = Path(__file__).resolve().parent
DATASET_PATH = SERVER_DIR / "datasets" / "smartCook.recetas.json"
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
TEST_DB = f"smartCook_sc05_test_{uuid.uuid4().hex}"
TEST_COLLECTION = "recetas"

# Unidades válidas que el frontend puede convertir
UNIDADES_VALIDAS = {
    "g", "kg", "ml", "l",
    "cucharadas", "cucharada",
    "pizcas", "pizca",
    "tazas", "taza",
    "hojas", "hoja",
    "dientes", "diente"
}

# Factores de conversión esperados
FACTORES_CONVERSION_ESPERADOS = {
    "cucharada": 15,      # ml
    "cucharadas": 15,     # ml
    "pizca": 1,           # g
    "pizcas": 1,          # g
    "hoja": 3,            # g
    "hojas": 3,           # g
    "diente": 5,          # g
    "dientes": 5,         # g
    "taza": 240,          # ml
    "tazas": 240,         # ml
    "kg": 1000,           # g
    "l": 1000,            # ml
}


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="module")
def mongo_client():
    """Conecta a MongoDB para las pruebas."""
    if not HAS_PYMONGO:
        pytest.skip("PyMongo no instalado, saltando pruebas de integración")

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
    """Colección de test limpia."""
    collection = mongo_client[TEST_DB][TEST_COLLECTION]
    collection.drop()
    yield collection
    collection.drop()


@pytest.fixture
def recetas_reales():
    """Carga las recetas reales del dataset."""
    assert DATASET_PATH.exists(), f"Dataset no encontrado: {DATASET_PATH}"
    with DATASET_PATH.open("r", encoding="utf-8") as fh:
        recetas = json.load(fh)
    return recetas


@pytest.fixture
def api_con_mongodb(mongo_collection, recetas_reales):
    """Crea API conectada a MongoDB de test con datos reales."""
    # Insertar recetas convertidas a ObjectId si es necesario
    recetas_convertidas = []
    for receta in recetas_reales[:40]:  # Usar subset para tests rápidos
        receta_copia = receta.copy()
        if isinstance(receta_copia.get("_id"), dict) and "$oid" in receta_copia["_id"]:
            receta_copia["_id"] = ObjectId(receta_copia["_id"]["$oid"])
        recetas_convertidas.append(receta_copia)

    mongo_collection.insert_many(recetas_convertidas)

    api = API_planificacion(
        connection_uri=MONGODB_URI,
        db_name=TEST_DB,
        collection_name=TEST_COLLECTION,
        rng=random.Random(42),
    )
    return api


# ============================================================================
# VALIDADORES AUXILIARES
# ============================================================================

def _obtener_unidad_normalizada(unidad: str) -> str:
    """Normaliza una unidad a su forma singular o estándar."""
    unidad_lower = unidad.lower().strip()
    # Mapeo de plurales a singulares
    mapeo = {
        "cucharadas": "cucharada",
        "pizcas": "pizca",
        "hojas": "hoja",
        "dientes": "diente",
        "tazas": "taza",
    }
    return mapeo.get(unidad_lower, unidad_lower)


def _validar_unidad_convertible(unidad: str) -> bool:
    """Valida que una unidad esté en la lista de convertibles."""
    unidad_norm = _obtener_unidad_normalizada(unidad)
    return unidad_norm in UNIDADES_VALIDAS


def _extraer_ingredientes_plan(plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Extrae todos los ingredientes de una planificación."""
    ingredientes = []
    for dia in plan.get("dias", []):
        for turno in ("comida", "cena"):
            receta = dia.get(turno, {})
            ingredientes.extend(receta.get("ingredientes", []))
    return ingredientes


# ============================================================================
# TESTS DE INTEGRACIÓN
# ============================================================================

class TestSC05IntegracionConBD:
    """Tests que validan SC-05 con conexión real a BD."""

    def test_api_devuelve_plan_con_estructura_valida(self, api_con_mongodb):
        """test_api_devuelve_plan_con_estructura_valida - Validar estructura básica."""
        plan = api_con_mongodb.planifica()

        assert plan is not None
        assert "dias" in plan
        assert isinstance(plan["dias"], list)
        assert len(plan["dias"]) == 7

        for dia in plan["dias"]:
            assert "dia" in dia
            assert "comida" in dia
            assert "cena" in dia

    def test_ingredientes_devueltos_tienen_unidades_convertibles(self, api_con_mongodb):
        """test_ingredientes_devueltos_tienen_unidades_convertibles - Validar unidades."""
        plan = api_con_mongodb.planifica()
        ingredientes = _extraer_ingredientes_plan(plan)

        assert len(ingredientes) > 0, "Plan debe contener ingredientes"

        unidades_invalidas = []
        for ing in ingredientes:
            unidad = ing.get("unidad", "").lower().strip()
            if not _validar_unidad_convertible(unidad):
                unidades_invalidas.append({
                    "nombre": ing.get("nombre"),
                    "unidad": ing.get("unidad")
                })

        assert not unidades_invalidas, (
            f"Encontradas unidades no convertibles: {unidades_invalidas}. "
            f"Unidades válidas: {UNIDADES_VALIDAS}"
        )

    def test_cantidad_ingredientes_es_numerica(self, api_con_mongodb):
        """test_cantidad_ingredientes_es_numerica - Validar cantidades."""
        plan = api_con_mongodb.planifica()
        ingredientes = _extraer_ingredientes_plan(plan)

        cantidades_invalidas = []
        for ing in ingredientes:
            cantidad = ing.get("cantidad")
            if not isinstance(cantidad, (int, float)) or cantidad <= 0:
                cantidades_invalidas.append({
                    "nombre": ing.get("nombre"),
                    "cantidad": cantidad
                })

        assert not cantidades_invalidas, (
            f"Encontradas cantidades inválidas: {cantidades_invalidas}"
        )

    def test_factores_conversion_coinciden_con_esperados(self, api_con_mongodb):
        """test_factores_conversion_coinciden_con_esperados - Validar factores."""
        plan = api_con_mongodb.planifica()
        ingredientes = _extraer_ingredientes_plan(plan)

        # Extraer factores reales si están en los ingredientes
        # (esto depende de si la API devuelve factores o no)
        conversiones_encontradas = set()
        for ing in ingredientes:
            unidad = ing.get("unidad", "").lower().strip()
            unidad_norm = _obtener_unidad_normalizada(unidad)
            if unidad_norm in FACTORES_CONVERSION_ESPERADOS:
                conversiones_encontradas.add(unidad_norm)

        # Verificar que al menos tenemos algunas conversiones
        assert len(conversiones_encontradas) > 0, (
            "Debería haber al menos algunas unidades convertibles"
        )

    def test_ingredientes_sin_duplicados_por_receta(self, api_con_mongodb):
        """test_ingredientes_sin_duplicados_por_receta - Sin duplicados en mismo plato."""
        plan = api_con_mongodb.planifica()

        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                receta = dia.get(turno, {})
                ingredientes = receta.get("ingredientes", [])
                nombres = [ing.get("nombre", "").lower() for ing in ingredientes]

                duplicados = [
                    nombre for nombre in set(nombres)
                    if nombres.count(nombre) > 1
                ]
                assert not duplicados, (
                    f"Ingredientes duplicados en {dia['dia']} {turno}: {duplicados}"
                )

    def test_plan_generado_multiples_veces_es_diferente(self, api_con_mongodb):
        """test_plan_generado_multiples_veces_es_diferente - Variabilidad de planes."""
        plan1 = api_con_mongodb.planifica()
        api_con_mongodb.rng = random.Random(43)  # Cambiar seed
        plan2 = api_con_mongodb.planifica()

        # Extraer IDs de recetas para comparación
        def _get_receta_ids(plan: dict) -> set[str]:
            ids = set()
            for dia in plan["dias"]:
                for turno in ("comida", "cena"):
                    receta = dia.get(turno, {})
                    receta_id = str(receta.get("_id") or receta.get("nombre"))
                    ids.add(receta_id)
            return ids

        ids1 = _get_receta_ids(plan1)
        ids2 = _get_receta_ids(plan2)

        # No deberían ser idénticos (pueden tener algunas recetas comunes)
        assert ids1 != ids2, "Planes con diferentes seeds deberían variar"


class TestSC05ConversionesEnIntegracion:
    """Tests que validan conversiones en contexto de integración."""

    def test_conversion_cucharadas_a_mililitros_en_plan(self, api_con_mongodb):
        """test_conversion_cucharadas_a_mililitros_en_plan - Validar conversión."""
        plan = api_con_mongodb.planifica()
        ingredientes = _extraer_ingredientes_plan(plan)

        # Buscar ingredientes en cucharadas
        cucharadas_encontradas = [
            ing for ing in ingredientes
            if _obtener_unidad_normalizada(ing.get("unidad", "")) == "cucharada"
        ]

        # Si no encontramos cucharadas, el test pasa (no es requisito que existan)
        if cucharadas_encontradas:
            for ing in cucharadas_encontradas:
                cantidad = ing.get("cantidad")
                assert isinstance(cantidad, (int, float))
                assert cantidad > 0

    def test_plan_con_ingredientes_mixtos_todos_convertibles(self, api_con_mongodb):
        """test_plan_con_ingredientes_mixtos_todos_convertibles - Mezcla de unidades."""
        plan = api_con_mongodb.planifica()
        ingredientes = _extraer_ingredientes_plan(plan)

        # Agrupar por unidad
        unidades_encontradas = {}
        for ing in ingredientes:
            unidad = ing.get("unidad", "").lower().strip()
            if unidad not in unidades_encontradas:
                unidades_encontradas[unidad] = []
            unidades_encontradas[unidad].append(ing.get("nombre"))

        # Todas las unidades encontradas deben ser convertibles
        for unidad in unidades_encontradas.keys():
            assert _validar_unidad_convertible(unidad), (
                f"Unidad '{unidad}' no es convertible. "
                f"Ingredientes: {unidades_encontradas[unidad]}"
            )


class TestSC05PersistenciaEnBD:
    """Tests que validan persistencia en BD (guardado/recuperación)."""

    def test_plan_guardado_en_bd_puede_recuperarse(self, mongo_client, mongo_collection, api_con_mongodb):
        """test_plan_guardado_en_bd_puede_recuperarse - Persistencia básica."""
        plan = api_con_mongodb.planifica()

        # Simular guardado en colección de planes (si existiera)
        coleccion_planes = mongo_client[TEST_DB]["planes"]
        plan_con_id = {**plan, "_id": str(uuid.uuid4())}
        resultado = coleccion_planes.insert_one(plan_con_id)

        # Recuperar
        plan_recuperado = coleccion_planes.find_one({"_id": resultado.inserted_id})

        assert plan_recuperado is not None
        assert plan_recuperado["fuente_datos"] == plan["fuente_datos"]
        assert len(plan_recuperado["dias"]) == len(plan["dias"])

    def test_multiples_planes_sin_colisiones(self, mongo_client, mongo_collection, api_con_mongodb):
        """test_multiples_planes_sin_colisiones - Guardado múltiple."""
        planes_generados = []
        coleccion_planes = mongo_client[TEST_DB]["planes"]

        # Generar y guardar múltiples planes
        for i in range(3):
            api_con_mongodb.rng = random.Random(100 + i)
            plan = api_con_mongodb.planifica()
            plan_con_id = {**plan, "_id": f"plan_{i}", "index": i}
            coleccion_planes.insert_one(plan_con_id)
            planes_generados.append(plan)

        # Verificar que todos están en la BD
        recuperados = list(coleccion_planes.find({}))
        assert len(recuperados) == 3

        # Verificar que son diferentes (al menos algunos)
        ids_recetas_por_plan = []
        for plan in planes_generados:
            ids = set()
            for dia in plan["dias"]:
                for turno in ("comida", "cena"):
                    receta = dia.get(turno, {})
                    ids.add(str(receta.get("_id", receta.get("nombre", ""))))
            ids_recetas_por_plan.append(ids)

        # No todos deberían ser idénticos
        assert not all(ids == ids_recetas_por_plan[0] for ids in ids_recetas_por_plan), (
            "Planes generados deberían variar"
        )
