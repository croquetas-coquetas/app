import { STORAGE_KEY } from "@/lib/planning.constants";
import { Planificacion } from "@/types/planning";
import { isPlanificacion } from "@/lib/planning.utils";

export function getSavedPlanificacion(): Planificacion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlanificacion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePlanificacion(planificacion: Planificacion) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(planificacion));
}

