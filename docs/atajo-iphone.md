# Atajo de iPhone: doble toque → apuntar

Un **Atajo** de iOS pide el texto, lo manda a `/api/capture` (entiende español) y hace lo que
toque. Los nombres de las acciones están en inglés (iPhone en inglés).

## Idea clave: solo "has any value"

El editor de Atajos se lía con los tipos (sale *File Size*, *Number MB*…) y a menudo no ofrece
la condición *is*. Por eso la API manda **una clave por acción, solo cuando toca**:

| clave | aparece cuando… | el Atajo hace |
|---|---|---|
| `si_temporizador` | es un temporizador (valor: minutos) | **Start Timer** |
| `si_recordatorio` | es un recordatorio (valor: fecha) | **Add New Reminder** |
| `si_evento` | es un evento con fecha (valor: fecha) | **Add New Event** |
| `si_abrir` | es un mensaje o una ruta (valor: URL) | **Open URLs** |
| `si_guardar` | es una nota, lista, gasto, pregunta… (valor: texto) | **Append to Note** |

Cuentas, conversiones y repartos no traen ninguna: basta con la notificación.

Cada bloque del Atajo es siempre igual:

```
Get Value for si_XXX in Contents of URL
If [Dictionary Value] has any value      ← no hace falta tocar la condición
    (la acción)
Otherwise
End If
```

Si la variable del *If* sale como *File Size* u otro tipo raro, da igual: con *has any value*
funciona. Si la condición cambió a *is*, tócala y vuelve a poner **has any value**.

Para elegir una variable: toca el hueco → **Select Variable** → toca **la tarjeta de la acción**
que quieres (así nunca te equivocas de "Dictionary Value").

## Parte 1 — lo básico (ya lo tienes)

1. **Ask for Input** — Prompt `¿Qué quieres apuntar?`, tipo *Text*.
2. **Get Contents of URL** (buscar `contents`)
   - URL `https://appnotes-ebon.vercel.app/api/capture`
   - Method **POST** · Headers `Authorization` = `Bearer <CAPTURE_TOKEN>`
   - Request Body **JSON**: `text` = *Ask for Input* · `tz` = `Europe/Madrid`
3. **Get Dictionary Value** — `mensaje` in *Contents of URL*
4. **Show Notification** — la tarjeta del paso 3

Toque posterior: **Settings → Accessibility → Touch → Back Tap → Double Tap → Apuntar**.

## Parte 2 — bloques de acciones

Añádelos al final, debajo de *Show Notification*, en el orden que quieras. Cada uno es
independiente: si uno falla, los demás siguen funcionando.

### ⏲️ Temporizador
```
Get Value for si_temporizador in Contents of URL
If [si_temporizador] has any value
    Start Timer for [si_temporizador] minutes
End If
```

### 💬 Mensajes y 🗺️ rutas
```
Get Value for si_abrir in Contents of URL
If [si_abrir] has any value
    Open URLs [si_abrir]
End If
```
Abre WhatsApp o Mensajes **con el texto ya escrito** (tú eliges el chat y pulsas enviar), o
Apple Maps con la ruta.

### 📝 Guardar en Notas
Crea antes en **Notes** una nota llamada `Capturas`.
```
Get Value for si_guardar in Contents of URL
If [si_guardar] has any value
    Append [si_guardar] to note Capturas
End If
```

### ⏰ Recordatorios
```
Get Value for si_recordatorio in Contents of URL
If [si_recordatorio] has any value
    Get Value for titulo in Contents of URL
    Add New Reminder [titulo]  → activa Alert → fecha: [si_recordatorio]
End If
```

### 📅 Eventos
```
Get Value for si_evento in Contents of URL
If [si_evento] has any value
    Get Value for titulo in Contents of URL
    Add New Event [titulo]  → Starts: [si_evento]
End If
```

Las acciones nuevas se añaden abajo del todo: **mantenlas pulsadas y arrástralas** dentro del *If*.

## Qué entiende

| Escribes | Resultado |
|---|---|
| recuérdame llamar a mamá mañana a las 9 | ⏰ Recordatorio mañana 9:00 |
| recuérdame comprar pan | ⏰ Recordatorio dentro de una hora |
| cena con Laura el viernes a las 21:30 | 📅 Evento en el Calendario |
| comprar leche, huevos y pan | 🛒 Lista → nota Capturas |
| gasté 12,50 € en gasolina | 💸 Gasto → nota Capturas |
| 15% de 80 · 100 € con IVA · 23*4+10 | 🧮 Resultado en la notificación |
| 5 millas a km · 30 grados a fahrenheit | 📏 Resultado en la notificación |
| 80 € entre 4 · 90 € entre Ana, Luis y yo | 💶 Cuánto paga cada uno |
| pasta 12 min · temporizador media hora | ⏲️ Temporizador en el Reloj |
| dile a Marta que llego 10 min tarde | 💬 Mensajes con el texto escrito |
| manda un whatsapp a Pablo que ya estoy abajo | 💬 WhatsApp con el texto escrito |
| cómo llego al Camp Nou | 🗺️ Ruta en Apple Maps |

## Si algo falla

- **Ver qué responde la API:** añade temporalmente **Quick Look** con *Contents of URL* justo
  después del paso 2. Enseña la respuesta entera.
- **"No autorizado":** la cabecera debe ser `Authorization` y el valor empezar por `Bearer `.
- **Error 400:** la clave del JSON debe ser `text`, en minúsculas.

## Respuesta de ejemplo

`pasta 12 min` →

```json
{
  "tipo": "temporizador",
  "accion": "temporizador",
  "emoji": "⏲️",
  "etiqueta": "Temporizador",
  "titulo": "Pasta",
  "texto": "pasta 12 min",
  "tiene_hora": false,
  "items": [],
  "resultado": "12 min",
  "segundos": 720,
  "minutos": 12,
  "mensaje": "⏲️ Pasta — 12 min",
  "fuente": "reglas",
  "si_temporizador": 12
}
```

Código: `src/lib/capture/index.ts` (clasificación y respuesta), `src/lib/capture/herramientas.ts`
(calculadora, conversor, dividir, temporizador, mensajes, rutas). Tests en
`src/lib/__tests__/capture.test.ts`. Aciertos: `bun scripts/laya/reglas.ts scripts/laya/frases-nuevas.json`.
