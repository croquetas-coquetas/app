import { Ingrediente, Planificacion } from "@/types/planning";

const CUCHARADA_A_ML = 15;
const PIZCA_A_G = 1;

export function formatFechaGenerado(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatUnidad(unidad: string): string {
  if (!unidad) return "g";
  const mappings: Record<string, string> = {
    gramos: "g",
    mililitros: "ml",
    litros: "l",
    unidad: "",
    unidades: "",
    cucharadas: "cucharadas",
    cucharada: "cucharada",
    taza: "taza",
    tazas: "tazas",
    pizca: "pizca",
    dientes: "dientes",
    hoja: "hoja",
    hojas: "hojas",
    g: "g",
    ml: "ml",
    l: "l",
  };
  return mappings[unidad.toLowerCase()] || "g";
}

export function convertirIngredienteUnidad(ingrediente: Ingrediente): Ingrediente {
  const unidad = (ingrediente.unidad || "").toLowerCase().trim();

  if (unidad === "cucharada" || unidad === "cucharadas" || unidad === "c/s") {
    return {
      ...ingrediente,
      cantidad: ingrediente.cantidad * CUCHARADA_A_ML,
      unidad: "ml",
    };
  }

  if (unidad === "pizca" || unidad === "pizcas") {
    return {
      ...ingrediente,
      cantidad: ingrediente.cantidad * PIZCA_A_G,
      unidad: "g",
    };
  }

  return ingrediente;
}

export function isToday(iso: string) {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    return (
      d.getFullYear() === hoy.getFullYear() &&
      d.getMonth() === hoy.getMonth() &&
      d.getDate() === hoy.getDate()
    );
  } catch {
    return false;
  }
}

export function getDayKey(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: Array<number | null> = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function isPlanificacion(data: unknown): data is Planificacion {
  if (!data || typeof data !== "object") return false;
  return Array.isArray((data as Planificacion).dias);
}

export function getDiasPrevios(plan: Planificacion | null): import("@/types/planning").DiaPlanning[] {
  if (!plan) return [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return plan.dias.filter((d) => {
    try {
      const fecha = new Date(d.dia);
      fecha.setHours(0, 0, 0, 0);
      return fecha < hoy;
    } catch {
      return false;
    }
  });
}

