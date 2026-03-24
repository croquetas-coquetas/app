# Explicación del Algoritmo de Planificación Semanal - API_nueva.py

## 📋 Resumen General

El algoritmo genera una planificación semanal de menús que respeta:
- **Restricciones nutricionales**: Cada grupo de alimentos tiene un mínimo y máximo permitido por semana
- **Diversidad**: No repite el mismo plato en los últimos 14 días
- **Flexibilidad**: Se adapta a urgencias nutricionales sobre la marcha

---

## 🏗️ Estructura General de Clases y Variables

### Variable Global: `CUOTAS`

```python
CUOTAS: dict[str, dict[str, int]] = {
    "verdura":    {"min": 8, "max": 14},
    "lácteo":     {"min": 2, "max": 3},
    "cereal":     {"min": 3, "max": 5},
    "legumbre":   {"min": 2, "max": 3},
    "fruto seco": {"min": 1, "max": 2},
    "pescado":    {"min": 3, "max": 4},
    "huevo":      {"min": 2, "max": 3},
    "carne":      {"min": 2, "max": 3},
}
```

**Ubicación**: Línea 23 de `API_nueva.py`  
**Propósito**: Define cuántos platos de cada grupo nutricional deben aparecer en la semana (entre mínimo y máximo).

---

## 🔧 Constructor: `__init__`

**Ubicación**: Línea 36-65

```
Entrada:
  - connection_uri: URL de MongoDB (opcional)
  - db_name: Nombre de base de datos
  - collection_name: Nombre de colección
  - recipes_path: Ruta al archivo recetas.json
  - dias_totales: Número de días a planificar (defecto: 7)
  - comidas_por_dia: Número de comidas por día (defecto: 2)
  - rng: Generador aleatorio (para reproducibilidad)

Tareas:
  1. Carga variables de entorno (.env)
  2. Configura días, comidas y total de platos
  3. Intenta conectar a MongoDB si está configurado
  4. Si falla, usa archivo JSON como fallback
```

**Variables importantes que inicializa**:
- `__TOTAL_PLATOS`: 7 días × 2 comidas = 14 platos por semana
- `__FUENTE_DATOS`: "mongodb" o "json" según disponibilidad
- `__RNG`: Generador random para reproducibilidad

---

## 📂 Métodos de Carga y Normalización

### 1. `__carga_variables_entorno()` (Línea 67-74)
Busca archivo `.env` en dos ubicaciones y carga variables de entorno.

### 2. `__conectar_mongodb_si_esta_configurado()` (Línea 76-90)
Intenta conectar a MongoDB. Si falla, el sistema usa JSON.

### 3. `__carga_recetas()` (Línea 92-117)
Carga recetas desde MongoDB o desde `recetas.json`.  
**Validaciones**:
- ¿Existe la colección/archivo?
- ¿Contiene al menos un elemento?
- Normaliza cada receta

### 4. `__normaliza_receta()` (Línea 119-120)
Efectúa una copia profunda y convierte a formato JSON compatible.

### 5. `__to_json_compatible()` (Línea 122-139)
Convierte tipos no JSON (ObjectId, datetime, etc.) a strings.

---

## 🎯 Métodos de Lógica Principal

### 1. `__recetas_suficientes()` (Línea 141-142)
**Pregunta**: ¿Tenemos al menos 14 recetas únicas?  
```python
return total_recetas >= self.__DIAS_TOTALES * self.__COMIDAS_POR_DIA
```

**Ubicación**: Línea 141-142

### 2. `__identificador_receta()` (Línea 144-153)
Extrae un ID único para cada receta. Busca en este orden:
1. Campo `_id` (MongoDB)
2. Campo `id`
3. Campo `nombre`
4. Si no hay nada, usa JSON serializado de la receta completa

**Propósito**: Identificar si una receta ya fue usada recientemente.

### 3. `__tags_nutricionales()` (Línea 155-158)
Extrae los tags del campo "tags" que coincidan con los grupos de CUOTAS.

```python
# Ejemplo: Una receta con tags=["carne", "huevo", "fruto seco"]
# devuelve: ["carne", "huevo", "fruto seco"]
```

