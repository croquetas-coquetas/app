import { ListaCompra } from "@/types/shopping";
//shopping.utils sólo define una utilidad para saber si un objeto es una ListaCompra válida.
export function isListaCompra(data: unknown): data is ListaCompra {
    if (!data || typeof data !== "object") return false;
    return Array.isArray((data as ListaCompra).items);
}
