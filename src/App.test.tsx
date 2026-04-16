// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import App from "./App";
import { savePlanificacion } from "@/lib/planning.storage";
import { STORAGE_META, STORAGE_PREFIX } from "@/lib/planning.constants";


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

function clearTestStorage() {
    localStorage.clear();
}

afterEach(() => {
    cleanup();
    clearTestStorage();
    vi.restoreAllMocks();
});

function makePlanificacion(fecha: Date) {
    return {
        generado_en: fecha.toISOString(),
        dias: [
            {
                dia: fecha.toISOString(),
                comida: {
                    nombre: "Paella valenciana",
                    grupo_principal: "arroz",
                    ingredientes: [],
                    pasos: ["Preparar ingredientes"],
                    tags: ["tradicional"],
                },
                cena: {
                    nombre: "Ensalada mixta",
                    grupo_principal: "verduras",
                    ingredientes: [],
                    pasos: ["Mezclar ingredientes"],
                    tags: ["ligera"],
                },
            },
            {
                dia: new Date(fecha.getTime() + 86400000).toISOString(),
                comida: {
                    nombre: "Lentejas",
                    grupo_principal: "legumbres",
                    ingredientes: [],
                    pasos: ["Cocer lentejas"],
                    tags: ["casera"],
                },
                cena: {
                    nombre: "Tortilla de patatas",
                    grupo_principal: "huevo",
                    ingredientes: [],
                    pasos: ["Freir patatas"],
                    tags: ["clasica"],
                },
            },
        ],
    };
}

const planHoy  = () => makePlanificacion(new Date());

async function advanceInit() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 550));
    });
}

async function renderAsFirstTime() {
    render(<App />);
    expect(screen.getByText("Cargando...")).toBeTruthy();
    await advanceInit();
}

async function irAGenerate() {
    await renderAsFirstTime();
    fireEvent.click(screen.getByText("Get Started"));
}

function seedNoEsPrimeraVez() {
    localStorage.setItem(FIRST_TIME_KEY, "true");
}

function seedPlanHoy() {
    savePlanificacion(planHoy());
}

function clickGenerateButton() {
    fireEvent.click(screen.getByRole("button", { name: /Generar planificación/i }));
}


function mockFetchOk(data: object) {
    vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    ));
}

function mockFetchError(error = "Error del servidor") {
    vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ error }) })
    ));
}

function mockFetchFallo() {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network error"))));
}


describe("UNIDAD", () => {

    beforeEach(() => {
        installMemoryStorage();
        clearTestStorage();
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("muestra spinner inicial y luego landing en primera apertura", async () => {
        render(<App />);
        expect(screen.getByText("Cargando...")).toBeTruthy();
        await advanceInit();
        expect(screen.getByText("Get Started")).toBeTruthy();
    });

    it("Get Started lleva al estado generate", async () => {
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        expect(screen.getByRole("heading", { name: /Generar planificación/i })).toBeTruthy();
    });

    it("muestra el mensaje de error del servidor cuando la API falla", async () => {
        mockFetchError("No hay suficientes recetas");
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText("No hay suficientes recetas")).toBeTruthy();
    });

    it("muestra error de red cuando no hay conexión", async () => {
        mockFetchFallo();
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText(/No se pudo conectar/i)).toBeTruthy();
    });

    it("al generar sin plan previo pasa a loading", async () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
    });

    it("al generar con plan previo de hoy pasa a confirm-overwrite", async () => {
        seedPlanHoy();
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() =>
            expect(screen.getByText("¿Quieres ver la planificación existente o generar una nueva?")).toBeTruthy()
        );
    });
});


