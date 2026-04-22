import { useEffect, useState } from "react";
import "./App.css";

import { CalendarView } from "@/components/planning/CalendarView";
import { DayFullscreenView } from "@/components/planning/DayFullscreenView";
import { BottomNavBar } from "@/components/planning/BottomNavBar";
import { ConfirmOverwriteState } from "@/components/planning/states/ConfirmOverwriteState";
import { LandingState } from "@/components/planning/states/LandingState";
import { GenerateState } from "@/components/planning/states/GenerateState";
import { ErrorState } from "@/components/planning/states/ErrorState";
import { LoadingState } from "@/components/planning/states/LoadingState";
import { InitializingState } from "@/components/planning/states/InitializingState";
import { NoPlanGeneratedState } from "@/components/planning/states/NoPlanGeneratedState";
import {
  extractApiError,
  fetchPlanificacionSemanal,
  parsePlanificacionResponse,
} from "@/lib/planning.api";
import {
  cargarPlanificacion,
  getPlanificacionHoy,
  migrateLegacyStorage,
  savePlanificacion,
  isFirstTime,
  markAsNotFirstTime,
} from "@/lib/planning.storage";
import { getDiasPrevios } from "@/lib/planning.utils";
import { AppState, DiaPlanning, MealTab, Planificacion } from "@/types/planning";
import { generarListaCompra } from "@/lib/generarLista";
import {CalendarIcon, CheckCircle2} from "lucide-react";
import { Button } from "@/components/ui/button";

