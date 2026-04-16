"""
Test local que replica exactamente el flujo frontend → backend para verificar
que el arreglo de __identificador_receta funciona correctamente.

Simula:
  1. Frontend genera plan (GET → planifica() sin args)
  2. Frontend extrae dias_previos con getDiasPrevios (dias con fecha < hoy)
  3. Frontend limpia cada día con cleanDiaPlanning (solo nombre, grupo_principal,
     ingredientes, pasos, tags — SIN _id ni id)
  4. Frontend regenera (POST → planifica(dias_previos=diasLimpios))
  5. Se valida que NO haya platos repetidos entre previos y nuevos,
     y que las cuotas de 7 días se cumplan.

Ejecutar:  python test_arreglo_local.py
"""

import io
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from API_planificacion import API_planificacion, CUOTAS, PlanningError

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

ITERACIONES = 200
# Simular regeneración con distintas cantidades de días previos
ESCENARIOS_DIAS_PREVIOS = [1, 3, 5, 6]


# ============================================================================
# SIMULACIÓN DEL FRONTEND — cleanDiaPlanning (TypeScript → Python)
# ============================================================================

def clean_receta(receta: dict[str, Any]) -> dict[str, Any]:
    """Replica exactamente cleanDiaPlanning del frontend.
    
    Solo envía: nombre, grupo_principal, ingredientes, pasos, tags.
    NO envía: _id, id, ni ningún otro campo extra.
    """
    return {
        "nombre": receta.get("nombre", ""),
        "grupo_principal": receta.get("grupo_principal", ""),
        "ingredientes": receta.get("ingredientes", []),
        "pasos": receta.get("pasos", []),
        "tags": receta.get("tags", []),
    }


def clean_dia_planning(dia: dict[str, Any]) -> dict[str, Any]:
    """Replica cleanDiaPlanning del frontend (planning.api.ts)."""
    return {
        "dia": dia["dia"],
        "comida": clean_receta(dia["comida"]),
        "cena": clean_receta(dia["cena"]),
    }


def get_dias_previos(plan: dict[str, Any], dias_pasados: int) -> list[dict[str, Any]]:
    """Replica getDiasPrevios del frontend: devuelve los primeros N días
    como si fueran 'pasados' (fecha < hoy).
    
    En la app real filtra por fecha. Aquí simplemente tomamos los primeros
    `dias_pasados` días del plan, que serían los más antiguos.
    """
    return plan["dias"][:dias_pasados]


# ============================================================================
# VALIDADORES
# ============================================================================

def obtener_nombre(plato: dict[str, Any]) -> str:
    """Identificador por nombre — la forma correcta tras el arreglo."""
    return plato.get("nombre", "")


def validar_sin_repeticiones_entre_previos_y_nuevos(
    dias_previos_limpios: list[dict[str, Any]],
    dias_nuevos: list[dict[str, Any]],
) -> tuple[bool, list[str]]:
    """Comprueba que ningún plato de los días nuevos repita un plato de los previos."""
    errores = []
    nombres_previos: set[str] = set()

    for dia in dias_previos_limpios:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                nombres_previos.add(obtener_nombre(plato))

    for idx, dia in enumerate(dias_nuevos):
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                nombre = obtener_nombre(plato)
                if nombre in nombres_previos:
                    errores.append(
                        f"REPETIDO: '{nombre}' en día nuevo {idx} ({turno}) "
                        f"ya estaba en días previos"
                    )

    return len(errores) == 0, errores


def validar_sin_repeticiones_global(dias: list[dict[str, Any]]) -> tuple[bool, list[str]]:
    """Comprueba que no haya platos repetidos en toda la planificación."""
    errores = []
    vistos: dict[str, str] = {}  # nombre → "día X, turno"

    for idx, dia in enumerate(dias):
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato:
                nombre = obtener_nombre(plato)
                ubicacion = f"día {idx}, {turno}"
                if nombre in vistos:
                    errores.append(
                        f"REPETIDO: '{nombre}' en {ubicacion} "
                        f"(primera aparición: {vistos[nombre]})"
                    )
                else:
                    vistos[nombre] = ubicacion

    return len(errores) == 0, errores


def validar_cuotas_ventana_7(dias: list[dict[str, Any]]) -> tuple[bool, list[str]]:
    """Valida cuotas en cada ventana deslizante de 7 días."""
    errores = []
    if len(dias) < 7:
        return True, []

    for inicio in range(len(dias) - 6):
        ventana = dias[inicio : inicio + 7]
        conteo: dict[str, int] = {g: 0 for g in CUOTAS}

        for dia in ventana:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if plato:
                    for tag in plato.get("tags", []):
                        if tag in CUOTAS:
                            conteo[tag] += 1

        for grupo, cuota in CUOTAS.items():
            if conteo[grupo] < cuota["min"]:
                errores.append(
                    f"CUOTA BAJA: {grupo}={conteo[grupo]} < min={cuota['min']} "
                    f"(ventana días {inicio}–{inicio + 6})"
                )
            if conteo[grupo] > cuota["max"]:
                errores.append(
                    f"CUOTA ALTA: {grupo}={conteo[grupo]} > max={cuota['max']} "
                    f"(ventana días {inicio}–{inicio + 6})"
                )

    return len(errores) == 0, errores