describe("INTEGRACION", () => {

    beforeEach(() => {
        installMemoryStorage();
        clearTestStorage();
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("si no es primera apertura y no hay planificación, muestra popup para generar", async () => {
        seedNoEsPrimeraVez();
        render(<App />);
        await advanceInit();
        expect(screen.getByText("No hay semana generada")).toBeTruthy();
        expect(screen.getByText("Menú del mes")).toBeTruthy();
    });

    it("si no es primera apertura y hay planificación, entra directo al calendario", async () => {
        seedNoEsPrimeraVez();
        seedPlanHoy();
        render(<App />);
        await advanceInit();
        expect(screen.getByText("Menú del mes")).toBeTruthy();
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
        expect(screen.queryByText("Get Started")).toBeNull();
    });

    it("al generar con localStorage vacío no muestra advertencia de planificación existente", async () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {
        })));
        await irAGenerate();
        clickGenerateButton();
        expect(screen.queryByText(/Ya tienes una planificación de hoy/i)).toBeNull();
    });

    it("al generar con planificación de hoy guardada muestra confirm-overwrite", async () => {
        seedPlanHoy();
        await irAGenerate();
        clickGenerateButton();
        expect(screen.getByText(/Ya tienes una planificación de hoy/i)).toBeTruthy();
    });

    it("guarda la planificación en localStorage tras éxito", async () => {
        const plan = planHoy();
        mockFetchOk(plan);
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => screen.getByText(/Menú del mes/i));
        expect(localStorage.getItem(STORAGE_META)).toBeTruthy();
        expect(localStorage.getItem(`${STORAGE_PREFIX}dia_0`)).toBeTruthy();
        const meta = JSON.parse(localStorage.getItem(STORAGE_META)!);
        expect(meta.generado_en).toBe(plan.generado_en);
        expect(localStorage.getItem(FIRST_TIME_KEY)).toBe("true");
    });

});

describe("SISTEMA", () => {

    beforeEach(() => {
        installMemoryStorage();
        clearTestStorage();
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("flujo completo: landing → generate → loading → éxito", async () => {
        mockFetchOk(planHoy());
        render(<App />);
        expect(screen.getByText("Cargando...")).toBeTruthy();
        await advanceInit();
        expect(screen.getByText("SmartCook")).toBeTruthy();
        fireEvent.click(screen.getByText("Get Started"));
        expect(screen.getByRole("heading", { name: /Generar planificación/i })).toBeTruthy();
        clickGenerateButton();
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
        await waitFor(() => expect(screen.getByText(/Menú del mes/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
        expect(screen.getByText("Regenerar")).toBeTruthy();
    });

    it("flujo completo: landing → generate → error → reintentar → éxito", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({ error: "Servidor caído" }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(planHoy()) })
        );
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => screen.getByText("Servidor caído"));
        fireEvent.click(screen.getByText("Reintentar"));
        await waitFor(() => expect(screen.getByText(/Menú del mes/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
    });

    it("flujo completo: landing → generate → advertencia → generar nueva → éxito", async () => {
        seedPlanHoy();
        mockFetchOk({
            generado_en: new Date().toISOString(),
            dias: [{
                dia:    new Date().toISOString(),
                comida: {
                    nombre: "Fabada asturiana",
                    grupo_principal: "legumbres",
                    ingredientes: [],
                    pasos: ["Paso 1"],
                    tags: ["asturiana"],
                },
                cena: {
                    nombre: "Caldo gallego",
                    grupo_principal: "sopa",
                    ingredientes: [],
                    pasos: ["Paso 1"],
                    tags: ["gallega"],
                },
            }],
        });
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => screen.getByText("Generar nueva"));
        fireEvent.click(screen.getByText("Generar nueva"));
        await waitFor(() => expect(screen.getByText("Fabada asturiana")).toBeTruthy());
        expect(screen.getByText("Caldo gallego")).toBeTruthy();
    });

    it("Regenerar desde el menú vuelve a mostrar la advertencia", async () => {
        seedPlanHoy();
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        clickGenerateButton();
        await waitFor(() => screen.getByText("Ver la existente"));
        fireEvent.click(screen.getByText("Ver la existente"));
        await waitFor(() => screen.getByText("Regenerar"));
        fireEvent.click(screen.getByText("Regenerar"));
        expect(screen.getByText("Ya tienes una planificación de hoy")).toBeTruthy();
    });
});