---

## 🧠 Corazón del Algoritmo: `__selecciona_plato_con_cuotas()`

**Ubicación**: Línea 160-236  
**Parámetros**:
- `recetas`: lista de todas las recetas disponibles
- `ids_recientes`: deque con los últimos 28 IDs usados
- `conteo_ventana`: dict con cuántos platos de cada grupo llevamos
- `plato_k`: número del plato que estamos eligiendo (1-14)

### Paso 1: Calcular Platos Restantes (Línea 162-166)
```python
platos_restantes = self.__TOTAL_PLATOS - plato_k + 1
```
Si estamos en plato 13 de 14, quedan 2 platos (incluyendo este).

### Paso 2: Clasificar Grupos Nutricionales (Línea 168-184)

Cada grupo se clasifica en uno de tres estados:

#### 🔴 **URGENTE**
Si falta un grupo y no hay suficientes platos restantes para alcanzar el mínimo.

```python
for grupo, cuota in CUOTAS.items():
    ya_tengo = conteo.get(grupo, 0)
    pendiente = cuota["min"] - ya_tengo
    
    if pendiente > 0 and pendiente >= platos_restantes:
        urgentes.add(grupo)  # ¡Debe elegirse ahora sí o sí!
```

**Ejemplo**: Si necesito 2 verduras más y solo quedan 2 platos → urgente.

#### 🔵 **BLOQUEADO**
Si ya alcanzamos el máximo de ese grupo.

```python
if ya_tengo >= cuota["max"]:
    bloqueados.add(grupo)  # No elegir más de este
```

#### ⚪ **LIBRE**
Ni urgente ni bloqueado.

### Paso 3: Filtrar Recetas por Recencia (Línea 186-193)
```python
disponibles = [
    r for r in recetas
    if self.__identificador_receta(r) not in ids_recientes
]
```
Excluye platos usados en los últimos 14 días.

### Paso 4: Aplicar Lógica de Filtrado (Línea 195-207)

**Si hay grupos URGENTES** → solo elige recetas que tengan al menos un tag urgente:
```python
if urgentes:
    candidatas = [
        r for r in disponibles
        if any(t in urgentes for t in self.__tags_nutricionales(r))
    ]
```

**Si NO hay urgencias** → excluye recetas cuyos tags estén TODOS bloqueados:
```python
else:
    candidatas = [
        r for r in disponibles
        if not self.__tags_nutricionales(r)
        or not all(t in bloqueados for t in self.__tags_nutricionales(r))
    ]
```

### Paso 5: Puntuación por "Deuda Nutricional" (Línea 209-220)

Si los filtros dejan pocas opciones, puntuamos cada receta:

```python
def score(r: dict[str, Any]) -> float:
    total = 0.0
    for tag in self.__tags_nutricionales(r):
        ya = conteo.get(tag, 0)
        pendiente = CUOTAS[tag]["min"] - ya
        if pendiente > 0:
            total += pendiente / CUOTAS[tag]["min"]
    return total
```

**Lógica**: Una receta con 3 tags puntúa mejor si sus grupos necesitan más platos.

### Paso 6: Seleccionar Aleatoriamente Entre las Mejores (Línea 222-226)
```python
max_score = max(score(r) for r in candidatas)
candidatas_top = [r for r in candidatas if score(r) >= max_score]
return deepcopy(self.__RNG.choice(candidatas_top))
```

Esto evita que siempre salga el mismo plato.

---

## 🎬 Método Principal: `planifica()`

**Ubicación**: Línea 228-296

### Estructura General:

```
1. Carga recetas
   ↓
2. Valida que hay suficientes
   ↓
3. Inicializa:
   - ids_recientes: deque que guarda los últimos 28 IDs
   - conteo_ventana: contador de platos por grupo (empieza en 0)
   ↓
4. Para cada día (0-6):
   - Para cada comida (comida, cena):
     a) Selecciona plato con cuotas
     b) Añade el ID al historial reciente
     c) Actualiza contador de grupos
     d) Guarda plato en la planificación
   ↓
5. Retorna JSON serializable con toda la semana
```

