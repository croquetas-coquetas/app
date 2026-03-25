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


class API_planificacion:
    def __init__(
        self,
        connection_uri: str | None = None,
        db_name: str | None = None,
        collection_name: str | None = None,
        recipes_path: str | Path | None = None,
        dias_totales: int = 7,
        comidas_por_dia: int = 2,
        umbral_dias: int = 1,
        rng: random.Random | None = None,
    ):
        self.__carga_variables_entorno()

        self.__DIAS_TOTALES = dias_totales
        self.__COMIDAS_POR_DIA = comidas_por_dia
        self.__UMBRAL_DIAS = umbral_dias
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

    def __tag_principal(self, receta: dict[str, Any]) -> str | None:
        tags = receta.get("tags")
        if isinstance(tags, list) and tags:
            return str(tags[0])
        return None

    def __selecciona_siguiente_plato(
        self,
        recetas: list[dict[str, Any]],
        ids_usados: set[str],
        elementos_prohibidos: deque[str],
    ) -> dict[str, Any]:
        """
        Selecciona el siguiente plato para la planificación teniendo en cuenta las selecciones anteriores.
        """

        recetas_no_usadas = [
            receta for receta in recetas if self.__identificador_receta(receta) not in ids_usados
        ]

        candidatas = [
            receta
            for receta in recetas_no_usadas
            if (tag_principal := self.__tag_principal(receta)) is None
            or tag_principal not in elementos_prohibidos
        ]

        if not candidatas:
            candidatas = recetas_no_usadas

        if not candidatas:
            raise InsufficientRecipesError(
                "No hay suficientes recetas únicas para planificar la semana completa."
            )

        return deepcopy(self.__RNG.choice(candidatas))

    def planifica(self) -> dict[str, Any]:
        """
        Genera la planificación semanal teniendo en cuenta las restricciones.

        Returns:
            dict[str, Any]: mapa con la planificación semanal completa y serializable a JSON.
        """

        recetas = self.__carga_recetas()

        if not self.__recetas_suficientes(len(recetas)):
            raise InsufficientRecipesError(
                "No hay suficientes recetas para planificar el menú semanal."
            )

        ids_usados: set[str] = set()
        elementos_prohibidos: deque[str] = deque()
        max_tags_prohibidos = self.__COMIDAS_POR_DIA * self.__UMBRAL_DIAS

        planificacion: dict[str, Any] = {
            "generado_en": datetime.now(timezone.utc).isoformat(),
            "fuente_datos": self.__FUENTE_DATOS,
            "total_recetas_disponibles": len(recetas),
            "dias": [],
        }

        for i in range(self.__DIAS_TOTALES):
            while len(elementos_prohibidos) > max_tags_prohibidos:
                elementos_prohibidos.popleft()

            plato_comida = self.__selecciona_siguiente_plato(recetas, ids_usados, elementos_prohibidos)
            ids_usados.add(self.__identificador_receta(plato_comida))

            tag_comida = self.__tag_principal(plato_comida)
            if tag_comida is not None:
                elementos_prohibidos.append(tag_comida)

            plato_cena = self.__selecciona_siguiente_plato(recetas, ids_usados, elementos_prohibidos)
            ids_usados.add(self.__identificador_receta(plato_cena))

            tag_cena = self.__tag_principal(plato_cena)
            if tag_cena is not None:
                elementos_prohibidos.append(tag_cena)

            planificacion["dias"].append(
                {
                    "dia": datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + i),
                    "comida": plato_comida,
                    "cena": plato_cena,
                }
            )

        return planificacion