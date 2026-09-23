import * as chrono from "chrono-node";
import {
  etiquetaUnidad,
  formatDuracion,
  formatNum,
  parseCalculo,
  parseConversion,
  parseDivision,
  parseTemporizador,
  TEMPORIZADOR_F,
} from "./herramientas";

/**
 * Captura rápida en español: clasifica una frase suelta ("recuérdame llamar a mamá mañana a las 9")
 * en un tipo sencillo y extrae lo necesario para guardarla. Lo usa /api/capture, pensado para
 * llamarse desde un Atajo de iOS (Toque posterior → Solicitar entrada → esta API).
 */

export const TIPOS = {
  recordatorio: { emoji: "⏰", etiqueta: "Recordatorio" },
  evento: { emoji: "📅", etiqueta: "Evento" },
  lista: { emoji: "🛒", etiqueta: "Lista" },
  gasto: { emoji: "💸", etiqueta: "Gasto" },
  pregunta: { emoji: "❓", etiqueta: "Pregunta" },
  enlace: { emoji: "🔗", etiqueta: "Enlace" },
  nota: { emoji: "📝", etiqueta: "Nota" },
  calculo: { emoji: "🧮", etiqueta: "Cálculo" },
  conversion: { emoji: "📏", etiqueta: "Conversión" },
  dividir: { emoji: "💶", etiqueta: "Dividir" },
  temporizador: { emoji: "⏲️", etiqueta: "Temporizador" },
} as const;
export type Tipo = keyof typeof TIPOS;

/**
 * Qué tiene que hacer el Atajo con la captura. Así el Atajo solo necesita un "If" por acción,
 * no uno por tipo: recordatorio → Recordatorios, evento → Calendario, temporizador → Reloj,
 * guardar → nota "Capturas", mostrar → solo la notificación (cuentas y conversiones).
 */
export type Accion = "recordatorio" | "evento" | "temporizador" | "guardar" | "mostrar";

const ACCION: Record<Tipo, Accion> = {
  recordatorio: "recordatorio",
  evento: "evento",
  temporizador: "temporizador",
  calculo: "mostrar",
  conversion: "mostrar",
  dividir: "mostrar",
  lista: "guardar",
  gasto: "guardar",
  pregunta: "guardar",
  enlace: "guardar",
  nota: "guardar",
};

/** Orden de desempate cuando dos tipos puntúan igual. */
const PRIORIDAD: Tipo[] = [
  "enlace",
  "dividir",
  "calculo",
  "conversion",
  "temporizador",
  "recordatorio",
  "evento",
  "gasto",
  "lista",
  "pregunta",
  "nota",
];

export const DEFAULT_TZ = "Europe/Madrid";
/** Hora que se pone cuando el usuario da un día pero no una hora ("mañana", "el viernes"). */
const HORA_POR_DEFECTO = 9;

export type Captura = {
  tipo: Tipo;
  accion: Accion;
  emoji: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  /** ISO 8601 con la zona del usuario, p. ej. "2026-09-24T09:00:00+02:00". */
  fecha: string | null;
  /** "24/09/2026 09:00", por si Atajos no lee bien el ISO. */
  fecha_local: string | null;
  /** "mañana a las 9:00" */
  fecha_texto: string | null;
  tiene_hora: boolean;
  items: string[];
  importe: number | null;
  /** Respuesta de cuentas, conversiones y repartos: "12", "8,05 km", "20 € cada uno". */
  resultado: string | null;
  /** Duración del temporizador (Atajos: "Start Timer" en minutos). */
  segundos: number | null;
  minutos: number | null;
  mensaje: string;
  fuente: "reglas" | "jev";
};

export type CaptureOptions = { now?: Date; tz?: string };

// ── Zona horaria ─────────────────────────────────────────────