### Inicialización de Estructuras (Línea 254-259):

```python
ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)
# deque con máximo de 28 elementos (7 días × 2 comidas × 2)
# Cuando se llena, el más antiguo se elimina automáticamente

conteo_ventana: dict[str, int] = {g: 0 for g in CUOTAS}
# Contador: {"verdura": 0, "lácteo": 0, ..., "carne": 0}
```

### Loop Principal (Línea 263-288):

```python
plato_k = 1  # Número de plato (1-14)

for i in range(self.__DIAS_TOTALES):  # 0-6
    dia: dict[str, Any] = {...}
    
    for turno in ("comida", "cena"):
        plato = self.__selecciona_plato_con_cuotas(...)
        
        # Guardar ID reciente
        ids_recientes.append(self.__identificador_receta(plato))
        
        # Actualizar contador
        for tag in self.__tags_nutricionales(plato):
            conteo_ventana[tag] += 1
        
        dia[turno] = plato
        plato_k += 1
```

### Salida (Línea 257-262 y 290-296):

```json
{
  "generado_en": "2024-03-23T15:30:00+00:00",
  "fuente_datos": "json",
  "total_recetas_disponibles": 45,
  "dias": [
    {
      "dia": "2024-03-23T00:00:00+00:00",
      "comida": { "nombre": "Pollo en pepitoria", "tags": [...], ... },
      "cena": { "nombre": "Gazpacho andaluz", "tags": [...], ... }
    },
    ...
  ]
}
```

---

## 📊 Flujo de Decisión Visual

```
┌─────────────────────────────────────┐
│ Cargar Recetas (MongoDB o JSON)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ ¿Hay ≥14 recetas únicas?            │
│ No → Lanzar InsufficientRecipesError│
└──────────────┬──────────────────────┘
               │ Sí
               ▼
┌─────────────────────────────────────┐
│ Para cada plato (1-14):             │
│  1. Clasificar grupos (urgente,     │
│     bloqueado, libre)               │
│  2. Filtrar por recencia (¿usado?)  │
│  3. Filtrar por urgencias           │
│  4. Puntuación por "deuda"          │
│  5. Elegir aleatoriamente entre top │
└─────────────────────────────────────┘
```

---

## 🔑 Conceptos Clave

| Concepto | Definición | Ubicación |
|----------|-----------|-----------|
| **CUOTAS** | Límites nutricionales por grupo (min-max) | L. 23 |
| **Urgencia** | Grupo que si no se elige ahora, no llegará al mínimo | L. 177 |
| **Bloqueo** | Grupo que já alcanzó el máximo | L. 183 |
| **Recencia** | Historial de 14 días para evitar repeticiones | L. 192 |
| **Deuda Nutricional** | Cuánto falta aún de cada grupo | L. 215-217 |
| **IDs Recientes** | Deque de max 28 elementos (14 días × 2 comidas) | L. 256 |
| **Conteo Ventana** | Estado actual de cuotas en la semana | L. 259 |

---

## ⚠️ Casos Extremos

### ¿Qué pasa si no hay suficientes recetas?
```python
# Línea 249-251
raise InsufficientRecipesError(
    "No hay suficientes recetas para planificar el menú semanal."
)
```

### ¿Qué pasa si todos están "bloqueados por recencia"?
```python
# Línea 195-199
if not disponibles:
    disponibles = list(recetas)  # Usa todas (mejor repetir que fallar)
```

### ¿Qué pasa si todos tienen tags bloqueados?
```python
# Línea 204-207
if not candidatas:
    candidatas = disponibles  # Relaja restricción
```

---

## 🚀 Cómo Usar

```python
# Uso simple
api = API_planificacion()
planificacion = api.planifica()

# Parámetros personalizados
api = API_planificacion(
    dias_totales=7,
    comidas_por_dia=3,  # ← Cambiar a 3 comidas
    recipes_path="recetas.json"
)
planificacion = api.planifica()
```

---

## 📝 Clase de Excepción

```python
# Jerarquía de errores (Línea 13-18)
PlanningError (RuntimeError)
    └── InsufficientRecipesError
```

