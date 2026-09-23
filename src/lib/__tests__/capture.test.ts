import { describe, expect, test } from "bun:test";
import { capture } from "@/lib/capture";

// Miércoles 23 sep 2026, 18:00 en Madrid (UTC+2).
const now = new Date("2026-09-23T16:00:00Z");
const opts = { now, tz: "Europe/Madrid" };

describe("capture: tipo y datos", () => {
  test("recordatorio con hora", () => {
    const c = capture("recuérdame llamar a mamá mañana a las 9", opts);
    expect(c.tipo).toBe("recordatorio");
    expect(c.titulo).toBe("Llamar a mamá");
    expect(c.fecha).toBe("2026-09-24T09:00:00+02:00");
    expect(c.fecha_texto).toBe("mañana a las 9:00");
    expect(c.tiene_hora).toBe(true);
  });

  test("recordatorio sin palabra clave pero con verbo y fecha", () => {
    const c = capture("pagar el alquiler el día 1", opts);
    expect(c.tipo).toBe("recordatorio");
    expect(c.titulo).toBe("Pagar el alquiler");
    expect(c.fecha).toBe("2026-10-01T09:00:00+02:00");
    expect(c.tiene_hora).toBe(false);
  });

  test("que no se me olvide… quita los conectores", () => {
    const c = capture("que no se me olvide que tengo que renovar el DNI el viernes", opts);
    expect(c.tipo).toBe("recordatorio");
    expect(c.titulo).toBe("Renovar el DNI");
    expect(c.fecha_texto).toBe("pasado mañana a las 9:00");
  });

  test("más de dos días: nombre del día", () => {
    expect(capture("dentista el lunes a las 10", opts).fecha_texto).toBe("el lunes a las 10:00");
  });

  test("evento", () => {
    const c = capture("cena con Laura el viernes a las 21:30", opts);
    expect(c.tipo).toBe("evento");
    expect(c.titulo).toBe("Cena con Laura");
    expect(c.fecha).toBe("2026-09-25T21:30:00+02:00");
  });

  test("lista de la compra", () => {
    const c = capture("comprar leche, huevos y pan", opts);
    expect(c.tipo).toBe("lista");
    expect(c.titulo).toBe("Lista de la compra");
    expect(c.items).toEqual(["Leche", "Huevos", "Pan"]);
  });

  test("gasto", () => {
    const c = capture("gasté 12,50 € en gasolina", opts);
    expect(c.tipo).toBe("gasto");
    expect(c.importe).toBe(12.5);
    expect(c.titulo).toBe("Gasolina");
    expect(c.mensaje).toBe("💸 Gasto: Gasolina — 12,50 €");
  });

  test("pregunta", () => {
    const c = capture("¿qué le regalo a Marta por su cumple?", opts);
    expect(c.tipo).toBe("pregunta");
    expect(c.titulo).toBe("Qué le regalo a Marta por su cumple?");
  });

  test("enlace", () => {
    expect(capture("mirar https://shapeshiftui.vercel.app luego", opts).tipo).toBe("enlace");
  });

  test("nota por defecto", () => {
    const c = capture("idea: app para apuntar cosas tocando detrás del móvil", opts);
    expect(c.tipo).toBe("nota");
    expect(c.fecha).toBeNull();
  });
});

describe("capture: casos que antes fallaban", () => {
  test("he quedado… es un plan, no pasado", () => {
    expect(capture("he quedado con Pedro la semana que viene", opts).tipo).toBe("evento");
  });
  test("un gasto de ayer no es un evento", () => {
    const c = capture("45 euros de la cena de ayer", opts);
    expect(c.tipo).toBe("gasto");
    expect(c.importe).toBe(45);
  });
  test("importe periódico sin €", () => {
    const c = capture("netflix 13,99 al mes", opts);
    expect(c.tipo).toBe("gasto");
    expect(c.importe).toBe(13.99);
  });
  test("algo que ya pasó es una nota", () => {
    expect(capture("hoy me he sentido muy cansado en el entreno", opts).tipo).toBe("nota");
  });
});
