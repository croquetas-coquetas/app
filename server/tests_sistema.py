import json
import random
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_planificacion import (
        API_planificacion,
        InsufficientRecipesError,
        PlanningError,
    )


TIPOS_COCINA = ["italiano", "japones", "mexicano", "español", "frances", "asiatico"]
INGREDIENTES_BASE = ["pollo", "ternera", "salmón", "tofu", "lentejas", "garbanzos"]


def _receta_realista(nombre: str, tipo: str, calorias: int = 500) -> dict:
    """Receta con estructura similar a la de una app real."""
    return {
        "nombre": nombre,
        "tags": [tipo, "almuerzo"],
        "calorias": calorias,
        "ingredientes": [f"ingrediente_{i}" for i in range(4)],
        "tiempo_minutos": 30,
        "descripcion": f"Descripción de {nombre}",
    }


def _catalogo_realista(n_por_tipo: int = 5) -> list[dict]:
    """Catálogo con N recetas por tipo de cocina."""
    recetas = []
    for tipo in TIPOS_COCINA:
        for j in range(n_por_tipo):
            recetas.append(_receta_realista(f"{tipo}_{j}", tipo))
    return recetas


def _json_temporal(recetas: list) -> Path:
    with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(recetas, f, ensure_ascii=False, default=str)
        return Path(f.name)


def _sistema(recetas: list, *, dias=7, comidas=2, umbral=1, seed=None) -> API_planificacion:
    ruta = _json_temporal(recetas)
    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None,
            recipes_path=ruta,
            dias_totales=dias,
            comidas_por_dia=comidas,
            umbral_dias=umbral,
            rng=random.Random(seed) if seed is not None else random.Random(),
        )


def _extraer_nombres(resultado: dict) -> list[str]:
    nombres = []
    for dia in resultado["dias"]:
        nombres.append(dia["comida"]["nombre"])
        nombres.append(dia["cena"]["nombre"])
    return nombres


def _extraer_tags(resultado: dict) -> list[str | None]:
    tags = []
    for dia in resultado["dias"]:
        for slot in ("comida", "cena"):
            t = dia[slot].get("tags")
            tags.append(t[0] if isinstance(t, list) and t else None)
    return tags


class TestEscenariosReales:

    def test_menu_semanal_completo(self):
        api = _sistema(_catalogo_realista(n_por_tipo=5))
        resultado = api.planifica()
        assert len(resultado["dias"]) == 7

    def test_no_se_repite_ningun_plato_en_la_semana(self):
        api = _sistema(_catalogo_realista(n_por_tipo=5), seed=42)
        nombres = _extraer_nombres(api.planifica())
        assert len(nombres) == len(set(nombres)), "Hay platos repetidos"

    def test_restriccion_tags_no_repeticion_consecutiva(self):
        api = _sistema(_catalogo_realista(n_por_tipo=5), umbral=1, seed=10)
        tags = _extraer_tags(api.planifica())
        for i in range(len(tags) - 1):
            a, b = tags[i], tags[i + 1]
            if a is not None and b is not None:
                assert a != b, f"Tipo '{a}' repetido en posiciones {i} y {i+1}"


class TestFallosSistema:

    def test_sin_recetas_lanza_insufficient(self):
        api = _sistema([])
        with pytest.raises(InsufficientRecipesError):
            api.planifica()

    def test_recetas_insuficientes_lanza_insufficient(self):
        for n in range(1, 14):
            api = _sistema([{"nombre": f"r{i}"} for i in range(n)])
            with pytest.raises(InsufficientRecipesError):
                api.planifica()


class TestMultiplesSemanas:

    def test_cuatro_semanas_siempre_generan_14_platos(self):
        api = _sistema(_catalogo_realista(n_por_tipo=5))
        for _ in range(4):
            resultado = api.planifica()
            nombres = _extraer_nombres(resultado)
            assert len(nombres) == 14
            assert len(set(nombres)) == 14


class TestCasosLimiteCatalogo:

    def test_todos_los_platos_tienen_nombre(self):
        api = _sistema(_catalogo_realista())
        resultado = api.planifica()
        for dia in resultado["dias"]:
            assert dia["comida"].get("nombre"), "comida sin nombre"
            assert dia["cena"].get("nombre"), "cena sin nombre"
