# Documentación de Pruebas Unitarias - API Planificación

Este documento establece la relación directa entre las funciones de prueba del archivo `test_unidad.py` y el código fuente original del algoritmo evaluado en `API_planificacion.py`.

## 1. Tests sin Historial (`TestSinHistorial`)

Esta sección evalúa el comportamiento de la API cuando se planifica una semana desde cero.

### 1.1. `test_estructura_correcta`
Valida la forma y campos básicos del JSON/diccionario de respuesta.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_estructura_correcta(self, seed: int) -> None:
        plan = _crear_api(seed).planifica()
        validar_estructura(plan, num_dias_esperados=7)
```

**Código Probado (`API_planificacion.py`)**
```python
        planificacion: dict[str, Any] = {
            "generado_en": datetime.now(timezone.utc).isoformat(),
            "fuente_datos": self.__FUENTE_DATOS,
            "total_recetas_disponibles": len(recetas),
            "dias": [],
        }

        plato_k = 1
        for i in range(self.__DIAS_TOTALES):
            # ...
            dia: dict[str, Any] = {
                "dia": (datetime.now(timezone.utc) + timedelta(days=i)).isoformat(),
            }

            for turno in ("comida", "cena"):
                plato = self.__selecciona_plato_con_cuotas(
                    recetas, ids_recientes, conteo_ventana, plato_k
                )
                # ...
                dia[turno] = plato
                plato_k += 1

            # ...
            planificacion["dias"].append(dia)
```

### 1.2. `test_json_serializable`
Garantiza que la respuesta no contiene tipos complejos como `ObjectId` o `datetime` sin parsear.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_json_serializable(self, seed: int) -> None:
        plan = _crear_api(seed).planifica()
        assert_json_serializable(plan)
```

**Código Probado (`API_planificacion.py`)**
```python
    def __to_json_compatible(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self.__to_json_compatible(inner_value) for key, inner_value in value.items()}
        if isinstance(value, list):
            return [self.__to_json_compatible(item) for item in value]
        if isinstance(value, tuple):
            return [self.__to_json_compatible(item) for item in value]
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        return str(value)
```

### 1.3. `test_sin_repeticiones_14_dias`
Comprueba que el algoritmo no repite un mismo plato dentro de una ventana de 14 días.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_sin_repeticiones_14_dias(self, seed: int) -> None:
        """Ningún plato se repite dentro de una ventana de 14 días."""
        plan = _crear_api(seed).planifica()
        assert_sin_repeticiones_14_dias(plan["dias"])
```

**Código Probado (`API_planificacion.py`)**
```python
        # En planifica():
        ids_recientes: deque[str] = deque(maxlen=self.__TOTAL_PLATOS * 2)

        # En __selecciona_plato_con_cuotas():
        # quitamos del pool las recetas que hemos puesto en los últimos 14 días
        # para no repetir plato tan pronto
        disponibles = [
            r for r in recetas
            if self.__identificador_receta(r) not in ids_recientes
        ]

        # si por alguna razón todas están bloqueadas por recencia, usamos todas
        # mejor repetir que quedarse sin opciones
        if not disponibles:
            disponibles = list(recetas)
```

### 1.4. `test_cuotas_ventanas_7_dias`
Verifica que las cuotas nutricionales se respetan para cada subconjunto de 7 días.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_cuotas_ventanas_7_dias(self, seed: int) -> None:
        """Cada ventana de 7 días consecutivos cumple las cuotas."""
        plan = _crear_api(seed).planifica()
        assert_cuotas_ventanas_7_dias(plan["dias"])
```

**Código Probado (`API_planificacion.py`)**
```python
        for grupo, cuota in CUOTAS.items():
            ya_tengo = conteo.get(grupo, 0)
            pendiente_min = cuota["min"] - ya_tengo
            exceso = ya_tengo - cuota["max"]

            if pendiente_min > 0 and pendiente_min >= platos_restantes:
                urgentes.add(grupo)

            if ya_tengo >= cuota["max"]:
                bloqueados.add(grupo)
            elif ya_tengo > 0.7 * cuota["max"]:
                criticos.add(grupo)
```

### 1.5. `test_14_platos_unicos`
Confirma que los 14 platos entregados en la semana base son absolutamente distintos.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_14_platos_unicos(self, seed: int) -> None:
        """7 días × 2 comidas = 14 platos, todos distintos."""
        plan = _crear_api(seed).planifica()
        ids = [
            obtener_id_plato(dia[turno])
            for dia in plan["dias"]
            for turno in ("comida", "cena")
        ]
        assert len(ids) == 14
        assert len(set(ids)) == 14, f"Platos duplicados: {[x for x in ids if ids.count(x) > 1]}"
