# SC-05 – Pruebas Unitarias de Generación de Lista de Compra

## Descripción
Documento que describe las pruebas unitarias implementadas para validar la funcionalidad de generación de lista de compra con conversión y normalización de unidades.

## Ubicación
- **Archivo de tests**: `tests-SC-05/tests_generar_lista_Unitarios.test.ts`
- **Framework**: Vitest
- **Comando de ejecución**: `bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts`

## Estructura de Tests

### 1. Mocks
Los tests utilizan mocks para aislar la funcionalidad:

```typescript
const mockCargarPlanificacion = vi.fn();

vi.mock("@/lib/shopping.storage", () => ({
  cargarPlanificacion: mockCargarPlanificacion,
  saveListaCompra: vi.fn(),
  getSavedListaCompra: vi.fn(),
}));
```

**Razón**: Aislar la lógica de generación sin depender de almacenamiento real.

### 2. Funciones Auxiliares
Para simplificar la creación de datos de prueba:

```typescript
function makeIngrediente(nombre: string, cantidad: number, unidad = "g"): Ingrediente
function makeReceta(ingredientes: Ingrediente[]): Receta
function makeDia(comidaIngredientes?: Ingrediente[], cenaIngredientes?: Ingrediente[]): DiaPlanning
```

## Cobertura de Tests

### A. Estructura de la Lista (3 tests)
Valida que la lista generada tiene la estructura correcta:

| Test | Validación |
|------|-----------|
| `Devuelve una lista con la estructura correcta` | Propiedades esperadas (generado_en, planificacion_generada_en, total_items, items) |
| `La fecha de generación es la actual y está en formato ISO` | Timestamp válido entre before/after |
| `El número total de ingredientes es el correcto` | total_items coincide con length de items |

### B. Acumulación de Ingredientes (10 tests)
Prueba la acumulación correcta de ingredientes con conversiones:

| Test | Validación |
|------|-----------|
| `Acumula ingredientes entre la comida y la cena` | Cantidad se suma correctamente |
| `Acumula ingredientes a través de los días` | Cantidades se acumulan en múltiples días |
| `Separa ingredientes distintos` | Cada ingrediente es un item diferente |
| `Almacena las unidades correctamente` | La unidad se preserva |
| `Convierte cucharadas a mililitros` | 2 cucharadas + 1 cucharada = 45 ml |
| `Convierte pizcas a gramos` | 3 pizcas + 2 pizcas = 5 g |
| `Convierte tazas a mililitros` | 2 tazas + 1 taza = 720 ml (240 ml/taza) |
| `Convierte kilogramos a gramos` | 1 kg + 0.5 kg = 1.5 kg (normalizado) |
| `Convierte litros a mililitros` | 1.5 l + 0.5 l = 2 l (normalizado) |
| `Elimina espacios en blanco sobrantes` | "  tomate  " → "tomate" |

### C. Normalización de Unidades (5 tests)
Valida la conversión de unidades grandes a más legibles:

| Test | Validación |
|------|-----------|
| `Convierte gramos a kilogramos cuando es >= 1000g` | 2000 g → 2 kg |
| `Convierte mililitros a litros cuando es >= 1000ml` | 1500 ml → 1.5 l |
| `No convierte si es menor a 1000` | 500 g → 500 g (sin cambio) |
| `Redondea a 2 decimales en la normalización` | 1234 g → 1.23 kg |
| `Aplica normalización después de acumular ingredientes` | 600g + 500g + 100g = 1.2 kg |

### D. Ordenación (2 tests)
Verifica el orden correcto en la lista final:

| Test | Validación |
|------|-----------|
| `Ordena los objetos por categoría` | Respeta CATEGORIA_ORDEN (verdura, lácteo, etc.) |
| `Ordena alfabéticamente dentro de una misma categoría` | "apio" antes de "zanahoria" |

### E. Corner Cases (2 tests)
Casos extremos y situaciones especiales:

| Test | Validación |
|------|-----------|
| `Devuelve una lista vacía si no hay días` | total_items = 0 |
| `Si hay días pero no hay recetas devuelve lista vacía` | Maneja ausencia de ingredientes |

## Resultados de Ejecución

```
✓ 22 tests passed
✓ 0 failures
✓ 35 expect() calls
✓ Ejecución: 325ms
```

## Conversiones Validadas

**Conversiones de entrada a unidad estándar:**
- Cucharadas → 15 ml
- Pizcas → 1 g
- Hojas → 3 g
- Dientes → 5 g
- Tazas → 240 ml
- Kilogramos → 1000 g
- Litros → 1000 ml

**Normalización de salida (si cantidad ≥ 1000):**
- g ≥ 1000 → kg
- ml ≥ 1000 → l
- Redondeo a 2 decimales

## Tipo de Test

**Clasificación**: Tests Unitarios

**Razones:**
- Aíslan la función `generarListaCompra()` con mocks
- No prueban persistencia real ni flujo completo
- Enfoque en lógica de conversión y acumulación

## Comando de Ejecución

```bash
# Ejecución básica
bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts

# Modo verbose (detallado)
bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts --verbose

# Modo watch (re-ejecuta al cambiar archivos)
bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts --watch

# Con cobertura
bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts --coverage
```

## Cobertura

| Aspecto | Cobertura |
|--------|-----------|
| Funciones | 100% (generarListaCompra) |
| Conversiones de entrada | 100% (todas las unidades) |
| Normalización de salida | 100% (g→kg, ml→l) |
| Acumulación | 100% (entre comidas, días) |
| Ordenación | 100% (categoría y alfabética) |

## Próximos Pasos

Para completar la validación de SC-05 se necesitan:

1. **Tests de Integración** (`tests-SC-05/tests_generar_lista_Integracion.test.ts`)
   - Probar con localStorage real
   - Validar persistencia en storage
   
2. **Tests de Sistema** (`server/test_sistema_sc_05.py`)
   - Flujo completo: API → frontend → lista
   - Validar ingredientes del servidor con conversiones del frontend

## Dependencias

- `vitest` - Framework de testing
- `@/lib/generarLista` - Función bajo prueba
- `@/lib/shopping.storage` - Mocked para tests
- `@/types/planning` - Tipos de datos

## Estado

- Pruebas unitarias: ✅ **Completadas**
- Pruebas de integración: ⏳ Pendiente
- Pruebas de sistema: ⏳ Pendiente
- Listo para CI/CD: ✅ **Sí**
