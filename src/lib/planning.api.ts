import { API_URL } from "@/lib/planning.constants";
import { Planificacion, DiaPlanning } from "@/types/planning";

function cleanDiaPlanning(dia: DiaPlanning): DiaPlanning {
  return {
    dia: dia.dia,
    comida: {
      nombre: dia.comida.nombre,
      grupo_principal: dia.comida.grupo_principal,
      duracion: dia.comida.duracion,
      ingredientes: dia.comida.ingredientes,
      pasos: dia.comida.pasos,
      tags: dia.comida.tags,
    },
    cena: {
      nombre: dia.cena.nombre,
      grupo_principal: dia.cena.grupo_principal,
      duracion: dia.cena.duracion,
      ingredientes: dia.cena.ingredientes,
      pasos: dia.cena.pasos,
      tags: dia.cena.tags,
    },
  };
}

export async function fetchPlanificacionSemanal(diasPrevios?: DiaPlanning[] | null) {
  if (!diasPrevios || !Array.isArray(diasPrevios) || diasPrevios.length === 0) {
    // Nueva planificación: GET sin argumentos
    return fetch(API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  // Regenerar planificación: POST con días previos limpios
  const diasLimpios = diasPrevios.map(cleanDiaPlanning);
  return fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dias_previos: diasLimpios }),
  });
}

export async function extractApiError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  return typeof body.error === "string" ? body.error : `Error ${res.status}`;
}

export async function parsePlanificacionResponse(res: Response): Promise<Planificacion> {
  return (await res.json()) as Planificacion;
}

