import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw, ShoppingCart } from "lucide-react";
import { MONTHS } from "@/lib/planning.constants";
import { cn } from "@/lib/utils";
import { formatFechaGenerado, getDayKey, isToday } from "@/lib/planning.utils";
import { DiaPlanning, Planificacion } from "@/types/planning";
import {generarListaCompra} from "@/lib/generarLista.ts";

interface CalendarViewProps {
  planificacion: Planificacion;
  onRegenerate: () => void;
  onDaySelect: (dia: DiaPlanning) => void;
}

export function CalendarView({ planificacion, onRegenerate, onDaySelect }: CalendarViewProps) {
  const hoy = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [listaItemsCount, setListaItemsCount] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const planMap = useMemo(() => {
    const map = new Map<string, DiaPlanning>();
    for (const dia of planificacion.dias) {
      map.set(getDayKey(dia.dia), dia);
    }
    return map;
  }, [planificacion.dias]);

  const diasDelMes = useMemo(() => {
    const cantidadDias = new Date(viewYear, viewMonth + 1, 0).getDate();
    const dias: Array<{ date: Date; key: string; planDia?: DiaPlanning }> = [];
    for (let day = 1; day <= cantidadDias; day++) {
      const date = new Date(viewYear, viewMonth, day);
      const key = getDayKey(date.toISOString());
      dias.push({date, key, planDia: planMap.get(key)});
    }
    return dias;
  }, [planMap, viewMonth, viewYear]);

  useEffect(() => {
    const container = listRef.current;
    const item = todayRef.current;
    if (!container) return;

    if (item) {
      const top = item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2;
      container.scrollTo({top: Math.max(0, top), behavior: "smooth"});
      return;
    }

    container.scrollTo({top: 0, behavior: "smooth"});
  }, [viewMonth, viewYear]);

  const prevMonth = () => {
    setViewDate((current) => {
      const prev = new Date(current);
      prev.setMonth(prev.getMonth() - 1);
      return new Date(prev.getFullYear(), prev.getMonth(), 1);
    });
  };

  const nextMonth = () => {
    setViewDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  };

  const handleGenerarLista = () => {
    try {
      const lista = generarListaCompra();
      setListaItemsCount(lista.total_items);
      setSuccessDialogOpen(true);
    } catch (err) {
      console.error("Error al generar la lista de la compra:", err);
    }
  };

  return (
      <section
          className="w-full max-w-3xl mx-auto calendar-enter rounded-2xl border border-border bg-background overflow-hidden">
        <div className="px-5 pt-7 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">SmartCook</p>
            <h2 className="text-2xl font-bold text-foreground mt-1.5 text-balance">
              Menú semanal
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generado el {formatFechaGenerado(planificacion.generado_en)}
            </p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-2 py-2">
            <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Mes anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </Button>
            <p className="text-sm font-semibold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Mes siguiente">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Button>
          </div>
        </div>

        <div ref={listRef}
             className="flex max-h-[70dvh] flex-col overflow-y-auto border-t border-border bg-background pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {diasDelMes.map(({date, key, planDia}, index) => {
            const numeroDia = date.getDate();
            const dayShort = date.toLocaleDateString("es-ES", {weekday: "short"}).replace(".", "");
            const dayName = date.toLocaleDateString("es-ES", {weekday: "long"});
            const fechaIso = date.toISOString();
            const diaActual = isToday(fechaIso);
            const tieneMenu = !!planDia;

            return (
                <button
                    key={key}
                    type="button"
                    ref={diaActual ? todayRef : null}
                    onClick={() => planDia && onDaySelect(planDia)}
                    disabled={!tieneMenu}
                    aria-label={tieneMenu ? `Ver detalle del ${dayName}` : `${dayName} sin menu asignado`}
                    className={cn(index > 0 && "border-t border-border/50")}
                >
                  <div className={cn(
                      "flex gap-4 px-5 py-4 items-stretch text-left transition-colors active:scale-[0.99]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 bg-background",
                      diaActual && "border-3",
                      !tieneMenu && "cursor-default opacity-75 hover:bg-background active:scale-100"
                  )}>

                    <div className="flex flex-col items-center justify-center w-14 shrink-0">
                      <span
                          className={cn(
                              "text-4xl font-black tabular-nums leading-none",
                              diaActual ? "text-primary" : "text-foreground/80"
                          )}
                      >
                        {numeroDia}
                      </span>
                      <span
                          className={cn(
                              "text-[9px] font-bold uppercase tracking-widest mt-1",
                              diaActual ? "text-primary" : "text-muted-foreground"
                          )}
                      >
                        {dayShort}
                      </span>
                      {diaActual && (
                          <span className="text-[9px] border border-green-600 text-green-600 px-1.5 rounded-full font-bold uppercase tracking-widest mt-1">
                            Hoy
                          </span>
                      )}
                    </div>

                    <div className={cn("w-px self-stretch rounded-full", diaActual ? "bg-primary/30" : "bg-border")}/>

                    <div className="flex flex-col gap-2.5 flex-1 justify-center min-w-0">
                      {tieneMenu && planDia ? (
                          <>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-orange-400">Comida</span>
                              <span className="text-sm font-semibold text-foreground leading-tight truncate">
                                {planDia.comida.nombre}
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-400">Cena</span>
                              <span className="text-sm font-semibold text-foreground leading-tight truncate">
                                {planDia.cena.nombre}
                              </span>
                            </div>
                          </>
                      ) : (
                          <span className="text-sm font-semibold text-muted-foreground/60">N/A</span>
                      )}

                    </div>
                  </div>
                </button>
            );
          })}
        </div>

        <div className="fixed left-1/2 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <div className="rounded-2xl border border-border/80 bg-background/95 p-2 shadow-xl backdrop-blur supports-backdrop-filter:bg-background/85">
            <div className="grid grid-cols-2 gap-2">
              <Button
                  variant="outline"
                  onClick={onRegenerate}
                  className="h-11 rounded-xl border-border/80 px-4 font-semibold"
              >
                <RotateCcw className="size-4" />
                Regenerar
              </Button>
              <Button
                  onClick={handleGenerarLista}
                  className="h-11 rounded-xl px-4 font-semibold shadow-sm"
              >
                <ShoppingCart className="size-4" />
                Generar lista
              </Button>
            </div>
          </div>
        </div>

        {successDialogOpen && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
                onClick={() => setSuccessDialogOpen(false)}
                role="presentation"
            >
              <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Lista de la compra generada"
                  className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200"
                  onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                  <CheckCircle2 className="size-5" />
                </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Lista generada correctamente</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Se han generado {listaItemsCount ?? 0} ingredientes para tu compra.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button size="sm" className="rounded-lg px-4" onClick={() => setSuccessDialogOpen(false)}>
                    Entendido
                  </Button>
                </div>
              </div>
            </div>
        )}
      </section>
  );
}
