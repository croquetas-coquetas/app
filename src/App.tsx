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
  ingredientes?: { nombre: string; cantidad: number; unidad: string }[];
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

function formatUnidad(unidad: string): string {
  if (!unidad) return 'g';
  const mappings: { [key: string]: string } = {
    'gramos': 'g',
    'mililitros': 'ml',
    'litros': 'l',
    'unidad': '',
    'unidades': '',
    'cucharada': 'c/s',
    'cucharadas': 'c/s',
    'taza': 'taza',
    'tazas': 'tazas',
    'pizca': 'pizca',
    'hoja': 'hoja',
    'hojas': 'hojas',
    'g': 'g',
    'ml': 'ml',
    'l': 'l',
  };
  return mappings[unidad.toLowerCase()] || 'g';
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

function getDayKey(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-based: 0=Mon … 6=Sun
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  // Pad to complete last row
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

interface DayModalProps {
  dia: DiaPlanning;
  onClose: () => void;
}

function DayModal({ dia, onClose }: DayModalProps) {
  const d = new Date(dia.dia);
  const label = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const today = isToday(dia.dia);
  const [showComidaIngredients, setShowComidaIngredients] = useState(false);
  const [showCenaIngredients, setShowCenaIngredients] = useState(false);

  return (
      // Faux backdrop — contributes layout height so the iframe doesn't collapse
      <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
      >
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-background-primary, #fff)",
              borderRadius: "16px",
              border: today
                  ? "2px solid hsl(var(--primary))"
                  : "0.5px solid var(--color-border-tertiary)",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "360px",
              boxSizing: "border-box",
            }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 600, margin: 0, textTransform: "capitalize", color: today ? "hsl(var(--primary))" : "inherit" }}>
                {label}
              </p>
              {today && (
                  <span style={{
                    display: "inline-block",
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}>
                Hoy
              </span>
              )}
            </div>
            <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  lineHeight: 1,
                  color: "var(--color-text-secondary, #888)",
                  padding: "0 4px",
                }}
            >
              ✕
            </button>
          </div>

          {/* Comida */}
          <div style={{
            background: "var(--color-background-secondary, #f5f5f5)",
            borderRadius: 12,
            padding: "1rem",
            marginBottom: "0.75rem",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-secondary, #888)", textTransform: "uppercase", margin: "0 0 6px" }}>
              🥗 Comida
            </p>
            <p style={{ fontSize: 15, margin: 0, fontWeight: 500 }}>{nombreReceta(dia.comida)}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowComidaIngredients(!showComidaIngredients)}
            >
              {showComidaIngredients ? 'Ocultar ingredientes' : 'Ver ingredientes'}
            </Button>
            {showComidaIngredients && dia.comida.ingredientes && (
              <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                {(dia.comida.ingredientes as any[]).map((ing, idx) => (
                  <li key={idx}>
                    {ing.cantidad || 0} {formatUnidad(ing.unidad || '')} {formatUnidad(ing.unidad || '') ? 'de' : ''} {ing.nombre || 'Ingrediente desconocido'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cena */}
          <div style={{
            background: "var(--color-background-secondary, #f5f5f5)",
            borderRadius: 12,
            padding: "1rem",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-secondary, #888)", textTransform: "uppercase", margin: "0 0 6px" }}>
              🌙 Cena
            </p>
            <p style={{ fontSize: 15, margin: 0, fontWeight: 500 }}>{nombreReceta(dia.cena)}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowCenaIngredients(!showCenaIngredients)}
            >
              {showCenaIngredients ? 'Ocultar ingredientes' : 'Ver ingredientes'}
            </Button>
            {showCenaIngredients && dia.cena.ingredientes && (
              <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                {(dia.cena.ingredientes as any[]).map((ing, idx) => (
                  <li key={idx}>
                    {ing.cantidad || 0} {formatUnidad(ing.unidad || '')} {formatUnidad(ing.unidad || '') ? 'de' : ''} {ing.nombre || 'Ingrediente desconocido'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
              variant="outline"
              className="w-full mt-4"
              onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </div>
  );
}

function CalendarView({
                        planificacion,
                        onRegenerate,
                      }: {
  planificacion: Planificacion;
  onRegenerate: () => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDia, setSelectedDia] = useState<DiaPlanning | null>(null);

  // Build lookup map: "YYYY-MM-DD" → DiaPlanning
  const planMap = new Map<string, DiaPlanning>();
  for (const dia of planificacion.dias) {
    planMap.set(getDayKey(dia.dia), dia);
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  return (
      <div className="w-full max-w-3xl mx-auto" style={{ boxSizing: "border-box", padding: "0 2px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 className="text-2xl font-bold text-primary" style={{ margin: 0 }}>Menú de la semana</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary, #888)", marginTop: 2 }}>
              Generado el {formatFechaGenerado(planificacion.generado_en)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            ↺ Regenerar
          </Button>
        </div>

        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
                onClick={prevMonth}
                style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16, color: "var(--color-text-primary, #000)" }}
            >
              ‹
            </button>
            <span style={{ fontSize: 15, fontWeight: 500, minWidth: 130, textAlign: "center" }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
            <button
                onClick={nextMonth}
                style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16, color: "var(--color-text-primary, #000)" }}
            >
              ›
            </button>
          </div>
          <button
              onClick={goToday}
              style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary, #888)" }}
          >
            Hoy
          </button>
        </div>

        {/* Calendar grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "3px",
          width: "100%",
          boxSizing: "border-box",
        }}>
          {/* Weekday headers */}
          {WEEKDAYS.map((wd) => (
              <div key={wd} style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--color-text-secondary, #888)",
                padding: "6px 0",
                textTransform: "uppercase",
              }}>
                {wd}
              </div>
          ))}

          {/* Day cells */}
          {grid.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} />;
            }

            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const planDia = planMap.get(key);
            const isTodayCell =
                day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
            const hasMenu = !!planDia;

            return (
                <div
                    key={key}
                    onClick={() => planDia && setSelectedDia(planDia)}
                    style={{
                      borderRadius: 8,
                      border: isTodayCell
                          ? "2px solid #828282"
                          : "0.5px solid var(--color-border-tertiary)",
                      background: isTodayCell
                          ? "var(--color-background-secondary, #f5f5f5)"
                          : hasMenu
                              ? "var(--color-background-secondary, #f5f5f5)"
                              : "var(--color-background-primary, #fcfcfc)",
                      padding: "4px 4px 6px",
                      minHeight: 60,
                      cursor: hasMenu ? "pointer" : "default",
                      transition: "box-shadow 0.15s, transform 0.1s",
                      boxSizing: "border-box",
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (hasMenu) {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.10)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLDivElement).style.transform = "none";
                    }}
                >
                  {/* Day number */}
                  <div style={{
                    fontSize: 12,
                    fontWeight: isTodayCell ? 700 : 400,
                    color: isTodayCell ? "hsl(var(--primary))" : "var(--color-text-primary, #000)",
                    marginBottom: 3,
                    lineHeight: 1.2,
                  }}>
                    {day}
                  </div>

                  {/* Menu pills */}
                  {hasMenu && planDia && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{
                          fontSize: 9,
                          lineHeight: 1.3,
                          color: "var(--color-text-secondary, #888)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}>
                          🥗 {nombreReceta(planDia.comida)}
                        </div>
                        <div style={{
                          fontSize: 9,
                          lineHeight: 1.3,
                          color: "var(--color-text-secondary, #888)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}>
                          🌙 {nombreReceta(planDia.cena)}
                        </div>
                      </div>
                  )}
                </div>
            );
          })}
        </div>

        {/* Modal */}
        {selectedDia && (
            <DayModal dia={selectedDia} onClose={() => setSelectedDia(null)} />
        )}
      </div>
  );
}

function App() {
  const saved = getSavedPlanificacion();
  const [appState, setAppState] = useState<AppState>(saved ? "success" : "empty");
  const [errorMsg, setErrorMsg] = useState("");
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(saved);
  const [planificacionExistente, setPlanificacionExistente] = useState<Planificacion | null>(null);

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background" style={{ padding: "1.5rem 1rem", boxSizing: "border-box" }}>

        {/* ── EMPTY ── */}
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

        {/* ── SUCCESS: calendario ── */}
        {appState === "success" && planificacion && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full" style={{ maxWidth: "100%", boxSizing: "border-box" }}>
              <CalendarView
                  planificacion={planificacion}
                  onRegenerate={handleRequestGenerate}
              />
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