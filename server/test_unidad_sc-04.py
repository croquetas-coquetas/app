import json
import pytest
from unittest.mock import patch, mock_open
from pathlib import Path

# Nota: En un proyecto real, esta función debería estar en app.py 
# y aquí harías: from app import buscar_receta_por_id
def buscar_receta_por_id(recipe_id):
    recipes_path = Path(__file__).resolve().parent.parent / "recetas.json"
    with recipes_path.open("r", encoding="utf-8") as f:
        recipes = json.load(f)
    
    for recipe in recipes:
        if str(recipe.get("id")) == str(recipe_id):
            return recipe
    return None


class TestBuscadorRecetas:
    
    def test_buscar_receta_exito(self):
        recipe_data = [
            {
                "id": "123",
                "nombre": "Paella",
                "ingredientes": [
                    {"nombre": "Arroz", "cantidad": 400},
                    {"nombre": "Pollo", "cantidad": 1000},
                ],
            }
        ]
        
        with patch.object(Path, "open", mock_open(read_data=json.dumps(recipe_data))):
            result = buscar_receta_por_id("123")

        assert result is not None
        assert result["ingredientes"] == [
            {"nombre": "Arroz", "cantidad": 400},
            {"nombre": "Pollo", "cantidad": 1000},
        ]

    def test_buscar_receta_no_encontrada(self):
        recipe_data = [
            {
                "id": "999",
                "nombre": "Otra",
                "ingredientes": [],
            }
        ]
        
        with patch.object(Path, "open", mock_open(read_data=json.dumps(recipe_data))):
            result = buscar_receta_por_id("123")

        assert result is None

    def test_buscar_receta_lista_vacia(self):
        """Prueba qué pasa si el JSON no tiene ninguna receta"""
        with patch.object(Path, "open", mock_open(read_data=json.dumps([]))):
            result = buscar_receta_por_id("123")

        assert result is None

    def test_buscar_receta_error_bd_o_archivo(self):
        """Uso de pytest.raises para capturar excepciones limpiamente"""
        with patch.object(Path, "open", side_effect=Exception("Error de lectura")):
            # pytest comprueba automáticamente que la función lance esta excepción exacta
            with pytest.raises(Exception, match="Error de lectura"):
                buscar_receta_por_id("123")