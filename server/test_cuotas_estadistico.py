"""
Script para probar estadísticamente el cumplimiento de cuotas del algoritmo.

Uso:
    python test_cuotas_estadistico.py

Parámetros configurables abajo (sección CONFIGURACIÓN).
"""

import json
import random
import statistics
from collections import Counter
from API_nueva import API_planificacion, CUOTAS

# ──────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN  ←  modifica estos valores a tu gusto
# ──────────────────────────────────────────────────────────────────────

# Ruta al JSON de recetas exportado de MongoDB
RUTA_RECETAS = r"../datasets/smartCook.recetas.json"

# Cuántas ejecuciones (seeds) quieres probar
NUM_RUNS = 100

# Seed inicial (se probarán seeds desde SEED_INICIO hasta SEED_INICIO + NUM_RUNS - 1)
SEED_INICIO = 20000

# ¿Mostrar detalle de cada seed? (False para solo mostrar fallos y resumen)
VERBOSE = True

# ──────────────────────────────────────────────────────────────────────
# NO TOCAR A PARTIR DE AQUÍ
# ──────────────────────────────────────────────────────────────────────

def analizar_dataset():
    """Muestra estadísticas del dataset de recetas antes de las pruebas."""
    with open(RUTA_RECETAS, encoding="utf-8") as f:
        recetas = json.load(f)

    print(f"  Total recetas en dataset: {len(recetas)}")

    tag_count = Counter()
    lens = Counter()
    for r in recetas:
        nutri = [t for t in r.get("tags", []) if t in CUOTAS]
        for t in nutri:
            tag_count[t] += 1
        lens[len(nutri)] += 1

    print(f"  Frecuencia de tags nutricionales:")
    for t, c in tag_count.most_common():
        pct = 100 * c / len(recetas)
        print(f"    {t:12s}: {c:3d} recetas ({pct:4.1f}%)")

    print(f"  Tags nutricionales por receta:")
    for l in sorted(lens):
        print(f"    {l} tags: {lens[l]} recetas")

    sum_min = sum(c["min"] for c in CUOTAS.values())
    sum_max = sum(c["max"] for c in CUOTAS.values())
    avg_tags = sum(
        len([t for t in r.get("tags", []) if t in CUOTAS]) for r in recetas
    ) / len(recetas)
    impactos = 14 * avg_tags
    print(f"  Media de tags por receta: {avg_tags:.2f}")
    print(f"  Impactos esperados en 14 platos: {impactos:.1f}")
    print(f"  Suma de mínimos: {sum_min}  |  Suma de máximos: {sum_max}")
    print(f"  Margen teórico (max - impactos): {sum_max - impactos:.1f}")


