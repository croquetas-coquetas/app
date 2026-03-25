"""
Test estadístico exhaustivo para la planificación semanal con continuidad.

Permite probar múltiples iteraciones de planificación simulando continuidad
entre semanas, verifica cumplimiento de cuotas nutricionales, detecta
repeticiones indebidas y genera estadísticas detalladas.

Uso:
    python test_planificacion_exhaustiva.py

Parámetros configurables en la sección CONFIGURACIÓN de abajo.
"""

import json
import random
import statistics
from collections import Counter, deque
from pathlib import Path
from typing import Any

from API_nueva import API_planificacion, CUOTAS

# ------------- CONFIGURACION -------
# CONFIGURACION (modifica estos valores a tu gusto)
# ------------- -------

# Ruta al JSON de recetas
RUTA_RECETAS = "datasets/smartCook.recetas.json"

# Cuántas ejecuciones (seeds) quieres probar
NUM_RUNS = 5

# Seed inicial (se probarán seeds desde SEED_INICIO hasta SEED_INICIO + NUM_RUNS - 1)
SEED_INICIO = 1000

# ¿Mostrar detalle de cada seed? (False para solo mostrar fallos y resumen)
VERBOSE = False

# ----------- CONFIGURACION DE REGENERACION -----------
# Estrategia de regeneración: en qué día (relativo) se regenera
# Ejemplo: DIAS_REGENERACION = 4 significa que cada 4 días se regenera una nueva planificación
DIAS_REGENERACION = 2

# Cuántas veces se restablecerá la planificación en cada seed
# Ejemplo: REGENERACIONES_POR_SEED = 3 genera: inicial (7 días) + 3 regeneraciones = 4 bloques
REGENERACIONES_POR_SEED = 30

# ¿Cuántos días previos usar cuando se regenera?
# Con DIAS_REGENERACION = 4, tendremos 3 días previos (días 1-3 cuando regeneramos en día 4)
# Este parámetro es automático, pero lo dejamos visible:
# DIAS_PREVIOS_EN_REGENERACION = DIAS_REGENERACION - 1

# ──────────────────────────────────────────────────────────────────────
# NO TOCAR A PARTIR DE AQUÍ
# ──────────────────────────────────────────────────────────────────────


def obtener_identificador_plato(plato: dict[str, Any]) -> str:
    """Crea un identificador único para un plato."""
    for clave in ("_id", "id", "nombre"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def obtener_tags_nutricionales(receta: dict[str, Any]) -> list[str]:
    """Extrae solo los tags que son grupos nutricionales válidos."""
    return [t for t in receta.get("tags", []) if t in CUOTAS]


def analizar_dataset(ruta_recetas: str) -> None:
    """Muestra estadísticas del dataset de recetas antes de las pruebas."""
    with open(ruta_recetas, encoding="utf-8") as f:
        recetas = json.load(f)

    print(f"  Total recetas en dataset: {len(recetas)}")

    tag_count = Counter()
    lens = Counter()
    for r in recetas:
        nutri = obtener_tags_nutricionales(r)
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
        len(obtener_tags_nutricionales(r)) for r in recetas
    ) / len(recetas)
    impactos = 14 * avg_tags
    print(f"  Media de tags por receta: {avg_tags:.2f}")
    print(f"  Impactos esperados en 14 platos: {impactos:.1f}")
    print(f"  Suma de mínimos: {sum_min}  |  Suma de máximos: {sum_max}")
    print(f"  Margen teórico (max - impactos): {sum_max - impactos:.1f}")


def obtener_ruta_recetas() -> Path:
    """Resuelve la ruta correcta para recipes_path."""
    posibles_rutas = [
        Path(__file__).resolve().parent / RUTA_RECETAS,
        Path(RUTA_RECETAS).resolve(),
        Path(".") / RUTA_RECETAS,
    ]
    
    for ruta in posibles_rutas:
        if ruta.exists():
            return ruta
    
    print(f"❌ Error: No se encontró {RUTA_RECETAS}")
    print(f"   Se buscó en:")
    for ruta in posibles_rutas:
        print(f"     - {ruta.absolute()}")
    raise FileNotFoundError(f"{RUTA_RECETAS} no encontrado")


