// Abre un Chrome visible para que el usuario inicie sesión a mano.
// Guarda la sesión (localStorage/cookies) en un perfil fuera del repo.
// Uso: node login.mjs <carpeta-perfil> <url-base>
import { chromium } from 'playwright';

const [profileDir, baseUrl = 'http://localhost:5180'] = process.argv.slice(2);
if (!profileDir) {
  console.error('Falta la carpeta del perfil');
  process.exit(1);
}

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 800 },
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${baseUrl}/login`);
console.log('Esperando a que el usuario inicie sesión…');

// Espera hasta 15 min a que la app llegue al panel del centro.
await page.waitForURL(/\/app(\/|$|\?)/, { timeout: 15 * 60 * 1000 });
await page.waitForTimeout(3000);
console.log('Sesión iniciada en:', page.url());
await context.close();
