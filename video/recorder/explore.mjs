// Recorre pantallas en modo SOLO LECTURA y guarda capturas 1920x1080.
// No hace clic en nada que guarde datos.
// Uso: node explore.mjs <carpeta-perfil> <carpeta-salida>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [profileDir, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const BASE = 'https://nexokids.pages.dev';
const rutas = [
  ['panel', '/app'],
  ['beneficiarios', '/app/beneficiarios'],
  ['representantes', '/app/representantes'],
  ['asistencia', '/app/asistencia'],
  ['cobros', '/app/cobros'],
  ['facturas', '/app/facturas'],
];

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: true,
  viewport: { width: 1920, height: 1080 },
});
const page = context.pages()[0] ?? (await context.newPage());
for (const [nombre, ruta] of rutas) {
  await page.goto(BASE + ruta, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${nombre}.png` });
  console.log(nombre, page.url());
}
await context.close();
