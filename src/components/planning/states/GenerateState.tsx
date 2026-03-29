import { Button } from "@/components/ui/button";

interface GenerateStateProps {
  onGenerate: () => void;
  onBack: () => void;
}

export function GenerateState({ onGenerate, onBack }: GenerateStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-primary">Generar planificación</h2>
        <p className="text-muted-foreground max-w-xs leading-relaxed">
          Se generará un menú semanal personalizado. Si ya tienes días pasados, se reutilizarán automáticamente.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          ← Volver
        </Button>
        <Button size="lg" className="px-8 py-6 text-base" onClick={onGenerate}>
          Generar planificación
        </Button>
      </div>
    </div>
  );
}
