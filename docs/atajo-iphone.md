# Prototipo en iPhone: doble toque → apuntar

Prototipo sin app nativa: un **Atajo** de iOS pide el texto, lo manda a `/api/capture`
(clasifica en español) y lo guarda en Recordatorios, Calendario o Notas según el tipo.

```
Doble toque detrás → Atajo "Apuntar"
  → "¿Qué quieres apuntar?"
  → POST /api/capture  { text, tz }
  → recordatorio → app Recordatorios (con alerta)
    evento       → app Calendario
    resto        → nota "Capturas" en Notas
  → notificación: "⏰ Recordatorio: Llamar a mamá — mañana a las 9:00"
```

## 1. Publicar la API

El iPhone necesita una URL pública, así que despliega este repo en **tu** cuenta de Vercel:

1. Crea un repo vacío en GitHub y sube este proyecto.
2. En vercel.com → *Add New → Project* → importa el repo.
3. En *Settings → Environment Variables* añade:
   - `CAPTURE_TOKEN`: una contraseña larga inventada (protege tu endpoint).
   - `TYPESAFE_API_KEY` (opcional): activa Jev cuando las reglas en español no reconocen nada.

Tu endpoint quedará en `https://<tu-proyecto>.vercel.app/api/capture`.

> Para probar sin desplegar: con el iPhone y el PC en la misma wifi, arranca
> `npx next dev -H 0.0.0.0` y usa `http://<IP-de-tu-PC>:3000/api/capture`.

## 2. Crear el Atajo (app Atajos → **+**)

Nombre: **Apuntar**. Acciones, en orden:

1. **Solicitar entrada**: Texto. Pregunta: `¿Qué quieres apuntar?`
2. **Obtener contenido de URL**
   - URL: `https://<tu-proyecto>.vercel.app/api/capture`
   - Método: **POST**
   - Cabeceras: `Authorization` = `Bearer <tu CAPTURE_TOKEN>`
   - Cuerpo de la solicitud: **JSON**
     - `text` (Texto) = *Entrada proporcionada*
     - `tz` (Texto) = `Europe/Madrid`
3. **Obtener valor del diccionario**: clave `tipo` → renómbralo a *Tipo*.
4. **Obtener valor del diccionario**: clave `titulo` (del *Contenido de la URL*) → *Titulo*.
5. **Obtener valor del diccionario**: clave `fecha_local` → *Fecha*.
6. **Obtener valor del diccionario**: clave `mensaje` → *Mensaje*.
7. **Si** *Tipo* **es** `recordatorio`
   - **Añadir nuevo recordatorio**: título *Titulo*, alerta *Fecha*.
8. **Si no** → **Si** *Tipo* **es** `evento`
   - **Añadir nuevo evento**: título *Titulo*, inicio *Fecha*.
9. **Si no**
   - **Añadir a nota**: *Mensaje* a la nota `Capturas` (créala antes en Notas).
10. Al final (fuera de los *Si*): **Mostrar notificación** con *Mensaje*.

Si la hora sale mal en Recordatorios, cambia la clave `fecha_local` por `fecha` (ISO 8601).

Opcional para el tipo `pregunta`: si tu iPhone tiene Apple Intelligence, añade la acción
**Usar modelo** con *Titulo* y muestra la respuesta.

## 3. Asignarlo al doble toque

Ajustes → Accesibilidad → Tocar → **Toque posterior** → **Doble toque** → *Apuntar*.

## Qué devuelve la API

```json
{
  "tipo": "recordatorio",
  "emoji": "⏰",
  "titulo": "Llamar a mamá",
  "fecha": "2026-09-24T09:00:00+02:00",
  "fecha_local": "24/09/2026 09:00",
  "fecha_texto": "mañana a las 9:00",
  "tiene_hora": true,
  "items": [],
  "importe": null,
  "mensaje": "⏰ Recordatorio: Llamar a mamá — mañana a las 9:00",
  "fuente": "reglas"
}
```

Tipos: `recordatorio`, `evento`, `lista` (con `items`), `gasto` (con `importe`), `pregunta`,
`enlace`, `nota`. Las reglas están en `src/lib/capture/index.ts` y los ejemplos en
`src/lib/__tests__/capture.test.ts`.
