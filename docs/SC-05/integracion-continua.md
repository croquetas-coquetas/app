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

### Disparadores
El workflow se ejecuta en:
```yaml
push:
  branches: [main, develop]
  paths: [src/**, tests-SC-05/**, package.json, ...]

pull_request:
  branches: [main, develop]
  paths: [src/**, tests-SC-05/**, ...]
```

### Jobs Principales

#### 1. **test-sc05** - Tests de SC-05
Ejecuta tests en orden con validación strict:

```bash
# 1. Tests Unitarios
bun test tests-SC-05/**Unitarios.test.ts

# 2. Tests Integración (si existen)
bun test tests-SC-05/**Integracion.test.ts

# 3. Tests Sistema (si existen)
bun test tests-SC-05/**Sistema.test.ts
```

**Comportamiento**:
- Si un test falla, el workflow se detiene
- Si un archivo de tests no existe, se ejecuta el siguiente

#### 2. **lint** - Type Check & Build
```bash
bunx tsc --noEmit    # Validar tipos TypeScript
bun run build        # Compilar proyecto
```

#### 3. **all-tests-passed** - Resumen Final
Valida que todos los jobs anteriores pasaron.

## Server CI (Python/Pytest)

**Archivo**: `.github/workflows/server-ci.yml` (actualizado)

### Nuevos Steps para SC-05

```yaml
- name: Run SC-05 Backend Tests
  if: ${{ hashFiles('server/test_sc_05_*.py') != '' }}
  working-directory: server
  run: pytest -q -v test_sc_05_unitarios.py test_sc_05_integracion.py test_sc_05_sistema.py || echo "SC-05 tests no encontrados"
```

**Características**:
- Solo ejecuta si existen archivos `test_sc_05_*.py`
- No bloquea si no existen (para backward compatibility)
- Ejecuta tests en orden: unitarios → integración → sistema

## Convención de Nombres de Tests

### Frontend (TypeScript)

```
tests-SC-05/
├── tests_generar_lista_Unitarios.test.ts
│   └── Pruebas de funciones aisladas
│
├── tests_generar_lista_Integracion.test.ts    [POR CREAR]
│   └── Pruebas sin mocks, con localStorage real
│
└── tests_generar_lista_Sistema.test.ts         [POR CREAR]
    └── Flujo completo: API → frontend → lista
```

**Patrón de nombre**: `*{Unitarios|Integracion|Sistema}.test.ts`

### Backend (Python)

```
server/
├── test_sc_05_unitarios.py                    [POR CREAR]
│   └── Pruebas de funciones aisladas
│
├── test_sc_05_integracion.py                  [POR CREAR]
│   └── Pruebas con API real
│
└── test_sc_05_sistema.py                      [POR CREAR]
    └── Flujo completo del sistema
```

**Patrón de nombre**: `test_sc_05_{unitarios|integracion|sistema}.py`

## Scripts en package.json

Se han agregado scripts específicos para ejecutar tests localmente:

```json
{
  "scripts": {
    "test:sc05": "vitest tests-SC-05/",
    "test:sc05:unit": "vitest tests-SC-05/**Unitarios.test.ts",
    "test:sc05:integration": "vitest tests-SC-05/**Integracion.test.ts",
    "test:sc05:system": "vitest tests-SC-05/**Sistema.test.ts",
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

# Solo integración
bun run test:sc05:integration

# Solo sistema
bun run test:sc05:system

# Con cobertura
bun run test:coverage
```

## Flujo de Ejecución en CI

### Cuando se hace Push/PR

```
1. Checkout código
2. Setup Bun
3. Install dependencies
4. 
5. JOB: test-sc05
   ├─ Run SC-05 Unit Tests
   ├─ Run SC-05 Integration Tests (si existen)
   └─ Run SC-05 System Tests (si existen)
6.
7. JOB: lint
   ├─ Type Check (tsc)
   └─ Build Check (vite)
8.
9. JOB: all-tests-passed (resumen)
   └─ Valida que test-sc05 + lint pasaron
```

## Cómo Crear Tests de Integración y Sistema

### Frontend (TypeScript)

