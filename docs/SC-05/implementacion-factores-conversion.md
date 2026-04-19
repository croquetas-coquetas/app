# SC-05 – Aplicar factores de conversión entre tipos de ingredientes a generación de la lista de la compra

## Descripción
Se ha completado la implementación de **factores de conversión** para los ingredientes durante la generación de la lista de la compra. Esta tarea permite normalizar las unidades de medida de los ingredientes a unidades estándar (gramos y mililitros) y, cuando es necesario, convertir a unidades mayores (kilogramos y litros) para mejorar la legibilidad.

## Cambios realizados

### 1. Ampliación de constantes de conversión en `src/lib/planning.utils.ts`
Se han agregado nuevas constantes para factores de conversión adicionales:

```typescript
const CUCHARADA_A_ML = 15;      // Existente
const PIZCA_A_G = 1;             // Existente
const HOJA_A_G = 3;              // Existente
const DIENTE_A_G = 5;            // Existente
const TAZA_A_ML = 240;           // Nuevo
const KG_A_G = 1000;             // Nuevo
const LITRO_A_ML = 1000;         // Nuevo
```

### 2. Extensión de `convertirIngredienteUnidad()` en `src/lib/planning.utils.ts`
La función ha sido ampliada para manejar nuevas unidades de entrada:

**Nuevas conversiones soportadas:**
- **Tazas** → 240 ml (captura: "taza", "tazas")
- **Kilogramos** → 1000 g (captura: "kg", "kilogramo", "kilogramos")
- **Litros** → 1000 ml (captura: "l", "litro", "litros")

**Comportamiento:**
- Detecta la unidad (case-insensitive y sin espacios extra)
- Convierte a unidad estándar (g o ml)
- Retorna ingrediente con unidad normalizada

### 3. Nueva función `normalizarUnidad()` en `src/lib/planning.utils.ts`
Función que convierte unidades grandes a más legibles cuando es apropiado:

```typescript
export function normalizarUnidad(cantidad: number, unidad?: string): { cantidad: number; unidad: string }
```

**Lógica:**
- Si la cantidad es ≥ 1000 g → convierte a kg
- Si la cantidad es ≥ 1000 ml → convierte a l
- Redondea a 2 decimales para legibilidad

**Ejemplo:**
- 1500 g → 1.5 kg
- 2000 ml → 2 l
- 800 g → 800 g (sin cambio)

### 4. Integración en `src/lib/generarLista.ts`
Se modificó la función `generarListaCompra()` para:

1. Importar la nueva función `normalizarUnidad` desde `planning.utils`
2. Aplicar normalización a cada item antes de ordenar y guardar
3. Mapear los items acumulados con sus unidades convertidas

**Flujo mejorado:**
```
Ingredientes de recetas (diversas unidades)
          ↓
convertirIngredienteUnidad() [cucharadas → ml, kg → g, etc.]
          ↓
Acumular en Map (unidades estándar: g, ml)
          ↓
normalizarUnidad() [1500g → 1.5kg, 2000ml → 2l]
          ↓
Lista final (legible y normalizada)
```

## Motivo del cambio
- **Mejora de UX**: Los usuarios ven unidades más legibles (kg en lugar de 2000g)
- **Flexibilidad**: Soporta múltiples formatos de entrada en las recetas
- **Consistencia**: Todas las unidades se normalizan a estándares internacionales
- **Escalabilidad**: Fácil de agregar nuevas conversiones en el futuro

## Impacto
- **Funcionalidad**: La generación de listas de compra ahora maneja más tipos de unidades
- **Datos**: Los ingredientes se almacenan normalizados en localStorage
- **Interfaz**: Los valores en localStorage cumplen con la normalización (kg/l cuando aplica)
- **Performance**: Mínimo impacto; las conversiones son operaciones O(1)

## Archivos modificados
- `src/lib/planning.utils.ts` - Nuevas constantes y funciones de conversión
- `src/lib/generarLista.ts` - Integración de normalización en la generación

## Observaciones técnicas
- Las conversiones se aplican **durante la acumulación** de ingredientes (en `acumularIngredientes`)
- La normalización se aplica **al final**, antes de guardar la lista
- Los redondeos se hacen a 2 decimales para evitar valores con demasiadas cifras decimales
- El sistema es agnóstico a mayúsculas/minúsculas en los nombres de unidades

## Validación
Para verificar que las conversiones funcionan correctamente:

1. Generar una planificación
2. Generar la lista de compra
3. Abrir DevTools (F12) → Application → Local Storage
4. Buscar `smartcook_lista_compra`
5. Verificar que las cantidades ≥1000 se muestren en kg (si g) o l (si ml)

## Estado
- Tarea completada
- Código integrado y funcional
- Listo para pruebas de aceptación
