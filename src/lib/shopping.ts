import { STORAGE_KEY } from "@/lib/planning.constants";
import { Planificacion, Ingrediente } from "@/types/planning";
import { ItemCompra, ListaCompra } from "@/types/shopping";
import { isPlanificacion } from "@/lib/planning.utils";
import { saveListaCompra } from "@/lib/shopping.storage";
import ingredientesData from "../../ingredientes.json";

// ─── Mapa de categorías ──────────────────────────────────────────────────────

const CATEGORIA_ORDEN = [
    "verdura",
    "fruta",
    "carne",
    "pescado",
    "lacteo",
    "cereal",
    "legumbre",
    "fruto_seco",
    "condimento",
    "hierba",
    "dulce",
    "bebida",
];

export const categoriaMap = new Map<string, string>();
ingredientesData.forEach((ing: any) => {
    categoriaMap.set(ing.nombre.toLowerCase().trim(), ing.categoria);
});

export class ShoppingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ShoppingError";
    }
}

export class PlanificacionNoEncontradaError extends ShoppingError {
    constructor() {
        super(
            "No se encontró ninguna planificación guardada. " +
            "Genera primero una planificación antes de crear la lista de la compra."
        );
        this.name = "PlanificacionNoEncontradaError";
    }
}

// ─── Lectura de localStorage ─────────────────────────────────────────────────

function cargarPlanificacion(): Planificacion {
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

// ─── Acumulación de ingredientes ─────────────────────────────────────────────

/**
 * Normaliza el nombre de un ingrediente para usarlo como clave de agrupación:
 * minúsculas y sin espacios extra.
 */
function claveIngrediente(nombre: string): string {
    return nombre.trim().toLowerCase();
}

function acumularIngredientes(ingredientes: Ingrediente[], acumulado: Map<string, ItemCompra>): void {
    for (const ing of ingredientes) {
        const clave = claveIngrediente(ing.nombre);
        const categoria = categoriaMap.get(clave) || "otros";
        const existente = acumulado.get(clave);

        if (existente) {
            existente.cantidad += ing.cantidad;
        } else {
            acumulado.set(clave, {
                nombre: ing.nombre.trim(),
                cantidad: ing.cantidad,
                unidad: ing.unidad,
                categoria,
            });
        }
    }
}

// ─── Generación de la lista ───────────────────────────────────────────────────

export function generarListaCompra(): ListaCompra {
    const planificacion = cargarPlanificacion();

    const acumulado = new Map<string, ItemCompra>();

    for (const dia of planificacion.dias) {
        acumularIngredientes(dia.comida.ingredientes ?? [], acumulado);
        acumularIngredientes(dia.cena.ingredientes ?? [], acumulado);
    }

    const items = Array.from(acumulado.values()).sort((a, b) => {
        const catA = CATEGORIA_ORDEN.indexOf(a.categoria || "otros");
        const catB = CATEGORIA_ORDEN.indexOf(b.categoria || "otros");
        if (catA !== catB) {
            return catA - catB;
        }
        return a.nombre.localeCompare(b.nombre, "es");
    });

    const lista: ListaCompra = {
        generado_en: new Date().toISOString(),
        planificacion_generada_en: planificacion.generado_en,
        total_items: items.length,
        items,
    };

    saveListaCompra(lista);

    return lista;
}
