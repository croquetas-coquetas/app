"""Quick test: GET + POST against the running Flask server."""
import requests

# 1. GET inicial
r1 = requests.get("http://127.0.0.1:8000/api/planificacion/semanal/")
plan = r1.json()
print("=== GET: 7 dias ===")
nombres_get = []
for d in plan["dias"]:
    print(f"  {d['comida']['nombre']} / {d['cena']['nombre']}")
    nombres_get.extend([d["comida"]["nombre"], d["cena"]["nombre"]])

# 2. Simular cleanDiaPlanning (quitar _id, id, etc)
def clean(receta):
    return {
        "nombre": receta.get("nombre", ""),
        "grupo_principal": receta.get("grupo_principal", ""),
        "ingredientes": receta.get("ingredientes", []),
        "pasos": receta.get("pasos", []),
        "tags": receta.get("tags", []),
    }

previos = [
    {"dia": d["dia"], "comida": clean(d["comida"]), "cena": clean(d["cena"])}
    for d in plan["dias"][:3]
]

# 3. POST con dias_previos
r2 = requests.post(
    "http://127.0.0.1:8000/api/planificacion/semanal/",
    json={"dias_previos": previos},
)
plan2 = r2.json()
print(f"\n=== POST (3 previos): {len(plan2['dias'])} dias ===")
nombres_post_nuevos = []
for i, d in enumerate(plan2["dias"]):
    marca = "[PREV]" if i < 3 else "[NEW] "
    print(f"  {marca} {d['comida']['nombre']} / {d['cena']['nombre']}")
    if i >= 3:
        nombres_post_nuevos.extend([d["comida"]["nombre"], d["cena"]["nombre"]])

# 4. Comprobar repeticiones
previos_set = set(nombres_get[:6])  # 3 dias x 2 platos
repetidos = previos_set & set(nombres_post_nuevos)
print(f"\n=== RESULTADO ===")
print(f"Platos previos: {len(previos_set)}")
print(f"Platos nuevos:  {len(nombres_post_nuevos)}")
print(f"Repetidos:      {len(repetidos)}")
if repetidos:
    print(f"  FAIL: {repetidos}")
else:
    print("  OK: 0 repeticiones")

# 5. Health check
r3 = requests.get("http://127.0.0.1:8000/health")
print(f"\n=== HEALTH: {r3.json()} ===")
