# SC-05 – Integración Continua (CI/CD)

## Descripción General

Se ha configurado un pipeline de integración continua completo para SC-05 que ejecuta tests en distintos niveles:
- **Unitarios** (validación de funciones aisladas)
- **Integración** (validación entre módulos)
- **Sistema** (validación del flujo completo)

## Estructura de Archivos de Workflow

```
.github/workflows/
├── frontend-ci.yml          ← NUEVO: Tests TypeScript (SC-05)
├── server-ci.yml            ← ACTUALIZADO: Soporta tests Python SC-05
└── android-ci.yml           (existente)
```

## Frontend CI (TypeScript/Vitest)

**Archivo**: `.github/workflows/frontend-ci.yml`

### Job: test-sc05
Ejecuta tests unitarios de generación de lista:

```bash
bun test tests-SC-05/**Unitarios.test.ts
```

**Tests ejecutados**: 22 tests unitarios
- Estructura de lista
- Acumulación de ingredientes
- Normalización de unidades
- Ordenación
- Corner cases

#### 2. **lint** - Type Check & Build
```bash
bunx tsc --noEmit    # Validar tipos TypeScript
bun run build        # Compilar proyecto
```

#### 3. **all-tests-passed** - Resumen Final
Valida que todos los jobs anteriores pasaron.

## Server CI (Python/Pytest)

**Archivo**: `.github/workflows/server-ci.yml` (actualizado)

### Job: build-test
Ejecuta tests del servidor:

**Existing tests:**
```bash
pytest -q tests_unidad.py tests_integracion.py tests_sistema.py
```

**SC-05 Backend Tests:**
```bash
pytest -q -v test_sc_05_integracion.py
```

**Tests ejecutados**: 10 tests de integración
- Validación de estructura
- Unidades convertibles
- Cantidades numéricas
- Factores de conversión
- Sin duplicados
- Variabilidad de planes
- Conversiones
- Persistencia en BD

## Convención de Nombres de Tests

### Frontend (TypeScript) - SC-05

```
tests-SC-05/
└── tests_generar_lista_Unitarios.test.ts ✅
    └── Pruebas de generarListaCompra()
```

**Patrón**: `*Unitarios.test.ts`

**Nota**: No hay integración/sistema frontend en SC-05 (generación de lista).
Visualización de lista es otra SC diferente.

### Backend (Python) - SC-05

```
server/
└── test_sc_05_integracion.py ✅
    └── Pruebas con API + MongoDB real
```

**Patrón**: `test_sc_05_integracion.py`

## Scripts en package.json

Se han agregado scripts específicos para ejecutar tests localmente:

```json
{
  "scripts": {
    "test:sc05": "vitest tests-SC-05/",
    "test:sc05:unit": "vitest tests-SC-05/**Unitarios.test.ts",
    "test:coverage": "vitest tests-SC-05/ --coverage"
  }
}
```

### Uso Local

```bash
# Ejecutar todo SC-05
bun run test:sc05

# Solo unitarios
bun run test:sc05:unit

# Con cobertura
bun run test:coverage
```

## Flujo de Ejecución en CI

### Frontend Workflow (cuando hay cambios en src/ o tests-SC-05/)

```
1. Checkout código
2. Setup Bun
3. Install dependencies
4. TypeScript check & Build
5. Run SC-05 Unit Tests (22 tests)
   └─ tests_generar_lista_Unitarios.test.ts
6. Run Lint & Type Check
7. Summary
```

### Server Workflow (cuando hay cambios en server/)

```
1. Checkout código
2. Setup Python
3. Install dependencies
4. Compile server
5. Run existing tests (si existen)
6. Run SC-05 Backend Integration Tests (10 tests)
   └─ test_sc_05_integracion.py
```

## Validación en CI

**La pipeline valida:**

✅ Tests unitarios frontend pasan (22 tests)  
✅ Tests de integración backend pasan (10 tests)  
✅ TypeScript compila sin errores  
✅ Proyecto construye correctamente  

Si **cualquier test falla**, el workflow se detiene y marca el PR como ❌ fallido.

## Logs y Debugging

En GitHub Actions, verás:

