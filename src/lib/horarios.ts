import { HorariosDisponibilidad } from "@/types/planning";

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

