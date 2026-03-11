import importlib
import sys
from subprocess import check_call
from pymongo import MongoClient
from collections import deque

class API_planificacion:
    __CONEXION = 'mongodb+srv://dbuser:BJTRyr8OmeGBZTd4@smartcookcluster0.gjtttqf.mongodb.net/'
    __DIAS_TOTALES = 7
    __COMIDAS_POR_DIA = 2
    __UMBRAL_DIAS = 1

    __CLIENT = MongoClient(__CONEXION)

    # LUEGO CAMBIAR DE VUELTA
    __DB = __CLIENT["smartCook"]        # base de datos
    __RECETAS = __DB["recetas"]         # colección

    def __init__(self):
        self.__DIAS_TOTALES = 7
        self.__COMIDAS_POR_DIA = 2
        self.__UMBRAL_DIAS = 1

    def __recetas_suficientes(self):
        return self.__RECETAS.count_documents({}) >= self.__DIAS_TOTALES * self.__COMIDAS_POR_DIA
    
    def __selecciona_siguiente_plato(self, ids_usados: set, elementos_prohibidos: deque) -> map:
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
                    "tags.0": {"$nin": list(elementos_prohibidos)}
                }
            },
            {
                "$sample": {"size": 1}
            }
        ]

        resultado = list(self.__RECETAS.aggregate(plato_seleccionado))

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
            return list(self.__RECETAS.aggregate(plato_seleccionado))[0]

        return resultado[0]

    def planifica(self) -> map:
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
        for i in range(self.__DIAS_TOTALES):
            # si hay almacenados tags de mas dias de los que se desea guardar se eliminan los que llevan mas tiempo(comida y cena)
            if len(elementos_prohibidos) > (self.__COMIDAS_POR_DIA * self.__UMBRAL_DIAS):
                for j in range(self.__COMIDAS_POR_DIA):
                    elementos_prohibidos.popleft()
            
            # selecciona comida y cena y actualiza las restricciones para el siguiente dia
            plato_comida = self.__selecciona_siguiente_plato(ids_usados, elementos_prohibidos)
            ids_usados.add(plato_comida.get("_id"))
            elementos_prohibidos.append(plato_comida.get("tags")[0])
            
            #for elem in plato_comida.get("tags"):
            #    elementos_prohibidos.append((i + 1, elem))

            plato_cena = self.__selecciona_siguiente_plato(ids_usados, elementos_prohibidos)
            ids_usados.add(plato_cena.get("_id"))
            elementos_prohibidos.append(plato_cena.get("tags")[0])
            
            #for elem in plato_cena.get("tags"):
            #    elementos_prohibidos.append((i + 1, elem))
            
            dia = {
                "dia": i + 1,
                "comida": plato_comida,
                "cena": plato_cena
            }
            planificacion.get("dias").append(dia)   
        return planificacion