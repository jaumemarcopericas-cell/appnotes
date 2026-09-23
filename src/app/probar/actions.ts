"use server";

import { capture, respuestaAtajo, type RespuestaAtajo } from "@/lib/capture";

/**
 * Clasifica una frase con las mismas reglas que /api/capture. Solo reglas (nunca Jev), así que no
 * necesita el CAPTURE_TOKEN: no gasta nada ni guarda nada.
 */
export async function probarFrase(text: string, tz?: string): Promise<RespuestaAtajo | null> {
  const t = text.trim().slice(0, 2000);
  if (!t) return null;
  return respuestaAtajo(capture(t, { tz }));
}
