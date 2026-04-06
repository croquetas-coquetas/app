# SC-03-REVISION: Auditoría de la Vista "Ver Pasos para la Realización de la Receta"

**Fecha:** Abril 2026  
**Componente Auditor:** `DayFullscreenView.tsx`  
**Áreas Relacionadas:** `App.tsx`, `types/planning.ts`, `planning.utils.ts`, `App.css`

---

## 📋 RESUMEN EJECUTIVO

La funcionalidad de "Ver pasos para la realización de la receta" está implementada dentro del componente `DayFullscreenView.tsx`. Este componente es responsable de mostrar **todos los detalles de una receta** (no solo los pasos), incluyendo:

- ✅ Nombre de la receta
- ✅ Tags/categorías
- ✅ Ingredientes con cantidades y unidades
- ✅ **Pasos de preparación** (foco de esta auditoría)

El código es **funcional y bien estructurado**, pero hay áreas de mejora identificadas.

---

## 1️⃣ ARQUITECTURA Y FLUJO DE DATOS

### 1.1 Flujo de Datos

```
App.tsx (selectedDia + activeMealTab)
    ↓
DayFullscreenView.tsx (recibe props)
    ↓
Renderiza receta activa (comida o cena)
    ↓
Muestra pasos en lista ordenada <ol>
```

### 1.2 Props Recibidas

```typescript
interface DayFullscreenViewProps {
  dia: DiaPlanning;           // Objeto con días, comida y cena
  activeTab: MealTab;          // "comida" o "cena"
  onTabChange: (tab: MealTab) => void;  // Callback para cambiar tab
  onBack: () => void;          // Callback para volver
}
```

### 1.3 Estructura de Datos (DiaPlanning)

```typescript
interface DiaPlanning {
  dia: string;                // Fecha en ISO string
  comida: Receta;             // Receta de comida
  cena: Receta;               // Receta de cena
}

interface Receta {
  nombre: string;
  grupo_principal: string;
  ingredientes: Ingrediente[];
  pasos: string[];            // ← Array de strings con cada paso
  tags: string[];
}
```

---

## 2️⃣ ANÁLISIS DEL CÓDIGO

### 2.1 Estructura General del Componente

El componente está bien organizado en 3 secciones principales:

1. **Header** - Botón volver + título del día + indicador "Hoy"
2. **Tabs** - Selector de Comida/Cena
3. **Card Content** - Detalles de la receta (Tags, Ingredientes, Pasos)

### 2.2 Sección de Pasos (Líneas 96-109)

```tsx
<div className="day-detail-steps-wrap">
  <p className="day-detail-section-label">Pasos</p>
  {recetaActiva.pasos && recetaActiva.pasos.length > 0 ? (
    <ol className="day-detail-steps-list">
      {recetaActiva.pasos.map((paso, idx) => (
        <li key={`${idx}-${paso}`} className="day-detail-step-item p-1">
          <Badge variant="outline" className="day-detail-step-badge mr-2">
            Paso {idx + 1}
          </Badge>
          {paso}
        </li>
      ))}
    </ol>
  ) : (
    <p className="day-detail-empty">No hay pasos disponibles para esta receta.</p>
  )}
</div>
```

**¿Qué hace?**

- Valida que `pasos` exista y tenga elementos
- Renderiza una lista ordenada (`<ol>`) numerada manualmente
- Cada paso tiene un badge con "Paso N" + el texto del paso
- Si no hay pasos, muestra mensaje vacío

### 2.3 Estilos CSS Asociados

```css
.day-detail-steps-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.day-detail-steps-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.day-detail-step-item {
  font-size: 0.9rem;
  line-height: 1.45;
}
```

---

## 3️⃣ QUÉ FUNCIONA BIEN ✅

### 3.1 Validación Defensiva
- Verifica que `pasos` exista antes de hacer `.length`
- Valida que el array no esté vacío
- Muestra mensaje amigable si no hay datos

### 3.2 Accesibilidad Básica
- Usa etiquetas semánticas `<ol>` para lista numerada
- Usa `aria-label` en el contenedor principal
- Respeta `prefers-reduced-motion` en CSS

### 3.3 Generación de Keys
```tsx
key={`${idx}-${paso}`}
```
- Combina índice con contenido del paso
- Evita conflictos de keys si hay duplicados

### 3.4 Componentes Reutilizables
- Usa `Badge` del sistema de componentes
- Mantiene consistencia visual con el resto de la app

### 3.5 Estructura Limpia
- Componente responsable únicamente de presentación
- Lógica de estado en `App.tsx`
- Separación de responsabilidades clara

---

## 4️⃣ PROBLEMAS IDENTIFICADOS ⚠️

### 4.1 **PROBLEMA: Key Frágil** 🔴 CRÍTICO

**Ubicación:** Línea 102

