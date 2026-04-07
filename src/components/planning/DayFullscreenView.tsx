import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiaPlanning, Ingrediente, MealTab } from "@/types/planning";
import { formatUnidad, isToday } from "@/lib/planning.utils";

interface DayFullscreenViewProps {
  dia: DiaPlanning;
  activeTab: MealTab;
  onTabChange: (tab: MealTab) => void;
  onBack: () => void;
}

export function DayFullscreenView({ dia, activeTab, onTabChange, onBack }: DayFullscreenViewProps) {
  const date = new Date(dia.dia);
  const dayLabel = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const recetaActiva = activeTab === "comida" ? dia.comida : dia.cena;
  const isCurrentDay = isToday(dia.dia);

  return (
    <section className="day-detail-screen day-detail-enter" aria-label="Detalle del dia seleccionado">
      <header className="day-detail-header">
        <Button variant="outline" size="sm" onClick={onBack} className="rounded-full border-border/80 bg-background/95 px-4 shadow-sm backdrop-blur">
          ← Volver
        </Button>
        <div className="day-detail-title-wrap">
          <p className="day-detail-title">{dayLabel}</p>
          {isCurrentDay && <span className="day-detail-badge">Hoy</span>}
        </div>
      </header>

      <div className="day-detail-tabs" role="tablist" aria-label="Seleccionar comida o cena">
        <button
          type="button"
          className={`day-detail-tab ${activeTab === "comida" ? "active" : ""}`}
          onClick={() => onTabChange("comida")}
          role="tab"
          aria-selected={activeTab === "comida"}
        >
          🥗 Comida
        </button>
        <button
          type="button"
          className={`day-detail-tab ${activeTab === "cena" ? "active" : ""}`}
          onClick={() => onTabChange("cena")}
          role="tab"
          aria-selected={activeTab === "cena"}
        >
          🌙 Cena
        </button>
      </div>

      <article className="day-detail-card day-detail-content-enter">
        <p className="day-detail-section-label">{activeTab === "comida" ? "Comida" : "Cena"}</p>
        <h3 className="day-detail-recipe-name">{recetaActiva.nombre}</h3>

        <div className="day-detail-tags-wrap">
          <p className="day-detail-section-label">Tags</p>
          {recetaActiva.tags && recetaActiva.tags.length > 0 ? (
            <div className="day-detail-tags-list" aria-label="Etiquetas de la receta">
              {recetaActiva.tags.map((tag, idx) => (
                <Badge key={`${tag}-${idx}`} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="day-detail-empty">No hay tags para esta receta.</p>
          )}
        </div>

        <div className="day-detail-ingredients-wrap">
          <p className="day-detail-section-label">Ingredientes</p>
          {recetaActiva.ingredientes && recetaActiva.ingredientes.length > 0 ? (
            <ul className="day-detail-ingredients-list">
              {recetaActiva.ingredientes.map((ing: Ingrediente, idx: number) => {
                const unidad = formatUnidad(ing.unidad || "");
                return (
                  <li key={idx} className="day-detail-ingredient-item">
                    {ing.cantidad || 0} {unidad} {unidad ? "de" : ""} {ing.nombre || "Ingrediente desconocido"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="day-detail-empty">No hay ingredientes disponibles para esta receta.</p>
          )}
        </div>

        <div className="day-detail-steps-wrap">
          <p className="day-detail-section-label">Pasos</p>
          {recetaActiva.pasos && recetaActiva.pasos.length > 0 ? (
            <ol className="day-detail-steps-list">
              {recetaActiva.pasos.map((paso, idx) => (
                <li key={`paso-${idx}`} className="day-detail-step-item p-1">
                  <Badge variant="outline" className="day-detail-step-badge mr-2">
                    Paso {idx + 1}
                  </Badge>
                  {paso}
                </li>
              ))}
            </ol>
          ) : (
            <p className="day-detail-empty">No hay pasos disponibles para esta receta.</p>
          )}
        </div>
      </article>
    </section>
  );
}
