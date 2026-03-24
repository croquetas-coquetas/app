"""Prueba rápida: genera 7 días, muestra conteo ventana deslizante, y genera 7 más."""

from collections import deque
from API_nueva import API_planificacion, CUOTAS

api = API_planificacion(
    recipes_path="smartCook.recetas.json",
)


def mostrar_dias_ventana(dias, label, offset=0):
    """Muestra cada día y el conteo_ventana deslizante (últimos 7 días)."""
    ventana = deque(maxlen=7)
    conteo = {g: 0 for g in CUOTAS}

    # si hay offset, los primeros 'offset' días son previos: llenan la ventana
    for dia in dias[:offset]:
        if len(ventana) == 7:
            viejo = ventana[0]
            for turno in ("comida", "cena"):
                p = viejo.get(turno)
                if p:
                    for t in p.get("tags", []):
                        if t in conteo:
                            conteo[t] -= 1
        ventana.append(dia)
        for turno in ("comida", "cena"):
            p = dia.get(turno)
            if p:
                for t in p.get("tags", []):
                    if t in conteo:
                        conteo[t] += 1

    for idx, dia in enumerate(dias[offset:], start=offset):
        # antes de añadir, si ventana llena, restar el que sale
        if len(ventana) == 7:
            viejo = ventana[0]
            for turno in ("comida", "cena"):
                p = viejo.get(turno)
                if p:
                    for t in p.get("tags", []):
                        if t in conteo:
                            conteo[t] -= 1

        ventana.append(dia)
        for turno in ("comida", "cena"):
            p = dia.get(turno)
            if p:
                for t in p.get("tags", []):
                    if t in conteo:
                        conteo[t] += 1

        print(f"\n--- Día {idx + 1} ---")
        for turno in ("comida", "cena"):
            plato = dia.get(turno, {})
            nombre = plato.get("nombre", "???")
            tags = plato.get("tags", [])
            print(f"  {turno.capitalize():6s}: {nombre:40s} tags={tags}")
        print(f"  Ventana ({len(ventana)} días): {dict(conteo)}")

    return conteo


def verificar_cuotas(conteo, label):
    print(f"\n{label}:")
    todo_ok = True
    for grupo, n in conteo.items():
        cuota = CUOTAS[grupo]
        ok = "OK" if cuota["min"] <= n <= cuota["max"] else "FUERA"
        if ok == "FUERA":
            todo_ok = False
        print(f"  {grupo:12s}: {n:2d}  (min={cuota['min']}, max={cuota['max']})  {ok}")
    return todo_ok


# ── Primera llamada: sin días previos ──
print("=" * 80)
print("PRIMERA PLANIFICACIÓN (7 días desde cero)")
print("=" * 80)

resultado1 = api.planifica()
dias1 = resultado1["dias"]
conteo1 = mostrar_dias_ventana(dias1, "Primera semana")
verificar_cuotas(conteo1, "Conteo final primera semana")

# ── Segunda llamada: con los 7 días previos ──
print("\n\n" + "=" * 80)
print("SEGUNDA PLANIFICACIÓN (7 nuevos a partir de los 7 anteriores)")
print("=" * 80)

resultado2 = api.planifica(dias_previos=dias1)
dias2 = resultado2["dias"]

print(f"\nTotal días devueltos: {len(dias2)}")
# Mostramos todos, con offset=7 para que solo detalle los nuevos
# pero la ventana ya está poblada con los 7 previos
conteo2 = mostrar_dias_ventana(dias2, "Segunda semana", offset=7)
verificar_cuotas(conteo2, "Conteo ventana al final (últimos 7 días)")