def generar_dias_con_regeneracion(
    api: API_planificacion,
    regeneraciones: int = 1,
    dias_regeneracion: int = 4,
) -> list[dict[str, Any]]:
    """
    Genera días con soporte para regeneración.
    
    Args:
        api: Instancia de API_planificacion
        regeneraciones: Cuántos bloques adicionales generar (total = 1 + regeneraciones)
        dias_regeneracion: En qué día (relativo) se regenera
    
    Returns:
        Lista de todos los días generados (7 + 7*regeneraciones en total)
    
    Ejemplo con regeneraciones=2, dias_regeneracion=4:
        Bloque 1: genera días 0-6 (7 días)
        Bloque 2: en día 4, genera nuevos 7 días usando días 0-3 como previos
        Bloque 3: en día 8, genera nuevos 7 días usando días 4-10 como previos
        Total: ~21 días
    """
    todos_los_dias: list[dict[str, Any]] = []
    
    # Generar primer bloque sin días previos
    plan = api.planifica()
    todos_los_dias.extend(plan["dias"])
    
    # Generar bloques adicionales con regeneración
    for regen in range(regeneraciones):
        # Calcular qué días usar como previos
        # Si DIAS_REGENERACION = 4, tenemos 3 días previos
        dias_previos_count = dias_regeneracion - 1
        
        if len(todos_los_dias) >= dias_previos_count:
            # Tomar los últimos N días como previos
            dias_previos = todos_los_dias[-dias_previos_count:]
        else:
            # Si no hay suficientes días acumulados, usar los que haya
            dias_previos = todos_los_dias
        
        # Generar nuevos 7 días
        plan = api.planifica(dias_previos=dias_previos)
        
        # Agregar los nuevos días (último bloque completo)
        todos_los_dias.extend(plan["dias"][-7:])
    
    return todos_los_dias


