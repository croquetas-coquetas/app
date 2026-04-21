import { Ingrediente } from "@/types/planning";
import { ItemCompra } from "@/types/shopping";
import ingredientesData from "../../server/datasets/ingredientes.json";
import { convertirIngredienteUnidad } from "@/lib/planning.utils";

// ─── Mapa de categorías ───────────────────────────────────────────────────────────────────────
//define el orden de las categorías en que se ordenarán los ingredientes de la lista de la compra
export const CATEGORIA_ORDEN = [
    "verdura",
    "lácteo",
    "cereal",
    "legumbre",
    "fruto seco",
    "pescado",
    "huevo",
    "carne"
];

export const categoriaMap = new Map<string, string>();
ingredientesData.forEach((ing: any) => {
    categoriaMap.set(ing.nombre.toLowerCase().trim(), ing.categoria);
});

// ─── Errores de la lista de la compra ───────────────────────────────────────────────────────────────────────
//se definen varios errores específicos relacionados con la generación de la lista de la compra para poder 
// manejarlos mejor en la UI y dar mensajes de error más claros al usuario. Todos heredan de ShoppingError para 
// poder distinguirlos de otros tipos de errores.  

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

/*
    Normaliza el nombre de un ingrediente para usarlo como clave de agrupación:
    minúsculas y sin espacios extra.
*/
function claveIngrediente(nombre: string): string {
    return nombre.trim().toLowerCase();
}

/*
    Acumula ingredientes en un mapa para sumar cantidades de ingredientes repetidos.
*/
export function acumularIngredientes(ingredientes: Ingrediente[], acumulado: Map<string, ItemCompra>): void {
    for (const ing of ingredientes) {
        const ingredienteConvertido = convertirIngredienteUnidad(ing);
        const clave = claveIngrediente(ingredienteConvertido.nombre);
        const categoria = categoriaMap.get(clave) || "otros";
        const existente = acumulado.get(clave);

        if (existente) {
            existente.cantidad += ingredienteConvertido.cantidad;
        } else {
            acumulado.set(clave, {
                nombre: ingredienteConvertido.nombre.trim(),
                cantidad: ingredienteConvertido.cantidad,
                unidad: ingredienteConvertido.unidad,
                categoria,
            });
        }
    }
}