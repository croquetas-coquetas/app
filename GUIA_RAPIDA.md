# 📖 Guía Rápida de Referencia - API_nueva.py

## 📍 Mapa de Métodos por Línea

```
CLASE: API_planificacion

Inicialización y Carga:
├─ __init__()                             Línea 36-65   → Configura todo
├─ __carga_variables_entorno()            Línea 67-74   → Lee .env
├─ __conectar_mongodb_si_esta_configurado() Línea 76-90 → Conecta BD
├─ __carga_recetas()                      Línea 92-117  → Lee recetas
├─ __normaliza_receta()                   Línea 119-120 → Copia profunda
└─ __to_json_compatible()                 Línea 122-139 → Convierte tipos

Utilidades:
├─ __recetas_suficientes()                Línea 141-142 → ¿≥14 recetas?
├─ __identificador_receta()               Línea 144-153 → Extrae ID único
└─ __tags_nutricionales()                 Línea 155-158 → Extrae tags

Algoritmo Principal:
├─ __selecciona_plato_con_cuotas()        Línea 160-236 → ⭐ CORAZÓN DEL ALGO
└─ planifica()                            Línea 238-296 → ⭐ PUNTO DE ENTRADA

Excepciones:
├─ PlanningError                          Línea 14      → Error genérico
└─ InsufficientRecipesError               Línea 17      → No hay recetas
```

---

## 🔍 Cómo Leer el Código

### Si quiero entender cómo se elige un plato...
**Ir a**: `__selecciona_plato_con_cuotas()` (Línea 160)

### Si quiero entender cómo se aseguran las cuotas semanales...
**Entender**: 
1. CUOTAS global (Línea 23)
2. `conteo_ventana` en `planifica()` (Línea 259)
3. Actualización en loop (Línea 280-281)

### Si quiero entender la recencia (14 días sin repetir)...
**Ir a**:
1. `ids_recientes = deque()` (Línea 256)
2. Filtrado en `__selecciona_plato_con_cuotas()` (Línea 192-199)
3. Actualización (Línea 276)

### Si quiero entender la puntuación...
**Ir a**: Función `score()` dentro de `__selecciona_plato_con_cuotas()` (Línea 214-221)

---

## 📊 Variables Clave y su Significado

| Variable | Tipo | Alcance | Propósito |
|----------|------|---------|-----------|
| `CUOTAS` | dict | Global | Define límites nutricionales |
| `__TOTAL_PLATOS` | int | Instancia | 7 días × 2 comidas = 14 |
| `__RNG` | Random | Instancia | Generador para reproducibilidad |
| `ids_recientes` | deque | Local (planifica) | Últimos 28 IDs (14 días × 2) |
| `conteo_ventana` | dict | Local (planifica) | Contador actual de grupos |
| `candidatas` | list | Local (selecciona) | Recetas que pasan filtros |
| `urgentes` | set | Local (selecciona) | Grupos "sin opciones" |
| `bloqueados` | set | Local (selecciona) | Grupos que llegaron al max |

---

## 🎯 Lógica de Clasificación

### Paso 1: ¿Es este grupo URGENTE?
```python
pendiente = CUOTAS[grupo]["min"] - ya_tengo
if pendiente > 0 and pendiente >= platos_restantes:
    urgentes.add(grupo)  # ¡Debe elegirse ahora!
```

**Ejemplo**: Si faltan 2 verduras y quedan 2 platos → URGENTE

### Paso 2: ¿Llegó al MÁXIMO?
```python
if ya_tengo >= CUOTAS[grupo]["max"]:
    bloqueados.add(grupo)  # Stop, no más de este
```

**Ejemplo**: Si ya hay 3 carnes y max es 3 → BLOQUEADO

### Paso 3: Filtrado según estados

**CON urgentes:**
```python
# Solo recetas que tengan algún tag urgente
if any(t in urgentes for t in tags_receta):
    → Válida
else:
    → Descartada
```

**SIN urgentes:**
```python
# Descarta recetas cuyo TODOS los tags están bloqueados
if all(t in bloqueados for t in tags_receta):
    → Descartada
else:
    → Válida
```

---

## 🧮 Fórmula de Puntuación

```python
score = Σ(pendiente_grupo_i / min_grupo_i) 
        para cada tag en la receta
        solo si pendiente > 0
```

**Significa**: Una receta puntúa más si sus grupos necesitan más platos.

**Ejemplo**:
- Grupo A: necesito 2/8 (2/8 = 0.25)
- Grupo B: necesito 1/2 (1/2 = 0.50)
- Score = 0.25 + 0.50 = 0.75

---

## 🔄 Flujo de Datos en planifica()

```
Recetas (JSON/MongoDB)
         ↓
Línea 244: __carga_recetas()
         ↓
Línea 249: Validar ≥14
         ↓
Línea 256: ids_recientes = {} (vacío)
Línea 259: conteo_ventana = {verdura:0, lácteo:0, ...}
         ↓
Línea 263-288: LOOP (para cada plato)
    Línea 269: __selecciona_plato_con_cuotas()
              ↓
              (ve Línea 160-236 para detalles)
              ↓ RETORNA UN PLATO
    Línea 275: ids_recientes.append(ID)
    Línea 279-281: conteo_ventana[tag] += 1
    Línea 283: dia[turno] = plato
         ↓
Línea 290: planificacion["dias"].append(dia)
         ↓
Línea 293: RETORNA JSON
```

