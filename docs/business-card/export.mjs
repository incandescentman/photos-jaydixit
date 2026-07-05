import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, 'business-card-night-premiere.html');

// Optionally pass face names as CLI args (e.g. `node export.mjs front`) to export a subset.
const wanted = process.argv.slice(2);
const faces = [
  { name: 'front', id: '#front', out: join(here, 'business-card-front.png') },
  { name: 'back', id: '#back', out: join(here, 'business-card-back.png') },
].filter((f) => wanted.length === 0 || wanted.includes(f.name));

const browser = await chromium.launch();
// deviceScaleFactor 2 => 1050x600 CSS px renders to 2100x1200 PNG (600dpi-class)
const context = await browser.newContext({
  viewport: { width: 1200, height: 1400 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400); // settle web-font paint

for (const f of faces) {
  const el = await page.$(f.id);
  await el.screenshot({ path: f.out });
  console.log('wrote', f.out);
}

await browser.close();
