"""Genera index.html a partir de index.html.tpl.

Cada toma (SHOTS) dice: qué clip, desde qué segundo del clip (media), cuándo
entra en el video (start), cuánto dura (dur) y qué región de la pantalla de
1920x1080 se encuadra (from -> to, como [x, y, ancho]). El cursor se dibuja a
30 fps desde el registro <clip>-cursor.json que deja el grabador.

Uso: python build.py   (luego: npx hyperframes check)
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
CLIPS = HERE / "data"  # registros del cursor (copiados de ../clips)

# id, clip, start, dur, media, from, to, extra
SHOTS = [
    # 2 · Recepción en el POS
    dict(id="p1", clip="pos", start=6.58, dur=2.17, media=6.6, frm=[290, 230, 800], to=[300, 250, 760]),
    dict(id="p2", clip="pos", start=8.75, dur=1.85, media=62.4, frm=[700, 250, 520], to=[710, 280, 500]),
    dict(id="p3", clip="pos", start=10.60, dur=2.23, media=65.7, frm=[700, 90, 620], to=[700, 420, 620], move=(0.5, 2.0)),
    # 3 · Taller
    dict(id="t", clip="taller", start=12.83, dur=6.37, media=0.5, frm=[290, 60, 900], to=[1000, 60, 900], move=(3.0, 4.6)),
    # 4 · Aviso de WhatsApp (Premium)
    dict(id="w1", clip="taller", start=19.20, dur=2.66, media=6.6, frm=[640, 330, 620], to=[650, 340, 600]),
    dict(id="w2", clip="taller", start=21.86, dur=3.90, media=9.21, rate=0.8, frm=[1090, 0, 830], to=[1090, 0, 830]),
    # 5 · Entrega: saldo, recibo impreso y factura opcional (datos o consumidor final)
    dict(id="e1", clip="entrega", start=26.08, dur=1.92, media=2.6, frm=[1000, 478, 700], to=[1010, 478, 680]),
    dict(id="e2", clip="pos", start=28.00, dur=2.20, media=72.0, frm=[700, 560, 560], to=[705, 570, 540]),
    dict(id="e3", clip="entrega", start=30.20, dur=2.40, media=10.3, frm=[700, 400, 520], to=[705, 405, 510]),
    dict(id="e4", clip="pos", start=32.60, dur=2.20, media=18.5, frm=[1262, 150, 660], to=[1266, 160, 640]),
    dict(id="e5", clip="entrega", start=34.80, dur=2.00, media=30.3, frm=[700, 100, 620], to=[705, 110, 600]),
    # 6 · Caja
    dict(id="c1", clip="caja", start=36.80, dur=2.10, media=22.6, frm=[700, 280, 560], to=[705, 290, 540]),
    dict(id="c2", clip="caja", start=38.90, dur=2.16, media=37.0, frm=[480, 300, 900], to=[480, 330, 860], spot=[482, 588, 1190, 58]),
    # 7 · Dueño (después del celular): arqueo del turno en el panel
    dict(id="a", clip="panel", start=44.30, dur=2.68, media=27.0, frm=[1000, 280, 880], to=[1040, 300, 820]),
    # 8 · Reportes
    dict(id="r1", clip="reportes", start=46.98, dur=2.22, media=0.4, frm=[300, 100, 900], to=[980, 100, 900], move=(0.3, 2.0)),
]


def cursor_track(shot):
    """Posiciones del cursor (en coordenadas de la página) a tiempo global."""
    path = CLIPS / f"{shot['clip']}-cursor.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    rate = shot.get("rate", 1.0)
    a, b = shot["media"], shot["media"] + shot["dur"] * rate
    pts = [[round(shot["start"] + (t - a) / rate, 3), x, y] for t, x, y in data["samples"] if a <= t <= b]
    # posición al entrar (última conocida antes del corte)
    before = [s for s in data["samples"] if s[0] < a]
    if before:
        pts.insert(0, [shot["start"], before[-1][1], before[-1][2]])
    clicks = [round(shot["start"] + (t - a) / rate, 3) for t in data["clicks"] if a <= t <= b]
    return {"pts": pts, "clicks": clicks}


def video_html(shot):
    spot = '<div class="spot"></div>' if shot.get("spot") else ""
    return (
        f'<div class="slot" id="s-{shot["id"]}"><div class="zw" data-layout-allow-overflow id="z-{shot["id"]}">'
        f'<video id="v-{shot["id"]}" src="assets/clips/{shot["clip"]}.mp4" muted playsinline '
        f'data-start="{shot["start"]}" data-duration="{shot["dur"]}" data-media-start="{shot["media"]}"'
        + (f' data-playback-rate="{shot["rate"]}"' if shot.get("rate") else "")
        + ' data-track-index="3"></video>'
        f'{spot}<div class="cur"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11.5-6.6 1.1 3.9 7.4-2.9 1.5-3.9-7.5L4 21z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>'
        f'<div class="rip"></div></div></div>'
    )


def main():
    tpl = (HERE / "index.html.tpl").read_text(encoding="utf-8")
    shots = []
    for s in SHOTS:
        shots.append({**s, **cursor_track(s)})
    html = tpl.replace("<!--@VIDEOS@-->", "\n          ".join(video_html(s) for s in SHOTS))
    html = html.replace("/*@SHOTS@*/[]", json.dumps(shots, ensure_ascii=False))
    (HERE / "index.html").write_text(html, encoding="utf-8")
    print(f"index.html generado con {len(SHOTS)} tomas")


if __name__ == "__main__":
    main()
