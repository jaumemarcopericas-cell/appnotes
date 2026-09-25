import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Memoria, NuevaMemoria } from "./entender";

/**
 * Dónde viven las memorias.
 *
 * - En Vercel: Redis (Upstash) por su API REST, sin dependencias. Se activa al conectar una base
 *   Redis al proyecto desde Vercel → Storage, que define KV_REST_API_URL/TOKEN (o las UPSTASH_*).
 * - En local (fuera de Vercel): un JSON en .data/memorias.json, para probar sin nada más.
 * - En Vercel sin Redis conectado: null, y la API avisa de que falta la base de datos.
 */
export interface MemoriaStore {
  todas(): Promise<Memoria[]>;
  guardar(m: NuevaMemoria): Promise<Memoria>;
  borrar(id: string): Promise<void>;
}

const CLAVE = "apuntar:memorias";

function nueva(m: NuevaMemoria): Memoria {
  return { ...m, id: randomUUID(), creada: new Date().toISOString() };
}

class RedisStore implements MemoriaStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async cmd<T>(...args: string[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const json = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis: ${json.error ?? res.status}`);
    return json.result as T;
  }

  async todas() {
    // HGETALL devuelve [campo, valor, campo, valor, ...]
    const plano = (await this.cmd<string[]>("HGETALL", CLAVE)) ?? [];
    const out: Memoria[] = [];
    for (let i = 1; i < plano.length; i += 2) {
      try {
        out.push(JSON.parse(plano[i]) as Memoria);
      } catch {
        // Una entrada corrupta no debe romper la búsqueda.
      }
    }
    return out;
  }

  async guardar(m: NuevaMemoria) {
    const memoria = nueva(m);
    await this.cmd("HSET", CLAVE, memoria.id, JSON.stringify(memoria));
    return memoria;
  }

  async borrar(id: string) {
    await this.cmd("HDEL", CLAVE, id);
  }
}

class ArchivoStore implements MemoriaStore {
  private file = path.join(process.cwd(), ".data", "memorias.json");

  async todas(): Promise<Memoria[]> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as Memoria[];
    } catch {
      return [];
    }
  }

  private async escribir(ms: Memoria[]) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(ms, null, 2), "utf8");
  }

  async guardar(m: NuevaMemoria) {
    const memoria = nueva(m);
    await this.escribir([...(await this.todas()), memoria]);
    return memoria;
  }

  async borrar(id: string) {
    await this.escribir((await this.todas()).filter((m) => m.id !== id));
  }
}

export function getStore(): MemoriaStore | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisStore(url, token);
  if (!process.env.VERCEL) return new ArchivoStore();
  return null;
}
