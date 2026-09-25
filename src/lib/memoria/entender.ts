import { fold } from "@/lib/capture/herramientas";
import { levenshtein } from "@/lib/decide";

/**
 * Memoria de nombres: "el camarero del Bar Pepe se llama Luis" se guarda; "¿cómo se llamaba el
 * camarero del Bar Pepe?" o "Bar Pepe" lo encuentra. Todo en funciones puras; guardar y leer
 * vive en store.ts.
 */

export type Memoria = {
  id: string;
  /** Lo que hay que recordar: "Luis", "Altea". */
  nombre: string;
  /** Quién o qué es: "camarero del Bar Pepe", "el pueblo de la paella". */
  descripcion: string;
  /** La frase tal cual, para buscar también por lo que no entendimos. */
  texto: string;
  creada: string;
};

export type NuevaMemoria = Pick<Memoria, "nombre" | "descripcion" | "texto">;

// ── ¿Pregunta o guarda? ──────────────────────────────────────

/** "cómo se llamaba…", "quién es…", "cuál era el nombre…". */
const BUSCAR_F =
  /\b(como se llama(?:ba|n|ban)?|como era|quien (?:es|era|son|eran|trabaja|trabajaba)|cual (?:es|era) (?:el )?nombre|que nombre tenia|busca(?:r|me)?|te acuerdas|sabes como)\b/;

export function esBusqueda(text: string) {
  return BUSCAR_F.test(fold(text));
}

/** "olvida a Luis", "borra lo del Bar Pepe", "elimina a Joan de Cadaqués". */
const OLVIDAR = /^(?:olvida(?:te)?(?: de)?|borra|elimina|quita)\s+(?:a\s+|lo\s+de(?:l)?\s+|lo\s+|el\s+|la\s+)?(.+)$/iu;

export function temaOlvido(text: string): string | null {
  const m = OLVIDAR.exec(text.replace(/[¿?.!]/g, "").replace(/\s+/g, " ").trim());
  return m ? m[1].trim() : null;
}

/** "¿cómo se llamaba el del kiosko?" → "el del kiosko": lo que se busca, sin la pregunta. */
export function temaBusqueda(text: string) {
  const tema = text
    .replace(
      /(c[oó]mo se llama(?:ba|n|ban)?|c[oó]mo era|qui[eé]n (?:es|era|son|eran|trabaja|trabajaba)|cu[aá]l (?:es|era) (?:el )?nombre(?: del?)?|qu[eé] nombre ten[ií]a|b[uú]sca(?:r|me)?|te acuerdas de|sabes c[oó]mo se llama(?:ba)?)\s*/iu,
      "",
    )
    .replace(/[¿?]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "");
  return tema || text.replace(/[¿?]/g, "").trim();
}

const PREFIJO_GUARDAR = /^(?:guarda|guardar|apunta|apuntar|anota|anotar|recuerda|recu[eé]rdame|acu[eé]rdate de)(?:\s+que)?\s*[:,]?\s+/i;
/** Palabras que empiezan frases como "mañana es el cumple de Pablo": no son nombres. */
const NO_NOMBRE = /^(hoy|manana|ayer|esto|eso|aquello|todo|nada|lunes|martes|miercoles|jueves|viernes|sabado|domingo|el|la|lo|mi|tu|su)$/;

const limpiarDesc = (s: string) =>
  s
    .trim()
    .replace(/^(?:el|la|los|las)\s+/i, "")
    .replace(/[.,;!]+$/, "")
    .trim();

const nombrePropio = (s: string) =>
  s
    .trim()
    .replace(/[.,;!]+$/, "")
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, c: string) => sp + c.toUpperCase());

const empiezaMayuscula = (s: string) => /^\p{Lu}/u.test(s.trim());

