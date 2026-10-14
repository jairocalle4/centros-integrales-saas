// Ejecuta un paso contra el Chrome de browser-server.mjs.
// Uso: node step.mjs <archivo-paso.mjs> [captura.png]
// El archivo del paso exporta `default async (page) => {...}`.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [stepFile, shot] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];
try {
  const mod = await import(pathToFileURL(resolve(stepFile)).href);
  const out = await mod.default(page);
  if (out !== undefined) console.log(JSON.stringify(out, null, 1));
} finally {
  if (shot) await page.screenshot({ path: shot });
  console.log('URL:', page.url());
  await browser.close().catch(() => {});
}
