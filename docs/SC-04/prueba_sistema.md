# Pruebas de sistema SC-04

## Historia de usuario
Como usuario registrado, quiero ver los pasos para elaborar un plato de mi planificaciÃ³n para poder cocinarlo correctamente sin necesitar buscar la receta en otras fuentes.

## Objetivo
Verificar, desde el punto de vista del usuario final, que la aplicaciÃ³n muestra correctamente la informaciÃ³n de elaboraciÃ³n de los platos incluidos en una planificaciÃ³n.

Las pruebas de sistema validan el flujo completo:
- GeneraciÃ³n o carga de una planificaciÃ³n.
- Acceso al detalle de un dÃ­a planificado.
- SelecciÃ³n de comida o cena.
- VisualizaciÃ³n del bloque de pasos de elaboraciÃ³n.
- Mensajes mostrados cuando la informaciÃ³n estÃ¡ incompleta o no estÃ¡ disponible.

## Alcance
Se comprueban los criterios de aceptaciÃ³n de la HU SC-04:

- `SC-04-1`: pasos existentes y completos.
- `SC-04-2`: pasos existentes pero incompletos.
- `SC-04-3`: pasos inexistentes o no disponibles.

## Entorno de prueba
- AplicaciÃ³n frontend ejecutada en entorno local con Vite.
- API de planificaciÃ³n disponible para devolver una planificaciÃ³n semanal.
- Dataset de recetas con platos que cubren los tres escenarios de prueba.
- Navegador web con almacenamiento local disponible.

## Precondiciones
- El usuario se considera registrado y con acceso a la aplicaciÃ³n.
- Existe una planificaciÃ³n semanal generada o se puede generar desde la pantalla principal.
- La planificaciÃ³n contiene recetas con la estructura esperada:
  - `nombre`
  - `ingredientes`
  - `tags`
  - `pasos`
- Para validar todos los criterios, se han usado recetas de prueba con:
  - Lista de pasos completa.
  - Lista de pasos con al menos un paso vací­o.
  - Lista de pasos inexistente o vací­a.

## Proceso General
1. Acceder a la aplicación.
2. Generar o cargar una planificaciÃ³n semanal.
3. Abrir un dÃ­a de la planificaciÃ³n.
4. Seleccionar el plato a revisar, comida o cena.
5. Localizar la secciÃ³n `Pasos`.
6. Comprobar el contenido mostrado segÃºn el estado de los pasos de la receta.

## Casos de Prueba

### CP-SC04-01: VisualizaciÃ³n de pasos completos
**Criterio cubierto:** `SC-04-1`

**Datos de entrada:**
Receta incluida en la planificaciÃ³n con un array `pasos` informado y sin elementos vacÃ­os.

Ejemplo de estructura:

```json
{
  "nombre": "Plato con pasos completos",
  "pasos": [
    "Preparar los ingredientes.",
    "Cocinar a fuego medio.",
    "Servir caliente."
  ]
}
```

**Pasos ejecutados:**
1. Abrir la planificaciÃ³n semanal.
2. Seleccionar el dÃ­a que contiene el plato de prueba.
3. Abrir el detalle del plato.
4. Revisar la secciÃ³n `Pasos`.

**Resultado esperado:**
La aplicaciÃ³n muestra la secuencia ordenada de pasos necesarios para elaborar el plato.

**Resultado obtenido:**
La aplicaciÃ³n muestra los pasos en orden, etiquetados visualmente como `Paso 1`, `Paso 2`, `Paso 3`, etc.

**Estado:** Positivo.

### CP-SC04-02: VisualizaciÃ³n de pasos incompletos
**Criterio cubierto:** `SC-04-2`

**Datos de entrada:**
Receta incluida en la planificaciÃ³n con array `pasos` informado, pero con al menos un paso vacÃ­o o sin contenido Ãºtil.

Ejemplo de estructura:

```json
{
  "nombre": "Plato con pasos incompletos",
  "pasos": [
    "Preparar la base del plato.",
    "",
    "Finalizar y servir."
  ]
}
```

**Pasos ejecutados:**
1. Abrir la planificaciÃ³n semanal.
2. Seleccionar el dÃ­a que contiene el plato de prueba.
3. Abrir el detalle del plato.
4. Revisar la secciÃ³n `Pasos`.

**Resultado esperado:**
La aplicaciÃ³n indica que la informaciÃ³n puede no estar completa y permite identificar que hay pasos incompletos.

**Resultado obtenido:**
La aplicaciÃ³n detecta que existe al menos un paso vacÃ­o y muestra un mensaje de error/aviso en la secciÃ³n de pasos:

```text
Hay un paso vacÃ­o en esta receta. Revisa los datos antes de continuar.
```

El aviso se muestra en el propio detalle del plato, evitando que el usuario interprete la receta como completa.

**Estado:** Positivo.

### CP-SC04-03: Ausencia de pasos de elaboraciÃ³n
**Criterio cubierto:** `SC-04-3`

**Datos de entrada:**
Receta incluida en la planificaciÃ³n sin informaciÃ³n de elaboraciÃ³n disponible, con `pasos` vacÃ­o o sin datos.

Ejemplo de estructura:

```json
{
  "nombre": "Plato sin pasos",
  "pasos": []
}
```

**Pasos ejecutados:**
1. Abrir la planificaciÃ³n semanal.
2. Seleccionar el dÃ­a que contiene el plato de prueba.
3. Abrir el detalle del plato.
4. Revisar la secciÃ³n `Pasos`.

**Resultado esperado:**
La aplicaciÃ³n muestra un mensaje indicando que los pasos de elaboraciÃ³n no estÃ¡n disponibles.

**Resultado obtenido:**
La aplicaciÃ³n muestra el mensaje:

```text
No hay pasos disponibles para esta receta.
```

**Estado:** Positivo.

## Resultado Global
El resultado de las pruebas de sistema para la HU SC-04 es positivo.

| Criterio | DescripciÃ³n | Resultado |
| --- | --- | --- |
| `SC-04-1` | Mostrar pasos completos en orden | Positivo |
| `SC-04-2` | Avisar cuando existen pasos incompletos | Positivo |
| `SC-04-3` | Informar cuando no hay pasos disponibles | Positivo |

## Evidencias Funcionales
- La secciÃ³n `Pasos` se muestra dentro del detalle del plato seleccionado.
- Los pasos completos se renderizan como una lista ordenada.
- Los pasos incompletos se detectan mediante validaciÃ³n de contenido vacÃ­o.
- La ausencia de pasos se comunica con un mensaje especÃ­fico.

## ConclusiÃ³n
La funcionalidad implementada permite al usuario consultar la elaboraciÃ³n de los platos de su planificaciÃ³n sin acudir a fuentes externas. Los tres criterios de aceptaciÃ³n definidos para la HU SC-04 han sido validados correctamente en pruebas de sistema.

