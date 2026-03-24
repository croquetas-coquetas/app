# 📥📤 Ejemplos de Entrada y Salida

## 📥 Estructura de Entrada: Receta

Las recetas deben tener obligatoriamente:
- `tags`: Lista de grupos nutricionales (deben estar en CUOTAS)
- El resto de campos es flexible

### Ejemplo Completo: Pollo en Pepitoria
```json
{
  "nombre": "Pollo en pepitoria",
  "tags": ["carne", "huevo", "fruto seco"],        ← OBLIGATORIO
  "grupo_principal": "carne",
  "ingredientes": [
    { "nombre": "Pollo", "cantidad": 1200 },
    { "nombre": "Cebolla", "cantidad": 150 },
    ... más ingredientes
  ],
  "pasos": [
    "Salpimienta los trozos de pollo...",
    ... más pasos
  ]
}
```

### Validaciones Internas
```python
# Línea 155-158: __tags_nutricionales()
return [t for t in receta.get("tags", []) if t in CUOTAS]
```

✅ Solo se usan tags que están en CUOTAS  
❌ Tags desconocidos se ignoran silenciosamente

---

## 📤 Estructura de Salida: Planificación

### Esquema JSON Completo
```json
{
  "generado_en": "2024-03-23T15:30:45.123456+00:00",
  "fuente_datos": "json",
  "total_recetas_disponibles": 45,
  "dias": [
    {
      "dia": "2024-03-23T00:00:00+00:00",
      "comida": {
        "nombre": "Pollo en pepitoria",
        "tags": ["carne", "huevo", "fruto seco"],
        "grupo_principal": "carne",
        "ingredientes": [ ... ],
        "pasos": [ ... ]
      },
      "cena": {
        "nombre": "Gazpacho andaluz",
        "tags": ["verdura", "cereal"],
        "grupo_principal": "verdura",
        "ingredientes": [ ... ],
        "pasos": [ ... ]
      }
    },
    {
      "dia": "2024-03-24T00:00:00+00:00",
      "comida": { ... },
      "cena": { ... }
    },
    ... 5 días más
  ]
}
```

---

## 🔍 Análisis Línea por Línea de la Salida

### Campo: `generado_en`
```python
# Línea 257
"generado_en": datetime.now(timezone.utc).isoformat()
```
Marca de tiempo UTC en formato ISO 8601.

### Campo: `fuente_datos`
```python
# Línea 258
"fuente_datos": self.__FUENTE_DATOS  # "mongodb" o "json"
```
Indica de dónde se cargaron las recetas.

### Campo: `total_recetas_disponibles`
```python
# Línea 259
"total_recetas_disponibles": len(recetas)
```
Número total de recetas únicas cargadas.

### Campo: `dias[]`
```python
# Línea 263-288
for i in range(self.__DIAS_TOTALES):
    dia: dict[str, Any] = {
        "dia": datetime.now(timezone.utc).replace(
            day=datetime.now(timezone.utc).day + i
        ),
    }
    for turno in ("comida", "cena"):
        plato = self.__selecciona_plato_con_cuotas(...)
        dia[turno] = plato
    
    planificacion["dias"].append(dia)
```

Cada día tiene:
- `dia`: Fecha calculada automáticamente
- `comida`: Objeto receta completo
- `cena`: Objeto receta completo

---

## 📋 Tabla de Traducciones de Campos

| JSON de Entrada | Usado en | Propósito |
|-----------------|----------|-----------|
| `nombre` | Identificación | Mostrar nombre del plato |
| `tags` | Filtrado y cuotas | Clasificar nutricionalmente |
| `grupo_principal` | Referencia | Indicar grupo dominante |
| `ingredientes` | Mostrador | Listar ingredientes |
| `pasos` | Instrucciones | Pasos de cocción |
| `_id` (MongoDB) | Identificación | ID único en MongoDB |
| `id` (JSON) | Identificación | ID único en JSON |

---

## 🎯 Ejemplo Práctico: Salida Simplificada

```json
{
  "generado_en": "2024-03-23T15:30:45.123456+00:00",
  "fuente_datos": "json",
  "total_recetas_disponibles": 35,
  "dias": [
    {
      "dia": "2024-03-23T00:00:00+00:00",
      "comida": {
        "nombre": "Pollo en pepitoria",
        "tags": ["carne", "huevo", "fruto seco"],
        "grupo_principal": "carne"
      },
      "cena": {
        "nombre": "Gazpacho andaluz",
        "tags": ["verdura", "cereal"],
        "grupo_principal": "verdura"
      }
    },
    {
      "dia": "2024-03-24T00:00:00+00:00",
      "comida": {
        "nombre": "Marmitako de bonito",
        "tags": ["pescado", "verdura"],
        "grupo_principal": "pescado"
      },
      "cena": {
        "nombre": "Alubias blancas con verduras",
        "tags": ["legumbre", "verdura"],
        "grupo_principal": "legumbre"
      }
    },
    ... 5 días más
  ]
}
```

