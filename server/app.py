import os

from flask import Flask, jsonify

#from API_planificacion import API_planificacion, InsufficientRecipesError, PlanningError
from API_nueva import API_planificacion, InsufficientRecipesError, PlanningError

def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/api/planificacion/semanal/")
    def weekly_planning():
        try:
            planificacion = API_planificacion().planifica()
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