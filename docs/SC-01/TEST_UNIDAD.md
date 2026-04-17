# Test de Validación del Algoritmo de Planificación

## Qué es

`test_unidad.py` es una suite de tests con **pytest** que verifica exhaustivamente que el algoritmo de `API_planificacion.planifica()` cumple todas las restricciones del menú semanal. Se ejecuta con múltiples semillas aleatorias distintas para garantizar que el algoritmo es robusto independientemente del azar.

## Restricciones verificadas

### 1. No repetición de platos en 14 días

Para cada plato de la planificación, se comprueba que **no aparezca otro plato con el mismo identificador** en los 13 días anteriores (ventana de 14 días incluyendo el día actual). Esto se aplica tanto entre días diferentes como entre comida y cena del mismo día.

### 2. Cuotas de tags por ventana de 7 días

Cada **ventana deslizante de 7 días consecutivos** debe cumplir que el conteo de cada tag esté dentro del rango `[min, max]` definido en `CUOTAS`:

| Tag        | Min | Max |
| ---------- | --- | --- |
| verdura    | 7   | 14  |
| lácteo     | 2   | 5   |
| cereal     | 3   | 7   |
| legumbre   | 1   | 4   |
| fruto seco | 0   | 3   |
| pescado    | 2   | 5   |
| huevo      | 1   | 4   |
| carne      | 2   | 6   |

La validación usa **ventana deslizante real**: se calcula el conteo de la primera ventana [0:7], y para cada ventana siguiente se resta el día que sale y se suma el día que entra. Esto verifica **todas** las ventanas posibles, no solo la global.

## Estructura de los tests

### `TestSinHistorial` — Generación desde cero

Tests que llaman a `planifica()` sin argumentos:

| Test                                      | Qué comprueba                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test_estructura_correcta[seed]`          | Que la planificación tiene 7 días con claves `dia`, `comida`, `cena` y metadatos                                                                 |
| `test_json_serializable[seed]`            | Que el resultado se puede serializar a JSON sin errores                                                                                          |
| `test_sin_repeticiones_14_dias[seed]`     | Que ningún plato se repite en 14 días                                                                                                            |
| `test_cuotas_ventanas_7_dias[seed]`       | Que cada ventana de 7 días cumple las cuotas                                                                                                     |
| `test_14_platos_unicos[seed]`             | Que los 14 platos (7 días × 2) son todos distintos                                                                                               |
| `test_reproducibilidad`                   | Que la misma seed produce la misma planificación                                                                                                 |
| `test_diferentes_seeds_difieren`          | Que seeds distintas producen resultados distintos                                                                                                |
| `test_estadisticas_multiples_iteraciones` | Ejecuta `ITERACIONES` (50) planificaciones con seeds dispersas, valida todas y muestra estadísticas de tags (media, desviación típica, min, max) |

Cada test parametrizado se ejecuta con 10 semillas distintas: `[0, 1, 7, 42, 99, 123, 256, 314, 555, 999]`.

### `TestConHistorial` — Regeneración con días previos

Tests que simulan el uso real: generar una planificación y después regenerar pasando parte de los días como historial.

| Test                                          | Qué comprueba                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test_estructura_con_historial[seed]`         | Que la planificación devuelta tiene `dias_previos + 7` días (máx 14)                                |
| `test_sin_repeticiones_con_historial[seed]`   | Sin repeticiones en la planificación completa (previos + nuevos)                                    |
| `test_cuotas_con_historial[seed]`             | Cuotas correctas en **todas** las ventanas de 7 días (incluyendo transición entre previos y nuevos) |
| `test_distintos_dias_regen[dias_regen]`       | Prueba con `DIAS_REGEN` = 1, 2, 3, 5, 7                                                             |
| `test_cadena_regeneraciones[seed]`            | Encadena 10 regeneraciones consecutivas: genera → toma N días → regenera → repite. Valida cada paso |
| `test_estadisticas_con_historial[dias_regen]` | `ITERACIONES` encadenamientos por cada valor de `dias_regen`. Imprime estadísticas                  |

## Cómo funciona la cadena de regeneración

```
1. plan_0 = planifica()                         ← sin argumentos
2. dias_previos = plan_0["dias"][:DIAS_REGEN]
3. plan_1 = planifica(dias_previos)              ← devuelve DIAS_REGEN + 7 días
4. Validar plan_1 completo (todas las ventanas de 7 días)
5. plan_actual = plan_1["dias"][-7:]             ← quedarse solo con los últimos 7
6. Repetir desde paso 2 con plan_actual
```

En cada iteración se usa una **seed diferente**, lo que simula que el algoritmo se ejecuta múltiples veces en producción con distintas condiciones aleatorias.

## Estadísticas recogidas

Al final de los tests de iteraciones múltiples se imprime:

- **Fallos de repetición**: cuántas planificaciones tenían platos repetidos en 14 días
- **Fallos de cuotas**: cuántas planificaciones violaban alguna cuota
- **Por cada tag**: media, desviación típica, mínimo y máximo observados vs. cuota

Ejemplo de salida:

```
=== ESTADÍSTICAS CON HISTORIAL (dias_regen=3, 50 iter) ===
Total iteraciones: 50
Fallos repetición: 0/50
Fallos cuotas:     0/50

Grupo             Media    Desv   Min   Max  Cuota
------------------------------------------------------------
carne              3.42    0.95     2     6  [2, 6]
cereal             4.80    1.01     3     7  [3, 7]
fruto seco         1.20    0.83     0     3  [0, 3]
huevo              2.10    0.74     1     4  [1, 4]
lácteo             3.04    0.88     2     5  [2, 5]
legumbre           2.16    0.77     1     4  [1, 4]
pescado            3.12    0.87     2     5  [2, 5]
verdura            9.56    1.63     7    14  [7, 14]
```

## Configuración

Variables al inicio de `test_unidad.py`:

| Variable            | Default     | Descripción                              |
| ------------------- | ----------- | ---------------------------------------- |
| `ITERACIONES`       | 50          | Planificaciones por test de estadísticas |
| `SEEDS`             | 10 valores  | Semillas para tests parametrizados       |
| `DIAS_REGEN_VALUES` | [1,2,3,5,7] | Valores de días previos a probar         |

## Ejecución

```bash
cd app/server
pytest test_unidad.py -v          # todos los tests con detalle
pytest test_unidad.py -v -s       # con salida de estadísticas
pytest test_unidad.py -k "sin"    # solo modo sin historial
pytest test_unidad.py -k "con"    # solo modo con historial
```
