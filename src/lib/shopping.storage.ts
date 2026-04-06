import { SHOPPING_KEY } from "@/lib/shopping.constants";
import { ListaCompra } from "@/types/shopping";
import { isListaCompra } from "@/lib/shopping.utils";
import {STORAGE_META} from "@/lib/planning.constants.ts";
import {DiaPlanning, Planificacion, PlanMeta} from "@/types/planning.ts";
import {PlanificacionNoEncontradaError, ShoppingError, MetaNoEncontradaError} from "@/lib/shopping.ts";
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
    // lee cuantos dias hay en total para escoger los 7 ultimos
    const meta = localStorage.getItem(STORAGE_META);
    if(!meta) {
        throw new MetaNoEncontradaError();
    }
    const meta_parsed:PlanMeta = JSON.parse(meta);
    let num_dias = meta_parsed.total_dias;

    // planificacion vacia donde se van a meter los dias parseados
    let planificacion: Planificacion = { generado_en: meta_parsed.generado_en, dias: [] };

    // por cada dia parsear y meter en el objeto planificacion
    for (let i = num_dias - 7; i < num_dias; i++) {
        // clave del dia
        let dia:string = "smartcook_plan_dia_" + i;

        const dia_raw = localStorage.getItem(dia);
        if (!dia_raw) {
            throw new PlanificacionNoEncontradaError();
        }

        let dia_parsed:DiaPlanning = JSON.parse(dia_raw);
        planificacion.dias.push(dia_parsed);
    }

    if (!isPlanificacion(planificacion)) {
        throw new ShoppingError(
            "Los datos guardados no tienen el formato esperado de planificación."
        );
    }

    return planificacion;
}