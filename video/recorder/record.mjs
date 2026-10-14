// Graba una escena de una app con cursor visible y datos sensibles difuminados.
// Se conecta al Chrome de browser-server.mjs (CDP 9333), captura con
// Page.startScreencast y arma un MP4 30 fps con ffmpeg.
// La vista siempre mide 1920x1080; con DSF=2 se captura a 3840x2160 para que
// los acercamientos del video vertical se vean nítidos.
// Uso: node record.mjs <app> <escena> <carpeta-salida>   (DRY=1 → sin clics que guardan)
//   app: nexokids | vetmanager  (escenas en scenes-<app>.mjs)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DRY, sleep, cursorLog, setShowCursor } from './lib.mjs';

const [app, nombre, outDir] = process.argv.slice(2);
const { escenas, DSF = 1 } = await import(`./scenes-${app}.mjs`);
if (!escenas[nombre]) throw new Error('Escena desconocida: ' + nombre);
const framesDir = join(outDir, `${nombre}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

setShowCursor(DSF === 1);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages()[0];
const cdp = await page.context().newCDPSession(page);
// Con DSF>1 la escala la pone Chrome de forma nativa (browser-server con DSF=2).
if (DSF === 1) await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

const frames = [];
let startedAt = 0;
let stopTs = 0;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = join(framesDir, `${String(frames.length).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, ts: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const rec = {
  async start() {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 90, maxWidth: 1920 * DSF, maxHeight: 1080 * DSF, everyNthFrame: 1,
    });
    startedAt = Date.now() / 1000;
  },
};

try {
  await escenas[nombre](page, rec);
} finally {
  stopTs = Date.now() / 1000;
  await cdp.send('Page.stopScreencast').catch(() => {});
  await sleep(300);
  if (DSF === 1) await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await browser.close().catch(() => {});
}

if (frames.length === 0) throw new Error('No se capturaron cuadros');
let list = '';
frames.forEach((f, i) => {
  const tail = stopTs - f.ts;
  const next = i + 1 < frames.length ? frames[i + 1].ts : f.ts + (tail > 0 && tail < 15 ? tail : 1.2);
  list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
});
list += `file '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
// Cursor para dibujar en el video: tiempos relativos al primer cuadro, ~30 por s.
const t0 = frames[0].ts;
const samples = [];
let lastT = -1;
for (const [t, x, y] of cursorLog.samples) {
  const rt = +(t - t0).toFixed(3);
  if (rt - lastT >= 1 / 30 || samples.length === 0) { samples.push([rt, Math.round(x), Math.round(y)]); lastT = rt; }
}
writeFileSync(join(outDir, `${nombre}-cursor.json`), JSON.stringify({
  samples, clicks: cursorLog.clicks.map((t) => +(t - t0).toFixed(3)),
}));
const listFile = join(outDir, `${nombre}-frames.txt`);
writeFileSync(listFile, list);
const out = join(outDir, `${nombre}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', out]);
console.log(JSON.stringify({ app, escena: nombre, cuadros: frames.length, salida: out, dry: DRY, t: (stopTs - startedAt).toFixed(1) }));
