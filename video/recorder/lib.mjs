// Ayudas compartidas por las escenas: cursor visible, clics con efecto,
// difuminado de datos sensibles y navegación.
import { existsSync, readFileSync } from 'node:fs';

// Textos que no deben verse (datos reales que ya existían en la cuenta).
// La lista vive en sensibles.local.json, que NO se sube a Git.
export const SENSIBLES = existsSync(new URL('./sensibles.local.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./sensibles.local.json', import.meta.url), 'utf8'))
  : [];

export const DRY = process.env.DRY === '1';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const overlay = ({ sensibles, accent, showCursor }) => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const style = document.createElement('style');
    style.textContent = `
      #__cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;
        transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
        background:${accent};z-index:2147483646;pointer-events:none;animation:__rp .55s ease-out forwards}
      @keyframes __rp{to{transform:scale(4.5);opacity:0}}
      .__blur{filter:blur(6px)!important}
      ::-webkit-scrollbar{display:none}`;
    document.documentElement.appendChild(style);
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11.5-6.6 1.1 3.9 7.4-2.9 1.5-3.9-7.5L4 21z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    if (!showCursor) c.style.display = 'none';
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', (e) => {
      c.style.transform = `translate(${e.clientX - 5}px,${e.clientY - 3}px)`;
    }, true);
    window.addEventListener('mousedown', (e) => {
      if (!showCursor) return;
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
let accent = 'rgba(79,70,229,.45)';
export const setAccent = (rgba) => { accent = rgba; };

// Registro del cursor (posición y clics con hora absoluta). Cuando la captura
// es de pocos cuadros por segundo (escala 2), el cursor NO se dibuja en la
// página: se dibuja luego en el video a 30 fps a partir de este registro.
export const cursorLog = { samples: [], clicks: [] };
let showCursor = true;
export const setShowCursor = (v) => { showCursor = v; };
const logPos = () => cursorLog.samples.push([Date.now() / 1000, cur.x, cur.y]);

export async function setCursor(page, x, y) {
  cur = { x, y };
  logPos();
  await page.mouse.move(x, y);
}
export async function moveTo(page, x, y, ms = 700) {
  const from = { ...cur };
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    cur = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
    logPos();
    await page.mouse.move(cur.x, cur.y);
    await sleep(16);
  }
  cur = { x, y };
}
export async function moveToEl(page, locator, ms) {
  // Algunos elementos tienen animación continua: no esperar a que "se estabilicen".
  await locator.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
  const b = await locator.boundingBox();
  if (!b) throw new Error('Elemento sin caja: ' + locator);
  await moveTo(page, b.x + b.width / 2, b.y + b.height / 2, ms);
}
export async function click(page, locator, ms = 700, real = true) {
  await moveToEl(page, locator, ms);
  await sleep(250);
  cursorLog.clicks.push(Date.now() / 1000);
  if (real) {
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
  } else {
    // Solo el efecto visual, sin disparar la acción.
    await page.evaluate(({ x, y }) => window.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y })), cur);
  }
}
export async function typeSlow(page, text, delay = 70) {
  await page.keyboard.type(text, { delay });
}
export async function prepare(page) {
  await page.evaluate(overlay, { sensibles: SENSIBLES, accent, showCursor });
  await page.mouse.move(cur.x, cur.y);
}
export async function nav(page, name) {
  await page.getByRole('link', { name, exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  await sleep(1500);
  await prepare(page);
}
