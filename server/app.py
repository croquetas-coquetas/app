import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from API_planificacion import (
    API_planificacion,
    InsufficientRecipesError,
    InsufficientRecipesAfterDurationFilterError,
    NoCompatibleRecipesError,
    PlanningError,
    TagConstraintViolationError,
)

def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)  # NO TOCAR

    def _minutos_disponibles(rango: dict | None) -> int | None:
        """Extrae los minutos disponibles de un rango horario (inicio/fin)."""
        if not isinstance(rango, dict):
            return None
        try:
            h1, m1 = map(int, rango["inicio"].split(":"))
            h2, m2 = map(int, rango["fin"].split(":"))
            minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
            return minutos if minutos > 0 else None
        except (KeyError, ValueError, TypeError):
            return None

    @app.route("/api/planificacion/semanal/", methods=["GET", "POST"])
    def weekly_planning():
        dias_previos = None
        horarios = None
        ignorar_duracion = False

        if request.method == "POST" and request.is_json:
            body = request.get_json(silent=True) or {}
            dias_previos = body.get("dias_previos") or None
            horarios = body.get("horarios")
            ignorar_duracion = body.get("ignorar_duracion", False)

        # Extraer límites de duración del rango horario
        duracion_max_comida = None
        duracion_max_cena = None

        if horarios and isinstance(horarios, dict) and not ignorar_duracion:
            duracion_max_comida = _minutos_disponibles(horarios.get("comida"))
            duracion_max_cena = _minutos_disponibles(horarios.get("cena"))

        try:
            planificacion = API_planificacion().planifica(
                dias_previos=dias_previos,
                duracion_max_comida=duracion_max_comida,
                duracion_max_cena=duracion_max_cena,
            )
        except NoCompatibleRecipesError as exc:
            return (
                jsonify({
                    "error": str(exc),
                    "error_code": exc.error_code,
                    "turno": exc.turno,
                }),
                409,
            )
        except InsufficientRecipesAfterDurationFilterError as exc:
            return (
                jsonify({
                    "error": str(exc),
                    "error_code": "INSUFFICIENT_AFTER_DURATION_FILTER",
                }),
                400,
            )
        except InsufficientRecipesError as exc:
            return jsonify({"error": str(exc)}), 400
        except TagConstraintViolationError as exc:
            return jsonify({"error": str(exc)}), 400
        except PlanningError as exc:
            return jsonify({"error": str(exc)}), 503

        return jsonify(planificacion), 200

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.get("/api/ingredientes/")
    def get_ingredients():
        try:
            ingredientes = API_planificacion().get_ingredientes()
        except PlanningError as exc:
            return jsonify({"error": str(exc)}), 503

        return jsonify(ingredientes), 200

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host=host, port=port, debug=debug)