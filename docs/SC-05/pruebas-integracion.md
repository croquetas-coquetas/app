# SC-05 – Pruebas de Integración (Backend - API + BD)

## Descripción
Documento que describe las pruebas de integración implementadas para SC-05: validar que la API genera listas de compra con ingredientes de unidades convertibles, conectándose a la base de datos real sin mocks.

## Ubicación
- **Archivo de tests**: `server/test_sc_05_integracion.py`
- **Framework**: pytest
- **Base de Datos**: MongoDB real (sin mocks)
- **Comando de ejecución**: `pytest server/test_sc_05_integracion.py -v`

## Scope de SC-05

**SC-05 cubre**: Generación de lista de compra
- ✅ Backend: API que genera lista con conversiones
- ✅ Frontend: Función `generarListaCompra()` que procesa ingredientes
- ❌ Frontend: Visualización de lista (otra SC)

## Estructura de Tests

### Diferencia Clave: Backend de SC-05

**Solo Backend (Python)**
```python
# MongoDB REAL - sin mocks
mongo_collection.insert_many(recetas)
api = API_planificacion(connection_uri=MONGODB_URI, ...)
```

- Prueba API + BD juntas
- Sin mocks de MongoDB
- Flujo real de generación

## Configuración de Fixtures

### MongoDB de Test
```python
@pytest.fixture(scope="module")
def mongo_client():
    """Conecta a MongoDB en localhost:27017"""
    client = MongoClient(MONGODB_URI)
    yield client
    client.drop_database(TEST_DB)  # Limpia después
    client.close()
```

### Datos de Test
```python
@pytest.fixture
def recetas_reales():
    """Carga recetas reales del dataset JSON"""
    with DATASET_PATH.open("r") as fh:
        recetas = json.load(fh)
    return recetas
```

### API Conectada
```python
@pytest.fixture
def api_con_mongodb(mongo_collection, recetas_reales):
    """API conectada a BD de test con datos reales"""
    mongo_collection.insert_many(recetas_convertidas)
    return API_planificacion(
        connection_uri=MONGODB_URI,
        db_name=TEST_DB,
        collection_name=TEST_COLLECTION,
        rng=random.Random(42)
    )
```

## Cobertura de Tests

### A. Validación de Estructura (1 test)
Valida que el plan generado tiene la estructura esperada:

| Test | Validación |
|------|-----------|
| `test_api_devuelve_plan_con_estructura_valida` | Planificación contiene 7 días con comida/cena |

### B. Validación de Unidades (1 test)
Verifica que todas las unidades son convertibles:

| Test | Validación |
|------|-----------|
| `test_ingredientes_devueltos_tienen_unidades_convertibles` | Todas las unidades están en UNIDADES_VALIDAS |

**Unidades válidas esperadas:**
- `g`, `kg` (peso)
- `ml`, `l` (volumen)
- `cucharadas`, `cucharada` (volumen)
- `pizcas`, `pizca` (peso)
- `tazas`, `taza` (volumen)
- `hojas`, `hoja` (peso)
- `dientes`, `diente` (peso)

### C. Validación de Cantidades (1 test)
Comprueba que las cantidades son numéricas y válidas:

| Test | Validación |
|------|-----------|
| `test_cantidad_ingredientes_es_numerica` | Cantidad > 0 y es int/float |

### D. Validación de Factores de Conversión (1 test)
Verifica que existen los factores esperados:

| Test | Validación |
|------|-----------|
| `test_factores_conversion_coinciden_con_esperados` | Factores coinciden (cucharada=15ml, etc.) |

**Factores esperados:**
- Cucharada/s → 15 ml
- Pizca/s → 1 g
- Hoja/s → 3 g
- Diente/s → 5 g
- Taza/s → 240 ml
- kg → 1000 g
- l → 1000 ml

### E. Validación de Duplicados (1 test)
Garantiza que no hay ingredientes duplicados en el mismo plato:

| Test | Validación |
|------|-----------|
| `test_ingredientes_sin_duplicados_por_receta` | Sin duplicados por receta |

### F. Variabilidad de Planes (1 test)
Verifica que la API genera planes diferentes:

| Test | Validación |
|------|-----------|
| `test_plan_generado_multiples_veces_es_diferente` | Planes con diferentes seeds varían |

### G. Tests de Conversiones (2 tests)
Valida que las conversiones funcionan en contexto:

| Test | Validación |
|------|-----------|
| `test_conversion_cucharadas_a_mililitros_en_plan` | Cucharadas presentes son válidas |
| `test_plan_con_ingredientes_mixtos_todos_convertibles` | Mezcla de unidades todas convertibles |

### H. Tests de Persistencia (2 tests)
Comprueba guardado y recuperación en BD:

