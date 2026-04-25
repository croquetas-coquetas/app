// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { savePlanificacion } from "@/lib/planning.storage";

const FIRST_TIME_KEY = "smartcook_first_time";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}

function makePlanificacionCompletaParaCompra(fecha: Date) {
  return {
    generado_en: fecha.toISOString(),
    dias: Array.from({ length: 7 }, (_, index) => {
      const dia = new Date(fecha.getTime() + index * 86400000).toISOString();
      return {
        dia,
        comida: {
          nombre: `Comida ${index + 1}`,
          grupo_principal: "verduras",
          ingredientes: index === 0 ? [] : [{ nombre: `ingrediente comida ${index + 1}`, cantidad: 100, unidad: "g" }],
          pasos: ["Paso 1"],
          tags: ["tag"],
        },
        cena: {
          nombre: `Cena ${index + 1}`,
          grupo_principal: "proteina",
          ingredientes: [{ nombre: `ingrediente cena ${index + 1}`, cantidad: 50, unidad: "g" }],
          pasos: ["Paso 1"],
          tags: ["tag"],
        },
      };
    }),
  };
}

async function advanceInit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 550));
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Shopping list warnings", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    localStorage.setItem(FIRST_TIME_KEY, "true");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("muestra un aviso cuando hay platos sin ingredientes", async () => {
    savePlanificacion(makePlanificacionCompletaParaCompra(new Date("2026-04-20T12:00:00.000Z")));

    render(<App />);
    await advanceInit();

    fireEvent.click(screen.getByRole("button", { name: /Generar lista/i }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /Lista de la compra generada/i })).toBeTruthy(),
    );
    expect(screen.getByText(/Se han generado 13 ingredientes para tu compra/i)).toBeTruthy();
    expect(screen.getByText(/Se han encontrado recetas sin ingredientes/i)).toBeTruthy();
    expect(screen.getByText(/Comida: Comida 1/i)).toBeTruthy();
  });
});
