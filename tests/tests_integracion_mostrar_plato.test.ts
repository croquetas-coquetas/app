import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import { savePlanificacion, cargarPlanificacion } from "@/lib/planning.storage";
import { getDiasPrevios } from "@/lib/planning.utils";
import { buildIngredientLabel } from "@/components/planning/DayFullscreenView";
import { getDayKey } from "@/lib/planning.utils";
import { Planificacion, DiaPlanning } from "@/types/planning";
import { formatDuracion } from "../src/components/planning/DayFullscreenView";
import { Receta } from "../src/types/planning";

const makeReceta = (overrides: Partial<Receta> = {}): Receta => ({
    nombre: "Ensalada César",
    grupo_principal: "verduras",
    duracion: 30,
    tags: ["fácil"],
    ingredientes: [
        { nombre: "Lechuga", cantidad: 200, unidad: "gramos" },
        { nombre: "Picatostes", cantidad: 50, unidad: "gramos" },
    ],
    pasos: ["Lavar la lechuga", "Mezclar los ingredientes"],
    ...overrides,
});

const makeDia = (daysOffset: number, overrides: Partial<DiaPlanning> = {}): DiaPlanning => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return {
        dia: date.toISOString(),
        comida: makeReceta({ nombre: "Ensalada César" }),
        cena: makeReceta({
            nombre: "Sopa de tomate", duracion: 90, pasos: ["Triturar el tomate", "Hervir"],
            tags: ["caliente"], ingredientes: [
                { nombre: "Tomate", cantidad: 500, unidad: "gramos" },
                { nombre: "Ajo", cantidad: 1, unidad: "dientes" },
            ]
        }),
        ...overrides,
    };
};

const makePlanificacion = (dias: DiaPlanning[]): Planificacion => ({
    generado_en: new Date().toISOString(),
    dias,
});

// ── mock de localStorage ─────────────────────────────────────────────────────────

beforeEach(() => {
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
        store[key] = value;
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
        delete store[key];
    });
    vi.spyOn(Storage.prototype, "clear").mockImplementation(() => {
        Object.keys(store).forEach((k) => delete store[k]);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── guardar una planificacion y luego cargar esa misma planificacion ───────────────────────────────────────────────────────────────

describe("guardar una planificacion y luego cargarla", () => {
    it("conserva el timestamp de generado-en", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        const planificacion = makePlanificacion(dias);

        savePlanificacion(planificacion);
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(loaded.generado_en).toBe(planificacion.generado_en);
    });

    it("los nombres de los platos en la planificacion cargada coinciden con los de la almacenada", () => {
        const dias = [makeDia(0), makeDia(1), makeDia(2),
        makeDia(3), makeDia(4), makeDia(5), makeDia(6)];
        const planificacion = makePlanificacion(dias);

        savePlanificacion(planificacion);
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(loaded.dias).toHaveLength(7);
        expect(loaded.dias[0].comida.nombre).toBe("Ensalada César");
        expect(loaded.dias[0].cena.nombre).toBe("Sopa de tomate");
    });

    it("los ingredientes de la comida estan correctamente formateados dentro de cada dia", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        savePlanificacion(makePlanificacion(dias));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const dia = loaded.dias[0];
        const labels = dia.comida.ingredientes.map(buildIngredientLabel);

        expect(labels).toContain("200 g de Lechuga");
        expect(labels).toContain("50 g de Picatostes");
    });

    it("los ingredientes de la comida estan correctamente formateados dentro de cada dia", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        savePlanificacion(makePlanificacion(dias));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const dia = loaded.dias[0];
        const labels = dia.cena.ingredientes.map(buildIngredientLabel);

        expect(labels).toContain("500 g de Tomate");
        expect(labels).toContain("1 dientes de Ajo");
    });

    it("los pasos se almacenan y cargan correctamente", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        savePlanificacion(makePlanificacion(dias));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const dia = loaded.dias[0];
        expect(dia.comida.pasos).toEqual(["Lavar la lechuga", "Mezclar los ingredientes"]);
        expect(dia.cena.pasos).toEqual(["Triturar el tomate", "Hervir"]);
    });

    it("los tags se almacenan y cargan correctamente", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        savePlanificacion(makePlanificacion(dias));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const dia = loaded.dias[0];
        expect(dia.comida.tags).toEqual(["fácil"]);
        expect(dia.cena.tags).toEqual(["caliente"]);
    });

    it("la duracion de la comida se almacena y lee correctamente", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 30 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 45 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(loaded.dias[0].comida.duracion).toBe(30);
    });

    it("la duracion de la cena se almacena y lee correctamente", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 30 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 45 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(loaded.dias[0].cena.duracion).toBe(45);
    });

    it("la duracion de un plato cargado puede ser formateada correctamente", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 30 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 45 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(formatDuracion(loaded.dias[0].comida.duracion)).toBe("30 minutos");
    });

    it("la duracion de un plato cargado puede ser formateada correctamente cuando dura mas de 60 minutos", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 30 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 90 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(formatDuracion(loaded.dias[0].cena.duracion)).toBe("1 hora y 30 minutos");
    });

    it("devuelve 'No disponible' si la duracion de la comida cargada no esta definida", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: undefined }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: undefined }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(formatDuracion(loaded.dias[0].comida.duracion)).toBe("No disponible");
    });

    it("devuelve 'No disponible' si la duracion de la cena cargada no esta definida", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: undefined }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: undefined }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(formatDuracion(loaded.dias[0].cena.duracion)).toBe("No disponible");
    });

    it("devuelve 'No disponible' si la duracion del plato cargado es 0", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 0 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 0 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        expect(formatDuracion(loaded.dias[0].comida.duracion)).toBe("No disponible");
        expect(formatDuracion(loaded.dias[0].cena.duracion)).toBe("No disponible");
    });

    it("formatea la duracion de la comida y la cena de un mismo dia correctamente", () => {
        savePlanificacion(makePlanificacion([makeDia(0, {
            comida: makeReceta({ nombre: "Ensalada César", duracion: 45 }),
            cena: makeReceta({ nombre: "Sopa de tomate", duracion: 120 }),
        })]));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const dia = loaded.dias[0];
        expect(formatDuracion(dia.comida.duracion)).toBe("45 minutos");
        expect(formatDuracion(dia.cena.duracion)).toBe("2 horas y 0 minutos");
    });
});

