import { useEffect, useState } from "react";
import "./App.css";

import { CalendarView } from "@/components/planning/CalendarView";
import { DayFullscreenView } from "@/components/planning/DayFullscreenView";
import { BottomNavBar } from "@/components/planning/BottomNavBar";
import { HorarioConfigFields } from "@/components/planning/HorarioConfigFields";
import { ConfirmOverwriteState } from "@/components/planning/states/ConfirmOverwriteState";
import { LandingState } from "@/components/planning/states/LandingState";
import { GenerateState } from "@/components/planning/states/GenerateState";
import { ScheduleOnboardingState } from "@/components/planning/states/ScheduleOnboardingState";
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
import { DEFAULT_HORARIOS, validateHorarios } from "@/lib/horarios";
import { AppState, DiaPlanning, HorarioField, HorariosDisponibilidad, MealTab, Planificacion } from "@/types/planning";
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
  const [horarioError, setHorarioError] = useState("");
  const [horarios, setHorarios] = useState<HorariosDisponibilidad>(DEFAULT_HORARIOS);

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

  useEffect(() => {
    const isModalOpen = successListaDialogOpen || configurarHorarioDialogOpen;
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [successListaDialogOpen, configurarHorarioDialogOpen]);

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
      setHorarioError("");
      setConfigurarHorarioDialogOpen(true);
    }
  };

  const handleLandingGetStarted = () => {
    setHorarioError("");
    setAppState("schedule-onboarding");
  };

  const closeConfigurarHorarioDialog = () => {
    setHorarioError("");
    setConfigurarHorarioDialogOpen(false);
  };

  const handleHorarioChange = (
    mealType: MealTab,
    timeType: HorarioField,
    value: string
  ) => {
    setHorarios((prev) => ({
      ...prev,
      [mealType]: {
        ...prev[mealType],
        [timeType]: value,
      },
    }));
    setHorarioError("");
  };

  const handleSaveHorarios = () => {
    const validationError = validateHorarios(horarios);
    if (validationError) {
      setHorarioError(validationError);
      return;
    }

    setHorarioError("");
    console.log("Horarios configurados:", horarios);
    closeConfigurarHorarioDialog();
  };

  const handleOnboardingGenerate = () => {
    const validationError = validateHorarios(horarios);
    if (validationError) {
      setHorarioError(validationError);
      return;
    }

    setHorarioError("");
    console.log("Horarios configurados:", horarios);
    void doGenerate();
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

  const showNavBar = !["initializing", "landing", "schedule-onboarding", "generate", "loading", "error", "confirm-overwrite"].includes(appState);
  const currentNavTab = appState === "day-detail" ? "calendar" : appState === "success" ? "calendar" : undefined;

  return (
      <div
          className={isDayDetail ? "day-view-root bg-background" : "flex min-h-screen flex-col items-center justify-center bg-background"}
          style={isDayDetail ? undefined : { padding: "1.5rem 1rem", boxSizing: "border-box" }}
      >
        {appState === "initializing" && <InitializingState />}

        {appState === "landing" && (
            <LandingState onGetStarted={handleLandingGetStarted} />
        )}

        {appState === "schedule-onboarding" && (
            <ScheduleOnboardingState
                horarios={horarios}
                errorMsg={horarioError}
                onHorarioChange={handleHorarioChange}
                onBack={() => setAppState("landing")}
                onGenerate={handleOnboardingGenerate}
            />
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
                onBack={() => setAppState(isFirstTime() ? "schedule-onboarding" : "generate")}
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
                onClick={closeConfigurarHorarioDialog}
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
                  <HorarioConfigFields horarios={horarios} onHorarioChange={handleHorarioChange} errorMsg={horarioError} />
                </div>

                {/* Footer */}
                <div className="border-t border-border px-5 py-4 flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg px-4"
                    onClick={closeConfigurarHorarioDialog}
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
