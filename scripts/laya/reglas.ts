// Clasifica un lote de frases con las reglas actuales.
// Uso: bun scripts/laya/reglas.ts [frases.json] [--json]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classify } from "@/lib/capture";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? join(import.meta.dir, "frases.json");
const frases = JSON.parse(readFileSync(file, "utf8")) as [string, string][];
const out = frases.map(([texto, esperado]) => ({ texto, esperado, tipo: classify(texto).tipo }));

if (args.includes("--json")) {
  console.log(JSON.stringify(out));
} else {
  const fallos = out.filter((r) => r.tipo !== r.esperado);
  for (const r of fallos) console.log(`✗ ${r.texto}  →  ${r.tipo} (esperado ${r.esperado})`);
  const ok = out.length - fallos.length;
  console.log(`\n${ok}/${out.length} (${Math.round((ok / out.length) * 100)}%)`);
}
