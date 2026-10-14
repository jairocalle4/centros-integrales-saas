// Mantiene abierto un Chrome con la sesión guardada y expone CDP en el
// puerto 9333 para que los scripts de pasos se conecten uno a uno.
// Uso: node browser-server.mjs <carpeta-perfil>
import { chromium } from 'playwright';

const [profileDir] = process.argv.slice(2);
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: process.env.HEADED !== '1',
  // DSF=2 → Chrome con escala nativa 2 (como pantalla retina): la captura sale
  // a 3840x2160 y los zooms del video vertical se ven nítidos.
  ...(process.env.DSF
    ? { viewport: null, args: ['--remote-debugging-port=9333', '--window-size=1938,1176', `--force-device-scale-factor=${process.env.DSF}`] }
    : { viewport: { width: 1920, height: 1080 }, args: ['--remote-debugging-port=9333'] }),
});
const page = context.pages()[0] ?? (await context.newPage());
if (process.env.START_URL) await page.goto(process.env.START_URL);
console.log('Chrome listo en CDP 9333');
// Se mantiene vivo hasta que se detenga el proceso.
await new Promise(() => {});
