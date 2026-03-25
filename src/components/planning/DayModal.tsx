import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DayModalProps } from "@/types/planning";
import { formatUnidad, isToday, nombreReceta } from "@/lib/planning.utils";

export function DayModal({ dia, onClose }: DayModalProps) {
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 600,
                margin: 0,
                textTransform: "capitalize",
                color: today ? "hsl(var(--primary))" : "inherit",
              }}
            >
              {label}
            </p>
            {today && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
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

        <div
          style={{
            background: "var(--color-background-secondary, #f5f5f5)",
            borderRadius: 12,
            padding: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--color-text-secondary, #888)",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            🥗 Comida
          </p>
          <p style={{ fontSize: 15, margin: 0, fontWeight: 500 }}>{nombreReceta(dia.comida)}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setShowComidaIngredients(!showComidaIngredients)}
          >
            {showComidaIngredients ? "Ocultar ingredientes" : "Ver ingredientes"}
          </Button>
          {showComidaIngredients && dia.comida.ingredientes && (
            <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
              {dia.comida.ingredientes.map((ing, idx) => (
                <li key={idx}>
                  {ing.cantidad || 0} {formatUnidad(ing.unidad || "")} {formatUnidad(ing.unidad || "") ? "de" : ""} {ing.nombre || "Ingrediente desconocido"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            background: "var(--color-background-secondary, #f5f5f5)",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--color-text-secondary, #888)",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            🌙 Cena
          </p>
          <p style={{ fontSize: 15, margin: 0, fontWeight: 500 }}>{nombreReceta(dia.cena)}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setShowCenaIngredients(!showCenaIngredients)}
          >
            {showCenaIngredients ? "Ocultar ingredientes" : "Ver ingredientes"}
          </Button>
          {showCenaIngredients && dia.cena.ingredientes && (
            <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
              {dia.cena.ingredientes.map((ing, idx) => (
                <li key={idx}>
                  {ing.cantidad || 0} {formatUnidad(ing.unidad || "")} {formatUnidad(ing.unidad || "") ? "de" : ""} {ing.nombre || "Ingrediente desconocido"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button variant="outline" className="w-full mt-4" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

