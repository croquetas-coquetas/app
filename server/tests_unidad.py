import json
import random
import tempfile
from collections import deque
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest


with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_planificacion import (
        API_planificacion,
        InsufficientRecipesError,
        PlanningError,
    )


def _receta(nombre: str, tags: list | None = None, id_: str | None = None) -> dict:
    r: dict = {"nombre": nombre}
    if id_ is not None:
        r["id"] = id_
    if tags is not None:
        r["tags"] = tags
    return r


def _recetas(n: int, tag: str | None = None) -> list[dict]:
    return [_receta(f"plato_{i}", tags=[tag] if tag else None) for i in range(n)]


def _api_con_json(recetas: list[dict], *, dias=7, comidas=2, umbral=1, seed=0) -> API_planificacion:

    with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(recetas, f, ensure_ascii=False)
        ruta = Path(f.name)

    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None,
            recipes_path=ruta,
            dias_totales=dias,
            comidas_por_dia=comidas,
            umbral_dias=umbral,
            rng=random.Random(seed),
        )


def _api_bare() -> API_planificacion:
    """Instancia mínima sólo para llamar a métodos privados directamente."""
    with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(_recetas(14), f)
        ruta = Path(f.name)

    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(connection_uri=None, recipes_path=ruta, rng=random.Random(0))


class TestRecetasSuficientes:
    """Comprueba el umbral: total >= dias_totales * comidas_por_dia."""

    def test_exactamente_en_el_limite_es_suficiente(self):
        api = _api_con_json(_recetas(14))
        assert api._API_planificacion__recetas_suficientes(14) is True

    def test_cero_recetas_no_es_suficiente(self):
        api = _api_con_json(_recetas(14))
        assert api._API_planificacion__recetas_suficientes(0) is False

    def test_limite_con_configuracion_distinta(self):
        api = _api_con_json(_recetas(15), dias=5, comidas=3)
        assert api._API_planificacion__recetas_suficientes(15) is True
        assert api._API_planificacion__recetas_suficientes(14) is False


class TestSeleccionaSiguientePlato:

    def setup_method(self):
        self.api = _api_bare()
        self._m = self.api._API_planificacion__selecciona_siguiente_plato

    def test_excluye_recetas_ya_usadas(self):
        recetas = [_receta(f"p{i}") for i in range(3)]
        ids_usados = {"p0", "p1"}
        plato = self._m(recetas, ids_usados, deque())
        assert plato["nombre"] == "p2"

    def test_excluye_recetas_con_tag_prohibido(self):
        recetas = [
            _receta("pasta", tags=["italiano"]),
            _receta("pizza", tags=["italiano"]),
            _receta("sushi", tags=["japones"]),
        ]
        plato = self._m(recetas, set(), deque(["italiano"]))
        assert plato["nombre"] == "sushi"

    def test_lanza_error_si_no_quedan_recetas(self):
        recetas = [_receta("solo")]
        with pytest.raises(InsufficientRecipesError):
            self._m(recetas, {"solo"}, deque())

    def test_lista_recetas_vacia_lanza_error(self):
        with pytest.raises(InsufficientRecipesError):
            self._m([], set(), deque())

    def test_receta_sin_tag_no_queda_bloqueada_por_prohibicion(self):
        recetas = [
            _receta("sin_tag"),
            _receta("con_tag", tags=["A"]),
        ]
        plato = self._m(recetas, set(), deque(["A"]))
        assert plato["nombre"] == "sin_tag"

    def test_selecciona_aleatoriamente_entre_candidatas(self):
        """Con múltiples candidatas válidas, no siempre elige la primera."""
        recetas = _recetas(10)
        nombres = {self._m(recetas, set(), deque())["nombre"] for _ in range(30)}
        assert len(nombres) > 1


