# Acta de Pruebas de Aceptación

## Información General

- **Responsable de las pruebas:** Daniel Maksymiv  
- **Fecha:** 16/04/2026  
- **Historia de Usuario:** 2  

## Descripción

Se han realizado las pruebas de aceptación correspondientes a la Historia de Usuario 2 por parte de Daniel Maksymiv.

Tras la ejecución de las pruebas, el Product Owner (PO) ha llevado a cabo la revisión funcional de la aplicación, centrándose especialmente en aspectos de la interfaz de usuario relacionados con la visualización de la planificación diaria.

## Observaciones del Product Owner

Durante la revisión, el PO ha identificado varios puntos de mejora en la presentación de la información dentro de la vista de planificación:

- Existe **información redundante en el nombre del día de la semana**, ya que:
  - Se muestra encima de los platos.
  - También aparece debajo del número de día en la misma vista.

El PO ha indicado que:

- Se debe **eliminar el nombre del día que aparece encima de los platos**.
- Se debe **mantener únicamente la versión abreviada del día debajo del número de día**.

Adicionalmente, el PO ha propuesto mejoras en la disposición visual:

- La etiqueta que indica **"hoy"** debe:
  - Moverse para situarse **debajo del número de día y del nombre del día**.

- Se debe añadir una **línea divisoria entre cada día**:
  - Para mejorar la legibilidad.
  - Para delimitar visualmente cada bloque de planificación.

## Resultado de las Pruebas

Debido a las observaciones indicadas por el Product Owner, la prueba de aceptación **no ha sido superada**.

## Acciones Derivadas

Se ha creado una nueva tarea para abordar las mejoras identificadas:

- **Identificador:** SC-02  
- **Título:** Rediseño vista de día  
- **HU asociada:** 2  

Esta tarea tiene como objetivo:

- Eliminar información redundante del día de la semana.  
- Reorganizar la posición del indicador "hoy".  
- Incorporar separadores visuales entre días.  

## Conclusión

La Historia de Usuario HU 2 queda pendiente de ajustes antes de su aprobación definitiva, a la espera de la implementación de la tarea SC-0.
