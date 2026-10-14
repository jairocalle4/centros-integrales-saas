// Mantiene abierto un Chrome con la sesión guardada y expone CDP en el
// puerto 9333 para que los scripts de pasos se conecten uno a uno.
// Uso: node browser-server.mjs <carpeta-perfil>
import { chromium } from 'playwright';

const [profileDir] = process.argv.slice(2);
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: process.env.HEADED !== '1',
  viewport: { width: 1920, height: 1080 },
  args: ['--remote-debugging-port=9333'],
});
const page = context.pages()[0] ?? (await context.newPage());
if (process.env.START_URL) await page.goto(process.env.START_URL);
console.log('Chrome listo en CDP 9333');
// Se mantiene vivo hasta que se detenga el proceso.
await new Promise(() => {});
