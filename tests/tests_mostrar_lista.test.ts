import { describe, it, expect } from "vitest"; // or jest

// ── Types ────────────────────────────────────────────

type ItemCompra = {
    nombre: string;
    cantidad: number;
    unidad?: string;
    comprado?: boolean;
};

type ListaCompra = {
    id: string;
    nombre: string;
    items: ItemCompra[];
};

type ShoppingItemWithKey = {
    item: ItemCompra;
    key: string;
};

// ── Helpers ──────────────────────────────────────

function formatCantidad(item: ItemCompra): string {
    const cantidad = Number.isInteger(item.cantidad)
        ? String(item.cantidad)
        : String(Number(item.cantidad.toFixed(2)));

    return item.unidad ? `${cantidad} ${item.unidad}` : cantidad;
}

function formatCheckedProgress(checkedCount: number, totalItems: number): string {
    return `${checkedCount} / ${totalItems}`;
}

function normalizeSearchText(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// Simplified stand-in for getListaCompraItemKey
function getListaCompraItemKey(item: ItemCompra): string {
    return `${item.nombre}-${item.cantidad}-${item.unidad ?? ""}`;
}

function getItemsWithKeys(lista: ListaCompra): ShoppingItemWithKey[] {
    return lista.items.map((item) => ({ item, key: getListaCompraItemKey(item) }));
}

function orderItems(
    itemsWithKeys: ShoppingItemWithKey[],
    checkedItems: Set<string>
): ShoppingItemWithKey[] {
    const checkedOrder = new Map(
        Array.from(checkedItems).map((key, index) => [key, index])
    );
    const pendingItems = itemsWithKeys.filter(({ key }) => !checkedItems.has(key));
    const boughtItems = itemsWithKeys
        .filter(({ key }) => checkedItems.has(key))
        .sort((a, b) => (checkedOrder.get(b.key) ?? 0) - (checkedOrder.get(a.key) ?? 0));

    return [...pendingItems, ...boughtItems];
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeItem = (
    nombre: string,
    cantidad: number,
    unidad?: string
): ItemCompra => ({ nombre, cantidad, unidad });

const makeListaCompra = (items: ItemCompra[]): ListaCompra => ({
    id: "lista-1",
    nombre: "Mi lista",
    items,
});

// ── formatCantidad ─────────────────────────────────────────────────────────────

describe("formatCantidad", () => {
    describe("cantidad entera sin unidad", () => {
        it("devuelve el número como string", () => {
            expect(formatCantidad(makeItem("Leche", 2))).toBe("2");
        });

        it("devuelve '1' para cantidad 1", () => {
            expect(formatCantidad(makeItem("Huevo", 1))).toBe("1");
        });

        it("devuelve '0' para cantidad 0", () => {
            expect(formatCantidad(makeItem("Sal", 0))).toBe("0");
        });

        it("maneja cantidades grandes", () => {
            expect(formatCantidad(makeItem("Arroz", 1000))).toBe("1000");
        });
    });

    describe("cantidad decimal sin unidad", () => {
        it("redondea a 2 decimales y los devuelve como string", () => {
            expect(formatCantidad(makeItem("Aceite", 1.5))).toBe("1.5");
        });

        it("elimina trailing zeros innecesarios vía Number()", () => {
            // toFixed(2) → "1.50", Number("1.50") → 1.5, String(1.5) → "1.5"
            expect(formatCantidad(makeItem("Vinagre", 1.5))).toBe("1.5");
        });

        it("redondea correctamente a 2 decimales", () => {
            expect(formatCantidad(makeItem("Harina", 0.333))).toBe("0.33");
        });

        it("redondea hacia arriba cuando corresponde", () => {
            expect(formatCantidad(makeItem("Azúcar", 1.999))).toBe("2");
        });
    });

    describe("con unidad", () => {
        it("concatena cantidad entera y unidad con espacio", () => {
            expect(formatCantidad(makeItem("Leche", 2, "L"))).toBe("2 L");
        });

        it("concatena cantidad decimal y unidad", () => {
            expect(formatCantidad(makeItem("Aceite", 0.5, "L"))).toBe("0.5 L");
        });

        it("maneja unidades con texto compuesto", () => {
            expect(formatCantidad(makeItem("Pasta", 500, "g"))).toBe("500 g");
        });
    });

    describe("sin unidad (undefined)", () => {
        it("no incluye espacio ni unidad", () => {
            const result = formatCantidad(makeItem("Tomates", 3));
            expect(result).not.toContain(" ");
        });
    });
});

// ── formatCheckedProgress ──────────────────────────────────────────────────────

describe("formatCheckedProgress", () => {
    it("formatea '0 / 0' cuando no hay ítems", () => {
        expect(formatCheckedProgress(0, 0)).toBe("0 / 0");
    });

    it("formatea '0 / 5' cuando ninguno está marcado", () => {
        expect(formatCheckedProgress(0, 5)).toBe("0 / 5");
    });

    it("formatea '3 / 5' con progreso parcial", () => {
        expect(formatCheckedProgress(3, 5)).toBe("3 / 5");
    });

    it("formatea '5 / 5' cuando todos están marcados", () => {
        expect(formatCheckedProgress(5, 5)).toBe("5 / 5");
    });

    it("el separador es ' / ' (espacios incluidos)", () => {
        const result = formatCheckedProgress(1, 4);
        expect(result).toMatch(/^\d+ \/ \d+$/);
    });

    it("maneja listas grandes", () => {
        expect(formatCheckedProgress(99, 100)).toBe("99 / 100");
    });
});

// ── normalizeSearchText ────────────────────────────────────────────────────────

describe("normalizeSearchText", () => {
    it("convierte a minúsculas", () => {
        expect(normalizeSearchText("LECHE")).toBe("leche");
    });

    it("elimina espacios al inicio y al final", () => {
        expect(normalizeSearchText("  leche  ")).toBe("leche");
    });

    it("elimina acentos (á → a, é → e, etc.)", () => {
        expect(normalizeSearchText("Ácido")).toBe("acido");
        expect(normalizeSearchText("café")).toBe("cafe");
        expect(normalizeSearchText("niño")).toBe("nino");
        expect(normalizeSearchText("Ñoño")).toBe("nono");
    });

    it("mantiene espacios internos", () => {
        expect(normalizeSearchText("aceite de oliva")).toBe("aceite de oliva");
    });

    it("devuelve string vacío para input vacío", () => {
        expect(normalizeSearchText("")).toBe("");
    });

    it("devuelve string vacío para input con solo espacios", () => {
        expect(normalizeSearchText("   ")).toBe("");
    });

    it("maneja combinación de mayúsculas, acentos y espacios", () => {
        expect(normalizeSearchText("  Ácidos Grasos  ")).toBe("acidos grasos");
    });

    it("no altera caracteres sin diacríticos", () => {
        expect(normalizeSearchText("pan")).toBe("pan");
    });
});

// ── getItemsWithKeys ───────────────────────────────────────────────────────────

describe("getItemsWithKeys", () => {
    it("devuelve array vacío si la lista no tiene ítems", () => {
        const lista = makeListaCompra([]);
        expect(getItemsWithKeys(lista)).toEqual([]);
    });

    it("preserva la referencia original del item", () => {
        const item = makeItem("Leche", 2, "L");
        const lista = makeListaCompra([item]);
        const result = getItemsWithKeys(lista);
        expect(result[0].item).toBe(item);
    });

    it("genera un key para cada ítem", () => {
        const lista = makeListaCompra([
            makeItem("Leche", 2, "L"),
            makeItem("Pan", 1),
        ]);
        const result = getItemsWithKeys(lista);
        expect(result).toHaveLength(2);
        result.forEach(({ key }) => expect(typeof key).toBe("string"));
    });

    it("los keys de ítems distintos no colisionan", () => {
        const lista = makeListaCompra([
            makeItem("Leche", 2, "L"),
            makeItem("Agua", 1, "L"),
        ]);
        const result = getItemsWithKeys(lista);
        const keys = result.map(({ key }) => key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("mantiene el orden original de la lista", () => {
        const items = [makeItem("A", 1), makeItem("B", 2), makeItem("C", 3)];
        const lista = makeListaCompra(items);
        const result = getItemsWithKeys(lista);
        result.forEach(({ item }, idx) => expect(item).toBe(items[idx]));
    });
});

// ── orderItems ─────────────────────────────────────────────────────────────────

describe("orderItems", () => {
    const itemA = makeItem("A", 1);
    const itemB = makeItem("B", 1);
    const itemC = makeItem("C", 1);

    const withKey = (item: ItemCompra): ShoppingItemWithKey => ({
        item,
        key: getListaCompraItemKey(item),
    });

    const [wkA, wkB, wkC] = [withKey(itemA), withKey(itemB), withKey(itemC)];

    it("devuelve todos los ítems si ninguno está marcado", () => {
        const result = orderItems([wkA, wkB, wkC], new Set());
        expect(result).toEqual([wkA, wkB, wkC]);
    });

    it("los ítems pendientes van antes que los comprados", () => {
        const checked = new Set([wkA.key]);
        const result = orderItems([wkA, wkB, wkC], checked);
        const names = result.map(({ item }) => item.nombre);
        expect(names.indexOf("A")).toBeGreaterThan(names.indexOf("B"));
        expect(names.indexOf("A")).toBeGreaterThan(names.indexOf("C"));
    });

    it("los ítems comprados se ordenan del más reciente al más antiguo", () => {
        // checkedItems preserva el orden de inserción (Set)
        // checkedOrder: wkA → 0, wkB → 1  (B fue marcado después)
        const checked = new Set([wkA.key, wkB.key]);
        const result = orderItems([wkA, wkB, wkC], checked);

        const boughtSection = result.filter(({ key }) => checked.has(key));
        // El más reciente (mayor índice en checkedOrder) aparece primero
        expect(boughtSection[0].key).toBe(wkB.key);
        expect(boughtSection[1].key).toBe(wkA.key);
    });

    it("devuelve lista vacía si no hay ítems", () => {
        expect(orderItems([], new Set())).toEqual([]);
    });

    it("devuelve todos como comprados si todos están marcados", () => {
        const checked = new Set([wkA.key, wkB.key, wkC.key]);
        const result = orderItems([wkA, wkB, wkC], checked);
        expect(result).toHaveLength(3);
        result.forEach(({ key }) => expect(checked.has(key)).toBe(true));
    });

    it("no muta el array original", () => {
        const original = [wkA, wkB, wkC];
        const copy = [...original];
        orderItems(original, new Set([wkA.key]));
        expect(original).toEqual(copy);
    });

    it("un key inexistente en checkedItems no afecta el orden", () => {
        const checked = new Set(["key-inexistente"]);
        const result = orderItems([wkA, wkB], checked);
        // Ninguno está en checked → todos son pendientes → orden original
        expect(result).toEqual([wkA, wkB]);
    });
});