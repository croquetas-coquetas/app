import { describe, it, expect } from "vitest";
import { formatUnidad } from "@/lib/planning.utils";
import { Ingrediente } from "@/types/planning";
import { buildIngredientLabel, formatDuracion } from "../src/components/planning/DayFullscreenView";

// ── PRUEBAS UNITARIAS ──────────────────────────────────────────────

// ── formateo de unidades ──────────────────────────────────────────────────────────────

describe("Pruebas unitarias", () => {
    describe("formateo de unidades", () => {
        describe("input vacia", () => {
            it("devuelve 'g' para un string vacio", () => {
                expect(formatUnidad("")).toBe("g");
            });
        });

        describe("input desconocida", () => {
            it("devuelve 'g' para una unidad desconocida", () => {
                expect(formatUnidad("inexitente")).toBe("g");
            });
        });

        describe("unidades de peso", () => {
            it("mapea 'gramos' a 'g'", () => {
                expect(formatUnidad("gramos")).toBe("g");
            });

            it("mapea 'g' a 'g'", () => {
                expect(formatUnidad("g")).toBe("g");
            });
        });

        describe("unidades de volumen", () => {
            it("mapea 'mililitros' a 'ml'", () => {
                expect(formatUnidad("mililitros")).toBe("ml");
            });

            it("mapea 'ml' a 'ml'", () => {
                expect(formatUnidad("ml")).toBe("ml");
            });

            it("mapea 'litros' a 'l'", () => {
                expect(formatUnidad("litros")).toBe("l");
            });

            it("mapea 'l' a 'l'", () => {
                expect(formatUnidad("l")).toBe("l");
            });
        });

        describe("unidades de contar", () => {
            it("mapea 'unidad' a un string con un espacio", () => {
                expect(formatUnidad("unidad")).toBe(" ");
            });

            it("mapea 'unidades' a un string con un espacio", () => {
                expect(formatUnidad("unidades")).toBe(" ");
            });
        });

        describe("unidades de cocina", () => {
            it("mapea 'cucharadas' a 'cucharadas'", () => {
                expect(formatUnidad("cucharadas")).toBe("cucharadas");
            });

            it("mapea 'cucharada' a 'cucharada'", () => {
                expect(formatUnidad("cucharada")).toBe("cucharada");
            });

            it("mapea 'taza' a 'taza'", () => {
                expect(formatUnidad("taza")).toBe("taza");
            });

            it("mapea 'tazas' a 'tazas'", () => {
                expect(formatUnidad("tazas")).toBe("tazas");
            });

            it("mapea 'pizca' a 'pizca'", () => {
                expect(formatUnidad("pizca")).toBe("pizca");
            });
        });

        describe("otras unidades", () => {
            it("mapea 'dientes' a 'dientes'", () => {
                expect(formatUnidad("dientes")).toBe("dientes");
            });

            it("mapea 'hoja' a 'hoja'", () => {
                expect(formatUnidad("hoja")).toBe("hoja");
            });

            it("mapea 'hojas' a 'hojas'", () => {
                expect(formatUnidad("hojas")).toBe("hojas");
            });
        });

        describe("ignorar mayusculas", () => {
            it("maneja unidades con todo mayusculas", () => {
                expect(formatUnidad("GRAMOS")).toBe("g");
            });

            it("maneja unidades con mayusculas y minusculas", () => {
                expect(formatUnidad("Mililitros")).toBe("ml");
            });
        });
    });

    // ── crear el texto indicando cantidad y el nombre del ingrediente ─────────────────────────────────────────────────

    describe("buildIngredientLabel", () => {

        // ── nombre ────────────────────────────────────────────────────────────────

        describe("nombre", () => {
            it("incluye el nombre del ingrediente cuando esta presente", () => {
                const ing: Ingrediente = { nombre: "Lechuga", cantidad: 200, unidad: "g" };
                expect(buildIngredientLabel(ing)).toContain("Lechuga");
            });

            it("si el nombre esta vacio se muestra 'Ingrediente desconocido'", () => {
                const ing: Ingrediente = { nombre: "", cantidad: 200, unidad: "g" };
                expect(buildIngredientLabel(ing)).toContain("Ingrediente desconocido");
            });
        });

        // ── cantidad ──────────────────────────────────────────────────────────────

        describe("cantidad", () => {
            it("se incluye la cantidad", () => {
                const ing: Ingrediente = { nombre: "Lechuga", cantidad: 200, unidad: "g" };
                expect(buildIngredientLabel(ing)).toContain("200");
            });
        });

        // ── unidades y 'de' ─────────────────────────────────────────────

        describe("unidades y 'de'", () => {
            it("incluye 'de' cuando la unidad lo necesita", () => {
                const ing: Ingrediente = { nombre: "Lechuga", cantidad: 200, unidad: "gramos" };
                expect(buildIngredientLabel(ing)).toContain("de");
            });

            it("no incluye 'de' cuando se trata de una unidad de contar(unidad/es)", () => {
                var ing: Ingrediente = { nombre: "Huevo", cantidad: 1, unidad: "unidad" };
                expect(buildIngredientLabel(ing)).not.toContain("de");

                ing = { nombre: "Huevo", cantidad: 2, unidad: "unidades" };
                expect(buildIngredientLabel(ing)).not.toContain("de");
            });
        });

        // ── label de ingrediente completo ─────────────────────────────────────────────────────

        describe("label de ingrediente completo", () => {
            it("ingrediente con unidades que no son de contar", () => {
                const ing: Ingrediente = { nombre: "Lechuga", cantidad: 200, unidad: "gramos" };
                expect(buildIngredientLabel(ing)).toBe("200 g de Lechuga");
            });

            it("ingrediente con unidades de contar", () => {
                const ing: Ingrediente = { nombre: "Huevo", cantidad: 2, unidad: "unidades" };
                expect(buildIngredientLabel(ing)).toBe("2  Huevo");
            });
        });
    });

    describe("formatDuracion", () => {

        // ── inputs invalidos ─────────────────────────────────────────────────

        describe("inputs invalidos", () => {
            it("devuelve 'no disponible' si se introduce undefined", () => {
                expect(formatDuracion(undefined)).toBe("no disponible");
            });

            it("devuelve 'no disponible' si se introduce 0", () => {
                expect(formatDuracion(0)).toBe("no disponible");
            });

            it("devuelve 'no disponible' si se introduce negativo", () => {
                expect(formatDuracion(-10)).toBe("no disponible");
            });

            it("devuelve 'no disponible' si se introduce NaN", () => {
                expect(formatDuracion(NaN)).toBe("no disponible");
            });

            it("devuelve 'no disponible' si se introduce infinto", () => {
                expect(formatDuracion(Infinity)).toBe("no disponible");
            });
        });

        // ── menos de una hora ───────────────────────────────────────────────────

        describe("menos de 60 minutos", () => {
            it("devuelve '1 minuto' para 1 minuto", () => {
                expect(formatDuracion(1)).toBe("1 minuto");
            });

            it("devuelve '60 minutos' para 60 minutos", () => {
                expect(formatDuracion(60)).toBe("60 minutos");
            });

            it("trunca los decimales", () => {
                expect(formatDuracion(45.9)).toBe("45 minutos");
            });
        });

        // ── mas de 60 minutos ──────────────────────────────────────────────

        describe("mas de 60 minutos", () => {
            it("devuelve '1 hora y 1 minuto' para 61 minutos", () => {
                expect(formatDuracion(61)).toBe("1 hora y 1 minuto");
            });

            it("devuelve '2 horas y 0 minutos' para 120 minutos", () => {
                expect(formatDuracion(120)).toBe("2 horas y 0 minutos");
            });

            it("trunca decimales antes de dividirlos en horas y minutos", () => {
                expect(formatDuracion(90.9)).toBe("1 hora y 30 minutos");
            });
        });
    });
});