---

## 📊 Conteos Esperados (Validación Manual)

Si ejecutas la planificación y quieres verificar que se respetan las cuotas:

```python
# Script para validar
import json

planificacion = api.planifica()
conteo = {g: 0 for g in CUOTAS}

for dia in planificacion["dias"]:
    for turno in ["comida", "cena"]:
        plato = dia[turno]
        for tag in plato.get("tags", []):
            if tag in conteo:
                conteo[tag] += 1

print("Conteo final:", conteo)
# Debería mostrar:
# {
#   'verdura': 9,      ← entre 8-14 ✅
#   'lácteo': 2,       ← entre 2-3 ✅
#   'cereal': 4,       ← entre 3-5 ✅
#   'legumbre': 2,     ← entre 2-3 ✅
#   'fruto seco': 1,   ← entre 1-2 ✅
#   'pescado': 3,      ← entre 3-4 ✅
#   'huevo': 3,        ← entre 2-3 ✅
#   'carne': 2         ← entre 2-3 ✅
# }
```

---

## 🔄 Transformación de Tipos (MongoDB → JSON)

**Línea 122-139: `__to_json_compatible()`**

| Tipo Original | Transformación | Ejemplo |
|---------------|----------------|---------|
| `ObjectId` | `str` | `ObjectId("5f...") → "5f..."` |
| `datetime` | `isoformat()` | `datetime(...) → "2024-03-23T..."` |
| `date` | `isoformat()` | `date(...) → "2024-03-23"` |
| `dict` | Recursivo | `{...}` → JSON compatible |
| `list` | Recursivo | `[...]` → JSON compatible |
| `tuple` | `list` | `(1,2) → [1,2]` |
| `str/int/float/bool/None` | Sin cambio | `"texto"` → `"texto"` |
| Otros | `str()` | Fallback: convierte a string |

---

## ⚙️ Casos Especiales de Salida

### Caso 1: Sin MongoDB (usa JSON)
```json
{
  "generado_en": "2024-03-23T15:30:45+00:00",
  "fuente_datos": "json",     ← NOT "mongodb"
  "total_recetas_disponibles": 45,
  ...
}
```

### Caso 2: Con MongoDB
```json
{
  "generado_en": "2024-03-23T15:30:45+00:00",
  "fuente_datos": "mongodb",  ← Desde BD
  "total_recetas_disponibles": 150,
  ...
}
```

### Caso 3: Error - Recetas insuficientes
```python
# Línea 249-251
try:
    planificacion = api.planifica()
except InsufficientRecipesError as e:
    print(f"Error: {e}")
    # Output: "No hay suficientes recetas para planificar..."
```

### Caso 4: Error - MongoDB no conecta
```python
# Sin MONGODB_URI en .env → usa JSON automáticamente
api = API_planificacion()
# Intenta MongoDB, falla, carga JSON, continúa sin error
```

---

## 🧮 Estructura de Conteo Interno (No en Salida)

Durante la ejecución, el algoritmo mantiene `conteo_ventana`:

```python
# Línea 259
conteo_ventana = {
    "verdura": 0,
    "lácteo": 0,
    "cereal": 0,
    "legumbre": 0,
    "fruto seco": 0,
    "pescado": 0,
    "huevo": 0,
    "carne": 0
}

# Después de plato 1 (Pollo en pepitoria: carne, huevo, fruto seco)
conteo_ventana = {
    "verdura": 0,
    "lácteo": 0,
    "cereal": 0,
    "legumbre": 0,
    "fruto seco": 1,    ← +1
    "pescado": 0,
    "huevo": 1,         ← +1
    "carne": 1          ← +1
}
```

**Nota**: Este conteo NO aparece en la salida final, pero se usa internamente.

---

## 📝 Validación de Salida JSON

La salida es válida si:

```python
import json

output = api.planifica()
json_str = json.dumps(output)  # Debe serializar sin error
datos = json.loads(json_str)   # Debe deserializar sin error
```

✅ Serializable a JSON  
✅ Todos los ObjectId convertidos a strings  
✅ Todos los datetime convertidos a ISO strings  
✅ Estructura consistente todos los días

---

## 🔗 Relación: Entrada → Procesamiento → Salida

```
recetas.json (entrada)
    ↓
__carga_recetas() [línea 92]
    ↓
__normaliza_receta() [línea 119]
    ↓
__to_json_compatible() [línea 122]
    ↓
planifica() [línea 238]
    ├─ Loop 7 días [línea 263]
    ├─ Loop 2 comidas [línea 268]
    ├─ __selecciona_plato_con_cuotas() [línea 269]
    └─ Guardar en dia[turno] [línea 283]
    ↓
JSON serializable (salida)
```

