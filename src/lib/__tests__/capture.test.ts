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

describe("capture: herramientas", () => {
  const cases: [string, string, string][] = [
    ["15% de 80", "calculo", "🧮 15% de 80 = 12"],
    ["23*4+10", "calculo", "🧮 23 × 4+10 = 102"],
    ["¿cuánto es 150 entre 3?", "calculo", "🧮 150 entre 3 = 50"],
    ["100 € con IVA", "calculo", "🧮 100 € con IVA = 121"],
    ["80 menos el 20%", "calculo", "🧮 80 menos el 20% = 64"],
    ["1.500 + 250", "calculo", "🧮 1.500 + 250 = 1750"],
    ["5 millas a km", "conversion", "📏 5 mi = 8,05 km"],
    ["cuántos km son 10 millas", "conversion", "📏 10 mi = 16,09 km"],
    ["30 grados a fahrenheit", "conversion", "📏 30 °C = 86 °F"],
    ["80 € entre 4", "dividir", "💶 80 € entre 4 = 20 € cada uno"],
    ["pagar la cena a medias 45 €", "dividir", "💶 45 € entre 2 = 22,50 € cada uno"],
    ["90 € entre Ana, Luis y yo", "dividir", "💶 90 € entre 3 = 30 € cada uno"],
    ["pasta 12 min", "temporizador", "⏲️ Pasta — 12 min"],
    ["pon un temporizador de media hora para el horno", "temporizador", "⏲️ Horno — 30 min"],
  ];
  for (const [texto, tipo, mensaje] of cases) {
    test(texto, () => {
      const c = capture(texto, opts);
      expect(c.tipo).toBe(tipo as typeof c.tipo);
      expect(c.mensaje).toBe(mensaje);
    });
  }

  test("el temporizador da los minutos para Atajos", () => {
    const c = capture("temporizador 1 h 30 min", opts);
    expect(c.accion).toBe("temporizador");
    expect(c.minutos).toBe(90);
    expect(c.segundos).toBe(5400);
  });

  test("acciones para el Atajo", () => {
    expect(capture("15% de 80", opts).accion).toBe("mostrar");
    expect(capture("recuérdame llamar a mamá mañana a las 9", opts).accion).toBe("recordatorio");
    expect(capture("cena con Laura el viernes a las 21:30", opts).accion).toBe("evento");
    expect(capture("comprar leche, huevos y pan", opts).accion).toBe("guardar");
  });

  test("no confunde frases normales con herramientas", () => {
    expect(capture("30 € entre gasolina y peajes", opts).tipo).toBe("gasto");
    expect(capture("tengo 2 m en mi casa", opts).tipo).toBe("nota");
    expect(capture("sacar al perro a las 8", opts).tipo).toBe("recordatorio");
    expect(capture("avísame en 10 minutos", opts).titulo).toBe("Aviso");
  });
});
