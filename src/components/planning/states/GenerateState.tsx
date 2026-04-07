import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

interface GenerateStateProps {
  onGenerate: () => void;
  onBack: () => void;
}

export function GenerateState({ onGenerate, onBack }: GenerateStateProps) {
  return (
    <div className="w-full">
      <Button
        variant="outline"
        onClick={onBack}
        className="fixed left-3 top-[max(env(safe-area-inset-top),0.75rem)] z-50 rounded-full border-border/80 bg-background/95 px-4 shadow-sm backdrop-blur mt-4"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>

      <div className="flex flex-col items-center gap-6 pt-14 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-primary">Generar planificación</h2>
          <p className="text-muted-foreground max-w-xs leading-relaxed">
            Se generará un menú semanal personalizado o si ya tienes días pasados puedes visualizarlos.
          </p>
        </div>
        <Button size="lg" className="h-12 w-full max-w-xs rounded-xl px-8 text-base font-semibold shadow-sm" onClick={onGenerate}>
          <Sparkles className="size-4" />
          Generar planificación
        </Button>
      </div>
    </div>
  );
}
