import { HorarioConfigFields } from "@/components/planning/HorarioConfigFields";
import { Button } from "@/components/ui/button";
import { HorarioField, HorariosDisponibilidad, MealTab } from "@/types/planning";
import { ArrowLeft, CalendarIcon, Sparkles } from "lucide-react";

interface ScheduleOnboardingStateProps {
  horarios: HorariosDisponibilidad;
  errorMsg: string;
  onBack: () => void;
  onGenerate: () => void;
  onHorarioChange: (mealType: MealTab, timeType: HorarioField, value: string) => void;
}

export function ScheduleOnboardingState({
  horarios,
  errorMsg,
  onBack,
  onGenerate,
  onHorarioChange,
}: ScheduleOnboardingStateProps) {
  return (
    <div className="w-full">
      <Button
        variant="outline"
        onClick={onBack}
        className="fixed left-3 top-[max(env(safe-area-inset-top),0.75rem)] z-50 mt-4 rounded-full border-border/80 bg-background/95 px-4 shadow-sm backdrop-blur"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-14 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-primary">Configura tu horario</h2>
          <p className="mt-1 text-sm text-muted-foreground">Antes de generar el plan, dinos tu disponibilidad para cocinar.</p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5 text-primary">
              <CalendarIcon className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">Rangos de cocina</h3>
              <p className="mt-1 text-xs text-muted-foreground">Podras cambiarlos mas adelante desde tu perfil.</p>
            </div>
          </div>

          <div className="space-y-6">
            <HorarioConfigFields horarios={horarios} onHorarioChange={onHorarioChange} errorMsg={errorMsg} />
          </div>
        </div>

        <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold shadow-sm" onClick={onGenerate}>
          <Sparkles className="size-4" />
          Guardar y generar planificacion
        </Button>
      </div>
    </div>
  );
}