export function validTz(tz: string | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Minutos de diferencia con UTC en `tz` en ese instante (+120 en Madrid en verano). */
export function tzOffset(tz: string, d: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

type Parts = { y: number; m: number; d: number; h: number; min: number };

function partsIn(tz: string, d: Date): Parts {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

function atLocal(tz: string, y: number, m: number, d: number, h: number, min = 0): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  return new Date(guess - tzOffset(tz, new Date(guess)) * 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

function isoLocal(tz: string, d: Date) {
  const p = partsIn(tz, d);
  const off = tzOffset(tz, d);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function textoFecha(tz: string, d: Date, now: Date) {
  const p = partsIn(tz, d);
  const n = partsIn(tz, now);
  const dias = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 86_400_000);
  let dia: string;
  if (dias === 0) dia = "hoy";
  else if (dias === 1) dia = "mañana";
  else if (dias === 2) dia = "pasado mañana";
  else if (dias > 2 && dias < 7) dia = "el " + new Intl.DateTimeFormat("es-ES", { timeZone: tz, weekday: "long" }).format(d);
  else dia = "el " + new Intl.DateTimeFormat("es-ES", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  return `${dia} a la${p.h === 1 ? "" : "s"} ${p.h}:${pad(p.min)}`;
}

// ── Fechas ───────────────────────────────────────────────────

type Fecha = { start: Date; text: string; index: number; hasTime: boolean };

const PARTE_DEL_DIA = /tarde|noche|mediod[ií]a|madrugada/i;

export function findFecha(text: string, now: Date, tz: string): Fecha | null {
  const results = chrono.es.parse(text, { instant: now, timezone: tzOffset(tz, now) }, { forwardDate: true });
  for (const r of results) {
    const t = r.text.trim();
    // chrono lee "el día 1" como "a 1" (la una): demasiado ambiguo.
    if (/^\d+$/.test(t) || /^a\s+\d{1,2}$/i.test(t)) continue;
    const hasTime = r.start.isCertain("hour");
    let start = r.start.date();
    if (!hasTime && !PARTE_DEL_DIA.test(t)) {
      const p = partsIn(tz, start);
      start = atLocal(tz, p.y, p.m, p.d, HORA_POR_DEFECTO);
    }
    return { start, text: r.text, index: r.index, hasTime };
  }

  // "el día 5": el próximo día 5 (hoy incluido).
  const m = /(?:^|\s)((?:el\s+)?d[ií]a\s+(\d{1,2}))(?=[\s,.;]|$)/i.exec(text);
  if (m) {
    const day = Number(m[2]);
    if (day >= 1 && day <= 31) {
      const n = partsIn(tz, now);
      let [y, mo] = [n.y, n.m];
      if (day < n.d) [y, mo] = mo === 12 ? [y + 1, 1] : [y, mo + 1];
      return { start: atLocal(tz, y, mo, day, HORA_POR_DEFECTO), text: m[1], index: m.index + m[0].indexOf(m[1]), hasTime: false };
    }
  }
  return null;
}

// ── Texto ────────────────────────────────────────────────────

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function removeRange(text: string, index: number, length: number) {
  return text.slice(0, index) + " " + text.slice(index + length);
}

/** Quita conectores sueltos que quedan al borrar la fecha o la palabra clave. */
export function tidyEs(s: string) {
  let out = s.replace(/\s+/g, " ").trim().replace(/^[\s,;:.¿-]+|[\s,;:¿-]+$/g, "");
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/\s+(?:el|la|los|las|a|al|de|del|para|que|en|y|con|por|sobre|este|esta|hoy)$/i, "")
      .replace(/^(?:que|de|a|para|en|tengo que|hay que|debo)\s+/i, "")
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

const RECORDAR = /(^|\s)(?:por favor\s+)?(?:recu[eé]rdame|recordarme|recordatorio:?|no olvidar|no te olvides(?:\s+de)?|no olvides|que no se me olvide|acu[eé]rdate(?:\s+de)?|av[ií]same(?:\s+(?:de|para))?|remind me(?:\s+to)?)(?=\s|$|:)/giu;
const RECORDAR_F = /\b(recuerdame|recordarme|recordatorio|no olvid|no te olvides|que no se me olvide|acuerdate|avisame|remind me)/;
const VERBO_ACCION = /^(?:tengo que |hay que )?(llamar|pagar|enviar|mandar|escribir|comprar|recoger|llevar|devolver|renovar|pedir|reservar|tomar|sacar|preparar|entregar|revisar|contestar|responder|ir)\b/;
const EVENTO_F = /\b(cena|cenar|comida|comer|almuerzo|desayuno|cafe|reunion|quedada|quedado|quedar|quedamos|cita|cumple|cumpleanos|fiesta|boda|partido|concierto|clase|entreno|medico|dentista|vuelo|viaje|examen|entrevista)\b/;
const LISTA_INICIO = /^(?:lista(?: de la compra)?|la compra|tengo que comprar|hay que comprar|comprar|compra)(?![a-zñ])\s*:?\s*/i;
const GASTO_VERBO = /(^|\s)(?:he\s+)?(?:gast[eé]|gastado|pagu[eé]|pagado|me ha costado|me cost[oó]|cost[oó]|gasto:?)(?=\s|$)/giu;
const GASTO_VERBO_F = /\b(gaste|gastado|pague|pagado|costo|costado|gasto)\b/;
/** "netflix 13,99 al mes": un importe periódico es un gasto aunque no lleve €. */
const GASTO_PERIODO_F = /\b(al mes|mensual|al ano|anual|suscripcion|cuota)\b/;
/** Algo que ya pasó no es un plan: "ayer", "fui", "me he sentido". "He quedado" sí es un plan. */
const PASADO_F = /\b(ayer|anoche|anteayer|la semana pasada|el otro dia|fui|estuve|tuve)\b|\b(?:he|has|ha|hemos|han)\s+(?!quedado\b)[a-z]+(?:ado|ido)\b/;
const IMPORTE = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?\b)|€\s*(\d+(?:[.,]\d{1,2})?)/i;
const URL = /https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(?:com|es|dev|io|app|org|net|ai)\b\S*/i;
const PREGUNTA_INICIO = /^(que|como|por que|cuando|donde|quien|cual|cuanto|cuanta|cuantos|cuantas|puedo|se puede|deberia|merece la pena)\b/;

function findImporte(text: string) {
  const m = IMPORTE.exec(text);
  if (m) return { value: Number((m[1] ?? m[2]).replace(",", ".")), index: m.index, length: m[0].length, moneda: true };
  // "gasté 12 en gasolina": un número suelto solo cuenta si hay verbo de gasto o es periódico.
  const f = fold(text);
  if (GASTO_VERBO_F.test(f) || GASTO_PERIODO_F.test(f)) {
    const n = /\b(\d+(?:[.,]\d{1,2})?)\b/.exec(text);
    if (n) return { value: Number(n[1].replace(",", ".")), index: n.index, length: n[0].length, moneda: false };
  }
  return null;
}

// ── Clasificación ────────────────────────────────────────────

export function scores(text: string, opts: CaptureOptions = {}): Record<Tipo, number> {
  const now = opts.now ?? new Date();
  const tz = validTz(opts.tz);
  const f = fold(text).trim();
  const pasado = PASADO_F.test(f);
  const fecha = pasado ? null : findFecha(text, now, tz);
  const s = Object.fromEntries(Object.keys(TIPOS).map((k) => [k, 0])) as Record<Tipo, number>;
  s.nota = pasado ? 4 : 1;

  if (URL.test(f)) s.enlace += 10;
  if (parseDivision(text)) s.dividir += 9;
  if (parseCalculo(text)) s.calculo += 8;
  if (parseConversion(text)) s.conversion += 8;
  if (parseTemporizador(text)) {
    if (TEMPORIZADOR_F.test(f)) s.temporizador += 9;
    // "pasta 12 min": frase corta con una duración y sin fecha.
    else if (!fecha && f.split(/\s+/).length <= 3) s.temporizador += 5;
  }
  if (RECORDAR_F.test(f)) s.recordatorio += 8;
  if (fecha) {
    s.recordatorio += 2;
    if (VERBO_ACCION.test(f)) s.recordatorio += 3;
  }
  if (EVENTO_F.test(f)) s.evento += fecha ? 6 : 3;
  else if (fecha && /\bcon [a-z]/.test(f)) s.evento += 4.5;
  if (LISTA_INICIO.test(f)) s.lista += 3;
  const seps = (f.match(/,|;|\n|\sy\s/g) ?? []).length;
  if (seps >= 2) s.lista += 4;
  else if (seps === 1 && s.lista > 0) s.lista += 2;
  const importe = findImporte(text);
  if (importe) s.gasto += importe.moneda ? 5 : 4;
  if (GASTO_VERBO_F.test(f)) s.gasto += 4;
  if (/\?\s*$/.test(f) || text.trim().startsWith("¿")) s.pregunta += 6;
  else if (PREGUNTA_INICIO.test(f)) s.pregunta += 4;
  return s;
}

export function classify(text: string, opts: CaptureOptions = {}): { tipo: Tipo; score: number } {
  const s = scores(text, opts);
  const tipo = PRIORIDAD.reduce((a, b) => (s[b] > s[a] ? b : a));
  return { tipo, score: s[tipo] };
}

// ── Construcción ─────────────────────────────────────────────

const formatEuros = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + " €";

export function buildCaptura(text: string, tipo: Tipo, opts: CaptureOptions & { fuente?: Captura["fuente"] } = {}): Captura {
  const now = opts.now ?? new Date();
  const tz = validTz(opts.tz);
  const original = text.replace(/\s+/g, " ").trim();
  const usaFecha = tipo === "recordatorio" || tipo === "evento";
  const fecha = usaFecha ? findFecha(original, now, tz) : null;

  let rest = fecha ? removeRange(original, fecha.index, fecha.text.length) : original;
  rest = rest.replace(RECORDAR, " ");

  let items: string[] = [];
  let importe: number | null = null;
  let resultado: string | null = null;
  let segundos: number | null = null;
  let titulo: string;
  /** Las herramientas dan un mensaje corto con la respuesta ("🧮 15% de 80 = 12"). */
  let mensajeHerramienta: string | null = null;
  const { emoji, etiqueta } = TIPOS[tipo];

  switch (tipo) {
    case "calculo": {
      const c = parseCalculo(original);
      titulo = c?.expresion ?? original;
      resultado = c ? formatNum(c.resultado) : null;
      mensajeHerramienta = `${emoji} ${titulo} = ${resultado ?? "?"}`;
      break;
    }
    case "conversion": {
      const c = parseConversion(original);
      titulo = c ? `${formatNum(c.valor)} ${etiquetaUnidad(c.de)} → ${etiquetaUnidad(c.a)}` : original;
      resultado = c ? `${formatNum(c.resultado)} ${etiquetaUnidad(c.a)}` : null;
      mensajeHerramienta = c ? `${emoji} ${formatNum(c.valor)} ${etiquetaUnidad(c.de)} = ${resultado}` : `${emoji} ${original}`;
      break;
    }
    case "dividir": {
      const d = parseDivision(original);
      importe = d?.total ?? null;
      titulo = d ? `${formatEuros(d.total)} entre ${d.personas}` : original;
      resultado = d ? `${formatEuros(d.porPersona)} cada uno` : null;
      mensajeHerramienta = `${emoji} ${titulo} = ${resultado ?? "?"}`;
      break;
    }
    case "temporizador": {
      const t = parseTemporizador(original);
      segundos = t?.segundos ?? null;
      titulo = t?.etiqueta || etiqueta;
      resultado = segundos ? formatDuracion(segundos) : null;
      mensajeHerramienta = `${emoji} ${titulo} — ${resultado ?? "?"}`;
      break;
    }
    case "lista": {
      const cuerpo = rest.trim().replace(LISTA_INICIO, "");
      items = cuerpo
        .split(/\s*(?:,|;|\n|\s+y\s+|\s+e\s+)\s*/i)
        .map((i) => tidyEs(i.replace(/[.!]+$/, "")))
        .filter(Boolean)
        .map(capitalize);
      titulo = /compr/i.test(fold(original)) ? "Lista de la compra" : "Lista";
      break;
    }
    case "gasto": {
      const imp = findImporte(rest);
      if (imp) {
        importe = imp.value;
        rest = removeRange(rest, imp.index, imp.length);
      }
      titulo = capitalize(tidyEs(rest.replace(GASTO_VERBO, " "))) || "Gasto";
      break;
    }
    case "enlace":
      titulo = URL.exec(original)?.[0] ?? original;
      break;
    case "pregunta":
      titulo = capitalize(original.replace(/^¿\s*/, "").replace(/\s*\?*$/, "")) + "?";
      break;
    default:
      // "avísame en 10 minutos": sin la fecha y la palabra clave no queda nada.
      titulo = capitalize(tidyEs(rest)) || (tipo === "recordatorio" ? "Aviso" : capitalize(original));
  }

  const fecha_texto = fecha ? textoFecha(tz, fecha.start, now) : null;
  let mensaje = mensajeHerramienta ?? `${emoji} ${etiqueta}: ${titulo}`;
  if (!mensajeHerramienta) {
    if (fecha_texto) mensaje += ` — ${fecha_texto}`;
    if (items.length) mensaje += ` — ${items.join(", ")}`;
    if (importe !== null) mensaje += ` — ${formatEuros(importe)}`;
  }

  let fecha_local: string | null = null;
  if (fecha) {
    const p = partsIn(tz, fecha.start);
    fecha_local = `${pad(p.d)}/${pad(p.m)}/${p.y} ${pad(p.h)}:${pad(p.min)}`;
  }

  return {
    tipo,
    accion: ACCION[tipo],
    emoji,
    etiqueta,
    titulo,
    texto: original,
    fecha: fecha ? isoLocal(tz, fecha.start) : null,
    fecha_local,
    fecha_texto,
    tiene_hora: fecha?.hasTime ?? false,
    items,
    importe,
    resultado,
    segundos,
    minutos: segundos === null ? null : Math.round((segundos / 60) * 100) / 100,
    mensaje,
    fuente: opts.fuente ?? "reglas",
  };
}

export function capture(text: string, opts: CaptureOptions = {}): Captura {
  return buildCaptura(text, classify(text, opts).tipo, opts);
}
