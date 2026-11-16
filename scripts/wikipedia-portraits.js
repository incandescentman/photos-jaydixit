#!/usr/bin/env node
// Builds src/data/wikipedia-portraits.json: every person whose Wikipedia article, in any
// language, uses one of Jay's photographs, plus the people in
// src/data/wikipedia-portraits-manual.json whose articles used one before.
//
// Sources:
//   - Jay's Commons uploads: the Photo Publication Inventory (run `pnpm photo:inventory` first if stale)
//   - Crops and other derivatives uploaded by other Commons users: Commons files that credit "Jay Dixit"
//   - Current usage: Commons GlobalUsage; person detection: Wikidata P31 = Q5 (human)
// Commons only reports current usage; past usage comes from the manual file.
//
// Usage: node scripts/wikipedia-portraits.js [--refresh]
//   Stages are cached in output/wikipedia-usage/cache/; --refresh refetches everything.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = '/Users/jay/Dropbox/roam/photography/20260902015339-photo_publication_inventory.org';
const CACHE = path.join(root, 'output/wikipedia-usage/cache');
const OUT = path.join(root, 'src/data/wikipedia-portraits.json');
const MANUAL = path.join(root, 'src/data/wikipedia-portraits-manual.json');
// Jay's ratings of photos on the page; a photo he rates bad is left off (Jay, 2026-11-16).
const RATINGS = path.join(root, 'src/data/wikipedia-photo-ratings.json');
const PEOPLE = path.join(root, 'src/data/people.json');
const UA = 'photo-usage-check/1.0 (personal research script; https://www.mediawiki.org/wiki/API:Etiquette)';
const refresh = process.argv.includes('--refresh');
fs.mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(host, params, { maxlag = true } = {}) {
	let wait = 5000;
	for (let attempt = 0; ; attempt++) {
		await sleep(1200);
		const body = new URLSearchParams({
			format: 'json',
			formatversion: '2',
			...(maxlag ? { maxlag: '5' } : {}),
			...params,
		});
		const r = await fetch(`https://${host}/w/api.php`, {
			method: 'POST',
			headers: { 'User-Agent': UA, 'Api-User-Agent': UA },
			body,
		});
		const text = await r.text();
		let json;
		try {
			json = JSON.parse(text);
		} catch {
			json = null;
		}
		if (json && !json.error) return json;
		if (json?.error && json.error.code !== 'maxlag') throw new Error(`${host}: ${JSON.stringify(json.error)}`);
		if (attempt >= 6) throw new Error(`${host}: gave up after retries: ${text.slice(0, 120)}`);
		console.error(`${host}: ${json?.error?.code ?? r.status}, retrying in ${wait / 1000}s`);
		await sleep(wait);
		wait *= 2;
	}
}

async function cached(name, fn) {
	const file = path.join(CACHE, `${name}.json`);
	if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
	const value = await fn();
	fs.writeFileSync(file, JSON.stringify(value, null, 2));
	return value;
}

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const articleUrl = (wiki, title) => `https://${wiki}/wiki/${encodeURI(title).replace(/\?/g, '%3F')}`;
const commonsUrl = (file) => `https://commons.wikimedia.org/wiki/${encodeURI(file.replace(/ /g, '_')).replace(/\?/g, '%3F')}`;
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
function languageOf(wiki) {
	const code = wiki.replace('.wikipedia.org', '');
	if (code === 'simple') return 'Simple English';
	try {
		const name = languageNames.of(code);
		return name && name !== code ? name : code;
	} catch {
		return code;
	}
}
// Language editions, not wikis: Simple English is English, and be-tarask is Belarusian.
const languageKey = (wiki) => {
	const code = wiki.replace('.wikipedia.org', '');
	return code === 'simple' ? 'en' : code === 'be-tarask' ? 'be' : code;
};
const countLanguages = (wikis) => new Set(wikis.map(languageKey)).size;
const normalizeName = (s) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’']/g, "'")
		.toLowerCase()
		.trim();

// 1. Jay's own Commons uploads.
const inventory = fs.readFileSync(INVENTORY, 'utf8');
const jayFiles = [...inventory.matchAll(/^\*\* (File:[^\n]+)$/gm)].map((m) => m[1].trim());
const jaySet = new Set(jayFiles);

