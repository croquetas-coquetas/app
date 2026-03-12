from pathlib import Path
import random

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from API_planificacion import API_planificacion


class APIPlanificacionTests(SimpleTestCase):
    def test_planifica_con_datos_locales_devuelve_toda_la_semana(self):
        planner = API_planificacion(
            connection_uri="",
            recipes_path=Path(__file__).resolve().parents[2] / "recetas.json",
            rng=random.Random(1234),
        )

        planificacion = planner.planifica()

        self.assertEqual(planificacion["fuente_datos"], "json")
        self.assertEqual(len(planificacion["dias"]), 7)
        self.assertEqual(planificacion["restricciones"]["comidas_por_dia"], 2)

        ids_recetas = []
        for dia in planificacion["dias"]:
            for tipo_comida in ("comida", "cena"):
                receta = dia[tipo_comida]
                self.assertIn("nombre", receta)
                self.assertIn("descripcion", receta)
                self.assertIn("ingredientes", receta)
                self.assertIn("pasos", receta)
                ids_recetas.append(receta["id"])

        self.assertEqual(len(ids_recetas), len(set(ids_recetas)))


class WeeklyPlanningViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_endpoint_devuelve_planificacion_semanal_en_json(self):
        response = self.client.get("/api/planificacion/semanal/", format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"].split(";")[0], "application/json")

        payload = response.json()
        self.assertEqual(len(payload["dias"]), 7)
        self.assertIn("generado_en", payload)
        self.assertIn("fuente_datos", payload)
        self.assertIn("ingredientes", payload["dias"][0]["comida"])
        self.assertIn("pasos", payload["dias"][0]["cena"])

