import { describe, expect, test } from "bun:test";
import { capture } from "@/lib/capture";
import { buscar, esBusqueda, extraerMemoria, type Memoria, type NuevaMemoria } from "@/lib/memoria/entender";
import { resolverMemoria } from "@/lib/memoria/servicio";
import type { MemoriaStore } from "@/lib/memoria/store";

const opts = { now: new Date("2026-09-23T16:00:00Z"), tz: "Europe/Madrid" };

class StoreEnMemoria implements MemoriaStore {
  datos: Memoria[] = [];
  private n = 0;
  async todas() {
    return this.datos;
  }
  async guardar(m: NuevaMemoria) {
    const memoria = { ...m, id: String(++this.n), creada: new Date(2026, 8, this.n).toISOString() };
    this.datos.push(memoria);
    return memoria;
  }
  async borrar(id: string) {
    this.datos = this.datos.filter((m) => m.id !== id);
  }
}

describe("extraerMemoria", () => {
  const casos: [string, string, string][] = [
    ["el camarero del Bar Pepe se llama Luis", "Luis", "camarero del Bar Pepe"],
    ["el pueblo de la paella buenísima se llamaba Altea", "Altea", "pueblo de la paella buenísima"],
    ["Luis es el camarero del Bar Pepe", "Luis", "camarero del Bar Pepe"],
    ["apunta que luis es el camarero del bar pepe", "Luis", "camarero del bar pepe"],
    ["Marta trabaja en la farmacia de la plaza", "Marta", "trabaja en la farmacia de la plaza"],
    ["Marta trabaja de enfermera en el hospital del Mar", "Marta", "enfermera en el hospital del Mar"],
    ["en Cadaqués conocí a Joan, el del hotel", "Joan", "del hotel (Cadaqués)"],
    ["conocí a Joan en Cadaqués", "Joan", "conocido en Cadaqués"],
    ["recuérdame que el fontanero se llama Paco", "Paco", "fontanero"],
  ];
  for (const [texto, nombre, descripcion] of casos) {
    test(texto, () => {
      expect(extraerMemoria(texto)).toEqual({ nombre, descripcion, texto });
    });
  }

  test("no confunde frases normales con nombres", () => {
    expect(extraerMemoria("mañana es el cumple de Pablo")).toBeNull();
    expect(extraerMemoria("comprar leche, huevos y pan")).toBeNull();
    expect(extraerMemoria("¿cómo se llamaba el camarero?")).toBeNull();
  });
});

describe("esBusqueda", () => {
  test("preguntas por nombres", () => {
    expect(esBusqueda("¿cómo se llamaba el camarero del Bar Pepe?")).toBe(true);
    expect(esBusqueda("quién trabaja en la farmacia")).toBe(true);
    expect(esBusqueda("voy a Cadaqués, cómo se llamaba el del hotel?")).toBe(true);
    expect(esBusqueda("el camarero se llama Luis")).toBe(false);
  });
});

describe("buscar", () => {
  const m = (id: string, nombre: string, descripcion: string): Memoria => ({
    id,
    nombre,
    descripcion,
    texto: `${nombre} ${descripcion}`,
    creada: "2026-09-01T00:00:00Z",
  });
  const todas = [
    m("1", "Luis", "camarero del Bar Pepe"),
    m("2", "Ana", "cocinera del Bar Pepe"),
    m("3", "Paco", "dueño del Bar Manolo"),
    m("4", "Joan", "del hotel (Cadaqués)"),
  ];

  test("encuentra por el sitio y el puesto, sin acentos ni mayúsculas", () => {
    const r = buscar("¿cómo se llamaba el camarero del bar pepe?", todas);
    // Solo el camarero: la cocinera coincide en el sitio pero no en el puesto.
    expect(r.map((x) => x.memoria.nombre)).toEqual(["Luis"]);
  });

  test("solo el sitio trae a todos los de ese sitio", () => {
    expect(buscar("Bar Pepe", todas).map((x) => x.memoria.nombre).sort()).toEqual(["Ana", "Luis"]);
    expect(buscar("cadaques", todas).map((x) => x.memoria.nombre)).toEqual(["Joan"]);
  });

  test("aguanta una errata", () => {
    expect(buscar("camarrero pepe", todas)[0].memoria.nombre).toBe("Luis");
  });

  test("nada que ver → vacío", () => {
    expect(buscar("Valencia", todas)).toEqual([]);
  });
});

describe("resolverMemoria (guardar y preguntar de punta a punta)", () => {
  test("guardo y luego pregunto", async () => {
    const store = new StoreEnMemoria();
    const guardado = await resolverMemoria(capture("el camarero del Bar Pepe se llama Luis", opts), store);
    expect(guardado.tipo).toBe("memoria");
    expect(guardado.mensaje).toBe("📇 Guardado: Luis — camarero del Bar Pepe");
    expect(store.datos).toHaveLength(1);

    await resolverMemoria(capture("en Cadaqués conocí a Joan, el del hotel", opts), store);

    const r = await resolverMemoria(capture("¿cómo se llamaba el camarero del Bar Pepe?", opts), store);
    expect(r.tipo).toBe("buscar");
    expect(r.mensaje).toBe("🔎 Luis — camarero del Bar Pepe");
  });

  test("una nota corta que coincide se convierte en búsqueda", async () => {
    const store = new StoreEnMemoria();
    await resolverMemoria(capture("en Cadaqués conocí a Joan, el del hotel", opts), store);
    const r = await resolverMemoria(capture("Cadaqués", opts), store);
    expect(r.tipo).toBe("buscar");
    expect(r.mensaje).toBe("🔎 Joan — del hotel (Cadaqués)");
  });

  test("una nota corta sin coincidencias sigue siendo nota", async () => {
    const r = await resolverMemoria(capture("hoy he dormido fatal", opts), new StoreEnMemoria());
    expect(r.tipo).toBe("nota");
  });

  test("pregunta sin nada guardado", async () => {
    const r = await resolverMemoria(capture("¿cómo se llamaba el del kiosko?", opts), new StoreEnMemoria());
    expect(r.mensaje).toBe("🔎 No tengo nada guardado sobre «el del kiosko»");
  });

  test("sin base de datos avisa en vez de fingir que guarda", async () => {
    const r = await resolverMemoria(capture("el camarero del Bar Pepe se llama Luis", opts), null);
    expect(r.mensaje).toContain("falta conectar la base de datos");
  });
});
