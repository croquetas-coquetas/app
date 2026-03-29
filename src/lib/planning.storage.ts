import { STORAGE_PREFIX, STORAGE_META, LEGACY_STORAGE_KEY } from "@/lib/planning.constants";
import { Planificacion, PlanMeta } from "@/types/planning";
import { isPlanificacion, isToday } from "@/lib/planning.utils";

function clearPlanKeys() {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(STORAGE_PREFIX) || key === STORAGE_META)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

export function savePlanificacion(planificacion: Planificacion) {
  clearPlanKeys();
  planificacion.dias.forEach((dia, i) => {
    localStorage.setItem(`${STORAGE_PREFIX}dia_${i}`, JSON.stringify(dia));
  });
  const meta: PlanMeta = {
    generado_en: planificacion.generado_en ?? new Date().toISOString(),
    fuente_datos: "api",
    total_recetas_disponibles: planificacion.dias.length * 2,
    total_dias: planificacion.dias.length,
  };
  localStorage.setItem(STORAGE_META, JSON.stringify(meta));
}

export function cargarPlanificacion(): Planificacion | null {
  try {
    const rawMeta = localStorage.getItem(STORAGE_META);
    if (!rawMeta) return null;
    const meta: PlanMeta = JSON.parse(rawMeta);
    const dias = [];
    for (let i = 0; i < meta.total_dias; i++) {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}dia_${i}`);
      if (!raw) return null;
      dias.push(JSON.parse(raw));
    }
    const plan: Planificacion = { generado_en: meta.generado_en, dias };
    return isPlanificacion(plan) ? plan : null;
  } catch {
    return null;
  }
}

export function getPlanificacionHoy(): Planificacion | null {
  const plan = cargarPlanificacion();
  if (!plan || !plan.generado_en) return null;
  return isToday(plan.generado_en) ? plan : null;
}

/** Migración one-shot: convierte la clave antigua al nuevo formato y la borra. */
export function migrateLegacyStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (isPlanificacion(parsed)) {
      savePlanificacion(parsed);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