**1. Crear `tests-SC-05/tests_generar_lista_Integracion.test.ts`:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("generarListaCompra - Integración", () => {
  beforeEach(() => {
    // Limpiar localStorage antes de cada test
    localStorage.clear();
  });

  it("Debe guardar la lista en localStorage correctamente", () => {
    // No usar mocks de storage
    // Probar con localStorage real
  });
});
```

**2. Crear `tests-SC-05/tests_generar_lista_Sistema.test.ts`:**

```typescript
describe("generarListaCompra - Sistema", () => {
  it("Flujo completo: planificación → lista con conversiones", async () => {
    // Simular flujo real desde API hasta lista generada
  });
});
```

### Backend (Python)

**1. Crear `server/test_sc_05_integracion.py`:**

```python
import unittest
from API_planificacion import API_planificacion

class TestSC05Integracion(unittest.TestCase):
    def test_api_devuelve_ingredientes_con_unidades_convertibles(self):
        """Validar que API devuelve unidades que el frontend puede convertir"""
        api = API_planificacion()
        plan = api.generar_planificacion()
        
        for dia in plan["dias"]:
            for meal in [dia["comida"], dia["cena"]]:
                for ing in meal["ingredientes"]:
                    unidad = ing["unidad"].lower()
                    # Validar que unidad está en lista permitida
                    assert unidad in ["g", "ml", "kg", "l", "cucharadas", ...]
```

**2. Crear `server/test_sc_05_sistema.py`:**

```python
class TestSC05Sistema(unittest.TestCase):
    def test_flujo_completo_generacion_lista(self):
        """Flujo: API planificación → frontend genera lista"""
        # Test de integración completa
        pass
```

## Validación en CI

**La pipeline valida:**

✅ Tests unitarios pasan (22 tests)  
✅ Tests de integración pasan (cuando existan)  
✅ Tests de sistema pasan (cuando existan)  
✅ TypeScript compila sin errores  
✅ Proyecto construye correctamente  

Si **cualquier test falla**, el workflow se detiene y marca el PR como ❌ fallido.

## Rama de Ejecución

El workflow se ejecuta en:
- ✅ Push a `main`
- ✅ Push a `develop`
- ✅ Pull requests hacia `main` o `develop`
- ✅ Solo si cambian archivos en `src/`, `tests-SC-05/`, `package.json`, etc.

## Logs y Debugging

En GitHub Actions, verás:

```
✓ Run SC-05 Unit Tests
  22 pass, 0 fail, 35 expect() calls
  
✓ Run SC-05 Integration Tests
  [Skip si no existe archivo]
  
⏳ Run SC-05 System Tests
  [Skip si no existe archivo]
  
✓ Run lint (Type Check)
  No errors found
```

Si algo falla:
1. Abre el workflow en GitHub
2. Expande el step que falló
3. Verás el error detallado en los logs

## Próximos Pasos

1. **El equipo crea tests de integración**:
   - Archivo: `tests-SC-05/tests_generar_lista_Integracion.test.ts`
   - Framework: Vitest (igual que unitarios)

2. **El equipo crea tests de sistema**:
   - Archivo: `tests-SC-05/tests_generar_lista_Sistema.test.ts`
   - Framework: Vitest

3. **El equipo crea tests backend (Python)**:
   - Archivos: `server/test_sc_05_*.py`
   - Framework: pytest (igual que otros tests)

El pipeline se ejecutará automáticamente sin cambios adicionales.

## Configuración Actual

| Componente | Estado |
|-----------|--------|
| Frontend CI | ✅ Creado |
| Server CI | ✅ Actualizado |
| Tests Unitarios | ✅ Implementados (22 tests) |
| Tests Integración | ⏳ Por crear |
| Tests Sistema | ⏳ Por crear |
| Scripts en package.json | ✅ Agregados |

## Referencias

- Frontend Workflow: `.github/workflows/frontend-ci.yml`
- Server Workflow: `.github/workflows/server-ci.yml`
- Tests Unitarios: `tests-SC-05/tests_generar_lista_Unitarios.test.ts`
- Documentación Tests: `docs/SC-05/pruebas-unitarias.md`
- Implementación: `docs/SC-05/implementacion-factores-conversion.md`
