import { CalendarView } from "@/components/planning/CalendarView";
import { Button } from "@/components/ui/button";
import { DiaPlanning, Planificacion } from "@/types/planning";

interface NoPlanGeneratedStateProps {
  planificacion: Planificacion;
  onGenerate: () => void;
  onDaySelect: (dia: DiaPlanning) => void;
}

export function NoPlanGeneratedState({
  planificacion,
  onGenerate,
  onDaySelect,
}: NoPlanGeneratedStateProps) {
  return (
    <>
      <div className="w-full">
        <CalendarView
          planificacion={planificacion}
          onRegenerate={onGenerate}
          onDaySelect={onDaySelect}
        />
      </div>

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl">📅</div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                No hay semana generada
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Parece que no tienes una planificación generada para la semana actual.
                Genera una nueva para comenzar a planificar tus comidas.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              onClick={onGenerate}
              size="lg"
              className="w-full"
            >
              Generar planificación
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}



