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
    dict(id="a", clip="panel", start=8.18, dur=4.12, media=1.0, frm=[480, 30, 1216], to=[880, 150, 820], move=(0.6, 3.2)),
    dict(id="b1", clip="expediente", start=12.30, dur=3.70, media=5.0, frm=[438, 70, 1280], to=[438, 225, 800], move=(0.5, 2.8)),
    dict(id="b2", clip="expediente", start=16.00, dur=2.89, media=10.1, frm=[438, 225, 800], to=[442, 235, 780]),
    dict(id="c", clip="vacunas", start=18.89, dur=4.38, media=1.6, frm=[1090, 547, 620], to=[1095, 598, 560]),
    dict(id="d1", clip="bano", start=23.27, dur=2.33, media=3.0, frm=[600, 240, 620], to=[1090, 240, 620], move=(0.9, 2.2)),
    dict(id="d2", clip="bano", start=25.60, dur=3.23, media=5.33, frm=[1290, 0, 620], to=[1295, 0, 600]),
    dict(id="e1", clip="pos", start=28.83, dur=1.87, media=3.3, frm=[1280, 60, 460], to=[1285, 70, 440]),
    dict(id="e2", clip="pos", start=30.70, dur=1.40, media=7.6, frm=[1280, 690, 440], to=[1285, 700, 420]),
    dict(id="e3", clip="sri", start=32.10, dur=2.20, media=0.5, frm=[700, 200, 800], to=[900, 230, 620], move=(0.2, 1.4)),
    dict(id="e4", clip="ventas", start=34.30, dur=2.41, media=0.5, frm=[1000, 300, 600], to=[1050, 330, 560]),
    dict(id="f1", clip="inventario", start=36.71, dur=2.99, media=0.4, frm=[700, 110, 1000], to=[880, 130, 820], spot=[1090, 160, 600, 110]),
    dict(id="f2", clip="inventario", start=39.70, dur=2.71, media=7.3, frm=[480, 300, 800], to=[500, 320, 760], spot=[481, 457, 1214, 61]),
    dict(id="g1", clip="caja", start=42.41, dur=0.89, media=3.0, frm=[480, 280, 680], to=[485, 290, 660]),
    dict(id="g2", clip="gastos", start=43.30, dur=2.41, media=1.2, frm=[480, 200, 900], to=[480, 210, 860]),
    dict(id="h1", clip="reportes", start=45.71, dur=3.29, media=0.4, frm=[480, 200, 700], to=[1000, 200, 700], move=(0.5, 2.6)),
]


def cursor_track(shot):
    """Posiciones del cursor (en coordenadas de la página) a tiempo global."""
    path = CLIPS / f"{shot['clip']}-cursor.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    a, b = shot["media"], shot["media"] + shot["dur"]
    pts = [[round(shot["start"] + t - a, 3), x, y] for t, x, y in data["samples"] if a <= t <= b]
    # posición al entrar (última conocida antes del corte)
    before = [s for s in data["samples"] if s[0] < a]
    if before:
        pts.insert(0, [shot["start"], before[-1][1], before[-1][2]])
    clicks = [round(shot["start"] + t - a, 3) for t in data["clicks"] if a <= t <= b]
    return {"pts": pts, "clicks": clicks}


def video_html(shot):
    spot = '<div class="spot"></div>' if shot.get("spot") else ""
    return (
        f'<div class="slot" id="s-{shot["id"]}"><div class="zw" data-layout-allow-overflow id="z-{shot["id"]}">'
        f'<video id="v-{shot["id"]}" src="assets/clips/{shot["clip"]}.mp4" muted playsinline '
        f'data-start="{shot["start"]}" data-duration="{shot["dur"]}" data-media-start="{shot["media"]}" data-track-index="3"></video>'
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
