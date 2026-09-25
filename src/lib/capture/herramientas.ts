import { evaluate } from "@/lib/parse/calc";
import { convertValue, UNIT_LABELS } from "@/lib/parse/convert";

/**
 * Herramientas rápidas en español: calculadora, conversor, dividir cuentas y temporizador.
 * Cada parser devuelve null cuando la frase no encaja, para que la clasificación lo use como señal.
 */

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function formatNum(n: number) {
  const abs = Math.abs(n);
  const max = abs !== 0 && abs < 1 ? 4 : 2;
  return n.toLocaleString("es-ES", { maximumFractionDigits: max, useGrouping: abs >= 10_000 });
}

const NUM = "\\d+(?:\\.\\d+)?";

/** "1.500" es mil quinientos y "3,5" es tres coma cinco. */
function numerosEs(s: string) {
  return s.replace(/\b(\d{1,3})((?:\.\d{3})+)(?![\d.])/g, (_, a: string, b: string) => a + b.replace(/\./g, "")).replace(/(\d),(\d)/g, "$1.$2");
}

// ── Calculadora ──────────────────────────────────────────────

export type Calculo = { expresion: string; resultado: number };

const IVA = 0.21;

export function normalizarCalculo(text: string): string {
  let s = numerosEs(fold(text).trim());
  s = s.replace(/^[¿\s]*(?:cuanto (?:es|son|da|sale)|calcula(?:r|me)?|resultado de)\s+/, "").replace(/[=?¿]+/g, " ").trim();
  // IVA español
  s = s.replace(new RegExp(`(${NUM})\\s*(?:€|euros?)?\\s+(?:con|mas(?: el)?)\\s+(?:el\\s+)?iva\\b`, "g"), `($1*${1 + IVA})`);
  s = s.replace(new RegExp(`(${NUM})\\s*(?:€|euros?)?\\s+(?:sin|menos(?: el)?)\\s+(?:el\\s+)?iva\\b`, "g"), `($1/${1 + IVA})`);
  // Descuentos y recargos: "80 - 15%", "80 menos el 15%", "80 con un 15% de descuento"
  s = s.replace(new RegExp(`(${NUM})\\s*(?:€|euros?)?\\s*(?:con\\s+(?:un|el)\\s+)(${NUM})\\s*%\\s*de\\s+descuento`, "g"), "($1*(1-$2/100))");
  s = s.replace(new RegExp(`(${NUM})\\s*(?:€|euros?)?\\s*(?:-|menos(?:\\s+el)?)\\s*(${NUM})\\s*%`, "g"), "($1*(1-$2/100))");
  s = s.replace(new RegExp(`(${NUM})\\s*(?:€|euros?)?\\s*(?:\\+|mas(?:\\s+el)?)\\s*(${NUM})\\s*%`, "g"), "($1*(1+$2/100))");
  s = s.replace(new RegExp(`(?:el\\s+)?(${NUM})\\s*%\\s*de\\s+`, "g"), "($1/100)*");
  s = s.replace(new RegExp(`(${NUM})\\s*%`, "g"), "($1/100)");
  s = s.replace(/€|euros?/g, " ");
  s = s.replace(/\bal cuadrado\b/g, "^2").replace(/\bal cubo\b/g, "^3");
  s = s.replace(/\b(?:mas)\b/g, "+").replace(/\bmenos\b/g, "-");
  s = s.replace(/\b(?:multiplicado por|por)\b/g, "*").replace(/\b(?:dividido (?:por|entre)|entre)\b/g, "/");
  s = s.replace(/(?<=[\d)\s])[x×](?=[\s\d(])/g, "*").replace(/÷/g, "/");
  return s.replace(/\s+/g, " ").trim();
}

export function parseCalculo(text: string): Calculo | null {
  const expr = normalizarCalculo(text);
  // Tiene que haber una operación de verdad: "50" o "gasolina 50" no son cuentas.
  if (!/\d/.test(expr) || !/[\d)]\s*[-+*/^]\s*[\d(]/.test(expr)) return null;
  const r = evaluate(expr);
  if (r === null) return null;
  const expresion = text
    .trim()
    .replace(/^[¿\s]*(?:cu[aá]nto (?:es|son|da|sale)|calcula(?:r|me)?|resultado de)\s+/i, "")
    .replace(/[=?¿]+/g, "")
    .replace(/\s*\*\s*/g, " × ")
    .trim();
  return { expresion, resultado: Math.round(r * 1e10) / 1e10 };
}

// ── Conversor ────────────────────────────────────────────────

export type Conversion = { valor: number; de: string; a: string; resultado: number };

