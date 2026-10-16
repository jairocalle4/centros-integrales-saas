// Escenas del video de LavaManager (escala 2). El WhatsApp se SIMULA
// interceptando /api/whatsapp/**: nunca sale un mensaje real.
import { DRY, sleep, setCursor, moveTo, moveToEl, click, typeSlow, prepare, setAccent } from './lib.mjs';

export const BASE = 'https://lavamanager-saas.vercel.app';
export const DSF = 2;
setAccent('rgba(79,70,229,.45)');

async function mockWhatsApp(page) {
  await page.route('**/api/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"id":"demo-simulado"}' }));
}
async function open(page, path) {
  await mockWhatsApp(page);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await sleep(2500);
  await prepare(page);
}
const card = (page, code, title) =>
  page.locator('div').filter({ hasText: code }).filter({ has: page.locator(`button[title="${title}"]`) }).last();

export const escenas = {
  async panel(page, rec) {
    await open(page, '/app');
    await setCursor(page, 1000, 650);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Ventas de hoy', { exact: false }).first(), 800);
    await sleep(300);
    await moveToEl(page, page.getByText('En taller (lavado)', { exact: false }).first(), 600);
    await sleep(250);
    await moveToEl(page, page.getByText('Listas en percha', { exact: false }).nth(1), 600);
    await sleep(300);
    await moveToEl(page, page.getByText('Arqueo de Turno').first(), 800);
    await sleep(900);
  },

  async pos(page, rec) {
    // La app no guarda en el servidor la activación de servicios: se activan en
    // memoria y se entra al POS sin recargar.
    await open(page, '/app/servicios');
    for (let i = 0; i < 12; i++) {
      const t = page.getByRole('button', { name: /Pausado/ }).first();
      if (!(await t.count())) break;
      await t.click();
      await sleep(250);
    }
    await page.getByRole('link', { name: /Punto de Venta/ }).first().click();
    await sleep(1800);
    await prepare(page);
    await setCursor(page, 900, 500);
    await rec.start();
    await sleep(300);
    await click(page, page.getByRole('button', { name: 'Lavado + Secado + Doblado' }).first(), 800);
    await sleep(500);
    const kg = page.locator('input[type=number]').last();
    await click(page, kg, 600);
    await page.keyboard.press('Control+A');
    await typeSlow(page, '7', 120);
    await sleep(300);
    await click(page, page.getByPlaceholder('Ej. Carlos Calle / Don Fernando'), 700);
    await typeSlow(page, 'Gabriela Ruiz', 45);
    await click(page, page.getByPlaceholder('Ej. 0991234567'), 500);
    await typeSlow(page, '0990000211', 45);
    await sleep(300);
    await click(page, page.getByRole('button', { name: /COBRAR/i }), 700);
    await sleep(600);
    await click(page, page.getByRole('button', { name: 'Abono / Anticipo' }), 600);
    const monto = page.getByPlaceholder('0.00').last();
    await click(page, monto, 500);
    await page.keyboard.press('Control+A');
    await typeSlow(page, '8', 120);
    await sleep(300);
    await click(page, page.getByRole('button', { name: /Registrar Abono/ }), 700, !DRY);
    await sleep(1800);
    await moveToEl(page, page.getByRole('button', { name: /Imprimir Ticket/ }).first(), 700).catch(() => {});
    await sleep(1500);
  },

  async taller(page, rec) {
    await open(page, '/app/taller');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.locator('text=1. Recibido >> visible=true').first(), 600);
    await sleep(200);
    await moveToEl(page, page.locator('text=2. Lavándose >> visible=true').first(), 600);
    await sleep(200);
    const c = card(page, 'LAV-2026-0054', 'Avanzar a siguiente etapa');
    await moveToEl(page, c.getByText('Ana Lucía Torres').first(), 700);
    await sleep(300);
    await click(page, c.locator('button[title="Avanzar a siguiente etapa"]'), 700, !DRY);
    await sleep(2800);
  },

  async entrega(page, rec) {
    await open(page, '/app/taller');
    await setCursor(page, 1200, 300);
    await rec.start();
    await sleep(300);
    const c = card(page, 'LAV-2026-0052', 'Entregar al Cliente y Cobrar');
    await moveToEl(page, c.getByText('Debe:', { exact: false }).first(), 700);
    await sleep(400);
    await click(page, c.locator('button[title="Entregar al Cliente y Cobrar"]'), 700);
    await sleep(900);
    await prepare(page);
    await click(page, page.getByRole('button', { name: /Efectivo/ }).last(), 600);
    await click(page, page.getByRole('button', { name: /Factura Electrónica SRI/ }).last(), 700);
    await sleep(400);
    await click(page, page.getByRole('button', { name: 'Confirmar Entrega y Liquidar' }), 700, !DRY);
    if (!DRY) await page.getByText(/Autorizad/).first().waitFor({ timeout: 45000 }).catch(() => {});
    await sleep(2000);
  },

  async recibos(page, rec) {
    await open(page, '/app/recibos');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Facturas SRI', { exact: false }).first(), 700);
    await sleep(300);
    await moveToEl(page, page.locator('tbody tr', { hasText: 'LAV-2026-0052' }).getByText(/Factura SRI/).first(), 800);
    await sleep(1200);
  },

  async caja(page, rec) {
    await open(page, '/app/caja');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Efectivo esperado', { exact: false }).first(), 800);
    await sleep(400);
    await click(page, page.getByRole('button', { name: /Cerrar Turno de Caja/ }), 800);
    await sleep(900);
    await prepare(page);
    // Escribe el efectivo esperado para que el arqueo cuadre
    const txt = await page.locator('main').innerText();
    const esperado = (txt.match(/EFECTIVO ESPERADO \(=\)\s*\$([\d.,]+)/i) || [])[1] || '';
    const campos = page.locator('.fixed input[type=text], .fixed input[type=number]');
    const contado = campos.first();
    await click(page, contado, 600);
    await page.keyboard.press('Control+A');
    await typeSlow(page, esperado.replace(',', ''), 110);
    await sleep(500);
    const confirmar = page.getByRole('button', { name: /Cerrar Caja|Confirmar Cierre|Cerrar Turno/ }).last();
    await click(page, confirmar, 800, !DRY);
    await sleep(2200);
    await prepare(page);
    await moveToEl(page, page.getByText('Historial de Cierres', { exact: false }).first(), 700).catch(() => {});
    await sleep(1300);
  },

  async reportes(page, rec) {
    await open(page, '/app/finanzas');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Ventas totales', { exact: false }).first(), 700);
    await sleep(300);
    await moveToEl(page, page.getByText('Gastos operativos', { exact: false }).first(), 600);
    await sleep(300);
    await moveToEl(page, page.getByText('Ganancia neta', { exact: false }).first(), 600);
    await sleep(500);
    for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 22); await sleep(25); }
    await moveTo(page, 900, 600, 600);
    await sleep(1200);
  },
};
