"""
Pruebas de sistema para la API de planificación semanal.

El servidor se trata como una CAJA NEGRA: se levanta como proceso independiente
y los tests hacen peticiones HTTP reales con `requests`.
No se importa ningún módulo del servidor.

Ejecutar:
    pytest tests_sistema.py -v --tb=short
"""

import json
import os
import signal
import socket
import subprocess
import sys
import time
from datetime import datetime

import pytest
import requests

# ============================================================================
# Configuración — solo datos públicos del contrato, no imports del servidor
# ============================================================================

HOST = "127.0.0.1"
PORT = 18765  # puerto alto para no colisionar
BASE_URL = f"http://{HOST}:{PORT}"
STARTUP_TIMEOUT = 15  # segundos máx para que el servidor arranque
REQUEST_TIMEOUT = 10  # segundos máx por petición

# Cuotas copiadas del contrato público (no se importan del servidor)
CUOTAS = {
    "verdura":    {"min": 7, "max": 14},
    "lácteo":     {"min": 2, "max": 5},
    "cereal":     {"min": 3, "max": 7},
    "legumbre":   {"min": 1, "max": 4},
    "fruto seco": {"min": 0, "max": 3},
    "pescado":    {"min": 2, "max": 5},
    "huevo":      {"min": 1, "max": 4},
    "carne":      {"min": 2, "max": 6},
}

TAGS_VALIDOS = set(CUOTAS.keys())

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))


# ============================================================================
# Fixture: levantar y apagar el servidor como proceso independiente
# ============================================================================

def _port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0


def _wait_for_server(url: str, timeout: float) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{url}/health", timeout=2)
            if r.status_code == 200:
                return
        except requests.ConnectionError:
            pass
        time.sleep(0.3)
    raise RuntimeError(f"El servidor no arrancó en {timeout}s en {url}")


@pytest.fixture(scope="module")
def servidor():
    """Levanta app.py como subproceso y lo mata al terminar."""
    assert _port_free(HOST, PORT), f"El puerto {PORT} ya está ocupado"

    env = os.environ.copy()
    env["FLASK_HOST"] = HOST
    env["FLASK_PORT"] = str(PORT)
    env["FLASK_DEBUG"] = "0"
    # Quitar MONGODB_URI para que use JSON (entorno controlado)
    env.pop("MONGODB_URI", None)

    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=SERVER_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    try:
        _wait_for_server(BASE_URL, STARTUP_TIMEOUT)
    except RuntimeError:
        proc.kill()
        stdout, stderr = proc.communicate(timeout=5)
        pytest.fail(
            f"El servidor no arrancó.\nstdout: {stdout.decode(errors='replace')}\n"
            f"stderr: {stderr.decode(errors='replace')}"
        )

    yield BASE_URL

    # Apagar el servidor
    if sys.platform == "win32":
        proc.send_signal(signal.CTRL_BREAK_EVENT)
    else:
        proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)


# ============================================================================
# Helpers de validación (solo operan sobre el JSON de respuesta)
# ============================================================================

def _obtener_id_plato(plato: dict) -> str:
    for clave in ("_id", "id", "nombre"):
        v = plato.get(clave)
        if v is not None:
            return str(v)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def _tags_plato(plato: dict) -> list[str]:
    return [t for t in plato.get("tags", []) if t in TAGS_VALIDOS]


def _assert_estructura_plan(payload: dict, num_dias: int) -> None:
    assert "dias" in payload
    assert "generado_en" in payload
    assert "fuente_datos" in payload
    assert "total_recetas_disponibles" in payload
    assert isinstance(payload["dias"], list)
    assert len(payload["dias"]) == num_dias, (
        f"Esperados {num_dias} días, obtenidos {len(payload['dias'])}"
    )
    for i, dia in enumerate(payload["dias"]):
        assert "dia" in dia, f"Día {i}: falta 'dia'"
        assert "comida" in dia, f"Día {i}: falta 'comida'"
        assert "cena" in dia, f"Día {i}: falta 'cena'"
        assert dia["comida"].get("nombre"), f"Día {i}: comida sin nombre"
        assert dia["cena"].get("nombre"), f"Día {i}: cena sin nombre"


def _assert_sin_repeticiones_14_dias(dias: list[dict]) -> None:
    platos = []
    for idx, dia in enumerate(dias):
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                platos.append((idx, turno, _obtener_id_plato(plato)))

    for i, (dia_i, turno_i, id_i) in enumerate(platos):
        for j in range(i):
            dia_j, turno_j, id_j = platos[j]
            if dia_i - dia_j >= 14:
                continue
            assert id_i != id_j, (
                f"Plato repetido '{id_i}' en día {dia_j}({turno_j}) "
                f"y día {dia_i}({turno_i}), distancia={dia_i - dia_j} días"
            )


def _assert_cuotas_ventanas_7_dias(dias: list[dict]) -> None:
    assert len(dias) >= 7, "Se necesitan al menos 7 días"

    tags_por_dia = []
    for dia in dias:
        conteo = {g: 0 for g in CUOTAS}
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                for tag in _tags_plato(plato):
                    conteo[tag] += 1
        tags_por_dia.append(conteo)

    ventana = {g: 0 for g in CUOTAS}
    for d in range(7):
        for g in CUOTAS:
            ventana[g] += tags_por_dia[d][g]

    _check_ventana(ventana, 0, 7)

    for inicio in range(1, len(dias) - 6):
        sale = inicio - 1
        entra = inicio + 6
        for g in CUOTAS:
            ventana[g] -= tags_por_dia[sale][g]
            ventana[g] += tags_por_dia[entra][g]
        _check_ventana(ventana, inicio, inicio + 7)


