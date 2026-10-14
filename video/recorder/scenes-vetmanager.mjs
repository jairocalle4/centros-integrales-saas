// Escenas del video de VetManager (grabadas a escala 2 para zooms nítidos).
// El envío de WhatsApp se SIMULA: se intercepta /api/whatsapp/** y nunca sale
// un mensaje real.
import { DRY, sleep, setCursor, moveTo, moveToEl, click, typeSlow, prepare, setAccent } from './lib.mjs';

export const BASE = 'https://vetmanager-saas.pages.dev';
export const DSF = 2;
setAccent('rgba(67,97,238,.45)');

async function mockWhatsApp(page) {
  await page.route('**/api/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"id":"demo-simulado"}' }));
}
async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await sleep(2200);
  await prepare(page);
}

export const escenas = {
  async panel(page, rec) {
    await open(page, '/app');
    await setCursor(page, 1000, 600);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Ingresos hoy', { exact: false }).first(), 700);
    await sleep(250);
    await moveToEl(page, page.getByText('Citas hoy', { exact: false }).first(), 600);
    await sleep(250);
    await moveToEl(page, page.getByText('Alertas de stock', { exact: false }).first(), 600);
    await sleep(250);
    await moveToEl(page, page.getByText('Agenda de hoy').first(), 700);
    await sleep(900);
  },

  async expediente(page, rec) {
    await open(page, '/app/mascotas');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    const row = page.locator('tr', { hasText: 'Toby' });
    await click(page, row.getByRole('button', { name: 'Expediente' }).or(row.getByRole('link', { name: 'Expediente' })).first(), 900);
    await page.waitForLoadState('networkidle');
    await sleep(900);
    await prepare(page);
    await moveToEl(page, page.locator('text=Otitis externa >> visible=true').first(), 800);
    await sleep(900);
    await click(page, page.getByRole('button', { name: 'Vacunas', exact: true }), 800);
    await sleep(1600);
  },

  async vacunas(page, rec) {
    await mockWhatsApp(page);
    await open(page, '/app');
    await setCursor(page, 1100, 500);
    await rec.start();
    await sleep(300);
    // El recordatorio es un enlace a wa.me (abre WhatsApp con el mensaje listo):
    // se señala y se marca el clic, sin abrirlo.
    const alerta = page.locator('div.border-l-4', { hasText: 'Toby' }).first();
    await moveToEl(page, alerta.locator('p').first(), 800);
    await sleep(500);
    await click(page, alerta.locator('a[title="Enviar recordatorio"]'), 700, false);
    await sleep(1800);
  },

  async bano(page, rec) {
    await mockWhatsApp(page);
    await page.goto(BASE + '/app/agenda', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const k = 'vetmanager_whatsapp_config';
      const c = JSON.parse(localStorage.getItem(k) || '{}');
      localStorage.setItem(k, JSON.stringify({ ...c, auto_notify_ready: true }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2000);
    await prepare(page);
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    const row = page.locator('tr', { hasText: 'Canela' });
    await moveToEl(page, row.getByText('Canela').first(), 800);
    await sleep(400);
    await click(page, row.getByRole('button', { name: /Baño listo/ }), 900, !DRY);
    await sleep(3200);
  },

  async pos(page, rec) {
    await open(page, '/app/pos');
    await setCursor(page, 1200, 500);
    await rec.start();
    await sleep(300);
    const scan = page.getByPlaceholder('Escanea o busca un producto…');
    await click(page, scan, 700);
    await typeSlow(page, '7861000000012', 35);
    await page.keyboard.press('Enter');
    await sleep(500);
    await typeSlow(page, '7861000000043', 35);
    await page.keyboard.press('Enter');
    await sleep(700);
    const cobrar = page.getByRole('button', { name: DRY ? /Cobrar/ : 'Cobrar y facturar' });
    await click(page, cobrar, 900, !DRY);
    if (!DRY) await page.getByText(/Autorizad/).first().waitFor({ timeout: 40000 }).catch(() => {});
    await sleep(1800);
  },

  async ventas(page, rec) {
    await open(page, '/app/ventas');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.locator('tbody tr').first().getByText('Autorizada'), 900);
    await sleep(1500);
  },

  async sri(page, rec) {
    await open(page, '/app/configuracion/sri');
    await setCursor(page, 900, 400);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.locator('select').filter({ hasText: 'Régimen General' }).first(), 900);
    await sleep(1500);
  },

  async inventario(page, rec) {
    await open(page, '/app/catalogo');
    await setCursor(page, 900, 500);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Stock bajo', { exact: false }).first(), 700);
    await sleep(400);
    await moveToEl(page, page.getByText('Alertas caducidad', { exact: false }).first(), 700);
    await sleep(300);
    await click(page, page.getByRole('button', { name: 'Vencimientos y Lotes' }), 800);
    await sleep(1800);
  },

  async caja(page, rec) {
    await open(page, '/app/caja');
    await setCursor(page, 900, 400);
    await rec.start();
    await sleep(300);
    const contado = page.locator('label:has-text("Dinero contado") input, label:has-text("Dinero contado") + input').first();
    // Escribe exactamente lo que la app espera, para que muestre "(cuadra)".
    const montos = [...(await page.getByText('Debería haber').locator('..').innerText()).matchAll(/\$\s*([\d.,]+)/g)];
    const esperado = montos.at(-1)[1].replace(',', '');
    await click(page, contado, 800);
    await typeSlow(page, esperado, 120);
    await sleep(300);
    await moveToEl(page, page.getByText(/Diferencia:/).first(), 600);
    await sleep(1400);
  },

  async gastos(page, rec) {
    await open(page, '/app/gastos');
    await page.getByRole('button', { name: 'Este mes' }).click().catch(() => {});
    await sleep(1200);
    await prepare(page);
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Total del período', { exact: false }).first(), 700);
    await sleep(300);
    await moveToEl(page, page.getByText('Internet del local', { exact: false }).first(), 700);
    await sleep(1000);
  },

  async reportes(page, rec) {
    await open(page, '/app/reportes');
    await setCursor(page, 900, 300);
    await rec.start();
    await sleep(300);
    await moveToEl(page, page.getByText('Margen bruto', { exact: false }).first(), 700);
    await sleep(300);
    await moveToEl(page, page.getByText('Utilidad neta', { exact: false }).first(), 600);
    await sleep(500);
    for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 22); await sleep(25); }
    await moveTo(page, 900, 600, 600);
    await sleep(1200);
  },
};
