# SC-07 - Cambios en tests de `App`

## Objetivo
Alinear `src/App.test.tsx` con los cambios funcionales de esta rama:
- onboarding de horario en primera ejecución,
- navegación inferior móvil (`BottomNavBar`),
- configuración de horario desde menú de perfil,
- persistencia de horarios en `localStorage`.

## Qué se actualizó

### 1) Flujo de primera ejecución
Antes los tests asumían `landing -> generate`.

Ahora validan `landing -> schedule-onboarding`:
- click en `Get Started` muestra `Configura tu horario`;
- el CTA de entrada al flujo pasa a ser `Guardar y generar planificacion`.

### 2) Selectores y textos obsoletos
Se sustituyeron asserts antiguos por los actuales:
- `Menú semanal` -> `Menú del mes`;
- botón textual `Regenerar` -> botón con `aria-label="Regenerar planificación"`.

### 3) Navbar móvil
Se añadieron comprobaciones de presencia de acciones principales en la barra inferior:
- `Ver calendario`;
- `Generar lista de la compra`;
- `Abrir menú del perfil`.

### 4) Menú de perfil y modal de horario
Se añadieron tests para cubrir:
- apertura del menú de perfil;
- apertura del modal `Configurar mi horario`;
- cierre con `Cancelar`.

> Nota técnica: para el dropdown (Radix), se usa un helper que dispara varios eventos (`click`, `mouseDown`, `keyDown`) para mejorar estabilidad del test en entorno JSDOM.

### 5) Persistencia de horarios
Nuevas comprobaciones sobre `STORAGE_HORARIOS`:
- guardado desde onboarding inicial;
- guardado desde modal de perfil;
- carga de valores guardados al entrar al onboarding.

## Cobertura que mantiene
Se mantienen los bloques `UNIDAD`, `INTEGRACION`, `SISTEMA` y se actualizaron sus flujos para no perder cobertura de:
- errores de API/red,
- loading,
- almacenamiento de planificación (`STORAGE_META`, `STORAGE_PREFIX`),
- flujo de regeneración con confirmación cuando hay plan del día.

## Ejecución
Comando usado para validar:

```powershell
bun run test --run
```

Estado en esta rama: tests de `src/App.test.tsx` y suite completa en verde.

