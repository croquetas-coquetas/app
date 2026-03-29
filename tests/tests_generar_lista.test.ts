import { beforeEach, describe, expect, it, vi } from "vitest";
import * as plan from "@/types/planning.ts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/shopping.storage");

import { cargarPlanificacion } from "@/lib/shopping.storage";

import { generarListaCompra } from "@/lib/generarLista";

const mockCargar = vi.mocked(cargarPlanificacion);

// ---------------------------------------------------------------------------
// Funciones auxiliares
// ---------------------------------------------------------------------------

function makeIngrediente(nombre: string, cantidad: number, unidad = "g"):plan.Ingrediente {
  return { nombre: nombre, cantidad: cantidad, unidad: unidad, categoria: "" };
}

// el unico elemento importante para estos tests son los ingredientes presentes en cada receta
function makeReceta(ingredientes: plan.Ingrediente[]):plan.Receta {
  return { nombre: "", grupo_principal: "", ingredientes:ingredientes, pasos: [], tags: [] };
}

function makeDia(comidaIngredientes: plan.Ingrediente[] = [], cenaIngredientes: plan.Ingrediente[] = []): plan.DiaPlanning {
  return {
    dia: "2025-01-01",
    comida: makeReceta(comidaIngredientes),
    cena: makeReceta(cenaIngredientes)
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generarListaCompra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Estructura ────────────────────────────────────────────────────────────────

  describe("Estructura de la lista", () => {
    it("Devuelve una lista con la estructura correcta", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [makeDia([makeIngrediente("tomate", 200)])],
      });

      const result = generarListaCompra();

      expect(result).toMatchObject({
        generado_en: expect.any(String),
        planificacion_generada_en: "2025-01-01T00:00:00.000Z",
        total_items: expect.any(Number),
        items: expect.any(Array),
      });
    });

    it("La fecha de generación es la actual y está en formato ISO", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [],
      });

      const before = Date.now();
      const result = generarListaCompra();
      const after = Date.now();

      const ts = new Date(result.generado_en).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("El número total de ingredientes es el correcto", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("tomate", 100), makeIngrediente("cebolla", 50)],
            [makeIngrediente("ajo", 10)]
          ),
        ],
      });

      const result = generarListaCompra();
      expect(result.total_items).toBe(3);
      expect(result.items).toHaveLength(3);
    });
  });

  // ── Acumulacion ─────────────────────────────────────────────────────────

  describe("Acumulación de ingredientes", () => {
    it("Acumula ingredientes entre la comida y la cena", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("tomate", 100)],
            [makeIngrediente("tomate", 150)]
          ),
        ],
      });

      const result = generarListaCompra();
      const tomate = result.items.find((i) => i.nombre === "tomate");

      expect(tomate?.cantidad).toBe(250);
    });

    it("Acumula ingredientes a través de los días", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("arroz", 200)]),
          makeDia([makeIngrediente("arroz", 100)]),
          makeDia([], [makeIngrediente("arroz", 50)]),
        ],
      });

      const result = generarListaCompra();
      const arroz = result.items.find((i) => i.nombre === "arroz");

      expect(arroz?.cantidad).toBe(350);
    });

    it("Separa ingredientes distintos", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("tomate", 100)],
            [makeIngrediente("cebolla", 50)]
          ),
        ],
      });

      const result = generarListaCompra();
      expect(result.items).toHaveLength(2);
    });

    it("Almacena las unidades correctamente", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("leche", 200, "ml")],
            [makeIngrediente("leche", 100, "ml")]
          ),
        ],
      });

      const result = generarListaCompra();
      const leche = result.items.find((i) => i.nombre === "leche");

      expect(leche?.unidad).toBe("ml");
    });

    it("Elimina espacios en blanco sobrantes", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [makeDia([makeIngrediente("  tomate  ", 100)])],
      });

      const result = generarListaCompra();
      expect(result.items[0].nombre).toBe("tomate");
    });
  });

  // ── Ordenacion ──────────────────────────────────────────────────────────────

  describe("Ordenación", () => {
    it("Ordena los objetos por categoría", () => {
      // carne comes before lacteo in CATEGORIA_ORDEN
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("queso", 100)],   // lacteo
            [makeIngrediente("pollo", 200)]    // carne
          ),
        ],
      });

      const result = generarListaCompra();
      const nombres = result.items.map((i) => i.nombre);

      expect(nombres.indexOf("pollo")).toBeLessThan(nombres.indexOf("queso"));
    });

    it("Ordena alfabéticamente dentro de una misma categoría", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("zanahoria", 100)],  // verdura
            [makeIngrediente("apio", 50)]          // verdura
          ),
        ],
      });

      const result = generarListaCompra();
      const nombres = result.items.map((i) => i.nombre);

      expect(nombres.indexOf("apio")).toBeLessThan(nombres.indexOf("zanahoria"));
    });
  });

  // ── Corner cases ───────────────────────────────────────────────────────────

  describe("Corner cases", () => {
    it("Devuelve una lista vacía si no hay días", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [],
      });

      const result = generarListaCompra();
      expect(result.items).toHaveLength(0);
      expect(result.total_items).toBe(0);
    });

    it("Si hay días pero no hay recetas en estos devuelve una lista vacía", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [makeDia([], [])],
      });

      const result = generarListaCompra();
      expect(result.items).toHaveLength(0);
    });
  });
});