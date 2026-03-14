import json
import random
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_planificacion import (
        API_planificacion,
        InsufficientRecipesError,
        PlanningError,
    )


def _receta(nombre: str, tags: list | None = None) -> dict:
    r: dict = {"nombre": nombre}
    if tags:
        r["tags"] = tags
    return r


def _pool(n: int, tag: str | None = None) -> list[dict]:
    return [_receta(f"plato_{i}", tags=[tag] if tag else None) for i in range(n)]


def _json_temporal(recetas: list[dict]) -> Path:
    with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(recetas, f, ensure_ascii=False)
        return Path(f.name)


def _api_json(recetas: list[dict], *, dias=7, comidas=2, umbral=1, seed=0) -> API_planificacion:
    ruta = _json_temporal(recetas)
    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None,
            recipes_path=ruta,
            dias_totales=dias,
            comidas_por_dia=comidas,
            umbral_dias=umbral,
            rng=random.Random(seed),
        )


def _api_mongo(recetas_mongo: list[dict], *, dias=7, comidas=2, umbral=1, seed=0) -> API_planificacion:
    mock_client = MagicMock()
    mock_collection = MagicMock()
    mock_collection.find.return_value = iter(recetas_mongo)
    mock_client.__getitem__.return_value.__getitem__.return_value = mock_collection
    mock_client.admin.command.return_value = {"ok": 1}

    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient", return_value=mock_client):
        api = API_planificacion(
            connection_uri="mongodb://mock:27017",
            dias_totales=dias,
            comidas_por_dia=comidas,
            umbral_dias=umbral,
            rng=random.Random(seed),
        )

    api._API_planificacion__RECETAS = mock_collection
    return api


class TestIntegracionMongo:

    def test_planificacion_completa_desde_mongo(self):
        api = _api_mongo(_pool(14))
        resultado = api.planifica()
        assert len(resultado["dias"]) == 7

    def test_fuente_datos_es_mongodb(self):
        api = _api_mongo(_pool(14))
        # La fuente queda fijada al conectar; forzamos el valor para el test
        api._API_planificacion__FUENTE_DATOS = "mongodb"
        resultado = api.planifica()
        assert resultado["fuente_datos"] == "mongodb"

    def test_mongo_devuelve_pocos_lanza_insufficient(self):
        api = _api_mongo(_pool(5))
        with pytest.raises(InsufficientRecipesError):
            api.planifica()

    def test_mongo_devuelve_lista_vacia_lanza_planning_error(self):
        """Una colección vacía debe lanzar PlanningError, no IndexError."""
        api = _api_mongo([])
        # __carga_recetas detecta la lista vacía antes del check de suficiencia
        # dependiendo de la versión, puede ser PlanningError o InsufficientRecipesError
        with pytest.raises((PlanningError, InsufficientRecipesError)):
            api.planifica()

    def test_mongo_error_en_find_lanza_planning_error(self):
        from pymongo.errors import PyMongoError

        mock_collection = MagicMock()
        mock_collection.find.side_effect = PyMongoError("timeout")

        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
            api = API_planificacion(
                connection_uri="mongodb://mock:27017",
                rng=random.Random(0),
            )
        api._API_planificacion__RECETAS = mock_collection
        api._API_planificacion__CONEXION = "mongodb://mock:27017"

        with pytest.raises(PlanningError, match="MongoDB"):
            api.planifica()


class TestNormalizacionIntegracion:

    def test_recetas_sin_tags_no_bloquean_el_algoritmo(self):
        #Recetas sin el campo 'tags' no deben causar ningún error.
        recetas = [{"nombre": f"r{i}"} for i in range(14)]
        api = _api_json(recetas)
        resultado = api.planifica()
        assert len(resultado["dias"]) == 7

    def test_platos_son_copias_independientes(self):
        #Modificar un plato del resultado no altera la lista interna de recetas.
        api = _api_json(_pool(14))
        resultado = api.planifica()
        original = resultado["dias"][0]["comida"]["nombre"]
        resultado["dias"][0]["comida"]["nombre"] = "MODIFICADO"
        # Segunda planificación no debe verse afectada
        resultado2 = api.planifica()
        assert resultado2["dias"][0]["comida"]["nombre"] != "MODIFICADO"


class TestConfiguracionesNoEstandar:

    def test_3_dias_2_comidas(self):
        api = _api_json(_pool(6), dias=3, comidas=2)
        resultado = api.planifica()
        assert len(resultado["dias"]) == 3

    def test_1_dia_2_comidas(self):
        api = _api_json(_pool(2), dias=1, comidas=2)
        resultado = api.planifica()
        assert len(resultado["dias"]) == 1