import { useState } from "react";
import "./App.css";

import { CalendarView } from "@/components/planning/CalendarView";
import { DayFullscreenView } from "@/components/planning/DayFullscreenView";
import { ConfirmOverwriteState } from "@/components/planning/states/ConfirmOverwriteState";
import { EmptyState } from "@/components/planning/states/EmptyState";
import { ErrorState } from "@/components/planning/states/ErrorState";
import { LoadingState } from "@/components/planning/states/LoadingState";
import {
  extractApiError,
  fetchPlanificacionSemanal,
  parsePlanificacionResponse,
} from "@/lib/planning.api";
import { getSavedPlanificacion, savePlanificacion } from "@/lib/planning.storage";
import { AppState, DiaPlanning, MealTab, Planificacion } from "@/types/planning";
import {Button} from "@/components/ui/button.tsx";
import {generarListaCompra} from "@/lib/generarLista.ts";

function App() {
  const saved = getSavedPlanificacion();
  const [appState, setAppState] = useState<AppState>(saved ? "success" : "empty");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(saved);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);
  const [activeMealTab, setActiveMealTab] = useState<MealTab>("comida");

  const handleRequestGenerate = () => {
    const existente = getSavedPlanificacion();
    if (existente) {
      setPlanificacionExistente(existente);
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
      const res = await fetchPlanificacionSemanal();
      if (!res.ok) {
        setErrorMsg(await extractApiError(res));
        setAppState("error");
        return;
      }

      const data = await parsePlanificacionResponse(res);
      savePlanificacion(data);
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
      {appState === "empty" && <EmptyState onGenerate={() => void doGenerate()} />}

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

      {appState === "day-detail" && selectedDia && (
        <DayFullscreenView
          dia={selectedDia}
          activeTab={activeMealTab}
          onTabChange={setActiveMealTab}
          onBack={handleBackToCalendar}
        />
      )}

      <Button variant="outline" size="sm" onClick={generarListaCompra}>
        Generar lista de la compra
      </Button>

      {appState === "error" && (
        <ErrorState
          errorMsg={errorMsg}
          onBack={() => setAppState(getSavedPlanificacion() ? "success" : "empty")}
          onRetry={() => void doGenerate()}
        />
      )}



    </div>
  );
}

export default App;

