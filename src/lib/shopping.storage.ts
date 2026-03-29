import { SHOPPING_KEY } from "@/lib/shopping.constants";
import { ListaCompra } from "@/types/shopping";
import { isListaCompra } from "@/lib/shopping.utils";
import {STORAGE_KEY} from "@/lib/planning.constants.ts";
import {Planificacion} from "@/types/planning.ts";
import {PlanificacionNoEncontradaError, ShoppingError} from "@/lib/shopping.ts";
import {isPlanificacion} from "@/lib/planning.utils.ts";

export function getSavedListaCompra(): ListaCompra | null {
    try {
        const raw = localStorage.getItem(SHOPPING_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isListaCompra(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function saveListaCompra(lista: ListaCompra): void {
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(lista));
}

export function clearListaCompra(): void {
    localStorage.removeItem(SHOPPING_KEY);
}


// ─── Lectura de localStorage ─────────────────────────────────────────────────

export function cargarPlanificacion(): Planificacion {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
        throw new PlanificacionNoEncontradaError();
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new ShoppingError(
            "La planificación guardada está corrupta y no se pudo leer."
        );
    }

    if (!isPlanificacion(parsed)) {
        throw new ShoppingError(
            "Los datos guardados no tienen el formato esperado de planificación."
        );
    }

    return parsed;
}