import { API_URL } from "@/lib/planning.constants";
import { Planificacion } from "@/types/planning";

export async function fetchPlanificacionSemanal() {
  return fetch(API_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}

export async function extractApiError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  return typeof body.error === "string" ? body.error : `Error ${res.status}`;
}

export async function parsePlanificacionResponse(res: Response): Promise<Planificacion> {
  return (await res.json()) as Planificacion;
}