---

## 💡 Ejemplo Paso a Paso

**Planificando plato k=1 (primer almuerzo del lunes)**

```
1. Platos restantes = 14 - 1 + 1 = 14

2. Clasificar grupos:
   - Verdura: 0/8 vs 14 platos      → LIBRE (0 pendiente)
   - Pescado: 0/3 vs 14 platos      → LIBRE
   - Carne: 0/2 vs 14 platos        → LIBRE
   - ...todos están LIBRES (primer plato)
   
3. No hay urgentes ni bloqueados

4. ids_recientes está vacío → todas son válidas

5. Puntuación todas:
   - "Pollo en pepitoria" (carne, huevo, fruto seco) 
     = 0 + 0 + 0 = 0
   - "Marmitako de bonito" (pescado, verdura)
     = 0 + 0 = 0
   - ...todas puntúan 0 (todo está en mínimo 0)

6. Todas las recetas con score=0 están en TOP

7. ELEGIR ALEATORIAMENTE entre todas
   → Ejemplo: "Pollo en pepitoria"

8. Guardar:
   - ids_recientes = ["Pollo en pepitoria"]
   - conteo: carne=1, huevo=1, fruto seco=1
   - Salvar en plato 1
```

**Planificando plato k=8 (primer almuerzo del jueves)**

```
1. Platos restantes = 14 - 8 + 1 = 7

2. Clasificar grupos (asumiendo conteos):
   - Verdura: 5/8-14        → LIBRE (5 pendiente, 5 < 7)
   - Pescado: 2/3-4         → LIBRE (1 pendiente, 1 < 7)
   - Lácteo: 2/2-3          → BLOQUEADO (2 ≥ 2 max)
   - Carne: 1/2-3           → LIBRE (1 pendiente, 1 < 7)
   
   → No hay URGENTES (ninguno pendiente ≥ 7)
   → Grupo BLOQUEADO: lácteo

3. ids_recientes tiene 14 IDs (últimas 2 semanas)
   → Excluir esos platos

4. Filtrado (sin urgentes):
   - Excluir recetas cuyo TODOS tags estén bloqueados
   - "Frittata" (huevo, verdura, LÁCTEO) 
     → Solo 1 tag bloqueado → VÁLIDA
   - "Croquetas" (carne, LÁCTEO, cereal)
     → Solo 1 tag bloqueado → VÁLIDA
   - "Yogur puro" (LÁCTEO)
     → TODOS sus tags bloqueados → DESCARTADA

5. Puntuación (entre candidatas):
   - "Pollo curry" (carne, verdura)
     = 1/2 + 5/8 = 0.50 + 0.625 = 1.125
   - "Gazpacho" (verdura, cereal)
     = 5/8 + 3/5 = 0.625 + 0.6 = 1.225
   - "Croquetas" (carne, cereal, lácteo)
     = 1/2 + 3/5 + 0 = 0.50 + 0.6 = 1.1
     (lácteo=0 porque está en max)
   
   → MAX SCORE = 1.225 → "Gazpacho"

6. ELEGIR "Gazpacho"

7. Guardar:
   - ids_recientes.popleft() & append("Gazpacho")
   - conteo: verdura+=1, cereal+=1
   - Salvar en plato 8
```

---

## 🚨 Errores Comunes

### Error: "No hay suficientes recetas"
**Causa**: Menos de 14 recetas en total  
**Solución**: Añadir más recetas a recetas.json

### MongoDB conecta pero no hay datos
**Causa**: Colección vacía  
**Línea**: 106-110  
**Fallback**: Usa JSON automáticamente

### Mismo plato aparece 2 veces en la semana
**Causa**: No debería pasar, pero si los urgentes fuerzan...  
**Línea**: 192-199 relaja recencia si faltan opciones

### Cuotas no se respetan
**Causa**: Probablemente no hay recetas con los tags necesarios  
**Solución**: Revisar que los tags en recetas.json coincidan con CUOTAS

---

## 🔧 Cómo Personalizar

### Cambiar días de semana
```python
api = API_planificacion(dias_totales=14)  # 2 semanas
```

### Cambiar a 3 comidas por día
```python
api = API_planificacion(comidas_por_dia=3)  # 21 platos
# Requiere al menos 21 recetas
```

### Cambiar cuotas nutricionales
**Ir a**: Línea 23, modificar CUOTAS global  
⚠️ Requiere restart del programa

### Usar MongoDB en lugar de JSON
```python
api = API_planificacion(
    connection_uri="mongodb://usuario:pass@host:27017"
)
```

### Hacer reproducible (mismo resultado cada vez)
```python
import random
rng = random.Random(42)  # Semilla fija
api = API_planificacion(rng=rng)
```

