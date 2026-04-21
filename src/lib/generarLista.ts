import { acumularIngredientes, CATEGORIA_ORDEN } from "@/lib/shopping.ts";
import { ItemCompra, ListaCompra } from "@/types/shopping.ts";
import { cargarUltimaPlanificacion, saveListaCompra } from "@/lib/shopping.storage.ts";
import { normalizarUnidad } from "@/lib/planning.utils.ts";

/*
    Esta función carga la última planificación guardada, luego acumula los ingredientes de cada día 
    en un mapa para sumar cantidades de ingredientes repetidos. Después normaliza las unidades y 
    ordena los ingredientes por categoría y por nombre.
    Finalmente, crea un objeto ListaCompra con la información de los ingredientes acumulados y ordenados
    y la guarda en localStorage. Esta función devuelve el objeto ListaCompra que genera.
*/
export function generarListaCompra(): ListaCompra {
    const planificacion = cargarUltimaPlanificacion();

    const ingredientesAcumulados = new Map<string, ItemCompra>();

    for (const dia of planificacion.dias) {
        acumularIngredientes(dia.comida.ingredientes ?? [], ingredientesAcumulados);
        acumularIngredientes(dia.cena.ingredientes ?? [], ingredientesAcumulados);
    }

    const itemsAcumulados = Array.from(ingredientesAcumulados.values());

    const itemsNormalizados = itemsAcumulados.map((item) => {
        const normalizado = normalizarUnidad(item.cantidad, item.unidad);
        return { ...item, ...normalizado };
    });

    const itemsOrdenados = itemsNormalizados.sort((a, b) => {
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
        total_items: itemsOrdenados.length,
        items: itemsOrdenados,
    };

    saveListaCompra(lista);

    return lista;
}
