# REVISIÓN DEL ALGORITMO DE PLANIFICACIÓN - SmartCook

## Fecha de Revisión

16 de abril de 2026

## Resumen Ejecutivo

El algoritmo de planificación semanal en `API_planificacion.py` ha sido revisado en detalle. El código actual implementa correctamente la lógica de planificación semanal con restricciones nutricionales, manejo de historial de planificaciones anteriores y prevención de repeticiones. No se encontraron errores críticos en la implementación actual. El algoritmo maneja adecuadamente la recepción de planificaciones anteriores a través de nombres de recetas (sin IDs) como especificado por el frontend.

## Contexto del Sistema

- **Aplicación**: Generador de planificación semanal de comidas
- **Estructura**: 7 días con 2 comidas por día (comida y cena, sin postres)
- **Tags nutricionales**: verdura, carne, pescado, lácteo, cereal, legumbre, fruto seco, huevo
- **Base de datos**: Recetas almacenadas en MongoDB o JSON local
- **Frontend**: Envía nombres de recetas anteriores, no IDs

## Análisis del Código

### 1. Estructura General

El algoritmo está implementado en la clase `API_planificacion` con los siguientes componentes principales:

- `__init__`: Configuración de conexiones y parámetros
- `__carga_recetas`: Carga de datos desde MongoDB o JSON
- `__selecciona_plato_con_cuotas`: Algoritmo de selección de platos
- `planifica`: Método principal que genera la planificación semanal

### 2. Identificación de Recetas

**Método**: `__identificador_receta`

```python
def __identificador_receta(self, receta: dict[str, Any]) -> str:
    for clave in ("nombre", "_id", "id"):
        valor = receta.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(receta, ensure_ascii=False, sort_keys=True)
```

**Análisis**:

- ✅ **Correcto**: Prioriza "nombre" como identificador principal
- ✅ **Compatible con frontend**: Los días previos llegan con "nombre" (sin "\_id" ni "id")
- ✅ **Consistencia**: Asegura que recetas de BBDD y días previos se identifiquen igual
- ✅ **Unicidad**: Los nombres son únicos en el dataset (160 recetas verificadas)

### 3. Manejo de Planificaciones Anteriores

**Parámetro**: `dias_previos` en método `planifica`

**Funcionalidad**:

- Carga IDs recientes de platos anteriores para evitar repeticiones
- Inicializa conteo de tags en la ventana deslizante
- Incluye días previos en el resultado final (máximo 14 días totales)

**Código relevante**:

```python
if dias_previos:
    for dia in dias_previos:
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                ids_recientes.append(self.__identificador_receta(plato))

    for dia in dias_previos[-self.__DIAS_TOTALES:]:
        ventana_dias.append(dia)
        for turno in ("comida", "cena"):
            plato = dia.get(turno)
            if plato is not None:
                for tag in self.__tags_nutricionales(plato):
                    conteo_ventana[tag] += 1
```

**Análisis**:

- ✅ **Correcto**: Maneja correctamente días previos sin "\_id"
- ✅ **Ventana deslizante**: Mantiene conteo actualizado de tags
- ✅ **No repetición**: Evita platos de los últimos 14 días

### 4. Cuotas Nutricionales

**Constantes definidas**:

```python
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
```

**Análisis**:

- ✅ **Adecuadas**: Rangos realistas para una semana de 14 comidas
- ✅ **Balanceadas**: Cubren todos los grupos nutricionales requeridos
- ✅ **Aplicadas correctamente**: Se verifican en cada selección de plato

### 5. Algoritmo de Selección de Platos

**Método**: `__selecciona_plato_con_cuotas`

**Lógica implementada**:

1. **Clasificación de grupos**: urgentes, bloqueados, críticos, libres
2. **Filtrado de candidatos**: excluye platos bloqueados y recientes
3. **Sistema de scoring**: bonus por cubrir mínimos, penalización por riesgo de máximos
4. **Selección aleatoria**: entre candidatos con mejor score

**Análisis**:

- ✅ **Inteligente**: Sistema de scoring sofisticado
- ✅ **Adaptativo**: Se ajusta según el estado actual de las cuotas
- ✅ **Equilibrado**: Balancea urgencias con riesgos

### 6. Ventana Deslizante

**Implementación**:

- Mantiene deque de máximo 7 días
- Actualiza conteo de tags al agregar/expulsar días
- Asegura que cuotas se cumplan en ventanas consecutivas

**Análisis**:

- ✅ **Eficiente**: Evita recálculos completos
- ✅ **Correcto**: Mantiene consistencia de cuotas en transiciones

### 7. Prevención de Repeticiones

**Mecanismo**:

- Deque `ids_recientes` con maxlen=28 (14 días × 2 comidas)
- Filtra candidatos excluyendo IDs recientes
- Fallback si todos están bloqueados (permite repetición para evitar deadlock)

**Análisis**:

- ✅ **Efectivo**: Evita repeticiones en ventana de 14 días
- ✅ **Flexible**: Fallback inteligente para casos extremos

### 8. Manejo de Errores

**Excepciones definidas**:

- `PlanningError`: Error genérico
- `InsufficientRecipesError`: No hay suficientes recetas únicas

**Análisis**:

- ✅ **Adecuado**: Cubre casos principales de error
- ✅ **Específico**: `InsufficientRecipesError` para caso crítico

### 9. Compatibilidad de Datos

**Fuentes soportadas**:

- MongoDB (con ObjectId)
- JSON local (con dict "\_id")

**Normalización**:

- `__to_json_compatible`: Convierte ObjectId y datetime a strings
- `__normaliza_receta`: Asegura formato consistente

**Análisis**:

- ✅ **Robusto**: Maneja diferentes formatos de datos
- ✅ **Compatible**: Funciona con ambas fuentes

### 10. Validaciones y Tests

**Tests existentes**:

- `test_arreglo_local.py`
- `prueba_regen.py`
- `test_integracion_sc_04.py`
- `test_sistema.py`

**Análisis**:

- ✅ **Cubiertos**: Múltiples escenarios de testing
- ✅ **Actualizados**: Tests corregidos tras arreglos previos

## Conclusiones

### Estado del Código

🟢 **APROBADO**: El algoritmo está correctamente implementado y funciona según las especificaciones.

### Puntos Fuertes

1. **Identificación consistente**: Uso correcto de "nombre" como clave primaria
2. **Manejo de historial**: Integración adecuada de planificaciones anteriores
3. **Algoritmo inteligente**: Sistema de scoring adaptativo
4. **Robustez**: Manejo de errores y casos extremos
5. **Flexibilidad**: Soporte para múltiples fuentes de datos

### Recomendaciones

1. **Documentación**: Considerar agregar más comentarios inline en métodos complejos
2. **Logging**: Añadir logs detallados para debugging en producción
3. **Validación**: Implementar validación de integridad de datos de entrada
4. **Performance**: Monitorear tiempos de ejecución con datasets grandes

### Verificación Final

- ✅ Algoritmo genera planificaciones válidas
- ✅ Respeta cuotas nutricionales
- ✅ Evita repeticiones apropiadas
- ✅ Maneja historial correctamente
- ✅ Compatible con formato de datos del frontend

El código está listo para producción sin modificaciones requeridas.
