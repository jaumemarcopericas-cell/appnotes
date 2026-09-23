# Prototipo en iPhone: doble toque → apuntar

Prototipo sin app nativa: un **Atajo** de iOS pide el texto, lo manda a `/api/capture`
(entiende español) y hace lo que toque según el campo `accion` de la respuesta.

```
Doble toque detrás → Atajo "Apuntar"
  → "¿Qué quieres apuntar?"
  → POST /api/capture  { text, tz }
  → accion = recordatorio  → app Reminders (con alerta)
             evento        → app Calendar
             temporizador  → Clock (Start Timer)
             guardar       → nota "Capturas" en Notes
             mostrar       → nada, solo la notificación (cuentas, conversiones, repartos)
  → notificación con el mensaje
```

Los nombres de las acciones están en inglés (iPhone en inglés).

## 1. API

Desplegada en Vercel: `https://appnotes-ebon.vercel.app/api/capture`.
Variables de entorno en Vercel: `CAPTURE_TOKEN` (obligatoria) y `TYPESAFE_API_KEY` (opcional, Jev).

## 2. Fase 1 — Atajo mínimo

App **Shortcuts** → **+** → nombre **Apuntar**:

1. **Ask for Input** — Prompt `¿Qué quieres apuntar?`, tipo *Text*.
2. **Get Contents of URL** (buscar `contents`; no es *Get Component of URL*)
   - URL: `https://appnotes-ebon.vercel.app/api/capture`
     (si aparece sola la variable *Ask for Input* en la URL, bórrala con ⌫ dos veces)
   - Method **POST**
   - Headers: `Authorization` = `Bearer <CAPTURE_TOKEN>`
   - Request Body **JSON**: `text` = variable *Ask for Input*; `tz` = `Europe/Madrid`
3. **Get Dictionary Value** — key `mensaje` in *Contents of URL*.
4. **Show Notification** — texto: variable *Dictionary Value*.

Asignar: **Settings → Accessibility → Touch → Back Tap → Double Tap → Apuntar**.

## 3. Fase 2 — que haga cosas

Crea antes en **Notes** una nota llamada `Capturas`.

Entre los pasos 3 y 4 añade más **Get Dictionary Value** (siempre sobre *Contents of URL*) y
renombra cada resultado (tócalo → **Rename**):

| key | renombrar a |
|---|---|
| `accion` | Accion |
| `titulo` | Titulo |
| `fecha` | Fecha |
| `minutos` | Minutos |

Usa `fecha` (ISO), no `fecha_local`: con el iPhone en inglés `24/09` se leería como mes/día.

Después:

- **If** *Accion* **is** `recordatorio`
  - **Add New Reminder** → *Titulo*, activa **Alert** → *Fecha*
- **Otherwise** → **If** *Accion* **is** `evento`
  - **Add New Event** → *Titulo*, **Starts** *Fecha*
- **Otherwise** → **If** *Accion* **is** `temporizador`
  - **Start Timer** → *Minutos* **minutes**
- **Otherwise** → **If** *Accion* **is** `guardar`
  - **Append to Note** → la variable del paso 3 (mensaje) → nota *Capturas*
- (`mostrar` no necesita nada: la notificación ya lleva el resultado)

**Show Notification** queda al final, fuera de los *If*.

## Qué entiende

| Escribes | tipo | accion | mensaje |
|---|---|---|---|
| recuérdame llamar a mamá mañana a las 9 | recordatorio | recordatorio | ⏰ Recordatorio: Llamar a mamá — mañana a las 9:00 |
| cena con Laura el viernes a las 21:30 | evento | evento | 📅 Evento: Cena con Laura — … a las 21:30 |
| comprar leche, huevos y pan | lista | guardar | 🛒 Lista: Lista de la compra — Leche, Huevos, Pan |
| gasté 12,50 € en gasolina | gasto | guardar | 💸 Gasto: Gasolina — 12,50 € |
| ¿cuánto dura el pasaporte? | pregunta | guardar | ❓ Pregunta: … |
| 15% de 80 · 100 € con IVA · 23*4+10 | calculo | mostrar | 🧮 15% de 80 = 12 |
| 5 millas a km · cuántos km son 10 millas | conversion | mostrar | 📏 5 mi = 8,05 km |
| 80 € entre 4 · cena a medias 45 € | dividir | mostrar | 💶 80 € entre 4 = 20 € cada uno |
| pasta 12 min · temporizador media hora | temporizador | temporizador | ⏲️ Pasta — 12 min |

## Respuesta completa

```json
{
  "tipo": "temporizador",
  "accion": "temporizador",
  "emoji": "⏲️",
  "titulo": "Pasta",
  "fecha": null,
  "fecha_local": null,
  "fecha_texto": null,
  "tiene_hora": false,
  "items": [],
  "importe": null,
  "resultado": "12 min",
  "segundos": 720,
  "minutos": 12,
  "mensaje": "⏲️ Pasta — 12 min",
  "fuente": "reglas"
}
```

Reglas: `src/lib/capture/index.ts` (clasificación) y `src/lib/capture/herramientas.ts`
(calculadora, conversor, dividir, temporizador). Ejemplos en `src/lib/__tests__/capture.test.ts`.
Medir aciertos: `bun scripts/laya/reglas.ts scripts/laya/frases-nuevas.json`.
