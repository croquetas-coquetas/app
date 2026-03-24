# 🗺️ Índice de Ubicaciones de Código

## Búsqueda Rápida por Concepto

### 🔴 **CUOTAS Y RESTRICCIONES NUTRICIONALES**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Definición de cuotas | Línea 23-31 | Define min/max por grupo |
| Obtener grupo de una receta | L. 155-158 | Extrae tags que están en CUOTAS |
| Calcular pendiente | L. 173-174 | `CUOTAS[g]["min"] - ya_tengo` |
| Verificar máximo alcanzado | L. 183 | `ya_tengo >= CUOTAS[g]["max"]` |
| Actualizar contador | L. 280-281 | `conteo_ventana[tag] += 1` |

---

### 🔵 **RECENCIA Y NO-REPETICIÓN**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Crear deque de recencia | L. 256 | `deque(maxlen=28)` |
| Obtener ID de receta | L. 144-153 | Busca `_id`, `id`, `nombre` o JSON |
| Añadir a recientes | L. 276 | `ids_recientes.append(id)` |
| Filtrar por recencia | L. 186-193 | Excluir if `id in ids_recientes` |
| Tamaño máximo (14 días × 2) | L. 256 | `maxlen=TOTAL_PLATOS * 2` |

---

### 🟡 **CLASIFICACIÓN: URGENTE/BLOQUEADO/LIBRE**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Calcular platos restantes | L. 162-166 | `TOTAL_PLATOS - plato_k + 1` |
| Detectar URGENCIA | L. 173-177 | `pendiente >= platos_restantes` |
| Detectar BLOQUEO | L. 183-184 | `ya_tengo >= max` |
| Conjunto urgentes | L. 168 | `urgentes: set[str]` |
| Conjunto bloqueados | L. 169 | `bloqueados: set[str]` |

---

### 🟢 **FILTRADO DE CANDIDATAS**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Con urgentes | L. 198-202 | Solo tags urgentes |
| Sin urgentes | L. 204-207 | Excluir todos bloqueados |
| Fallback si vacío | L. 209-211 | Relaja restricciones si es necesario |
| Pool final de candidatas | L. 213 | `candidatas` después de filtros |

---

### 🟣 **PUNTUACIÓN**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Función score() | L. 214-221 | Calcula deuda nutricional |
| Score máximo | L. 223 | `max(score(r) for r in candidatas)` |
| Top candidatas | L. 224 | Recetas con score == max |
| Selección aleatoria | L. 226 | `RNG.choice(top)` |

---

### ⚫ **FLUJO PRINCIPAL**

| Concepto | Ubicación | Qué hace |
|----------|-----------|----------|
| Punto de entrada | L. 238 | Método `planifica()` |
| Loop días | L. 263 | `for i in range(DIAS_TOTALES)` |
| Loop comidas | L. 268 | `for turno in ("comida", "cena")` |
| Selecciona plato | L. 269 | Llama a `__selecciona_plato_con_cuotas()` |
| Actualiza historial | L. 276 | `ids_recientes.append()` |
| Actualiza conteo | L. 279-281 | `conteo[tag] += 1` |
| Guarda en planificación | L. 283 | `dia[turno] = plato` |
| Retorna JSON | L. 293 | `return planificacion` |

---

## Búsqueda por Palabra Clave

### Si busco... `TAGS`
```
Definidos en: CUOTAS (L. 23)
Extraídos por: __tags_nutricionales() (L. 155-158)
Usados en: __selecciona_plato_con_cuotas() (L. 160+)
Actualización: Línea 280-281
Validación: Solo tags en CUOTAS (L. 156)
```

### Si busco... `URGENTE`
```
Detectado en: L. 173-177
Almacenado en: urgentes: set (L. 168)
Utilizado en: L. 197-202
Condición: pendiente >= platos_restantes
```

### Si busco... `BLOQUEADO`
```
Detectado en: L. 183-184
Almacenado en: bloqueados: set (L. 169)
Utilizado en: L. 204-207
Condición: ya_tengo >= CUOTAS[g]["max"]
```

### Si busco... `RECENCIA`
```
Estructura: deque con maxlen=28 (L. 256)
Actualizar: L. 276
Filtrar: L. 186-193
Máximo: __TOTAL_PLATOS * 2
```

### Si busco... `PUNTUACIÓN`
```
Función: score() (L. 214-221)
Fórmula: Σ(pendiente/min) para tags
Uso: Línea 223
Top: L. 224
```

### Si busco... `MONGODB`
```
Conexión: __conectar_mongodb_si_esta_configurado() (L. 76-90)
URI: Línea 77
Carga: __carga_recetas() (L. 92+)
Fallback: JSON automático
```

