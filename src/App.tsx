import { useEffect, useState } from "react";
import "./App.css";

<<<<<<< HEAD
import { CalendarView } from "@/components/planning/CalendarView";
import { DayFullscreenView } from "@/components/planning/DayFullscreenView";
import { ConfirmOverwriteState } from "@/components/planning/states/ConfirmOverwriteState";
import { LandingState } from "@/components/planning/states/LandingState";
import { GenerateState } from "@/components/planning/states/GenerateState";
import { ErrorState } from "@/components/planning/states/ErrorState";
import { LoadingState } from "@/components/planning/states/LoadingState";
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
} from "@/lib/planning.storage";
import { getDiasPrevios } from "@/lib/planning.utils";
import { AppState, DiaPlanning, MealTab, Planificacion } from "@/types/planning";
=======
const STORAGE_PREFIX = "smartcook_plan_";
const STORAGE_META = `${STORAGE_PREFIX}meta`;
const API_URL = "https://appapi-ej7h.onrender.com/api/planificacion/semanal/";

type AppState = "landing" | "generate" | "confirm-overwrite" | "loading" | "success" | "error";

interface Receta {
  nombre?: string;
  name?: string;
  titulo?: string;
  [key: string]: unknown;
}

interface DiaPlanning {
  dia: string;
  comida: Receta;
  cena: Receta;
}

interface PlanMeta {
  generado_en?: string;
  fuente_datos?: string;
  total_recetas_disponibles?: number;
  total_dias: number;
}

interface Planificacion {
  generado_en?: string;
  dias: DiaPlanning[];
}

function nombreReceta(r: Receta) {
  return r?.nombre ?? r?.name ?? r?.titulo ?? "—";
}

function formatFecha(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

/** Guarda la planificación recibida del backend (ya viene con previos + nuevos, max 14 días) */
function guardarPlanificacion(data: Planificacion & { fuente_datos?: string; total_recetas_disponibles?: number }) {
  // Limpiar todas las claves antiguas de planificación
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Escribir los días tal como vienen del backend
  data.dias.forEach((dia, i) => {
    localStorage.setItem(`${STORAGE_PREFIX}dia_${i}`, JSON.stringify(dia));
  });

  // Actualizar meta
  const meta: PlanMeta = {
    generado_en: data.generado_en,
    fuente_datos: data.fuente_datos,
    total_recetas_disponibles: data.total_recetas_disponibles,
    total_dias: data.dias.length,
  };
  localStorage.setItem(STORAGE_META, JSON.stringify(meta));
}

/** Reconstruye la planificación completa desde las claves individuales */
function cargarPlanificacion(): Planificacion | null {
  const rawMeta = localStorage.getItem(STORAGE_META);
  if (!rawMeta) return null;
  const meta: PlanMeta = JSON.parse(rawMeta);

  const dias: DiaPlanning[] = [];
  for (let i = 0; i < meta.total_dias; i++) {
    const rawDia = localStorage.getItem(`${STORAGE_PREFIX}dia_${i}`);
    if (!rawDia) break;
    dias.push(JSON.parse(rawDia));
  }
  if (dias.length === 0) return null;

  return { generado_en: meta.generado_en, dias };
}

/** Devuelve la planificación guardada si fue generada hoy, o null si no existe / es de otro día */
function getPlanificacionHoy(): Planificacion | null {
  try {
    const data = cargarPlanificacion();
    if (!data?.generado_en) return null;
    const generado = new Date(data.generado_en);
    const hoy = new Date();
    const mismodia =
      generado.getFullYear() === hoy.getFullYear() &&
      generado.getMonth() === hoy.getMonth() &&
      generado.getDate() === hoy.getDate();
    return mismodia ? data : null;
  } catch {
    return null;
  }
}
>>>>>>> DEV-SC-01-algoritmo_planificacion

function App() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);
  const [activeMealTab, setActiveMealTab] = useState<MealTab>("comida");

  useEffect(() => {
    migrateLegacyStorage();
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
<<<<<<< HEAD
      const saved = cargarPlanificacion();
      const previos = getDiasPrevios(saved);
      const res = await fetchPlanificacionSemanal(previos.length > 0 ? previos : undefined);
=======
      // Cargar días previos y quedarnos solo con los que ya han pasado (antes de hoy)
      const planGuardado = cargarPlanificacion();
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const diasPrevios = (planGuardado?.dias ?? []).filter((dia) => {
        const fechaDia = new Date(dia.dia);
        fechaDia.setHours(0, 0, 0, 0);
        return fechaDia < hoy;
      });

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ dias_previos: diasPrevios }),
      });
>>>>>>> DEV-SC-01-algoritmo_planificacion
      if (!res.ok) {
        setErrorMsg(await extractApiError(res));
        setAppState("error");
        return;
      }
<<<<<<< HEAD

      const data = await parsePlanificacionResponse(res);
      savePlanificacion(data);
=======
      const data: Planificacion = await res.json();
      guardarPlanificacion(data);
>>>>>>> DEV-SC-01-algoritmo_planificacion
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
