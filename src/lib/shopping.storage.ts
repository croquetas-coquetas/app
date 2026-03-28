import { SHOPPING_KEY } from "@/lib/shopping.constants";
import { ListaCompra } from "@/types/shopping";
import { isListaCompra } from "@/lib/shopping.utils";

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