```

**Código Probado (`API_planificacion.py`)**
```python
                plato = self.__selecciona_plato_con_cuotas(
                    recetas, ids_recientes, conteo_ventana, plato_k
                )

                ids_recientes.append(self.__identificador_receta(plato))
```

### 1.6. `test_reproducibilidad`
Garantiza el determinismo: la misma semilla produce exactamente la misma planificación.

**Código de la Prueba (`test_unidad.py`)**
```python
    def test_reproducibilidad(self) -> None:
        """Misma seed produce misma planificación."""
        plan1 = _crear_api(42).planifica()
        plan2 = _crear_api(42).planifica()
        ids1 = [obtener_id_plato(d["comida"]) for d in plan1["dias"]]
        ids2 = [obtener_id_plato(d["comida"]) for d in plan2["dias"]]
        assert ids1 == ids2
```

**Código Probado (`API_planificacion.py`)**
```python
        # entre las mejores elegimos al azar para que no salga siempre lo mismo
        return deepcopy(self.__RNG.choice(candidatas_top))
```

### 1.7. `test_diferentes_seeds_difieren`
Verifica que las semillas distintas proporcionan menús distintos gracias a la aleatoriedad determinista.

**Código de la Prueba (`test_unidad.py`)**
```python
    def test_diferentes_seeds_difieren(self) -> None:
        """Seeds distintas producen planificaciones distintas."""
        plan1 = _crear_api(42).planifica()
        plan2 = _crear_api(999).planifica()
        ids1 = [obtener_id_plato(d["comida"]) for d in plan1["dias"]]
        ids2 = [obtener_id_plato(d["comida"]) for d in plan2["dias"]]
        assert ids1 != ids2
```

**Código Probado (`API_planificacion.py`)**
```python
        # La instanciación inyecta rng:
        self.__RNG = rng or random.Random()
```

### 1.8. `test_estadisticas_multiples_iteraciones`
Evalúa la robustez del generador corriendo el algoritmo iteradas veces.

**Código de la Prueba (`test_unidad.py`)**
```python
    def test_estadisticas_multiples_iteraciones(self) -> None:
        """
        Ejecuta ITERACIONES planificaciones con seeds variadas y
        comprueba todas las restricciones. Imprime estadísticas al final.
        """
        stats = Estadisticas()
        fallos: list[str] = []

        for i in range(ITERACIONES):
            seed = i * 37 + 17  # semillas dispersas
            plan = _crear_api(seed).planifica()
            dias = plan["dias"]
            # Assert de cuotas y repeticiones, recolección en stats
        # ...
        assert not fallos
```

**Código Probado (`API_planificacion.py`)**
```python
        def score(r: dict[str, Any]) -> float:
            # Bonus: cuánta "deuda" de mínimos cubre
            # ...
            # Penalización: riesgo de exceder máximos
            # ...
            return total

        max_score = max(score(r) for r in candidatas)
        candidatas_top = [r for r in candidatas if score(r) >= max_score]
```


## 2. Tests con Historial (`TestConHistorial`)

Comprueba la capacidad de regenerar el menú y concatenar semanas respetando las restricciones, partiendo de un historial (`dias_previos`).

### 2.1. `test_estructura_con_historial`
Comprueba que el algoritmo devuelve una cantidad de días consistente sumando previos + nuevos (hasta un límite de 14).

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_estructura_con_historial(self, seed: int) -> None:
        """La planificación con historial tiene dias_previos + 7 días."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        # Debe devolver dias_previos + 7 días (recortado a max 14)
        esperados = min(len(dias_previos) + 7, 14)
        validar_estructura(plan_regen, num_dias_esperados=esperados)
```

**Código Probado (`API_planificacion.py`)**
```python
        if dias_previos:
            todos_los_dias = list(dias_previos) + planificacion["dias"]
            max_dias = self.__DIAS_TOTALES * 2
            if len(todos_los_dias) > max_dias:
                todos_los_dias = todos_los_dias[-max_dias:]
            planificacion["dias"] = todos_los_dias
```

