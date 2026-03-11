import API_planificacion

apip = API_planificacion.API_planificacion()

res = apip.planifica()
for dia in res.get("dias"):
            print("Dia", dia.get("dia"))
            comida = dia.get("comida")
            cena = dia.get("cena")
            print(f"{comida.get('nombre')} - {comida.get('tags', [None])[0]}")
            print(f"{cena.get('nombre')} - {cena.get('tags', [None])[0]}")

"""
def main():

    print("Número de documentos en la colección:", recetas.count_documents({}))

    # SC-01-2: Comprobar que no se ha hecho ya la planificación
    # AQUI SE COMPROBARÍA EN LA BD (O DND LO GUARDEMOS) SI LA PLANIFICACIÓN DE ESTA SEMANA YA ESTÁ HECHA

    # SC-01-3: Comprobar que hay suficientes recetas
    if recetas_suficientes(recetas):
        # SC-01-01: Genera los platos de la planificación
        print("Hay suficientes recetas para planificar el menú semanal.")
        planificacion_semanal = planifica()

        for dia in planificacion_semanal.get("dias"):
            print("Dia", dia.get("dia"))
            comida = dia.get("comida")
            cena = dia.get("cena")
            print(f"{comida.get('nombre')} - {comida.get('tags', [None])[0]}")
            print(f"{cena.get('nombre')} - {cena.get('tags', [None])[0]}")
    else:
        print("No hay suficientes recetas para planificar el menú semanal...")
"""