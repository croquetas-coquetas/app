import { useEffect, useState } from "react";
import "./App.css";

import { CalendarView } from "@/components/planning/CalendarView";
import { DayFullscreenView } from "@/components/planning/DayFullscreenView";
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

function App() {
  const [appState, setAppState] = useState<AppState>("initializing");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);
  const [activeMealTab, setActiveMealTab] = useState<MealTab>("comida");

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
      </div>
  );
}

export default App;