def _check_ventana(ventana: dict, inicio: int, fin: int) -> None:
    for grupo, cuota in CUOTAS.items():
        c = ventana[grupo]
        assert cuota["min"] <= c <= cuota["max"], (
            f"'{grupo}' fuera de rango en ventana [{inicio}:{fin}]: "
            f"{c} not in [{cuota['min']}, {cuota['max']}]"
        )


# ============================================================================
# TESTS DE SISTEMA
# ============================================================================

class TestHealthCheck:
    """Verifica que el servidor está vivo y responde."""

    def test_health_devuelve_200_ok(self, servidor):
        r = requests.get(f"{servidor}/health", timeout=REQUEST_TIMEOUT)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_content_type_es_json(self, servidor):
        r = requests.get(f"{servidor}/health", timeout=REQUEST_TIMEOUT)
        assert "application/json" in r.headers["Content-Type"]


class TestPlanificacionGET:
    """GET /api/planificacion/semanal/ — generación desde cero."""

    def test_devuelve_200(self, servidor):
        r = requests.get(f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT)
        assert r.status_code == 200

    def test_content_type_json(self, servidor):
        r = requests.get(f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT)
        assert "application/json" in r.headers["Content-Type"]

    def test_estructura_7_dias_completa(self, servidor):
        r = requests.get(f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT)
        _assert_estructura_plan(r.json(), num_dias=7)

    def test_fuente_datos_informada(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        assert payload["fuente_datos"] in ("json", "mongodb")

    def test_generado_en_es_iso_valido(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        datetime.fromisoformat(payload["generado_en"])

    def test_sin_repeticiones_14_dias(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        _assert_sin_repeticiones_14_dias(payload["dias"])

    def test_cuotas_ventana_7_dias(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        _assert_cuotas_ventanas_7_dias(payload["dias"])

    def test_14_platos_unicos(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        ids = [
            _obtener_id_plato(dia[turno])
            for dia in payload["dias"]
            for turno in ("comida", "cena")
        ]
        assert len(ids) == 14
        assert len(set(ids)) == 14

    def test_respuesta_json_re_serializable(self, servidor):
        payload = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        reparsed = json.loads(json.dumps(payload, ensure_ascii=False))
        assert reparsed == payload


class TestPlanificacionPOSTConHistorial:
    """POST /api/planificacion/semanal/ con dias_previos."""

    def test_post_con_dias_previos_devuelve_200(self, servidor):
        inicial = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        dias_previos = inicial["dias"][:3]

        r = requests.post(
            f"{servidor}/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
            timeout=REQUEST_TIMEOUT,
        )
        assert r.status_code == 200

    def test_post_devuelve_dias_previos_mas_7(self, servidor):
        inicial = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        n_previos = 4
        dias_previos = inicial["dias"][:n_previos]

        payload = requests.post(
            f"{servidor}/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
            timeout=REQUEST_TIMEOUT,
        ).json()

        esperados = min(n_previos + 7, 14)
        _assert_estructura_plan(payload, num_dias=esperados)

    def test_post_sin_repeticiones(self, servidor):
        inicial = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        dias_previos = inicial["dias"][:3]

        payload = requests.post(
            f"{servidor}/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
            timeout=REQUEST_TIMEOUT,
        ).json()
        _assert_sin_repeticiones_14_dias(payload["dias"])

    def test_post_cuotas_todas_las_ventanas(self, servidor):
        inicial = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        dias_previos = inicial["dias"][:5]

        payload = requests.post(
            f"{servidor}/api/planificacion/semanal/",
            json={"dias_previos": dias_previos},
            timeout=REQUEST_TIMEOUT,
        ).json()
        _assert_cuotas_ventanas_7_dias(payload["dias"])

    def test_post_cadena_3_regeneraciones(self, servidor):
        """Simula uso real: genera → regenera × 3, validando cada paso."""
        plan = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        _assert_sin_repeticiones_14_dias(plan["dias"])
        _assert_cuotas_ventanas_7_dias(plan["dias"])

        for _ in range(3):
            dias_previos = plan["dias"][:3]
            plan = requests.post(
                f"{servidor}/api/planificacion/semanal/",
                json={"dias_previos": dias_previos},
                timeout=REQUEST_TIMEOUT,
            ).json()
            _assert_sin_repeticiones_14_dias(plan["dias"])
            _assert_cuotas_ventanas_7_dias(plan["dias"])
            plan["dias"] = plan["dias"][-7:]


class TestNoDeterminismo:
    """Dos peticiones sin seed fija producen resultados distintos."""

    def test_dos_get_producen_planes_diferentes(self, servidor):
        p1 = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        p2 = requests.get(
            f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT
        ).json()
        ids1 = [_obtener_id_plato(d["comida"]) for d in p1["dias"]]
        ids2 = [_obtener_id_plato(d["comida"]) for d in p2["dias"]]
        assert ids1 != ids2, "Dos planificaciones consecutivas son idénticas"


class TestRendimiento:
    """El sistema responde en un tiempo razonable."""

    def test_respuesta_en_menos_de_5_segundos(self, servidor):
        start = time.time()
        r = requests.get(f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT)
        elapsed = time.time() - start
        assert r.status_code == 200
        assert elapsed < 5.0, f"Respuesta tardó {elapsed:.2f}s (>5s)"


class TestRutasInvalidas:
    """El servidor responde correctamente a rutas inexistentes."""

    def test_ruta_inexistente_devuelve_404(self, servidor):
        r = requests.get(f"{servidor}/api/no/existe", timeout=REQUEST_TIMEOUT)
        assert r.status_code == 404

    def test_metodo_no_permitido(self, servidor):
        r = requests.delete(f"{servidor}/api/planificacion/semanal/", timeout=REQUEST_TIMEOUT)
        assert r.status_code == 405