def main():
    print(f"{'='*70}")
    print(f" TEST ESTADÍSTICO DE PLANIFICACIÓN CON CONTINUIDAD — {NUM_RUNS} ejecuciones")
    print(f"{'='*70}")
    print(f"Recetas: {RUTA_RECETAS}")
    print(f"Seeds: {SEED_INICIO} hasta {SEED_INICIO + NUM_RUNS - 1}")
    print(f"Regeneraciones por seed: {REGENERACIONES_POR_SEED}")
    print(f"Días entre regeneraciones: {DIAS_REGENERACION}")
    print(f"Cuotas actuales:")
    for g, c in CUOTAS.items():
        print(f"  {g:12s}: min={c['min']}, max={c['max']}")
    print()

    ruta_recetas = obtener_ruta_recetas()
    print(f"Análisis del dataset: {ruta_recetas}")
    analizar_dataset(str(ruta_recetas))
    print(f"\n{'-'*70}")
    print(f"Ejecutando {NUM_RUNS} seeds ({SEED_INICIO}..{SEED_INICIO + NUM_RUNS - 1})...")
    print(f"{'-'*70}")

    fallos_totales = 0
    fallos_por_grupo: dict[str, int] = {g: 0 for g in CUOTAS}
    fallos_bajo: dict[str, int] = {g: 0 for g in CUOTAS}   # < min
    fallos_alto: dict[str, int] = {g: 0 for g in CUOTAS}   # > max
    
    # Estadísticas por seed
    historial: dict[str, list[int]] = {g: [] for g in CUOTAS}
    repeticiones_por_seed: list[int] = []
    platos_unicos_por_seed: list[int] = []
    
    for run in range(SEED_INICIO, SEED_INICIO + NUM_RUNS):
        rng = random.Random(run)
        api = API_planificacion(
            recipes_path=str(ruta_recetas),
            rng=rng,
        )
        
        # Generar días con regeneración configurable
        todos_los_dias = generar_dias_con_regeneracion(
            api,
            regeneraciones=REGENERACIONES_POR_SEED,
            dias_regeneracion=DIAS_REGENERACION,
        )
        
        # Verificar cuotas en los últimos 7 días (la última regeneración o bloque)
        ultimos_7_dias = todos_los_dias[-7:]
        
        # Contar tags en los últimos 7 días
        conteo: dict[str, int] = {g: 0 for g in CUOTAS}
        ids_ultimos: list[str] = []
        
        for dia in ultimos_7_dias:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if plato:
                    plato_id = obtener_identificador_plato(plato)
                    ids_ultimos.append(plato_id)
                    
                    # Contar tags
                    for tag in obtener_tags_nutricionales(plato):
                        conteo[tag] += 1
        
        # Para detección de repeticiones: acumular IDs de TODO
        todas_ids_historial: list[str] = []
        for dia in todos_los_dias:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if plato:
                    plato_id = obtener_identificador_plato(plato)
                    todas_ids_historial.append(plato_id)
        
        # Detectar repeticiones indebidas (últimos 28 platos ~14 días)
        todas_ids = todas_ids_historial[-28:]  # Últimas 28 IDs (14 días)
        platos_nuevos = todas_ids_historial[-14:]  # Nuevos platos
        repeticiones = 0
        for plato_id in platos_nuevos:
            if platos_nuevos.count(plato_id) == 1 and todas_ids.count(plato_id) > 1:
                # Este plato está en los últimos 14 pero también antes en los 28
                repeticiones += 1
        
        repeticiones_por_seed.append(repeticiones)
        platos_unicos_por_seed.append(len(set(ids_ultimos)))
        
        # Registrar conteos en historial
        for g in CUOTAS:
            historial[g].append(conteo[g])
        
        # Evaluar fallos
        fallos = []
        for grupo, cuota in CUOTAS.items():
            c = conteo.get(grupo, 0)
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

    # ----------- RESUMEN -----------
    ok = NUM_RUNS - fallos_totales
    pct_ok = 100 * ok / NUM_RUNS if NUM_RUNS > 0 else 0

    print(f"\n{'='*70}")
    print(f" RESUMEN")
    print(f"{'='*70}")
    print(f"  OK: {ok}/{NUM_RUNS} ({pct_ok:.1f}%)")
    print(f"  Fallos: {fallos_totales}/{NUM_RUNS} ({100 - pct_ok:.1f}%)")

    # ----------- DISTRIBUCION POR GRUPO -----------
    print(f"\n{'-'*70}")
    print(f" DISTRIBUCION POR GRUPO (en {NUM_RUNS} runs)")
    print(f"{'-'*70}")
    print(f"  {'Grupo':12s} {'Min':>3s} {'Max':>3s} | {'Media':>5s} {'Mediana':>7s} {'SD':>5s} | {'Min':>3s} {'Max':>3s} | {'<min':>4s} {'>max':>4s}")
    print(f"  {'-'*12} {'-'*3} {'-'*3} | {'-'*5} {'-'*7} {'-'*5} | {'-'*3} {'-'*3} | {'-'*4} {'-'*4}")

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
            flag = " WARNING: media < min"
        elif media > cuota["max"]:
            flag = " WARNING: media > max"

        print(
            f"  {g:12s} {cuota['min']:3d} {cuota['max']:3d} | "
            f"{media:5.1f} {mediana:7.1f} {desv:5.2f} | "
            f"{v_min:3d} {v_max:3d} | "
            f"{f_bajo:4d} {f_alto:4d}{flag}"
        )

    # ----------- CONTINUIDAD Y REPETICIONES -----------
    print(f"\n{'-'*70}")
    print(f" CONTINUIDAD Y REPETICIONES")
    print(f"{'-'*70}")
    
    # Calcular total de días generados
    dias_totales = 7 + (REGENERACIONES_POR_SEED * 7)
    print(f"  Días totales por seed: 7 + ({REGENERACIONES_POR_SEED} × 7) = {dias_totales}")
    print(f"  Verificación de cuotas: últimos 7 días (más recientes)")
    
    media_rep = statistics.mean(repeticiones_por_seed)
    max_rep = max(repeticiones_por_seed) if repeticiones_por_seed else 0
    sin_rep = sum(1 for r in repeticiones_por_seed if r == 0)
    print(f"  Seeds sin repeticiones indebidas: {sin_rep}/{NUM_RUNS} ({100*sin_rep/NUM_RUNS:.1f}%)")
    print(f"  Media de repeticiones por seed: {media_rep:.2f}")
    print(f"  Máximas repeticiones en un seed: {max_rep}")
    
    media_unicos = statistics.mean(platos_unicos_por_seed) if platos_unicos_por_seed else 0
    print(f"  Media de platos únicos por seed (últimos 14 días): {media_unicos:.1f}")

    # ----------- HISTOGRAMA COMPACTO -----------
    print(f"\n{'-'*70}")
    print(f" HISTOGRAMA DE VALORES (frecuencia por grupo)")
    print(f"{'-'*70}")
    for g in CUOTAS:
        vals = historial[g]
        c = Counter(vals)
        rango = range(min(vals), max(vals) + 1)
        barra = " ".join(f"{v}:{c.get(v,0)}" for v in rango)
        print(f"  {g:12s}: {barra}")

    print(f"\n{'='*70}")


if __name__ == "__main__":
    main()
