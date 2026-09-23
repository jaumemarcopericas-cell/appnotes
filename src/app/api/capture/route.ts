import { z } from "zod";
import { buildCaptura, classify, respuestaAtajo, type Tipo } from "@/lib/capture";
import { classifierMode, classifyWithJev } from "@/lib/jev/client";
import type { IntentKey } from "@/lib/jev/types";

export const runtime = "nodejs";

/**
 * Entrada del Atajo de iOS: POST { text, tz? } → Captura (JSON con claves en español).
 * Si CAPTURE_TOKEN está definido, exige `Authorization: Bearer <token>`.
 */
const bodySchema = z.object({ text: z.string().trim().min(1).max(2000), tz: z.string().max(64).optional() });

const DESDE_JEV: Partial<Record<IntentKey, Tipo>> = {
  reminder: "recordatorio",
  event: "evento",
  todo: "lista",
  expense: "gasto",
  link: "enlace",
};

export async function POST(request: Request) {
  const token = process.env.CAPTURE_TOKEN?.trim();
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Esperaba { "text": "..." }' }, { status: 400 });
  const { text, tz } = body.data;

  const reglas = classify(text, { tz });

  // Las reglas en español mandan; Jev solo desempata cuando no han reconocido nada.
  if (reglas.tipo === "nota" && classifierMode().mode === "online") {
    try {
      const jev = await classifyWithJev(text, request.signal);
      const tipo = DESDE_JEV[jev.intent.value];
      if (tipo && jev.intent.confidence >= 0.7) return Response.json(respuestaAtajo(buildCaptura(text, tipo, { tz, fuente: "jev" })));
    } catch (err) {
      console.warn(`[capture] Jev falló, uso reglas: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return Response.json(respuestaAtajo(buildCaptura(text, reglas.tipo, { tz })));
}
