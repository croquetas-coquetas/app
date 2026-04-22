import { HorariosDisponibilidad } from "@/types/planning";
import { STORAGE_HORARIOS } from "@/lib/planning.constants";

export const DEFAULT_HORARIOS: HorariosDisponibilidad = {
  comida: { inicio: "13:00", fin: "14:30" },
  cena: { inicio: "20:00", fin: "21:00" },
};

export function validateHorarios(horarios: HorariosDisponibilidad): string {
  if (!horarios.comida.inicio || !horarios.comida.fin || !horarios.cena.inicio || !horarios.cena.fin) {
    return "Debes completar todos los horarios. Indica hora de inicio y fin para comida y cena.";
  }

  if (horarios.comida.inicio >= horarios.comida.fin) {
    return "El rango de comida es incorrecto: la hora de inicio debe ser anterior a la de fin (ejemplo: 13:00 a 14:30).";
  }

  if (horarios.cena.inicio >= horarios.cena.fin) {
    return "El rango de cena es incorrecto: la hora de inicio debe ser anterior a la de fin (ejemplo: 20:00 a 21:00).";
  }

  return "";
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function isValidHorarios(value: unknown): value is HorariosDisponibilidad {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<HorariosDisponibilidad>;
  return (
    !!parsed.comida &&
    !!parsed.cena &&
    isValidTime(parsed.comida.inicio) &&
    isValidTime(parsed.comida.fin) &&
    isValidTime(parsed.cena.inicio) &&
    isValidTime(parsed.cena.fin)
  );
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
    return isValidHorarios(parsed) ? parsed : DEFAULT_HORARIOS;
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

