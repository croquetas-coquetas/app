#!/usr/bin/env python
import os
import sys

from app import app


if __name__ == "__main__":
    # Compatibilidad básica con invocaciones antiguas como: python manage.py runserver
    if len(sys.argv) > 1 and sys.argv[1] not in {"runserver", ""}:
        print("Comando no soportado. Usa: python manage.py o python app.py")
        raise SystemExit(2)

    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host=host, port=port, debug=debug)

