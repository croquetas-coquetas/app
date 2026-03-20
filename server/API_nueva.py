import json
import os
import random
from collections import deque
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError


class PlanningError(RuntimeError):
    """Error genérico al construir la planificación semanal."""


class InsufficientRecipesError(PlanningError):
    """No hay suficientes recetas únicas para generar la semana completa."""


CUOTAS: dict[str, dict[str, int]] = {
    "verdura":    {"min": 5, "max": 8},
    "lácteo":     {"min": 2, "max": 3},
    "cereal":     {"min": 3, "max": 5},
    "legumbre":   {"min": 2, "max": 3},
    "fruto seco": {"min": 1, "max": 2},
    "pescado":    {"min": 3, "max": 4},
    "huevo":      {"min": 2, "max": 3},
    "carne":      {"min": 2, "max": 3},
}


class API_planificacion:
    def __init__(
        self,
        connection_uri: str | None = None,
        db_name: str | None = None,
        collection_name: str | None = None,
        recipes_path: str | Path | None = None,
        dias_totales: int = 7,
        comidas_por_dia: int = 2,
        rng: random.Random | None = None,
    ):
        self.__carga_variables_entorno()

        self.__DIAS_TOTALES = dias_totales
        self.__COMIDAS_POR_DIA = comidas_por_dia
        self.__TOTAL_PLATOS = dias_totales * comidas_por_dia
        self.__RNG = rng or random.Random()

        self.__CONEXION = connection_uri if connection_uri is not None else os.getenv("MONGODB_URI")
        self.__DB_NAME = db_name or os.getenv("MONGODB_DB", "smartCook")
        self.__COLLECTION_NAME = collection_name or os.getenv("MONGODB_COLLECTION", "recetas")
        self.__RECIPES_PATH = Path(
            recipes_path
            or os.getenv("RECETAS_JSON_PATH")
            or Path(__file__).resolve().parent.parent / "recetas.json"
        )

        self.__CLIENT: MongoClient | None = None
        self.__RECETAS: Collection | None = None
        self.__FUENTE_DATOS = "json"
        self.__conectar_mongodb_si_esta_configurado()

    def __carga_variables_entorno(self) -> None:
        candidatos = (
            Path(__file__).resolve().parent / ".env",
            Path(__file__).resolve().parent.parent / ".env",
        )

        for ruta in candidatos:
            if ruta.exists():
                load_dotenv(dotenv_path=ruta, override=False)

    def __conectar_mongodb_si_esta_configurado(self) -> None:
        if not self.__CONEXION:
            return

        try:
            timeout_ms = int(os.getenv("MONGODB_TIMEOUT_MS", "8000"))
            client = MongoClient(self.__CONEXION, serverSelectionTimeoutMS=timeout_ms)
            client.admin.command("ping")
            self.__CLIENT = client
            self.__RECETAS = client[self.__DB_NAME][self.__COLLECTION_NAME]
            self.__FUENTE_DATOS = "mongodb"
        except (PyMongoError, ValueError):
            self.__CLIENT = None
            self.__RECETAS = None
            self.__FUENTE_DATOS = "json"

    def __carga_recetas(self) -> list[dict[str, Any]]:
        if self.__CONEXION:
            if self.__RECETAS is None:
                raise PlanningError(
                    "Se configuró MONGODB_URI, pero no se pudo conectar a MongoDB. "
                    "Revisa URI, red y credenciales."
                )

            try:
                recetas = list(self.__RECETAS.find({}))
            except PyMongoError as exc:
                raise PlanningError("No se pudieron cargar las recetas desde MongoDB.") from exc

            if not recetas:
                raise PlanningError(
                    "MongoDB está conectado pero la colección de recetas está vacía."
                )
        else:
            if not self.__RECIPES_PATH.exists():
                raise PlanningError(
                    f"No se encontró el fichero de recetas en '{self.__RECIPES_PATH}'."
                )

            with self.__RECIPES_PATH.open("r", encoding="utf-8") as recipes_file:
                recetas = json.load(recipes_file)

            if not isinstance(recetas, list):
                raise PlanningError("El fichero de recetas no contiene una lista válida de recetas.")

        return [self.__normaliza_receta(receta) for receta in recetas]

    def __normaliza_receta(self, receta: dict[str, Any]) -> dict[str, Any]:
        return self.__to_json_compatible(deepcopy(receta))

    def __to_json_compatible(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self.__to_json_compatible(inner_value) for key, inner_value in value.items()}
        if isinstance(value, list):
            return [self.__to_json_compatible(item) for item in value]
        if isinstance(value, tuple):
            return [self.__to_json_compatible(item) for item in value]
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        return str(value)

    def __recetas_suficientes(self, total_recetas: int) -> bool:
        return total_recetas >= self.__DIAS_TOTALES * self.__COMIDAS_POR_DIA

    def __identificador_receta(self, receta: dict[str, Any]) -> str:
        for clave in ("_id", "id", "nombre"):
            valor = receta.get(clave)
            if valor is not None:
                return str(valor)

        return json.dumps(receta, ensure_ascii=False, sort_keys=True)

    def __tags(self, receta: dict[str, Any]) -> list[str]:
        """
        Detecta TODOS los tags nutricionales de una receta.
        Busca en nombre, categoría e ingredientes para identificar
        múltiples grupos nutricionales (primario y secundarios).
        
        Ejemplo: "Berenjenas Rellenas de Carne" → ["carne", "verdura"]
        """
        tags_encontrados = set()
        nombre = receta.get("nombre", "").lower()
        categoria = receta.get("categoria", "").lower()
        
        # Palabras clave para detectar grupos nutricionales (múltiples por grupo)
        PALABRAS_CLAVE = {
            "verdura": ["berenjana", "berenjena", "espárrago", "espárragos", "lechuga", "tomate", 
                       "zanahoria", "cebolla", "pimiento", "calabaza", "espinaca", "col", "brócoli",
                       "coliflor", "champiñón", "seta", "patata", "papa", "guisante", "calabacín"],
            "lácteo": ["queso", "leche", "yogur", "nata", "crema", "bechamel", "mantequilla", "helado"],
            "cereal": ["arroz", "pasta", "pan", "harina", "risotto", "fideos", "harina"],
            "legumbre": ["lenteja", "garbanza", "alubias", "judía", "alubia", "legumbre", "faba", "garbanzo"],
            "fruto seco": ["nuez", "almendra", "cacahuete", "pistacho", "avellana", "piñón"],
            "pescado": ["merluza", "bacalao", "salmón", "trucha", "dorada", "sardina", "anchoa", 
                       "atún", "pez espada", "lubina", "gamba", "langostino", "camarón", "ostra", 
                       "mejillón", "almeja", "navaja"],
            "carne": ["pollo", "pavo", "ternera", "cerdo", "cordero", "jamón", "chorizo", "tocino",
                     "panceta", "albóndiga", "jamon", "ternera"],
            "huevo": ["huevo", "tortilla"],
        }
        
        # 1. Buscar por nombre (máxima prioridad)
        for grupo, palabras in PALABRAS_CLAVE.items():
            for palabra in palabras:
                if palabra in nombre:
                    if grupo in CUOTAS:
                        tags_encontrados.add(grupo)
                    break
        
        # 2. Buscar en ingredientes (antes de mapear categoría para evitar falsos positivos)
        ingredientes = receta.get("ingredientes", [])
        ingredientes_str = " ".join([ing.get("nombre", "").lower() for ing in ingredientes])
        
        for grupo, palabras in PALABRAS_CLAVE.items():
            for palabra in palabras:
                if palabra in ingredientes_str:
                    if grupo in CUOTAS:
                        tags_encontrados.add(grupo)
                    break
        
        # 3. Mapear por categoría (solo si no tenemos tags aún, o para mapeos seguros)
        MAPEO_CATEGORIA = {
            "pescado": "pescado",
            "marisco": "pescado",
            "carne": "carne",
            "pollo": "carne",
            "mexicano": "carne",
            "huevos": "huevo",
            "pasta": "cereal",
            "arroz": "cereal",
            "legumbre": "legumbre",
            "guiso": "legumbre",
            "sopa": "verdura",
            "ensalada": "verdura",
            "verdura": "verdura",
            "postre": "lácteo",
            "tapa": None,  # No mapear automáticamente, depender de ingredientes
        }
        
        tag_categoria = MAPEO_CATEGORIA.get(categoria)
        if tag_categoria and tag_categoria in CUOTAS:
            tags_encontrados.add(tag_categoria)
        
        return sorted(list(tags_encontrados)) if tags_encontrados else []
        

    def __selecciona_plato_con_cuotas(
        self,
        recetas: list[dict[str, Any]],
        ids_recientes: deque[str],
        conteo: dict[str, int],
        plato_k: int,
    ) -> dict[str, Any]:

        # cuantos platos quedan por elegir incluyendo este
        # si estamos en el plato 13 de 14, quedan 2
        platos_restantes = self.__TOTAL_PLATOS - plato_k + 1

        # vamos a clasificar cada grupo nutricional en uno de tres estados:
        # urgente  → si no elegimos de este grupo ahora, no llegaremos al mínimo
        # bloqueado → ya llegamos al máximo, no podemos poner más
        # libre    → ni urgente ni bloqueado, podemos elegir o no
        urgentes: set[str] = set()
        bloqueados: set[str] = set()

        for grupo, cuota in CUOTAS.items():
            ya_tengo = conteo.get(grupo, 0)
            pendiente = cuota["min"] - ya_tengo

            # si me faltan tantos platos de este grupo como platos me quedan
            # es imposible cubrirlo si no elijo uno ahora mismo
            if pendiente > 0 and pendiente >= platos_restantes:
                urgentes.add(grupo)

            # si ya llegué al tope no quiero más de este grupo
            if ya_tengo >= cuota["max"]:
                bloqueados.add(grupo)

        # quitamos del pool las recetas que hemos puesto en los últimos 14 días
        # para no repetir plato tan pronto
        disponibles = [
            r for r in recetas
            if self.__identificador_receta(r) not in ids_recientes
        ]

        # si por alguna razón todas están bloqueadas por recencia, usamos todas
        # mejor repetir que quedarse sin opciones
        if not disponibles:
            disponibles = list(recetas)

        # ahora filtramos según el estado de los grupos
        if urgentes:
            # hay grupos que necesitamos sí o sí, solo pasan recetas
            # cuyo tag principal esté en los grupos urgentes
            candidatas = [
                r for r in disponibles
                if self.__tags(r) and self.__tags(r)[0] in urgentes
            ]
        else:
            # no hay urgencia, pero evitamos recetas cuyo tag principal
            # esté bloqueado, si tiene uno libre la dejamos pasar
            candidatas = [
                r for r in disponibles
                if not (self.__tags(r) and self.__tags(r)[0] in bloqueados)
            ]

        # si los filtros anteriores dejaron el pool vacío, quitamos restricciones
        # y usamos todas las disponibles, cumplir algo es mejor que no elegir nada
        if not candidatas:
            candidatas = disponibles

        # puntuamos cada receta candidata según cuánta "deuda nutricional" cubre
        # el scoring se basa en TODOS los tags para preferir recetas versátiles
        # pero respetando que el tag principal no exceda su máximo
        def score(r: dict[str, Any]) -> float:
            total = 0.0
            tags = self.__tags(r)
            
            # el tag principal (primero) es obligatorio en el scoring
            if tags:
                tag_principal = tags[0]
                if tag_principal in CUOTAS:
                    ya = conteo.get(tag_principal, 0)
                    pendiente = CUOTAS[tag_principal]["min"] - ya
                    if pendiente > 0:
                        total += pendiente / CUOTAS[tag_principal]["min"]
                    # si ya llegó al máximo, penalizar bastante pero no prohibir
                    elif ya >= CUOTAS[tag_principal]["max"]:
                        total -= 0.5
                
                # los tags secundarios (resto) dan bonus si no exceden máximo
                for tag in tags[1:]:
                    if tag in CUOTAS:
                        ya = conteo.get(tag, 0)
                        pendiente = CUOTAS[tag]["min"] - ya
                        if pendiente > 0 and ya < CUOTAS[tag]["max"]:
                            total += (pendiente / CUOTAS[tag]["min"]) * 0.5  # bonus menor
            
            return total

        # nos quedamos solo con las que tienen el score más alto
        max_score = max(score(r) for r in candidatas)
        candidatas_top = [r for r in candidatas if score(r) >= max_score]

        # entre las mejores elegimos al azar para que no salga siempre lo mismo
        return deepcopy(self.__RNG.choice(candidatas_top))

    def planifica(self) -> dict[str, Any]:
        """
        Genera la planificación semanal teniendo en cuenta las restricciones
        nutricionales por tags y sin repetir plato en los últimos 14 días.

        Returns:
            dict[str, Any]: mapa con la planificación semanal completa y serializable a JSON.
        """

        recetas = self.__carga_recetas()

        if not self.__recetas_suficientes(len(recetas)):
            raise InsufficientRecipesError(
                "No hay suficientes recetas para planificar el menú semanal."
            )

        # guardamos los ids de los últimos 28 platos elegidos (14 días x 2 platos)
        # cuando se llena y añadimos uno nuevo, el más antiguo sale solo
        # así conseguimos que un plato no se repita en 14 días sin lógica extra
        ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)

        # contador de cuántos platos de cada grupo llevamos en la semana actual
        # empieza todo a 0 y va creciendo conforme elegimos platos
        conteo_ventana: dict[str, int] = {g: 0 for g in CUOTAS}

        planificacion: dict[str, Any] = {
            "generado_en": datetime.now(timezone.utc).isoformat(),
            "fuente_datos": self.__FUENTE_DATOS,
            "total_recetas_disponibles": len(recetas),
            "dias": [],
        }

        # plato_k es el número de plato que vamos a elegir ahora, del 1 al 14
        # lo necesitamos para saber cuántos platos quedan y calcular urgencias
        plato_k = 1
        for i in range(self.__DIAS_TOTALES):
            dia: dict[str, Any] = {
                "dia": datetime.now(timezone.utc).replace(
                    day=datetime.now(timezone.utc).day + i
                ),
            }

            for turno in ("comida", "cena"):
                plato = self.__selecciona_plato_con_cuotas(
                    recetas, ids_recientes, conteo_ventana, plato_k
                )

                # añadimos el plato elegido al historial reciente
                ids_recientes.append(self.__identificador_receta(plato))

                # actualizamos el conteo sumando SOLO el tag principal (el primero)
                # esto mantiene las restricciones de cuotas originales
                tags = self.__tags(plato)
                if tags and tags[0] in conteo_ventana:
                    conteo_ventana[tags[0]] += 1

                # Actualizar los tags de la receta con los tags nutricionales detectados
                tags_nutricionales = self.__tags(plato)
                tags_originales = plato.get("tags", [])
                # Añadir tags nutricionales al inicio si no están ya
                tags_finales = list(tags_nutricionales)
                for tag in tags_originales:
                    if tag not in tags_finales:
                        tags_finales.append(tag)
                plato["tags"] = tags_finales

                dia[turno] = plato
                plato_k += 1

            planificacion["dias"].append(dia)

        return planificacion