# Algoritmo de Planificación Semanal de Menús - SmartCook

## 📋 Índice de Contenidos

1. [Visión General](#visión-general)
2. [Conceptos Fundamentales](#conceptos-fundamentales)
3. [Cuotas Nutricionales](#cuotas-nutricionales)
4. [Flujo Principal del Algoritmo](#flujo-principal-del-algoritmo)
5. [Clasificación de Grupos Nutricionales](#clasificación-de-grupos-nutricionales)
6. [Sistema de Filtrado de Recetas](#sistema-de-filtrado-de-recetas)
7. [Sistema de Scoring](#sistema-de-scoring)
8. [Ejemplo Paso a Paso](#ejemplo-paso-a-paso)
9. [Validaciones y Manejo de Errores](#validaciones-y-manejo-de-errores)

---

## Visión General

El algoritmo de planificación semanal de SmartCook genera automáticamente menús de 7 días (14 comidas: desayuno y comida/cena) asegurando que se cumplan restricciones nutricionales complejas:

- ✅ **Cuotas balanceadas**: Los grupos nutricionales (verdura, lácteos, proteínas, etc.) se distribuyen dentro de rangos mínimo-máximo.
- ✅ **Variedad**: No repite recetas en los últimos 14 días.
- ✅ **Continuidad**: Puede generar a partir de semanas previas, manteniendo transiciones suaves.
- ✅ **Inteligencia adaptativa**: Usa un sistema de puntuación sofisticado que prioriza cobertura de mínimos sobre riesgo de máximos.

### Archivos Clave

```
API_planificacion.py    ← Clase principal con el algoritmo
smartCook.recetas.json  ← Base de datos de recetas con tags nutricionales
```

---

## Conceptos Fundamentales

### 1. Tags Nutricionales

Cada receta tiene un campo `tags` que especifica sus propiedades nutricionales. El algoritmo solo reconoce estos 8 tags:

- `verdura` - Frutas y verduras
- `lácteo` - Productos lácteos
- `cereal` - Granos y arroces
- `legumbre` - Legumbres y garbanzos
- `fruto seco` - Frutos secos
- `pescado` - Pescado y mariscos
- `huevo` - Huevos
- `carne` - Carnes rojas y de ave

### 2. Receta

Estructura básica en el JSON:

```json
{
  "_id": "69b147433c726bcbda04d474",
  "nombre": "Paella valenciana",
  "tags": ["carne", "cereal", "verdura"],
  "grupo_principal": "carne",
  "ingredientes": [...],
  "pasos": [...]
}
```

### 3. Ventana Deslizante (Sliding Window)

Para mantener el conteo de tags actualizados sin recalcular desde cero:

- Se mantiene un registro de los **últimos 7 días** (14 comidas).
- Al agregar un nuevo día, el más antiguo se expulsa automáticamente.
- Los tags se restan del conteo cuando un día sale de la ventana.

```
[Día 1] [Día 2] [Día 3] [Día 4] [Día 5] [Día 6] [Día 7]
                                               ↑ Ventana actual (maxlen=7)

Al agregar Día 8:
                    [Día 2] [Día 3] [Día 4] [Día 5] [Día 6] [Día 7] [Día 8]
                    ↑ Día 1 se expulsa, sus tags se restan del conteo
```

---

## Cuotas Nutricionales

Las cuotas definen el rango aceptable de cada grupo nutricional **en la ventana actual de 7 días (14 comidas)**:

```python
CUOTAS = {
    "verdura":    {"min": 7, "max": 14},   # Entre 7 y 14 veces en la semana
    "lácteo":     {"min": 2, "max": 5},    # Entre 2 y 5 veces
    "cereal":     {"min": 3, "max": 7},    # Entre 3 y 7 veces
    "legumbre":   {"min": 1, "max": 4},    # Entre 1 y 4 veces
    "fruto seco": {"min": 0, "max": 3},    # Hasta 3 veces (sin mínimo)
    "pescado":    {"min": 2, "max": 5},    # Entre 2 y 5 veces
    "huevo":      {"min": 1, "max": 4},    # Entre 1 y 4 veces
    "carne":      {"min": 2, "max": 6},    # Entre 2 y 6 veces
}
```

### Interpretación

Tomemos **"verdura"** como ejemplo:
- **Min = 7**: Al menos 7 de las 14 comidas deben incluir verdura.
- **Max = 14**: Como máximo 14 comidas pueden incluir verdura (es decir, todas pueden tenerla).
- **Rango ideal**: 7-14 comidas con verdura en la semana.

---

## Flujo Principal del Algoritmo

### Entrada: Método `planifica(dias_previos=None)`

```python
def planifica(self, dias_previos: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """
    dias_previos: (opcional) Lista de días anteriores con estructura:
    [
        {
            "dia": "2026-03-21T...",
            "comida": {...receta...},
            "cena": {...receta...}
        },
        ...
    ]
    """
```

### Salida

```json
{
    "generado_en": "2026-03-28T15:30:45.123456+00:00",
    "fuente_datos": "json",
    "total_recetas_disponibles": 150,
    "dias": [
        {
            "dia": "2026-03-28T00:00:00+00:00",
            "comida": {...},
            "cena": {...}
        },
        ...
    ]
}
```

### Pasos de Ejecución

```
┌─────────────────────────────────────────┐
│ 1. Cargar recetas (JSON o MongoDB)      │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│ 2. Validar suficientes recetas (≥ 14)    │
└───────────────┬──────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│ 3. Inicializar estructuras de datos:     │
│    • ids_recientes (deque, maxlen=28)    │
│    • conteo_ventana (dict de tags)       │
│    • ventana_dias (deque, maxlen=7)      │
└───────────────┬──────────────────────────┘
                │
       Si hay dias_previos:
┌───────────────▼──────────────────────────┐
│ 4. Cargar histórico:                     │
│    • Agregar IDs de recetas previas      │
│    • Contar tags del último período      │
└───────────────┬──────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│ 5. Para cada día (i=0 a 6):              │
│    ├─ Si ventana completa,               │
│    │  restar tags del día expulsado      │
│    │                                     │
│    ├─ Para comida y cena:                │
│    │  ├─ Seleccionar plato óptimo        │
│    │  ├─ Sumar tags al conteo            │
│    │  └─ Guardar en día                  │
│    │                                     │
│    └─ Agregar día a ventana y resultado  │
└───────────────┬──────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│ 6. Retornar planificación con:           │
│    • Últimos 14 días máximo (si previos) │
│    • Nuevos 7 días generados             │
└──────────────────────────────────────────┘
```

---

## Clasificación de Grupos Nutricionales

Cuando se va a seleccionar una receta, cada grupo nutricional se clasifica en uno de **cuatro estados**:

### ⏰ URGENTE

**Condición**: `pendiente_min > 0 AND pendiente_min >= platos_restantes`

Significa: Faltan platos mínimos de este grupo Y los platos que quedan por elegir son insuficientes para cubrirlo después.

**Ejemplo**:
- Cuota de lácteo: min=2, max=5
- Conteo actual: 0 lácteos
- Plato actual: 13 de 14
- Platos restantes: 2 (el actual + último)
- Pendiente mínimo: 2 - 0 = 2
- ¿Es urgente? 2 > 0 ✓ AND 2 >= 2 ✓ → **SÍ, URGENTE**

**Consecuencia**: Solo aceptamos recetas que contengan al menos un tag urgente.

---

### 🚫 BLOQUEADO

**Condición**: `ya_tengo >= cuota["max"]`

Significa: Ya hemos alcanzado el máximo de este grupo. No podemos agregar más.

**Ejemplo**:
- Cuota de carne: min=2, max=6
- Conteo actual: 6 carnes
- ¿Es bloqueado? 6 >= 6 → **SÍ, BLOQUEADO**

**Consecuencia**: Rechazamos cualquier receta que contenga este tag.

---

### ⚠️ CRÍTICO

**Condición**: `ya_tengo > 0.7 * cuota["max"]`

Significa: Estamos cerca del máximo (superamos el 70%). Riesgo elevado.

**Ejemplo**:
- Cuota de cereal: min=3, max=7
- Conteo actual: 5 cereales
- Límite crítico: 0.7 × 7 = 4.9
- ¿Es crítico? 5 > 4.9 → **SÍ, CRÍTICO**

**Consecuencia**: Aplicamos una penalización fuerte en el scoring (ver Sistema de Scoring).

---

### ✅ LIBRE

Todos los demás grupos. Sin restricciones especiales de urgencia o riesgo.

---

## Sistema de Filtrado de Recetas

El algoritmo pasa por tres fases de filtrado, cada una más permisiva que la anterior:

### Fase 1️⃣: Filtrar por Recencia

Eliminamos recetas que aparecieron en los **últimos 14 días** (28 comidas máx):

```python
disponibles = [
    r for r in recetas
    if r._id not in ids_recientes
]
```

**Por qué 14 días**: Para mantener suficiente variedad y evitar repeticiones rápidas.

**Fallback**: Si todas las recetas están "recientes", permitimos repetir.

---

### Fase 2️⃣: Filtrar por Grupos Urgentes/Bloqueados

#### 2A. Si hay grupos urgentes:

Solo pasamos recetas que tienen **al menos un tag urgente**:

```python
if urgentes:
    candidatas = [
        r for r in disponibles
        if any(tag in urgentes for tag in r.tags)
    ]
```

**Ejemplo**:
- Grupos urgentes: {lácteo, verdura}
- Receta "Yogur con fruta": tags=[lácteo, verdura] → ✓ Pasa
- Receta "Filete de ternera": tags=[carne] → ✗ Rechazada

#### 2B. Si NO hay grupos urgentes:

Rechazamos recetas con tags bloqueados:

```python
candidatas = [
    r for r in disponibles
    if not any(tag in bloqueados for tag in r.tags)
]
```

**Ejemplo**:
- Grupos bloqueados: {carne}
- Receta "Ensalada verde": tags=[verdura, cereal] → ✓ Pasa
- Receta "Carne con champiñones": tags=[carne, lácteo] → ✗ Rechazada

---

### Fase 3️⃣: Filtrado Adaptativo

Si el filtrado anterior deja pocas opciones (< 1/3 del total), permitimos críticos:

```python
if len(candidatas) < len(disponibles) / 3:
    # Permitimos recetas sin tags o con tags que no son todos bloqueados
    candidatas = [
        r for r in disponibles
        if not r.tags or not all(tag in bloqueados for tag in r.tags)
    ]
```

**Propósito**: Evitar quedarse sin opciones mientras mantenemos restricciones razonables.

---

### Fase 4️⃣: Fallback Final

Si aún no tenemos candidatas, permitimos cualquier receta disponible:

```python
if not candidatas:
    candidatas = disponibles  # O todas las recetas si disponibles está vacío
```

---

## Sistema de Scoring

Cada receta candidata recibe una **puntuación** basada en:

$$\text{Score} = \text{Bonus\_Mínimos} - \text{Penalidad\_Máximos}$$

### Bonus por Cobertura de Mínimos

Para cada tag en la receta que **aún no ha alcanzado su mínimo**:

$$\text{Bonus} = \sum_{i \in \text{tags}} \frac{\text{pendiente\_min}_i}{\text{cuota\_min}_i}$$

Si `pendiente_min ≤ 0`, el tag no aporta bonus (ya cubrimos su mínimo).

**Ejemplo**:
```
Receta: Lentejas guisadas (tags: [legumbre, verdura])

Legumbre:
  - Cuota min: 1, ya_tengo: 0 → pendiente_min = 1
  - Bonus: 1/1 = 1.0

Verdura:
  - Cuota min: 7, ya_tengo: 6 → pendiente_min = 1
  - Bonus: 1/7 ≈ 0.143

Total Bonus = 1.0 + 0.143 = 1.143
```

---

### Penalidad por Riesgo de Máximos

Para cada tag en la receta:

**Caso 1 - En máximo** (`ya\_tengo >= cuota["max"]`):
- Penalidad += 10.0 (muy restrictiva)

**Caso 2 - En zona crítica** (`ya\_tengo > 0.7 * cuota["max"]`):
- Riesgo = (ya\_tengo - 0.7 × max) / (0.3 × max)
- Penalidad += 5.0 × riesgo

**Caso 3 - Seguro** (por debajo del 70%):
- Penalidad += 0

**Ejemplo**:
```
Receta: Pechuga de pollo (tags: [carne, cereal])

Carne:
  - Cuota max: 6, ya_tengo: 5
  - 5 > 0.7 × 6 = 4.2 → Crítico
  - Riesgo: (5 - 4.2) / (0.3 × 6) = 0.8 / 1.8 ≈ 0.444
  - Penalidad: 5.0 × 0.444 ≈ 2.22

Cereal:
  - Cuota max: 7, ya_tengo: 4
  - 4 ≤ 4.9 → Seguro
  - Penalidad: 0

Total Penalidad ≈ 2.22
```

---

### Puntuación Final

$$\text{Score} = 1.143 - 2.22 = -1.077$$

Una puntuación negativa indica que **los riesgos de exceder máximos superan los beneficios de cobertura de mínimos**.

---

### Selección del Ganador

1. Se calcula el score de todas las candidatas.
2. Se identifica el score máximo.
3. **Se selecciona aleatoriamente entre todas las recetas con score máximo**.

```python
max_score = max(score(r) for r in candidatas)
candidatas_top = [r for r in candidatas if score(r) >= max_score]
return random.choice(candidatas_top)
```

**Por qué aleatorio**: Evita que salga siempre la misma receta de forma determinista.

---

## Ejemplo Paso a Paso

### Escenario

Generamos el plato **12 de 14** (día 6, cena). Suponemos este estado previo:

**Conteo actual de tags** (últimos 7 días):
```
verdura:    7/14 (min=7, max=14)   ← Cumplió mínimo, amplio margen
lácteo:     4/5  (min=2, max=5)    ← Cercano al máximo
cereal:     6/7  (min=3, max=7)    ← En zona crítica
legumbre:   2/4  (min=1, max=4)    ← Seguro
fruto seco: 1/3  (min=0, max=3)    ← Seguro
pescado:    3/5  (min=2, max=5)    ← Normal
huevo:      0/4  (min=1, max=4)    ← Falta alcanzar mínimo
carne:      4/6  (min=2, max=6)    ← Normal
```

**Platos restantes**: 14 - 12 + 1 = 3 (actual + 2 más)

---

### Paso 1: Clasificar Grupos

```python
urgentes = set()
bloqueados = {lácteo}       # 4 >= 5? No. Pero 4 > 0.7*5 = 3.5? Sí → Crítico
criticos = {cereal, lácteo}

# Verificar urgencia de huevo:
pendiente_min_huevo = 1 - 0 = 1
platos_restantes = 3
¿1 >= 3? No → No urgente

# Espera, verifiquemos todos:
for grupo, cuota in CUOTAS:
    pendiente_min = cuota["min"] - conteo[grupo]
    if pendiente_min >= 3:
        urgentes.add(grupo)

# E huevo: 1 - 0 = 1. ¿1 >= 3? No
# Legumbre: 1 - 2 = -1. ¿-1 >= 3? No
# Fruto seco: 0 - 1 = -1. ¿-1 >= 3? No
# Pescado: 2 - 3 = -1. ¿-1 >= 3? No
# Carne: 2 - 4 = -2. ¿-2 >= 3? No

urgentes = {}  # Ninguno urgente
```

---

### Paso 2: Recetas Disponibles y Candidatas

Suponemos estas recetas sin recencia negativa:

| Receta | Tags | Razón |
|--------|------|-------|
| Paella valenciana | [carne, cereal, verdura] | ✗ cereal bloqueado (crítico) |
| Ensalada | [verdura] | ✓ Sin tags bloqueados |
| Merluza en salsa verde | [pescado, cereal, verdura] | ✗ cereal bloqueado |
| Tortilla española | [huevo] | ✓ Sin tags bloqueados |
| Queso fresco | [lácteo] | ✗ lácteo bloqueado |
| Lentejas | [legumbre, verdura] | ✓ Sin tags bloqueados |

**Fase 2B**: Rechazar bloqueados → candidatas = [Ensalada, Tortilla, Lentejas]

---

### Paso 3: Scoring

#### Receta: Tortilla Española
```
Tags: [huevo]

Bonus mínimos:
  huevo: pendiente_min = 1 - 0 = 1
         bonus = 1 / 1 = 1.0
  Total bonus = 1.0

Penalidad máximos:
  huevo: ya_tengo = 0 < 0.7 * 4 = 2.8 → Seguro
         penalidad = 0
  Total penalidad = 0

Score = 1.0 - 0 = 1.0 ← MUY BUENA, cubre mínimo de huevo
```

#### Receta: Ensalada
```
Tags: [verdura]

Bonus mínimos:
  verdura: pendiente_min = 7 - 7 = 0 → Ya cubrió mínimo
           bonus = 0
  Total bonus = 0

Penalidad máximos:
  verdura: ya_tengo = 7 < 0.7 * 14 = 9.8 → Seguro
           penalidad = 0
  Total penalidad = 0

Score = 0 - 0 = 0.0 ← Neutra, ni suma ni resta
```

#### Receta: Lentejas
```
Tags: [legumbre, verdura]

Bonus mínimos:
  legumbre: pendiente_min = 1 - 2 = -1 → Ya pasó mínimo
            bonus = 0
  verdura: pendiente_min = 7 - 7 = 0
           bonus = 0
  Total bonus = 0

Penalidad máximos:
  legumbre: ya_tengo = 2 < 0.7 * 4 = 2.8 → Seguro
            penalidad = 0
  verdura: ya_tengo = 7 < 9.8 → Seguro
           penalidad = 0
  Total penalidad = 0

Score = 0 - 0 = 0.0 ← Neutra
```

---

### Paso 4: Seleccción

```
Scores: [Tortilla: 1.0, Ensalada: 0.0, Lentejas: 0.0]
Max score: 1.0
Candidatas top: [Tortilla]

Selección: Tortilla española ✓
```

**Resultado**: Se selecciona **Tortilla española** porque es la única que cubre un mínimo pendiente (huevo).

---

### Paso 5: Actualizar Conteo

```
Receta seleccionada: Tortilla española con tags=[huevo]

Nuevo conteo:
  huevo: 0 → 1
  (otros sin cambio)
```

Conteo actualizado (plato 13):
```
verdura:    7/14
lácteo:     4/5   ← Sigue en crítico
cereal:     6/7   ← Sigue en crítico
legumbre:   2/4
fruto seco: 1/3
pescado:    3/5
huevo:      1/4   ← Avanzó hacia mínimo
carne:      4/6
```

---

## Validaciones y Manejo de Errores

### 1. Recetas Insuficientes

```python
if total_recetas < dias_totales * comidas_por_dia:
    raise InsufficientRecipesError(
        "No hay suficientes recetas para planificar el menú semanal."
    )
```

**Por qué**: Necesitamos al menos una receta distinta para cada comida sin repetir.

---

### 2. MongoDB Connection Failed

```python
def __conectar_mongodb_si_esta_configurado(self):
    if not self.__CONEXION:
        return  # Sin configuración, usa JSON
    
    try:
        client = MongoClient(...)
        client.admin.command("ping")
        self.__RECETAS = client[...][...]
        self.__FUENTE_DATOS = "mongodb"
    except (PyMongoError, ValueError):
        # Fallback a JSON
        self.__FUENTE_DATOS = "json"
```

**Comportamiento**: Si MongoDB falla, automáticamente retorna a la fuente JSON.

---

### 3. Verificación de Estructura de Recetas

```python
def __normaliza_receta(self, receta):
    # Convierte ObjectId de MongoDB a string, fechas a ISO format, etc.
    return self.__to_json_compatible(receta)
```

Asegura que la salida sea siempre serializable a JSON.

---

## Resumen de Flujo: De 14 Días a 7 Días

### Entrada: 14 días previos
```
Día anterior 1 → Comida, Cena → Tags sumados al conteo inicial
...
Día anterior 7 → Comida, Cena → Tags en ventana inicial
IDs en deque de recencia
```

### Generación: 7 días nuevos
```
Para cada día (0-6):
  Si ventana completa:
    Restar tags del día que sale

  Para comida:
    Seleccionar → Sumar tags
  Para cena:
    Seleccionar → Sumar tags

  Agregar día a ventana
```

### Salida: 14 días (últimos 7 previos + nuevos 7)
```
Días anteriores 2-7 (se descarta "Día anterior 1")
Día anterior 2 → Comida, Cena
...
Día anterior 7 → Comida, Cena
Día nuevo 1 → Comida, Cena
...
Día nuevo 7 → Comida, Cena
```

---

## Casos de Uso

### 🔄 Primera Generación (sin `dias_previos`)

```python
api = API_planificacion()
result = api.planifica()  # Sin histórico
```

**Resultado**: 7 días nuevos, conteos iniciados en 0.

---

### 📅 Regeneración Semanal (con `dias_previos`)

```python
api = API_planificacion()
prev_week = {resultado de semana anterior}["dias"]

result = api.planifica(dias_previos=prev_week)
```

**Resultado**: Últimos 7 de previos + 7 nuevos = 14 días. Transición suave.

---

### 🎯 Configuración Personalizada

```python
api = API_planificacion(
    dias_totales=7,           # Semana estándar
    comidas_por_dia=3,        # Tres comidas (desayuno, comida, cena)
    recipes_path="otro.json"  # Base de datos alternativa
)

result = api.planifica()
# Genera 21 comidas en 7 días con cuotas adaptadas a 21 comidas
```

---

## Preguntas Frecuentes

### ❓ ¿Qué pasa si no hay recetas que cumplan los requisitos?

El algoritmo es **permisivo**: Si todas las candidatas están "recientes", las permitirá igualmente. Si todos los tags están bloqueados, usará la mejor disponible. Garantiza completar los 7 días.

### ❓ ¿Por qué la verdura tiene min=7 y max=14?

Porque una verdura puede estar en **casi todas las comidas** (ensalada, acompañamiento, etc.). El rango amplio permite máxima flexibilidad mientras se asegura mínimo nutricional.

### ❓ ¿Puedo cambiar las cuotas?

Sí, modificando el diccionario `CUOTAS` al inicio del archivo `API_planificacion.py`. Pero nota que el algoritmo está calibrado para estos valores.

### ❓ ¿Qué ocurre si una receta no tiene tags?

Se trata como una receta "neutra":
- No contribuye bonus ni penalidad en scoring.
- La aceptan cualquier filtro (excepto si es urgencia total).
- Úsala como comodín para llenar huecos.

---

## Conclusión

El algoritmo equilibra **restricciones nutricionales complejas** con **variedad garantizada** mediante:

1. **Clasificación dinámica** de grupos (urgente, bloqueado, crítico, libre).
2. **Filtrado progresivo** que se adapta si pierde candidatas.
3. **Scoring sofisticado** que prioriza cubrir mínimos sin exceder máximos.
4. **Ventana deslizante** que mantiene eficiencia O(1) en conteos.
5. **Aleatoriedad controlada** para variedad sin perder determinismo validable.

Resultado: **Menús balanceados, diversos y predecibles** semana tras semana.