### Si busco... `JSON`
```
Carga: __carga_recetas() (L. 92+)
Ruta: self.__RECIPES_PATH (L. 53-60)
Compatibilidad: __to_json_compatible() (L. 122-139)
Salida: json.dumps() al retornar
```

---

## Por Línea (Referencia Completa)

```python
    13 class PlanningError(RuntimeError):
    14     """Error genérico al construir la planificación semanal."""
    17 class InsufficientRecipesError(PlanningError):
    18     """No hay suficientes recetas únicas para generar la semana completa."""
    23 CUOTAS: dict[str, dict[str, int]] = {        ← ⭐ DEFINI CUOTAS
    36 class API_planificacion:
    37     def __init__(
        38         self,
        39         connection_uri: str | None = None,
        40         db_name: str | None = None,
        41         collection_name: str | None = None,
        42         recipes_path: str | Path | None = None,
        43         dias_totales: int = 7,            ← ⭐ CONFIG DÍAS
        44         comidas_por_dia: int = 2,        ← ⭐ CONFIG COMIDAS
        45         rng: random.Random | None = None,← ⭐ RNG PARA REPRODUCIBILIDAD
        46     ):
        49         self.__carga_variables_entorno()
        50         self.__DIAS_TOTALES = dias_totales
        51         self.__COMIDAS_POR_DIA = comidas_por_dia
        52         self.__TOTAL_PLATOS = dias_totales * comidas_por_dia ← ⭐ TOTAL
        53         self.__RNG = rng or random.Random()
        55         self.__CONEXION = connection_uri or ...           ← ⭐ MONGODB URI
        56         self.__DB_NAME = db_name or ...
        57         self.__COLLECTION_NAME = collection_name or ...
        58         self.__RECIPES_PATH = Path(...)                  ← ⭐ RUTA JSON
        62         self.__CLIENT: MongoClient | None = None
        63         self.__RECETAS: Collection | None = None
        64         self.__FUENTE_DATOS = "json"
        65         self.__conectar_mongodb_si_esta_configurado()
        
    67     def __carga_variables_entorno(self) -> None:    ← ⭐ CARGA .ENV
        76     def __conectar_mongodb_si_esta_configurado(self) -> None: ← ⭐ CONEXIÓN
        92     def __carga_recetas(self) -> list[dict[str, Any]]:      ← ⭐ CARGA RECETAS
       119     def __normaliza_receta(self, receta: dict[str, Any]) -> dict[str, Any]: 
       122     def __to_json_compatible(self, value: Any) -> Any:      ← ⭐ CONVERSIÓN
       141     def __recetas_suficientes(self, total_recetas: int) -> bool: ← ⭐ VALIDACIÓN
       144     def __identificador_receta(self, receta: dict[str, Any]) -> str: ← ⭐ ID
       155     def __tags_nutricionales(self, receta: dict[str, Any]) -> list[str]: ← ⭐ TAGS
       160     def __selecciona_plato_con_cuotas(         ← ⭐⭐⭐ CORAZÓN ALGORITMO
       162         platos_restantes = ...                 ← PLATOS RESTANTES
       168         urgentes: set[str] = set()             ← URGENTES
       169         bloqueados: set[str] = set()           ← BLOQUEADOS
       173         for grupo, cuota in CUOTAS.items():    ← LOOP CUOTAS
       177             if pendiente > 0 and pendiente >= platos_restantes: ← URGENCIA
       183             if ya_tengo >= cuota["max"]:       ← BLOQUEO
       186         disponibles = [...]                    ← FILTRO RECENCIA
       195         if not disponibles:
       198         if urgentes:                           ← DECISIÓN URGENTES
       204         else:                                  ← DECISIÓN SIN URGENTES
       209         if not candidatas:
       214         def score(r: dict[str, Any]) -> float: ← ⭐ FUNCIÓN SCORE
       223         max_score = ...                        ← MEJOR SCORE
       224         candidatas_top = [...]                ← TOP CANDIDATAS
       226         return deepcopy(self.__RNG.choice(candidatas_top)) ← ELEGIR ALEATORIA
       
       238     def planifica(self) -> dict[str, Any]:     ← ⭐⭐⭐ PUNTO ENTRADA
       244         recetas = self.__carga_recetas()       ← CARGA
       249         if not self.__recetas_suficientes(len(recetas)): ← VALIDACIÓN
       256         ids_recientes: deque[str] = deque(...) ← DEQUE RECENCIA
       259         conteo_ventana: dict[str, int] = {...} ← CONTADOR GRUPOS
       263         for i in range(self.__DIAS_TOTALES):   ← LOOP DÍAS
       268             for turno in ("comida", "cena"):    ← LOOP COMIDAS
       269                 plato = self.__selecciona_plato_con_cuotas(...) ← SELECCIONAR
       276                 ids_recientes.append(...)       ← GUARDAR ID
       280                 for tag in self.__tags_nutricionales(plato): ← LOOP TAGS
       281                     conteo_ventana[tag] += 1    ← ACTUALIZAR CONTEO
       283                 dia[turno] = plato              ← GUARDAR PLATO
       290         planificacion["dias"].append(dia)       ← GUARDAR DÍA
       293         return planificacion                    ← RETORNAR
```