| Test | Validación |
|------|-----------|
| `test_plan_guardado_en_bd_puede_recuperarse` | Plan guardado se recupera idéntico |
| `test_multiples_planes_sin_colisiones` | Múltiples planes sin conflictos |

## Validadores Auxiliares

### `_validar_unidad_convertible(unidad: str) -> bool`
Comprueba si una unidad está en la lista de convertibles.

### `_obtener_unidad_normalizada(unidad: str) -> str`
Normaliza "cucharadas" → "cucharada", "pizcas" → "pizca", etc.

### `_extraer_ingredientes_plan(plan: dict) -> list[dict]`
Extrae todos los ingredientes de los 7 días.

## Requisitos de BD

### MongoDB Disponible
Los tests requieren MongoDB en `mongodb://localhost:27017`:

```bash
# En Linux/Mac con Docker
docker run -d -p 27017:27017 mongo:latest

# O instalado localmente
mongod --dbpath /data/db
```

### Variables de Entorno
```bash
# Configurar URI (opcional, por defecto localhost)
export MONGODB_URI="mongodb://localhost:27017"
```

### Test Database
```
smartCook_sc05_test_<uuid>  ← Creada por pytest
  └─ recetas                 ← Colección con datos de test
  └─ planes                  ← Colección de planes generados
```

Se **limpia automáticamente** después de los tests.

## Ejecución

```bash
# Todos los tests de integración SC-05
pytest server/test_sc_05_integracion.py -v

# Tests específicos
pytest server/test_sc_05_integracion.py::TestSC05IntegracionConBD -v

# Con salida detallada
pytest server/test_sc_05_integracion.py -vv --tb=short

# Con MongoDB especifico
MONGODB_URI="mongodb://localhost:27017" pytest server/test_sc_05_integracion.py -v
```

## Diferencias con Tests Unitarios

| Aspecto | Unitarios (Frontend) | Integración (Backend) |
|---------|-------------|------------|
| Lenguaje | TypeScript | Python |
| Qué prueba | `generarListaCompra()` aislada | API + MongoDB juntos |
| Conexión BD | ❌ Mocks | ✅ Real |
| Scope | Función única | API + BD |
| Dataset | Pequeño (test) | Real (40 recetas) |
| Velocidad | Rápido (~325ms) | Moderado (~500ms) |
| Propósito | Lógica de conversión | Flujo real con BD |

## Resultados de Ejecución Esperados

```
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_api_devuelve_plan_con_estructura_valida PASSED
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_ingredientes_devueltos_tienen_unidades_convertibles PASSED
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_cantidad_ingredientes_es_numerica PASSED
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_factores_conversion_coinciden_con_esperados PASSED
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_ingredientes_sin_duplicados_por_receta PASSED
test_sc_05_integracion.py::TestSC05IntegracionConBD::test_plan_generado_multiples_veces_es_diferente PASSED
test_sc_05_integracion.py::TestSC05ConversionesEnIntegracion::test_conversion_cucharadas_a_mililitros_en_plan PASSED
test_sc_05_integracion.py::TestSC05ConversionesEnIntegracion::test_plan_con_ingredientes_mixtos_todos_convertibles PASSED
test_sc_05_integracion.py::TestSC05PersistenciaEnBD::test_plan_guardado_en_bd_puede_recuperarse PASSED
test_sc_05_integracion.py::TestSC05PersistenciaEnBD::test_multiples_planes_sin_colisiones PASSED

✓ 10 tests passed
✓ Ejecución: ~500ms
```

## Tipo de Test

**Clasificación**: Tests de Integración

**Razones:**
- API + MongoDB trabajan juntos
- Sin mocks de la base de datos
- Valida contrato entre componentes
- Más cercano a ambiente real que unitarios

## Próximos Pasos

1. **Tests de Sistema**:
   - Flujo completo: API backend → frontend → lista de compra
   - Validar conversiones end-to-end

2. **Backend Unitarios** (si aplica):
   - Pruebas aisladas de funciones específicas
   - Con mocks de BD

## Dependencias

- `pytest` - Framework de testing
- `pymongo` - Cliente MongoDB
- `API_planificacion` - Clase bajo prueba

## Estado

- Tests de integración backend: ✅ **Completados** (10 tests)
- Tests de integración frontend: ✅ **Completados** (17 tests)
- Tests de sistema: ⏳ Pendiente
- Total SC-05: ✅ **39 tests de integración**

## Archivos Relacionados

- [pruebas-unitarias.md](pruebas-unitarias.md) - Unitarios Frontend (generarListaCompra)
- [implementacion-factores-conversion.md](implementacion-factores-conversion.md) - Detalles técnicos
- [integracion-continua.md](integracion-continua.md) - CI/CD pipeline
