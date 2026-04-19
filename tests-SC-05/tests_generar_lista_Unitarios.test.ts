import { beforeEach, describe, expect, it, vi } from "vitest";
import * as plan from "@/types/planning.ts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockCargarPlanificacion, mockSaveListaCompra, mockGetSavedListaCompra } = vi.hoisted(() => ({
  mockCargarPlanificacion: vi.fn(),
  mockSaveListaCompra: vi.fn(),
  mockGetSavedListaCompra: vi.fn(),
}));

vi.mock("@/lib/shopping.storage", () => ({
  cargarPlanificacion: mockCargarPlanificacion,
  saveListaCompra: mockSaveListaCompra,
  getSavedListaCompra: mockGetSavedListaCompra,
}));

import { generarListaCompra } from "@/lib/generarLista";

const mockCargar = mockCargarPlanificacion;

// ---------------------------------------------------------------------------
// Funciones auxiliares
// ---------------------------------------------------------------------------

function makeIngrediente(nombre: string, cantidad: number, unidad = "g"): plan.Ingrediente {
  return { nombre: nombre, cantidad: cantidad, unidad: unidad, categoria: "" };
}

// el unico elemento importante para estos tests son los ingredientes presentes en cada receta
function makeReceta(ingredientes: plan.Ingrediente[]): plan.Receta {
  return { nombre: "", grupo_principal: "", ingredientes: ingredientes, pasos: [], tags: [] };
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

    it("Convierte cucharadas a mililitros", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("aceite", 2, "cucharadas")],
            [makeIngrediente("aceite", 1, "cucharada")]
          ),
        ],
      });

      const result = generarListaCompra();
      const aceite = result.items.find((i) => i.nombre === "aceite");

      expect(aceite?.unidad).toBe("ml");
      expect(aceite?.cantidad).toBe(45); 
    });

    it("Convierte pizcas a gramos", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("sal", 3, "pizcas")],
            [makeIngrediente("sal", 2, "pizca")]
          ),
        ],
      });

      const result = generarListaCompra();
      const sal = result.items.find((i) => i.nombre === "sal");

      expect(sal?.unidad).toBe("g");
      expect(sal?.cantidad).toBe(5);
    });

    it("Convierte tazas a mililitros", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("harina", 2, "tazas")],
            [makeIngrediente("harina", 1, "taza")]
          ),
        ],
      });

      const result = generarListaCompra();
      const harina = result.items.find((i) => i.nombre === "harina");

      expect(harina?.unidad).toBe("ml");
      expect(harina?.cantidad).toBe(720);
    });

    it("Convierte kilogramos a gramos", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("arroz", 1, "kg")],
            [makeIngrediente("arroz", 0.5, "kilogramo")]
          ),
        ],
      });

      const result = generarListaCompra();
      const arroz = result.items.find((i) => i.nombre === "arroz");

      // 1kg = 1000g, 0.5kg = 500g, total 1500g = 1.5kg (normalizado)
      expect(arroz?.unidad).toBe("kg");
      expect(arroz?.cantidad).toBe(1.5);
    });

    it("Convierte litros a mililitros", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia(
            [makeIngrediente("agua", 1.5, "litros")],
            [makeIngrediente("agua", 0.5, "l")]
          ),
        ],
      });

      const result = generarListaCompra();
      const agua = result.items.find((i) => i.nombre === "agua");

      // 1.5l = 1500ml, 0.5l = 500ml, total 2000ml = 2l (normalizado)
      expect(agua?.unidad).toBe("l");
      expect(agua?.cantidad).toBe(2);
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

  // Normalizacion de unidades

  describe("Normalización de unidades", () => {
    it("Convierte gramos a kilogramos cuando es >= 1000g", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("harina", 2000, "g")]),
        ],
      });

      const result = generarListaCompra();
      const harina = result.items.find((i) => i.nombre === "harina");

      expect(harina?.unidad).toBe("kg");
      expect(harina?.cantidad).toBe(2);
    });

    it("Convierte mililitros a litros cuando es >= 1000ml", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("agua", 1500, "ml")]),
        ],
      });

      const result = generarListaCompra();
      const agua = result.items.find((i) => i.nombre === "agua");

      expect(agua?.unidad).toBe("l");
      expect(agua?.cantidad).toBe(1.5);
    });

    it("No convierte si es menor a 1000", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("sal", 500, "g")]),
        ],
      });

      const result = generarListaCompra();
      const sal = result.items.find((i) => i.nombre === "sal");

      expect(sal?.unidad).toBe("g");
      expect(sal?.cantidad).toBe(500);
    });

    it("Redondea a 2 decimales en la normalización", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("harina", 1234, "g")]),
        ],
      });

      const result = generarListaCompra();
      const harina = result.items.find((i) => i.nombre === "harina");

      expect(harina?.unidad).toBe("kg");
      expect(harina?.cantidad).toBe(1.23);
    });

    it("Aplica normalización después de acumular ingredientes", () => {
      mockCargar.mockReturnValue({
        generado_en: "2025-01-01T00:00:00.000Z",
        dias: [
          makeDia([makeIngrediente("arroz", 600, "g")]),
          makeDia([makeIngrediente("arroz", 500, "g")]),
          makeDia([makeIngrediente("arroz", 100, "g")]),
        ],
      });

      const result = generarListaCompra();
      const arroz = result.items.find((i) => i.nombre === "arroz");

      expect(arroz?.unidad).toBe("kg");
      expect(arroz?.cantidad).toBe(1.2);
    });
  });

  // Ordenacion

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