```tsx
key={`${idx}-${paso}`}
```

**Problema:**
- Si el texto del paso es muy largo (100+ caracteres), puede ser ineficiente
- Si el texto del paso contiene comillas o caracteres especiales, podría causar problemas
- Los strings pueden cambiar sin cambiar la receta, causando re-renders innecesarios
- Si se modifica el orden de los pasos en el JSON, los keys cambiarán

**Impacto:** Bajo en este caso (datos estáticos), pero es una mala práctica

**Solución Recomendada:**
```tsx
// Opción 1: Usar índice único (si pasos siempre en mismo orden)
key={`paso-${idx}`}

// Opción 2: Generar IDs únicos en backend
// (Requiere estructura de datos diferente)
```

---

### 4.2 **PROBLEMA: Accesibilidad Incompleta** 🟡 MEDIO

**Ubicación:** Líneas 95-109

**Problemas:**
- El contenedor `<ol>` no tiene `role="list"` (innecesario, es implícito)
- Los `<li>` podrían beneficiarse de `role="listitem"` (también implícito)
- **No hay atributos ARIA para describir el contenido del paso**
- No hay conexión semántica entre el badge "Paso X" y el texto

**Impacto:** Bajo (navegación básica funciona), pero podría mejorar para lectores de pantalla

**Solución Recomendada:**
```tsx
<li key={`paso-${idx}`} className="day-detail-step-item p-1">
  <Badge 
    variant="outline" 
    className="day-detail-step-badge mr-2"
    id={`step-badge-${idx}`}
  >
    Paso {idx + 1}
  </Badge>
  <span id={`step-text-${idx}`}>{paso}</span>
</li>
```

---

### 4.3 **PROBLEMA: Sin Feedback Visual de Pasos Largos** 🟡 MEDIO

**Ubicación:** Línea 107

```tsx
{paso}
```

**Problema:**
- El texto del paso se renderiza tal cual
- En pasos muy largos (500+ caracteres), todo es un párrafo continuo
- No hay división clara entre instrucciones
- No hay indicadores visuales de subtareas

**Impacto:** Bajo (dados reales tienen 1-3 oraciones por paso)

**Ejemplo:**
Un paso podría ser:
```
"Desala el bacalao cambiando el agua 3-4 veces durante 48 horas en nevera. 
Sécalo muy bien con papel de cocina, la humedad superficial es el enemigo del pil-pil."
```

Esto se renderiza como un bloque único.

---

### 4.4 **PROBLEMA: Falta Numeración Nativa del Navegador** 🟡 BAJO

**Ubicación:** Línea 102-105

```tsx
<Badge variant="outline" className="day-detail-step-badge mr-2">
  Paso {idx + 1}
</Badge>
```

**Problema:**
- Se está haciendo numeración manual en JavaScript
- El navegador no entiende que es una lista numerada
- Con CSS se podría hacer automáticamente sin código extra

**Impacto:** Muy bajo (estético/performance)

**CSS Alternativa:**
```css
.day-detail-steps-list {
  list-style: decimal;
  padding-left: 1.5rem;
}

.day-detail-steps-list li::before {
  content: "Paso " counter(list-item) ": ";
  font-weight: 600;
}
```

---

### 4.5 **PROBLEMA: Sin Validación de Estructura del Paso** 🟡 BAJO

**Ubicación:** Línea 102

```tsx
{recetaActiva.pasos.map((paso, idx) => (
```

**Problema:**
- Asume que `paso` siempre es un `string`
- Si el JSON contiene `null`, `undefined` o un objeto, fallará
- No hay validación mientras se renderiza

**Impacto:** Bajo (JSON es confiable), pero no es defensivo

**Solución Recomendada:**
```tsx
{recetaActiva.pasos
  .filter((paso) => typeof paso === 'string' && paso.trim().length > 0)
  .map((paso, idx) => (
    // ...
  ))}
```

---

### 4.6 **PROBLEMA: Clase CSS Innecesaria** 🟢 MUY BAJO

**Ubicación:** Línea 104

```tsx
<li key={`${idx}-${paso}`} className="day-detail-step-item p-1">
```

**Problema:**
- Usa `p-1` (clase de Tailwind) + clase personalizada `day-detail-step-item`
- Mezcla de dos sistemas de estilos (Tailwind + CSS personalizado)
- La clase personalizada ya define estilos del contenedor

**Impacto:** Muy bajo (funciona perfectamente)

**Observación:**
- `p-1` = padding 0.25rem
- Pero `.day-detail-step-item` no define padding
- Probablemente se añadió `p-1` para spacing, pero no es necesario si la clase `.day-detail-step-item` lo define

---

### 4.7 **PROBLEMA: Falta Responsividad Explícita** 🟢 BAJO

**Ubicación:** CSS `day-detail-steps-list` y `.day-detail-step-item`