# ============================================================================
# FLUJO COMPLETO: simula exactamente lo que hace el usuario
# ============================================================================

def ejecutar_flujo_frontend_backend(
    api: API_planificacion, dias_previos_count: int
) -> tuple[bool, list[str]]:
    """
    1. Genera plan inicial (GET → planifica() sin args)               — 7 días
    2. Extrae los primeros `dias_previos_count` días como "pasados"
    3. Los limpia con cleanDiaPlanning (quita _id, id, campos extra)
    4. Regenera pasando esos días limpios (POST → planifica(dias_previos))
    5. Valida no-repetición y cuotas sobre el plan combinado
    """
    # === PASO 1: generación inicial (como GET /api/planificacion/semanal/) ===
    plan_inicial = api.planifica()

    # === PASO 2: simular que pasan N días ===
    dias_pasados = get_dias_previos(plan_inicial, dias_previos_count)

    # === PASO 3: limpiar como hace el frontend (cleanDiaPlanning) ===
    dias_limpios = [clean_dia_planning(d) for d in dias_pasados]

    # === PASO 4: regenerar (como POST /api/planificacion/semanal/) ===
    plan_regen = api.planifica(dias_previos=dias_limpios)

    # === PASO 5: validar ===
    errores_total: list[str] = []

    # 5a. Separar días previos de días nuevos en el resultado
    #     El backend devuelve dias_previos + 7_nuevos (max 14)
    total_dias = plan_regen["dias"]
    n_previos = len(dias_limpios)
    # Los primeros n_previos son los que enviamos; el resto son generados
    previos_devueltos = total_dias[:n_previos]
    nuevos_devueltos = total_dias[n_previos:]

    # 5b. No repetición entre previos y nuevos
    ok, errs = validar_sin_repeticiones_entre_previos_y_nuevos(
        previos_devueltos, nuevos_devueltos
    )
    errores_total.extend(errs)

    # 5c. No repetición global en todo el plan
    ok2, errs2 = validar_sin_repeticiones_global(total_dias)
    errores_total.extend(errs2)

    # 5d. Cuotas en ventana de 7 días
    ok3, errs3 = validar_cuotas_ventana_7(total_dias)
    errores_total.extend(errs3)

    return len(errores_total) == 0, errores_total


# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{'='*80}")
    print("TEST LOCAL — Arreglo identificador_receta")
    print("Replica exactamente el flujo frontend → backend")
    print(f"{'='*80}")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Iteraciones por escenario: {ITERACIONES}")
    print(f"Escenarios de días previos: {ESCENARIOS_DIAS_PREVIOS}")
    print()

    api = API_planificacion()

    total_ok = 0
    total_fail = 0
    total_tests = 0

    for dias_prev in ESCENARIOS_DIAS_PREVIOS:
        print(f"\n{'─'*80}")
        print(f"ESCENARIO: {dias_prev} día(s) previo(s)")
        print(f"{'─'*80}")

        ok_count = 0
        fail_count = 0
        errores_acumulados: list[str] = []

        for i in range(1, ITERACIONES + 1):
            try:
                ok, errores = ejecutar_flujo_frontend_backend(api, dias_prev)
                if ok:
                    ok_count += 1
                else:
                    fail_count += 1
                    for e in errores:
                        errores_acumulados.append(f"  iter {i}: {e}")

                if i % 50 == 0 or i == ITERACIONES:
                    print(
                        f"  [{i}/{ITERACIONES}] "
                        f"OK={ok_count} FAIL={fail_count}"
                    )

            except PlanningError as exc:
                fail_count += 1
                errores_acumulados.append(f"  iter {i}: PlanningError: {exc}")
            except Exception as exc:
                fail_count += 1
                errores_acumulados.append(f"  iter {i}: Exception: {exc}")

        tasa = 100 * ok_count / (ok_count + fail_count) if (ok_count + fail_count) > 0 else 0
        estado = "PASS" if fail_count == 0 else "FAIL"
        print(f"\n  Resultado: {estado}")
        print(f"  Válidas: {ok_count}/{ok_count + fail_count} ({tasa:.1f}%)")

        if errores_acumulados:
            print(f"  Errores encontrados ({len(errores_acumulados)}):")
            # Mostrar máximo 10 para no saturar
            for e in errores_acumulados[:10]:
                print(f"    {e}")
            if len(errores_acumulados) > 10:
                print(f"    ... y {len(errores_acumulados) - 10} más")

        total_ok += ok_count
        total_fail += fail_count
        total_tests += ok_count + fail_count

    # Resumen final
    print(f"\n{'='*80}")
    print("RESUMEN FINAL")
    print(f"{'='*80}")
    print(f"Total tests: {total_tests}")
    print(f"Válidos:     {total_ok}")
    print(f"Fallidos:    {total_fail}")
    tasa_total = 100 * total_ok / total_tests if total_tests > 0 else 0
    print(f"Tasa éxito:  {tasa_total:.1f}%")

    if total_fail == 0:
        print("\n>>> TODOS LOS TESTS PASARON — El arreglo funciona correctamente <<<")
    else:
        print(f"\n>>> HAY {total_fail} FALLOS — Revisar los errores arriba <<<")

    print(f"\nFin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
