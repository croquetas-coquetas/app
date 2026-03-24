"""
Test simplificado sin caracteres unicode para evitar problemas de encoding.
"""

import json
import random
import statistics
from collections import Counter
from API_nueva import API_planificacion, CUOTAS

RUTA_RECETAS = r"smartCook.recetas.json"
NUM_RUNS = 1000
SEED_INICIO = 0
VERBOSE = False  # No mostrar detalle, solo resumen

def main():
    print("=" * 80)
    print(" TEST DE CUOTAS - 1000 ejecuciones (VERSIÓN MEJORADA)")
    print("=" * 80)

    fallos_totales = 0
    fallos_por_grupo = {g: 0 for g in CUOTAS}
    fallos_bajo = {g: 0 for g in CUOTAS}
    fallos_alto = {g: 0 for g in CUOTAS}

    historial = {g: [] for g in CUOTAS}

    for run in range(SEED_INICIO, SEED_INICIO + NUM_RUNS):
        api = API_planificacion(
            recipes_path=RUTA_RECETAS,
            rng=random.Random(run),
        )
        plan = api.planifica()

        conteo = {g: 0 for g in CUOTAS}
        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                plato = dia[turno]
                for tag in plato.get("tags", []):
                    if tag in conteo:
                        conteo[tag] += 1

        for g in CUOTAS:
            historial[g].append(conteo[g])

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
            if VERBOSE and run < 20:
                print(f"  seed={run:3d} FALLO: {fallos}")

    ok = NUM_RUNS - fallos_totales
    pct_ok = 100 * ok / NUM_RUNS

    print(f"\n{'='*80}")
    print(f" RESULTADOS")
    print(f"{'='*80}")
    print(f"  OK: {ok}/{NUM_RUNS} ({pct_ok:.1f}%)")
    print(f"  Fallos: {fallos_totales}/{NUM_RUNS} ({100 - pct_ok:.1f}%)")

    print(f"\n{'─'*80}")
    print(f" DISTRIBUCION POR GRUPO")
    print(f"{'─'*80}")
    print(f"  Grupo         Min Max | Media Mediana    Desv Min Max | <min >max")
    print(f"  {'-'*12} {'-'*3} {'-'*3} | {'-'*5} {'-'*7} {'-'*5} {'-'*3} {'-'*3} | {'-'*4} {'-'*4}")

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
            flag = " ALERTA"
        elif media > cuota["max"]:
            flag = " ALERTA"

        print(
            f"  {g:12s} {cuota['min']:3d} {cuota['max']:3d} | "
            f"{media:5.1f} {mediana:7.1f} {desv:5.2f} {v_min:3d} {v_max:3d} | "
            f"{f_bajo:4d} {f_alto:4d}{flag}"
        )

if __name__ == "__main__":
    main()
