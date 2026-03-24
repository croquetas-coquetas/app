import os

from flask import Flask, jsonify, request

#from API_planificacion import API_planificacion, InsufficientRecipesError, PlanningError
from API_nueva import API_planificacion, InsufficientRecipesError, PlanningError

def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/api/planificacion/semanal/", methods=["GET", "POST"])
    def weekly_planning():
        dias_previos = None
        if request.method == "POST" and request.is_json:
            body = request.get_json(silent=True) or {}
            dias_previos = body.get("dias_previos") or None

        try:
            planificacion = API_planificacion().planifica(dias_previos=dias_previos)
        except InsufficientRecipesError as exc:
            return jsonify({"error": str(exc)}), 400
        except PlanningError as exc:
            return jsonify({"error": str(exc)}), 503

        return jsonify(planificacion), 200

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host=host, port=port, debug=debug)