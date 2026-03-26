import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MONTHS, WEEKDAYS } from "@/lib/planning.constants";
import {
  buildCalendarGrid,
  formatFechaGenerado,
  getDayKey,
} from "@/lib/planning.utils";
import { DiaPlanning, Planificacion } from "@/types/planning";

interface CalendarViewProps {
  planificacion: Planificacion;
  onRegenerate: () => void;
  onDaySelect: (dia: DiaPlanning) => void;
}

export function CalendarView({ planificacion, onRegenerate, onDaySelect }: CalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const planMap = new Map<string, DiaPlanning>();
  for (const dia of planificacion.dias) {
    planMap.set(getDayKey(dia.dia), dia);
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <div className="w-full max-w-3xl mx-auto calendar-enter" style={{ boxSizing: "border-box", padding: "0 2px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <h2 className="text-2xl font-bold text-primary" style={{ margin: 0 }}>
            Menú de la semana
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary, #888)", marginTop: 2 }}>
            Generado el {formatFechaGenerado(planificacion.generado_en)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          ↺ Regenerar
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={prevMonth}
            style={{
              background: "none",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--color-text-primary, #000)",
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 500, minWidth: 130, textAlign: "center" }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            style={{
              background: "none",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--color-text-primary, #000)",
            }}
          >
            ›
          </button>
        </div>
        <button
          onClick={goToday}
          style={{
            background: "none",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 8,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--color-text-secondary, #888)",
          }}
        >
          Hoy
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "3px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--color-text-secondary, #888)",
              padding: "6px 0",
              textTransform: "uppercase",
            }}
          >
            {wd}
          </div>
        ))}

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
            <button
              key={key}
              type="button"
              onClick={() => planDia && onDaySelect(planDia)}
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
                textAlign: "left",
                opacity: hasMenu ? 1 : 0.65,
              }}
              disabled={!hasMenu}
              aria-label={hasMenu ? `Ver detalle del dia ${day}` : `Dia ${day} sin menu`}
              onMouseEnter={(e) => {
                if (hasMenu) {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.10)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: isTodayCell ? 700 : 400,
                  color: "var(--color-text-primary, #000)",
                  marginBottom: 3,
                  lineHeight: 1.2,
                }}
              >
                {day}
              </div>

              {hasMenu && planDia && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div
                    style={{
                      fontSize: 9,
                      lineHeight: 1.3,
                      color: "var(--color-text-secondary, #888)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    🥗 {planDia.comida.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      lineHeight: 1.3,
                      color: "var(--color-text-secondary, #888)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    🌙 {planDia.cena.nombre}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
