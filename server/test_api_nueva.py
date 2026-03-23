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
    from API_nueva import API_planificacion, InsufficientRecipesError, PlanningError, CUOTAS

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
        return API_planificacion(connection_uri=None, recipes_path=ruta, dias_totales=dias, comidas_por_dia=comidas, rng=random.Random(seed))

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

class TestNormalizacionYConversion:
    def setup_method(self):
        self.api = _api_bare()
        self._norm = self.api._API_planificacion__normaliza_receta

    def test_normaliza_objectid_a_string(self):
        oid = ObjectId()
        assert self._norm({"_id": oid, "nombre": "test"})["_id"] == str(oid)

    def test_normaliza_datetime_a_isoformat(self):
        assert "2024-01-15T10:30:00" in self._norm({"nombre": "test", "fecha": datetime(2024, 1, 15, 10, 30, 0)})["fecha"]

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
        assert "pescado" in tags and "fruto seco" in tags

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
            _api_con_json(_recetas(5)).planifica()

class TestIdentificadorReceta:
    def setup_method(self):
        self.api = _api_bare()
        self._id = self.api._API_planificacion__identificador_receta

    def test_prefiere_underscore_id(self):
        assert self._id({"_id": "oid_val", "id": "id_val", "nombre": "test"}) == "oid_val"

    def test_prefiere_id_si_no_existe_underscore_id(self):
        assert self._id({"id": "id_val", "nombre": "test"}) == "id_val"

    def test_usa_nombre_como_fallback(self):
        assert self._id({"nombre": "nombre_val"}) == "nombre_val"

    def test_usa_json_como_ultimo_recurso(self):
        assert "ingredientes" in self._id({"ingredientes": ["a", "b"]})
    def test_prefiere_underscore_id(self):
        # En la API real, _id tiene prioridad sobre id
        assert self._id({"_id": "oid_val", "id": "id_val", "nombre": "test"}) == "oid_val"

    def test_prefiere_id_si_no_existe_underscore_id(self):
        assert self._id({"id": "id_val", "nombre": "test"}) == "id_val"
    def test_prefiere_underscore_id_si_no_existe_id(self):
        assert self._id({"_id": "oid_val", "nombre": "test"}) == "oid_val"

    def test_usa_nombre_como_fallback(self):
        assert self._id({"nombre": "nombre_val"}) == "nombre_val"

    def test_usa_json_como_ultimo_recurso(self):
        assert "ingredientes" in self._id({"ingredientes": ["a", "b"]})

class TestSeleccionPlaticonCuotas:
    def setup_method(self):
        self.api = _api_bare()
        self._m = self.api._API_planificacion__selecciona_plato_con_cuotas

    def test_excluye_recetas_recientes(self):
        recetas = [_receta("p0", categoria="pasta"), _receta("p1", categoria="arroz"), _receta("p2", categoria="carne")]
        assert self._m(recetas, deque(["p0", "p1"], maxlen=14), {g: 0 for g in CUOTAS}, 1)["nombre"] == "p2"

    def test_prioriza_grupos_urgentes(self):
        recetas = [_receta("pollo", categoria="carne"), _receta("pasta", categoria="pasta"), _receta("ensalada", categoria="ensalada")]
        conteo = {g: 0 for g in CUOTAS}
        conteo.update({"carne": 1, "cereal": 3, "verdura": 7})
        plato = self._m(recetas, deque(maxlen=14), conteo, 13)
        assert self.api._API_planificacion__tags(plato)[0] == "carne" or plato["nombre"] == "pollo"

    def test_evita_grupos_bloqueados(self):
        recetas = [_receta("pollo", categoria="carne"), _receta("salmón", categoria="pescado"), _receta("lenteja", categoria="legumbre")]
        conteo = {g: 0 for g in CUOTAS}
        conteo["carne"] = CUOTAS["carne"]["max"]
        tags = self.api._API_planificacion__tags(self._m(recetas, deque(maxlen=14), conteo, 1))
        if tags: assert tags[0] != "carne"

    def test_scoring_segun_deuda_nutricional(self):
        recetas = [_receta("salmón_con_almendras", categoria="pescado"), _receta("solo_pasta", categoria="pasta")]
        elegidos = [self._m(recetas, deque(maxlen=14), {g: 0 for g in CUOTAS}, 1)["nombre"] for _ in range(10)]
        assert elegidos.count("salmón_con_almendras") >= 5

    def test_fallback_si_filters_vacios(self):
        recetas = [_receta(f"p{i}") for i in range(5)]
        assert self._m(recetas, deque([r["nombre"] for r in recetas], maxlen=15), {g: 0 for g in CUOTAS}, 1) in recetas

    def test_selecciona_aleatoriamente_entre_mejores(self):
        recetas = _recetas(10, categoria="pasta")
        assert len({self._m(recetas, deque(maxlen=14), {g: 0 for g in CUOTAS}, 1)["nombre"] for _ in range(20)}) > 1

