import json
import random
import tempfile
from collections import deque
from copy import deepcopy
from datetime import datetime, date
from pathlib import Path
from unittest.mock import patch, MagicMock
from bson import ObjectId

import pytest

with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_nueva import (
        API_planificacion,
        InsufficientRecipesError,
        PlanningError,
        CUOTAS,
    )


def _receta(nombre: str, tags: list | None = None, id_: str | None = None, categoria: str | None = None, ingredientes: list | None = None) -> dict:
    r: dict = {"nombre": nombre}
    if id_ is not None: r["id"] = id_
    if tags is not None: r["tags"] = tags
    if categoria is not None: r["categoria"] = categoria
    if ingredientes is not None: r["ingredientes"] = ingredientes
    return r


def _recetas(n: int, tag: str | None = None, categoria: str | None = None) -> list[dict]:
    return [_receta(f"plato_{i}", tags=[tag] if tag else None, categoria=categoria) for i in range(n)]


def _api_con_json(recetas: list[dict], *, dias=7, comidas=2, seed=0) -> API_planificacion:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(recetas, f, ensure_ascii=False)
        ruta = Path(f.name)

    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None, recipes_path=ruta, dias_totales=dias,
            comidas_por_dia=comidas, rng=random.Random(seed)
        )


def _api_bare() -> API_planificacion:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(_recetas(14), f)
        ruta = Path(f.name)

    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(connection_uri=None, recipes_path=ruta, rng=random.Random(0))


