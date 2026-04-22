import { type ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCheckedListaCompraItems,
  getListaCompraItemKey,
  saveCheckedListaCompraItems,
} from "@/lib/shopping.storage";
import { ItemCompra, ListaCompra } from "@/types/shopping";

interface ShoppingListScreenProps {
  lista: ListaCompra;
  onBack: () => void;
}

type ShoppingItemWithKey = {
  item: ItemCompra;
  key: string;
};

type ScrollPosition = {
  left: number;
  top: number;
};

type ItemRectMap = Map<string, DOMRect>;

const ITEM_MOVE_ANIMATION_MS = 260;
const ITEM_MOVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function formatCantidad(item: ItemCompra): string {
  const cantidad = Number.isInteger(item.cantidad)
    ? String(item.cantidad)
    : String(Number(item.cantidad.toFixed(2)));

  return item.unidad ? `${cantidad} ${item.unidad}` : cantidad;
}

function formatCheckedProgress(checkedCount: number, totalItems: number): string {
  const label = checkedCount === 1 ? "ingrediente" : "ingredientes";
  return `${checkedCount} ${label} de ${totalItems} comprados`;
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getItemsWithKeys(lista: ListaCompra): ShoppingItemWithKey[] {
  return lista.items.map((item) => ({ item, key: getListaCompraItemKey(item) }));
}

function orderItems(itemsWithKeys: ShoppingItemWithKey[], checkedItems: Set<string>): ShoppingItemWithKey[] {
  const checkedOrder = new Map(Array.from(checkedItems).map((key, index) => [key, index]));
  const pendingItems = itemsWithKeys.filter(({ key }) => !checkedItems.has(key));
  const boughtItems = itemsWithKeys
    .filter(({ key }) => checkedItems.has(key))
    .sort((a, b) => (checkedOrder.get(b.key) ?? 0) - (checkedOrder.get(a.key) ?? 0));

  return [...pendingItems, ...boughtItems];
}

export function ShoppingListScreen({ lista, onBack }: ShoppingListScreenProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => getCheckedListaCompraItems(lista));
  const [searchTerm, setSearchTerm] = useState("");
  const pendingScrollRestoreRef = useRef<ScrollPosition | null>(null);
  const pendingItemRectsRef = useRef<ItemRectMap | null>(null);
  const itemElementsRef = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    const savedCheckedItems = getCheckedListaCompraItems(lista);
    setCheckedItems(savedCheckedItems);
    setSearchTerm("");
  }, [lista]);

  useLayoutEffect(() => {
    const position = pendingScrollRestoreRef.current;
    const previousRects = pendingItemRectsRef.current;

    if (position) {
      pendingScrollRestoreRef.current = null;
      window.scrollTo({ left: position.left, top: position.top, behavior: "auto" });
    }

    if (previousRects) {
      pendingItemRectsRef.current = null;
      animateMovedItems(previousRects);
    }

    if (!position || typeof window.requestAnimationFrame !== "function") return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ left: position.left, top: position.top, behavior: "auto" });
    });
  });

  const itemsWithKeys = useMemo(
    () => getItemsWithKeys(lista),
    [lista]
  );

  const currentItemKeys = useMemo(
    () => new Set(itemsWithKeys.map(({ key }) => key)),
    [itemsWithKeys]
  );

  const checkedCount = useMemo(
    () => Array.from(checkedItems).filter((key) => currentItemKeys.has(key)).length,
    [checkedItems, currentItemKeys]
  );

  const orderedItems = useMemo(() => {
    return orderItems(itemsWithKeys, checkedItems);
  }, [checkedItems, itemsWithKeys]);

  const visibleItems = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchText(searchTerm);
    if (!normalizedSearchTerm) return orderedItems;

    return orderedItems.filter(({ item }) =>
      normalizeSearchText(item.nombre).includes(normalizedSearchTerm)
    );
  }, [orderedItems, searchTerm]);

  const toggleItem = (item: ItemCompra, event: ChangeEvent<HTMLInputElement>) => {
    const key = getListaCompraItemKey(item);
    pendingItemRectsRef.current = captureItemRects();

    if (checkedItems.has(key)) {
      pendingScrollRestoreRef.current = {
        left: window.scrollX,
        top: window.scrollY,
      };
      event.currentTarget.blur();
    }

    setCheckedItems((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveCheckedListaCompraItems(lista, next);
      return next;
    });
  };

  const captureItemRects = (): ItemRectMap => {
    return new Map(
      Array.from(itemElementsRef.current.entries()).map(([key, element]) => [
        key,
        element.getBoundingClientRect(),
      ])
    );
  };

  const animateMovedItems = (previousRects: ItemRectMap) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    itemElementsRef.current.forEach((element, key) => {
      if (typeof element.animate !== "function") return;

      const previousRect = previousRects.get(key);
      if (!previousRect) return;

      const nextRect = element.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: ITEM_MOVE_ANIMATION_MS,
          easing: ITEM_MOVE_EASING,
        }
      );
    });
  };

  return (
    <section className="shopping-list-screen">
      <header className="shopping-list-header">
        <Button variant="outline" size="sm" onClick={onBack} className="shopping-list-back-button">
          ← Volver
        </Button>
        <div className="shopping-list-title-wrap">
          <h1 className="shopping-list-title">Lista de la compra</h1>
          <p className="shopping-list-progress">
            {formatCheckedProgress(checkedCount, lista.items.length)}
          </p>
        </div>
        <label className="shopping-list-search">
          <Search className="shopping-list-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar ingrediente"
            aria-label="Buscar ingrediente"
          />
        </label>
      </header>

      {lista.items.length === 0 ? (
        <p className="shopping-list-empty">No hay ingredientes en esta lista.</p>
      ) : visibleItems.length === 0 ? (
        <p className="shopping-list-empty">No hay ingredientes que coincidan.</p>
      ) : (
        <ul className="shopping-list-items" aria-label="Ingredientes para comprar">
          {visibleItems.map(({ item, key }) => {
            const checked = checkedItems.has(key);

            return (
              <li
                className="shopping-list-item"
                key={key}
                ref={(element) => {
                  if (element) {
                    itemElementsRef.current.set(key, element);
                  } else {
                    itemElementsRef.current.delete(key);
                  }
                }}
              >
                <label className="shopping-list-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleItem(item, event)}
                    aria-label={`Marcar ${item.nombre} como comprado`}
                  />
                  <span className="shopping-list-check" aria-hidden="true" />
                  <span className="shopping-list-copy">
                    <span className="shopping-list-name">{item.nombre}</span>
                    <span className="shopping-list-subtitle">{formatCantidad(item)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
