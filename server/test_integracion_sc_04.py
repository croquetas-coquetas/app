"""
Tests de integración para el endpoint de ingredientes de SC-04.
Valida que el endpoint devuelve correctamente los ingredientes de una receta.

Ejecutar con: pytest test_integracion_sc_04.py -v
"""
import pytest
from unittest.mock import patch
from app import create_app

# Constantes
ENDPOINT_INGREDIENTES = "/api/recetas/{recipe_id}/ingredientes/"
VALID_RECIPE_ID = "123"
MISSING_RECIPE_ID = "999"


def _assert_ingredientes_response_valid(response_data: dict) -> None:
    """Valida que la respuesta tiene la estructura correcta de ingredientes."""
    assert "ingredientes" in response_data, "Falta la clave 'ingredientes' en respuesta"
    assert isinstance(response_data["ingredientes"], list), "'ingredientes' debe ser una lista"


def _assert_error_response_valid(response_data: dict) -> None:
    """Valida que la respuesta de error tiene la estructura correcta."""
    assert "error" in response_data, "Falta la clave 'error' en respuesta de error"
    assert isinstance(response_data["error"], str), "'error' debe ser string"


@pytest.fixture(scope="module")
def flask_app():
    """Crea la aplicación Flask para las pruebas."""
    return create_app()


@pytest.fixture(scope="module")
def flask_client(flask_app):
    """Crea un cliente de prueba de Flask."""
    return flask_app.test_client()


class TestIntegracionEndpointIngredientes:
    """Tests de integración para GET /api/recetas/<id>/ingredientes/"""

    @patch("app.API_planificacion._API_planificacion__carga_recetas")
    def test_devuelve_ingredientes_exito(self, mock_carga_recetas, flask_client):
        """
        Cuando una receta existe, el endpoint devuelve 200 con sus ingredientes.
        Valida: status 200, headers, estructura de respuesta y contenido.
        """
        # Setup: Simulamos la BD con una receta válida
        mock_carga_recetas.return_value = [
            {
                "id": VALID_RECIPE_ID,
                "nombre": "Paella",
                "ingredientes": [
                    {"nombre": "Arroz", "cantidad": 400},
                    {"nombre": "Pollo", "cantidad": 500}
                ]
            }
        ]
        
        # Ejecutar
        response = flask_client.get(ENDPOINT_INGREDIENTES.format(recipe_id=VALID_RECIPE_ID))
        
        # Validar
        assert response.status_code == 200
        assert response.content_type == "application/json"
        
        data = response.get_json()
        _assert_ingredientes_response_valid(data)
        
        # Validar contenido específico
        ingredientes = data["ingredientes"]
        assert len(ingredientes) == 2
        assert ingredientes[0]["nombre"] == "Arroz"
        assert ingredientes[1]["cantidad"] == 500

    @patch("app.API_planificacion._API_planificacion__carga_recetas")
    def test_ingredientes_lista_vacia(self, mock_carga_recetas, flask_client):
        """
        Cuando una receta sin ingredientes existe, devuelve lista vacía (200).
        """
        mock_carga_recetas.return_value = [
            {
                "id": VALID_RECIPE_ID,
                "nombre": "Sopa vacía",
                "ingredientes": []
            }
        ]
        
        response = flask_client.get(ENDPOINT_INGREDIENTES.format(recipe_id=VALID_RECIPE_ID))
        
        assert response.status_code == 200
        data = response.get_json()
        _assert_ingredientes_response_valid(data)
        assert data["ingredientes"] == []

    @patch("app.API_planificacion._API_planificacion__carga_recetas")
    def test_receta_no_encontrada_lanza_404(self, mock_carga_recetas, flask_client):
        """
        Cuando una receta no existe, el endpoint devuelve 404 con mensaje de error.
        """
        mock_carga_recetas.return_value = [
            {
                "id": "111",
                "nombre": "Otra receta",
                "ingredientes": []
            }
        ]
        
        response = flask_client.get(ENDPOINT_INGREDIENTES.format(recipe_id=MISSING_RECIPE_ID))
        
        assert response.status_code == 404
        assert response.content_type == "application/json"
        
        data = response.get_json()
        _assert_error_response_valid(data)

    @patch("app.API_planificacion._API_planificacion__carga_recetas")
    def test_error_bd_lanza_503(self, mock_carga_recetas, flask_client):
        """
        Cuando la BD falla, el endpoint devuelve 503 con error.
        """
        mock_carga_recetas.side_effect = Exception("Timeout en MongoDB")
        
        response = flask_client.get(ENDPOINT_INGREDIENTES.format(recipe_id=VALID_RECIPE_ID))
        
        assert response.status_code == 503
        assert response.content_type == "application/json"
        
        data = response.get_json()
        _assert_error_response_valid(data)
        assert "Timeout" in data["error"]

    @patch("app.API_planificacion._API_planificacion__carga_recetas")
    def test_id_numerico_se_compara_como_string(self, mock_carga_recetas, flask_client):
        """
        El ID se trata como string, soporta búsqueda con IDs numéricos.
        """
        mock_carga_recetas.return_value = [
            {
                "id": 123,  # ID como número en BD
                "nombre": "Plato numérico",
                "ingredientes": [{"nombre": "Test", "cantidad": 1}]
            }
        ]
        
        # Buscar con string "123"
        response = flask_client.get(ENDPOINT_INGREDIENTES.format(recipe_id="123"))
        
        assert response.status_code == 200
        assert len(response.get_json()["ingredientes"]) == 1