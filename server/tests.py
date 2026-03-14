from pathlib import Path
import random
import unittest

from app import create_app

from API_planificacion import API_planificacion


class APIPlanificacionTests(unittest.TestCase):
    def test_planifica_con_datos_locales_devuelve_toda_la_semana(self):
        planner = API_planificacion(
            connection_uri="",
            recipes_path=Path(__file__).resolve().parents[1] / "recetas.json",
            rng=random.Random(1234),
        )

        planificacion = planner.planifica()

        self.assertEqual(planificacion["fuente_datos"], "json")
        self.assertEqual(len(planificacion["dias"]), 7)
        self.assertNotIn("restricciones", planificacion)

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


class WeeklyPlanningViewTests(unittest.TestCase):
    def setUp(self):
        app = create_app()
        app.testing = True
        self.client = app.test_client()

    def test_endpoint_devuelve_planificacion_semanal_en_json(self):
        response = self.client.get("/api/planificacion/semanal/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type.split(";")[0], "application/json")

        payload = response.get_json()
        self.assertEqual(len(payload["dias"]), 7)
        self.assertIn("generado_en", payload)
        self.assertIn("fuente_datos", payload)
        self.assertIn("ingredientes", payload["dias"][0]["comida"])
        self.assertIn("pasos", payload["dias"][0]["cena"])


if __name__ == "__main__":
    unittest.main()
