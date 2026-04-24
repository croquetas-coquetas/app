import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDayKey, isToday, formatFechaGenerado } from "@/lib/planning.utils";
import {DiaPlanning} from "../src/types/planning";
import { buildPlanMap } from "../src/components/planning/CalendarView";


// ─── buildPlanMap ────────────────────────────────────────────────────────────────

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
    it("Extrae YYYY-MM-DD de una fecha ISO completa", () => {
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

    it("Devuelve falso para fechas anteriores", () => {
        expect(isToday("2026-04-21T00:00:00.000Z")).toBe(false);
    });

    it("Devuelve falso para fechas posteriores", () => {
        expect(isToday("2026-04-23T00:00:00.000Z")).toBe(false);
    });
});

// ─── formatFechaGenerado ─────────────────────────────────────────────────────

describe("Pruebas de formatFechaGenerado()", () => {
    it("Formatea una fecha correctamente", () => {
        expect(formatFechaGenerado("2026-04-22T10:30:00.000Z")).toBe("22 de abril, 12:30");
    });

    it("No salta error con una fecha ISO válida", () => {
        expect(() => formatFechaGenerado("2026-01-01T00:00:00.000Z")).not.toThrow();
        expect(() => formatFechaGenerado("2026-12-31T23:59:59.999Z")).not.toThrow();
    });

    it("Devuelve '-' si no se le pasa nada", () => {
        expect(formatFechaGenerado()).toBe("-");
    })
});


// ────────────────── Pruebas Integración ────────────────── //

// ─── Auxiliares solo para comprobar resultados ────

const makeReceta = (nombre: string) => ({
    nombre,
    grupo_principal: "",
    ingredientes: [],
    pasos: [],
    tags: [],
});

const makeDia = (dia: string): DiaPlanning => ({
    dia,
    comida: makeReceta("Paella"),
    cena: makeReceta("Ensalada"),
});

// ─── Tests ─────────────────────────────────────────────────

describe("Normalización de fechas", () => {

    it("Mismo criterio de indexación en el mapa y clave del día", () => {
        const iso = "2026-04-22T00:00:00.000Z";
        const dia = makeDia(iso);
        const map = buildPlanMap([dia]);

        const key = getDayKey(iso);
        expect(map.get(key)).toEqual(dia);
    });

    it("Recuperación del día correcto en fechas distintas", () => {
        const iso1 = "2026-04-22T00:00:00.000Z";
        const iso2 = "2026-04-23T00:00:00.000Z";
        const dia1 = makeDia(iso1);
        const dia2 = makeDia(iso2);
        const map  = buildPlanMap([dia1, dia2]);

        expect(getDayKey(iso1)).not.toBe(getDayKey(iso2));
        expect(map.get(getDayKey(iso1))).toEqual(dia1);
        expect(map.get(getDayKey(iso2))).toEqual(dia2);
    });
});


describe("Flujo completo de recuperación de días", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-22T12:00:00.000Z"));
    });

    afterEach(() => vi.useRealTimers());

    it("Día actual encontrado y reconocido", () => {
        const isoHoy = "2026-04-22T00:00:00.000Z";
        const map    = buildPlanMap([makeDia(isoHoy)]);
        const key    = getDayKey(isoHoy);

        expect(map.get(key)).toBeDefined();
        expect(isToday(isoHoy)).toBe(true);
    });

    it("Menús de distinta fecha a la actual encontrados y reconocidos", () => {
        const isoOtro = "2026-04-23T00:00:00.000Z";
        const map     = buildPlanMap([makeDia(isoOtro)]);
        const key     = getDayKey(isoOtro);

        expect(map.get(key)).toBeDefined();
        expect(isToday(isoOtro)).toBe(false);
    });

    it("Días sin menú no reconocidos y fecha ignorada", () => {
        const map = buildPlanMap([]);
        const key = getDayKey("2026-04-22T00:00:00.000Z");

        expect(map.get(key)).toBeUndefined();
        expect(isToday("2026-04-22T00:00:00.000Z")).toBe(true);
    });
});


describe("Formato de planificación ante el calendario", () => {

    it("La fecha formateada corresponde al día extraído por getDayKey", () => {
        const iso = "2026-04-22T10:30:00.000Z";
        const key = getDayKey(iso); // "2026-04-22"

        expect(key).toBe("2026-04-22");
        const formateada = formatFechaGenerado(iso);
        expect(formateada).toMatch(/22/);
        expect(formateada).toMatch(/abril/i);
    });

    it("Obtener la key del día produce una fecha válida que el formateado no lanza error", () => {
        const isos = [
            "2026-01-01T00:00:00.000Z",
            "2026-12-31T23:59:59.999Z",
            "2026-06-15T08:45:00.000Z",
        ];

        isos.forEach((iso) => {
            expect(() => getDayKey(iso)).not.toThrow();
            expect(() => formatFechaGenerado(iso)).not.toThrow();
            expect(getDayKey(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    it("Cuando no se pasa fecha formateada se devuelve '-' no continua el flujo", () => {
        const sinFecha = formatFechaGenerado();
        expect(sinFecha).toBe("-");
        expect(() => buildPlanMap([])).not.toThrow();
    });
});