```
✓ Run SC-05 Unit Tests (Generación de Lista)
  22 pass, 0 fail, 35 expect() calls 
  
✓ Run SC-05 Backend Integration Tests
  10 pass, 0 fail, validación completa con BD
  
✓ Type Check & Build
  No errors found
```

Si algo falla:
1. Abre el workflow en GitHub
2. Expande el step que falló
3. Verás el error detallado en los logs

## Rama de Ejecución

El workflow se ejecuta en:
- ✅ Push a `main` o `develop` (cuando cambian archivos SC-05)
- ✅ Pull requests hacia `main` o `develop` (cuando cambian archivos SC-05)
- ✅ Solo si cambian archivos en `src/`, `tests-SC-05/`, `server/`, etc.

## Próximos Pasos

### SC-05 Completada ✅
Generación de lista de compra con conversiones de unidades está lista para producción.

### Próximas SCs
- **Visualización de lista**: Nueva SC con UI, localStorage y tests de frontend
- **Edición de lista**: SC para modificar cantidades, eliminar ingredientes, etc.

## Configuración Actual - SC-05

| Componente | Cantidad | Estado |
|-----------|----------|--------|
| Tests Unitarios Frontend | 22 | ✅ Implementados |
| Tests Integración Backend | 10 | ✅ Implementados |
| Tests de Sistema | - | ⏳ Opcional |
| Scripts en package.json | - | ✅ Agregados |
| **Total Tests SC-05** | **32** | **✅ Producción** |

## Frontend CI (TypeScript/Vitest)

**Archivo**: `.github/workflows/frontend-ci.yml`

Ejecuta:
```bash
bun test tests-SC-05/**Unitarios.test.ts
```

## Server CI (Python/Pytest)

**Archivo**: `.github/workflows/server-ci.yml`

Ejecuta:
```bash
pytest server/test_sc_05_integracion.py -v
```

## Estado de Tests - SC-05

### Frontend - Tests Completados

#### ✅ Tests Unitarios (22 tests)
**Archivo**: `tests-SC-05/tests_generar_lista_Unitarios.test.ts`

Prueban la función `generarListaCompra()`:
```bash
✓ Estructura de la lista (3 tests)
✓ Acumulación de ingredientes (10 tests)
✓ Normalización de unidades (5 tests)
✓ Ordenación (2 tests)
✓ Corner cases (2 tests)
```

**Ejecución**: `bun test tests-SC-05/tests_generar_lista_Unitarios.test.ts`

**Nota**: Estos tests prueban la generación sin dependencias de BD ni persistencia.

### Backend - Tests Completados

#### ✅ Tests de Integración (10 tests)
**Archivo**: `server/test_sc_05_integracion.py`

Prueban que la API genera listas con unidades convertibles:
```bash
✓ Validación de estructura (1 test)
  - Plan tiene 7 días con comida/cena

✓ Validación de unidades (1 test)
  - Todas las unidades son convertibles

✓ Validación de cantidades (1 test)
  - Cantidad > 0 y es numérica

✓ Validación de factores (1 test)
  - Factores coinciden con esperados

✓ Validación de duplicados (1 test)
  - Sin ingredientes duplicados por receta

✓ Variabilidad de planes (1 test)
  - Planes varían con diferentes seeds

✓ Tests de conversiones (2 tests)
  - Cucharadas → ml
  - Mezcla de unidades convertibles

✓ Tests de persistencia (2 tests)
  - Guardado/recuperación de planes
  - Múltiples planes sin colisiones
```

**Ejecución**: `pytest server/test_sc_05_integracion.py -v`

**Requisitos**: MongoDB en localhost:27017

## Referencias

- Frontend Workflow: `.github/workflows/frontend-ci.yml`
- Server Workflow: `.github/workflows/server-ci.yml`
- Tests Unitarios Frontend: `tests-SC-05/tests_generar_lista_Unitarios.test.ts`
- Tests Integración Backend: `server/test_sc_05_integracion.py`
- Documentación Tests Unitarios: `docs/SC-05/pruebas-unitarias.md`
- Documentación Tests Integración: `docs/SC-05/pruebas-integracion.md`
- Implementación: `docs/SC-05/implementacion-factores-conversion.md`