// 2. Files on Commons that credit Jay Dixit but were uploaded by someone else (crops, retouches).
const credited = await cached('credited-files', async () => {
	const titles = [];
	let sroffset;
	do {
		const j = await api('commons.wikimedia.org', {
			action: 'query',
			list: 'search',
			srnamespace: '6',
			srsearch: 'insource:"Jay Dixit"',
			srlimit: 'max',
			srprop: '',
			...(sroffset ? { sroffset } : {}),
		});
		titles.push(...j.query.search.map((s) => s.title));
		sroffset = j.continue?.sroffset;
	} while (sroffset);
	return titles;
});
const derivatives = credited.filter((t) => !jaySet.has(t));
const allFiles = [...jayFiles, ...derivatives];

// 3. Where every file is used now (article namespace only).
const usage = await cached('global-usage', async () => {
	const rows = {};
	for (const batch of chunks(allFiles, 50)) {
		let cont = {};
		do {
			const j = await api('commons.wikimedia.org', {
				action: 'query',
				prop: 'globalusage',
				titles: batch.join('|'),
				gulimit: 'max',
				guprop: 'namespace',
				...cont,
			});
			for (const page of j.query.pages) {
				for (const u of page.globalusage || []) {
					if (String(u.ns) !== '0' || !/\.wikipedia\.org$/.test(u.wiki)) continue;
					const key = `${u.wiki}|${u.title}`;
					const row = (rows[key] ||= { wiki: u.wiki, title: u.title, files: [] });
					if (!row.files.includes(page.title)) row.files.push(page.title);
				}
			}
			cont = j.continue || {};
		} while (cont.gucontinue);
	}
	return Object.values(rows);
});

// 4. The Wikidata item behind each article.
const withItems = await cached('article-items', async () => {
	const byWiki = {};
	for (const row of usage) (byWiki[row.wiki] ||= []).push({ ...row });
	for (const [wiki, rows] of Object.entries(byWiki)) {
		for (const batch of chunks(rows, 50)) {
			const j = await api(wiki, {
				action: 'query',
				prop: 'pageprops',
				ppprop: 'wikibase_item',
				titles: batch.map((r) => r.title.replace(/_/g, ' ')).join('|'),
			});
			const original = {};
			for (const n of j.query.normalized || []) original[n.to] = n.from;
			for (const page of j.query.pages) {
				const asGiven = (original[page.title] || page.title).replace(/ /g, '_');
				const row = batch.find((r) => r.title === asGiven || r.title === page.title.replace(/ /g, '_'));
				if (row) row.qid = page.pageprops?.wikibase_item ?? null;
			}
		}
	}
	return Object.values(byWiki).flat();
});

