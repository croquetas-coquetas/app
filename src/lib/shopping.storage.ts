import { SHOPPING_CHECKED_PREFIX, SHOPPING_KEY } from "@/lib/shopping.constants";
import { ItemCompra, ListaCompra } from "@/types/shopping";
import { isListaCompra } from "@/lib/shopping.utils";
import {STORAGE_META, STORAGE_PREFIX} from "@/lib/planning.constants.ts";
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

function normalizeItemPart(value?: string): string {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getCheckedListaCompraKey(lista: ListaCompra): string {
    return `${SHOPPING_CHECKED_PREFIX}${lista.planificacion_generada_en ?? lista.generado_en}`;
}

export function getListaCompraItemKey(item: ItemCompra): string {
    return [
        normalizeItemPart(item.nombre),
        normalizeItemPart(item.unidad),
        normalizeItemPart(item.categoria),
    ].join("|");
}

export function getCheckedListaCompraItems(lista: ListaCompra): Set<string> {
    try {
        const raw = localStorage.getItem(getCheckedListaCompraKey(lista));
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
        return new Set();
    }
}

export function saveCheckedListaCompraItems(lista: ListaCompra, checkedItems: Set<string>): void {
    localStorage.setItem(getCheckedListaCompraKey(lista), JSON.stringify(Array.from(checkedItems)));
}


// ─── Lectura de localStorage ─────────────────────────────────────────────────

export function cargarPlanificacion(): Planificacion {
    // lee cuantos dias hay en total para escoger los 7 ultimos
    const meta = localStorage.getItem(STORAGE_META);
    if(!meta) {
        throw new MetaNoEncontradaError();
    }
    const meta_parsed:PlanMeta = JSON.parse(meta);
    const num_dias = meta_parsed.total_dias;

    // planificacion vacia donde se van a meter los dias parseados
    const planificacion: Planificacion = { generado_en: meta_parsed.generado_en, dias: [] };

    // por cada dia parsear y meter en el objeto planificacion
    for (let i = Math.max(0, num_dias - 7); i < num_dias; i++) {
        // clave del dia
        const dia:string = `${STORAGE_PREFIX}dia_${i}`;

        const dia_raw = localStorage.getItem(dia);
        if (!dia_raw) {
            throw new PlanificacionNoEncontradaError();
        }

        const dia_parsed:DiaPlanning = JSON.parse(dia_raw);
        planificacion.dias.push(dia_parsed);
    }

    if (!isPlanificacion(planificacion)) {
        throw new ShoppingError(
            "Los datos guardados no tienen el formato esperado de planificación."
        );
    }

    return planificacion;
}
