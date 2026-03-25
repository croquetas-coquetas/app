import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onGenerate: () => void;
}

export function EmptyState({ onGenerate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-4xl">🍽️</div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">SmartCook</h1>
        <p className="text-muted-foreground max-w-xs leading-relaxed">
          Todavía no tienes ninguna planificación que mostrar. Genera tu menú semanal con un solo clic.
        </p>
      </div>
      <Button size="lg" className="px-10 py-6 text-base" onClick={onGenerate}>
        Generar planificación
      </Button>
    </div>
  );
}

