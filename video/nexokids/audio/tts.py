"""Genera la narración con voces neuronales de Ecuador (edge-tts).

Uso: python -I tts.py <voz> [rate]
  voz: andrea | luis
Crea audio/voz-<voz>/<id>.mp3 y <id>.words.json (tiempos por palabra)
a partir de narracion.json.
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

VOCES = {"andrea": "es-EC-AndreaNeural", "luis": "es-EC-LuisNeural"}


async def generar(voz: str, rate: str) -> None:
    base = Path(__file__).parent
    lineas = json.loads((base / "narracion.json").read_text(encoding="utf-8"))
    salida = base / f"voz-{voz}"
    salida.mkdir(exist_ok=True)
    for linea in lineas:
        com = edge_tts.Communicate(
            linea["text"], VOCES[voz], rate=rate, boundary="WordBoundary"
        )
        palabras = []
        with open(salida / f"{linea['id']}.mp3", "wb") as f:
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    palabras.append(
                        {
                            "text": chunk["text"],
                            "start": chunk["offset"] / 1e7,
                            "end": (chunk["offset"] + chunk["duration"]) / 1e7,
                        }
                    )
        (salida / f"{linea['id']}.words.json").write_text(
            json.dumps(palabras, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(linea["id"], "ok")


if __name__ == "__main__":
    asyncio.run(generar(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "+0%"))
