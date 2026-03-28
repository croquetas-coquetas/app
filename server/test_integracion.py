import json
import random
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_planificacion import API_planificacion, InsufficientRecipesError, PlanningError


def _receta(nombre: str, tags: list[str] | None = None) -> dict:
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


def _api_json(recetas: list[dict], *, dias=7, comidas=2, seed=0) -> API_planificacion:
    ruta = _json_temporal(recetas)
    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None,
            recipes_path=ruta,
            dias_totales=dias,
            comidas_por_dia=comidas,
            rng=random.Random(seed),
        )


def _api_mongo(recetas_mongo: list[dict], *, dias=7, comidas=2, seed=0) -> API_planificacion:
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
            rng=random.Random(seed),
        )
    return api


class TestIntegracionMongo:
    def test_coleccion_vacia_lanza_planning_error(self):
        """Una colección vacía debe lanzar PlanningError."""
        api = _api_mongo([])
        with pytest.raises(PlanningError, match="vacía"):
            api.planifica()

    def test_error_en_find_lanza_planning_error(self):
        """Error de MongoDB debe propagarse como PlanningError."""
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
        """Recetas sin el campo 'tags' no deben causar error."""
        recetas = [_receta(f"r{i}") for i in range(14)]
        api = _api_json(recetas)
        resultado = api.planifica()
        assert len(resultado["dias"]) == 7

    def test_platos_son_copias_independientes(self):
        """Modificar un plato no altera la lista interna de recetas."""
        api = _api_json(_pool(14))
        resultado = api.planifica()
        nombre_original = resultado["dias"][0]["comida"]["nombre"]
        
        # Modificar el resultado
        resultado["dias"][0]["comida"]["nombre"] = "MODIFICADO"
        
        # Segunda planificación no debe verse afectada
        resultado2 = api.planifica()
        assert resultado2["dias"][0]["comida"]["nombre"] != "MODIFICADO"


class TestVentanaRepeticiones:
    def test_no_repite_platos_en_ventana_de_14_dias(self):
        """No debe repetir platos en los últimos 14 días."""
        # Crear suficientes recetas únicas
        recetas = [_receta(f"plato_{i}") for i in range(20)]
        api = _api_json(recetas, dias=7, comidas=2, seed=42)
        
        resultado = api.planifica()
        
        # Extraer todos los IDs de platos
        ids_platos = []
        for dia in resultado["dias"]:
            ids_platos.append(dia["comida"]["nombre"])
            ids_platos.append(dia["cena"]["nombre"])
        
        # Verificar que no hay repeticiones (con 14 platos y 20 recetas no debería haber)
        assert len(ids_platos) == len(set(ids_platos)), "Hay platos repetidos en la semana"


class TestRestriccionesNutricionales:
    def test_cumple_cuotas_minimas(self):
        """Debe cumplir con las cuotas mínimas de cada grupo nutricional."""
        # Crear recetas con tags variados
        recetas = []
        for i in range(10):
            recetas.append(_receta(f"carne_{i}", tags=["carne"]))
            recetas.append(_receta(f"pescado_{i}", tags=["pescado"]))
            recetas.append(_receta(f"verdura_{i}", tags=["verdura"]))
            recetas.append(_receta(f"cereal_{i}", tags=["cereal"]))
            recetas.append(_receta(f"legumbre_{i}", tags=["legumbre"]))
        
        api = _api_json(recetas, dias=7, comidas=2, seed=123)
        resultado = api.planifica()
        
        # Contar tags
        conteo = {"carne": 0, "pescado": 0, "verdura": 0, "cereal": 0, "legumbre": 0}
        for dia in resultado["dias"]:
            for plato in [dia["comida"], dia["cena"]]:
                for tag in plato.get("tags", []):
                    if tag in conteo:
                        conteo[tag] += 1
        
        # Verificar mínimos (según CUOTAS en el código original)
        assert conteo["carne"] >= 2
        assert conteo["pescado"] >= 2
        assert conteo["verdura"] >= 7
        assert conteo["cereal"] >= 3
        assert conteo["legumbre"] >= 1


class TestIntegracionHistorial:
    def test_incorpora_dias_previos_correctamente(self):
        """Debe respetar el historial de días previos."""
        recetas = [_receta(f"plato_{i}") for i in range(30)]
        api = _api_json(recetas, dias=7, comidas=2, seed=42)
        
        # Crear días previos
        dias_previos = [
            {
                "comida": _receta("prev_comida", tags=["carne"]),
                "cena": _receta("prev_cena", tags=["pescado"])
            }
            for _ in range(3)
        ]
        
        resultado = api.planifica(dias_previos=dias_previos)
        
        # Verificar que los días previos están incluidos
        assert len(resultado["dias"]) == 10  # 3 previos + 7 nuevos
        assert resultado["dias"][0]["comida"]["nombre"] == "prev_comida"
        
        # Verificar que los platos previos no se repiten en la nueva semana
        nombres_nuevos = []
        for dia in resultado["dias"][3:]:  # Saltar los 3 previos
            nombres_nuevos.append(dia["comida"]["nombre"])
            nombres_nuevos.append(dia["cena"]["nombre"])
        
        assert "prev_comida" not in nombres_nuevos
        assert "prev_cena" not in nombres_nuevos


class TestManejoErrores:
    def test_recetas_insuficientes_lanza_excepcion(self):
        """Menos recetas que platos necesarios debe lanzar InsufficientRecipesError."""
        recetas = [_receta(f"plato_{i}") for i in range(10)]  # Necesita 14
        api = _api_json(recetas, dias=7, comidas=2)
        
        with pytest.raises(InsufficientRecipesError):
            api.planifica()
    
    def test_json_invalido_lanza_planning_error(self):
        """Archivo JSON corrupto debe lanzar PlanningError."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("{esto no es json válido")
            ruta = Path(f.name)
        
        with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
            api = API_planificacion(
                connection_uri=None,
                recipes_path=ruta,
            )
            
            with pytest.raises(PlanningError):
                api.planifica()
