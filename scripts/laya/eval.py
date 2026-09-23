"""Compara Laya (checkpoint multilingüe) con las reglas en español sobre frases.json.

Uso:
    python -m pip install laya
    bun scripts/laya/reglas.ts --json > reglas.json
    python scripts/laya/eval.py reglas.json
"""
import json
import sys
import time
from pathlib import Path

import laya

HERE = Path(__file__).parent
FRASES = json.loads((HERE / "frases.json").read_text(encoding="utf-8"))

# Mismas descripciones en dos idiomas: el modelo se entrenó sobre todo con instrucciones en inglés.
PREGUNTAS = {
    "en": {
        "tipo": {
            "type": "choice",
            "instructions": "What kind of quick note did the user just type into their phone?",
            "criteria": {
                "recordatorio": "a task to do at some time: call, pay, send, take, renew, remind me",
                "evento": "an appointment or plan with a date: dinner, meeting, dentist, birthday, flight, match",
                "lista": "a list of several items, e.g. a shopping list or things to pack",
                "gasto": "money already spent or a price paid, an expense",
                "pregunta": "a question the user wants answered",
                "enlace": "a web link or URL to save",
                "nota": "an idea, thought, quote or anything else to remember",
            },
        }
    },
    "es": {
        "tipo": {
            "type": "choice",
            "instructions": "¿Qué tipo de nota rápida acaba de escribir el usuario en su móvil?",
            "criteria": {
                "recordatorio": "una tarea para hacer en un momento: llamar, pagar, enviar, tomar, renovar, recuérdame",
                "evento": "una cita o plan con fecha: cena, reunión, dentista, cumpleaños, vuelo, partido",
                "lista": "una lista de varias cosas, como la lista de la compra o cosas para la maleta",
                "gasto": "dinero gastado o un precio pagado, un gasto",
                "pregunta": "una pregunta que el usuario quiere que le respondan",
                "enlace": "un enlace o dirección web para guardar",
                "nota": "una idea, pensamiento, frase o cualquier otra cosa para recordar",
            },
        }
    },
}


def main():
    reglas = {r["texto"]: r["tipo"] for r in json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))} if len(sys.argv) > 1 else {}

    t0 = time.perf_counter()
    agent = laya.load("convaiinnovations/laya", subfolder="multilingual")
    print(f"Modelo cargado en {time.perf_counter() - t0:.1f}s\n")

    aciertos = {"reglas": 0, "en": 0, "es": 0}
    tiempos = []
    filas = []
    for texto, esperado in FRASES:
        fila = {"texto": texto, "esperado": esperado, "reglas": reglas.get(texto, "-")}
        for idioma, preguntas in PREGUNTAS.items():
            t = time.perf_counter()
            ans = agent.system_one(texto, preguntas)["answers"]["tipo"]
            tiempos.append((time.perf_counter() - t) * 1000)
            fila[idioma] = ans["choice"]
            fila[idioma + "_conf"] = ans.get("confidence", 0)
        for k in aciertos:
            aciertos[k] += fila[k] == esperado
        filas.append(fila)

    ok = lambda f, k: "✓" if f[k] == f["esperado"] else "✗"
    print(f"{'frase':52} {'esperado':13} {'reglas':15} {'laya-en':22} {'laya-es':22}")
    for f in filas:
        print(
            f"{f['texto'][:50]:52} {f['esperado']:13} "
            f"{ok(f, 'reglas')} {f['reglas']:13} "
            f"{ok(f, 'en')} {f['en']:13} {f['en_conf']:.2f}   "
            f"{ok(f, 'es')} {f['es']:13} {f['es_conf']:.2f}"
        )
    n = len(FRASES)
    print()
    for k, v in aciertos.items():
        print(f"{k:7} {v}/{n}  ({v / n:.0%})")
    tiempos.sort()
    print(f"\nLatencia por frase en CPU: mediana {tiempos[len(tiempos) // 2]:.0f} ms")


if __name__ == "__main__":
    main()
