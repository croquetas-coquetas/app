# SC-07 - Configuración de horarios de usuario

## Resumen funcional
Se incorporó una configuración de disponibilidad para cocinar con dos rangos:
- `comida` (`inicio`, `fin`)
- `cena` (`inicio`, `fin`)

La misma configuración se usa en:
1. **Onboarding inicial** (primera ejecución), antes de generar la planificación.
2. **Modal desde perfil** (en cualquier ejecución posterior).

## Componentes y módulos implicados

### UI compartida
- `src/components/planning/HorarioConfigFields.tsx`
  - Contiene los 4 campos `input[type="time"]`.
  - Recibe `horarios`, `onHorarioChange` y `errorMsg`.
  - Evita duplicación entre onboarding y modal.

### Pantallas/entrada de usuario
- `src/components/planning/states/ScheduleOnboardingState.tsx`
  - Pantalla de primer uso (`Configura tu horario`).
  - Botón de acción: `Guardar y generar planificacion`.

- `src/App.tsx`
  - Modal `Configurar mi horario` desde menú perfil.
  - Reutiliza `HorarioConfigFields`.

### Lógica de dominio y storage
- `src/lib/horarios.ts`
  - `DEFAULT_HORARIOS`
  - `validateHorarios(horarios)`
  - `loadHorariosFromStorage()`
  - `saveHorariosToStorage(horarios)`

- `src/lib/planning.constants.ts`
  - clave de persistencia compartida: `STORAGE_HORARIOS`.

## Flujo actual

### Primera ejecución
1. Usuario entra en `landing`.
2. Click en `Get Started`.
3. Se muestra `schedule-onboarding`.
4. Si el rango es válido:
   - se guarda en `localStorage` (`STORAGE_HORARIOS`),
   - se continúa con `doGenerate()`.

### Ajuste posterior desde perfil
1. Usuario abre menú de perfil en la `BottomNavBar`.
2. Selecciona `Configurar horario`.
3. Se abre modal con los mismos campos.
4. Si el rango es válido:
   - se guarda en `STORAGE_HORARIOS`,
   - se cierra modal.

## Validación actual
`validateHorarios` comprueba:
- que los 4 campos estén informados,
- `inicio < fin` para comida,
- `inicio < fin` para cena.

El error se muestra dentro del mismo bloque de configuración (`errorMsg`).

## Valores por defecto
Si no existe configuración o el JSON almacenado no es válido:
- comida: `13:00` -> `14:30`
- cena: `20:00` -> `21:00`

## Notas de implementación
- No se persiste todavía en backend, solo `localStorage`.
- La carga se hace al inicializar el estado `horarios` en `App`.
- La validación de formato profundo está centralizada en `src/lib/horarios.ts`.

