import { describe, it, expect, beforeEach} from "vitest"; // or jest

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
        expect(result).toEqual([wkA, wkB]);
    });
});



// ──────── Pruebas Integracion ────────

const storageMap = new Map<string, Set<string>>();

function getCheckedListaCompraItems(lista: ListaCompra): Set<string> {
    return new Set(storageMap.get(lista.id) ?? []);
}

function saveCheckedListaCompraItems(lista: ListaCompra, checked: Set<string>): void {
    storageMap.set(lista.id, new Set(checked));
}

// ── Helpers de test ──────────────────────────────────────────────────────────

const makeLista = (items: ItemCompra[], id = "lista-1"): ListaCompra => ({
    id,
    nombre: "Mi lista",
    items,
});


function toggleItem(
    lista: ListaCompra,
    item: ItemCompra,
    current: Set<string>
): Set<string> {
    const key = getListaCompraItemKey(item);
    const next = new Set(current);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }
    saveCheckedListaCompraItems(lista, next);
    return next;
}


function buildVisibleItems(
    lista: ListaCompra,
    checkedItems: Set<string>,
    searchTerm: string
): ShoppingItemWithKey[] {
    const itemsWithKeys = getItemsWithKeys(lista);
    const ordered = orderItems(itemsWithKeys, checkedItems);
    const normalized = normalizeSearchText(searchTerm);
    if (!normalized) return ordered;
    return ordered.filter(({ item }) =>
        normalizeSearchText(item.nombre).includes(normalized)
    );
}


function buildCheckedCount(lista: ListaCompra, checkedItems: Set<string>): number {
    const currentKeys = new Set(getItemsWithKeys(lista).map(({ key }) => key));
    return Array.from(checkedItems).filter((k) => currentKeys.has(k)).length;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    storageMap.clear();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Actualiza orden y progreso", () => {

    it("marcar un ítem lo desplaza al final de la lista visible", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1), makeItem("Huevos", 6)];
        const lista = makeLista(items);
        let checked = getCheckedListaCompraItems(lista);

        checked = toggleItem(lista, items[0], checked); // marcar Leche

        const visible = buildVisibleItems(lista, checked, "");
        const nombres = visible.map(({ item }) => item.nombre);

        expect(nombres.indexOf("Leche")).toBeGreaterThan(nombres.indexOf("Pan"));
        expect(nombres.indexOf("Leche")).toBeGreaterThan(nombres.indexOf("Huevos"));
    });

    it("el progreso incrementa en 1 al marcar un ítem", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1)];
        const lista = makeLista(items);
        let checked = getCheckedListaCompraItems(lista);

        const progressBefore = buildCheckedCount(lista, checked);
        checked = toggleItem(lista, items[0], checked);
        const progressAfter = buildCheckedCount(lista, checked);

        expect(progressAfter).toBe(progressBefore + 1);
    });

    it("el progreso decrementa al desmarcar un ítem", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1)];
        const lista = makeLista(items);
        let checked = getCheckedListaCompraItems(lista);

        checked = toggleItem(lista, items[0], checked); // marcar
        const progressMarked = buildCheckedCount(lista, checked);

        checked = toggleItem(lista, items[0], checked);
        const progressUnmarked = buildCheckedCount(lista, checked);

        expect(progressUnmarked).toBe(progressMarked - 1);
    });

    it("marcar varios ítems los ordena del más reciente al más antiguo", () => {
        const items = [makeItem("A", 1), makeItem("B", 1), makeItem("C", 1)];
        const lista = makeLista(items);
        let checked = new Set<string>();

        checked = toggleItem(lista, items[0], checked);
        checked = toggleItem(lista, items[1], checked);
        checked = toggleItem(lista, items[2], checked);

        const visible = buildVisibleItems(lista, checked, "");
        const comprados = visible.map(({ item }) => item.nombre);

        expect(comprados[0]).toBe("C");
        expect(comprados[1]).toBe("B");
        expect(comprados[2]).toBe("A");
    });

    it("desmarcar un ítem lo devuelve a la sección de pendientes", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1)];
        const lista = makeLista(items);
        let checked = new Set<string>();

        checked = toggleItem(lista, items[0], checked);
        checked = toggleItem(lista, items[0], checked);

        const visible = buildVisibleItems(lista, checked, "");
        const panIdx = visible.findIndex(({ item }) => item.nombre === "Pan");
        const lecheIdx = visible.findIndex(({ item }) => item.nombre === "Leche");

        expect(lecheIdx).toBeLessThan(panIdx);
    });

    it("formatCheckedProgress refleja el estado real tras varios toggles", () => {
        const items = [
            makeItem("A", 1),
            makeItem("B", 1),
            makeItem("C", 1),
            makeItem("D", 1),
        ];
        const lista = makeLista(items);
        let checked = new Set<string>();

        checked = toggleItem(lista, items[0], checked);
        checked = toggleItem(lista, items[2], checked);

        const count = buildCheckedCount(lista, checked);
        expect(formatCheckedProgress(count, lista.items.length)).toBe("2 / 4");
    });
});


describe("Busqueda", () => {

    it("la búsqueda por nombre exacto devuelve sólo ese ítem", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1), makeItem("Aceite", 1)];
        const lista = makeLista(items);
        const checked = new Set<string>();

        const visible = buildVisibleItems(lista, checked, "Pan");
        expect(visible).toHaveLength(1);
        expect(visible[0].item.nombre).toBe("Pan");
    });

    it("la búsqueda es insensible a acentos (Ácido → acido)", () => {
        const items = [makeItem("Ácido ascórbico", 1), makeItem("Pan", 1)];
        const lista = makeLista(items);

        const visible = buildVisibleItems(lista, new Set(), "acido");
        expect(visible).toHaveLength(1);
        expect(visible[0].item.nombre).toBe("Ácido ascórbico");
    });

    it("la búsqueda sin coincidencias devuelve lista vacía", () => {
        const items = [makeItem("Leche", 2), makeItem("Pan", 1)];
        const lista = makeLista(items);

        const visible = buildVisibleItems(lista, new Set(), "Tomate");
        expect(visible).toHaveLength(0);
    });

    it("los ítems comprados que coinciden con la búsqueda aparecen después de los pendientes", () => {
        const items = [
            makeItem("Aceite de oliva", 1),
            makeItem("Aceite de girasol", 1),
        ];
        const lista = makeLista(items);
        let checked = new Set<string>();
        checked = toggleItem(lista, items[0], checked); // marcar Aceite de oliva

        const visible = buildVisibleItems(lista, checked, "aceite");
        expect(visible).toHaveLength(2);
        expect(visible[0].item.nombre).toBe("Aceite de girasol");
        expect(visible[1].item.nombre).toBe("Aceite de oliva");
    });

    it("la búsqueda parcial devuelve todos los ítems que contienen el término", () => {
        const items = [
            makeItem("Tomate frito", 1),
            makeItem("Tomate natural", 2),
            makeItem("Pan", 1),
        ];
        const lista = makeLista(items);

        const visible = buildVisibleItems(lista, new Set(), "tomate");
        expect(visible).toHaveLength(2);
    });
});
