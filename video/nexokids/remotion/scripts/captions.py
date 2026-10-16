"""Genera src/data/captions.ts para el video de NexoKids en Remotion a partir de
los tiempos por palabra de edge-tts. Uso: python scripts/captions.py ../audio-dia/voz-luis src/data/captions.ts"""
import json
import sys
from pathlib import Path

VOZ = Path(sys.argv[1])
OUT = Path(sys.argv[2])

# Trozos por línea (texto que se muestra). "SRI," consume 3 palabras habladas.
CHUNKS = {
    "01-gancho": ["Así es un día", "en tu centro integral…", "cuando todo está en orden."],
    "02-llegada": ["Siete y media:", "llegan los niños.", "Abres la agenda del día", "y marcas la asistencia", "en segundos."],
    "03-terapia": ["A las nueve empieza", "la terapia de lenguaje:", "ya está agendada,", "y registras el avance", "de cada sesión."],
    "04-abono": ["Doce y media:", "una mamá abona una parte.", "NexoKids guarda", "el saldo pendiente,", "y le envías el recibo", "por WhatsApp."],
    "05-factura": ["Y si te piden factura,", "la emites al SRI,", "sin salir del sistema."],
    "06-acta": ["¿Un niño nuevo?", "Imprimes el acta de compromiso", "para su representante."],
    "07-cierre-dia": ["Al cerrar el día,", "registras tus gastos", "y ves cuánto ganaste", "en el mes."],
    "08-casa": ["Y ya en casa,", "desde tu celular,", "revisas cómo le fue", "a tu centro."],
    "09-cierre": ["NexoKids:", "menos papeles,", "más tiempo para los niños.", "Pide tu demostración", "por WhatsApp."],
}
EMPH = {"orden", "niños", "asistencia", "segundos", "terapia", "avance", "abona", "saldo", "whatsapp",
        "factura", "sri", "acta", "gastos", "ganaste", "celular", "papeles", "tiempo", "demostración"}
SPAN = {"SRI,": 3}


def clean(t: str) -> str:
    return t.strip("¿?¡!:;,.…").lower()


out = ["// Generado por scripts/captions.py: subtítulos por línea, en ms relativos al inicio del audio.",
       "export type Word = { text: string; startMs: number; endMs: number; emph: boolean };",
       "export type Chunk = Word[];", "", "export const captions: Record<string, Chunk[]> = {"]
for line_id, chunks in CHUNKS.items():
    words = json.loads((VOZ / f"{line_id}.words.json").read_text(encoding="utf-8"))
    i = 0
    rendered = []
    for chunk in chunks:
        items = []
        for tok in chunk.split(" "):
            n = SPAN.get(tok, 1)
            seg = words[i:i + n]
            assert len(seg) == n, (line_id, tok)
            if n == 1:
                assert clean(seg[0]["text"]) == clean(tok), (line_id, tok, seg[0]["text"])
            i += n
            items.append(
                f'{{ text: {json.dumps(tok, ensure_ascii=False)}, startMs: {round(seg[0]["start"] * 1000)}, '
                f'endMs: {round(seg[-1]["end"] * 1000)}, emph: {"true" if clean(tok) in EMPH else "false"} }}')
        rendered.append("    [" + ", ".join(items) + "]")
    assert i == len(words), (line_id, i, len(words))
    out.append(f'  "{line_id}": [\n' + ",\n".join(rendered) + ",\n  ],")
out.append("};")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
print("ok", OUT)
