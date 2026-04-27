import { HorariosDisponibilidad } from "@/types/planning";
import { STORAGE_HORARIOS } from "@/lib/planning.constants";

export const DEFAULT_HORARIOS: HorariosDisponibilidad = {
  comida: { inicio: "13:00", fin: "14:30" },
  cena: { inicio: "20:00", fin: "21:00" },
};

export function validateHorarios(horarios: HorariosDisponibilidad): string {
  const comidaInicio = horarios.comida.inicio.trim();
  const comidaFin = horarios.comida.fin.trim();
  const cenaInicio = horarios.cena.inicio.trim();
  const cenaFin = horarios.cena.fin.trim();

  if ((comidaInicio && !comidaFin) || (!comidaInicio && comidaFin)) {
    return "En comida debes completar inicio y fin, o dejar ambos vacios.";
  }

  if ((cenaInicio && !cenaFin) || (!cenaInicio && cenaFin)) {
    return "En cena debes completar inicio y fin, o dejar ambos vacios.";
  }

  if (comidaInicio && comidaFin && comidaInicio >= comidaFin) {
    return "El rango de comida es incorrecto: la hora de inicio debe ser anterior a la de fin (ejemplo: 13:00 a 14:30).";
  }

  if (cenaInicio && cenaFin && cenaInicio >= cenaFin) {
    return "El rango de cena es incorrecto: la hora de inicio debe ser anterior a la de fin (ejemplo: 20:00 a 21:00).";
  }

  return "";
}

function isValidTimeOrEmpty(value: unknown): value is string {
  return typeof value === "string" && (value.trim() === "" || /^\d{2}:\d{2}$/.test(value));
}

function normalizeHorarioRange(value: unknown): HorariosDisponibilidad["comida"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<HorariosDisponibilidad["comida"]>;
  const inicio = typeof parsed.inicio === "string" ? parsed.inicio.trim() : "";
  const fin = typeof parsed.fin === "string" ? parsed.fin.trim() : "";

  if (!isValidTimeOrEmpty(inicio) || !isValidTimeOrEmpty(fin)) {
    return null;
  }

  return { inicio, fin };
}

function normalizeHorarios(value: unknown): HorariosDisponibilidad | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<HorariosDisponibilidad>;
  const comida = normalizeHorarioRange(parsed.comida);
  const cena = normalizeHorarioRange(parsed.cena);

  if (!comida || !cena) {
    return null;
  }

  return { comida, cena };
}

export function loadHorariosFromStorage(): HorariosDisponibilidad {
  if (typeof window === "undefined") {
    return DEFAULT_HORARIOS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_HORARIOS);
    if (!raw) {
      return DEFAULT_HORARIOS;
    }

    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeHorarios(parsed);
    return normalized ?? DEFAULT_HORARIOS;
  } catch {
    return DEFAULT_HORARIOS;
  }
}

export function saveHorariosToStorage(horarios: HorariosDisponibilidad): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_HORARIOS, JSON.stringify(horarios));
  } catch {
    // Keep UX smooth even if storage is blocked/full.
  }
}

