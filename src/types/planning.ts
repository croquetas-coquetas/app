export type AppState =
  | "empty"
  | "confirm-overwrite"
  | "loading"
  | "success"
  | "day-detail"
  | "error";

export interface Ingrediente {
  nombre: string;
  cantidad: number;
  unidad?: string;
}

export interface Receta {
  nombre: string;
  grupo_principal: string;
  ingredientes: Ingrediente[];
  pasos: string[];
  tags: string[];
}

export interface DiaPlanning {
  dia: string;
  comida: Receta;
  cena: Receta;
}

export interface Planificacion {
  generado_en?: string;
  dias: DiaPlanning[];
}

export interface DayModalProps {
  dia: DiaPlanning;
  onClose: () => void;
}

export type MealTab = "comida" | "cena";

export interface DayFullscreenViewProps {
  dia: DiaPlanning;
  activeTab: MealTab;
  onTabChange: (tab: MealTab) => void;
  onBack: () => void;
}
