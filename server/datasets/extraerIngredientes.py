import json

def extraer_ingredientes_unicos(archivo_entrada, archivo_salida):
    # Abrir y leer el archivo JSON con las recetas
    with open(archivo_entrada, 'r', encoding='utf-8') as f:
        recetas = json.load(f)
        
    nombres_ingredientes = set() # Usamos un 'set' (conjunto) para evitar duplicados automáticamente
    
    # Recorrer cada receta
    for receta in recetas:
        # Verificar que la receta tenga el array "ingredientes"
        if "ingredientes" in receta:
            # Recorrer los ingredientes de esa receta
            for ingrediente in receta["ingredientes"]:
                if "nombre" in ingrediente:
                    # Añadir el nombre al conjunto
                    nombres_ingredientes.add(ingrediente["nombre"])
                    
    # Convertir el conjunto a una lista (opcionalmente la ordenamos alfabéticamente)
    lista_nombres = sorted(list(nombres_ingredientes))
    
    # Crear la lista final con el formato deseado (id desde 0 y nombre)
    resultado = []
    for id_ingrediente, nombre in enumerate(lista_nombres):
        resultado.append({
            "id": id_ingrediente,
            "nombre": nombre
        })
        
    # Guardar el resultado en un nuevo archivo JSON
    with open(archivo_salida, 'w', encoding='utf-8') as f:
        # ensure_ascii=False permite que se guarden bien las tildes y ñ (ej. "Judía", "Azafrán")
        # indent=2 formatea el JSON para que sea legible (con saltos de línea y espacios)
        json.dump(resultado, f, ensure_ascii=False, indent=2)
        
    print(f"¡Proceso completado! Se han guardado {len(resultado)} ingredientes únicos en '{archivo_salida}'.")

# ==========================================
# CÓMO USAR EL SCRIPT
# ==========================================
# Solo tienes que cambiar 'recetas.json' por el nombre de tu archivo original
# y 'ingredientes.json' por el nombre que le quieras dar al nuevo archivo.

if __name__ == "__main__":
    archivo_origen = 'smartCook.recetas.json'       # <-- Tu JSON de entrada
    archivo_destino = 'ingredientesNuevos.json' # <-- El JSON que se generará
    
    extraer_ingredientes_unicos(archivo_origen, archivo_destino)