import { HorarioField, HorariosDisponibilidad, MealTab } from "@/types/planning";

interface HorarioConfigFieldsProps {
  horarios: HorariosDisponibilidad;
  onHorarioChange: (mealType: MealTab, timeType: HorarioField, value: string) => void;
  errorMsg?: string;
}

export function HorarioConfigFields({ horarios, onHorarioChange, errorMsg }: HorarioConfigFieldsProps) {
  return (
    <>
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">Comida</h4>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-2 block text-xs text-muted-foreground">De</label>
            <input
              type="time"
              value={horarios.comida.inicio}
              onChange={(event) => onHorarioChange("comida", "inicio", event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-xs text-muted-foreground">Hasta</label>
            <input
              type="time"
              value={horarios.comida.fin}
              onChange={(event) => onHorarioChange("comida", "fin", event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">Cena</h4>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-2 block text-xs text-muted-foreground">De</label>
            <input
              type="time"
              value={horarios.cena.inicio}
              onChange={(event) => onHorarioChange("cena", "inicio", event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-xs text-muted-foreground">Hasta</label>
            <input
              type="time"
              value={horarios.cena.fin}
              onChange={(event) => onHorarioChange("cena", "fin", event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {errorMsg}
        </div>
      )}
    </>
  );
}