class TestCargaRecetasJSON:
    def test_carga_correcta_desde_json(self):
        cargadas = _api_con_json(_recetas(5))._API_planificacion__carga_recetas()
        assert len(cargadas) == 5
        assert all(isinstance(r, dict) for r in cargadas)

    def test_archivo_json_inexistente_lanza_error(self):
        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
            api = API_planificacion(connection_uri=None, recipes_path="/ruta/inexistente/recetas.json", rng=random.Random(0))
        with pytest.raises(PlanningError, match="No se encontró"):
            api._API_planificacion__carga_recetas()

    def test_json_no_es_lista_lanza_error(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump({"recetas": []}, f)
            ruta = Path(f.name)
        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
            api = API_planificacion(connection_uri=None, recipes_path=ruta)
        with pytest.raises(PlanningError, match="no contiene una lista"):
            api._API_planificacion__carga_recetas()

    def test_json_vacio_es_lista_valida(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump([], f)
            ruta = Path(f.name)
        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
            assert API_planificacion(connection_uri=None, recipes_path=ruta)._API_planificacion__carga_recetas() == []

# no lo carga de mongo, usa el magic ese
class TestCargaRecetasMongoDb: 
    def test_conexion_exitosa_a_mongodb(self):
        mock_collection = MagicMock()
        mock_collection.find.return_value = [_receta("pasta")]
        mock_client = MagicMock()
        mock_client.__getitem__.return_value.__getitem__.return_value = mock_collection
        mock_client.admin.command.return_value = None

        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient", return_value=mock_client):
            api = API_planificacion(connection_uri="mongodb://localhost:27017", db_name="db", collection_name="col", rng=random.Random(0))

        cargadas = api._API_planificacion__carga_recetas()
        assert len(cargadas) == 1
        assert cargadas[0]["nombre"] == "pasta"

    def test_mongodb_vacio_lanza_error(self):
        mock_client = MagicMock()
        mock_client.admin.command.return_value = None
        mock_client.__getitem__.return_value.__getitem__.return_value.find.return_value = []

        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient", return_value=mock_client):
            api = API_planificacion(connection_uri="mongodb://localhost:27017", db_name="db", collection_name="col")

        with pytest.raises(PlanningError, match="colección.*vacía"):
            api._API_planificacion__carga_recetas()

    def test_fallback_a_json_si_mongodb_falla(self):
        mock_client = MagicMock()
        mock_client.admin.command.side_effect = Exception("Connection refused")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(_recetas(5), f)
            ruta = Path(f.name)

        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient", return_value=mock_client):
            api = API_planificacion(connection_uri="mongodb://invalid", recipes_path=ruta, rng=random.Random(0))

        assert len(api._API_planificacion__carga_recetas()) == 5


class TestNormalizacionYConversion:
    def setup_method(self):
        self.api = _api_bare()
        self._norm = self.api._API_planificacion__normaliza_receta

    def test_normaliza_objectid_a_string(self):
        oid = ObjectId()
        assert self._norm({"_id": oid, "nombre": "test"})["_id"] == str(oid)

    def test_normaliza_datetime_a_isoformat(self):
        normalizada = self._norm({"nombre": "test", "fecha": datetime(2024, 1, 15, 10, 30, 0)})
        assert "2024-01-15T10:30:00" in normalizada["fecha"]

    def test_normaliza_date_a_isoformat(self):
        assert "2024-01-15" in self._norm({"nombre": "test", "fecha": date(2024, 1, 15)})["fecha"]

    def test_normaliza_tipos_anidados(self):
        normalizada = self._norm({"nombre": "test", "ingredientes": [{"_id": ObjectId()}, {"_id": ObjectId()}]})
        assert isinstance(normalizada["ingredientes"][0]["_id"], str)
        assert isinstance(normalizada["ingredientes"][1]["_id"], str)

    def test_copia_profunda_no_afecta_original(self):
        oid = ObjectId()
        receta = {"_id": oid, "nombre": "test"}
        normalizada = self._norm(receta)
        assert isinstance(receta["_id"], ObjectId)
        assert isinstance(normalizada["_id"], str)


class TestDeteccionTags:
    def setup_method(self):
        self.api = _api_bare()
        self._tags = self.api._API_planificacion__tags

    def test_detecta_por_nombre_prioridad_maxima(self):
        assert "verdura" in self._tags(_receta("Pasta Berenjenas", categoria="carnes", ingredientes=[{"nombre": "pollo"}]))

    def test_detecta_por_ingredientes(self):
        assert "pescado" in self._tags(_receta("Plato X", ingredientes=[{"nombre": "merluza"}, {"nombre": "espinaca"}]))

    def test_detecta_por_categoria_mapeo(self):
        assert "cereal" in self._tags(_receta("Plato", categoria="pasta"))

    def test_multiples_tags_en_receta(self):
        tags = self._tags(_receta("Salmón con Almendras", ingredientes=[{"nombre": "merluza"}]))
        assert "pescado" in tags
        assert "fruto seco" in tags

    def test_sin_tags_retorna_lista_vacia(self):
        assert self._tags(_receta("Plato genérico")) == []

    def test_tags_ordenados_alfabeticamente(self):
        tags = self._tags(_receta("Carne con Pescado", ingredientes=[{"nombre": "atún"}]))
        assert tags == sorted(tags)

    def test_detecta_variantes_de_nombres(self):
        assert "verdura" in self._tags(_receta("Berenjanas Rellenas"))

    def test_ingredientes_caso_insensible(self):
        assert "pescado" in self._tags(_receta("Plato", ingredientes=[{"nombre": "MERLUZA"}]))


class TestSuficienciaRecetas:
    def test_exactamente_en_limite_es_suficiente(self):
        assert _api_con_json(_recetas(14))._API_planificacion__recetas_suficientes(14) is True

    def test_una_mas_que_limite_es_suficiente(self):
        assert _api_con_json(_recetas(15))._API_planificacion__recetas_suficientes(15) is True

    def test_cero_recetas_no_es_suficiente(self):
        assert _api_con_json(_recetas(14))._API_planificacion__recetas_suficientes(0) is False

    def test_una_menos_que_limite_no_es_suficiente(self):
        assert _api_con_json(_recetas(14))._API_planificacion__recetas_suficientes(13) is False

    def test_limite_con_configuracion_distinta(self):
        api = _api_con_json(_recetas(20), dias=5, comidas=3)
        assert api._API_planificacion__recetas_suficientes(15) is True
        assert api._API_planificacion__recetas_suficientes(14) is False

    def test_planificacion_lanza_error_si_insuficiente(self):
        with pytest.raises(InsufficientRecipesError):