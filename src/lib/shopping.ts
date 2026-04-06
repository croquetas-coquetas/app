import { Ingrediente } from "@/types/planning";
import { ItemCompra } from "@/types/shopping";
import ingredientesData from "../../ingredientes.json";

// ─── Mapa de categorías ──────────────────────────────────────────────────────

export const CATEGORIA_ORDEN = [
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

export class MetaNoEncontradaError extends ShoppingError {
    constructor() {
        super(
            "No se encontró la información meta de SmartCook"
        );
        this.name = "MetaNoEncontradaError";
    }
}

// ─── Acumulación de ingredientes ─────────────────────────────────────────────

/**
 * Normaliza el nombre de un ingrediente para usarlo como clave de agrupación:
 * minúsculas y sin espacios extra.
 */
function claveIngrediente(nombre: string): string {
    return nombre.trim().toLowerCase();
}

export function acumularIngredientes(ingredientes: Ingrediente[], acumulado: Map<string, ItemCompra>): void {
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