function App() {
  const [appState, setAppState] = useState<AppState>("initializing");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);
  const [activeMealTab, setActiveMealTab] = useState<MealTab>("comida");
  const [listaItemsCount, setListaItemsCount] = useState<number | null>(null);

  const [successListaDialogOpen, setSuccessListaDialogOpen] = useState(false);
  const [configurarHorarioDialogOpen, setConfigurarHorarioDialogOpen] = useState(false);
  const [horarios, setHorarios] = useState({
    comida: { inicio: "13:00", fin: "14:30" },
    cena: { inicio: "20:00", fin: "21:00" },
  });

  useEffect(() => {
    migrateLegacyStorage();

    const initTimer = setTimeout(() => {
      const isFirst = isFirstTime();
      const savedPlan = cargarPlanificacion();

      if (isFirst) {
        // Primera vez mostrar landing
        setAppState("landing");
      } else {
        // No es primera vez marcar como no primera vez (ya lo está)
        if (savedPlan) {
          setPlanificacion(savedPlan);
          setAppState("success");
        } else {
          // No hay planificación mostrar calendario con popup
          setAppState("no-plan-generated");
        }
      }
    }, 500);

    return () => clearTimeout(initTimer);
  }, []);

  const handleRequestGenerate = () => {
    const hoy = getPlanificacionHoy();
    if (hoy) {
      setPlanificacionExistente(hoy);
      setAppState("confirm-overwrite");
    } else {
      void doGenerate();
    }
  };

  const handleDaySelect = (dia: DiaPlanning) => {
    setSelectedDia(dia);
    setActiveMealTab("comida");
    setAppState("day-detail");
  };

  const handleBackToCalendar = () => {
    setAppState("success");
  };

  const handleGenerarLista = () => {
    try {
      const lista = generarListaCompra();
      setListaItemsCount(lista.total_items);
      setSuccessListaDialogOpen(true);
    } catch (err) {
      console.error("Error al generar la lista de la compra:", err);
    }
  };

  const handleNavBarProfileClick = (action: "mi-perfil" | "configurar-horario") => {
    if (action === "configurar-horario") {
      setConfigurarHorarioDialogOpen(true);
    }
  };

  const handleHorarioChange = (
    mealType: "comida" | "cena",
    timeType: "inicio" | "fin",
    value: string
  ) => {
    setHorarios((prev) => ({
      ...prev,
      [mealType]: {
        ...prev[mealType],
        [timeType]: value,
      },
    }));
  };

  const handleSaveHorarios = () => {
    console.log("Horarios configurados:", horarios);
    setConfigurarHorarioDialogOpen(false);
  };

  const doGenerate = async () => {
    setAppState("loading");
    try {
      const saved = cargarPlanificacion();
      const previos = getDiasPrevios(saved);
      const res = await fetchPlanificacionSemanal(previos.length > 0 ? previos : undefined);
      if (!res.ok) {
        setErrorMsg(await extractApiError(res));
        setAppState("error");
        return;
      }

      const data = await parsePlanificacionResponse(res);
      savePlanificacion(data);
      markAsNotFirstTime();
      setPlanificacion(data);
      setSelectedDia(null);
      setAppState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`No se pudo conectar con el servidor: ${msg}`);
      setAppState("error");
    }
  };

  const isDayDetail = appState === "day-detail" && selectedDia;

  const calendarViewProps = {
    planificacion: planificacion as Planificacion,
    onRegenerate: handleRequestGenerate,
    onDaySelect: handleDaySelect,
  };

  const showNavBar = !["initializing", "landing", "generate", "loading", "error", "confirm-overwrite"].includes(appState);
  const currentNavTab = appState === "day-detail" ? "calendar" : appState === "success" ? "calendar" : undefined;

  return (
      <div
          className={isDayDetail ? "day-view-root bg-background" : "flex min-h-screen flex-col items-center justify-center bg-background"}
          style={isDayDetail ? undefined : { padding: "1.5rem 1rem", boxSizing: "border-box" }}
      >
        {appState === "initializing" && <InitializingState />}

        {appState === "landing" && (
            <LandingState onGetStarted={() => setAppState("generate")} />
        )}

        {appState === "generate" && (
            <GenerateState
                onGenerate={handleRequestGenerate}
                onBack={() => setAppState("landing")}
            />
        )}

        {appState === "confirm-overwrite" && planificacionExistente && (
            <ConfirmOverwriteState
                planificacionExistente={planificacionExistente}
                onShowExisting={() => {
                  setPlanificacion(planificacionExistente);
                  setAppState("success");
                }}
                onGenerateNew={() => void doGenerate()}
            />
        )}

        {appState === "loading" && <LoadingState />}

        {appState === "success" && planificacion && (
            <div
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full"
                style={{ maxWidth: "100%", boxSizing: "border-box" }}
            >
              <CalendarView {...calendarViewProps} />
            </div>
        )}

        {appState === "no-plan-generated" && (
            <NoPlanGeneratedState
                planificacion={planificacion || { dias: [] }}
                onGenerate={handleRequestGenerate}
                onDaySelect={handleDaySelect}
            />
        )}

        {appState === "day-detail" && selectedDia && (
            <DayFullscreenView
                dia={selectedDia}
                activeTab={activeMealTab}
                onTabChange={setActiveMealTab}
                onBack={handleBackToCalendar}
            />
        )}

        {appState === "error" && (
            <ErrorState
                errorMsg={errorMsg}
                onBack={() => setAppState("generate")}
                onRetry={() => void doGenerate()}
            />
        )}

        {/* Bottom Navigation Bar */}
        {showNavBar && (
            <BottomNavBar
                onCalendarClick={() => setAppState("success")}
                onShoppingListClick={handleGenerarLista}
                onProfileClick={handleNavBarProfileClick}
                activeTab={currentNavTab}
            />
        )}

        {/* Success Lista Dialog */}
        {successListaDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setSuccessListaDialogOpen(false)}
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
                <Button size="sm" className="rounded-lg px-4" onClick={() => setSuccessListaDialogOpen(false)}>
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Configurar horarios dialog */}
        {configurarHorarioDialogOpen && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
                onClick={() => setConfigurarHorarioDialogOpen(false)}
                role="presentation"
            >
              <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Configurar mi horario"
                  className="w-full sm:max-w-sm rounded-2xl sm:rounded-2xl border border-border bg-background shadow-xl animate-in fade-in zoom-in-95 duration-200"
                  onClick={(event) => event.stopPropagation()}
              >
                {/* Header */}
                <div className="border-b border-border px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary shrink-0">
                      <CalendarIcon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Configurar mi horario</h3>
                      <p className="text-xs text-muted-foreground mt-1">Define tu disponibilidad para cocinar</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-5 py-6 space-y-6">
                  {/* Comida */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Comida</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-2">De</label>
                        <input
                          type="time"
                          value={horarios.comida.inicio}
                          onChange={(e) => handleHorarioChange("comida", "inicio", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-2">Hasta</label>
                        <input
                          type="time"
                          value={horarios.comida.fin}
                          onChange={(e) => handleHorarioChange("comida", "fin", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cena */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Cena</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-2">De</label>
                        <input
                          type="time"
                          value={horarios.cena.inicio}
                          onChange={(e) => handleHorarioChange("cena", "inicio", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-2">Hasta</label>
                        <input
                          type="time"
                          value={horarios.cena.fin}
                          onChange={(e) => handleHorarioChange("cena", "fin", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border px-5 py-4 flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg px-4"
                    onClick={() => setConfigurarHorarioDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-lg px-4"
                    onClick={handleSaveHorarios}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

export default App;