// ── getDiasPrevios ────────────────────────────────────────────────────────────

describe("getDiasPrevios tras cargar la planificacion", () => {
    it("devuelve un array vacio si no hay planificacion", () => {
        expect(getDiasPrevios(null)).toEqual([]);
    });

    it("devuelve solo los días anteriores a la planificación", () => {
        const dias = [makeDia(-2), makeDia(-1), makeDia(0), makeDia(1)];
        const planificacion = makePlanificacion(dias);

        savePlanificacion(planificacion);
        const loaded = cargarPlanificacion();
        const previos = getDiasPrevios(loaded);

        expect(previos).toHaveLength(2);
        previos.forEach((dia) => {
            expect(new Date(dia.dia).getTime()).toBeLessThan(new Date().setHours(0, 0, 0, 0));
        });
    });
});

// ── de cargar a seleccion de dia ─────────────────────────────────────────

describe("de cargar a seleccion de dia", () => {
    it("la planificacion cargada tiene la fecha del dia actual en ella", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        const planificacion = makePlanificacion(dias);

        savePlanificacion(planificacion);
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const planMap = new Map<string, DiaPlanning>();
        for (const dia of loaded.dias) {
            planMap.set(getDayKey(dia.dia), dia);
        }

        const todayKey = getDayKey(new Date().toISOString());
        expect(planMap.has(todayKey)).toBe(true);
        expect(planMap.get(todayKey)?.comida.nombre).toBe("Ensalada César");
    });

    it("devuelve indefinido para un dia que no esta en ninguna planificacion", () => {
        const dias = Array.from({ length: 7 }, (_, i) => makeDia(i));
        savePlanificacion(makePlanificacion(dias));
        const loaded = cargarPlanificacion();
        assert(loaded !== null, "la planificacion deberia estar cargada");

        const planMap = new Map<string, DiaPlanning>();
        for (const dia of loaded.dias) {
            planMap.set(getDayKey(dia.dia), dia);
        }

        expect(planMap.get("1900-01-01")).toBeUndefined();
    });
});

