# SC-02 – Cambio de interfaz para días sin planificar

## Descripción
Se ha implementado un cambio en la interfaz de usuario relativo a la visualización de los días sin planificación de comidas.

Anteriormente, en los días sin planificar se mostraba el texto **"Sin comida planificada"** de forma separada para comida y cena.

## Cambio realizado
Se ha actualizado la interfaz para sustituir este comportamiento por una representación unificada:

- Eliminación del texto **"Sin comida planificada"** en las secciones de comida y cena.
- Sustitución por el valor **"N/A"** mostrado de forma general para todo el día cuando no existe planificación.

## Motivo del cambio
Este ajuste se realiza a petición del Product Owner (PO) con el objetivo de:

- Simplificar la visualización de días sin planificación.
- Mejorar la consistencia de la interfaz.
- Reducir redundancias en la representación de datos no disponibles.

## Impacto
- Cambio exclusivamente visual.
- No afecta a la lógica de negocio ni a la estructura de datos.
- Mejora la legibilidad en días sin planificación.

## Observaciones
Este cambio no implica modificaciones funcionales en el sistema, únicamente ajustes de presentación en la interfaz de usuario.