"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { RespuestaAtajo } from "@/lib/capture";
import { probarFrase } from "./actions";

const EJEMPLOS = [
  "recuérdame llamar a mamá mañana a las 9",
  "cena con Laura el viernes a las 21:30",
  "comprar leche, huevos y pan",
  "15% de 80",
  "80 € entre 4",
  "pasta 12 min",
  "dile a Marta que llego 10 min tarde",
  "cómo llego al Camp Nou",
];

/** Qué haría el Atajo con cada acción, en lenguaje llano. */
const QUE_HARIA: Record<string, string> = {
  recordatorio: "Crea un recordatorio con aviso en la app Recordatorios",
  evento: "Crea un evento en el Calendario",
  temporizador: "Pone un temporizador en el Reloj",
  abrir: "Abre la app con todo preparado (tú confirmas)",
  guardar: "Lo añade a la nota «Capturas»",
  mostrar: "Solo muestra el resultado en la notificación",
};

// Historial en localStorage como store externo: el servidor pinta la lista vacía y el cliente la
// rellena sin setState en un efecto. Si no hay almacenamiento (modo privado), vive en memoria.
const HISTORIAL_KEY = "apuntar:probar:historial";
const oyentes = new Set<() => void>();
let enMemoria = "[]";

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

function leerHistorial(): string {
  try {
    return localStorage.getItem(HISTORIAL_KEY) ?? "[]";
  } catch {
    return enMemoria;
  }
}

function guardarHistorial(h: RespuestaAtajo[]) {
  enMemoria = JSON.stringify(h.slice(0, 20));
  try {
    localStorage.setItem(HISTORIAL_KEY, enMemoria);
  } catch {
    // Sin almacenamiento: nos quedamos con la copia en memoria.
  }
  oyentes.forEach((o) => o());
}

function parseHistorial(raw: string): RespuestaAtajo[] {
  try {
    const h = JSON.parse(raw);
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

export function Probar() {
  const [texto, setTexto] = useState("");
  const [actual, setActual] = useState<RespuestaAtajo | null>(null);
  const raw = useSyncExternalStore(suscribir, leerHistorial, () => "[]");
  const historial = useMemo(() => parseHistorial(raw), [raw]);
  const [verJson, setVerJson] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function enviar(frase: string) {
    if (!frase.trim()) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    startTransition(async () => {
      const r = await probarFrase(frase, tz);
      if (!r) return;
      setActual(r);
      setTexto("");
      guardarHistorial([r, ...parseHistorial(leerHistorial()).filter((p) => p.texto !== r.texto)]);
      inputRef.current?.focus();
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Apuntar · probar frases</h1>
        <p className="text-sm text-muted-foreground">
          Lo mismo que hace el doble toque, pero aquí. Escribe como le hablarías al móvil.
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="¿Qué quieres apuntar?"
          aria-label="¿Qué quieres apuntar?"
          autoFocus
          enterKeyHint="send"
          className="h-12 min-w-0 flex-1 rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pending || !texto.trim()}
          className="h-12 shrink-0 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {pending ? "…" : "Probar"}
        </button>
      </form>

      {!actual && (
        <div className="flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => enviar(e)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {actual && (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {actual.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{actual.etiqueta}</p>
              <p className="truncate text-lg font-semibold">{actual.titulo}</p>
            </div>
          </div>

          <Detalles r={actual} />

          <p className="rounded-md bg-secondary px-3 py-2 text-sm">
            <span className="font-medium">El Atajo: </span>
            {QUE_HARIA[actual.accion ?? ""] ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Notificación: <span className="text-foreground">{actual.mensaje}</span>
          </p>

          <button type="button" onClick={() => setVerJson((v) => !v)} className="self-start text-xs text-muted-foreground underline">
            {verJson ? "Ocultar respuesta de la API" : "Ver respuesta de la API"}
          </button>
          {verJson && (
            <pre className="overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(actual, null, 2)}
            </pre>
          )}
        </section>
      )}

      {historial.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Probadas</h2>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => guardarHistorial([])}
            >
              Borrar
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {historial.map((h) => (
              <li key={h.texto}>
                <button
                  type="button"
                  onClick={() => setActual(h)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left"
                >
                  <span aria-hidden>{h.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{h.texto}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{h.etiqueta}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Detalles({ r }: { r: RespuestaAtajo }) {
  const filas: [string, string][] = [];
  if (r.fecha_texto) filas.push(["Cuándo", r.fecha_texto + (r.tiene_hora ? "" : " (hora por defecto)")]);
  if (r.resultado) filas.push([r.tipo === "mensaje" ? "Texto" : "Resultado", r.resultado]);
  if (r.contacto) filas.push(["Para", r.contacto]);
  if (r.importe != null && r.tipo === "gasto") filas.push(["Importe", `${r.importe.toLocaleString("es-ES")} €`]);
  if (r.items?.length) filas.push(["Elementos", r.items.join(", ")]);
  if (!filas.length) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
