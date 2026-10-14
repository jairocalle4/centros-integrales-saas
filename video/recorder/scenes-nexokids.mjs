// Escenas del video de NexoKids (grabadas a escala 1).
import { DRY, sleep, setCursor, moveToEl, click, prepare, nav } from './lib.mjs';

export const BASE = 'https://nexokids.pages.dev';
export const DSF = 1;

export const escenas = {
  async agenda(page, rec) {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await sleep(2500);
    await prepare(page);
    await setCursor(page, 1300, 300);
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
    await setCursor(page, 900, 250);
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
    await setCursor(page, 700, 200);
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
    await setCursor(page, 1200, 200);
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
    await setCursor(page, 1000, 300);
    await rec.start();
    await sleep(400);
    await moveToEl(page, page.getByText('Utilidad neta', { exact: false }).first(), 800);
    await sleep(400);
    await page.mouse.wheel(0, 380);
    await sleep(1400);
  },
};
