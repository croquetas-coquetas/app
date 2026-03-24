import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import "./App.css";

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

function App() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);

  const handleRequestGenerate = () => {
    const existente = getPlanificacionHoy();
    if (existente) {
      setPlanificacionExistente(existente);
      setAppState("confirm-overwrite");
    } else {
      doGenerate();
    }
  };

  const doGenerate = async () => {
    setAppState("loading");
    try {
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? `Error ${res.status}`);
        setAppState("error");
        return;
      }
      const data: Planificacion = await res.json();
      guardarPlanificacion(data);
      setPlanificacion(data);
      setAppState("success");
    } catch(err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`No se pudo conectar con el servidor: ${msg}`);
      setAppState("error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-10">

      {/* ── LANDING ── */}
      {appState === "landing" && (
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold tracking-tight text-primary">
              SmartCook
            </CardTitle>
            <CardDescription className="text-xl">
              Your intelligent cooking assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>
              Discover delicious recipes, manage your pantry, and plan your
              meals with ease. SmartCook helps you make the most of what you
              have.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Button onClick={() => setAppState("generate")}>Get Started</Button>
          </CardFooter>
        </Card>
      )}

      {/* ── GENERATE ── */}
      {appState === "generate" && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-primary">SmartCook</h2>
            <p className="text-muted-foreground">Genera tu planificación semanal con un solo clic</p>
          </div>
          <Button size="lg" className="px-10 py-6 text-base" onClick={handleRequestGenerate}>
            Generar planificación
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAppState("landing")}>
            ← Volver
          </Button>
        </div>
      )}

      {/* ── CONFIRM OVERWRITE ── */}
      {appState === "confirm-overwrite" && planificacionExistente && (
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-2xl">
              ⚠
            </div>
            <CardTitle className="text-xl font-bold">Ya tienes una planificación de hoy</CardTitle>
            <CardDescription>
              Generada el {formatFecha(planificacionExistente.generado_en)}. Si continúas se sobreescribirá.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              ¿Quieres ver la planificación existente o generar una nueva?
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPlanificacion(planificacionExistente);
                setAppState("success");
              }}
            >
              Ver la existente
            </Button>
            <Button onClick={doGenerate}>
              Generar nueva
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── LOADING ── */}
      {appState === "loading" && (
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="h-10 w-10 rounded-full border-4 border-border border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Generando tu menú…</p>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {appState === "success" && planificacion && (
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-primary">Menú de la semana</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Generado el {formatFecha(planificacion.generado_en)}
            </p>
          </div>

          <div className="space-y-0">
            {planificacion.dias.map((dia) => (
              <div key={dia.dia} className="flex items-start gap-4 py-3 border-b last:border-0">
                <span className="w-16 text-sm font-semibold shrink-0 pt-0.5">
                  {formatFecha(dia.dia)}
                </span>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Comida: </span>
                    {nombreReceta(dia.comida)}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Cena: </span>
                    {nombreReceta(dia.cena)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={handleRequestGenerate}>↺ Regenerar</Button>
            <Button variant="ghost" size="sm" onClick={() => setAppState("landing")}>Inicio</Button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {appState === "error" && (
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-2xl">
              ⚠
            </div>
            <CardTitle className="text-2xl font-bold">Algo salió mal</CardTitle>
            <CardDescription className="text-destructive">{errorMsg}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setAppState("generate")}>← Volver</Button>
            <Button onClick={doGenerate}>Reintentar</Button>
          </CardFooter>
        </Card>
      )}

    </div>
  );
}

export default App;