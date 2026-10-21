import { ListaCompra } from "@/types/shopping";

export function isListaCompra(data: unknown): data is ListaCompra {
    if (!data || typeof data !== "object") return false;
    return Array.isArray((data as ListaCompra).items);
}
