"""
Tests de validación del algoritmo de planificación semanal.
Ejecutar con:  pytest test_planificacion.py -v
"""

import json
import random
import statistics
from collections import deque
from typing import Any
from unittest.mock import patch

import pytest

with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
    from API_planificacion import API_planificacion, CUOTAS, PlanningError


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

ITERACIONES = 100          # Iteraciones por test parametrizado
SEEDS = [4, 12, 733, 421, 929, 122, 652, 3, 565, 9991]  # Semillas a probar
DIAS_REGEN_VALUES = [1, 2, 3, 4, 5, 6, 7]  # Valores de DIAS_REGEN a probar


# ============================================================================
# HELPERS
# ============================================================================

def _crear_api(seed: int) -> API_planificacion:
    """Crea una instancia de la API con una semilla determinista."""
    with patch("dotenv.load_dotenv"), patch("pymongo.MongoClient"):
        return API_planificacion(
            connection_uri=None,
            rng=random.Random(seed),
        )


def obtener_id_plato(plato: dict[str, Any]) -> str:
    """Obtiene un identificador único para un plato."""
    for clave in ("_id", "id", "nombre"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def obtener_tags_plato(plato: dict[str, Any]) -> list[str]:
    """Extrae los tags nutricionales válidos de un plato."""
    if not plato:
        return []
    return [t for t in plato.get("tags", []) if t in CUOTAS]


# ============================================================================
# VALIDADORES
# ============================================================================

def assert_sin_repeticiones_14_dias(dias: list[dict[str, Any]]) -> None:
    """
    Para cada plato en la planificación, comprueba que no aparezca
    en los 13 días anteriores (ventana de 14 días incluyendo el actual).
    Compara dentro del mismo día entre comida y cena también.
    """
    # Construimos la lista lineal de (indice_dia, turno, id_plato)
    platos: list[tuple[int, str, str]] = []
    for idx_dia, dia in enumerate(dias):
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                platos.append((idx_dia, turno, obtener_id_plato(plato)))

    for i, (dia_i, turno_i, id_i) in enumerate(platos):
        for j in range(i):
            dia_j, turno_j, id_j = platos[j]
            distancia_dias = dia_i - dia_j
            if distancia_dias >= 14:
                continue  # fuera de la ventana de 14 días, permitido
            if id_i == id_j:
                pytest.fail(
                    f"Plato repetido '{id_i}' en día {dia_j}({turno_j}) "
                    f"y día {dia_i}({turno_i}), distancia={distancia_dias} días (<14)"
                )


def assert_cuotas_ventanas_7_dias(dias: list[dict[str, Any]]) -> None:
    """
    Para cada ventana deslizante de 7 días consecutivos, comprueba
    que el conteo de cada tag esté dentro de [min, max] de CUOTAS.
    """
    if len(dias) < 7:
        pytest.skip("Menos de 7 días, no se pueden comprobar ventanas")

    # Precalculamos tags por día
    tags_por_dia: list[dict[str, int]] = []
    for dia in dias:
        conteo: dict[str, int] = {g: 0 for g in CUOTAS}
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                for tag in obtener_tags_plato(plato):
                    conteo[tag] += 1
        tags_por_dia.append(conteo)

    # Ventana deslizante: inicializamos con los 7 primeros días
    ventana: dict[str, int] = {g: 0 for g in CUOTAS}
    for d in range(7):
        for g in CUOTAS:
            ventana[g] += tags_por_dia[d][g]

    # Comprobar primera ventana
    _comprobar_ventana(ventana, 0, 7)

    # Deslizar
    for inicio in range(1, len(dias) - 6):
        # Restar día que sale (inicio - 1), sumar día que entra (inicio + 6)
        dia_sale = inicio - 1
        dia_entra = inicio + 6
        for g in CUOTAS:
            ventana[g] -= tags_por_dia[dia_sale][g]
            ventana[g] += tags_por_dia[dia_entra][g]
        _comprobar_ventana(ventana, inicio, inicio + 7)


def _comprobar_ventana(ventana: dict[str, int], inicio: int, fin: int) -> None:
    """Comprueba que los conteos de una ventana cumplan las cuotas."""
    for grupo, cuota in CUOTAS.items():
        cantidad = ventana[grupo]
        assert cuota["min"] <= cantidad <= cuota["max"], (
            f"Grupo '{grupo}' fuera de rango en ventana [{inicio}:{fin}]. "
            f"Esperado [{cuota['min']}, {cuota['max']}], obtenido {cantidad}"
        )


def validar_estructura(plan: dict[str, Any], num_dias_esperados: int) -> None:
    """Valida que la planificación tenga la estructura correcta."""
    assert "dias" in plan, "Falta clave 'dias'"
    assert "generado_en" in plan, "Falta clave 'generado_en'"
    assert "fuente_datos" in plan, "Falta clave 'fuente_datos'"
    assert "total_recetas_disponibles" in plan, "Falta clave 'total_recetas_disponibles'"
    assert len(plan["dias"]) == num_dias_esperados, (
        f"Esperados {num_dias_esperados} días, obtenidos {len(plan['dias'])}"
    )
    for i, dia in enumerate(plan["dias"]):
        assert "dia" in dia, f"Día {i}: falta clave 'dia'"
        assert "comida" in dia, f"Día {i}: falta clave 'comida'"
        assert "cena" in dia, f"Día {i}: falta clave 'cena'"


def assert_json_serializable(plan: dict[str, Any]) -> None:
    """Comprueba que la planificación sea serializable a JSON."""
    try:
        json.dumps(plan, default=str, ensure_ascii=False)
    except (TypeError, ValueError) as e:
        pytest.fail(f"Planificación no serializable a JSON: {e}")


# ============================================================================
# ESTADÍSTICAS (recogidas por fixture)
# ============================================================================

class Estadisticas:
    """Acumula estadísticas de tags por modo de ejecución."""

    def __init__(self) -> None:
        self.conteos: list[dict[str, int]] = []
        self.fallos_repeticion = 0
        self.fallos_cuotas = 0
        self.total = 0

    def registrar(self, dias: list[dict[str, Any]], solo_ultimos_7: bool = False) -> None:
        self.total += 1
        d = dias[-7:] if solo_ultimos_7 else dias
        conteo: dict[str, int] = {g: 0 for g in CUOTAS}
        for dia in d:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if plato:
                    for tag in obtener_tags_plato(plato):
                        conteo[tag] += 1
        self.conteos.append(conteo)

    def resumen(self) -> str:
        if not self.conteos:
            return "Sin datos"
        lines = [
            f"Total iteraciones: {self.total}",
            f"Fallos repetición: {self.fallos_repeticion}/{self.total}",
            f"Fallos cuotas:     {self.fallos_cuotas}/{self.total}",
            "",
            f"{'Grupo':<15} {'Media':>7} {'Desv':>7} {'Min':>5} {'Max':>5}  Cuota",
            "-" * 60,
        ]
        for grupo in sorted(CUOTAS.keys()):
            vals = [c[grupo] for c in self.conteos]
            m = statistics.mean(vals)
            s = statistics.stdev(vals) if len(vals) > 1 else 0.0
            mn, mx = min(vals), max(vals)
            cuota = CUOTAS[grupo]
            lines.append(
                f"{grupo:<15} {m:>7.2f} {s:>7.2f} {mn:>5} {mx:>5}  [{cuota['min']}, {cuota['max']}]"
            )
        return "\n".join(lines)


# ============================================================================
# TESTS — MODO SIN HISTORIAL
# ============================================================================

class TestSinHistorial:
    """Genera planificaciones desde cero y valida todas las restricciones."""

    @pytest.mark.parametrize("seed", SEEDS)
    def test_estructura_correcta(self, seed: int) -> None:
        plan = _crear_api(seed).planifica()
        validar_estructura(plan, num_dias_esperados=7)

    @pytest.mark.parametrize("seed", SEEDS)
    def test_json_serializable(self, seed: int) -> None:
        plan = _crear_api(seed).planifica()
        assert_json_serializable(plan)

    @pytest.mark.parametrize("seed", SEEDS)
    def test_sin_repeticiones_14_dias(self, seed: int) -> None:
        """Ningún plato se repite dentro de una ventana de 14 días."""
        plan = _crear_api(seed).planifica()
        assert_sin_repeticiones_14_dias(plan["dias"])

    @pytest.mark.parametrize("seed", SEEDS)
    def test_cuotas_ventanas_7_dias(self, seed: int) -> None:
        """Cada ventana de 7 días consecutivos cumple las cuotas."""
        plan = _crear_api(seed).planifica()
        assert_cuotas_ventanas_7_dias(plan["dias"])

    @pytest.mark.parametrize("seed", SEEDS)
    def test_14_platos_unicos(self, seed: int) -> None:
        """7 días × 2 comidas = 14 platos, todos distintos."""
        plan = _crear_api(seed).planifica()
        ids = [
            obtener_id_plato(dia[turno])
            for dia in plan["dias"]
            for turno in ("comida", "cena")
        ]
        assert len(ids) == 14
        assert len(set(ids)) == 14, f"Platos duplicados: {[x for x in ids if ids.count(x) > 1]}"

    def test_reproducibilidad(self) -> None:
        """Misma seed produce misma planificación."""
        plan1 = _crear_api(42).planifica()
        plan2 = _crear_api(42).planifica()
        ids1 = [obtener_id_plato(d["comida"]) for d in plan1["dias"]]
        ids2 = [obtener_id_plato(d["comida"]) for d in plan2["dias"]]
        assert ids1 == ids2

    def test_diferentes_seeds_difieren(self) -> None:
        """Seeds distintas producen planificaciones distintas."""
        plan1 = _crear_api(42).planifica()
        plan2 = _crear_api(999).planifica()
        ids1 = [obtener_id_plato(d["comida"]) for d in plan1["dias"]]
        ids2 = [obtener_id_plato(d["comida"]) for d in plan2["dias"]]
        assert ids1 != ids2

    def test_estadisticas_multiples_iteraciones(self) -> None:
        """
        Ejecuta ITERACIONES planificaciones con seeds variadas y
        comprueba todas las restricciones. Imprime estadísticas al final.
        """
        stats = Estadisticas()
        fallos: list[str] = []

        for i in range(ITERACIONES):
            seed = i * 37 + 17  # semillas dispersas
            plan = _crear_api(seed).planifica()
            dias = plan["dias"]

            # Repeticiones
            try:
                assert_sin_repeticiones_14_dias(dias)
            except AssertionError:
                stats.fallos_repeticion += 1
                fallos.append(f"seed={seed}: repetición detectada")

            # Cuotas
            try:
                assert_cuotas_ventanas_7_dias(dias)
            except AssertionError as e:
                stats.fallos_cuotas += 1
                fallos.append(f"seed={seed}: cuotas — {e}")

            stats.registrar(dias)

        print(f"\n\n=== ESTADÍSTICAS SIN HISTORIAL ({ITERACIONES} iteraciones) ===")
        print(stats.resumen())

        assert not fallos, (
            f"{len(fallos)} fallos en {ITERACIONES} iteraciones:\n"
            + "\n".join(fallos[:20])
        )


# ============================================================================
# TESTS — MODO CON HISTORIAL
# ============================================================================

class TestConHistorial:
    """
    Genera una planificación inicial y luego encadena regeneraciones
    pasando DIAS_REGEN días previos. Valida todas las restricciones
    sobre la planificación completa (días previos + nuevos).
    """

    @pytest.mark.parametrize("seed", SEEDS)
    def test_estructura_con_historial(self, seed: int) -> None:
        """La planificación con historial tiene dias_previos + 7 días."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        # Debe devolver dias_previos + 7 días (recortado a max 14)
        esperados = min(len(dias_previos) + 7, 14)
        validar_estructura(plan_regen, num_dias_esperados=esperados)

    @pytest.mark.parametrize("seed", SEEDS)
    def test_sin_repeticiones_con_historial(self, seed: int) -> None:
        """Sin repeticiones al regenerar con historial."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_sin_repeticiones_14_dias(plan_regen["dias"])

    @pytest.mark.parametrize("seed", SEEDS)
    def test_cuotas_con_historial(self, seed: int) -> None:
        """Cuotas correctas en todas las ventanas de la planificación con historial."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_cuotas_ventanas_7_dias(plan_regen["dias"])

    @pytest.mark.parametrize("dias_regen", DIAS_REGEN_VALUES)
    def test_distintos_dias_regen(self, dias_regen: int) -> None:
        """Prueba con diferentes cantidades de días previos."""
        api = _crear_api(42)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:dias_regen]

        api2 = _crear_api(43)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_sin_repeticiones_14_dias(plan_regen["dias"])
        assert_cuotas_ventanas_7_dias(plan_regen["dias"])

    @pytest.mark.parametrize("seed", SEEDS[:5])
    def test_cadena_regeneraciones(self, seed: int) -> None:
        """
        Encadena múltiples regeneraciones (simula uso real):
        genera → toma DIAS_REGEN días → regenera → repite.
        Comprueba restricciones en cada paso.
        """
        dias_regen = 3
        api = _crear_api(seed)
        plan_actual = api.planifica()
        assert_sin_repeticiones_14_dias(plan_actual["dias"])
        assert_cuotas_ventanas_7_dias(plan_actual["dias"])

        for step in range(10):
            dias_previos = plan_actual["dias"][:dias_regen]
            api_step = _crear_api(seed + step + 1)
            plan_regen = api_step.planifica(dias_previos=dias_previos)

            assert_sin_repeticiones_14_dias(plan_regen["dias"])
            assert_cuotas_ventanas_7_dias(plan_regen["dias"])

            # Quedarse con los últimos 7 días para la siguiente iteración
            plan_actual = {
                "dias": plan_regen["dias"][-7:],
                "generado_en": plan_regen["generado_en"],
                "fuente_datos": plan_regen["fuente_datos"],
                "total_recetas_disponibles": plan_regen["total_recetas_disponibles"],
            }

    @pytest.mark.parametrize("dias_regen", DIAS_REGEN_VALUES)
    def test_estadisticas_con_historial(self, dias_regen: int) -> None:
        """
        Ejecuta ITERACIONES encadenamientos con historial y
        comprueba todas las restricciones. Imprime estadísticas.
        """
        stats = Estadisticas()
        fallos: list[str] = []

        api = _crear_api(0)
        plan_actual = api.planifica()

        for i in range(ITERACIONES):
            seed_iter = i * 53 + 7
            dias_previos = plan_actual["dias"][:dias_regen]

            api_iter = _crear_api(seed_iter)
            plan_regen = api_iter.planifica(dias_previos=dias_previos)
            dias = plan_regen["dias"]

            # Repeticiones
            try:
                assert_sin_repeticiones_14_dias(dias)
            except AssertionError:
                stats.fallos_repeticion += 1
                fallos.append(f"iter={i}, seed={seed_iter}: repetición")

            # Cuotas (todas las ventanas de 7 días)
            try:
                assert_cuotas_ventanas_7_dias(dias)
            except AssertionError as e:
                stats.fallos_cuotas += 1
                fallos.append(f"iter={i}, seed={seed_iter}: cuotas — {e}")

            stats.registrar(dias, solo_ultimos_7=True)

            # Preparar siguiente iteración
            plan_actual = {
                "dias": plan_regen["dias"][-7:],
                "generado_en": plan_regen["generado_en"],
                "fuente_datos": plan_regen["fuente_datos"],
                "total_recetas_disponibles": plan_regen["total_recetas_disponibles"],
            }

        print(
            f"\n\n=== ESTADÍSTICAS CON HISTORIAL "
            f"(dias_regen={dias_regen}, {ITERACIONES} iter) ==="
        )
        print(stats.resumen())

        assert not fallos, (
            f"{len(fallos)} fallos en {ITERACIONES} iteraciones (dias_regen={dias_regen}):\n"
            + "\n".join(fallos[:20])
        )