**Problema:**
- Font-size es fijo a `0.9rem` en todos los dispositivos
- En móviles muy pequeños, podría ser difícil de leer
- No hay media queries para tablets/desktop

**Impacto:** Bajo (0.9rem es legible)

**Observación:**
- El sistema de componentes probablemente maneja esto globally
- Pero podrías querer aumentar en móviles (1rem)

---

## 5️⃣ OPORTUNIDADES DE REFACTORIZACIÓN

### 5.1 **EXTRAER EL BLOQUE DE PASOS EN UN SUB-COMPONENTE**

**Beneficio:** Reduce complejidad de `DayFullscreenView`, mejora reusabilidad

```tsx
// StepsSection.tsx
interface StepsSectionProps {
  pasos: string[];
}

export function StepsSection({ pasos }: StepsSectionProps) {
  return (
    <div className="day-detail-steps-wrap">
      <p className="day-detail-section-label">Pasos</p>
      {pasos && pasos.length > 0 ? (
        <ol className="day-detail-steps-list">
          {pasos.map((paso, idx) => (
            <li key={`paso-${idx}`} className="day-detail-step-item p-1">
              <Badge className="day-detail-step-badge mr-2">
                Paso {idx + 1}
              </Badge>
              {paso}
            </li>
          ))}
        </ol>
      ) : (
        <p className="day-detail-empty">No hay pasos disponibles.</p>
      )}
    </div>
  );
}
```

**En DayFullscreenView:**
```tsx
<StepsSection pasos={recetaActiva.pasos} />
```

**Beneficios:**
- Código más legible
- Más fácil de testear
- Posibilidad de reutilizar en otras vistas
- Mejor separación de responsabilidades

---

### 5.2 **CREAR ARCHIVO DEDICADO PARA COMPONENTES DE RECETA**

**Estructura Propuesta:**
```
components/planning/
  ├── recipe/
  │   ├── RecipeName.tsx
  │   ├── RecipeTags.tsx
  │   ├── RecipeIngredients.tsx
  │   ├── RecipeSteps.tsx
  │   └── RecipeSection.tsx (componente padre)
  ├── CalendarView.tsx
  ├── DayFullscreenView.tsx
```

**Beneficios:**
- Cada sección en componente separado
- Más mantenible
- Más testeable
- Menos props en `DayFullscreenView`

---

### 5.3 **OPTIMIZAR VALIDACIÓN CON TIPADO FUERTE**

**Problema Actual:**
```tsx
{recetaActiva.pasos && recetaActiva.pasos.length > 0 ? (
```

**Mejor:**
```tsx
// En types/planning.ts
export interface Receta {
  nombre: string;
  grupo_principal: string;
  ingredientes: Ingrediente[];
  pasos: string[];              // ← Ya está tipado
  tags: string[];
}

// En el componente, TypeScript ya sabe que pasos existe
// Puedes simplemente:
{recetaActiva.pasos?.length ? (
  // ...
) : (
  // ...
)}
```

---

### 5.4 **AGREGAR FUNCIÓN PARA FORMATEAR PASOS**

**Propuesta:**
```tsx
// planning.utils.ts
export function formatearPasos(pasos: string[]): string[] {
  return pasos
    .filter((paso) => typeof paso === 'string' && paso.trim().length > 0)
    .map((paso) => paso.trim());
}

// En el componente:
const pasosFormateados = formatearPasos(recetaActiva.pasos || []);
```

**Beneficios:**
- Lógica centralizada
- Más fácil de testear
- Reutilizable

---

### 5.5 **MEJORAR ACCESIBILIDAD CON ARIA**

```tsx
<li 
  key={`paso-${idx}`} 
  className="day-detail-step-item p-1"
  role="listitem"          // ← Explícito (aunque implícito en <li>)
  aria-labelledby={`step-title-${idx}`}
>
  <Badge 
    id={`step-title-${idx}`}
    variant="outline" 
    className="day-detail-step-badge mr-2"
  >
    Paso {idx + 1}
  </Badge>
  <span>{paso}</span>
</li>
```

---

### 5.6 **AGREGAR SOPORTE PARA PASOS EXPANDIBLES**

**Idea Futura:**
Si los pasos se vuelven muy largos, podrías hacer pasos expandibles:

```tsx
const [expandedStep, setExpandedStep] = useState<number | null>(null);

// ...

<li key={`paso-${idx}`}>
  <button
    onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
    className="step-header"
  >
    <Badge>Paso {idx + 1}</Badge>
    <span className="step-preview">{paso.substring(0, 50)}...</span>
  </button>
  
  {expandedStep === idx && (
    <div className="step-expanded">{paso}</div>
  )}
</li>
```

---

## 6️⃣ CONSIDERACIONES DE DATOS

### 6.1 Formato de Pasos en JSON

