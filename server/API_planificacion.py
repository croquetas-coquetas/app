import json
import os
import random
from collections import deque
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
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
    "verdura":    {"min": 7, "max": 14},
    "lácteo":     {"min": 2, "max": 5},
    "cereal":     {"min": 3, "max": 7},
    "legumbre":   {"min": 1, "max": 4},
    "fruto seco": {"min": 0, "max": 3},
    "pescado":    {"min": 2, "max": 5},
    "huevo":      {"min": 1, "max": 4},
    "carne":      {"min": 2, "max": 6},
}


class API_planificacion:
    def __init__(
        self,
        connection_uri: str | None = None,
        db_name: str | None = None,
        collection_name: str | None = None,
        ingredients_path: str | None = None,
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
        self.__INGREDIENTS_NAME = ingredients_path or os.getenv("MONGODB_INGREDIENTS", "ingredientes")
        self.__RECIPES_PATH = Path(
            recipes_path
            or os.getenv("RECETAS_JSON_PATH")
            or Path(__file__).resolve().parent / "datasets" / "smartCook.recetas.json"
        )

        self.__CLIENT: MongoClient | None = None
        self.__RECETAS: Collection | None = None
        self.__INGREDIENTES: Collection | None = None
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
            self.__INGREDIENTES = client[self.__DB_NAME][self.__INGREDIENTS_NAME]
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
        # "nombre" se usa como clave primaria porque es el único campo que está
        # garantizado tanto en las recetas del JSON/MongoDB como en los platos
        # que llegan del frontend como dias_previos (donde _id e id no se envían).
        # Todos los nombres son únicos en la base de datos de recetas.
        for clave in ("nombre", "_id", "id"):
            valor = receta.get(clave)
            if valor is not None:
                return str(valor)

        return json.dumps(receta, ensure_ascii=False, sort_keys=True)

    def __tags_nutricionales(self, receta: dict[str, Any]) -> list[str]:
        """Devuelve los tags nutricionales de la receta leyendo directamente el campo 'tags'."""
        return [t for t in receta.get("tags", []) if t in CUOTAS]

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
        # crítico  → cerca del máximo (> 70% del rango disponible)
        # libre    → ni urgente ni bloqueado
        urgentes: set[str] = set()
        bloqueados: set[str] = set()
        criticos: set[str] = set()

        for grupo, cuota in CUOTAS.items():
            ya_tengo = conteo.get(grupo, 0)
            pendiente_min = cuota["min"] - ya_tengo
            exceso = ya_tengo - cuota["max"]

            # si me faltan tantos platos de este grupo como platos me quedan
            # es imposible cubrirlo si no elijo uno ahora mismo
            if pendiente_min > 0 and pendiente_min >= platos_restantes:
                urgentes.add(grupo)

            # si ya llegué al tope no quiero más de este grupo
            if ya_tengo >= cuota["max"]:
                bloqueados.add(grupo)
            # si estoy muy cerca del máximo, es crítico
            elif ya_tengo > 0.7 * cuota["max"]:
                criticos.add(grupo)

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
            # hay grupos urgentes: solo pasan recetas que tengan algún tag urgente
            candidatas = [
                r for r in disponibles
                if any(t in urgentes for t in self.__tags_nutricionales(r))
            ]
        else:
            # sin urgencia: descartamos recetas que excederían máximos
            # primero: rechazar recetas cualquier tag bloqueado
            candidatas = [
                r for r in disponibles
                if not any(t in bloqueados for t in self.__tags_nutricionales(r))
            ]
            
            # si quedan pocas, permitir críticos pero no bloqueados
            if not candidatas or len(candidatas) < len(disponibles) / 3:
                candidatas = [
                    r for r in disponibles
                    if not self.__tags_nutricionales(r)
                    or not all(t in bloqueados for t in self.__tags_nutricionales(r))
                ]

        # si los filtros dejaron el pool vacío, quitamos restricciones de bloqueados
        # pero mantenemos disponibilidad
        if not candidatas:
            candidatas = disponibles

        # puntuamos cada receta de forma más sofisticada
        def score(r: dict[str, Any]) -> float:
            # Bonus: cuánta "deuda" de mínimos cubre
            bonus_minimos = 0.0
            for tag in self.__tags_nutricionales(r):
                ya = conteo.get(tag, 0)
                cuota = CUOTAS[tag]
                pendiente_min = cuota["min"] - ya
                if pendiente_min > 0:
                    bonus_minimos += pendiente_min / cuota["min"]
            
            # Penalización: riesgo de exceder máximos
            penalidad_maximos = 0.0
            for tag in self.__tags_nutricionales(r):
                ya = conteo.get(tag, 0)
                cuota = CUOTAS[tag]
                # Si ya estamos en max, castigo muy alto
                if ya >= cuota["max"]:
                    penalidad_maximos += 10.0
                # Si estamos cerca del max, castigo proporcional
                elif ya >= 0.7 * cuota["max"]:
                    riesgo = (ya - 0.7 * cuota["max"]) / (0.3 * cuota["max"])
                    penalidad_maximos += 5.0 * riesgo
            
            # Puntuación final: bonus (queremos esto) - penalidad (no queremos esto)
            total = bonus_minimos - penalidad_maximos
            return total

        # nos quedamos solo con las que tienen el score más alto
        max_score = max(score(r) for r in candidatas)
        candidatas_top = [r for r in candidatas if score(r) >= max_score]

        # entre las mejores elegimos al azar para que no salga siempre lo mismo
        return deepcopy(self.__RNG.choice(candidatas_top))

    def planifica(self, dias_previos: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """
        Genera la planificación semanal teniendo en cuenta las restricciones
        nutricionales por tags y sin repetir plato en los últimos 14 días.

        Si se proporcionan días previos, los usa para inicializar el historial
        de platos recientes y el conteo de tags, y los incluye en el resultado
        (recortando a un máximo de 14 días).

        Args:
            dias_previos: lista opcional de días generados previamente, cada uno
                          con claves 'comida' y 'cena' conteniendo los platos.

        Returns:
            dict[str, Any]: mapa con la planificación semanal completa y serializable a JSON.
        """

        recetas = self.__carga_recetas()

        if not self.__recetas_suficientes(len(recetas)):
            raise InsufficientRecipesError(
                "No hay suficientes recetas para planificar el menú semanal."
            )

        ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)
        conteo_ventana: dict[str, int] = {g: 0 for g in CUOTAS}
        # ventana deslizante de los últimos 7 días para mantener conteo_ventana
        ventana_dias: deque[dict[str, Any]] = deque(maxlen=self.__DIAS_TOTALES)

        if dias_previos:
            # cargamos los identificadores de los platos previos para evitar repetirlos
            for dia in dias_previos:
                for turno in ("comida", "cena"):
                    plato = dia.get(turno)
                    if plato is not None:
                        ids_recientes.append(self.__identificador_receta(plato))

            # llenamos la ventana con los últimos 7 días previos y acumulamos sus tags
            for dia in dias_previos[-self.__DIAS_TOTALES:]:
                ventana_dias.append(dia)
                for turno in ("comida", "cena"):
                    plato = dia.get(turno)
                    if plato is not None:
                        for tag in self.__tags_nutricionales(plato):
                            conteo_ventana[tag] += 1

        planificacion: dict[str, Any] = {
            "generado_en": datetime.now(timezone.utc).isoformat(),
            "fuente_datos": self.__FUENTE_DATOS,
            "total_recetas_disponibles": len(recetas),
            "dias": [],
        }

        plato_k = 1
        for i in range(self.__DIAS_TOTALES):
            # si la ventana ya tiene 7 días, el más antiguo sale y restamos sus tags
            if len(ventana_dias) == self.__DIAS_TOTALES:
                dia_expulsado = ventana_dias[0]  # será expulsado al hacer append
                for turno in ("comida", "cena"):
                    plato = dia_expulsado.get(turno)
                    if plato is not None:
                        for tag in self.__tags_nutricionales(plato):
                            conteo_ventana[tag] -= 1

            dia: dict[str, Any] = {
                "dia": (datetime.now(timezone.utc) + timedelta(days=i)).isoformat(),
            }

            for turno in ("comida", "cena"):
                plato = self.__selecciona_plato_con_cuotas(
                    recetas, ids_recientes, conteo_ventana, plato_k
                )

                ids_recientes.append(self.__identificador_receta(plato))

                for tag in self.__tags_nutricionales(plato):
                    conteo_ventana[tag] += 1

                dia[turno] = plato
                plato_k += 1

            # añadimos el nuevo día a la ventana (expulsa el más antiguo si maxlen)
            ventana_dias.append(dia)
            planificacion["dias"].append(dia)

        if dias_previos:
            todos_los_dias = list(dias_previos) + planificacion["dias"]
            max_dias = self.__DIAS_TOTALES * 2
            if len(todos_los_dias) > max_dias:
                todos_los_dias = todos_los_dias[-max_dias:]
            planificacion["dias"] = todos_los_dias

        return planificacion

    def get_ingredientes(self) -> dict[str, str]:
        mapa: dict[str, str] = {}
        if self.__CONEXION:
            if self.__INGREDIENTS_NAME is None:
                raise PlanningError(
                    "Se configuró MONGODB_URI, pero no se pudo conectar a MongoDB. "
                    "Revisa URI, red y credenciales."
                )


            try:
                for ing in self.__INGREDIENTES.find({}):
                    nombre = ing.get("nombre")
                    categoria = ing.get("categoria")
                    if isinstance(nombre, str) and isinstance(categoria, str):
                        mapa[nombre.lower()] = categoria.strip()
                
            except PyMongoError as exc:
                raise PlanningError("No se pudieron cargar las recetas desde MongoDB.") from exc
        return mapa