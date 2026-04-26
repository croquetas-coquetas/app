import { Button } from "@/components/ui/button";

interface ShoppingListMissingDialogProps {
  onGenerate: () => void;
}

export function ShoppingListMissingDialog({ onGenerate }: ShoppingListMissingDialogProps) {
  return (
    <div className="shopping-list-missing-layer">
      <section
        className="shopping-list-missing-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="shopping-list-missing-title"
      >
        <h2 id="shopping-list-missing-title">No hay lista generada</h2>
        <p>Primero debe generarse la lista de la compra.</p>
        <Button className="shopping-list-generate-button" onClick={onGenerate}>
          Generar
        </Button>
      </section>
    </div>
  );
}