def main():
    print(f"{'='*60}")
    print(f" TEST ESTADÍSTICO DE CUOTAS — {NUM_RUNS} ejecuciones")
    print(f"{'='*60}")
    print(f"Recetas: {RUTA_RECETAS}")
    print(f"Cuotas actuales:")
    for g, c in CUOTAS.items():
        print(f"  {g:12s}: min={c['min']}, max={c['max']}")
    print()

    print("Análisis del dataset:")
    analizar_dataset()
    print(f"\n{'-'*60}")
    print(f"Ejecutando {NUM_RUNS} seeds ({SEED_INICIO}..{SEED_INICIO + NUM_RUNS - 1})...")
    print(f"{'-'*60}")

    fallos_totales = 0
    fallos_por_grupo: dict[str, int] = {g: 0 for g in CUOTAS}
    fallos_bajo: dict[str, int] = {g: 0 for g in CUOTAS}   # < min
    fallos_alto: dict[str, int] = {g: 0 for g in CUOTAS}   # > max

    # Para estadísticas de distribución
    historial: dict[str, list[int]] = {g: [] for g in CUOTAS}

    # Para conteo de recetas repetidas
    repeticiones_por_run: list[int] = []

    for run in range(SEED_INICIO, SEED_INICIO + NUM_RUNS):
        api = API_planificacion(
            recipes_path=RUTA_RECETAS,
            rng=random.Random(run),
        )
        plan = api.planifica()

        conteo: dict[str, int] = {g: 0 for g in CUOTAS}
        nombres: list[str] = []
        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                plato = dia[turno]
                nombres.append(plato.get("nombre", "?"))
                for tag in plato.get("tags", []):
                    if tag in conteo:
                        conteo[tag] += 1

        # Registrar conteos
        for g in CUOTAS:
            historial[g].append(conteo[g])

        # Contar recetas repetidas
        total_platos = len(nombres)
        unicos = len(set(nombres))
        repeticiones_por_run.append(total_platos - unicos)

        # Evaluar fallos
        fallos = []
        for grupo, cuota in CUOTAS.items():
            c = conteo[grupo]
            if c < cuota["min"]:
                fallos.append(f"{grupo}={c}<{cuota['min']}")
                fallos_por_grupo[grupo] += 1
                fallos_bajo[grupo] += 1
            if c > cuota["max"]:
                fallos.append(f"{grupo}={c}>{cuota['max']}")
                fallos_por_grupo[grupo] += 1
                fallos_alto[grupo] += 1

        if fallos:
            fallos_totales += 1
            if VERBOSE:
                print(f"  seed={run:3d} FALLO: {fallos}")
        else:
            if VERBOSE:
                print(f"  seed={run:3d} OK")

    # ── RESUMEN ──────────────────────────────────────────────────────
    ok = NUM_RUNS - fallos_totales
    pct_ok = 100 * ok / NUM_RUNS

    print(f"\n{'='*60}")
    print(f" RESUMEN")
    print(f"{'='*60}")
    print(f"  OK: {ok}/{NUM_RUNS} ({pct_ok:.1f}%)")
    print(f"  Fallos: {fallos_totales}/{NUM_RUNS} ({100 - pct_ok:.1f}%)")

    # ── DISTRIBUCIÓN POR GRUPO ───────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f" DISTRIBUCIÓN POR GRUPO (en {NUM_RUNS} runs)")
    print(f"{'─'*60}")
    print(f"  {'Grupo':12s} {'Min':>3s} {'Max':>3s} │ {'Media':>5s} {'Mediana':>7s} {'σ':>5s} │ {'Mín':>3s} {'Máx':>3s} │ {'<min':>4s} {'>max':>4s}")
    print(f"  {'─'*12} {'─'*3} {'─'*3} │ {'─'*5} {'─'*7} {'─'*5} │ {'─'*3} {'─'*3} │ {'─'*4} {'─'*4}")

    for g, cuota in CUOTAS.items():
        vals = historial[g]
        media = statistics.mean(vals)
        mediana = statistics.median(vals)
        desv = statistics.stdev(vals) if len(vals) > 1 else 0
        v_min = min(vals)
        v_max = max(vals)
        f_bajo = fallos_bajo[g]
        f_alto = fallos_alto[g]

        flag = ""
        if media < cuota["min"]:
            flag = " ⚠ media < min"
        elif media > cuota["max"]:
            flag = " ⚠ media > max"

        print(
            f"  {g:12s} {cuota['min']:3d} {cuota['max']:3d} │ "
            f"{media:5.1f} {mediana:7.1f} {desv:5.2f} │ "
            f"{v_min:3d} {v_max:3d} │ "
            f"{f_bajo:4d} {f_alto:4d}{flag}"
        )

    # ── REPETICIONES ─────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f" REPETICIONES DE PLATOS")
    print(f"{'─'*60}")
    media_rep = statistics.mean(repeticiones_por_run)
    max_rep = max(repeticiones_por_run)
    sin_rep = sum(1 for r in repeticiones_por_run if r == 0)
    print(f"  Runs sin repeticiones: {sin_rep}/{NUM_RUNS} ({100*sin_rep/NUM_RUNS:.1f}%)")
    print(f"  Media de platos repetidos por run: {media_rep:.2f}")
    print(f"  Máximo de platos repetidos en un run: {max_rep}")

    # ── HISTOGRAMA COMPACTO ──────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f" HISTOGRAMA DE VALORES (frecuencia por grupo)")
    print(f"{'─'*60}")
    for g in CUOTAS:
        vals = historial[g]
        c = Counter(vals)
        rango = range(min(vals), max(vals) + 1)
        barra = " ".join(f"{v}:{c.get(v,0)}" for v in rango)
        print(f"  {g:12s}: {barra}")


if __name__ == "__main__":
    main()