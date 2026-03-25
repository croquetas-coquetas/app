// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "./App";


afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});


const STORAGE_KEY = "smartcook_planificacion";

function makePlanificacion(fecha: Date) {
    return {
        generado_en: fecha.toISOString(),
        dias: [
            {
                dia: fecha.toISOString(),
                comida: { nombre: "Paella valenciana" },
                cena:   { nombre: "Ensalada mixta" },
            },
            {
                dia: new Date(fecha.getTime() + 86400000).toISOString(),
                comida: { nombre: "Lentejas" },
                cena:   { nombre: "Tortilla de patatas" },
            },
        ],
    };
}

const planHoy  = () => makePlanificacion(new Date());

function irAGenerate() {
    fireEvent.click(screen.getByText("Get Started"));
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

    it("Get Started lleva al estado generate", () => {
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        expect(screen.getByText("Generar planificación")).toBeTruthy();
    });

    it("muestra el mensaje de error del servidor cuando la API falla", async () => {
        mockFetchError("No hay suficientes recetas");
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText("No hay suficientes recetas")).toBeTruthy();
    });

    it("muestra error de red cuando no hay conexión", async () => {
        mockFetchFallo();
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => expect(screen.getByText(/Algo salió mal/i)).toBeTruthy());
        expect(screen.getByText(/No se pudo conectar/i)).toBeTruthy();
    });

    it("al generar sin plan previo pasa a loading", () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
    });

    it("al generar con plan previo de hoy pasa a confirm-overwrite", async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planHoy()));
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() =>
            expect(screen.getByText("¿Quieres ver la planificación existente o generar una nueva?")).toBeTruthy()
        );
    });
});


describe("INTEGRACION", () => {

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    beforeEach(() => localStorage.clear());
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("devuelve null si localStorage está vacío", () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {
        })));
        render(<App/>);
        irAGenerate();
        fireEvent.click(screen.getByText("Generar planificación"));
        expect(screen.queryByText(/Ya tienes una planificación de hoy/i)).toBeNull();
    });

    it("devuelve la planificación si fue generada", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planHoy()));
        render(<App/>);
        irAGenerate();
        fireEvent.click(screen.getByText("Generar planificación"));
        expect(screen.getByText(/Ya tienes una planificación de hoy/i)).toBeTruthy();
    });

    it("guarda la planificación en localStorage tras éxito", async () => {
        const plan = planHoy();
        mockFetchOk(plan);
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => screen.getByText(/Menú de la semana/i));
        const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(guardado.generado_en).toBe(plan.generado_en);
    });

});

describe("SISTEMA", () => {

    it("flujo completo: landing → generate → loading → éxito", async () => {
        mockFetchOk(planHoy());
        render(<App />);
        expect(screen.getByText("SmartCook")).toBeTruthy();
        expect(screen.getByText("Your intelligent cooking assistant")).toBeTruthy();
        fireEvent.click(screen.getByText("Get Started"));
        expect(screen.getByText("Generar planificación")).toBeTruthy();
        fireEvent.click(screen.getByText("Generar planificación"));
        expect(screen.getByText(/Generando tu menú/i)).toBeTruthy();
        await waitFor(() => expect(screen.getByText(/Menú de la semana/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
        expect(screen.getByText("↺ Regenerar")).toBeTruthy();
        expect(screen.getByText("Inicio")).toBeTruthy();
    });

    it("flujo completo: landing → generate → error → reintentar → éxito", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({ error: "Servidor caído" }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(planHoy()) })
        );
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => screen.getByText("Servidor caído"));
        fireEvent.click(screen.getByText("Reintentar"));
        await waitFor(() => expect(screen.getByText(/Menú de la semana/i)).toBeTruthy());
        expect(screen.getByText("Paella valenciana")).toBeTruthy();
    });

    it("flujo completo: landing → generate → advertencia → generar nueva → éxito", async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planHoy()));
        mockFetchOk({
            generado_en: new Date().toISOString(),
            dias: [{
                dia:    new Date().toISOString(),
                comida: { nombre: "Fabada asturiana" },
                cena:   { nombre: "Caldo gallego" },
            }],
        });
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => screen.getByText("Generar nueva"));
        fireEvent.click(screen.getByText("Generar nueva"));
        await waitFor(() => expect(screen.getByText("Fabada asturiana")).toBeTruthy());
        expect(screen.getByText("Caldo gallego")).toBeTruthy();
    });

    it("Regenerar desde el menú vuelve a mostrar la advertencia", async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planHoy()));
        render(<App />);
        fireEvent.click(screen.getByText("Get Started"));
        fireEvent.click(screen.getByText("Generar planificación"));
        await waitFor(() => screen.getByText("Ver la existente"));
        fireEvent.click(screen.getByText("Ver la existente"));
        await waitFor(() => screen.getByText("↺ Regenerar"));
        fireEvent.click(screen.getByText("↺ Regenerar"));
        expect(screen.getByText("Ya tienes una planificación de hoy")).toBeTruthy();
    });
});
