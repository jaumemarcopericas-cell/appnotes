import type { Captura } from "@/lib/capture";
import { buscar, lineaMemoria, palabras } from "./entender";
import type { MemoriaStore } from "./store";

const SIN_BASE = "⚠️ No se ha guardado: falta conectar la base de datos en Vercel (ver docs/memoria.md)";
/** "Bar Pepe", "Cadaqués": una frase corta sin tipo claro se busca por si ya la tenemos guardada. */
const MAX_PALABRAS_CONSULTA = 4;

/**
 * Hace lo que la clasificación solo describe: guarda las memorias y responde las búsquedas.
 * Recibe el store para poder probarlo sin base de datos.
 */
export async function resolverMemoria(c: Captura, store: MemoriaStore | null): Promise<Captura> {
  if (c.tipo === "memoria") {
    if (!store) return { ...c, mensaje: SIN_BASE };
    await store.guardar({ nombre: c.titulo, descripcion: c.resultado ?? "", texto: c.texto });
    return c;
  }

  const consultaCorta = c.tipo === "nota" && palabras(c.texto).length <= MAX_PALABRAS_CONSULTA;
  if (c.tipo !== "buscar" && !consultaCorta) return c;
  if (!store) return c.tipo === "buscar" ? { ...c, mensaje: SIN_BASE.replace("guardado", "podido buscar") } : c;

  const resultados = buscar(c.texto, await store.todas());
  if (!resultados.length) {
    // Una nota corta que no coincide con nada sigue siendo una nota.
    return c.tipo === "buscar" ? { ...c, mensaje: `🔎 No tengo nada guardado sobre «${c.titulo}»` } : c;
  }
  const lineas = resultados.map((r) => lineaMemoria(r.memoria));
  return {
    ...c,
    tipo: "buscar",
    accion: "mostrar",
    emoji: "🔎",
    etiqueta: "Buscar",
    items: lineas,
    resultado: lineas[0],
    mensaje: `🔎 ${lineas.join("\n")}`,
  };
}