/** Saca { nombre, descripcion } si la frase es algo que guardar. null si no lo es. */
export function extraerMemoria(text: string): NuevaMemoria | null {
  const texto = text.replace(/\s+/g, " ").trim();
  if (esBusqueda(texto)) return null;
  const conPrefijo = PREFIJO_GUARDAR.test(texto);
  const t = texto.replace(PREFIJO_GUARDAR, "").replace(/[?¿]/g, "").trim();
  let m: RegExpExecArray | null;

  // "el camarero del Bar Pepe se llama Luis", "el pueblo de la paella se llamaba Altea"
  if ((m = /^(.+?)\s+se\s+llama(?:ba)?\s+(.+)$/iu.exec(t))) {
    return { nombre: nombrePropio(m[2]), descripcion: limpiarDesc(m[1]), texto };
  }
  // "Marta trabaja de enfermera en el hospital del Mar", "Marta trabaja en la farmacia de la plaza"
  if ((m = /^(.+?)\s+trabaja(?:ba)?\s+(?:de|como)\s+(.+?)\s+en\s+(.+)$/iu.exec(t))) {
    return { nombre: nombrePropio(m[1]), descripcion: `${limpiarDesc(m[2])} en ${m[3].trim()}`, texto };
  }
  if ((m = /^(.+?)\s+trabaja(?:ba)?\s+en\s+(.+)$/iu.exec(t))) {
    return { nombre: nombrePropio(m[1]), descripcion: `trabaja en ${m[2].trim()}`, texto };
  }
  // "en Cadaqués conocí a Joan, el del hotel"
  if ((m = /^en\s+(.+?),?\s+(?:conoc[ií]|conocimos)\s+a\s+([^,]+?)(?:,\s*(.+))?$/iu.exec(t))) {
    const lugar = m[1].trim();
    return { nombre: nombrePropio(m[2]), descripcion: m[3] ? `${limpiarDesc(m[3])} (${lugar})` : `de ${lugar}`, texto };
  }
  // "conocí a Joan en Cadaqués"
  if ((m = /^(?:conoc[ií]|conocimos)\s+a\s+(.+?)\s+en\s+(.+)$/iu.exec(t))) {
    return { nombre: nombrePropio(m[1]), descripcion: `conocido en ${m[2].trim()}`, texto };
  }
  // "Luis es el camarero del Bar Pepe": el nombre en mayúscula, o con "apunta que…" delante.
  if ((m = /^(.+?)\s+(?:es|era)\s+(?:el|la|los|las|un|una)\s+(.+)$/iu.exec(t))) {
    const quien = m[1].trim();
    const palabras = quien.split(" ");
    const pareceNombre = palabras.length <= 3 && !NO_NOMBRE.test(fold(palabras[0]));
    if (pareceNombre && (empiezaMayuscula(quien) || conPrefijo) && /\b(de|del|en)\b/i.test(m[2])) {
      return { nombre: nombrePropio(quien), descripcion: limpiarDesc(m[2]), texto };
    }
  }
  return null;
}

// ── Buscar ───────────────────────────────────────────────────

const VACIAS = new Set(
  (
    "el la los las un una unos unas lo de del al a en y e o u que como se llama llamaba llaman llamaban quien quienes " +
    "es era son eran cual cuales nombre me te le les mi mis tu tus su sus este esta estos estas ese esa aquel aquella " +
    "donde cuando por para con sin sobre ahi alli aqui voy vamos estoy estamos vuelvo volvemos fui ir hay tenia tiene " +
    "habia dijo dijeron conoci conocimos trabaja trabajaba otra otro vez dime busca buscar buscame acuerdas recuerdas " +
    "sabes pues oye tal ya muy mas"
  ).split(" "),
);

/** Palabras con significado, sin acentos ni plurales sencillos. */
export function palabras(text: string): string[] {
  return fold(text)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !VACIAS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

function parecido(a: string, b: string) {
  if (a === b) return 1;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 1) return 0.7;
  return 0;
}

/** `completa`: todas las palabras de la consulta aparecen (para borrar solo lo que es seguro). */
export type Resultado = { memoria: Memoria; puntos: number; completa: boolean };

/** Mejores coincidencias para la consulta. Vacío si no hay nada que se parezca. */
export function buscar(consulta: string, memorias: Memoria[], max = 5): Resultado[] {
  const q = palabras(consulta);
  if (!q.length) return [];
  const puntuadas = memorias
    .map((memoria) => {
      const bolsa = new Set(palabras(`${memoria.nombre} ${memoria.descripcion} ${memoria.texto}`));
      let puntos = 0;
      let completa = true;
      for (const w of q) {
        let mejor = 0;
        for (const b of bolsa) mejor = Math.max(mejor, parecido(w, b));
        puntos += mejor;
        if (!mejor) completa = false;
      }
      return { memoria, puntos, completa };
    })
    .filter((r) => r.puntos >= 1);
  if (!puntuadas.length) return [];
  // Solo las que se acercan a la mejor: "Bar Pepe" no debe traer todos los bares.
  const tope = Math.max(...puntuadas.map((r) => r.puntos));
  return puntuadas
    .filter((r) => r.puntos >= Math.max(1, tope * 0.7))
    .sort((a, b) => b.puntos - a.puntos || b.memoria.creada.localeCompare(a.memoria.creada))
    .slice(0, max);
}

export const lineaMemoria = (m: Pick<Memoria, "nombre" | "descripcion">) => `${m.nombre} — ${m.descripcion}`;
