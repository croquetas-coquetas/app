import json

# 1. Cargar ambos archivos JSON
with open("ingredientesNuevos.json", "r", encoding="utf-8") as f:
    ingredientes_nuevos = json.load(f)

with open("smartCook.recetas.json", "r", encoding="utf-8") as f:
    recetas = json.load(f)

# 2. Crear un diccionario nombre -> unidad para búsqueda rápida
unidades = {}
for ing in ingredientes_nuevos:
    unidades[ing["nombre"]] = ing["unidad"]

# 3. Recorrer cada receta y cada ingrediente, añadiendo "unidad"
no_encontrados = set()
for receta in recetas:
    for ingrediente in receta.get("ingredientes", []):
        nombre = ingrediente["nombre"]
        if nombre in unidades:
            ingrediente["unidad"] = unidades[nombre]
        else:
            no_encontrados.add(nombre)

# 4. Guardar el resultado en el mismo archivo
with open("smartCook.recetas.json", "w", encoding="utf-8") as f:
    json.dump(recetas, f, ensure_ascii=False, indent=2)

# 5. Informar del resultado
print(f"Recetas actualizadas: {len(recetas)}")
if no_encontrados:
    print(f"\nIngredientes NO encontrados en ingredientesNuevos.json ({len(no_encontrados)}):")
    for nombre in sorted(no_encontrados):
        print(f"  - {nombre}")
else:
    print("Todos los ingredientes encontrados correctamente.")
