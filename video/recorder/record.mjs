// Graba escenas de la app con cursor visible y datos sensibles difuminados.
// Se conecta al Chrome de browser-server.mjs (CDP 9333) y captura con
// Page.startScreencast; luego arma un MP4 30 fps con ffmpeg.
// Uso: node record.mjs <escena> <carpeta-salida>   (DRY=1 → no hace clics que guardan)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BASE = 'https://nexokids.pages.dev';
const DRY = process.env.DRY === '1';

// Textos que no deben verse (datos reales que ya existían en la cuenta).
// La lista vive en sensibles.local.json, que NO se sube a Git.
const SENSIBLES = existsSync(new URL('./sensibles.local.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./sensibles.local.json', import.meta.url), 'utf8'))
  : [];

const overlay = (sensibles) => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const style = document.createElement('style');
    style.textContent = `
      #__cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;
        transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
        background:rgba(79,70,229,.45);z-index:2147483646;pointer-events:none;animation:__rp .55s ease-out forwards}
      @keyframes __rp{to{transform:scale(4.5);opacity:0}}
      .__blur{filter:blur(6px)!important}
      ::-webkit-scrollbar{display:none}`;
    document.documentElement.appendChild(style);
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11.5-6.6 1.1 3.9 7.4-2.9 1.5-3.9-7.5L4 21z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', (e) => {
      c.style.transform = `translate(${e.clientX - 5}px,${e.clientY - 3}px)`;
    }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.className = '__ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    const blurAll = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.nodeValue || '';
        if (sensibles.some((s) => t.includes(s)) && n.parentElement) n.parentElement.classList.add('__blur');
      }
    };
    blurAll();
    new MutationObserver(blurAll).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

let cur = { x: 960, y: 540 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function moveTo(page, x, y, ms = 700) {
  const from = { ...cur };
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    await sleep(16);
  }
  cur = { x, y };
}
async function moveToEl(page, locator, ms) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error('Elemento sin caja: ' + locator);
  await moveTo(page, b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function click(page, locator, ms = 700, real = true) {
  await moveToEl(page, locator, ms);
  await sleep(250);
  if (real) {
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
  } else {
    // Solo el efecto visual, sin disparar la acción.
    await page.evaluate(({ x, y }) => window.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y })), cur);
  }
}
async function prepare(page) {
  await page.evaluate(overlay, SENSIBLES);
  await page.mouse.move(cur.x, cur.y);
}
async function nav(page, name) {
  await page.getByRole('link', { name, exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  await sleep(1500);
  await prepare(page);
}

// ─── Escenas ───────────────────────────────────────────────────────────────
const escenas = {
  async agenda(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await sleep(2500);
    await prepare(page);
    cur = { x: 1300, y: 300 };
    await page.mouse.move(cur.x, cur.y);
    await rec.start();
    await sleep(500);
    await moveToEl(page, page.getByText('Agenda de Hoy'), 800);
    await sleep(300);
    await moveToEl(page, page.getByText('Emilia Torres Vega').first(), 600);
    await sleep(500);
    await click(page, page.getByRole('link', { name: 'Asistencia', exact: true }), 900);
    await page.waitForLoadState('networkidle');
    await sleep(900);
    await prepare(page);
    const row = page.locator('div').filter({ hasText: 'Emilia Torres Vega' })
      .filter({ has: page.getByRole('button', { name: 'Justificado' }) }).last();
    await click(page, row.getByRole('button', { name: 'Presente' }), 900, !DRY);
    await sleep(1800);
  },

  async cobros(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await nav(page, 'Cobros y Pagos');
    cur = { x: 900, y: 250 };
    await page.mouse.move(cur.x, cur.y);
    await rec.start();
    await sleep(500);
    const row = page.locator('tr', { hasText: 'Valentina Ríos Mora' });
    await moveToEl(page, row.getByText('$50.00'), 900);
    await sleep(500);
    await click(page, row.locator('button').first(), 700);
    await sleep(1300);
    await prepare(page);
    await moveToEl(page, page.getByText('Saldo Pendiente').last(), 700);
    await sleep(500);
    await moveToEl(page, page.locator('button[title^="Enviar recibo por WhatsApp"]').first(), 800);
    await sleep(1500);
  },

  async facturas(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await nav(page, 'Facturas');
    cur = { x: 700, y: 200 };
    await page.mouse.move(cur.x, cur.y);
    await rec.start();
    await sleep(400);
    await moveToEl(page, page.getByText('Facturada').first(), 800);
    await sleep(400);
    await moveToEl(page, page.getByText('Facturada').nth(3), 700);
    await sleep(700);
  },

  async acta(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await nav(page, 'Beneficiarios');
    cur = { x: 1200, y: 200 };
    await page.mouse.move(cur.x, cur.y);
    await rec.start();
    await sleep(300);
    const row = page.locator('tr', { hasText: 'Valentina Ríos Mora' });
    await click(page, row.getByRole('button', { name: 'Acta' }), 800);
    await sleep(1200);
    await prepare(page);
    await moveToEl(page, page.getByRole('button', { name: 'Imprimir' }), 800);
    await sleep(900);
  },

  async reportes(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await nav(page, 'Reportes');
    cur = { x: 1000, y: 300 };
    await page.mouse.move(cur.x, cur.y);
    await rec.start();
    await sleep(400);
    await moveToEl(page, page.getByText('Utilidad neta', { exact: false }).first(), 800);
    await sleep(400);
    await page.mouse.wheel(0, 380);
    await sleep(1400);
  },

  async movil(page, rec) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await sleep(2500);
    await prepare(page);
    await page.evaluate(() => document.getElementById('__cursor')?.remove());
    await rec.start({ maxWidth: 780, maxHeight: 1688 });
    await sleep(800);
    for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 40); await sleep(60); }
    await sleep(1500);
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  },
};

// ─── Grabación ─────────────────────────────────────────────────────────────
const [nombre, outDir] = process.argv.slice(2);
if (!escenas[nombre]) throw new Error('Escena desconocida: ' + nombre);
const framesDir = join(outDir, `${nombre}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1920, height: 1080 });
const cdp = await page.context().newCDPSession(page);
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
  async start(opts = {}) {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 92, maxWidth: opts.maxWidth ?? 1920, maxHeight: opts.maxHeight ?? 1080, everyNthFrame: 1,
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
  await browser.close().catch(() => {});
}

if (frames.length === 0) throw new Error('No se capturaron cuadros');
const end = Date.now() / 1000;
let list = '';
frames.forEach((f, i) => {
  const tail = stopTs - f.ts;
  const next = i + 1 < frames.length ? frames[i + 1].ts : f.ts + (tail > 0 && tail < 15 ? tail : 1.2);
  list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
});
list += `file '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
const listFile = join(outDir, `${nombre}-frames.txt`);
writeFileSync(listFile, list);
const out = join(outDir, `${nombre}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', out]);
console.log(JSON.stringify({ escena: nombre, cuadros: frames.length, salida: out, dry: DRY, t: (end - startedAt).toFixed(1) }));
