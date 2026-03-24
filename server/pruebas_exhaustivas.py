"""
Pruebas exhaustivas de la solución mejorada.
"""

import json
import random
import statistics
from API_nueva import API_planificacion, CUOTAS

RUTA_RECETAS = r"smartCook.recetas.json"

def run_test(num_runs, seed_inicio, label):
    print(f"\n{'='*80}")
    print(f" {label} ({num_runs} iteraciones)")
    print(f"{'='*80}")
    
    fallos_totales = 0
    fallos_bajo = {g: 0 for g in CUOTAS}
    fallos_alto = {g: 0 for g in CUOTAS}
    
    for run in range(seed_inicio, seed_inicio + num_runs):
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
        
        fallos = False
        for grupo, cuota in CUOTAS.items():
            c = conteo[grupo]
            if c < cuota["min"]:
                fallos_bajo[grupo] += 1
                fallos = True
            if c > cuota["max"]:
                fallos_alto[grupo] += 1
                fallos = True
        
        if fallos:
            fallos_totales += 1
    
    ok = num_runs - fallos_totales
    pct_ok = 100 * ok / num_runs
    
    print(f"  OK: {ok}/{num_runs} ({pct_ok:.1f}%)")
    print(f"  Fallos: {fallos_totales}/{num_runs} ({100 - pct_ok:.1f}%)")
    
    if fallos_totales > 0:
        print(f"\n  Detalles de fallos:")
        print(f"    {'Grupo':12s} {'<min':>5s} {'>max':>5s}")
        for g in CUOTAS:
            if fallos_bajo[g] > 0 or fallos_alto[g] > 0:
                print(f"    {g:12s} {fallos_bajo[g]:5d} {fallos_alto[g]:5d}")
    
    return pct_ok

def main():
    print("PRUEBAS EXHAUSTIVAS DEL ALGORITMO MEJORADO")
    print("=" * 80)
    
    # Prueba 1: 1000 iteraciones (como original)
    result1 = run_test(1000, 0, "TEST 1: 1000 iteraciones (original)")
    
    # Prueba 2: 5000 iteraciones (stress test)
    result2 = run_test(5000, 1000, "TEST 2: 5000 iteraciones (stress test)")
    
    # Prueba 3: 10000 iteraciones (very intensive)
    result3 = run_test(10000, 6000, "TEST 3: 10000 iteraciones (intensive test)")
    
    # Resumen final
    print(f"\n{'='*80}")
    print(f" RESUMEN FINAL")
    print(f"{'='*80}")
    print(f"  Test 1 (1k):    {result1:.1f}% exito")
    print(f"  Test 2 (5k):    {result2:.1f}% exito")
    print(f"  Test 3 (10k):   {result3:.1f}% exito")
    print(f"  TOTAL:          {(result1 + result2 + result3) / 3:.1f}% exito promedio")
    
    if result1 == 100 and result2 == 100 and result3 == 100:
        print(f"\n SUCCESS! El algoritmo es 100% confiable en todas las pruebas!")
    else:
        print(f"\n ADVERTENCIA: Algunos fallos detectados")

if __name__ == "__main__":
    main()
