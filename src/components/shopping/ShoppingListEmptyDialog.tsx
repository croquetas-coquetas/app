import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShoppingListEmptyDialogProps {
  onClose: () => void;
}

export function ShoppingListEmptyDialog({ onClose }: ShoppingListEmptyDialogProps) {
  return (
    <div className="shopping-list-empty-layer">
      <section
        className="shopping-list-empty-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="shopping-list-empty-title"
      >
        <span className="shopping-list-empty-warning" aria-hidden="true">
          <TriangleAlert className="size-7" />
        </span>
        <h2 id="shopping-list-empty-title">La lista generada está vacía</h2>
        <Button className="shopping-list-empty-button" onClick={onClose}>
          Entendido
        </Button>
      </section>
    </div>
  );
}
