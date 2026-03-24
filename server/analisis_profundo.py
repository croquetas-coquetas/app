"""
Script de análisis profundo del problema de cuotas.
"""

import json
import random
import statistics
from collections import Counter, defaultdict
from API_nueva import API_planificacion, CUOTAS

RUTA_RECETAS = r"smartCook.recetas.json"
NUM_RUNS = 1000
SEED_INICIO = 0

def main():
    with open(RUTA_RECETAS, encoding="utf-8") as f:
        recetas = json.load(f)

    # Análisis de recetas
    print("=" * 80)
    print("ANALISIS 1: DISTRIBUCION DE TAGS EN RECETAS")
    print("=" * 80)
    
    recetas_sin_tags = [r for r in recetas if not r.get("tags")]
    recetas_vacias = [r for r in recetas if not r.get("nombre")]
    
    print(f"\nTotal de recetas: {len(recetas)}")
    print(f"Recetas vacías (no nombre): {len(recetas_vacias)}")
    print(f"Recetas sin tags: {len(recetas_sin_tags)}")
    
    recetas_validas = [r for r in recetas if r.get("nombre") and r.get("tags")]
    print(f"Recetas válidas (con nombre y tags): {len(recetas_validas)}")
    
    # Análisis de cobertura de tags
    tag_grupos = defaultdict(list)
    for r in recetas_validas:
        tags_nutricionales = [t for t in r.get("tags", []) if t in CUOTAS]
        for tag in tags_nutricionales:
            tag_grupos[tag].append(r.get("nombre"))
    
    print("\nCobertura de tags por grupo:")
    for grupo in sorted(CUOTAS.keys()):
        count = len(tag_grupos[grupo])
        pct = 100 * count / len(recetas_validas) if recetas_validas else 0
        print(f"  {grupo:12s}: {count:3d} recetas ({pct:5.1f}%)")
    
    # PROBLEMA PRINCIPAL: análisis de lo que elige el algoritmo
    print("\n" + "=" * 80)
    print("ANALISIS 2: CORRELACION - LO QUE ELIGE EL ALGORITMO")
    print("=" * 80)
    
    historial_elecciones = defaultdict(Counter)
    
    for run in range(10):  # Solo 10 para no tardar
        api = API_planificacion(recipes_path=RUTA_RECETAS, rng=random.Random(run))
        plan = api.planifica()
        
        for dia in plan["dias"]:
            for turno in ("comida", "cena"):
                plato = dia[turno]
                nombre = plato.get("nombre", "?")
                for tag in plato.get("tags", []):
                    if tag in CUOTAS:
                        historial_elecciones[tag][nombre] += 1
    
    print("\nTags más frecuentemente seleccionados en primeras 10 semanas:")
    for grupo in sorted(CUOTAS.keys(), key=lambda x: len(historial_elecciones[x]), reverse=True):
        count = sum(historial_elecciones[grupo].values())
        top_recetas = historial_elecciones[grupo].most_common(3)
        top_str = "; ".join(f"{r}({c})" for r, c in top_recetas)
        print(f"  {grupo:12s}: {count:2d} tags ({top_str})")
    
    # ANÁLISIS DE SESGO
    print("\n" + "=" * 80)
    print("ANALISIS 3: CALCULO TEORICO DE SESIBILIDAD VS REALIDAD")
    print("=" * 80)
    
    # Si cada plato tiene en promedio X tags, en 14 platos tenemos 14*X tags
    # Esos tags se distribuyen aleatoriamente entre los grupos
    avg_tags_per_recipe = sum(len([t for t in r.get("tags", []) if t in CUOTAS]) 
                              for r in recetas_validas) / len(recetas_validas)
    total_impactos = 14 * avg_tags_per_recipe
    
    print(f"\nPromedio tags por receta: {avg_tags_per_recipe:.2f}")
    print(f"Total impactos en 14 platos (promedio): {total_impactos:.1f}")
    print(f"Suma de minimums: {sum(c['min'] for c in CUOTAS.values())}")
    print(f"Suma de maximums: {sum(c['max'] for c in CUOTAS.values())}")
    
    # Calcular probabilidad "uniforme"
    print("\nSi los impactos se distribuyeran uniformemente entre grupos:")
    num_grupos = len(CUOTAS)
    impactos_por_grupo = total_impactos / num_grupos
    print(f"  Impactos por grupo: {impactos_por_grupo:.1f}")
    print(f"  Cuota de cada grupo (min-max):")
    for grupo, cuota in sorted(CUOTAS.items()):
        ok = cuota["min"] <= impactos_por_grupo <= cuota["max"]
        status = "OK" if ok else "NO OK"
        print(f"    {grupo:12s}: [{cuota['min']:2d}, {cuota['max']:2d}] -> {status}")
    
    # PROBLEM IDENTIFICATION
    print("\n" + "=" * 80)
    print("ANALISIS 4: DESBALANCE DE TAGS EN RECETAS")
    print("=" * 80)
    
    # Calcular cuántas recetas tienen cada combinación de tags
    combo_counter = Counter()
    for r in recetas_validas:
        tags_set = frozenset([t for t in r.get("tags", []) if t in CUOTAS])
        if tags_set:
            combo_counter[tags_set] += 1
    
    print(f"\nNúmero de combinaciones únicas de tags: {len(combo_counter)}")
    print(f"Top 10 combinaciones más comunes:")
    for combo, count in combo_counter.most_common(10):
        combo_str = ", ".join(sorted(combo))
        pct = 100 * count / len(recetas_validas)
        print(f"  ({combo_str}): {count} recetas ({pct:.1f}%)")
    
    # Calcular sesgo
    print("\n" + "=" * 80)
    print("ANALISIS 5: DISTRIBUCION DE TAGS - PROBLEMA REAL")
    print("=" * 80)
    
    # Para cada tag, contar cuántas combinaciones diferentes lo incluyen
    tag_en_recetas = defaultdict(int)
    for tag in CUOTAS.keys():
        for r in recetas_validas:
            if tag in r.get("tags", []):
                tag_en_recetas[tag] += 1
    
    # Para cada tag, calcular su "fuerza" en relación con otros
    print("\nFuerza relativa de cada tag (probabilidad de ser seleccionado si es aleatorio):")
    total_menciones = sum(tag_en_recetas.values())
    for grupo, count in sorted(tag_en_recetas.items(), key=lambda x: x[1], reverse=True):
        pct = 100 * count / total_menciones
        print(f"  {grupo:12s}: {pct:5.1f}%")
    
    # Comparar con lo que se ESPERA
    print("\nComparación: Frecuencia real vs Cuota esperada:")
    print(f"  {'Grupo':12s} {'Real %':>7s} {'Min cov':>7s} {'Max cov':>7s} {'Status':>10s}")
    for grupo, cuota in sorted(CUOTAS.items()):
        real_pct = 100 * tag_en_recetas[grupo] / total_menciones
        min_cov = 100 * cuota["min"] / total_impactos
        max_cov = 100 * cuota["max"] / total_impactos
        status = "SOBRE" if real_pct > max_cov else ("BAJO" if real_pct < min_cov else "OK")
        print(f"  {grupo:12s} {real_pct:7.1f}% {min_cov:7.1f}% {max_cov:7.1f}% {status:>10s}")

if __name__ == "__main__":
    main()