class TestPlanificacionCompleta:
    def test_planifica_7_dias_2_comidas(self):
        plan = _api_con_json(_recetas(20)).planifica()
        assert len(plan["dias"]) == 7
        for dia in plan["dias"]:
            assert "comida" in dia and "cena" in dia and "dia" in dia

    def test_incluye_metadatos(self):
        plan = _api_con_json(_recetas(20)).planifica()
        assert all(k in plan for k in ("generado_en", "fuente_datos", "total_recetas_disponibles"))
        assert plan["fuente_datos"] == "json"

    def test_no_repite_platos_en_14_dias(self):
        plan = _api_con_json(_recetas(50), dias=7, comidas=2).planifica()
        nombres = [dia[turno]["nombre"] for dia in plan["dias"] for turno in ("comida", "cena")]
        assert len(nombres) == 14 and len(set(nombres)) == 14

    def test_respeta_cuotas_minimas_y_maximas(self):
        # Creamos recetas para TODOS los grupos de la cuota
        recetas = _recetas(30, categoria="pasta")  # Cereal
        recetas += [_receta(f"pollo_{i}", categoria="carne") for i in range(5)]
        recetas += [_receta(f"salmón_{i}", categoria="pescado") for i in range(5)]
        recetas += [_receta(f"verdura_{i}", categoria="ensalada") for i in range(5)]
        recetas += [_receta(f"queso_{i}", categoria="postre") for i in range(5)]  # Lácteo
        recetas += [_receta(f"lenteja_{i}", categoria="legumbre") for i in range(5)]
        recetas += [_receta(f"nueces_{i}", ingredientes=[{"nombre": "nuez"}]) for i in range(5)]  # Fruto seco
        recetas += [_receta(f"tortilla_{i}", categoria="huevos") for i in range(5)]  # Huevo
        
        plan = _api_con_json(recetas, dias=7, comidas=2).planifica()
        conteo = {g: 0 for g in CUOTAS}
        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                tags = dia[turno].get("tags", [])
                if tags and tags[0] in CUOTAS: conteo[tags[0]] += 1
        
        for grupo, cuota in CUOTAS.items():
            assert cuota["min"] <= conteo.get(grupo, 0) <= cuota["max"]

    def test_añade_tags_a_platos(self):
        # Pasamos 15 recetas genéricas + 2 específicas para llegar al mínimo de 14
        recetas = _recetas(15) + [_receta("Pasta", categoria="pasta"), _receta("Pollo", categoria="carne")]
        plan = _api_con_json(recetas).planifica()
        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                assert isinstance(dia[turno].get("tags"), list)
    def test_reproducibilidad_con_seed(self):
        recetas = _recetas(30) + [_receta(f"pollo_{i}", categoria="carne") for i in range(5)] + [_receta(f"salmón_{i}", categoria="pescado") for i in range(5)]
        plan1 = _api_con_json(recetas, seed=42).planifica()
        plan2 = _api_con_json(recetas, seed=42).planifica()
        assert [d["comida"]["nombre"] for d in plan1["dias"]] == [d["comida"]["nombre"] for d in plan2["dias"]]

    def test_diferentes_seeds_producen_diferentes_resultados(self):
        recetas = _recetas(30) + [_receta(f"pollo_{i}", categoria="carne") for i in range(5)] + [_receta(f"salmón_{i}", categoria="pescado") for i in range(5)]
        plan1 = _api_con_json(recetas, seed=42).planifica()
        plan2 = _api_con_json(recetas, seed=999).planifica()
        assert [d["comida"]["nombre"] for d in plan1["dias"]] != [d["comida"]["nombre"] for d in plan2["dias"]]

    def test_planificacion_es_json_serializable(self):
        assert json.loads(json.dumps(_api_con_json(_recetas(20)).planifica(), default=str)) is not None