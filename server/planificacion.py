import importlib
import sys
from subprocess import check_call
from pymongo import MongoClient
from pymongo.collection import Collection
from collections import deque

URL_MONGO = 'mongodb+srv://dbuser:BJTRyr8OmeGBZTd4@smartcookcluster0.gjtttqf.mongodb.net/'
DIAS_TOTALES = 7
COMIDAS_POR_DIA = 2
UMBRAL_DIAS = 1

# conectamos con el servidor
modules = ["pymongo", "pprintpp","rich"]
client = MongoClient(URL_MONGO)

# LUEGO CAMBIAR DE VUELTA
db = client["bd_testing"]          # base de datos
recetas = db["platos_test"]         # colección

def instala(modules):
  print("Instalando módulos")
  for m in modules:
      # para el import quitamos [...] y ==...
      p = m.find("[")
      mi = m if p==-1 else m[:p]
      p = mi.find("==")
      mi = mi if p==-1 else mi[:p]

      torch_loader = importlib.util.find_spec(mi)
      if torch_loader is not None:
          print(m," encontrado")
      else:
          print(m," No encontrado, instalando...",end="")  
          try:        
            r = check_call([sys.executable, "-m", "pip", "install", "--user", m])
            print("¡hecho!")
          except:
            print("¡Problema al instalar ",m,"! ¿seguro que el módulo existe?",sep="")
              
  print("¡Terminado!")

# SC-01-2: Comprobar que hay suficientes recetas
def recetas_suficientes(recetas):
   return recetas.count_documents({}) >= DIAS_TOTALES * COMIDAS_POR_DIA

def selecciona_siguiente_plato(ids_usados: set, elementos_prohibidos: deque) -> map:
    """
    Selecciona el siguiente plato para la planificación teniendo en cuenta las selcciones anteriores.

    Parameters:
        ids_usados (set): ids de los alimentos usados en la planificación de esta semana.
        elementos_prohibidos (deque): tags que han sido usados en los dias anteriores.
    
    Returns:
        map: mapa con los datos del plato seleccionado
    """

    # query para seleccionar un plato excluyendo ids ya usados y tags
    plato_seleccionado = [
        {
            "$match": {
                "_id": {"$nin": list(ids_usados)},
                "elemento_principal": {"$nin": list(elementos_prohibidos)}
            }
        },
        {
            "$sample": {"size": 1}
        }
    ]


    resultado = list(recetas.aggregate(plato_seleccionado))

    # si no se puede seleccionar con las restricciones de tipos se selecciona un plato cualquiera que no haya sido añadido ya
    # A LO MEJOR HABRIA QUE COMPROBAR QUE PUEDE HABER SUFICIENTE VARIEDAD ANTES DE HACER EL ALGORITMO
    if len(resultado) == 0:
        plato_seleccionado = [
        {
            "$match": {
                "_id": {"$nin": list(ids_usados)},
            }
        },
        {
            "$sample": {"size": 1}
        }
        ]
        return recetas.aggregate(plato_seleccionado)

    return resultado[0]

def planifica() -> map:
    """
    Genera la planificación semanal teniendo en cuenta las restricciones
    
    Returns:
        map: mapa con la planificación semanal completa
    """

    # prepara las estructuras que se van a usar
    # conjunto con los ids de platos que se han usado en esta planificacion
    ids_usados = set()
    # cola donde se almacenan los tags usados en los alimentos en los UMBRAL_DIAS anteriores
    elementos_prohibidos = deque()
    # mapa que almacena la planificación semanal
    planificacion = {
        "dias": []
    }

    # por cada dia de la semana
    for i in range(DIAS_TOTALES):
        # si hay almacenados tags de mas dias de los que se desea guardar se eliminan los que llevan mas tiempo(comida y cena)
        if len(elementos_prohibidos)/2 > UMBRAL_DIAS:
            for j in range(2):
                elementos_prohibidos.popleft()
        
        # selecciona comida y cena y actualiza las restricciones para el siguiente dia
        plato_comida = selecciona_siguiente_plato(ids_usados, elementos_prohibidos)
        ids_usados.add(plato_comida.get("_id"))
        for elem in plato_comida.get("tags"):
            elementos_prohibidos.append((i + 1, elem))

        plato_cena = selecciona_siguiente_plato(ids_usados, elementos_prohibidos)
        ids_usados.add(plato_cena.get("_id"))
        for elem in plato_cena.get("tags"):
            elementos_prohibidos.append((i + 1, elem))
        
        dia = {
            "dia": i + 1,
            "comida": plato_comida,
            "cena": plato_cena
        }
        planificacion.get("dias").append(dia)  
    
    return planificacion

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
            print(dia.get("comida").get("nombre"))
            print(dia.get("cena").get("nombre"))
    else:
        print("No hay suficientes recetas para planificar el menú semanal...")

main()