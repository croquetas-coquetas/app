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

const STORAGE_KEY = "smartcook_planificacion";
const API_URL = "https://appapi-ej7h.onrender.com/api/planificacion/semanal/";

type AppState = "empty" | "confirm-overwrite" | "loading" | "success" | "error";

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

interface Planificacion {
  generado_en?: string;
  dias: DiaPlanning[];
}

function nombreReceta(r: Receta) {
  return r?.nombre ?? r?.name ?? r?.titulo ?? "—";
}

function formatDiaSemana(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { weekday: "long" });
  } catch {
    return iso;
  }
}

function formatDiaNumero(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function formatFechaGenerado(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isToday(iso: string) {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    return (
        d.getFullYear() === hoy.getFullYear() &&
        d.getMonth() === hoy.getMonth() &&
        d.getDate() === hoy.getDate()
    );
  } catch {
    return false;
  }
}

function getSavedPlanificacion(): Planificacion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Planificacion;
  } catch {
    return null;
  }
}

function App() {
  const saved = getSavedPlanificacion();
  const [appState, setAppState] = useState<AppState>(
      saved ? "success" : "empty"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(saved);
  const [planificacionExistente, setPlanificacionExistente] =
      useState<Planificacion | null>(null);

  const handleRequestGenerate = () => {
    const existente = getSavedPlanificacion();
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
      const res = await fetch(API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? `Error ${res.status}`);
        setAppState("error");
        return;
      }
      const data: Planificacion = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setPlanificacion(data);
      setAppState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`No se pudo conectar con el servidor: ${msg}`);
      setAppState("error");
    }
  };

  return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-10">

        {/* ── EMPTY: sin planificación ── */}
        {appState === "empty" && (
            <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-4xl">
                  🍽️
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-primary">SmartCook</h1>
                <p className="text-muted-foreground max-w-xs leading-relaxed">
                  Todavía no tienes ninguna planificación que mostrar. Genera tu menú semanal con un solo clic.
                </p>
              </div>
              <Button size="lg" className="px-10 py-6 text-base" onClick={doGenerate}>
                Generar planificación
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
                <CardTitle className="text-xl font-bold">Ya tienes una planificación guardada</CardTitle>
                <CardDescription>
                  Generada el {formatFechaGenerado(planificacionExistente.generado_en)}. Si continúas se sobreescribirá.
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
                <Button onClick={doGenerate}>Generar nueva</Button>
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

        {/* ── SUCCESS: calendario semanal ── */}
        {appState === "success" && planificacion && (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Menú de la semana</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generado el {formatFechaGenerado(planificacion.generado_en)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRequestGenerate}>
                  ↺ Regenerar
                </Button>
              </div>

              {/* Calendario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {planificacion.dias.map((dia) => {
                  const hoy = isToday(dia.dia);
                  return (
                      <div
                          key={dia.dia}
                          className={`rounded-xl border p-4 space-y-3 transition-all ${
                              hoy
                                  ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                                  : "border-border bg-card"
                          }`}
                      >
                        {/* Cabecera del día */}
                        <div className="flex items-center justify-between">
                    <span
                        className={`text-sm font-bold capitalize ${
                            hoy ? "text-primary" : "text-foreground"
                        }`}
                    >
                      {formatDiaSemana(dia.dia)}
                    </span>
                          <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                  hoy
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                              }`}
                          >
                      {hoy ? "Hoy" : formatDiaNumero(dia.dia)}
                    </span>
                        </div>

                        {/* Comida */}
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            🥗 Comida
                          </p>
                          <p className="text-sm leading-snug">{nombreReceta(dia.comida)}</p>
                        </div>

                        {/* Cena */}
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            🌙 Cena
                          </p>
                          <p className="text-sm leading-snug">{nombreReceta(dia.cena)}</p>
                        </div>
                      </div>
                  );
                })}
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
                <Button variant="outline" onClick={() => setAppState(getSavedPlanificacion() ? "success" : "empty")}>
                  ← Volver
                </Button>
                <Button onClick={doGenerate}>Reintentar</Button>
              </CardFooter>
            </Card>
        )}
      </div>
  );
}

export default App;