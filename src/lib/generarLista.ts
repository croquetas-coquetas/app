import {acumularIngredientes, CATEGORIA_ORDEN} from "@/lib/shopping.ts";
import {ItemCompra, ListaCompra} from "@/types/shopping.ts";
import {cargarPlanificacion, saveListaCompra} from "@/lib/shopping.storage.ts";
import {normalizarUnidad} from "@/lib/planning.utils.ts";

export function generarListaCompra(): ListaCompra {
    const planificacion = cargarPlanificacion();

    const acumulado = new Map<string, ItemCompra>();

    for (const dia of planificacion.dias) {
        acumularIngredientes(dia.comida.ingredientes ?? [], acumulado);
        acumularIngredientes(dia.cena.ingredientes ?? [], acumulado);
    }

    const items = Array.from(acumulado.values())
        .map(item => {
            const normalizado = normalizarUnidad(item.cantidad, item.unidad);
            return { ...item, ...normalizado };
        })
        .sort((a, b) => {
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

    console.log(items.length);

    saveListaCompra(lista);

    return lista;
}