const UNIDADES: Record<string, string> = {
  km: "km", kms: "km", kilometro: "km", kilometros: "km",
  milla: "mi", millas: "mi",
  m: "m", metro: "m", metros: "m",
  cm: "cm", centimetro: "cm", centimetros: "cm",
  mm: "mm", milimetro: "mm", milimetros: "mm",
  pie: "ft", pies: "ft", ft: "ft",
  pulgada: "in", pulgadas: "in",
  yarda: "yd", yardas: "yd", yd: "yd",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  g: "g", gr: "g", gramo: "g", gramos: "g",
  lb: "lb", lbs: "lb", libra: "lb", libras: "lb",
  oz: "oz", onza: "oz", onzas: "oz",
  l: "l", litro: "l", litros: "l",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  galon: "gal", galones: "gal", gal: "gal",
  taza: "cup", tazas: "cup",
  grado: "C", grados: "C", celsius: "C", centigrados: "C", "°c": "C", "°": "C", c: "C",
  fahrenheit: "F", "°f": "F", f: "F",
  kelvin: "K",
  "km/h": "km/h", kmh: "km/h",
  mph: "m/h",
};

const DESTINO: Record<string, string> = {
  mi: "km", km: "mi", ft: "m", m: "ft", in: "cm", cm: "in", yd: "m", mm: "in",
  lb: "kg", kg: "lb", oz: "g", g: "oz", gal: "l", l: "gal", cup: "ml", ml: "cup",
  F: "C", C: "F", K: "C", "m/h": "km/h", "km/h": "m/h",
};

const U = Object.keys(UNIDADES)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const FIN = "(?![a-z])";
const CONV_COMPLETA = new RegExp(`(-?${NUM})\\s*(${U})${FIN}\\s*(?:a|en|son|=|->|→|to|in)\\s+(?:cuant[oa]s\\s+)?(${U})${FIN}`);
const CONV_PREGUNTA = new RegExp(`cuant[oa]s\\s+(${U})${FIN}\\s+(?:son|hay en|tiene[n]?)\\s+(-?${NUM})\\s*(${U})${FIN}`);
const CONV_SOLA = new RegExp(`^\\s*(-?${NUM})\\s*(${U})${FIN}\\s*$`);

export function parseConversion(text: string): Conversion | null {
  const t = numerosEs(fold(text)).replace(/[¿?]/g, " ").replace(/grados\s+(celsius|centigrados|fahrenheit|kelvin)/g, "$1");
  let valor: number, de: string | undefined, a: string | undefined;
  let m = CONV_COMPLETA.exec(t);
  if (m) [valor, de, a] = [Number(m[1]), UNIDADES[m[2]], UNIDADES[m[3]]];
  else if ((m = CONV_PREGUNTA.exec(t))) [valor, de, a] = [Number(m[2]), UNIDADES[m[3]], UNIDADES[m[1]]];
  else if ((m = CONV_SOLA.exec(t))) [valor, de] = [Number(m[1]), UNIDADES[m[2]]];
  else return null;
  if (!de) return null;
  a ??= DESTINO[de];
  if (!a || a === de) return null;
  const resultado = convertValue(valor, de, a);
  if (resultado === null) return null;
  return { valor, de, a, resultado: Math.round(resultado * 100) / 100 };
}

export const etiquetaUnidad = (u: string) => UNIT_LABELS[u] ?? u;

// ── Dividir la cuenta ────────────────────────────────────────

export type Division = { total: number; personas: number; porPersona: number };

const PALABRA_NUM: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const PERSONAS = `(\\d+|${Object.keys(PALABRA_NUM).join("|")})`;
export const DIVIDIR_F = /\b(dividir|divide|dividimos|a medias|a escote|cada uno|por cabeza|por persona|pagar entre|pagamos entre)\b/;

export function parseDivision(text: string): Division | null {
  const t = numerosEs(fold(text));
  const conMoneda = /€|\beuros?\b/.test(t);
  if (!conMoneda && !DIVIDIR_F.test(t)) return null;

  let personas: number | null = null;
  let resto = t;
  const n = new RegExp(`\\bentre\\s+${PERSONAS}\\b(?:\\s*(?:personas|amigos|colegas))?|\\b${PERSONAS}\\s+(?:personas|amigos|colegas)\\b`).exec(t);
  if (n) {
    const raw = n[1] ?? n[2];
    personas = PALABRA_NUM[raw] ?? Number(raw);
    resto = t.replace(n[0], " ");
  } else if (/\ba medias\b/.test(t)) {
    personas = 2;
  } else {
    // "60 € entre Ana, Luis y yo"
    const nombres = /\bentre\s+(.+)$/.exec(t);
    // Solo es un reparto si me incluyo o lo digo: "30 € entre gasolina y peajes" no lo es.
    if (nombres && (DIVIDIR_F.test(t) || /\b(yo|mi|nosotros)\b/.test(nombres[1]))) {
      const partes = nombres[1].split(/\s*(?:,|\by\b|\be\b)\s*/).filter((p) => /[a-z]/.test(p));
      if (partes.length >= 2) personas = partes.length;
      resto = t.replace(nombres[0], " ");
    }
  }
  const total = /(\d+(?:\.\d+)?)/.exec(resto);
  if (!personas || personas < 2 || !total) return null;
  const value = Number(total[1]);
  return { total: value, personas, porPersona: Math.round((value / personas) * 100) / 100 };
}

// ── Temporizador ─────────────────────────────────────────────