### 2.2. `test_sin_repeticiones_con_historial`
Asegura que con un menú arrastrado no se repiten los platos consumidos.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_sin_repeticiones_con_historial(self, seed: int) -> None:
        """Sin repeticiones al regenerar con historial."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_sin_repeticiones_14_dias(plan_regen["dias"])
```

**Código Probado (`API_planificacion.py`)**
```python
        if dias_previos:
            # cargamos los identificadores de los platos previos para evitar repetirlos
            for dia in dias_previos:
                for turno in ("comida", "cena"):
                    plato = dia.get(turno)
                    if plato is not None:
                        ids_recientes.append(self.__identificador_receta(plato))
```

### 2.3. `test_cuotas_con_historial`
Demuestra que la sumatoria de valores nutricionales incluye el historial sin romperse.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS)
    def test_cuotas_con_historial(self, seed: int) -> None:
        """Cuotas correctas en todas las ventanas de la planificación con historial."""
        api = _crear_api(seed)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:3]

        api2 = _crear_api(seed + 1)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_cuotas_ventanas_7_dias(plan_regen["dias"])
```

**Código Probado (`API_planificacion.py`)**
```python
        if dias_previos:
            # llenamos la ventana con los últimos 7 días previos y acumulamos sus tags
            for dia in dias_previos[-self.__DIAS_TOTALES:]:
                ventana_dias.append(dia)
                for turno in ("comida", "cena"):
                    plato = dia.get(turno)
                    if plato is not None:
                        for tag in self.__tags_nutricionales(plato):
                            conteo_ventana[tag] += 1
```

### 2.4. `test_distintos_dias_regen`
Prueba inyectar distintas cantidades de días de historial.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("dias_regen", DIAS_REGEN_VALUES)
    def test_distintos_dias_regen(self, dias_regen: int) -> None:
        """Prueba con diferentes cantidades de días previos."""
        api = _crear_api(42)
        plan_inicial = api.planifica()
        dias_previos = plan_inicial["dias"][:dias_regen]

        api2 = _crear_api(43)
        plan_regen = api2.planifica(dias_previos=dias_previos)
        assert_sin_repeticiones_14_dias(plan_regen["dias"])
        assert_cuotas_ventanas_7_dias(plan_regen["dias"])
```

**Código Probado (`API_planificacion.py`)**
```python
        for i in range(self.__DIAS_TOTALES):
            # si la ventana ya tiene 7 días, el más antiguo sale y restamos sus tags
            if len(ventana_dias) == self.__DIAS_TOTALES:
                dia_expulsado = ventana_dias[0]  # será expulsado al hacer append
                for turno in ("comida", "cena"):
                    plato = dia_expulsado.get(turno)
                    if plato is not None:
                        for tag in self.__tags_nutricionales(plato):
                            conteo_ventana[tag] -= 1
```

### 2.5. `test_cadena_regeneraciones`
Garantiza el buen funcionamiento tras encadenar múltiples semanas simulando que el tiempo pasa.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("seed", SEEDS[:5])
    def test_cadena_regeneraciones(self, seed: int) -> None:
        """
        Encadena múltiples regeneraciones (simula uso real):
        genera → toma DIAS_REGEN días → regenera → repite.
        Comprueba restricciones en cada paso.
        """
        dias_regen = 3
        # ...
        for step in range(10):
            dias_previos = plan_actual["dias"][:dias_regen]
            api_step = _crear_api(seed + step + 1)
            plan_regen = api_step.planifica(dias_previos=dias_previos)

            assert_sin_repeticiones_14_dias(plan_regen["dias"])
            assert_cuotas_ventanas_7_dias(plan_regen["dias"])
            # ...
```

**Código Probado (`API_planificacion.py`)**
```python
            # añadimos el nuevo día a la ventana (expulsa el más antiguo si maxlen)
            ventana_dias.append(dia)
            planificacion["dias"].append(dia)
```

### 2.6. `test_estadisticas_con_historial`
Simulación a gran escala del arrastre de semanas sin que se rompan las reglas.

**Código de la Prueba (`test_unidad.py`)**
```python
    @pytest.mark.parametrize("dias_regen", DIAS_REGEN_VALUES)
    def test_estadisticas_con_historial(self, dias_regen: int) -> None:
        """
        Ejecuta ITERACIONES encadenamientos con historial y
        comprueba todas las restricciones. Imprime estadísticas.
        """
        # ... iteraciones con dias previos y aserciones de cuota
        # ...
        assert not fallos
```

**Código Probado (`API_planificacion.py`)**
```python
        # Toda la gestión combinada del score() junto al control de dias_previos
        def score(r: dict[str, Any]) -> float:
            # Evaluaciones para minimizar el desvío de los tags arrastrados
            # ...
```
