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
import { ShoppingListMissingDialog } from "@/components/shopping/ShoppingListMissingDialog";
import { ShoppingListScreen } from "@/components/shopping/ShoppingListScreen";
import { generarListaCompra } from "@/lib/generarLista";
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
import { getSavedListaCompra } from "@/lib/shopping.storage";
import { AppState, DiaPlanning, MealTab, Planificacion } from "@/types/planning";
import { ListaCompra } from "@/types/shopping";

function App() {
  const [appState, setAppState] = useState<AppState>("initializing");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);
  const [activeMealTab, setActiveMealTab] = useState<MealTab>("comida");
  const [shoppingList, setShoppingList] = useState<ListaCompra | null>(null);
  const [shoppingListMissingOpen, setShoppingListMissingOpen] = useState(false);

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
    setShoppingListMissingOpen(false);
    const hoy = getPlanificacionHoy();
    if (hoy) {
      setPlanificacionExistente(hoy);
      setAppState("confirm-overwrite");
    } else {
      void doGenerate();
    }
  };

  const handleDaySelect = (dia: DiaPlanning) => {
    setShoppingListMissingOpen(false);
    setSelectedDia(dia);
    setActiveMealTab("comida");
    setAppState("day-detail");
  };

  const handleBackToCalendar = () => {
    setShoppingListMissingOpen(false);
    setAppState("success");
  };

  const isListaCompraForCurrentPlan = (lista: ListaCompra | null): lista is ListaCompra => {
    return Boolean(
      lista &&
      planificacion?.generado_en &&
      lista.planificacion_generada_en === planificacion.generado_en
    );
  };

  const handleShoppingListOpen = () => {
    if (!planificacion) return;

    const saved = getSavedListaCompra();
    if (isListaCompraForCurrentPlan(saved)) {
      if (saved.items.length === 0) {
        window.alert("La lista de la compra está vacía");
        setShoppingList(null);
        setShoppingListMissingOpen(false);
        return;
      }

      setShoppingList(saved);
      setShoppingListMissingOpen(false);
      setAppState("shopping-list");
      return;
    }

    setShoppingList(null);
    setShoppingListMissingOpen(true);
  };

  const handleShoppingListGenerate = () => {
    if (!planificacion) return;

    try {
      generarListaCompra();
      const saved = getSavedListaCompra();
      if (!isListaCompraForCurrentPlan(saved)) {
        throw new Error("No se pudo recuperar una lista de la compra valida para la planificacion actual.");
      }

      setShoppingList(saved);
      setShoppingListMissingOpen(false);
      setAppState("shopping-list");
    } catch (err) {
      console.error("Error al generar la lista de la compra:", err);
    }
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
    onShoppingListOpen: handleShoppingListOpen,
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

        {appState === "success" && shoppingListMissingOpen && (
            <ShoppingListMissingDialog onGenerate={handleShoppingListGenerate} />
        )}

        {appState === "shopping-list" && shoppingList && (
            <ShoppingListScreen
                lista={shoppingList}
                onBack={handleBackToCalendar}
            />
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
