// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import App from "./App";
import { savePlanificacion } from "@/lib/planning.storage";
import { STORAGE_HORARIOS, STORAGE_META, STORAGE_PREFIX } from "@/lib/planning.constants";


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

const planHoy = () => makePlanificacion(new Date());

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

async function irAConfigurarHorarioInicial() {
    await renderAsFirstTime();
    fireEvent.click(screen.getByText("Get Started"));
}

function seedNoEsPrimeraVez() {
    localStorage.setItem(FIRST_TIME_KEY, "true");
}

function seedPlanHoy() {
    savePlanificacion(planHoy());
}

function clickGenerateDesdeOnboarding() {
    fireEvent.click(screen.getByRole("button", { name: /Guardar y generar planificacion/i }));
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

function setHorarioFields(values: [string, string, string, string]) {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    expect(inputs.length).toBe(4);
    fireEvent.change(inputs[0], { target: { value: values[0] } });
    fireEvent.change(inputs[1], { target: { value: values[1] } });
    fireEvent.change(inputs[2], { target: { value: values[2] } });
    fireEvent.change(inputs[3], { target: { value: values[3] } });
}

async function abrirConfigurarHorarioDesdePerfil() {
    const profileButton = screen.getByRole("button", { name: /Abrir menú del perfil/i });
    fireEvent.click(profileButton);
    fireEvent.mouseDown(profileButton);
    fireEvent.keyDown(profileButton, { key: "Enter", code: "Enter" });
    const configurarHorarioItem = await screen.findByText(/Configurar horario/i, {}, { timeout: 2000 });
    fireEvent.click(configurarHorarioItem);
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

    it("Get Started lleva al onboarding de horario", async () => {
        await renderAsFirstTime();
        fireEvent.click(screen.getByText("Get Started"));
        expect(screen.getByRole("heading", { name: /Configura tu horario/i })).toBeTruthy();
        expect(screen.getByText(/Rangos de cocina/i)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Guardar y generar planificacion/i })).toBeTruthy();
    });

    it("muestra el mensaje de error del servidor cuando la API falla", async () => {
        mockFetchError("No hay suficientes recetas");
        await irAConfigurarHorarioInicial();
        clickGenerateDesdeOnboarding();
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText("No hay suficientes recetas")).toBeTruthy();
    });

    it("muestra error de red cuando no hay conexión", async () => {
        mockFetchFallo();
        await irAConfigurarHorarioInicial();
        clickGenerateDesdeOnboarding();
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText(/No se pudo conectar/i)).toBeTruthy();
    });

    it("al generar desde onboarding pasa a loading", async () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => { })));
        await irAConfigurarHorarioInicial();
        clickGenerateDesdeOnboarding();
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
    });

    it("guarda horarios en localStorage desde onboarding", async () => {
        mockFetchOk(planHoy());
        await irAConfigurarHorarioInicial();
        setHorarioFields(["12:30", "14:00", "19:30", "21:30"]);
        clickGenerateDesdeOnboarding();
        await waitFor(() => expect(screen.getByText(/Menú del mes/i)).toBeTruthy());
        const raw = localStorage.getItem(STORAGE_HORARIOS);
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw!)).toEqual({
            comida: { inicio: "12:30", fin: "14:00" },
            cena: { inicio: "19:30", fin: "21:30" },
        });
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
        expect(screen.getByRole("button", { name: /Ver calendario/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Generar lista de la compra/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Abrir menú del perfil/i })).toBeTruthy();
    });

    it("si no es primera apertura y hay planificación, entra directo al calendario", async () => {
        seedNoEsPrimeraVez();
        seedPlanHoy();
        render(<App />);
        await advanceInit();
        expect(screen.getByText("Menú del mes")).toBeTruthy();
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
        expect(screen.queryByText("Get Started")).toBeNull();
        expect(screen.getByRole("button", { name: /Regenerar planificación/i })).toBeTruthy();
    });

    it("desde el perfil permite abrir el modal de configurar horario", async () => {
        seedPlanHoy();
        seedNoEsPrimeraVez();
        render(<App />);
        await advanceInit();
        await abrirConfigurarHorarioDesdePerfil();
        expect(screen.getByRole("dialog", { name: /Configurar mi horario/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Guardar/i })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog", { name: /Configurar mi horario/i })).toBeNull();
        });
    });

    it("guardar horario desde modal persiste en localStorage", async () => {
        seedPlanHoy();
        seedNoEsPrimeraVez();
        render(<App />);
        await advanceInit();
        await abrirConfigurarHorarioDesdePerfil();
        setHorarioFields(["11:00", "13:30", "20:15", "22:00"]);
        fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog", { name: /Configurar mi horario/i })).toBeNull();
        });
        const raw = localStorage.getItem(STORAGE_HORARIOS);
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw!)).toEqual({
            comida: { inicio: "11:00", fin: "13:30" },
            cena: { inicio: "20:15", fin: "22:00" },
        });
    });

    it("guarda la planificación en localStorage tras éxito", async () => {
        const plan = planHoy();
        mockFetchOk(plan);
        await irAConfigurarHorarioInicial();
        clickGenerateDesdeOnboarding();
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
        expect(screen.getByRole("heading", { name: /Configura tu horario/i })).toBeTruthy();
        clickGenerateDesdeOnboarding();
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
        await waitFor(() => expect(screen.getByText(/Menú del mes/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Regenerar planificación/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Abrir menú del perfil/i })).toBeTruthy();
    });

    it("flujo completo: landing → generate → error → reintentar → éxito", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({ error: "Servidor caído" }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(planHoy()) })
        );
        await irAConfigurarHorarioInicial();
        clickGenerateDesdeOnboarding();
        await waitFor(() => screen.getByText("Servidor caído"));
        fireEvent.click(screen.getByText("Reintentar"));
        await waitFor(() => expect(screen.getByText(/Menú del mes/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
    });

    it("regenerar con plan de hoy muestra confirm-overwrite", async () => {
        seedPlanHoy();
        seedNoEsPrimeraVez();
        render(<App />);
        await advanceInit();
        fireEvent.click(screen.getByRole("button", { name: /Regenerar planificación/i }));
        expect(screen.getByText("Ya tienes una planificación de hoy")).toBeTruthy();
    });

    it("la app carga horarios guardados y los muestra en onboarding", async () => {
        localStorage.setItem(
            STORAGE_HORARIOS,
            JSON.stringify({
                comida: { inicio: "10:00", fin: "12:00" },
                cena: { inicio: "19:00", fin: "20:30" },
            })
        );
        await irAConfigurarHorarioInicial();
        const inputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
        expect(inputs[0].value).toBe("10:00");
        expect(inputs[1].value).toBe("12:00");
        expect(inputs[2].value).toBe("19:00");
        expect(inputs[3].value).toBe("20:30");
    });
});
