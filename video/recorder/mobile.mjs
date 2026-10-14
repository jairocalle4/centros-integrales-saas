// Escena "celular": captura cuadro a cuadro (30 fps sintéticos) un
// desplazamiento suave del panel en tamaño teléfono, a doble resolución.
// Uso: node mobile.mjs <carpeta-salida>
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [outDir] = process.argv.slice(2);
const framesDir = join(outDir, 'movil-frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

// Textos que no deben verse (datos reales que ya existían en la cuenta).
// La lista vive en sensibles.local.json, que NO se sube a Git.
const SENSIBLES = existsSync(new URL('./sensibles.local.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./sensibles.local.json', import.meta.url), 'utf8'))
  : [];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages()[0];
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
try {
  await page.goto('https://nexokids.pages.dev/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.addStyleTag({ content: '::-webkit-scrollbar{display:none} .__blur{filter:blur(6px)!important}' });
  await page.evaluate((s) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (s.some((t) => (n.nodeValue || '').includes(t))) n.parentElement?.classList.add('__blur');
  }, SENSIBLES);
  // El contenido se desplaza dentro de un contenedor interno, no en window.
  const maxY = await page.evaluate(() => {
    const els = [document.scrollingElement, ...document.querySelectorAll('*')];
    let best = null;
    for (const el of els) {
      if (!el) continue;
      const cs = el === document.scrollingElement ? null : getComputedStyle(el);
      const can = el.scrollHeight - el.clientHeight;
      if (can > 50 && (!cs || /(auto|scroll)/.test(cs.overflowY)) && (!best || can > best.can)) best = { el, can };
    }
    window.__scroller = best?.el ?? document.scrollingElement;
    return Math.min(1500, best?.can ?? 0);
  });
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const plan = [
    ...Array(24).fill(0),
    ...Array.from({ length: 105 }, (_, i) => ease((i + 1) / 105)),
    ...Array(30).fill(1),
  ];
  let i = 0;
  for (const k of plan) {
    await page.evaluate((y) => { window.__scroller.scrollTop = y; }, Math.round(k * maxY));
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(framesDir, `${String(i++).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
  }
} finally {
  await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await browser.close().catch(() => {});
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(framesDir, '%05d.png'),
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', join(outDir, 'movil.mp4')]);
console.log('movil.mp4 listo');