// 5. Which items are people, with their English names. Wikidata reads skip maxlag:
// it tracks query-service lag, which routinely exceeds any useful threshold.
const entities = await cached('entities', async () => {
	const ids = [...new Set(withItems.map((r) => r.qid).filter(Boolean))];
	const out = {};
	for (const batch of chunks(ids, 50)) {
		const j = await api(
			'www.wikidata.org',
			{ action: 'wbgetentities', ids: batch.join('|'), props: 'claims|labels|sitelinks', languages: 'en', sitefilter: 'enwiki' },
			{ maxlag: false },
		);
		for (const [id, e] of Object.entries(j.entities)) {
			const p31 = (e.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
			out[id] = { human: p31.includes('Q5'), label: e.labels?.en?.value ?? null, enwiki: e.sitelinks?.enwiki?.title ?? null };
		}
	}
	return out;
});

// 6. Group articles by person and choose the photo to show: the one in the English article,
// otherwise the one used in the most articles.
const languageOrder = ['en', 'de', 'fr', 'es', 'it', 'ja', 'pt', 'ru', 'zh', 'nl', 'pl', 'sv'];
const rank = (wiki) => {
	const i = languageOrder.indexOf(wiki.replace('.wikipedia.org', ''));
	return i === -1 ? languageOrder.length : i;
};
const people = {};
for (const row of withItems) {
	const e = entities[row.qid];
	if (!e?.human || !e.label) continue;
	const p = (people[row.qid] ||= { qid: row.qid, name: e.label, articles: [], current: true, source: 'commons-usage' });
	p.articles.push({ wiki: row.wiki, title: row.title, files: row.files });
}
// An article can use Jay's photo of someone else (a journalist's article showing an actor
// from his story), so a photo counts for a person only if its title, description, or
// categories name that person.
const candidateFiles = [...new Set(Object.values(people).flatMap((p) => p.articles.flatMap((a) => a.files)))];
const fileText = await cached('file-metadata', async () => {
	const out = {};
	for (const batch of chunks(candidateFiles, 50)) {
		const j = await api('commons.wikimedia.org', {
			action: 'query',
			prop: 'imageinfo',
			iiprop: 'extmetadata',
			iiextmetadatafilter: 'ImageDescription|ObjectName|Categories',
			titles: batch.join('|'),
		});
		const original = {};
		for (const n of j.query.normalized || []) original[n.to] = n.from;
		for (const page of j.query.pages) {
			const m = page.imageinfo?.[0]?.extmetadata || {};
			const text = [m.ObjectName?.value, m.ImageDescription?.value, m.Categories?.value]
				.filter(Boolean)
				.join(' ')
				.replace(/<[^>]+>/g, ' ');
			out[original[page.title] || page.title] = text;
		}
	}
	return out;
});
const searchable = (s) => normalizeName(s).replace(/[-_|,.()"]/g, ' ').replace(/\s+/g, ' ');
function names(file, person) {
	const hay = ` ${searchable(`${file} ${fileText[file] ?? ''}`)} `;
	const full = searchable(person.name);
	const tokens = full.split(' ').filter((t) => t.length >= 4);
	return hay.includes(` ${full} `) || (tokens.length > 0 && hay.includes(` ${tokens[tokens.length - 1]} `));
}
const notDepicted = [];
const ratings = fs.existsSync(RATINGS) ? JSON.parse(fs.readFileSync(RATINGS, 'utf8')) : [];
const badFiles = new Set(ratings.filter((r) => r.quality === 'bad').flatMap((r) => r.files));
const fileQuality = new Map(ratings.flatMap((r) => r.files.map((f) => [f, r.quality])));
const ratedBad = [];
for (const [key, p] of Object.entries(people)) {
	// Use the English article's title (Ray Kurzweil, not the Wikidata label Raymond Kurzweil).
	const enwiki = entities[p.qid]?.enwiki;
	if (enwiki) p.name = enwiki.replace(/\s*\([^)]*\)$/, '');
	p.articles.sort((a, b) => rank(a.wiki) - rank(b.wiki) || a.wiki.localeCompare(b.wiki));
	const counts = {};
	for (const a of p.articles) for (const f of a.files) if (names(f, p)) counts[f] = (counts[f] || 0) + 1;
	if (Object.keys(counts).length === 0) {
		notDepicted.push({ name: p.name, articles: p.articles.map((a) => articleUrl(a.wiki, a.title)), files: [...new Set(p.articles.flatMap((a) => a.files))] });
		delete people[key];
		continue;
	}
	for (const f of Object.keys(counts)) if (badFiles.has(f)) delete counts[f];
	if (Object.keys(counts).length === 0) {
		ratedBad.push(p.name);
		delete people[key];
		continue;
	}
	p.articles = p.articles.filter((a) => a.files.some((f) => counts[f]));
	const en = p.articles.find((a) => a.wiki === 'en.wikipedia.org');
	p.file = en?.files.find((f) => counts[f]) ?? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// 7. People whose articles used Jay's photo before (Jay's record). Entries already found above are skipped.
const manual = fs.existsSync(MANUAL) ? JSON.parse(fs.readFileSync(MANUAL, 'utf8')) : [];
const byName = new Map(Object.values(people).map((p) => [normalizeName(p.name), p]));
const missingManual = [];
for (const m of manual) {
	if (byName.has(normalizeName(m.name))) continue;
	const file =
		m.file ??
		jayFiles.find((f) => normalizeName(f.replace(/^File:/, '')).startsWith(normalizeName(m.name) + ' at')) ??
		null;
	if (!file) {
		missingManual.push(m.name);
		continue;
	}
	if (badFiles.has(file)) {
		ratedBad.push(m.name);
		continue;
	}
	const enwiki = m.enwiki ?? m.name.replace(/ /g, '_');
	people[`manual:${m.name}`] = {
		qid: m.qid ?? null,
		name: m.name,
		articles: [{ wiki: 'en.wikipedia.org', title: enwiki, files: [] }],
		current: false,
		source: m.source ?? 'jay',
		file,
	};
}

// 8. Image URLs and sizes for the chosen photos.
const chosen = [...new Set(Object.values(people).map((p) => p.file))];
const imageInfo = {};
for (const width of [480, 960, 1920]) {
	for (const batch of chunks(chosen, 50)) {
		const j = await api('commons.wikimedia.org', {
			action: 'query',
			prop: 'imageinfo',
			iiprop: 'url|size',
			iiurlwidth: String(width),
			titles: batch.join('|'),
		});
		const original = {};
		for (const n of j.query.normalized || []) original[n.to] = n.from;
		for (const page of j.query.pages) {
			const title = original[page.title] || page.title;
			const ii = page.imageinfo?.[0];
			if (!ii) continue;
			const info = (imageInfo[title] ||= { width: ii.width, height: ii.height, thumbs: {} });
			info.thumbs[width] = { url: ii.thumburl, width: ii.thumbwidth, height: ii.thumbheight };
		}
	}
}

// 9. Link to the person's Red Carpet page when the site has one.
const sitePeople = JSON.parse(fs.readFileSync(PEOPLE, 'utf8'));
const siteSlug = new Map(sitePeople.map((p) => [normalizeName(p.name), p.slug]));

const output = [];
const unresolved = [];
for (const p of Object.values(people)) {
	const info = imageInfo[p.file];
	if (!info?.thumbs[960]) {
		unresolved.push(`${p.name}: ${p.file}`);
		continue;
	}
	const primary = p.articles[0];
	output.push({
		name: p.name,
		sortName: p.name,
		qid: p.qid,
		slug: siteSlug.get(normalizeName(p.name)) ?? null,
		current: p.current,
		source: p.source,
		article: { url: articleUrl(primary.wiki, primary.title), language: languageOf(primary.wiki) },
		languages: [...new Set(p.articles.map((a) => languageOf(a.wiki)))],
		languageCount: countLanguages(p.articles.map((a) => a.wiki)),
		quality: fileQuality.get(p.file) ?? 'unreviewed',
		articles: p.articles.map((a) => ({ language: languageOf(a.wiki), url: articleUrl(a.wiki, a.title) })),
		photo: {
			file: p.file,
			byJay: jaySet.has(p.file),
			commonsUrl: commonsUrl(p.file),
			thumb: info.thumbs[960].url,
			thumbWidth: info.thumbs[960].width,
			thumbHeight: info.thumbs[960].height,
			srcset: [480, 960]
				.map((w) => info.thumbs[w] && `${info.thumbs[w].url} ${info.thumbs[w].width}w`)
				.filter(Boolean)
				.join(', '),
			full: info.thumbs[1920].url,
			fullWidth: info.thumbs[1920].width,
			fullHeight: info.thumbs[1920].height,
		},
	});
}
output.sort((a, b) => a.sortName.localeCompare(b.sortName));

fs.writeFileSync(
	OUT,
	JSON.stringify(
		{
			generated: new Date().toISOString(),
			sources: {
				jayCommonsFiles: jayFiles.length,
				derivativeFiles: derivatives.length,
				wikipediaArticlesUsingPhotos: usage.length,
				wikipediaLanguages: countLanguages(usage.map((r) => r.wiki)),
			},
			people: output,
		},
		null,
		'\t',
	) + '\n',
);

console.log(
	`Jay's files: ${jayFiles.length}; derivatives: ${derivatives.length}; Wikipedia articles using them: ${usage.length}; ` +
		`people: ${output.length} (${output.filter((p) => !p.current).length} from the manual record)`,
);
fs.writeFileSync(path.join(CACHE, 'not-depicted.json'), JSON.stringify(notDepicted, null, 2));
if (notDepicted.length)
	console.log(`Left out, photo doesn't name the person (${notDepicted.length}): ${notDepicted.map((p) => p.name).join(', ')}`);
if (ratedBad.length) console.log(`Left out, Jay rated the photo bad (${ratedBad.length}): ${ratedBad.join(', ')}`);
if (missingManual.length) console.log(`Manual entries with no photo found: ${missingManual.join(', ')}`);
if (unresolved.length) console.log(`Photos without image info: ${unresolved.join('; ')}`);
