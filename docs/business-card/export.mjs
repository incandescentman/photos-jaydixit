import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Usage: node export.mjs [design] [face ...]
//   design: "night" (default) or "ghost"
//   faces:  "front" and/or "back"; omit to export all faces of the design.
const DESIGNS = {
  night: {
    html: 'business-card-night-premiere.html',
    faces: {
      front: 'business-card-front.png',
      back: 'business-card-back.png',
    },
  },
  ghost: {
    html: 'business-card-ghost-disc-hero.html',
    faces: {
      front: 'business-card-ghost-hero-front.png',
      back: 'business-card-ghost-hero-back.png',
    },
  },
};

const args = process.argv.slice(2);
const designName = args[0] in DESIGNS ? args.shift() : 'night';
const design = DESIGNS[designName];
const htmlPath = join(here, design.html);
const wanted = args;
const faces = Object.entries(design.faces)
  .map(([name, out]) => ({ name, id: '#' + name, out: join(here, out) }))
  .filter((f) => wanted.length === 0 || wanted.includes(f.name));

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
