import {Planification} from "@/types/api.ts";

export async function fetchPlanification(): Promise<Planification> {
    const res = await fetch("http://localhost:8080/api/planification/")
    if (!res.ok)
        throw new Error("Error al obtener la planificación: " + res.statusText);

    return res.json();
}