import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDayKey, isToday, formatFechaGenerado } from "@/lib/planning.utils";
import {DiaPlanning} from "../src/types/planning";
import { buildPlanMap } from "../src/components/planning/CalendarView";

// ─── planMap ────────────────────────────────────────────────────────────────

describe("Construir el mapa de días", () => {
    it("Mapea cada día por su fecha", () => {
        const dias: DiaPlanning[] = [
            { dia: "2026-04-22T00:00:00.000Z",
                comida: {
                    nombre: "Paella",
                    grupo_principal: "",
                    ingredientes: [],
                    pasos: [],
                    tags: []
                },
                cena: {
                    nombre: "Ensalada",
                    grupo_principal: "",
                    ingredientes: [],
                    pasos: [],
                    tags: []
                }
            },
            { dia: "2026-04-23T00:00:00.000Z",
                comida: {
                    nombre: "Cocido",
                    grupo_principal: "",
                    ingredientes: [],
                    pasos: [],
                    tags: []
                },
                cena: {
                    nombre: "Sopa",
                    grupo_principal: "",
                    ingredientes: [],
                    pasos: [],
                    tags: []
                }
            }
        ];
        const map = buildPlanMap(dias);
        expect(map.get("2026-04-22")).toEqual(dias[0]);
        expect(map.get("2026-04-23")).toEqual(dias[1]);
    });

    it("Devuelve indefinido si el dia no esta en la planificación", () => {
        const map = buildPlanMap([]);
        expect(map.get("2026-04-22")).toBeUndefined();
    });

    it("Si hay dos recetas con la misma fecha se sobreescribe la primera", () => {
        const first  = { dia: "2026-04-22T08:00:00.000Z",
            comida: {
                nombre: "Paella",
                grupo_principal: "",
                ingredientes: [],
                pasos: [],
                tags: []
            },
            cena: {
                nombre: "Ensalada",
                grupo_principal: "",
                ingredientes: [],
                pasos: [],
                tags: []
            }
        };

        const second = { dia: "2026-04-22T20:00:00.000Z",
            comida: {
                nombre: "Cocido",
                grupo_principal: "",
                ingredientes: [],
                pasos: [],
                tags: []
            },
            cena: {
                nombre: "Sopa",
                grupo_principal: "",
                ingredientes: [],
                pasos: [],
                tags: []
            }
        };
        const map = buildPlanMap([first, second]);
        expect(map.get("2026-04-22")).toEqual(second);
    });
});

// ─── getDayKey ───────────────────────────────────────────────────────────────

describe("Pruebas de getDayKey()", () => {
    it("Extrae AAAA-MM-DD de una fecha ISO completa", () => {
        expect(getDayKey("2026-04-22T00:00:00.000Z")).toBe("2026-04-22");
    });
});

// ─── isToday ─────────────────────────────────────────────────────────────────

describe("Pruebas de isToday()", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-22T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("Devuelve verdadero si se entra la fecha ISO de hoy", () => {
        expect(isToday("2026-04-22T00:00:00.000Z")).toBe(true);
    });

    it("Devuelve falso para el dia anterior", () => {
        expect(isToday("2026-04-21T00:00:00.000Z")).toBe(false);
    });

    it("Devuelve falso para el dia siguiente", () => {
        expect(isToday("2026-04-23T00:00:00.000Z")).toBe(false);
    });
});

// ─── formatFechaGenerado ─────────────────────────────────────────────────────

describe("Pruebas de formatFechaGenerado()", () => {
    it("Incluye el número de día en el output", () => {
        expect(formatFechaGenerado("2026-04-22T10:30:00.000Z")).toContain("22");
    });

    it("No salta error con una fecha ISO válida", () => {
        expect(() => formatFechaGenerado("2026-01-01T00:00:00.000Z")).not.toThrow();
    });

    it("No tiene problemas con fechas de fin de año", () => {
        expect(() => formatFechaGenerado("2026-12-31T23:59:59.000Z")).not.toThrow();
    });
});