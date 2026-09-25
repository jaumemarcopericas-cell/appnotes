"use server";

import { capture, respuestaAtajo, type RespuestaAtajo } from "@/lib/capture";

/**
 * Clasifica una frase con las mismas reglas que /api/capture. Solo reglas (nunca Jev), así que no
 * necesita el CAPTURE_TOKEN: no gasta nada ni guarda nada.
 *
 * La página es pública, así que tampoco toca la memoria de nombres: dice qué se guardaría o
 * buscaría, pero ni lee ni escribe en la base de datos.
 */
export async function probarFrase(text: string, tz?: string): Promise<RespuestaAtajo | null> {
  const t = text.trim().slice(0, 2000);
  if (!t) return null;
  const c = capture(t, { tz });
  if (c.tipo === "memoria") c.mensaje += " (en /probar no se guarda: usa el doble toque)";
  if (c.tipo === "buscar") c.mensaje = `🔎 Buscaría «${c.titulo}» en tus nombres (solo con el doble toque)`;
  if (c.tipo === "olvidar") c.mensaje = `🗑️ Olvidaría «${c.titulo}» (solo con el doble toque)`;
  return respuestaAtajo(c);
}