export type Temporizador = { segundos: number; etiqueta: string };

export const TEMPORIZADOR_F = /\b(temporizador|timer|cronometro|cuenta atras|pomodoro)\b/;
const DURACION = /(\d+(?:[.,]\d+)?)\s*(horas?|h|minutos?|mins?|m|segundos?|segs?|s)\b/g;
const ESPECIALES: [RegExp, number][] = [
  [/\bhora y media\b/, 90 * 60],
  [/\bun cuarto de hora\b/, 15 * 60],
  [/\bmedia hora\b/, 30 * 60],
  [/\buna hora\b/, 60 * 60],
  [/\bun minuto\b/, 60],
  [/\bpomodoro\b/, 25 * 60],
];

export function parseTemporizador(text: string): Temporizador | null {
  let t = ` ${fold(text).replace(/\s+/g, " ")} `;
  let segundos = 0;
  let found = false;
  for (const [re, s] of ESPECIALES) {
    if (re.test(t)) {
      segundos += s;
      found = true;
      t = t.replace(re, " ");
    }
  }
  t = t.replace(DURACION, (_, n: string, u: string) => {
    const v = Number(n.replace(",", "."));
    segundos += u.startsWith("h") ? v * 3600 : u.startsWith("m") ? v * 60 : v;
    found = true;
    return " ";
  });
  if (!found || segundos <= 0) return null;

  const etiqueta = t
    .replace(/\b(temporizador|timer|cronometro|cuenta atras|pon(?:me)?|un|una|de|para|el|la|en|y)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // La etiqueta sale de la versión sin acentos: recupera cada palabra tal como se escribió.
  const limpia = (w: string) => w.replace(/[^\p{L}\d]/gu, "");
  const original = new Map(text.split(/\s+/).map((w) => [fold(limpia(w)), limpia(w)]));
  const bonita = etiqueta
    .split(" ")
    .filter(Boolean)
    .map((w) => original.get(w) ?? w)
    .join(" ");
  return { segundos: Math.round(segundos), etiqueta: bonita ? bonita.charAt(0).toUpperCase() + bonita.slice(1) : "" };
}

// ── Mensajes ─────────────────────────────────────────────────

/**
 * "dile a Marta que llego tarde" → abre WhatsApp o Mensajes con el texto ya escrito.
 * No enviamos nada: el usuario elige el chat y pulsa enviar, así un error de interpretación no sale solo.
 */
export type Mensaje = { contacto: string; texto: string; canal: "whatsapp" | "sms"; url: string };

const SEPARADOR = "(?:\\s*:\\s*|\\s+diciendo(?:le)?\\s+que\\s+|\\s+que\\s+)";
const MENSAJE_RES = [
  /^(?:por favor\s+)?(?:dile|d[ií]gale|decirle|di)\s+a\s+(.+?)\s+que\s+(.+)$/iu,
  new RegExp(
    `^(?:manda(?:r|le)?|env[ií]a(?:r|le)?|escr[ií]be(?:le)?|escribir)\\s+(?:un\\s+)?(?:mensaje|whatsapp|wasap|sms|texto)?\\s*(?:a|para)\\s+(.+?)${SEPARADOR}(.+)$`,
    "iu",
  ),
  new RegExp(`^(?:mensaje|whatsapp|wasap|sms)\\s+(?:a|para)\\s+(.+?)${SEPARADOR}(.+)$`, "iu"),
];

const titleCase = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, sp: string, c: string) => sp + c.toUpperCase());

export function parseMensaje(text: string): Mensaje | null {
  const t = text.replace(/\s+/g, " ").trim();
  for (const re of MENSAJE_RES) {
    const m = re.exec(t);
    if (!m) continue;
    const contacto = titleCase(m[1].trim());
    const cuerpo = m[2].trim();
    const texto = cuerpo.charAt(0).toUpperCase() + cuerpo.slice(1);
    const canal = /whats?app|wasap|guasap|\bwsp\b/i.test(t) ? "whatsapp" : "sms";
    const enc = encodeURIComponent(texto);
    const url = canal === "whatsapp" ? `whatsapp://send?text=${enc}` : `sms:&body=${enc}`;
    return { contacto, texto, canal, url };
  }
  return null;
}

// ── Rutas ────────────────────────────────────────────────────

export type Ruta = { destino: string; url: string };

const RUTA_RE =
  /^(?:c[oó]mo\s+(?:llego|voy|ir|se va|se llega)|ruta|ll[eé]vame|navega(?:r)?|direcci[oó]n(?:es)?|indicaciones)\s+(?:a|al|hasta|para ir a|para)\s+(.+?)\s*\??$/iu;

export function parseRuta(text: string): Ruta | null {
  const m = RUTA_RE.exec(text.replace(/[¿]/g, "").replace(/\s+/g, " ").trim());
  if (!m) return null;
  const destino = m[1].trim();
  return { destino, url: `https://maps.apple.com/?daddr=${encodeURIComponent(destino)}` };
}

export function formatDuracion(segundos: number) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(" ");
}