Basado en el análisis de `smartCook.recetas.json`:

- ✅ Pasos están en array de strings
- ✅ Cada paso es una descripción completa (1-3 oraciones)
- ✅ Pasos son independientes (no necesitan contexto del anterior)
- ✅ Longitud típica: 100-300 caracteres por paso
- ⚠️ No hay validación en la fuente de campo requerido

**Estructura Real:**
```json
{
  "nombre": "Paella valenciana",
  "pasos": [
    "Calienta el aceite en la paellera...",
    "En el centro de la paellera sofríe...",
    "Haz un hueco en el centro..."
  ]
}
```

---

## 7️⃣ TESTING Y CASOS EDGE

### 7.1 Casos a Validar

| Caso | Comportamiento Actual | ¿Funciona? |
|------|----------------------|-----------|
| Receta sin pasos (`pasos: []`) | Muestra "No hay pasos disponibles" | ✅ |
| Receta con `pasos: null` | Error runtime | ❌ |
| Receta con `pasos: undefined` | Error runtime | ❌ |
| Paso con 1000+ caracteres | Se renderiza completo (largo en pantalla) | ✅ |
| Paso con caracteres especiales (emoji) | Se renderiza correctamente | ✅ |
| Paso con saltos de línea `\n` | Se muestra como una línea (sin saltos) | ⚠️ |
| Cambiar de comida ↔ cena | Debería cambiar los pasos | ✅ |

### 7.2 Mejora: Manejo de NULL/UNDEFINED

```tsx
const pasos = recetaActiva.pasos ?? [];

{pasos.length > 0 ? (
  <ol className="day-detail-steps-list">
    {pasos.map((paso, idx) => (
      // ...
    ))}
  </ol>
) : (
  <p className="day-detail-empty">No hay pasos disponibles.</p>
)}
```

---

## 8️⃣ ANÁLISIS DE PERFORMANCE

### 8.1 Complejidad

- **Render:** O(n) donde n = número de pasos
- **Típicamente:** 5-8 pasos por receta → muy rápido
- **Worst case:** 20+ pasos → aún está bien

### 8.2 Re-renders

- Component se re-renderiza cuando:
  - Props cambian (`dia`, `activeTab`)
  - Tab cambia de comida ↔ cena
  - Componente padre se re-renderiza

**Optimización:**
```tsx
export const DayFullscreenView = React.memo(DayFullscreenViewComponent)
```

Aunque en general no es necesario para este componente.

---

## 9️⃣ COMPARACIÓN CON PATRÓN IDEAL

### Patrón Actual: ✓ FUNCIONAL, ⚠️ PODRÍA MEJORAR

| Aspecto | Actual | Ideal | Gap |
|--------|--------|-------|-----|
| Estructura | Inline en `DayFullscreenView` | Componente separado | 🟡 |
| Validación | Básica (null check) | Exhaustiva con tipado | 🟡 |
| Accesibilidad | Básica | WCAG 2.1 AA | 🟡 |
| Keys | Índice + contenido | Índice único | 🔴 |
| Testing | No hay tests | Necesario | 🔴 |
| Reutilización | No | Posible | 🟡 |
| Documentación | Ninguna | Necesaria | 🟡 |

---

## 🔟 RESUMEN DE RECOMENDACIONES

### 🔴 CRÍTICAS (Hacer ya)
1. Cambiar key a `paso-${idx}` para mejor performance
2. Mejorar manejo de pasos `null/undefined`

### 🟡 IMPORTANTES (Próximas iteraciones)
3. Extraer `StepsSection` en componente separado
4. Mejorar accesibilidad con ARIA
5. Agregar validación más robusta en tipos

### 🟢 OPCIONALES (Nice to have)
6. Implementar sub-componentes para cada sección de receta
7. Agregar tests unitarios
8. Implementar pasos expandibles si crecen en longitud
9. Agregar soporte para saltos de línea en pasos

---

## 1️⃣1️⃣ CONCLUSIÓN

**La vista es FUNCIONAL y ESTÁ LISTA PARA PRODUCCIÓN.**

Fortalezas:
- ✅ Código limpio y legible
- ✅ Estructura clara
- ✅ Validación defensiva básica
- ✅ Buen UX con badges numerados
- ✅ Accesibilidad básica

Áreas de Mejora:
- ⚠️ Sistema de keys podría ser más robusto
- ⚠️ Accesibilidad puede mejorarse
- ⚠️ Podría refactorizarse en sub-componentes
- ⚠️ Falta validación tipada forte

**Recomendación Final:**
- ✅ Mantener en producción sin cambios urgentes
- 📋 Planificar refactorización a components en siguiente sprint
- 🔒 Mejorar accesibilidad en iteración futura
- 📝 Añadir tests cuando crezca la complejidad

---

**Fin de la Auditoría**
