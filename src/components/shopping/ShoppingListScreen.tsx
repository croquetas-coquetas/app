import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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

function formatCantidad(item: ItemCompra): string {
  const cantidad = Number.isInteger(item.cantidad)
    ? String(item.cantidad)
    : String(Number(item.cantidad.toFixed(2)));

  return item.unidad ? `${cantidad} ${item.unidad}` : cantidad;
}

export function ShoppingListScreen({ lista, onBack }: ShoppingListScreenProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => getCheckedListaCompraItems(lista));

  useEffect(() => {
    setCheckedItems(getCheckedListaCompraItems(lista));
  }, [lista]);

  const currentItemKeys = useMemo(
    () => new Set(lista.items.map((item) => getListaCompraItemKey(item))),
    [lista.items]
  );

  const checkedCount = useMemo(
    () => Array.from(checkedItems).filter((key) => currentItemKeys.has(key)).length,
    [checkedItems, currentItemKeys]
  );

  const toggleItem = (item: ItemCompra) => {
    const key = getListaCompraItemKey(item);
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

  return (
    <section className="shopping-list-screen">
      <header className="shopping-list-header">
        <Button variant="ghost" size="sm" onClick={onBack} className="shopping-list-back-button">
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <div className="shopping-list-title-wrap">
          <h1 className="shopping-list-title">Lista de la compra</h1>
          <p className="shopping-list-progress">
            {checkedCount} de {lista.items.length} comprados
          </p>
        </div>
      </header>

      {lista.items.length === 0 ? (
        <p className="shopping-list-empty">No hay ingredientes en esta lista.</p>
      ) : (
        <ul className="shopping-list-items" aria-label="Ingredientes para comprar">
          {lista.items.map((item) => {
            const key = getListaCompraItemKey(item);
            const checked = checkedItems.has(key);

            return (
              <li className="shopping-list-item" key={key}>
                <label className="shopping-list-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item)}
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
