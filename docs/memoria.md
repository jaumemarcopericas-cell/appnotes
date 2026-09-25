# Memoria de nombres

Guardar quién es quién y dónde, y preguntarlo semanas después con el doble toque.
**No hay que tocar el Atajo:** la respuesta llega en la notificación que ya tienes.

## Guardar

| Escribes | Se guarda |
|---|---|
| el camarero del Bar Pepe se llama Luis | 📇 Luis — camarero del Bar Pepe |
| Ana es la cocinera del Bar Pepe | 📇 Ana — cocinera del Bar Pepe |
| Marta trabaja en la farmacia de la plaza | 📇 Marta — trabaja en la farmacia de la plaza |
| Marta trabaja de enfermera en el hospital del Mar | 📇 Marta — enfermera en el hospital del Mar |
| en Cadaqués conocí a Joan, el del hotel | 📇 Joan — del hotel (Cadaqués) |
| conocí a Joan en Cadaqués | 📇 Joan — conocido en Cadaqués |
| el pueblo de la paella buenísima se llamaba Altea | 📇 Altea — pueblo de la paella buenísima |
| apunta que luis es el camarero del bar pepe | 📇 Luis — camarero del bar pepe |

Con "X es el/la…" el nombre tiene que ir en mayúscula (`Luis es el camarero…`) o empezar con
*apunta que / guarda que / recuerda que*. Así "mañana es el cumple de Pablo" no se guarda como
si "mañana" fuera una persona.

## Preguntar

| Escribes | Respuesta |
|---|---|
| ¿cómo se llamaba el camarero del Bar Pepe? | 🔎 Luis — camarero del Bar Pepe |
| Bar Pepe | 🔎 todos los del Bar Pepe |
| voy a Cadaqués, cómo se llamaba el del hotel? | 🔎 Joan — del hotel (Cadaqués) |
| quién trabaja en la farmacia? | 🔎 Marta — trabaja en la farmacia de la plaza |
| Cadaqués | 🔎 todo lo guardado en Cadaqués |

Da igual escribir con o sin acentos o mayúsculas, y aguanta una errata ("camarrero").
Una frase corta (hasta 4 palabras) que coincide con algo guardado se trata como pregunta.

## Conectar la base de datos (una vez, 3 minutos)

Sin base de datos la API contesta *"⚠️ No se ha guardado: falta conectar la base de datos"*.

1. Entra en vercel.com → proyecto **appnotes** → pestaña **Storage**.
2. **Create Database** (o *Connect Store*) → elige **Upstash** → **Redis** (plan gratuito).
3. Región: la más cercana (p. ej. Frankfurt, `eu-central-1`). Nombre: `apuntar`.
4. Conéctala al proyecto **appnotes** con los entornos marcados (Production, Preview, Development).
   Vercel añade solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
5. **Deployments** → los tres puntos del último despliegue → **Redeploy**. Las variables nuevas
   solo se aplican a despliegues nuevos.

La API también acepta `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` si prefieres crear
la base directamente en upstash.com y copiar las variables a mano.

En local no hace falta nada: se guarda en `.data/memorias.json` (ignorado por git).

## Privacidad

Los nombres viven en **tu** base de datos Redis. Solo se leen y escriben a través de
`/api/capture`, que exige tu `CAPTURE_TOKEN`. La página pública `/probar` nunca los lee ni los
guarda: solo dice qué se guardaría o buscaría.

## Código

- `src/lib/memoria/entender.ts`: detectar si guardas o preguntas, sacar nombre y descripción,
  buscar (sin acentos, plurales sencillos, una errata).
- `src/lib/memoria/store.ts`: Redis por REST en Vercel, archivo JSON en local.
- `src/lib/memoria/servicio.ts`: guarda o busca y rellena la respuesta.
- Tests: `src/lib/__tests__/memoria.test.ts`.
