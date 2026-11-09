/* global console, fetch, AbortSignal */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { openSync } from 'fontkit';

const fontfile = fileURLToPath(
	new URL('../src/assets/social-fonts/Newsreader.ttf', import.meta.url),
);
const paper = '#faf9f6';
const ink = '#1a1714';
const escape = (text) =>
	text.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
	);

const headingFont = openSync(fontfile);
const labelFont = openSync(
	fileURLToPath(new URL('../src/assets/social-fonts/InstrumentSans.ttf', import.meta.url)),
);

async function textImage(
	text,
	width,
	maxHeight,
	size,
	color = ink,
	sans = false,
	weight = 400,
	tracking = sans ? 0 : -0.01,
) {
	for (let fontSize = size; fontSize >= Math.min(size, 24); fontSize -= 2) {
		const font = sans
			? labelFont.getVariation({ wght: weight, wdth: 100 })
			: headingFont.getVariation({ wght: weight, opsz: Math.min(72, fontSize) });
		const scale = fontSize / font.unitsPerEm;
		const measure = (value) =>
			font.layout(value).advanceWidth * scale +
			Math.max(0, font.layout(value).glyphs.length - 1) * tracking * fontSize;
		const lines = [];
		let line = '';
		for (const word of text.split(/\s+/)) {
			if (line && measure(`${line} ${word}`) > width - 8) {
				lines.push(line);
				line = word;
			} else line = line ? `${line} ${word}` : word;
		}
		if (line) lines.push(line);
		const lineHeight = fontSize * 1.12;
		const height = Math.ceil(
			(font.ascent - font.descent) * scale + (lines.length - 1) * lineHeight + 4,
		);
		if (height > maxHeight || lines.some((value) => measure(value) > width - 8)) continue;
		const paths = [];
		lines.forEach((value, row) => {
			const run = font.layout(value);
			let x = 4;
			run.glyphs.forEach((glyph, index) => {
				const pos = run.positions[index];
				paths.push(
					`<path transform="translate(${x + pos.xOffset * scale},${2 + font.ascent * scale + row * lineHeight - pos.yOffset * scale}) scale(${scale},${-scale})" d="${glyph.path.toSVG()}"/>`,
				);
				x += pos.xAdvance * scale + tracking * fontSize;
			});
		});
		return sharp(
			Buffer.from(
				`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${color}">${paths.join('')}</g></svg>`,
			),
		)
			.png()
			.toBuffer({ resolveWithObject: true });
	}
	throw new Error(`Social card title does not fit: ${text}`);
}

export async function renderCard({ title, image }) {
	const titleWidth = image ? 490 : 1060;
	const heading = await textImage(title, titleWidth, 360, image ? 74 : 100);
	const brand = await textImage('Jay Dixit', 170, 60, 37.6, ink, false, 500, -0.025);
	const seal = await sharp(
		fileURLToPath(new URL('../public/brand/red-carpet-seal.svg', import.meta.url)),
	)
		.resize(72, 72)
		.png()
		.toBuffer();
	const layers = [
		{ input: seal, left: 60, top: 36 },
		{ input: brand.data, left: 136, top: 48 },
		{
			input: (await textImage('PHOTOS', 100, 40, 12, '#c0261f', true, 600, 0.18)).data,
			left: 285,
			top: 65,
		},
		{ input: heading.data, left: 64, top: Math.round(300 - heading.info.height / 2) },
		{
			input: (await textImage('photos.jaydixit.com', 700, 50, 24, '#756f66', true)).data,
			left: 64,
			top: 554,
		},
	];
	if (image) {
		const fitted = await sharp(image)
			.rotate()
			.resize(530, 470, { fit: 'contain', background: paper })
			.png()
			.toBuffer();
		layers.push({ input: fitted, left: 606, top: 80 });
	}
	return sharp({ create: { width: 1200, height: 630, channels: 3, background: paper } })
		.composite(layers)
		.png()
		.toBuffer();
}

export function replaceSocialMetadata(html, { url, title }) {
	const clean = html.replace(
		/<meta\b[^>]*(?:property|name)=["'](?:og:image(?::[^"']*)?|twitter:image(?::[^"']*)?)["'][^>]*>/gi,
		'',
	);
	const tags = [
		['property', 'og:image', url],
		['property', 'og:image:alt', title],
		['property', 'og:image:width', '1200'],
		['property', 'og:image:height', '630'],
		['property', 'og:image:type', 'image/png'],
		['name', 'twitter:image', url],
		['name', 'twitter:image:alt', title],
	]
		.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escape(value)}">`)
		.join('');
	return clean.replace('</head>', `${tags}</head>`);
}

async function* htmlFiles(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* htmlFiles(file);
		else if (entry.name.endsWith('.html')) yield file;
	}
}

export async function generateSocialCards(outDir, site, logger = console) {
	let count = 0;
	for await (const file of htmlFiles(outDir)) {
		let html = await readFile(file, 'utf8');
		const marker = html.match(
			/<meta name="portfolio-social-card" content="([A-Za-z0-9+/=]+)"\s*\/?\s*>/,
		);
		if (!marker) continue;
		const card = JSON.parse(Buffer.from(marker[1], 'base64').toString('utf8'));
		let image;
		if (card.cover) {
			const url = new URL(card.cover, site);
			if (url.origin === new URL(site).origin) {
				const imagePath = path.resolve(outDir, `.${decodeURIComponent(url.pathname)}`);
				if (!imagePath.startsWith(path.resolve(outDir) + path.sep))
					throw new Error('Invalid social cover path');
				image = await readFile(imagePath);
			} else {
				if (url.protocol !== 'https:') throw new Error('Social covers require HTTPS');
				const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
				if (!response.ok) throw new Error(`Social cover failed: ${url} (${response.status})`);
				image = Buffer.from(await response.arrayBuffer());
			}
		}
		const png = await renderCard({ title: card.title, image });
		const hash = createHash('sha256').update(png).digest('hex').slice(0, 16);
		const relative = `/social/${hash}.png`;
		await mkdir(path.join(outDir, 'social'), { recursive: true });
		await writeFile(path.join(outDir, relative), png);
		html = replaceSocialMetadata(html.replace(marker[0], ''), {
			url: new URL(relative, site).href,
			title: card.title,
		});
		await writeFile(file, html);
		count++;
	}
	logger.info(`Generated page-specific social cards for ${count} pages.`);
	return count;
}

export default function socialCards() {
	let site;
	return {
		name: 'portfolio-social-cards',
		hooks: {
			'astro:config:done': ({ config }) => {
				site = config.site;
			},
			'astro:build:done': async ({ dir, logger }) =>
				generateSocialCards(fileURLToPath(dir), site, logger),
		},
	};
}