---

## Mapa de Estructura de Datos

```
API_planificacion (clase)
├─ __init__(días, comidas, mongodb_uri, json_path)
│  ├─ __DIAS_TOTALES: 7
│  ├─ __COMIDAS_POR_DIA: 2
│  ├─ __TOTAL_PLATOS: 14
│  ├─ __RNG: Random
│  ├─ __CONEXION: str | None
│  ├─ __RECETAS: Collection | None
│  └─ __FUENTE_DATOS: "json" | "mongodb"
│
├─ planifica()
│  ├─ recetas: list[dict]
│  ├─ ids_recientes: deque[str] (max=28)
│  └─ conteo_ventana: dict[str, int]
│     ├─ "verdura": 0..14
│     ├─ "lácteo": 0..3
│     ├─ ...
│     └─ "carne": 0..3
│
├─ __selecciona_plato_con_cuotas(recetas, ids_recientes, conteo, plato_k)
│  ├─ platos_restantes: int
│  ├─ urgentes: set[str]
│  ├─ bloqueados: set[str]
│  └─ candidatas: list[dict]
│     └─ score(receta): float
│
└─ Salida: planificacion
   ├─ generado_en: str (ISO)
   ├─ fuente_datos: str
   ├─ total_recetas_disponibles: int
   └─ dias: list
      ├─ dia: dict
      │  ├─ comida: dict (receta)
      │  └─ cena: dict (receta)
      └─ ... 7 días
```

---

## Checklist: Dónde Buscar Cada Cosa

- [ ] **¿Cómo se definen las cuotas?** → L. 23-31
- [ ] **¿Cómo se detecta urgencia?** → L. 173-177
- [ ] **¿Cómo se filtra por recencia?** → L. 186-193
- [ ] **¿Cómo se puntuación?** → L. 214-221
- [ ] **¿Cómo se elige un plato?** → L. 226
- [ ] **¿Cómo se genera la semana?** → L. 238-296
- [ ] **¿Cómo se actualiza el contador?** → L. 280-281
- [ ] **¿Cómo se cargan recetas?** → L. 92-117
- [ ] **¿Cómo se conecta a MongoDB?** → L. 76-90
- [ ] **¿Cómo se convierten tipos?** → L. 122-139
- [ ] **¿Cómo se valida suficiencia?** → L. 141-142
- [ ] **¿Cómo se obtiene el ID?** → L. 144-153
- [ ] **¿Cómo se extraen tags?** → L. 155-158

---

## Flujo de Ejecución (Paso a Paso)

```
Usuario llama: api.planifica()
    ↓
L. 244: __carga_recetas()
    ├─ L. 92: Lee MongoDB o JSON
    ├─ L. 117: Normaliza cada receta
    └─ Retorna: list[dict]
    ↓
L. 249: Validar ≥ 14 recetas
    └─ Si no → L. 250-251: Lanza excepción
    ↓
L. 256: ids_recientes = deque(maxlen=28)
L. 259: conteo_ventana = {verdura:0, ...}
    ↓
L. 263: for i in range(7):  [LOOP DÍAS]
    ├─ L. 268: for turno in ("comida", "cena"):  [LOOP COMIDAS]
    │  ├─ L. 269: plato = __selecciona_plato_con_cuotas(...)
    │  │  ├─ L. 162: Calcular platos_restantes
    │  │  ├─ L. 173-184: Clasificar urgentes/bloqueados
    │  │  ├─ L. 186-193: Filtrar por recencia
    │  │  ├─ L. 198-207: Filtrar por urgencias
    │  │  ├─ L. 214-221: Puntuación
    │  │  ├─ L. 226: Elegir aleatoriamente
    │  │  └─ Retorna: dict (receta)
    │  ├─ L. 276: ids_recientes.append(id)
    │  ├─ L. 280-281: conteo_ventana[tag] += 1
    │  └─ L. 283: dia[turno] = plato
    ├─ L. 290: planificacion["dias"].append(dia)
    ↓
L. 293: return planificacion  [JSON SERIALIZABLE]
```

